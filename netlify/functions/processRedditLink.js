// Trip types configuration embedded directly in the function
const TRIP_TYPES = [
    { value: 0, label: '👥 Adults Only' },
    { value: 1, label: '👨‍👦 Family Trip' },
    { value: 2, label: '👶 Baby Friendly' },
    { value: 3, label: '🎉 Bachelor/Bachelorette' },
    { value: 4, label: '🏌️ Golf Trip' },
    { value: 5, label: '💍 Honeymoon' },
    { value: 6, label: '🎒 Solo Travels' }
];

const getMonthName = (monthNum) => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    // Subtract 1 since array is 0-based but months are 1-based
    return months[parseInt(monthNum) - 1] || monthNum;
};

// Function to fetch Reddit post data
async function fetchRedditPost(url) {
  try {
    const jsonUrl = url.replace(/\/?$/, '.json');
    console.log('Fetching from URL:', jsonUrl);
    
    const response = await fetch(jsonUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TripPlanner/1.0)'
        }
    });
    console.log('Reddit API response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Reddit API response data:', data);
    const postData = data[0].data.children[0].data;
    
    return {
      title: postData.title,
      selftext: postData.selftext,
      created_utc: postData.created_utc,
    };
  } catch (error) {
    console.error('Error in fetchRedditPost:', error);
    throw new Error(`Failed to fetch Reddit post: ${error.message}`);
  }
}

// Function to extract places and metadata using Claude
async function analyzePost(title, selftext, postDate) {
  try {
    // Generate trip types list dynamically from config
    const tripTypesList = TRIP_TYPES.map(type => 
      `     * ${type.label.split(' ')[1]} (${type.value})`
    ).join('\n');

    const prompt = `
    Your task is to analyze this trip report and transform it into a helpful resource for future travelers. The input is:

    Title: ${title}
    Content: ${selftext}
    Post Date: ${new Date(postDate * 1000).toISOString()}

    Context:
    This analysis will be used to create a trip review for people seeking travel inspiration and planning similar trips. Focus on extracting meaningful, actionable information that would be valuable for trip planning. Avoid including superficial or passing mentions that don't provide real value to future travelers.

    Required Information:

    1. Create a summary (max 190 characters) that gives potential travelers a clear picture of:
    - The trip's scope and highlights
    - What makes this journey distinctive

    2. Extract only the places that would be relevant to future travelers. This should include places that fall into categories like 'To Do', 'To Stay' and 'To Eat/Drink'. Include a place only if:
    - It was a meaningful part of the trip (not just passed through)
    
    For each significant place, include:
    - Exact place name
    - commentary ONLY if it provides genuine value for trip planning
    
    Good commentary examples:
    - "10/10 this place was sick with a private pool. Think I paid $800 for 3 nights"
    - "Great family atmosphere but rooms were just okay. Restaurant is surprisingly really good"
    
    Don't include generic commentary like:
    - "it was cool"
    - "pretty nice place"
    - "we went there"

    Do not paraphrase or create commentary - use exact quotes only.

    3. Analyze the text to determine:
    - Total number of people on trip (provide best estimate based on context)
    - Month and year of trip (use post date as fallback if not mentioned)
    - Duration of the trip in days (provide best estimate based on context)
    - Best matching trip type from this list:
    ${tripTypesList}

    Return the data in this exact JSON structure:
    {
    "shortDescription": string (max 190 chars),
    "placeList": [
        {
        "title": string,
        "commentary": string (optional, only include if there's substantial, helpful commentary)
        }
    ],
    "numPeople": number,
    "month": string,
    "year": string,
    "days": number,
    "type": number (must be one of the values shown above),
    }`;

    console.log('Sending request to Claude');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    console.log('Claude API response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('About to parse Claude response to JSON');
    const claudeData = await response.json();
    console.log('Claude response parsed to JSON:', JSON.stringify(claudeData, null, 2));

    console.log('Getting text from Claude response');
    const claudeResponse = claudeData.content[0].text;
    console.log('Claude response text:', claudeResponse);

    console.log('Attempting to match JSON in response');
    const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error('No JSON match found in Claude response');
        throw new Error('Failed to extract JSON from Claude response');
    }
    console.log('JSON match found:', jsonMatch[0]);

    console.log('Attempting to parse matched JSON');
    const result = JSON.parse(jsonMatch[0]);
    console.log('Successfully parsed result:', JSON.stringify(result, null, 2));
    
    return result;

  } catch (error) {
    if (error instanceof SyntaxError) {
        console.error('JSON Parse Error:', error);
        console.error('Incomplete JSON:', error.message);
        throw new Error('Failed to parse Claude response - response may have been truncated');
    }
    throw error;
  }
}

// Main handler function for Netlify
exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const { url } = JSON.parse(event.body);
    
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    const postData = await fetchRedditPost(url);
    const result = await analyzePost(postData.title, postData.selftext, postData.created_utc);
    const month = result.month.length <= 2 ? getMonthName(result.month) : result.month;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: postData.title,
        shortDescription: result.shortDescription,
        longDescription: postData.selftext,
        places: result.placeList,
        numPeople: result.numPeople,
        month: month,
        year: result.year,
        days: result.days,
        type: result.type
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
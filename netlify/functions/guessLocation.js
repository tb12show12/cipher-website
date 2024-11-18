const fetch = require('node-fetch');

exports.handler = async function(event) {
    const apiKey = process.env.OPENAI_API_KEY; // Your Google Places API key

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { tripTitle, tripShortDescription } = JSON.parse(event.body);

        const promptString = 
            `Please analyze the following data and guess the geographic coordinates of where this trip is taking place.\n\n
            
            Title: ${tripTitle}\n
            Short Description: ${tripShortDescription}\n
            
            "Title" is the name of a trip that a user has created, and Short Description is a description of that trip. Your job is determine the geographic coordinates of where
            this trip took place. For example, if the title is "Weekend in Los Angeles", it is reasonable to assume the trip took place in Los Angeles and you should answer with the
            coordinates of somewhere close to (but not exactly on top of) the Los Angeles city center. This way if I have multiple trips in the same city, you do not give the exact same coordinates every single time.
            
            Sometimes it may be a little bit less straight forward and you may need to use the information provided in Short Description. For example
            if the title of the trip is "Belmont Race Weekend" and the Short Description references horses, you can probably reason that the user is talking about the Belmont Stakes which 
            takes place in Elmont, NY. It is OK if you do not have a perfect guess, please just give your best guess. If you think there are multiple locations, just pick one and choose
            a set of coordinates that match. For example if you the trip Title is "London, Paris, and Greece", you can just take the first place (London).\n
            
            Please format the return as only two numbers separated by a comma- LATITUDE,LONGITUDE`;

        const url = 'https://api.openai.com/v1/chat/completions';
        
        const payload = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [
                    {
                        "role": "user",
                        "content": promptString,
                    }
                ]
            })
        };

        const response = await fetch(url, payload);
        const data = await response.json();
        const coordinates = data.choices[0].message.content;
        
        if (coordinates) {
            const split = coordinates.split(',');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    result: true,
                    lat: split[0].trim(),
                    long: split[1].trim()
                })
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    result: false,
                    lat: null,
                    long: null
                })
            };
        }

    } catch (error) {
        console.error('Failed to fetch coordinates:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                result: false,
                lat: null,
                long: null
            })
        };
    }
};
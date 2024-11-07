const fetch = require('node-fetch');

exports.handler = async function(event) {
    const { input } = event.queryStringParameters;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY; // Your Google Places API key
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return {
            statusCode: 200,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                message: 'Failed to fetch data from Google Places API'
            })
        };
    }
};
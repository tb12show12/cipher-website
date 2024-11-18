const fetch = require('node-fetch');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { url } = JSON.parse(event.body);
        // Convert the Reddit URL to its JSON endpoint
        const jsonUrl = url.endsWith('/') ? `${url}.json` : `${url}/.json`;
        
        const response = await fetch(jsonUrl);
        const data = await response.json();
        
        // Reddit's JSON response includes the post content in data[0].data.children[0].data
        const postData = data[0].data.children[0].data;
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: postData.title,
                text: postData.selftext
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
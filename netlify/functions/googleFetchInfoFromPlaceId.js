const fetch = require('node-fetch');

exports.handler = async function(event) {
    if (!event.queryStringParameters || !event.queryStringParameters.placeId) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                status: 'error',
                message: 'placeId parameter is required'
            })
        };
    }

    const { placeId } = event.queryStringParameters;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    // Log the exact URL we're calling (with API key redacted)
    
    
    try {

        // First validate the Place ID
        const validateUrl = `https://places.googleapis.com/v1/places/${placeId}?fields=id&key=${apiKey}`;
        console.log('Validating Place ID:', placeId);
        const validateResponse = await fetch(validateUrl);
        console.log('Validation response status:', validateResponse.status);
        const validateData = await validateResponse.json();
        console.log('Validation response data:', JSON.stringify(validateData, null, 2));

        // Check if we got a valid ID (either same or refreshed)
        const validPlaceId = validateData.place_id;
        if (!validPlaceId) {
            console.log('No valid Place ID returned from validation');
            return {
                statusCode: 400,
                body: JSON.stringify({
                    status: 'error',
                    message: 'Invalid Place ID',
                    validation_response: validateData
                })
            };
        }

        // Log if ID was refreshed
        if (validPlaceId !== placeId) {
            console.log('Place ID refreshed:', {
                original: placeId,
                refreshed: validPlaceId
            });
        }

        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${validPlaceId}&fields=name,formatted_address&key=${apiKey}`;
        console.log('Calling URL:', detailsUrl.replace(apiKey, 'API_KEY'));
        
        const response = await fetch(detailsUrl);
        
        // Log raw response status and headers
        console.log('Response Status:', response.status);
        console.log('Response Headers:', Object.fromEntries(response.headers));
        
        const data = await response.json();
        
        // Log the complete response data for debugging
        console.log('Complete Google API response:', JSON.stringify(data, null, 2));
        
        if (data.status === 'REQUEST_DENIED') {
            console.error('API Key issue:', data.error_message);
            return {
                statusCode: 401,
                body: JSON.stringify({
                    status: 'error',
                    message: 'API request was denied',
                    details: data.error_message
                })
            };
        }

        if (data.result) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    description: `${data.result.name}, ${data.result.formatted_address}`,
                    place_id: placeId
                })
            };
        } else {
            // Log additional details about the failed request
            console.log('Failed request details:', {
                placeId,
                status: data.status,
                error_message: data.error_message
            });
            
            return {
                statusCode: 404,
                body: JSON.stringify({
                    status: 'error',
                    message: 'Place not found',
                    google_status: data.status,
                    details: data.error_message
                })
            };
        }
    } catch (error) {
        console.error('Fetch error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                message: 'Failed to fetch place details',
                error: error.message
            })
        };
    }
};
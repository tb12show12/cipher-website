const fetch = require('node-fetch');

exports.handler = async function(event) {
    const gpIds = JSON.parse(event.body);

    console.log(`gpIds: ${JSON.stringify(gpIds, null, 2)}`);

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const details = await Promise.all(gpIds.list.map(gpId => 
        fetchPlaceDetails(gpId, apiKey)
    ));

    return {
        statusCode: 200,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(details)
    };
};

async function fetchPlaceDetails(placeId, apiKey) {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${apiKey}&fields=name,formatted_address,photos,rating,user_ratings_total,website,place_id,types,geometry`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.error_message) {
            console.log(`Error fetching details for placeId ${placeId}: ${data.error_message}`);
            return null;  // Handle errors or incomplete data gracefully
        }
        return formatPlaceDetails(data.result, apiKey);
    } catch (error) {
        console.log(`Error fetching details for placeId ${placeId}: ${error.message}`);
        return null;  // Handle exceptions
    }
}

function formatPlaceDetails(details, apiKey) {
    // Simplify or reformat the details as needed for your application
    const formattedData = {
        title: details.name || null,
        address: details.formatted_address || null,
        image: details.photos ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${details.photos[0].photo_reference}&key=${apiKey}` : null,
        starRating: details.rating || null,
        numReviews: details.user_ratings_total || null,
        link: details.website || null,
        gpid: details.place_id || null,
        googlePlaceTypes: details.types || null,
        trips: [],
        type: 'xxx',
        comments: [],
        coordinates: {latitude: details.geometry?.location?.lat || null, longitude: details.geometry?.location?.lng || null},
    };

    console.log(`Format Place Details:`);
    console.log(formattedData);

    return formattedData;
}
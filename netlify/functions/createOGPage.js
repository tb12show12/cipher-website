var admin = require("firebase-admin");
var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const getTripDataFromFirebase = async (tripId) => {
    try {
        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) {
            console.log(`No trip found with ID: ${tripId}`);
            return null;
        }

        return tripDoc.data();

    } catch (error) {
        console.error(`Error fetching trip data: ${error.message}`);
        return null;
    }
};

exports.handler = async (event) => {

    const path = event.path;
    const pathParts = path.split('/'); // Split the path into parts
    const route = pathParts[1]; // This should be 'trip-share'
    const tripId = pathParts[2]; // This should be tripId
    
    const fullUrl = `https://cipher-app.com${path}`;


    // Function to fetch trip data from Firebase
    const tripData = await getTripDataFromFirebase(tripId);

    if (!tripData) {
        return {
            statusCode: 404,
            body: 'Trip not found',
        };
    }

    // Generate the HTML with OG tags
    const metaTags = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta property="og:title" content="${tripData.title}" />
            <meta property="og:description" content="${tripData.shortDescription}" />
            <meta property="og:image" content="${tripData.thumbnailURL}" />
            <meta property="og:url" content="${fullUrl}" />
            <meta property="og:type" content="website" />
        </head>
        <body>
            <p>This page is meant for social media crawlers to extract meta tags.</p>
        </body>
        </html>
    `;

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: metaTags,
    };
};

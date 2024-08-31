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

    try {
        const APP_STORE_URL = 'https://apps.apple.com/us/app/cipher-travel-memories-shared/id6503364756';
        const url = `https://cipher-app.com${event.path}`;  // The original Universal Link
        const userAgent = event.headers['user-agent'];
    
        const path = event.path;
        const pathParts = path.split('/'); // Split the path into parts
        const route = pathParts[1]; // This should be 'trip-share'
        
        let tripId = null;
        let userId = null;
    
        if (pathParts.length === 3){
            tripId = pathParts[2];
        } else {
            userId = pathParts[2];
            tripId = pathParts[3];
        }
        
        // Function to fetch trip data from Firebase
        const tripData = await getTripDataFromFirebase(tripId);

        const title = (pathParts[1] === 'trip-share') ? 'Check out this trip on Cipher!' : `You're invited to join this trip on Cipher!`;
        const description = tripData?.shortDescription || "Join Cipher to capture and share your travel experiences with friends and family";
        const imageUrl = tripData?.thumbnailURL || "https://cipher-app.com/assets/Butterfly2.png";
    
        if (!tripData) {
            return {
                statusCode: 404,
                body: 'Trip not found',
            };
        }
    
        // Generate the HTML with OG tags
        const responseHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${description}" />
                <meta property="og:image" content="${imageUrl}" />
                <meta property="og:url" content="${url}" />
                <meta property="og:type" content="website" />
            </head>
            <body>
                <p>Redirecting you to the app store...</p>
                <script type="text/javascript">
                    setTimeout(function() {
                        console.log("Redirecting now to: '${APP_STORE_URL}'");
                        window.location = '${APP_STORE_URL}';
                    }, 150);
                </script>
                <noscript><meta http-equiv="refresh" content="0;url=${APP_STORE_URL}"></noscript>
            </body>
            </html>
        `;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: responseHTML,
        };

    } catch (error) {
        console.error("Error occurred in redirect function:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/plain' },
            body: 'Internal Server Error',
        };
    }
};

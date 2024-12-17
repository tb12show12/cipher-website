var admin = require("firebase-admin");
var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

exports.handler = async (event, context) => {
    try {
        const { tripId, invite } = event.queryStringParameters;
        
        // Get trip data from Firestore
        const tripDoc = await admin.firestore()
            .collection('trips')
            .doc(tripId)
            .get();
            
        if (!tripDoc.exists) {
            return {
                statusCode: 404,
                body: 'Trip not found'
            };
        }

        const tripData = tripDoc.data();
        const description = invite === 'true' ? 'Join this trip!' : 'Check out this trip!';

        // Create URL params for both og:url and redirect
        const urlParams = new URLSearchParams();
        urlParams.set('tripId', tripId);
        if (invite === 'true') {
            urlParams.set('invite', 'true');
        }
        const queryString = urlParams.toString();

        // Generate HTML with proper meta tags
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${tripData.title}</title>
                <link rel="icon" type="image/png" href="/assets/Butterfly2.png">
                
                <!-- Essential Meta Tags -->
                <meta property="og:title" content="${tripData.title}">
                <meta property="og:description" content="${description}">
                <meta property="og:image" content="${tripData.tripCoverPic || '/assets/Butterfly2.png'}">
                <meta property="og:url" content="https://${event.headers.host}/pages/navigate/navigate.html?${queryString}">
                <meta property="og:type" content="website">
                
                <!-- Twitter Card Tags -->
                <meta name="twitter:card" content="summary_large_image">
                
                <!-- Redirect -->
                <meta http-equiv="refresh" content="0;url=/pages/navigate/navigate.html?${queryString}">
                
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f3f2ef;
                        color: #333;
                    }
                </style>
            </head>
            <body>
                <div>Redirecting to ${tripData.title}...</div>
            </body>
            </html>
        `;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
            },
            body: html
        };
        
    } catch (error) {
        console.error('Share error:', error);
        return {
            statusCode: 500,
            body: 'Error generating share page'
        };
    }
};
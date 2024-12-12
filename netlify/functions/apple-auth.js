const admin = require('firebase-admin');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { id_token, code } = JSON.parse(event.body);

        // Verify the Apple ID token
        const applePublicKeys = await fetch('https://appleid.apple.com/auth/keys')
            .then(res => res.json());
        
        const decodedToken = jwt.decode(id_token, { complete: true });
        const kid = decodedToken.header.kid;
        const key = applePublicKeys.keys.find(k => k.kid === kid);
        
        const payload = jwt.verify(id_token, key);

        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
            });
        }

        // Create a custom token
        const firebaseToken = await admin.auth().createCustomToken(payload.sub, {
            email: payload.email,
            provider: 'apple.web'
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ firebaseToken })
        };

    } catch (error) {
        console.error('Apple auth error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
};
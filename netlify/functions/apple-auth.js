const admin = require('firebase-admin');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

exports.handler = async (event, context) => {
    console.log('Apple auth function started');
    
    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log('Parsing request body...');
        const { id_token, code } = JSON.parse(event.body);
        console.log('Tokens received:', { 
            id_token: id_token?.substring(0, 20) + '...',
            code: code?.substring(0, 20) + '...'
        });

        // Create a JWKS client for Apple's public keys
        const client = jwksClient({
            jwksUri: 'https://appleid.apple.com/auth/keys',
            cache: true,
            rateLimit: true
        });

        // Decode the token to get the key ID (kid)
        const decodedToken = jwt.decode(id_token, { complete: true });
        if (!decodedToken) {
            throw new Error('Failed to decode token');
        }

        // Get the signing key from Apple
        const getKey = (header, callback) => {
            client.getSigningKey(header.kid, (err, key) => {
                if (err) {
                    callback(err);
                    return;
                }
                const signingKey = key.getPublicKey();
                callback(null, signingKey);
            });
        };

        // Verify the token
        const payload = await new Promise((resolve, reject) => {
            jwt.verify(id_token, getKey, {
                algorithms: ['RS256'],
                issuer: 'https://appleid.apple.com',
                audience: 'services.cipher-app.web.authentication'  // your client_id
            }, (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            });
        });

        console.log('Token verified, payload:', {
            sub: payload.sub,
            email: payload.email
        });

        // Initialize Firebase Admin
        if (!admin.apps.length) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
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
        console.error('Apple auth error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};
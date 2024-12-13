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

        console.log('Token verified, payload:', payload);

        // Initialize Firebase Admin
        if (!admin.apps.length) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        // Try to find existing user by email
        const userRecord = await admin.auth()
            .getUserByEmail(payload.email)
            .catch(error => {
                if (error.code !== 'auth/user-not-found') {
                    throw error;
                }
                return null;
            });

        let uid;
        if (userRecord) {
            // Existing user found
            console.log('Found existing user:', userRecord.uid);
            uid = userRecord.uid;
            
            // Update user's Apple credentials if needed
            await admin.auth().updateUser(uid, {
                providerToLink: {
                    providerId: 'apple.com',
                    uid: payload.sub
                }
            });

            
            // Create a custom token
            const firebaseToken = await admin.auth().createCustomToken(uid, {
                email: payload.email,
                provider: 'apple.com'
            });

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firebaseToken })
            };

        } else {
            // No existing user found
            console.log('No existing user found for email:', payload.email);
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'User not found',
                    details: 'No existing user account found for this Apple ID'
                })
            };
        }

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
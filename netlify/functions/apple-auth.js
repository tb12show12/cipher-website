const admin = require('firebase-admin');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

exports.handler = async (event, context) => {
    console.log('🚀 Apple auth function started');
    console.log('Request headers:', JSON.stringify(event.headers, null, 2));
    
    if (event.httpMethod !== 'POST') {
        console.log('❌ Invalid method:', event.httpMethod);
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log('📦 Parsing request body...');
        const { id_token, code } = JSON.parse(event.body);
        console.log('🎟️ Tokens received:', { 
            id_token: id_token ? `${id_token.substring(0, 20)}...${id_token.slice(-20)}` : 'missing',
            code: code ? `${code.substring(0, 10)}...` : 'missing'
        });

        // Create a JWKS client for Apple's public keys
        console.log('🔑 Initializing JWKS client...');
        const client = jwksClient({
            jwksUri: 'https://appleid.apple.com/auth/keys',
            cache: true,
            rateLimit: true
        });

        // Decode the token to get the key ID (kid)
        console.log('🔍 Decoding token...');
        const decodedToken = jwt.decode(id_token, { complete: true });
        if (!decodedToken) {
            console.error('❌ Failed to decode token');
            throw new Error('Failed to decode token');
        }
        console.log('📄 Token header:', decodedToken.header);

        // Get the signing key from Apple
        console.log('🔐 Getting signing key for kid:', decodedToken.header.kid);
        const getKey = (header, callback) => {
            client.getSigningKey(header.kid, (err, key) => {
                if (err) {
                    console.error('❌ Error getting signing key:', err);
                    callback(err);
                    return;
                }
                console.log('✅ Got signing key');
                const signingKey = key.getPublicKey();
                callback(null, signingKey);
            });
        };

        // Verify the token
        console.log('🔎 Verifying token...');
        const payload = await new Promise((resolve, reject) => {
            jwt.verify(id_token, getKey, {
                algorithms: ['RS256'],
                issuer: 'https://appleid.apple.com',
                audience: 'services.cipher-app.web.authentication'
            }, (err, decoded) => {
                if (err) {
                    console.error('❌ Token verification failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Token verified');
                    resolve(decoded);
                }
            });
        });

        console.log('👤 Token payload:', {
            sub: payload.sub,
            email: payload.email,
            email_verified: payload.email_verified,
            is_private_email: payload.is_private_email,
            auth_time: payload.auth_time
        });

        // Initialize Firebase Admin
        console.log('🔥 Initializing Firebase Admin...');
        if (!admin.apps.length) {
            try {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                console.log('📄 Service account project:', serviceAccount.project_id);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log('✅ Firebase Admin initialized');
            } catch (error) {
                console.error('❌ Firebase init error:', error);
                throw new Error(`Firebase initialization failed: ${error.message}`);
            }
        }

        // Try to find existing user by email
        console.log('🔍 Looking for existing user with email:', payload.email);
        const userRecord = await admin.auth()
            .getUserByEmail(payload.email)
            .catch(error => {
                if (error.code !== 'auth/user-not-found') {
                    console.error('❌ Error looking up user:', error);
                    throw error;
                }
                console.log('⚠️ User not found');
                return null;
            });

        if (userRecord) {
            console.log('✅ Found existing user:', {
                uid: userRecord.uid,
                email: userRecord.email,
                providers: userRecord.providerData.map(p => p.providerId)
            });
            
            // Check if Apple provider is already linked
            const isAppleLinked = userRecord.providerData.some(
                provider => provider.providerId === 'apple.com'
            );
            
            if (!isAppleLinked) {
                console.log('🔄 Linking Apple credentials...');
                await admin.auth().updateUser(userRecord.uid, {
                    providerToLink: {
                        providerId: 'apple.com',
                        uid: payload.sub
                    }
                });
                console.log('✅ Apple credentials linked');
            } else {
                console.log('ℹ️ Apple provider already linked, skipping update');
            }

            console.log('🎟️ Creating Firebase custom token...');
            const firebaseToken = await admin.auth().createCustomToken(userRecord.uid, {
                email: payload.email,
                provider: 'apple.com'
            });
            console.log('✅ Firebase token created');

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firebaseToken })
            };

        } else {
            console.log('⚠️ No existing user found, creating new account...');

            try {
                // Create new Firebase user (without specifying UID)
                const newUserRecord = await admin.auth().createUser({
                    email: payload.email,
                    emailVerified: true, // Apple has verified this email
                    providerData: [{
                        providerId: 'apple.com',
                        uid: payload.sub
                    }]
                });

                console.log('✅ Created new user:', {
                    uid: newUserRecord.uid,
                    email: newUserRecord.email,
                    providers: newUserRecord.providerData.map(p => p.providerId)
                });

                // Create custom token for the new user
                const firebaseToken = await admin.auth().createCustomToken(newUserRecord.uid);
                console.log('🎟️ Created Firebase token for new user');

                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        firebaseToken,
                    })
                };
            } catch (error) {
                console.error('❌ Error creating new user:', {
                    name: error.name,
                    message: error.message,
                    code: error.code
                });
                throw error; // Will be caught by outer try-catch
            }
        }

    } catch (error) {
        console.error('❌ Apple auth error:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            details: error.details || 'No additional details'
        });
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message,
                errorCode: error.code
            })
        };
    }
};
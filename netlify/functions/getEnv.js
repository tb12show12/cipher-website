exports.handler = async function() {
    try {
        const env = {
            FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
            FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
            FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
            FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
            FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
            ANON_USER_ID: process.env.ANON_USER_ID,
            ANON_PASSWORD: process.env.ANON_PASSWORD,
            GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        };

        // Check if any required variables are missing
        const missingVars = Object.entries(env)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingVars.length > 0) {
            throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'success',
                message: 'All environment variables loaded',
                env: env
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                status: 'error',
                message: error.message
            })
        };
    }
};
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { password } = JSON.parse(event.body);
        
        // Compare with environment variable
        if (password === process.env.ADMIN_PASSWORD) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true })
            };
        }

        return {
            statusCode: 401,
            body: JSON.stringify({ success: false })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error' })
        };
    }
};

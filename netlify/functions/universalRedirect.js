exports.handler = async (event, context) => {
    const APP_STORE_URL = 'https://apps.apple.com/us/app/cipher-travel-memories-shared/id6503364756';
    const url = `https://cipher-app.com${event.path}`;  // The original Universal Link

    const userAgent = event.headers['user-agent'];
    
    // Detailed logging for debugging
    console.log("Event received:", JSON.stringify(event, null, 2));
    console.log("User-Agent:", userAgent);
    console.log("Generated Universal Link URL:", url);

    try {
        // For testing on Windows, we will always redirect to the App Store URL
        const responseHTML = `
            <html><body>
            <script type="text/javascript">
                console.log("Attempting to redirect to App Store in 3 seconds...");
                setTimeout(function() {
                    console.log("Redirecting now to: '${APP_STORE_URL}'");
                    window.location = '${APP_STORE_URL}';
                }, 3000);
            </script>
            <noscript><meta http-equiv="refresh" content="0;url=${APP_STORE_URL}"></noscript>
            </body></html>
        `;

        console.log("Returning HTML response for redirection...");

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: responseHTML
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

// This is a Netlify serverless function that handles deep linking for your app.
// It attempts to open the app on iOS devices using a custom URL scheme. If the app isn't installed,
// it redirects the user to the App Store. Non-iOS devices are redirected to the App Store directly.

exports.handler = async (event, context) => {
    const APP_STORE_URL = 'https://apps.apple.com/us/app/cipher-travel-memories-shared/id6503364756';
    const CUSTOM_URL_SCHEME = 'cipher-app://';
    
    
    /*  The user-agent string is extracted from the headers. It contains information about the user's 
        device and browser, which you can use to determine if they're using an iPhone or iPad.
    */
    const userAgent = event.headers['user-agent'];
    const path = event.path;

    // Construct the deep link URL
    const deepLinkURL = CUSTOM_URL_SCHEME + path;

    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        // iOS device detected, try to open the app
        // The <noscript> tag is used to handle cases where JavaScript is disabled in the user's browser.
        // meta tag is a fallback method to redirect to the App Store immediately if JavaScript is not available.

        const responseHTML = `
            <html><body>
            <script type="text/javascript">
                setTimeout(function() { window.location = '${APP_STORE_URL}'; }, 25);
                window.location = '${deepLinkURL}';
            </script>
            <noscript><meta http-equiv="refresh" content="0;url=${APP_STORE_URL}"></noscript>
            </body></html>
        `;

        // Return an HTML response that includes the above JavaScript for redirection
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: responseHTML
        };
    } else {
        // Non-iOS device detected: redirect directly to the App Store
        // 302 status code means "Found" and is used for redirection

        return {
            statusCode: 302,
            headers: {
                Location: APP_STORE_URL,
            },
        };
    }
};
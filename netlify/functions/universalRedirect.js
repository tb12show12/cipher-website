exports.handler = async (event, context) => {
    const APP_STORE_URL = 'https://apps.apple.com/us/app/cipher-travel-memories-shared/id6503364756';
    const url = `https://cipher-app.com${event.path}`;  // Keep the original Universal Link

    const userAgent = event.headers['user-agent'];

    // Check if the device is an iPhone or iPad
    if (/iPhone|iPad|iPod/.test(userAgent)) {
        // iOS device detected, try to open the app using the Universal Link
        const responseHTML = `
            <html><body>
            <script type="text/javascript">
            window.location = '${url}';    
            setTimeout(function() { window.location = '${APP_STORE_URL}'; }, 2000);
            </script>
            <noscript><meta http-equiv="refresh" content="0;url=${APP_STORE_URL}"></noscript>
            </body></html>
        `;
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: responseHTML
        };
    } else {
        // Non-iOS devices or unrecognized platforms should not be accessing this link
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'text/plain' },
            body: 'This app is only available for iOS devices.',
        };
    }
};

const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the form-encoded data
    const params = new URLSearchParams(event.body);
    const id_token = params.get('id_token');
    const code = params.get('code');
    const state = params.get('state');

    // Return HTML that posts the data to the parent window
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Processing Apple Sign In</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'apple-auth',
                id_token: '${id_token}',
                code: '${code}',
                state: '${state}'
              }, '*');
              window.close();
            } else {
              document.body.innerHTML = 'Please close this window and try again.';
            }
          </script>
        </body>
        </html>
      `
    };
  } catch (error) {
    console.error('Error processing Apple callback:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
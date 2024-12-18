export default async function (request, context) {
  const url = new URL(request.url);
  
  // Only handle /share routes
  if (!url.pathname.startsWith('/share')) {
    return;
  }

  const { tripId, invite } = Object.fromEntries(url.searchParams);
  
  try {
    // Fetch trip data from Firebase (you'll need to set up Firebase access)
    const response = await fetch(
      `https://us-central1-cipher-4fa1c.cloudfunctions.net/getTripData?tripId=${tripId}`
    );
  
    if (!response.ok) throw new Error('Failed to fetch trip data');

    const { tripData } = await response.json();

    const description = invite === 'true' ? 'Join this trip!' : 'Check out this trip!';
    
    // Construct the navigation URL with parameters
    const urlParams = new URLSearchParams();
    urlParams.set('tripId', tripId);
    if (invite === 'true') {
      urlParams.set('invite', 'true');
    }
    const queryString = urlParams.toString();

    // Create HTML with proper meta tags
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>${tripData.title} - Cipher</title>
          <link rel="icon" type="image/png" href="/assets/Butterfly2.png">
          
          <!-- Essential Meta Tags -->
          <meta property="og:title" content="${tripData.title}">
          <meta property="og:description" content="${description}">
          <meta property="og:image" content="${tripData.thumbnail || '/assets/Butterfly2.png'}">
          <meta property="og:url" content="https://${url.host}/pages/navigate/navigate.html?${queryString}">
          <meta property="og:type" content="website">
          
          <!-- Twitter Card Tags -->
          <meta name="twitter:card" content="summary_large_image">
          
          <!-- Redirect -->
          <meta http-equiv="refresh" content="0;url=/pages/navigate/navigate.html?${queryString}">
          
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: #f3f2ef;
                  color: #333;
              }
          </style>
      </head>
      <body>
          <div>Redirecting to ${tripData.title}...</div>
      </body>
      </html>`,
      {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
        },
      }
    );

  } catch (error) {
    console.error('Share error:', error);
    return new Response('Error generating share page', { status: 500 });
  }
}
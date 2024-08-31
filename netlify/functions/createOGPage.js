exports.handler = async (event) => {
    const { route, data1, data2, title, description, thumbnailUrl } = event.queryStringParameters;

    const fullUrl = data2 ? `https://cipher-app.com/${route}/${data1}/${data2}` : `https://cipher-app.com/${route}/${data1}`;

    // Generate the HTML with OG tags
    const metaTags = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:image" content="${thumbnailUrl}" />
            <meta property="og:url" content="${fullUrl}" />
            <meta property="og:type" content="website" />
            <title>${title}</title>
        </head>
        <body>
            <p>This page is meant for social media crawlers to extract meta tags.</p>
        </body>
        </html>
    `;

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: metaTags,
    };
};

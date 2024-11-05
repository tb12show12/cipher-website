// netlify/functions/createTrip.js
const admin = require('firebase-admin');

const DEFAULT_COVER_PIC = "https://firebasestorage.googleapis.com/v0/b/cipher-4fa1c.appspot.com/o/trips%2Fdefault%2FdefaultTripCoverPic.jpg?alt=media&token=dd4f49c0-08ea-4788-b0d1-d10abdbc7b8a";


// Initialize Firebase Admin once
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (error) {
    console.error('Error parsing service account:', error);
}

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { formData, imageBase64 } = JSON.parse(event.body);
        
        // Create initial trip document
        const tripDoc = await db.collection('trips').add({
            ...formData,
            dateCreated: admin.firestore.Timestamp.fromDate(new Date(formData.dateCreated)),
            dateTaken: admin.firestore.Timestamp.fromDate(new Date(formData.dateTaken)),  
        });

        const tripId = tripDoc.id;

        await db.collection('users').doc(formData.creatorId).update({
            trips: admin.firestore.FieldValue.arrayUnion(tripId)
        });

        
        // Convert base64 to buffer then Upload image. If no image, points to default
        let imageUrl = DEFAULT_COVER_PIC;

        if (imageBase64) {
            const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');
            const imageFileName = `tripCoverPic-${tripId}.jpg`;
            const imagePath = `trips/${tripId}/${imageFileName}`;
            const file = bucket.file(imagePath);
            
            await file.save(imageBuffer, {
                metadata: {
                    contentType: 'image/jpeg',
                }
            });
        
            imageUrl = await file.getDownloadURL();
        }
        
        // Update document with tripId and image URL
        await tripDoc.update({
            tripId: tripId,
            tripCoverPic: imageUrl
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, tripId })
        };

    } catch (error) {
        console.error('Error creating trip:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to create trip',
                message: error.message 
            })
        };
    }
};
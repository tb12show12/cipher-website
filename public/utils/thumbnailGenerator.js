import { TRIP_TYPES, DEFAULTS } from '/admin/config.js';

/**
 * Generates a thumbnail image for a trip and shows it in a preview modal
 * @param {Object} tripData - The trip data object
 * @returns {Promise<HTMLElement>} The thumbnail element
 */
export async function OLDgenerateTripThumbnail(trip) {
    // Create thumbnail element
    const thumbnailElement = document.createElement('div');
    thumbnailElement.className = 'trip-item thumbnail-template';  // Add both classes
    thumbnailElement.innerHTML = `
        
        <div class="trip-item-header" style="background-image: url('${trip.tripCoverPic || DEFAULTS.coverImage}')">
            <div class="trip-item-content">
                <div class="trip-item-main">
                    <div class="trip-item-title-block">
                        <h3>${trip.title}</h3>
                        <div class="trip-item-creator">
                            <span>by ${trip.creatorName}</span>
                            <span class="meta-separator">•</span>
                            <span> ${trip.month} ${trip.year} </span>
                        </div>
                    </div>
                    <div class="trip-item-description">${trip.shortDescription || ''}</div>
                </div>
                <div class="trip-item-meta">
                    <div class="trip-item-meta-left">
                        <span>${trip.days} ${parseInt(trip.days) === 1 ? 'day' : 'days'}</span>
                        <span class="meta-separator">•</span>
                        <span>${trip.numPeople} ${parseInt(trip.numPeople) === 1 ? 'person' : 'people'}</span>
                    </div>
                    <div class="trip-item-meta-right">
                        <span class="trip-type">
                            <i class="${TRIP_TYPES[trip.familyType]?.icon}"></i>
                            ${TRIP_TYPES[trip.familyType]?.label}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        <div class="thumbnail-footer">
            <img src="/assets/Butterfly2.png" alt="Cipher">
            <span>Created with <span class="cipher-text">Cipher</span>: Your travel memories, shared.</span>
        </div>
    `;

    // Create preview modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'thumbnail-preview-modal';
    modalOverlay.innerHTML = `
        <div class="thumbnail-preview-content">
            <button class="thumbnail-close-btn">&times;</button>
            <h2>Thumbnail Preview</h2>
            ${thumbnailElement.outerHTML}
            <div class="thumbnail-actions">
                <button class="thumbnail-generate-btn">Generate Thumbnail</button>
            </div>
        </div>
    `;

    // Add to document
    document.body.appendChild(modalOverlay);

    // Add event listeners
    const closeBtn = modalOverlay.querySelector('.thumbnail-close-btn');
    const generateBtn = modalOverlay.querySelector('.thumbnail-generate-btn');

    closeBtn.addEventListener('click', () => modalOverlay.remove());
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.remove();
    });

    generateBtn.addEventListener('click', async () => {
        try {
            generateBtn.disabled = true;

            const thumbnailEl = modalOverlay.querySelector('.thumbnail-template');
            await saveThumbnailToFirebase(thumbnailEl, trip.tripId, trip.tripCoverPic);
            console.log('Thumbnail saved to Firebase');

            setTimeout(() => modalOverlay.remove(), 1500);

        } catch (error) {
            console.error('Error in thumbnail generation:', error);
            generateBtn.disabled = false;
        }
    });
    return thumbnailElement;
}

/**
 * Generates and saves a trip thumbnail if needed
 * @param {Object} trip - The trip data object
 * @returns {Promise<string>} The thumbnail URL
 */
export async function ensureTripThumbnail(trip) {
    // If thumbnail is already ready, return the existing URL
    if (trip.thumbnailReady && trip.thumbnailURL) {
        console.log('Thumbnail already exists:', trip.thumbnailURL);
        return trip;
    }

    // Create and save new thumbnail
    console.log('Generating new thumbnail...');
    const thumbnailElement = createThumbnailElement(trip);
    
    try {
        const thumbnailURL = await saveThumbnailToFirebase(thumbnailElement, trip.tripId, trip.tripCoverPic);

        if (thumbnailURL) {
            trip.thumbnailURL = thumbnailURL;
            trip.thumbnailReady = true;
            return trip;
        }
        console.error('No thumbnail URL received from saveThumbnailToFirebase');
        return trip;

    } catch (error) {
        console.error('Error saving thumbnail:', error);
        return trip;
    }
}

/**
 * Creates the thumbnail element
 * @param {Object} trip - The trip data object
 * @returns {HTMLElement} The thumbnail element
 */
function createThumbnailElement(trip) {
    const thumbnailElement = document.createElement('div');
    thumbnailElement.className = 'trip-item thumbnail-template';
    thumbnailElement.innerHTML = `
        <div class="trip-item-header" style="background-image: url('${trip.tripCoverPic || DEFAULTS.coverImage}')">
            <div class="trip-item-content">
                <div class="trip-item-main">
                    <div class="trip-item-title-block">
                        <h3>${trip.title}</h3>
                        <div class="trip-item-creator">
                            <span>by ${trip.creatorName}</span>
                            <span class="meta-separator">•</span>
                            <span> ${trip.month} ${trip.year} </span>
                        </div>
                    </div>
                    <div class="trip-item-description">${trip.shortDescription || ''}</div>
                </div>
                <div class="trip-item-meta">
                    <div class="trip-item-meta-left">
                        <span>${trip.days} ${parseInt(trip.days) === 1 ? 'day' : 'days'}</span>
                        <span class="meta-separator">•</span>
                        <span>${trip.numPeople} ${parseInt(trip.numPeople) === 1 ? 'person' : 'people'}</span>
                    </div>
                    <div class="trip-item-meta-right">
                        <span class="trip-type">
                            <i class="${TRIP_TYPES[trip.familyType]?.icon}"></i>
                            ${TRIP_TYPES[trip.familyType]?.label}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        <div class="thumbnail-footer">
            <img src="/assets/Butterfly2.png" alt="Cipher">
            <span>Created with <span class="cipher-text">Cipher</span>: Your travel memories, shared.</span>
        </div>
    `;
    return thumbnailElement;
}

/**
 * Saves a thumbnail image to Firebase and updates the trip document
 * @param {HTMLElement} thumbnailElement - The HTML element to capture
 * @param {string} tripId - The trip ID
 * @returns {Promise<string>} The URL of the uploaded thumbnail
 */
async function saveThumbnailToFirebase(thumbnailElement, tripId, coverPicURL) {
    try {
         // Create a container for the thumbnail that will be temporarily added to the DOM
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.appendChild(thumbnailElement);
        document.body.appendChild(container);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const canvas = await html2canvas(thumbnailElement, {
            scale: 2,
            backgroundColor: null,
            useCORS: true,
            allowTaint: true,
            logging: true // Enable logging to see what's happening
        });

        // Convert to blob for upload
        const thumbnailBlob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png', 1.0);
        });

        // Set up storage reference
        const storageRef = firebase.storage().ref();
        console.log(`Saving as thumbnails/${tripId}.png`);
        const thumbnailRef = storageRef.child(`thumbnails/${tripId}.png`);

        // Upload will automatically replace any existing file with the same name
        const uploadTask = await thumbnailRef.put(thumbnailBlob);
        const thumbnailURL = await uploadTask.ref.getDownloadURL();
        
        console.log(`Saved and Retrieved download URL: ${thumbnailURL}`);
        
        // Update trip document
        await firebase.firestore()
            .collection('trips')
            .doc(tripId)
            .update({
                thumbnailURL: thumbnailURL,
                thumbnailReady: true
            });

        console.log(`Updated firebase trip document with ready and URL`);
        return thumbnailURL;

    } catch (error) {
        console.error('Error saving thumbnail:', error);
        throw error;
    }
}
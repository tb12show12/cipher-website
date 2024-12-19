import { displaySuccessMessage } from '/utils/notifications.js';
import { ensureTripThumbnail } from '/utils/thumbnailGenerator.js';

export async function showInviteModal(tripData, isInvite = false) {
    const existingModal = document.querySelector('.invite-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Wait for image to load before showing modal
    await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = tripData.thumbnailURL || tripData.tripCoverPic;
    });

    const modalContent = isInvite ? {
        title: 'Trip Invite',
        description: 'Send a link that will automatically add a new user as an attendee on this trip.',
        emailSubject: `You're invited to ${tripData.title} on Cipher: Travel Memories Shared`,
        emailBody: `You are invited to this trip on Cipher: Travel Memories Shared - it's a new app that allows you to save your travel experiences and be inspired by your friends and extended network.\n\n Click the link to join!`,
        url: `${window.location.origin}/share?tripId=${tripData.tripId}&invite=true`
    } : {
        title: 'Share Trip',
        description: 'Send a link to this trip so others can view it on Cipher!',
        emailSubject: `Check out ${tripData.title} on Cipher: Travel Memories Shared`,
        emailBody: `Check out this trip on Cipher: Travel Memories Shared - it's a new app that allows you to save your travel experiences and be inspired by your friends and extended network.\n\n Click the link to check it out!`,
        url: `${window.location.origin}/share?tripId=${tripData.tripId}`
    };

    const emailSubject = encodeURIComponent(modalContent.emailSubject);
    const emailBody = encodeURIComponent(modalContent.emailBody + '\n\n' + modalContent.url);

    const modalHtml = `
        <div class="modal-overlay">
            <div class="signup-modal-content" style="max-width: 400px;">
                <div class="signup-modal-nav">
                    <button class="signup-close-btn">&times;</button>
                </div>
                
                <div class="signup-header-container">
                    <img src="/assets/Butterfly2.png" alt="Cipher" class="signup-butterfly-icon">
                    <div class="signup-modal-header">
                        <h2>${modalContent.title}</h2>
                        <p>${modalContent.description}</p>
                    </div>
                </div>

                <div class="invite-content">
                    <div class="thumbnail-container" style="width: 80%; align-self: center;">
                        <div class="thumbnail-loading">
                            <div class="thumbnail-loading-spinner"></div>
                            <p>Generating preview...</p>
                        </div>
                        <img src="${tripData.thumbnailURL || tripData.tripCoverPic}" 
                            alt="${tripData.title}" 
                            class="trip-preview-image"
                            style="width: 100%; border-radius: 8px; display: none;">
                    </div>
                    
                    <button class="copy-link-btn signup-modal-btn">
                        <i class="fas fa-link"></i> Copy Link
                    </button>

                    <a href="mailto:?subject=${emailSubject}&body=${emailBody}" 
                    class="email-invite-btn signup-modal-btn">
                        <i class="fas fa-envelope"></i> Send via Email
                    </a>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.signup-close-btn');
    const copyBtn = modal.querySelector('.copy-link-btn');
    const previewImage = modal.querySelector('.trip-preview-image');
    const loadingDiv = modal.querySelector('.thumbnail-loading');

    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(modalContent.url);
            displaySuccessMessage(`Link Copied:<br>${modalContent.url}`);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    });

    // Handle thumbnail in the background
    try {
        // Ensure thumbnail exists
        const updatedTrip = await ensureTripThumbnail(tripData);
        
        // Update image if we have a thumbnail
        if (updatedTrip.thumbnailURL) {
            const previewImage = modal.querySelector('.trip-preview-image');
            const loadingDiv = modal.querySelector('.thumbnail-loading');
            
            previewImage.src = updatedTrip.thumbnailURL;
            previewImage.onload = () => {
                loadingDiv.style.display = 'none';
                previewImage.style.display = 'block';
            };
        }

        return {
            modal,
            updatedTrip
        };

    } catch (error) {
        console.error('Error loading thumbnail:', error);

        return {
            modal,
            updatedTrip: tripData
        };
    }
}
export function showMobileWarning(tripData = null) {
    // Remove any existing warnings first
    const existingWarnings = document.querySelectorAll('.signup-modal[data-mobile-warning="true"]');
    existingWarnings.forEach(warning => warning.remove());

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    } else {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);
    }

    // Only show on mobile devices
    if (window.innerWidth > 768) {
        return;
    }

    const modalHtml = `
        <div class="signup-modal" data-mobile-warning="true">
            <div class="signup-modal-content">      
                <div class="signup-header-container">
                    <img src="/assets/Butterfly2.png" alt="Cipher" class="signup-butterfly-icon">
                    <div class="signup-modal-header">
                        <h2>Cipher</h2>
                        <p>Travel Memories Shared</p>
                    </div>
                </div>

                ${tripData ? `
                    <div class="trip-thumbnail" style="
                        background-image: url('${tripData.thumbnailURL || tripData.tripCoverPic}');
                        display: block;
                    "></div>
                ` : ''}
                
                <div class="bottom-content">
                    <p>This website is not optimized for mobile viewing. For the best experience, please download our iOS app or visit site on a desktop or laptop.</p>

                    <div class="auth-buttons">
                        <button class="copy-link-btn" onclick="window.location.href='https://apps.apple.com/us/app/cipher-travel-memories-shared/id6503364756'">
                            <i class="fab fa-apple"></i>
                            Download on App Store
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add resize listener
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (window.innerWidth <= 768) {
                showMobileWarning(tripData);
            } else {
                const existingWarnings = document.querySelectorAll('.signup-modal[data-mobile-warning="true"]');
                existingWarnings.forEach(warning => warning.remove());
            }
        }, 250);
    });
}
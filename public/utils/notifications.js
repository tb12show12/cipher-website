/**
 * Displays a success message that automatically disappears
 * @param {string} message - The message to display
 */
export function displaySuccessMessage(message) {
    showNotification(message, 'success');
}

/**
 * Displays an error message that automatically disappears
 * @param {string} message - The message to display
 */
export function displayErrorMessage(message) {
    showNotification(message, 'error');
}


/**
 * Helper function to show notifications
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success' or 'error')
 */
function showNotification(message, type) {
    // Remove any existing messages
    const existingMessage = document.querySelector('.success-message, .error-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageElement = document.createElement('div');
    messageElement.className = type === 'success' ? 'success-message' : 'error-message';
    messageElement.style.zIndex = '10001';
    
    // Use different icons for success and error
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    messageElement.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    
    document.body.appendChild(messageElement);

    // Trigger animation
    setTimeout(() => messageElement.classList.add('show'), 100);

    // Remove after delay
    setTimeout(() => {
        messageElement.classList.remove('show');
        setTimeout(() => messageElement.remove(), 300);
    }, 3000);
}
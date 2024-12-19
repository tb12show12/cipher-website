/**
 * Displays a success message that automatically disappears
 * @param {string} message - The message to display
 */
export function displaySuccessMessage(message) {
    const existingMessage = document.querySelector('.success-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageElement = document.createElement('div');
    messageElement.className = 'success-message';
    messageElement.style.zIndex = '10001';
    messageElement.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(messageElement);

    // Trigger animation
    setTimeout(() => messageElement.classList.add('show'), 100);

    // Remove after delay
    setTimeout(() => {
        messageElement.classList.remove('show');
        setTimeout(() => messageElement.remove(), 300);
    }, 3000);
}
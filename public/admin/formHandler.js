console.log('formHandler.js is loading...');


// Global variables
let cropper = null;
const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';
}

function clearStatus() {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.style.display = 'none';
}

function setLoading(isLoading) {
    const button = document.getElementById('submitButton');
    const buttonText = button.querySelector('.button-text');
    button.disabled = isLoading;
    button.classList.toggle('loading', isLoading);
    buttonText.textContent = isLoading ? 'Creating Trip...' : 'Submit Trip';
}

// Initialize form elements
async function initializeForm() {
    console.log('initializeForm is running...');

    if (!sessionStorage.getItem('isAuthenticated')) {
        window.location.href = '/admin/';
        return;
    }
    
    // Fetch environment variables first
    try {
        const response = await fetch('/.netlify/functions/getEnv');
        if (!response.ok) {
            throw new Error('Failed to load environment variables');
        }
        const data = await response.json();
        window.ANON_USER_ID = data.env.ANON_USER_ID;
    } catch (error) {
        console.error('Error loading environment variables:', error);
        throw error;
    }
    
    initializeDatePickers();
    initializeCharCounter();
    initializeTinyMCE();
    initializeImageUpload();
    initializeFormSubmission();
}

function initializeDatePickers() {
    console.log('Initializing date pickers...');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    
    if (!monthSelect || !yearSelect) {
        console.error('Select elements not found:', { monthSelect, yearSelect });
        return;
    }
    
    console.log('Found select elements');
    
    // Populate months
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = month;
        monthSelect.appendChild(option);
    });

    // Populate years
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 5; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
}

function initializeCharCounter() {
    const shortDesc = document.getElementById('shortDescription');
    const charCounter = document.getElementById('charCounter');
    
    shortDesc.addEventListener('input', function() {
        const remaining = this.value.length;
        charCounter.textContent = `${remaining}/190 characters`;
        
        if (remaining >= 170 && remaining < 190) {
            charCounter.className = 'char-counter near-limit';
        } else if (remaining >= 190) {
            charCounter.className = 'char-counter at-limit';
        } else {
            charCounter.className = 'char-counter';
        }
    });
}

function initializeTinyMCE() {
    tinymce.init({
        selector: '#longDescription',
        height: 300,
        menubar: false,
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | blocks | ' +
            'bold italic forecolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
    });
}

function initializeImageUpload() {
    document.getElementById('coverImage').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Reset previous cropper if exists
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        const imageToEdit = document.getElementById('imageToEdit');
        const instructionsElement = document.querySelector('.cropper-instructions');
        const reader = new FileReader();

        // Set up image load handler
        imageToEdit.onload = function() {
            console.log('Image loaded');
            if (cropper) {
                cropper.destroy();
            }
            
            cropper = new Cropper(imageToEdit, {
                aspectRatio: 16/9,
                viewMode: 2,
                responsive: true,
                background: true,
                zoomable: true,
                dragMode: 'move',
                guides: true,
                center: true,
                highlight: true,
                cropBoxMovable: true,
                cropBoxResizable: true,
                autoCrop: true,
                autoCropArea: 0.8,
                movable: true,
                ready: function() {
                    console.log('Cropper initialized');
                    if (instructionsElement) {
                        instructionsElement.style.display = 'block';
                    }
                }
            });
        };

        // Read the file
        reader.onload = function(event) {
            console.log('File read');
            imageToEdit.src = event.target.result;
        };

        reader.readAsDataURL(file);
    });
}

// Form submission initialization
function initializeFormSubmission() {
    document.getElementById('tripForm').addEventListener('submit', handleFormSubmit);
}

function htmlToPlainText(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Handle lists
    const lists = temp.querySelectorAll('ul, ol');
    lists.forEach(list => {
        const items = list.querySelectorAll('li');
        items.forEach((item, index) => {
            item.textContent = `${index + 1}. ${item.textContent}\n`;
        });
    });

    // Handle paragraphs and breaks
    const paragraphs = temp.querySelectorAll('p, br');
    paragraphs.forEach(p => {
        p.textContent = `${p.textContent}\n\n`;
    });

    // Get text and clean up extra whitespace
    let text = temp.textContent || temp.innerText;
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace triple+ line breaks
    text = text.replace(/\s\s+/g, ' '); // Replace multiple spaces
    return text.trim();
}

// New form submission handler for Firebase
async function handleFormSubmit(e) {
    e.preventDefault();
    setLoading(true);
    clearStatus();

    try {
        showStatus('Preparing form data...', 'info');
        
        // Get form data
        const monthSelect = document.getElementById('monthSelect');
        const yearSelect = document.getElementById('yearSelect');
        const selectedMonth = monthSelect.options[monthSelect.selectedIndex].text;
        const selectedYear = yearSelect.value;

        // Prepare form data
        const formData = {
            // dynamic elements based on user input
            title: document.getElementById('title').value,
            month: selectedMonth,
            year: selectedYear.toString(),
            days: document.getElementById('numDays').value.toString(),
            numPeople: parseInt(document.getElementById('numPeople').value),
            shortDescription: document.getElementById('shortDescription').value,
            longDescriptionHTML: tinymce.get('longDescription').getContent(),
            longDescription: htmlToPlainText(tinymce.get('longDescription').getContent()),
            dateCreated: new Date(), // This should automatically use local timezone
            dateTaken: new Date(Date.UTC(selectedYear, months.indexOf(selectedMonth), 1)),

            // static elements
            attendees: [window.ANON_USER_ID],
            bookmarks: 0,
            commentsHistory: [],
            creatorId: window.ANON_USER_ID,
            creatorName: "Anonymous Butterfly",
            familyType: 0,
            likes: 0,
            photos: [],
            places: [],
            tripId: '', // Will be updated after we get the document ID
        };

        // Get the cropped image and convert to base64
        showStatus('Processing image...', 'info');

        let base64Image = null;
        const coverImageInput = document.getElementById('coverImage');

        if (coverImageInput.files.length > 0 && cropper) {
            try {
                const imageBlob = await new Promise((resolve) => {
                    cropper.getCroppedCanvas({
                        width: 500,
                        imageSmoothingQuality: 'high',
                    }).toBlob(
                        (blob) => resolve(blob),
                        'image/jpeg',
                        0.9
                    );
                });

                base64Image = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(imageBlob);
                });
            } catch (error) {
                console.error('Image processing error:', error);
                // Continue without image if there's an error
            }
        }

        showStatus('Creating trip...', 'info');
        
        // Send to our Netlify function
        const response = await fetch('/.netlify/functions/createTrip', {
            method: 'POST',
            body: JSON.stringify({
                formData,
                imageBase64: base64Image
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create trip');
        }
        
        // Success feedback
        showStatus('Trip created successfully!', 'success');
        
        // Reset form after short delay to show success message
        setTimeout(() => {
            // Reset form
            document.getElementById('tripForm').reset();
            tinymce.get('longDescription').setContent('');
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            document.getElementById('imageToEdit').src = '';
            document.querySelector('.cropper-instructions').style.display = 'none';
            clearStatus();
        }, 2000);
        
    } catch (error) {
        console.error('Error:', error);
        let errorMessage = 'An unexpected error occurred.';
        
        // Handle specific errors
        if (error.code) {
            switch (error.code) {
                case 'storage/unauthorized':
                    errorMessage = 'Error: Unauthorized to upload images.';
                    break;
                case 'storage/canceled':
                    errorMessage = 'Error: Image upload was canceled.';
                    break;
                case 'storage/unknown':
                    errorMessage = 'Error: Unknown error during image upload.';
                    break;
                default:
                    errorMessage = `Error: ${error.message}`;
            }
        } else {
            errorMessage = error.message;
        }
        
        showStatus(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
}

// Single DOMContentLoaded listener at the bottom
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing form...');
    initializeForm();
});

export {
    initializeForm
};
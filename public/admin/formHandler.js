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

async function loadUserData() {
    try {
        console.log('loadUserData is running...');
        const user = firebase.auth().currentUser;
        
        if (!user) {
            console.error('loadUserData: No user signed in');
            return;
        }

        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            const profilePic = document.getElementById('userProfilePic');
            console.log('Profile pic element:', profilePic);

            if (profilePic && userData.pPic) {
                console.log('Setting profile pic src to:', userData.pPic);
                profilePic.src = userData.pPic;
            }

            const welcomeHeader = document.getElementById('welcomeHeader');
            console.log('Welcome header element:', welcomeHeader);

            if (welcomeHeader && userData.displayName) {
                console.log('Setting welcome text to:', `Welcome, ${userData.displayName}`);
                welcomeHeader.textContent = `Welcome, ${userData.displayName}`;
            } else {
                console.log('Either welcomeHeader is null or displayName is missing');
            }

            console.log(`loadUserData: signed in as ${userData.displayName}.`)
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
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
        await loadUserData();
        
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

        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('No user signed in');
        }

        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('User data not found');
        }
        const userData = userDoc.data();

        // Validate places data exists
        if (typeof window.placesAdded === 'undefined') {
            console.warn('Places array not initialized');
            window.placesAdded = [];
        }

        console.log('Current places data:', window.placesAdded);

        
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
            familyType: parseInt(document.getElementById('familyType').value),
            shortDescription: document.getElementById('shortDescription').value,
            longDescriptionHTML: tinymce.get('longDescription').getContent(),
            longDescription: htmlToPlainText(tinymce.get('longDescription').getContent()),
            dateCreated: new Date(), // This should automatically use local timezone
            dateTaken: new Date(Date.UTC(selectedYear, months.indexOf(selectedMonth), 1)),

            // static elements
            attendees: [userData.userId],
            bookmarks: 0,
            commentsHistory: [],
            creatorId: userData.userId,
            creatorName: userData.displayName,
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
        const newTripId = await writeTripToFirebase(formData, base64Image);


        // Process places if they exist
        if (window.placesAdded && window.placesAdded.length > 0) {
            showStatus('Processing places...', 'info');
            try {
                const placeIds = window.placesAdded.map(place => place.place_id);
                console.log('Fetching details for places:', placeIds);
                
                const fullPlacesData = await fetchPlaceDetails(placeIds);
                if (!fullPlacesData || !Array.isArray(fullPlacesData)) {
                    throw new Error('Invalid places data received');
                }
                
                await writePlacesToFirebase(newTripId, fullPlacesData);
            } catch (error) {
                console.error('Error processing places:', error);
                showStatus('Trip created, but there was an error processing places', 'warning');
                return; // Exit early but don't throw error
            }
        }
        
        showStatus('Trip created successfully!', 'success');
        
        // Reset form with timeout
        setTimeout(() => resetForm(), 2000);
        
    } catch (error) {
        console.error('Error:', error);
        handleError(error);
    } finally {
        setLoading(false);
    }
}

async function writeTripToFirebase(tripData, imageFile){

    const tripDoc = await firebase.firestore().collection('trips').add({
        ...tripData,
    });
    
    const tripId = tripDoc.id;

    await firebase.firestore().collection('users').doc(tripData.creatorId).update({
        trips: firebase.firestore.FieldValue.arrayUnion(tripDoc.id)
    });

    const DEFAULT_COVER_PIC = "https://firebasestorage.googleapis.com/v0/b/cipher-4fa1c.appspot.com/o/trips%2Fdefault%2FdefaultTripCoverPic.jpg?alt=media&token=dd4f49c0-08ea-4788-b0d1-d10abdbc7b8a";
    let imageUrl = DEFAULT_COVER_PIC;

    if (imageFile) {
        const storageRef = firebase.storage().ref();
        const imageFileName = `tripCoverPic-${tripId}.jpg`;
        const imagePath = `trips/${tripId}/${imageFileName}`;
        
        // Convert base64 to blob
        const imageBlob = await fetch(imageFile).then(r => r.blob());
        
        // Upload to Firebase Storage
        const uploadTask = await storageRef.child(imagePath).put(imageBlob, {
            contentType: 'image/jpeg'
        });
        
        try {
            imageUrl = await uploadTask.ref.getDownloadURL();
        } catch (error){
            imageUrl = DEFAULT_COVER_PIC;
        }
    }

    await tripDoc.update({
        tripId: tripDoc.id,
        tripCoverPic: imageUrl
    });

    return tripDoc.id;
}

async function fetchPlaceDetails(list){
    if (!list || !Array.isArray(list) || list.length === 0) {
        console.warn('No places to fetch details for');
        return [];
    }

    try {
        console.log('Fetching place details for:', list);
        
        const response = await fetch('/.netlify/functions/googleFetchPlaceDetails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ list })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received place details:', data);

        if (!Array.isArray(data)) {
            throw new Error('Invalid response format from places API');
        }

        return data;
    } catch (error) {
        console.error('Error fetching place details:', error);
        throw new Error(`Failed to fetch place details: ${error.message}`);
    }

}

// Form reset function
function resetForm() {
    // Reset basic form elements
    document.getElementById('tripForm').reset();
    tinymce.get('longDescription').setContent('');
    
    // Reset image cropper
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('imageToEdit').src = '';
    document.querySelector('.cropper-instructions').style.display = 'none';
    
    // Reset places
    window.placesAdded = [];
    const savedPlacesList = document.getElementById('savedPlacesList');
    if (savedPlacesList) {
        savedPlacesList.innerHTML = '';
    }
    
    clearStatus();
}

// Error handler function
function handleError(error) {
    let errorMessage = 'An unexpected error occurred.';
    
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
}

// NEED TO BUILD IN AIRBNB's
async function writePlacesToFirebase(newTripId, placesData) {
    if (!Array.isArray(placesData) || placesData.length === 0) {
        console.warn('No places data to write to Firebase');
        return;
    }

    // Array to hold all promises for concurrent execution
    const promises = placesData.map(async (placeData, index) => {
        if (!placeData || !placeData.gpid || !placeData.title) {
            console.error(`Invalid place data for index ${index}:`, placeData);
            return;
        }

        try {
            // first check if place already exists
            const existingPlaceQuery = await firebase.firestore().collection('places')
                .where('gpid', '==', placeData.gpid)
                .where('title', '==', placeData.title)
                .get();

            let placeDocId;

            if (existingPlaceQuery.empty) {
                // If no existing place found, create a new document and have it reference the trip that just got created
                const placeDoc = await firebase.firestore().collection('places').add({
                    ...placeData,
                    trips: [newTripId]
                });

                // Append new placeId
                await placeDoc.update({
                    placeId: placeDoc.id,
                });

                placeDocId = placeDoc.id;
            } else {
                // If an existing place found, use its ID and update the trips array
                placeDocId = existingPlaceQuery.docs[0].data().placeId;

                // Have the existing place reference the trip that just got created
                await firebase.firestore().collection('places').doc(placeDocId).update({
                    trips: firebase.firestore.FieldValue.arrayUnion(newTripId)
                });
            }

            // Add new place to the trip's places list
            await firebase.firestore().collection('trips').doc(newTripId).update({
                places: firebase.firestore.FieldValue.arrayUnion(placeDocId)
            });

            // Log success for this item
            console.log(`Successfully processed item ${index + 1} with ${existingPlaceQuery.empty ? 'new' : 'existing'} place ID: ${placeDocId}`);
        } catch (error) {
            // Log error for this item
            console.error(`Error processing item ${index + 1}: ${error.message}`);
            throw error; // Rethrow to be caught by Promise.all
        }
    });

    try {
        await Promise.all(promises);
        console.log('All places successfully processed');
    } catch (error) {
        console.error('Error processing places:', error);
        throw new Error('Failed to process one or more places');
    }
}




export {
    initializeForm
};
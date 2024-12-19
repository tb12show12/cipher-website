// Global state
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';
import { PLACE_TYPES, MONTHS } from '/admin/config.js';
import { showInviteModal } from '/components/modals/inviteModal.js';
import { displaySuccessMessage } from '/utils/notifications.js';


// Initialize Algolia client
const searchClient = algoliasearch('WADPYQO9WN', '37148f9e28cd367ebb6c1cfdb4852db6');
const userIndex = searchClient.initIndex('userIndex');

let currentTripId = null;
let cropper = null;
let userTrips = [];
let currentUserDisplayName = null;
let currentUserId = null;

let photosToAdd = [];
let photosToDelete = new Set();

let placesToAdd = [];
let placesToDelete = new Set();
let currentPlaceDisplayList = [];

let isNewRedditTrip = false;

let attendeesToAdd = [];
let attendeesToRemove = new Set();
let currentAttendeesList = [];

// Add these as global variables at the top
let originalCoverUrl = null;
let currentCoverUrl = null;
const DEFAULT_COVER_URL = "https://firebasestorage.googleapis.com/v0/b/cipher-4fa1c.appspot.com/o/trips%2Fdefault%2FdefaultTripCoverPic.jpg?alt=media&token=dd4f49c0-08ea-4788-b0d1-d10abdbc7b8a";

// Initialize Firebase and load user data
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for Firebase auth to be ready
        const user = await window.firebaseAuthReady;
        
        if (user) {
            console.log('User is authenticated:', user.email);
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();
            
            currentUserDisplayName = userDoc.data()?.displayName || 'Anonymous';
            currentUserId = userDoc.data()?.userId;

            const sidebarTitle = document.getElementById('sidebarTitle');
            sidebarTitle.textContent = `Welcome, ${currentUserDisplayName}`;

            await loadUserTrips();
            initializeForm();
            initializePlacesAutocomplete();
            resetForNewTrip();
            setupEventListeners();
            setupCoverImageHandlers();

            const params = new URLSearchParams(window.location.search);
            const tripId = params.get('tripId');
            if (tripId) {
                await loadTripData(tripId);
            }

        } else {
            console.log('No user authenticated, redirecting to login');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// helper function
function isValidRedditUrl(url) {
    try {
        const urlObj = new URL(url);
        // Check if it's a reddit.com domain
        if (!urlObj.hostname.endsWith('reddit.com')) {
            return false;
        }
        // Check if it's a post URL (contains /comments/ or /r/{subreddit}/comments/)
        if (!urlObj.pathname.includes('/comments/')) {
            return false;
        }
        return true;
    } catch (e) {
        // Invalid URL format
        return false;
    }
}

// Load user's trips from Firestore
async function loadUserTrips() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            window.location.href = '/admin/';
            return;
        }

        // Get user's trip IDs
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();

        if (!userDoc.exists) {
            console.log('No user document found');
            return;
        }

        const userData = userDoc.data();
        if (!userData || !userData.trips) {
            console.log('No trips found for user');
            tripsList.innerHTML = '<p class="no-trips">No trips found</p>';
            return;
        }

        userTrips = []; // Reset global trips array

        // Fetch only essential trip data in parallel
        const tripPromises = userData.trips.map(tripId => 
            firebase.firestore()
                .collection('trips')
                .doc(tripId)
                .get()
        );

        const tripDocs = await Promise.all(tripPromises);
        
        const tripsList = document.getElementById('tripsList');
        tripsList.innerHTML = ''; // Clear existing trips

        // Process trips and sort by dateCreated
        tripDocs
            .filter(tripDoc => tripDoc.exists)
            .map(tripDoc => ({ 
                id: tripDoc.id, 
                ...tripDoc.data(),
                isFullyLoaded: false
            }))
            .sort((a, b) => {
                const dateA = a.dateCreated?.toDate() || new Date(0);
                const dateB = b.dateCreated?.toDate() || new Date(0);
                return dateB - dateA;
            })
            .forEach(tripData => {
                userTrips.push(tripData);
                
                const tripElement = document.createElement('div');
                tripElement.className = 'trip-item';
                tripElement.dataset.tripId = tripData.id;
                tripElement.innerHTML = `
                    <div class="trip-item-title">${tripData.title}</div>
                    <div class="trip-item-date">${tripData.month} ${tripData.year}</div>
                `;
                
                tripElement.addEventListener('click', () => loadTripData(tripData.id));
                tripsList.appendChild(tripElement);
            });

    } catch (error) {
        console.error('Error loading trips:', error);
        tripsList.innerHTML = '<div class="error">Error loading trips</div>';
    }
}

async function loadTripData(tripId) {
    try {
         // Show both columns
         document.querySelectorAll('.form-column').forEach(col => {
            col.style.display = 'block';
        });

        // Enable right column
        const additionalInfo = document.getElementById('additionalTripInfo');
        additionalInfo.classList.remove('disabled');
        
        // Show section-specific save buttons
        document.getElementById('saveBasicInfoBtn').style.display = 'block';
        document.getElementById('saveNotesBtn').style.display = 'block';
        document.getElementById('savePhotosBtn').style.display = 'block';
        document.getElementById('saveCoverBtn').style.display = 'block';

        // Hide main save button for existing trips
        document.getElementById('submitButton').style.display = 'none';

        // Hide option headers and show regular trip info
        document.getElementById('optionBSection').style.display = 'none';
        document.getElementById('additionalTripInfo').style.display = 'block';

        // Clear photo states
        photosToDelete.clear();
        photosToAdd = [];

        // Clear places states
        placesToAdd = [];
        placesToDelete.clear();
        currentPlaceDisplayList = [];  // Clear the display list

        // Clear attendees states
        currentAttendeesList = []; // Reset current list
        attendeesToAdd = []; // Reset additions
        attendeesToRemove.clear(); // Reset removals

        // Only clear Reddit places section if this isn't a newly created Reddit trip
        if (!isNewRedditTrip) {
            const redditPlacesSection = document.querySelector('.reddit-places-section');
            if (redditPlacesSection) {
                redditPlacesSection.remove();
            }
        }

        document.querySelector('#submitButton .button-text').textContent = 'Loading...';
        
        // Update UI to show which trip is selected
        document.querySelectorAll('.trip-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.tripId === tripId) {
                item.classList.add('active');
            }
        });

        document.getElementById('createNewTrip').classList.remove('active');

        // Find the trip in our cached array
        let tripData = userTrips.find(trip => trip.id === tripId);
        
        // If we haven't loaded the full data yet, fetch it
        if (!tripData.isFullyLoaded) {
            const fullTripDoc = await firebase.firestore()
                .collection('trips')
                .doc(tripId)
                .get();

            if (fullTripDoc.exists) {
                const fullTripData = fullTripDoc.data();

                // Load place data only for this trip
                const placesData = {};
                if (fullTripData.places?.length > 0) {
                    const placesPromises = fullTripData.places.map(placeId => 
                        firebase.firestore()
                            .collection('places')
                            .doc(placeId)
                            .get()
                    );
                    
                    const placeDocs = await Promise.all(placesPromises);
                    
                    placeDocs.forEach(placeDoc => {
                        if (placeDoc.exists) {
                            placesData[placeDoc.id] = {
                                id: placeDoc.id,
                                ...placeDoc.data()
                            };
                        }
                    });
                }

                const attendeesData = {};

                if (fullTripData.attendees && fullTripData.attendees.length > 0) {
                    // Fetch all attendee user documents in parallel
                    const attendeePromises = fullTripData.attendees.map(attendeeId => 
                        firebase.firestore()
                            .collection('users')
                            .doc(attendeeId)
                            .get()
                    );
        
                    const attendeeDocs = await Promise.all(attendeePromises);
        
                    // Add each attendee to the current list
                    attendeeDocs.forEach(doc => {
                        if (doc.exists) {
                            const userData = doc.data();
                            attendeesData[doc.id] = {
                                userId: doc.id,
                                displayName: userData.displayName,
                                pPic: userData.pPic || '/assets/Butterfly2.png',
                                isCreator: doc.id === tripData.creatorId // Add creator flag here
                            };
                        }
                    });
                }

                
                // Update trip data with full info
                tripData = { 
                    ...fullTripData,
                    id: tripId,
                    attendeesData,
                    placesData,
                    isFullyLoaded: true 
                };
                
                // Update our cached array
                const index = userTrips.findIndex(t => t.id === tripId);
                userTrips[index] = tripData;
            }
        }

        // Initialize display list from existing places
        currentPlaceDisplayList = tripData.places.map(placeId => {
            const placeData = tripData.placesData[placeId];
            return {
                ...placeData,
                isNew: false,
                isMarkedForDeletion: false
            };
        });

        // Initialize display list from existing attendees
        currentAttendeesList = tripData.attendees.map(attendeeId => {
            const attendeeData = tripData.attendeesData[attendeeId];
            return {
                ...attendeeData,
                isNew: false,
                isMarkedForDeletion: false
            };
        });


        currentTripId = tripId;
        
        loadPlacesList();
        renderAttendeesList();

        // Update form fields
        const mainHeader = document.querySelector('.main-header');
        mainHeader.style.display = 'flex';
        mainHeader.innerHTML = `
            <h1 id="mainTitle">${tripData.title}</h1>
            <div class="main-header-actions">
                <button class="refresh-trip-btn">
                    <i class="fas fa-sync-alt"></i> Refresh Trip
                </button>
            </div>
        `;
        setupRefreshButton();

        document.getElementById('title').value = tripData.title || '';
        document.getElementById('monthSelect').value = tripData.month || '';
        document.getElementById('yearSelect').value = parseInt(tripData.year) || '';
        document.getElementById('numDays').value = parseInt(tripData.days) || '';
        document.getElementById('numPeople').value = parseInt(tripData.numPeople) || '';
        document.getElementById('familyType').value = parseInt(tripData.familyType) || 0;
        document.getElementById('shortDescription').value = tripData.shortDescription || '';

        // Update character counters
        const titleLength = tripData.title ? tripData.title.length : 0;
        const descriptionLength = tripData.shortDescription ? tripData.shortDescription.length : 0;
        
        document.getElementById('titleCharCounter').textContent = `${titleLength}/40 characters`;
        document.getElementById('charCounter').textContent = `${descriptionLength}/190 characters`;
        
        // Set TinyMCE content - prefer HTML version if it exists
        const editorContent = tripData.longDescriptionHTML || tripData.longDescription || '';
        tinymce.get('longDescription').setContent(editorContent);

        // Load photos
        loadPhotosGrid(tripData.photos || []);

        // Load Place Comments List
        loadCommentsList(); 

        // Update cover image section
        const imagePreview = document.getElementById('imageToEdit');
        const fileInput = document.getElementById('coverImage');
        const saveBtn = document.getElementById('saveCoverBtn');
        const revertBtn = document.getElementById('revertCoverBtn');
        const resetBtn = document.getElementById('resetCoverBtn');
        
        // Clear any existing file input
        fileInput.value = '';
        
        // Reset cropper if it exists
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        // Hide cropper instructions
        document.querySelector('.cropper-instructions').style.display = 'none';
        
        
        // Update image if exists
        originalCoverUrl = tripData.tripCoverPic || DEFAULT_COVER_URL;
        currentCoverUrl = originalCoverUrl;
        imagePreview.src = currentCoverUrl;

        // Reset buttons
        saveBtn.disabled = true;
        revertBtn.style.display = 'none';
        
        if (originalCoverUrl !== DEFAULT_COVER_URL) {
            resetBtn.style.display = 'block';
        } else {
            resetBtn.style.display = 'none';
        }

        document.querySelector('#submitButton .button-text').textContent = 'Save Changes';

    } catch (error) {
        console.error('Error loading trip data:', error);
        document.querySelector('#submitButton .button-text').textContent = 'Error Loading';
    }
}

function setupRefreshButton() {
    const refreshBtn = document.querySelector('.refresh-trip-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            console.log('=== Refresh Trip Button Clicked ===');
            const tripIndex = userTrips.findIndex(t => t.id === currentTripId);
            if (tripIndex !== -1) {
                userTrips[tripIndex].isFullyLoaded = false;
                await loadTripData(currentTripId);
            }
        });
    }
}

function loadPhotosGrid(photos = []) {
    console.log('Loading photos grid...');
    //console.log('Loading photos grid with photos:', photos);
    //console.log('Current photosToAdd:', photosToAdd);
    const grid = document.querySelector('.image-grid');
    
    grid.innerHTML = ''; // Clear existing content

    // Add the "Add Photos" button
    const addButton = document.createElement('button');
    addButton.className = 'add-photos-button';
    addButton.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
        </svg>
        Add Photos
    `;

    // Add existing photos
    //console.log('Adding existing photos to grid:', photos);
    photos.forEach(photo => {
        //console.log('Creating container for existing photo:', photo);
        const container = createPhotoContainer(photo, false);
        grid.appendChild(container);
    });

    // Add new photos waiting to be saved
    //console.log('Adding new photos to grid:', photosToAdd);
    photosToAdd.forEach(photo => {
        //console.log('Creating container for new photo:', photo);
        const container = createPhotoContainer(photo, true);
        grid.appendChild(container);
    });

    // Add click handler directly to the button
    addButton.addEventListener('click', () => {
        //console.log('Add photos button clicked from loadPhotosGrid');
        document.getElementById('tripImages').click();
    });
    grid.appendChild(addButton);
    
    //console.log('Adding photos button to grid');
    grid.appendChild(addButton);

    updatePhotosSaveButton();
    console.log('Photos grid loaded with total children:', grid.children.length);
}

function createPhotoContainer(photo, isNew = false) {
    //console.log('Creating photo container:', { photo, isNew });
    
    const container = document.createElement('div');
    container.className = 'photo-container';
    
    const img = document.createElement('img');
    img.className = 'image-thumbnail';
    
    // Log the URL being used
    const imageUrl = isNew ? photo.previewUrl : photo.uri;
    //console.log('Setting image source:', { isNew, imageUrl, photo });
    img.src = imageUrl;
    img.alt = 'Trip photo';

    // Add lightbox functionality
    img.addEventListener('click', () => {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = lightbox.querySelector('.lightbox-image');
        lightboxImg.src = imageUrl;
        lightbox.style.display = 'flex';
    });

    // Add error handling for image load
    img.onerror = (e) => {
        console.error('Error loading image:', { 
            src: e.target.src, 
            isNew, 
            originalPhoto: photo 
        });
    };
    
    img.onload = () => {
        /*console.log('Image loaded successfully:', { 
            src: img.src, 
            naturalWidth: img.naturalWidth, 
            naturalHeight: img.naturalHeight 
        });*/
    };

    container.appendChild(img);

    // Add status badge if needed
    if (isNew || photosToDelete.has(imageUrl)) {
        /*console.log('Adding status badge:', { 
            isNew, 
            markedForDeletion: photosToDelete.has(imageUrl) 
        });*/
        
        const status = document.createElement('div');
        status.className = `photo-status ${isNew ? 'status-new' : 'status-delete'}`;
        status.textContent = isNew ? 'To Be Added' : 'Marked for Deletion';
        container.appendChild(status);
    }

    // Add action button
    const actionBtn = document.createElement('button');
    actionBtn.className = 'photo-action-btn';
    
    /*console.log('Adding action button:', { 
        isNew, 
        isMarkedForDeletion: photosToDelete.has(imageUrl) 
    });*/

    if (isNew) {
        actionBtn.classList.add('photo-delete-btn');
        actionBtn.innerHTML = '×';
        actionBtn.onclick = () => {
            //console.log('Removing new photo:', photo);
            photosToAdd = photosToAdd.filter(p => p !== photo);
            // Get current trip's photos
            const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
            const tripPhotos = tripIndex !== -1 ? userTrips[tripIndex].photos || [] : [];
            loadPhotosGrid(tripPhotos);
        };
    } else if (photosToDelete.has(imageUrl)) {
        actionBtn.classList.add('photo-undo-btn');
        actionBtn.innerHTML = '↩';
        actionBtn.onclick = () => {
            //console.log('Undoing photo deletion. Photo:', photo);
            //console.log('photosToDelete before:', new Set(photosToDelete));
            photosToDelete.delete(imageUrl);
            //console.log('photosToDelete after:', new Set(photosToDelete));
            const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
            const tripPhotos = tripIndex !== -1 ? userTrips[tripIndex].photos || [] : [];
            loadPhotosGrid(tripPhotos);
        };
    } else {
        actionBtn.classList.add('photo-delete-btn');
        actionBtn.innerHTML = '×';
        actionBtn.onclick = () => {
            //console.log('Marking photo for deletion. URL:', imageUrl);
            //console.log('Marking Photo object for deletion:', photo);
            //console.log('photosToDelete before:', new Set(photosToDelete));
            if (imageUrl) {
                photosToDelete.add(imageUrl);
                //console.log('photosToDelete after:', new Set(photosToDelete));
                const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
                const tripPhotos = tripIndex !== -1 ? userTrips[tripIndex].photos || [] : [];
                loadPhotosGrid(tripPhotos);
            } else {
                console.error('No URL found for photo:', photo);
            }
        };
    }
    container.appendChild(actionBtn);

    return container;
}

async function savePhotosChanges(button, buttonText, successMessage) {
    try {
        console.log('Starting photo save process...');
        button.disabled = true;
        buttonText.textContent = 'Saving...';

        // Delete marked photos
        for (const photoUrl of photosToDelete) {
            console.log('Deleting photo from storage:', photoUrl);
            const photoRef = firebase.storage().refFromURL(photoUrl);
            await photoRef.delete();
        }

        // Upload new photos
        const uploadedPhotos = [];
        for (const photo of photosToAdd) {
            console.log('Processing photo for upload:', photo);
            const fileName = `image-${Date.now()}-${Math.floor(Math.random() * 10000)}-${Math.floor(Math.random() * 1000)}.jpeg`;
            const photoRef = firebase.storage().ref(`trips/${currentTripId}/${fileName}`);
            
            console.log('Uploading to:', `trips/${currentTripId}/${fileName}`);
            const snapshot = await photoRef.put(photo.file);
            const downloadUrl = await snapshot.ref.getDownloadURL();
            console.log('Upload complete, download URL:', downloadUrl);

            uploadedPhotos.push({
                uri: downloadUrl,
                metadata: 'null'
            });
        }

        // Update trip document
        const tripRef = firebase.firestore().collection('trips').doc(currentTripId);
        const tripDoc = await tripRef.get();
        
        if (tripDoc.exists) {
            const currentPhotos = tripDoc.data().photos || [];
            
            // Remove deleted photos
            const updatedPhotos = currentPhotos.filter(photo => !photosToDelete.has(photo.uri));
            
            // Add new photos
            updatedPhotos.push(...uploadedPhotos);

            console.log('Updating Firestore document...');
            await tripRef.update({
                photos: updatedPhotos
            });
            console.log('Firestore update complete');

            // Update local state
            const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
            if (tripIndex !== -1) {
                userTrips[tripIndex].photos = updatedPhotos;
            }

            // Clear states
            photosToDelete.clear();
            photosToAdd = [];

            // Update UI
            buttonText.style.display = 'none';
            successMessage.style.display = 'flex';
            
            // Reload photos grid
            loadPhotosGrid(updatedPhotos);

            setTimeout(() => {
                buttonText.style.display = 'inline';
                successMessage.style.display = 'none';
                button.disabled = false;
                buttonText.textContent = 'Save Changes to Photos';
            }, 3000);

        } else {
            console.error('Trip document not found');
            throw new Error('Trip document not found');
        }

    } catch (error) {
        console.error('Error saving photos:', error);
        button.disabled = false;
        buttonText.textContent = 'Error Saving';
        setTimeout(() => {
            buttonText.textContent = 'Save Changes to Photos';
        }, 3000);
    }
}

function initializeForm() {
    const familyTypeSelect = document.getElementById('familyType');
    familyTypeSelect.innerHTML = ''; // Clear any existing options
    
    document.getElementById('submitButton').style.display = 'block';

    import('./config.js').then(({ TRIP_TYPES }) => {
        TRIP_TYPES.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            if (type.value === 0) { // Adults Only has value 0
                option.selected = true;
            }
            familyTypeSelect.appendChild(option);
        });
    });

    // Initialize TinyMCE
    tinymce.init({
        selector: '#longDescription',
        height: 800,
        menubar: false,
        plugins: 'lists link',
        toolbar: 'undo redo | formatselect | bold italic | bullist numlist | link',
        content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px }'
    });

    // Initialize month select
    const monthSelect = document.getElementById('monthSelect');
    monthSelect.innerHTML = ''; // Clear existing options
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month;
        monthSelect.appendChild(option);
    });

    // Initialize year select
    const yearSelect = document.getElementById('yearSelect');
    yearSelect.innerHTML = ''; // Clear existing options
    const currentYear = new Date().getFullYear();
    // Show 5 years in the past and 5 years in the future
    for (let year = currentYear - 15; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

function setupEventListeners() {
    // Add handler for Create New Trip button
    const newTripBtn = document.getElementById('createNewTrip');
    if (newTripBtn) {
        newTripBtn.addEventListener('click', () => {
            console.log('Create New Trip clicked');
            
            newTripBtn.classList.add('active');
            resetForNewTrip();
        });

        
    }

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });

    // Character counter for short description
    const shortDescription = document.getElementById('shortDescription');
    const charCounter = document.getElementById('charCounter');
    shortDescription.addEventListener('input', () => {
        const count = shortDescription.value.length;
        charCounter.textContent = `${count}/190 characters`;
    });

    // Add character counter for title
    const titleInput = document.getElementById('title');
    const titleCharCounter = document.getElementById('titleCharCounter');
    
    titleInput.addEventListener('input', function() {
        const currentLength = this.value.length;
        titleCharCounter.textContent = `${currentLength}/40 characters`;
    });

    // Photo file selection
    document.getElementById('tripImages').addEventListener('change', async function(e) {
        //console.log('File input change event triggered with files:', e.target.files);
        const files = Array.from(e.target.files);
        //console.log('Converted FileList to array:', files);
        
        for (const file of files) {
            try {
                console.log('Processing file:', file.name);
                // Create preview URL
                const previewUrl = URL.createObjectURL(file);
                //console.log('Created preview URL:', previewUrl);
                
                // Load image to check dimensions
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        //console.log('Image loaded with dimensions:', img.width, 'x', img.height);
                        resolve();
                    };
                    img.onerror = (error) => {
                        console.error('Error loading image:', error);
                        reject(error);
                    };
                    img.src = previewUrl;
                });
    
                // Resize if needed
                let finalFile = file;
                if (img.width > 500) {
                    //console.log('Image needs resizing from', img.width, 'to 500px width');
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const scale = 500 / img.width;
                    
                    canvas.width = 500;
                    canvas.height = img.height * scale;
                    
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to blob
                    const blob = await new Promise(resolve => {
                        canvas.toBlob(resolve, 'image/jpeg');
                    });
                    
                    finalFile = new File([blob], file.name, { type: 'image/jpeg' });
                    //console.log('Created resized file:', finalFile);
                }
    
                /*console.log('Adding to photosToAdd array:', {
                    file: finalFile,
                    previewUrl: previewUrl
                });*/
                photosToAdd.push({
                    file: finalFile,
                    previewUrl: previewUrl
                });
                //console.log('Current photosToAdd array:', photosToAdd);
            } catch (error) {
                console.error('Error processing image:', error);
            }
        }

        // Get the current photos from the trip data
    const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
    const currentPhotos = tripIndex !== -1 ? userTrips[tripIndex].photos || [] :
        
        console.log('Calling loadPhotosGrid with currentPhotos:', currentPhotos);
        loadPhotosGrid(currentPhotos);
        this.value = ''; // Reset file input
    });

    // Save photos changes
    const savePhotosBtn = document.getElementById('savePhotosBtn');
    savePhotosBtn.addEventListener('click', async () => {
        const button = savePhotosBtn;
        const buttonText = button.querySelector('.button-text');
        const successMessage = button.querySelector('.success-message');
        await savePhotosChanges(button, buttonText, successMessage);
    });
    
    // Add save notes button
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    saveNotesBtn.addEventListener('click', saveNotes);

    // Add save basic info button
    const saveBasicInfoBtn = document.getElementById('saveBasicInfoBtn');
    saveBasicInfoBtn.addEventListener('click', saveBasicInfo);

    // Add event listners to the save updated places/attendees list button
    document.getElementById('savePlacesBtn').addEventListener('click', saveUpdatedPlacesListToFirebase);
    document.getElementById('saveAttendeesBtn').addEventListener('click', saveUpdatedAttendeesListToFirebase);
    
    // Add event listener to the submit button
    document.getElementById('submitButton').addEventListener('click', async (e) => {
        e.preventDefault();
        if (currentTripId === null) {
            // Creating new trip
            await saveNewTrip();
        } else {
            // Editing existing trip (handle this separately)
            // await saveExistingTrip();
        }
    });

    const redditUrlInput = document.getElementById('redditUrl');
    const saveRedditTripBtn = document.getElementById('saveRedditTripBtn');

    redditUrlInput.addEventListener('input', function() {
        const url = this.value.trim();
        if (!url) {
            this.classList.remove('invalid', 'valid');
            saveRedditTripBtn.disabled = true;
            return;
        }

        if (isValidRedditUrl(url)) {
            this.classList.remove('invalid');
            this.classList.add('valid');
            saveRedditTripBtn.disabled = false;
        } else {
            this.classList.remove('valid');
            this.classList.add('invalid');
            saveRedditTripBtn.disabled = true;
        }
    });

    saveRedditTripBtn.addEventListener('click', async function() {
        const url = redditUrlInput.value.trim();
        if (!isValidRedditUrl(url)) {
            showStatus('Please enter a valid Reddit post URL', 'error');
            return;
        }
        handleRedditExtract();
    });

    // Initialize attendees search
    initializeAttendeesSearch();

    // In the setupEventListeners function, add:
    document.addEventListener('DOMContentLoaded', () => {
        // Set create new trip as active by default
        const createNewTripBtn = document.getElementById('createNewTrip');
        createNewTripBtn.classList.add('active');
        
        // When any trip item is clicked, remove active state from create new trip
        document.querySelectorAll('.trip-item').forEach(item => {
            item.addEventListener('click', () => {
                createNewTripBtn.classList.remove('active');
            });
        });
        
        // When create new trip is clicked, add active state back
        createNewTripBtn.addEventListener('click', () => {
            document.querySelectorAll('.trip-item').forEach(item => {
                item.classList.remove('active');
            });
            createNewTripBtn.classList.add('active');
        });
    });
} 

async function saveNotes() {
    if (!currentTripId) {
        console.error('No trip selected');
        return;
    }

    const button = document.getElementById('saveNotesBtn');
    const buttonText = button.querySelector('.button-text');
    const successMessage = button.querySelector('.success-message');
    
    try {
        button.disabled = true;
        buttonText.textContent = 'Saving...';
        
        // Get HTML content from TinyMCE
        const htmlContent = tinymce.get('longDescription').getContent();
        
        // Convert HTML to plain text with smart formatting
        const plainText = convertHtmlToSmartText(htmlContent);
        
        // Update Firestore
        await firebase.firestore()
            .collection('trips')
            .doc(currentTripId)
            .update({
                longDescriptionHTML: htmlContent,
                longDescription: plainText,
            });

        // Show success message
        buttonText.style.display = 'none';
        successMessage.style.display = 'flex';
        
        // Reset button after 3 seconds
        setTimeout(() => {
            buttonText.style.display = 'inline';
            successMessage.style.display = 'none';
            button.disabled = false;
            buttonText.textContent = 'Save Notes';
        }, 3000);

    } catch (error) {
        console.error('Error saving notes:', error);
        button.disabled = false;
        buttonText.textContent = 'Error Saving';
        
        // Reset button after 3 seconds
        setTimeout(() => {
            buttonText.textContent = 'Save Notes';
        }, 3000);
    }
}

function convertHtmlToSmartText(html) {
    // Create a temporary div to handle HTML content
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Process the content
    let text = '';
    const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Handle different elements
            switch (node.nodeName.toLowerCase()) {
                case 'p':
                    if (text && !text.endsWith('\n\n')) {
                        text += '\n\n';
                    }
                    break;
                case 'br':
                    text += '\n';
                    break;
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    if (text && !text.endsWith('\n\n')) {
                        text += '\n\n';
                    }
                    break;
                case 'ul':
                case 'ol':
                    if (text && !text.endsWith('\n\n')) {
                        text += '\n\n';
                    }
                    break;
                case 'li':
                    text += '• ';
                    break;
            }
            
            // Process child nodes
            node.childNodes.forEach(processNode);
            
            // Add appropriate spacing after elements
            switch (node.nodeName.toLowerCase()) {
                case 'li':
                    text += '\n';
                    break;
                case 'ul':
                case 'ol':
                    text += '\n';
                    break;
            }
        }
    };
    
    processNode(temp);
    
    // Clean up extra whitespace while preserving intentional line breaks
    return text
        .replace(/\n\n\n+/g, '\n\n')  // Replace 3+ line breaks with 2
        .replace(/[ \t]+/g, ' ')       // Replace multiple spaces/tabs with single space
        .trim();                       // Remove leading/trailing whitespace
}

function capitalizeWords(str) {
    // Split the string into segments based on parentheses
    return str.split(/(\([^)]+\))/).map(segment => {
        // If this is a parenthetical segment, handle it separately
        if (segment.startsWith('(') && segment.endsWith(')')) {
            // Remove parentheses, capitalize words, add parentheses back
            const inner = segment.slice(1, -1).split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            return `(${inner})`;
        }
        // Otherwise handle normally
        return segment.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }).join('');
}

async function saveBasicInfo() {
    if (!currentTripId) {
        console.error('No trip selected');
        return;
    }

    const titleInput = document.getElementById('title');
    const capitalizedTitle = capitalizeWords(titleInput.value);
    
    // Update the input field immediately to show capitalized version
    titleInput.value = capitalizedTitle;

    const button = document.getElementById('saveBasicInfoBtn');
    const buttonText = button.querySelector('.button-text');
    const successMessage = button.querySelector('.success-message');
    
    try {
        button.disabled = true;
        buttonText.textContent = 'Saving...';
        
        // Gather all the basic info values
        const basicInfo = {
            title: capitalizedTitle,
            month: document.getElementById('monthSelect').value,
            year: document.getElementById('yearSelect').value.toString(),
            days: document.getElementById('numDays').value.toString(),
            numPeople: document.getElementById('numPeople').value.toString(),
            familyType: parseInt(document.getElementById('familyType').value),
            shortDescription: document.getElementById('shortDescription').value,
            dateTaken: new Date(
                parseInt(document.getElementById('yearSelect').value),
                MONTHS.indexOf(document.getElementById('monthSelect').value),
                1
            )
        };

        // Update main title display
        document.getElementById('mainTitle').textContent = basicInfo.title;

        // Update Firestore
        await firebase.firestore()
            .collection('trips')
            .doc(currentTripId)
            .update(basicInfo);

        // Update local cache
        const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
        if (tripIndex !== -1) {
            userTrips[tripIndex] = {
                ...userTrips[tripIndex],
                ...basicInfo
            };
        }

        // Show success message
        buttonText.style.display = 'none';
        successMessage.style.display = 'flex';
        
        // Reset button after 3 seconds
        setTimeout(() => {
            buttonText.style.display = 'inline';
            successMessage.style.display = 'none';
            button.disabled = false;
            buttonText.textContent = 'Save Basic Info';
        }, 3000);

    } catch (error) {
        console.error('Error saving basic info:', error);
        button.disabled = false;
        buttonText.textContent = 'Error Saving';
        
        // Reset button after 3 seconds
        setTimeout(() => {
            buttonText.textContent = 'Save Basic Info';
        }, 3000);
    }
}

function setupCoverImageHandlers() {
    const coverInput = document.getElementById('coverImage');
    const revertBtn = document.getElementById('revertCoverBtn');
    const resetBtn = document.getElementById('resetCoverBtn');
    const saveBtn = document.getElementById('saveCoverBtn');
    const imagePreview = document.getElementById('imageToEdit');

    // File input change handler
    coverInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                initializeCropper(imagePreview);
                saveBtn.disabled = false;
                
                // Show appropriate button based on whether we're creating or editing
                if (currentTripId === null) {
                    // New trip - show Reset to Default
                    resetBtn.style.display = 'block';
                    revertBtn.style.display = 'none';
                } else {
                    // Editing existing trip - show Revert to Original
                    revertBtn.style.display = 'block';
                    resetBtn.style.display = 'none';
                }
                
                document.querySelector('.cropper-instructions').style.display = 'block';
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Revert button handler
    revertBtn.addEventListener('click', (e) => {
        // Prevent form submission/reset
        e.preventDefault();
        e.stopPropagation();
        
        const imagePreview = document.getElementById('imageToEdit');
        const fileInput = document.getElementById('coverImage');

        // Reset the file input
        fileInput.value = '';

        imagePreview.src = originalCoverUrl;
        currentCoverUrl = originalCoverUrl;
        
        // Disable save button since we're back to original
        document.getElementById('saveCoverBtn').disabled = true;

        // Re-enable reset button
        resetBtn.style.display = 'block';
        resetBtn.disabled = false;
        
        
        // Hide revert button since we're back to original
        revertBtn.style.display = 'none';
        
        // Destroy cropper if it exists
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });

    // Reset button handler
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const imagePreview = document.getElementById('imageToEdit');
        const fileInput = document.getElementById('coverImage');
        const saveBtn = document.getElementById('saveCoverBtn');
        
        // Clear any file input
        fileInput.value = '';
        
        // Show default image
        imagePreview.src = DEFAULT_COVER_URL;
        currentCoverUrl = DEFAULT_COVER_URL;
        
        if (currentTripId === null) {
            // Creating new trip
            saveBtn.disabled = true;
            resetBtn.style.display = 'none';
        } else {
            // Editing existing trip
            saveBtn.disabled = false; // Enable save since we're making a change
            resetBtn.style.display = 'none';
            revertBtn.style.display = 'block';
        }
        
        // Hide cropper instructions
        document.querySelector('.cropper-instructions').style.display = 'none';
        
        // Destroy cropper if it exists
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });

    // Save button handler
    saveBtn.addEventListener('click', async () => {
        if (!currentTripId) return;
        console.log('Starting cover image save process...');

        const button = saveBtn;
        const buttonText = button.querySelector('.button-text');
        const successMessage = button.querySelector('.success-message');

        try {
            button.disabled = true;
            buttonText.textContent = 'Saving...';

            // Check if we're using the cropper (meaning we have a new image to save)
            if (cropper) {
                console.log('Processing new image upload...');
                
                // Get cropped canvas and resize
                console.log('Creating cropped and resized canvas...');
                const canvas = cropper.getCroppedCanvas({
                    width: 500,
                    height: Math.floor(500 / (16/9)),
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high',
                });

                // Convert to blob with compression
                console.log('Converting to compressed blob...');
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', 0.85);
                });

                // Generate random 3-digit number for filename
                const randomNum = Math.floor(Math.random() * 900) + 100;
                const filename = `tripCoverPic-${randomNum}`;
                console.log('Generated filename:', filename);

                // Delete existing cover photo if exists
                const storageRef = firebase.storage().ref(`trips/${currentTripId}`);
                try {
                    console.log('Checking for existing cover pics...');
                    const files = await storageRef.listAll();
                    const coverPics = files.items.filter(item => item.name.startsWith('tripCoverPic-'));
                    console.log('Found existing cover pics:', coverPics.map(pic => pic.name));
                    
                    if (coverPics.length > 0) {
                        console.log('Deleting existing cover pics...');
                        await Promise.all(coverPics.map(pic => pic.delete()));
                    }
                } catch (error) {
                    console.error('Error deleting existing cover:', error);
                }

                // Upload new image
                console.log('Uploading new image...');
                const imageRef = storageRef.child(`${filename}.jpg`);
                const snapshot = await imageRef.put(blob);
                const downloadURL = await snapshot.ref.getDownloadURL();
                console.log('New image uploaded successfully:', downloadURL);

                // Update Firestore
                console.log('Updating Firestore with new image URL...');
                await firebase.firestore()
                    .collection('trips')
                    .doc(currentTripId)
                    .update({
                        tripCoverPic: downloadURL
                    });

                // Update local cache
                const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
                if (tripIndex !== -1) {
                    userTrips[tripIndex].tripCoverPic = downloadURL;
                }

                // Update URLs
                originalCoverUrl = downloadURL;
                currentCoverUrl = downloadURL;

                // Clean up cropper and update image display
                cropper.destroy();
                cropper = null;

                const imagePreview = document.getElementById('imageToEdit');
                imagePreview.src = downloadURL;

            } else if (currentCoverUrl === DEFAULT_COVER_URL) {
                console.log('Setting to default image...');
                
                // Delete existing cover photo if it exists
                const storageRef = firebase.storage().ref(`trips/${currentTripId}`);
                try {
                    const files = await storageRef.listAll();
                    const coverPics = files.items.filter(item => item.name.startsWith('tripCoverPic-'));
                    console.log('Found existing cover pics:', coverPics.map(pic => pic.name));
                    
                    if (coverPics.length > 0) {
                        console.log('Deleting existing cover pics...');
                        await Promise.all(coverPics.map(pic => pic.delete()));
                    }
                } catch (error) {
                    console.error('Error deleting existing cover:', error);
                }

                console.log('Updating Firestore with default URL...');
                await firebase.firestore()
                    .collection('trips')
                    .doc(currentTripId)
                    .update({
                        tripCoverPic: DEFAULT_COVER_URL
                    });
                
                // Update local cache
                const tripIndex = userTrips.findIndex(trip => trip.id === currentTripId);
                if (tripIndex !== -1) {
                    userTrips[tripIndex].tripCoverPic = DEFAULT_COVER_URL;
                }
                
                // Update URLs
                originalCoverUrl = DEFAULT_COVER_URL;
                currentCoverUrl = DEFAULT_COVER_URL;
            }

            // Update UI state
            console.log('Updating UI state...');
            buttonText.style.display = 'none';
            successMessage.style.display = 'flex';
            document.getElementById('revertCoverBtn').style.display = 'none';
            document.getElementById('resetCoverBtn').disabled = false;  // Re-enable reset button

            // Clear file input
            document.getElementById('coverImage').value = '';

            // Hide cropper instructions
            document.querySelector('.cropper-instructions').style.display = 'none';

            console.log('Save process completed successfully!');

            setTimeout(() => {
                buttonText.style.display = 'inline';
                successMessage.style.display = 'none';
                button.disabled = false;
                buttonText.textContent = 'Save Cover Image';
            }, 3000);

        } catch (error) {
            console.error('Error in save process:', error);
            button.disabled = false;
            buttonText.textContent = 'Error Saving';
            setTimeout(() => {
                buttonText.textContent = 'Save Cover Image';
            }, 3000);
        }
    });
}

function initializeCropper(image) {
    // Destroy existing cropper if it exists
    if (cropper) {
        cropper.destroy();
    }

    // Initialize new cropper
    cropper = new Cropper(image, {
        aspectRatio: 16 / 9,
        viewMode: 2,
        autoCropArea: 1,
        responsive: true,
        restore: false,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready() {
            // Show instructions when cropper is ready
            document.querySelector('.cropper-instructions').style.display = 'block';
        }
    });

    // Enable save button since we have a new image
    document.getElementById('saveCoverBtn').disabled = false;
    document.getElementById('revertCoverBtn').style.display = 'block';
}

function updatePhotosSaveButton() {
    const savePhotosBtn = document.getElementById('savePhotosBtn');
    savePhotosBtn.disabled = photosToAdd.length === 0 && photosToDelete.size === 0;
}

function resetForNewTrip() {
    console.log('Resetting form for new trip');
    
    // Clear current trip ID
    currentTripId = null;

    // Update header without refresh button
    const mainHeader = document.querySelector('.main-header');
    mainHeader.style.display = 'none';

    const saveBasicInfoBtn = document.getElementById('saveBasicInfoBtn');
    saveBasicInfoBtn.style.display = 'none';

    // Show only left column, hide right column
    document.querySelectorAll('.form-column').forEach((col, index) => {
        if (index === 0) {
            col.style.display = 'block';  // Show left column
        } else {
            col.style.display = 'block';   // Hide right column
        }
    });

    // Update main save button text and show it
    const submitButton = document.getElementById('submitButton');
    const submitButtonText = submitButton.querySelector('.button-text');
    submitButton.style.display = 'block';
    submitButtonText.textContent = 'Save New Trip';


     // Show option headers and hide regular trip info
     document.getElementById('optionBSection').style.display = 'block';
     //document.getElementById('additionalTripInfo').style.display = 'none';
     
     // Clear form fields
     document.getElementById('tripForm').reset();
     document.getElementById('redditUrl').value = '';
    
    // Reset photo states
    photosToDelete.clear();
    photosToAdd = [];
    
    // Set default values
    const now = new Date();
    document.getElementById('monthSelect').value = now.toLocaleString('default', { month: 'long' });
    document.getElementById('yearSelect').value = now.getFullYear().toString();
    document.getElementById('familyType').value = 0; // Adults only
    
    // Clear other fields
    document.getElementById('title').value = '';
    document.getElementById('numDays').value = '';
    document.getElementById('numPeople').value = '';
    document.getElementById('shortDescription').value = '';
    document.getElementById('titleCharCounter').textContent = '0/40 characters';
    document.getElementById('charCounter').textContent = '0/190 characters';
    tinymce.get('longDescription').setContent('');
    
    // Reset cover image to default
    const imagePreview = document.getElementById('imageToEdit');
    const resetBtn = document.getElementById('resetCoverBtn');
    const revertBtn = document.getElementById('revertCoverBtn');
    const saveBtn = document.getElementById('saveCoverBtn');
    
    resetBtn.style.display = 'none';

    imagePreview.src = DEFAULT_COVER_URL;
    originalCoverUrl = DEFAULT_COVER_URL;
    currentCoverUrl = DEFAULT_COVER_URL;
    
    // Clear file input
    document.getElementById('coverImage').value = '';
    
    // Destroy cropper if it exists
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    
    // Hide cropper instructions
    document.querySelector('.cropper-instructions').style.display = 'none';
    
    // Show only the main save button
    document.getElementById('submitButton').style.display = 'block';
    document.getElementById('saveCoverBtn').style.display = 'none';
    document.getElementById('savePhotosBtn').style.display = 'none';
    document.getElementById('saveBasicInfoBtn').style.display = 'none';
    document.getElementById('saveNotesBtn').style.display = 'none';
    
    // Disable right column
    const additionalInfo = document.getElementById('additionalTripInfo');
    additionalInfo.classList.add('disabled');
    
    // Clear photos grid
    loadPhotosGrid([]);
    
    // Clear places list
    const placesList = document.getElementById('placesList');
    if (placesList) placesList.innerHTML = '';

    const redditPlacesSection = document.querySelector('.reddit-places-section');
    if (redditPlacesSection) {
        redditPlacesSection.remove();
    }
    
    // Remove active state from any selected trip in the list
    document.querySelectorAll('.trip-item').forEach(item => {
        item.classList.remove('active');
    });

    // Reset to Trip Notes tab
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Set Notes tab as active
    document.querySelector('.tab[data-tab="notes"]').classList.add('active');
    document.getElementById('notesTab').classList.add('active');

    // Clear Reddit URL input
    document.getElementById('redditUrl').value = '';
    
    console.log('Form reset complete');
}

async function saveNewTrip() {
    const submitButton = document.getElementById('submitButton');
    const buttonText = submitButton.querySelector('.button-text');
    
    try {
        // Disable button and show loading state
        submitButton.disabled = true;
        buttonText.textContent = 'Saving...';

        // Get current user
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('No authenticated user found');
        }

        // Get user's display name from their document
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();
        
        const creatorName = userDoc.exists ? userDoc.data().displayName || 'NoName' : 'No Name';

        // Collect form data
        const tripData = {
            title: capitalizeWords(document.getElementById('title').value),
            month: document.getElementById('monthSelect').value,
            year: document.getElementById('yearSelect').value.toString(),
            days: document.getElementById('numDays').value.toString(),
            numPeople: document.getElementById('numPeople').value.toString(),
            familyType: parseInt(document.getElementById('familyType').value, 10),  // Parse as integer
            shortDescription: document.getElementById('shortDescription').value || "",
            dateCreated: firebase.firestore.FieldValue.serverTimestamp(),
            dateTaken: new Date(
                parseInt(document.getElementById('yearSelect').value),
                MONTHS.indexOf(document.getElementById('monthSelect').value),
                1
            ),
            creatorId: user.uid,
            creatorName: creatorName,
            tripCoverPic: DEFAULT_COVER_URL,
            attendees: [userDoc.data().userId],
            
            //static elements
            bookmarks:0,
            commentsHistory: [],
            likes: 0,
            longDescription: "",
            longDescriptionHTML: "",
            photos: [],
            places: [],
            tripId: "",
        };

        // Get location coordinates from OpenAI before creating the trip
        try {
            const locationResponse = await fetch('/.netlify/functions/guessLocation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tripTitle: tripData.title,
                    tripShortDescription: tripData.shortDescription
                })
            });

            const locationData = await locationResponse.json();
            
            if (locationData.result) {
                tripData.coordinates = {
                    latitude: Number(locationData.lat),
                    longitude: Number(locationData.long)
                };
                console.log(`Location coordinates set:`, tripData.coordinates);
            } else {
                console.warn('Could not determine trip location coordinates');
            }
        } catch (locationError) {
            console.error('Error getting location coordinates:', locationError);
            // Continue with trip creation even if location guess fails
        }

        // Update the input field to show capitalized version
        document.getElementById('title').value = tripData.title;

        // Validate required fields
        const requiredFields = ['title', 'month', 'year'];
        const missingFields = requiredFields.filter(field => !tripData[field]);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Create new trip document
        const tripRef = await firebase.firestore()
            .collection('trips')
            .add(tripData);

        // Update the trip with its own ID
        await tripRef.update({
            tripId: tripRef.id,
        });

        // If we have a custom cover image (not default), upload it
        if (cropper) {
            try {
                const canvas = cropper.getCroppedCanvas({
                    width: 500,
                    height: Math.floor(500 / (16/9)),
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high',
                });

                // Add some debug logging
                console.log('Current cover URL:', currentCoverUrl);
                console.log('Cropper exists:', !!cropper);
                console.log('Canvas created:', !!canvas);

                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', 0.85);
                });

                // Generate random 3-digit number for filename
                const randomNum = Math.floor(Math.random() * 900) + 100;
                const filename = `tripCoverPic-${randomNum}`;

                // Upload cover image
                const storageRef = firebase.storage().ref(`trips/${tripRef.id}/${filename}.jpg`);
                const uploadTask = await storageRef.put(blob);
                const downloadURL = await uploadTask.ref.getDownloadURL();

                // Update trip with cover image URL
                await tripRef.update({
                    tripCoverPic: downloadURL
                });
            } catch (imageError) {
                console.error('Error uploading cover image:', imageError);
                await tripRef.update({
                    tripCoverPic: DEFAULT_COVER_URL
                });
                console.warn('Failed to upload custom cover image, using default instead');
            }
        }

        // Add trip ID to user's trips array
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .update({
                trips: firebase.firestore.FieldValue.arrayUnion(tripRef.id)
            });

        // Show success state
        buttonText.textContent = 'Trip Saved!';
        
        // Reload trips list and select the new trip
        await loadUserTrips();
        await loadTripData(tripRef.id);

        setTimeout(() => {
            buttonText.textContent = 'Save Changes';
            submitButton.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error saving new trip:', error);
        buttonText.textContent = 'Error Saving';
        submitButton.disabled = false;
        setTimeout(() => {
            buttonText.textContent = 'Save New Trip';
        }, 2000);
    }
}

async function loadPlacesList() {
    
    const placesTab = document.getElementById('placesTab');
    const placesList = placesTab.querySelector('.places-list') || placesTab.appendChild(document.createElement('div'));
    placesList.className = 'places-list';
    
    // Capture values from current DOM before clearing it
    const existingList = placesList.querySelectorAll('.place-item');
    existingList.forEach(item => {
        const placeId = item.dataset.placeId;
        const commentaryInput = item.querySelector('.commentary-input');
        if (commentaryInput) {
            const index = currentPlaceDisplayList.findIndex(p => 
                p.isNew ? `new-${p.placeId}` === placeId : p.id === placeId
            );
            if (index !== -1) {
                currentPlaceDisplayList[index].commentary = commentaryInput.value;
            }
        }
    });
    
    // Now clear the list and rebuild it
    placesList.innerHTML = '';
    
    currentPlaceDisplayList.forEach(place => {
        const placeElement = document.createElement('div');
        
        // Add drag and drop attributes
        placeElement.draggable = true;
        placeElement.dataset.placeId = place.isNew ? `new-${place.placeId}` : place.id;

        if (place.isNew) {
            // Render new place
            placeElement.className = 'place-item to-be-added';
            placeElement.innerHTML = `
                <div class="place-main-content">
                    <div class="drag-handle">⋮⋮</div>    
                    <div class="place-icon">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div class="place-info">
                        <h3>${place.name}</h3>
                        <span class="place-type">New Place</span>&nbsp;&nbsp;<span class="addition-tag">To Be Added</span>
                    </div>
                    
                    <button class="action-btn delete-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                 ${place.commentary ? `
                    <div class="place-commentary">
                        <textarea class="commentary-input" placeholder="(Optional) Add a comment...">${place.commentary}</textarea>
                    </div>
                ` : `
                    <div class="place-commentary">    
                        <div class="comment-actions">
                            <a href="#" class="add-comment-btn">
                                <i class="fas fa-plus"></i> Add a comment
                            </a>
                            <div class="new-comment-section" style="display: none;">
                                <textarea class="commentary-input" placeholder="Type your comment here..."></textarea>
                                <div class="comment-buttons">
                                    <a href="#" class="cancel-comment-btn">
                                        <i class="fas fa-times"></i> Cancel
                                    </a>
                                    <a href="#" class="save-comment-btn">
                                        <i class="fas fa-check"></i> Save
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                `}
            `;
            
             // Add event listeners for comment actions if no initial commentary
             if (!place.commentary) {
                const addCommentBtn = placeElement.querySelector('.add-comment-btn');
                const newCommentSection = placeElement.querySelector('.new-comment-section');
                const cancelCommentBtn = placeElement.querySelector('.cancel-comment-btn');
                const saveCommentBtn = placeElement.querySelector('.save-comment-btn');
                const commentaryInput = placeElement.querySelector('.commentary-input');

                addCommentBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    newCommentSection.style.display = 'block';
                    addCommentBtn.style.display = 'none';
                    commentaryInput.focus();
                });

                cancelCommentBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    newCommentSection.style.display = 'none';
                    addCommentBtn.style.display = 'block';
                    commentaryInput.value = '';
                });

                saveCommentBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const comment = commentaryInput.value.trim();
                    if (comment) {
                        const index = currentPlaceDisplayList.findIndex(p => 
                            p.isNew && p.placeId === place.placeId
                        );
                        if (index !== -1) {
                            currentPlaceDisplayList[index].commentary = comment;
                            loadPlacesList();
                        }
                    }
                });
            }

            if (place.commentary){
                console.log(`New Place: Name ${place.title} and Feedback ${JSON.stringify(place.commentary, null, 2)}`);
            }

            // Listens for changes to the commentary input and saves it to prevent it from getting lost on changes:
            const commentaryInput = placeElement.querySelector('.commentary-input');
            commentaryInput.addEventListener('input', () => {
                const index = currentPlaceDisplayList.findIndex(p => 
                    p.isNew ? `new-${p.placeId}` === placeElement.dataset.placeId : p.id === placeElement.dataset.placeId
                );
                if (index !== -1) {
                    currentPlaceDisplayList[index].commentary = commentaryInput.value;
                }
            });
            
        } else {
            // Render existing place
            const placeType = PLACE_TYPES.find(type => type.value === place.type);
            const finalPlaceType = placeType || { 
                label: place.type, 
                icon: 'fa-solid fa-location-dot' 
            };
        
            placeElement.className = `place-item${place.isMarkedForDeletion ? ' marked-for-deletion' : ''}`;
            
            const buttonIcon = place.isMarkedForDeletion ? 
                '<i class="fas fa-rotate-left"></i>' : 
                '<i class="fas fa-trash"></i>';
            const buttonClass = place.isMarkedForDeletion ? 
                'action-btn revert-btn' : 
                'action-btn delete-btn';
        
            placeElement.innerHTML = `
                <div class="place-main-content">
                    <div class="drag-handle">⋮⋮</div>    
                    <div class="place-icon">
                        <i class="${finalPlaceType.icon}"></i>
                    </div>
                    <div class="place-info">
                        <h3>${place.title}</h3>
                        <span class="place-type">${finalPlaceType.label}</span>
                        ${place.isMarkedForDeletion ? '<span class="deletion-tag">Marked for Deletion</span>' : ''}
                    </div>
                    <button class="${buttonClass}" data-placeid="${place.id}">
                        ${buttonIcon}
                    </button>
                </div>
                <div class="place-commentary">
                    <div class="existing-comments">
                        ${place.comments ? place.comments
                            .filter(comment => comment.tripId === currentTripId)
                            .map(comment => `
                                <div class="comment-card">
                                    <div class="comment-header">
                                        <span class="comment-author">${comment.userDisplayName}</span>
                                        <span class="comment-date">${comment.date}</span>
                                    </div>
                                    <div class="comment-body">
                                        ${comment.msg}
                                    </div>
                                </div>
                            `).join('') : ''}
                    </div>
                    <div class="comment-actions">
                        <a href="#" class="add-comment-btn">
                            <i class="fas fa-plus"></i> Add a comment
                        </a>
                        <div class="new-comment-section" style="display: none;">
                            <textarea id="newCommentInput" class="new-comment-input" placeholder="Type your comment here..."></textarea>
                            <div class="comment-buttons">
                                <a href="#" class="cancel-comment-btn">
                                    <i class="fas fa-times"></i> Cancel
                                </a>
                                <a href="#" class="save-comment-btn">
                                    <i class="fas fa-check"></i> Save
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            if (place.commentary){
                console.log(`Existing Place: Name ${place.title} and Feedback ${JSON.stringify(place, null, 2)}`);
            }
        }

        // Add appropriate click handler
        const actionBtn = placeElement.querySelector('.action-btn');
        if (place.isNew) {
            actionBtn.addEventListener('click', () => {
                // Should be comparing placeIds
                placesToAdd = placesToAdd.filter(p => p.placeId !== place.placeId);

                // Remove from currentPlaceDisplayList
                currentPlaceDisplayList = currentPlaceDisplayList.filter(p => 
                    !(p.isNew && p.placeId === place.placeId)
                );

                loadPlacesList();
                updateSavePlacesButton();
            });
        } else {
            actionBtn.addEventListener('click', () => {
                if (place.isMarkedForDeletion) {
                    placesToDelete.delete(place.id);

                    // Update display list
                    const index = currentPlaceDisplayList.findIndex(p => p.id === place.id);
                    if (index !== -1) {
                        currentPlaceDisplayList[index] = {
                            ...currentPlaceDisplayList[index],
                            isMarkedForDeletion: false
                        };
                    }

                } else {
                    placesToDelete.add(place.id);

                    // Update display list
                    const index = currentPlaceDisplayList.findIndex(p => p.id === place.id);
                    if (index !== -1) {
                        currentPlaceDisplayList[index] = {
                            ...currentPlaceDisplayList[index],
                            isMarkedForDeletion: true
                        };
                    }
                }
                loadPlacesList();
                updateSavePlacesButton();
            });
        }

        // Only add comment functionality for existing places
        if (!place.isNew){
            const addCommentBtn = placeElement.querySelector('.add-comment-btn');
            const saveCommentBtn = placeElement.querySelector('.save-comment-btn');
            const cancelCommentBtn = placeElement.querySelector('.cancel-comment-btn');
            const newCommentSection = placeElement.querySelector('.new-comment-section');
            
            const newCommentInput = placeElement.querySelector('.new-comment-input');
    
            addCommentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                newCommentSection.style.display = 'block';
                addCommentBtn.style.display = 'none';
                newCommentInput.focus();
            });

            cancelCommentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                newCommentSection.style.display = 'none';
                addCommentBtn.style.display = 'block';
                newCommentInput.value = '';
            });
    
            saveCommentBtn.addEventListener('click', async () => {
                const comment = newCommentInput.value.trim();
                if (!comment) return;
            
                try {
                    // Get the place-item container and its ID
                    const placeItem = saveCommentBtn.closest('.place-item');
                    const placeId = placeItem.getAttribute('data-place-id');
                    
                    // Handle new places (they have 'new-' prefix)
                    const actualPlaceId = placeId.startsWith('new-') ? 
                        placeId.replace('new-', '') : 
                        placeId;
    
                    // Get trip data from userTrips array
                    const tripData = userTrips.find(t => t.id === currentTripId);
                    if (!tripData) {
                        throw new Error('Trip data not found');
                    }
    
                    const now = new Date();
                    const formattedDate = now.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true 
                    }).replace(',', ' at');
            
                    const commentData = {
                        date: formattedDate,
                        msg: comment,
                        tripId: currentTripId,
                        tripTitle: tripData.title,
                        userDisplayName: currentUserDisplayName,
                        userId: currentUserId
                    };
            
                    // Get the place document
                    const placeRef = firebase.firestore().collection('places').doc(actualPlaceId);
                    
                    // Update Firebase
                    await placeRef.update({
                        comments: firebase.firestore.FieldValue.arrayUnion(commentData)
                    });
            
                    // Update local cache
                    const tripIndex = userTrips.findIndex(t => t.id === currentTripId);
                    if (tripIndex !== -1) {
                        const placeData = userTrips[tripIndex].placesData[place.id];
                        if (placeData) {
                            placeData.comments = placeData.comments || [];
                            placeData.comments.push(commentData);
                        }
                    }
            
                    // Clear input and hide
                    newCommentInput.value = '';
                    newCommentSection.style.display = 'none';
                    addCommentBtn.style.display = 'block';
            
                    // Refresh the places list to show new comment
                    loadPlacesList();
            
                } catch (error) {
                    console.error('Error saving comment:', error);
                    alert('Failed to save comment');
                }
            });
        }
       

        // Add drag event listeners
        placeElement.addEventListener('dragstart', handleDragStart);
        placeElement.addEventListener('dragend', handleDragEnd);
        placeElement.addEventListener('dragover', handleDragOver);
        placeElement.addEventListener('drop', handleDrop);

        placesList.appendChild(placeElement);
    });

    updateSavePlacesButton();
}

async function saveUpdatedPlacesListToFirebase() {
    console.log('=== Places Save Preview ===');

    console.log('=== Part 0: Capture all current commentary ===');

    const tripData = userTrips.find(t => t.id === currentTripId);
    if (!tripData) {
        throw new Error('Trip data not found');
    }

    const placesList = document.querySelector('.places-list');
    const placeItems = placesList.querySelectorAll('.place-item');

    // Update placesToAdd with current commentary values
    placeItems.forEach(placeItem => {
        console.log('Processing place item:', placeItem);
        
        const commentaryInput = placeItem.querySelector('.commentary-input');
        console.log('Found commentary input:', commentaryInput);
        
        if (commentaryInput) {
            const placeId = placeItem.getAttribute('data-place-id');
            const commentary = commentaryInput.value.trim();
            
            // Find matching place in placesToAdd
            const placeToAddIndex = placesToAdd.findIndex(p => {
                console.log('Checking place:', p);
                
                const isNewPlace = placeId.startsWith('new-');
                const actualPlaceId = isNewPlace ? placeId.replace('new-', '') : placeId;
               
                console.log('Comparing:', {
                    isNewPlace,
                    actualPlaceId,
                    placeId: p.placeId,
                    match: p.placeId === actualPlaceId
                });
                
                return p.placeId === actualPlaceId;
            });

            console.log('Found place at index:', placeToAddIndex);
            console.log('Current placesToAdd:', [...placesToAdd]);

            if (placeToAddIndex !== -1) {
                placesToAdd[placeToAddIndex] = {
                    ...placesToAdd[placeToAddIndex],
                    commentary
                };
            }
        }
    });


    
    try {
        console.log('=== Part 1: Processing New Places ===');
        
        // Get all Google Place IDs we need to check
        const placeIdsToCheck = placesToAdd.map(p => p.placeId);
        console.log('Total new places to check:', placeIdsToCheck.length);

        // Create chunks of 10 IDs (Firestore's IN limit)
        const chunks = [];
        for (let i = 0; i < placeIdsToCheck.length; i += 10) {
            chunks.push(placeIdsToCheck.slice(i, i + 10));
        }

        // Query Firestore for each chunk
        const existingPlacesMap = {};
        for (const chunk of chunks) {
            console.log('Checking chunk:', chunk);
            const querySnapshot = await firebase.firestore()
                .collection('places')
                .where('gpid', 'in', chunk)
                .get();

            querySnapshot.forEach(doc => {
                existingPlacesMap[doc.data().gpid] = {
                    id: doc.id,
                    ...doc.data()
                };
            });
        }

        // get date so that we can add comments if they exist to new or existing places.
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true 
        }).replace(',', ' at');


        // Check each place
        placesToAdd.forEach(place => {
            if (existingPlacesMap[place.placeId]) {
                console.log(`Place exists: ${place.name} (${place.placeId})`);
                console.log('Existing document ID:', existingPlacesMap[place.placeId].id);
            } else {
                console.log(`Need to create new place: ${place.name} (${place.placeId})`);
            }
        });

        // Process existing places - update trips arrays
        const existingPlaceUpdates = placesToAdd
            .filter(place => existingPlacesMap[place.placeId])
            .map(async place => {
                const existingPlace = existingPlacesMap[place.placeId];

                console.log(`ABOUT TO ADD EXISTING PLACE: ${JSON.stringify(place,null,2)}`);
                // add commentary if it exists
                let commentData = null;
                if (place.commentary?.trim()){
                    commentData = {
                        date: formattedDate,
                        msg: place.commentary,
                        tripId: currentTripId,
                        tripTitle: tripData.title,
                        userDisplayName: currentUserDisplayName,
                        userId: currentUserId
                    };
                }

                return firebase.firestore()
                    .collection('places')
                    .doc(existingPlace.id)
                    .update({
                        trips: firebase.firestore.FieldValue.arrayUnion(currentTripId),
                        ...(commentData && {
                            comments: firebase.firestore.FieldValue.arrayUnion(commentData)
                        })
                    })
                    .then(() => ({
                        id: existingPlace.id,
                        isNew: false,
                        placeId: place.placeId  // Add this for easier lookup later
                    }));
            });
        
        // Identify which places need Google Place details
        const placesNeedingDetails = placesToAdd.filter(place => 
            !existingPlacesMap[place.placeId]
        );

        let newPlaceCreations = [];
        let placeDetails = [];

        if (placesNeedingDetails.length > 0) {
            console.log(`Fetching Google details for ${placesNeedingDetails.length} new places`);
            
            // Create the request body format the API expects
            const requestBody = {
                list: placesNeedingDetails.map(place => place.placeId)
            };
            
            try {
                placeDetails = await fetch('/api/googleFetchPlaceDetails', {
                    method: 'POST',
                    body: JSON.stringify(requestBody)
                }).then(res => res.json());

                // Filter out any null results (failed fetches)
                placeDetails = placeDetails.filter(details => details !== null);
                
                // Log any places that failed to fetch
                const fetchedPlaceIds = placeDetails.map(d => d.gpid);
                const failedPlaces = placesNeedingDetails.filter(
                    place => !fetchedPlaceIds.includes(place.placeId)
                );
                
                if (failedPlaces.length > 0) {
                    console.error('Failed to fetch details for places:', 
                        failedPlaces.map(p => p.name)
                    );
                    // Could show a warning to the user here
                }

            } catch (error) {
                console.error('Error fetching place details:', error);
                placeDetails = [];  // Reset to empty array on complete failure
            }

        }

        // Create new places (only for successfully fetched details)
        newPlaceCreations = placeDetails.map(details => {
            // Find the corresponding place in placesToAdd to get commentary
            const placeWithCommentary = placesToAdd.find(p => p.placeId === details.gpid);

            // Create comment data if commentary exists and isn't empty
            let comments = [];
            if (placeWithCommentary?.commentary?.trim()) {
                comments = [{
                    date: formattedDate,
                    msg: placeWithCommentary.commentary,
                    tripId: currentTripId,
                    tripTitle: tripData.title,
                    userDisplayName: currentUserDisplayName,
                    userId: currentUserId
                }];
            }

            return firebase.firestore()
                .collection('places')
                .add({
                    ...details,
                    trips: [currentTripId],
                    comments: comments,
                    dateCreated: firebase.firestore.FieldValue.serverTimestamp()
                })
                .then(async newPlaceRef => {
                    // Add placeId field after creation
                    await newPlaceRef.update({
                        placeId: newPlaceRef.id
                    });
                    
                    return {
                        id: newPlaceRef.id,
                        isNew: true,
                        placeId: details.gpid  // Add this for easier lookup later
                    };
                });
        });

        // Wait for all operations to complete
        const processedPlaces = await Promise.all([
            ...existingPlaceUpdates,
            ...newPlaceCreations
        ]);

        console.log('All places processed:', processedPlaces);
        
        console.log('=== Part 2: Processing Deletions ===');

        // Handle removing places from the trip
        const deletionPromises = Array.from(placesToDelete).map(async placeId => {
            console.log(`Removing trip reference and comments from place: ${placeId}`);

            const placeDoc = await firebase.firestore()
                .collection('places')
                .doc(placeId)
                .get();



            if (placeDoc.exists) {
                const placeData = placeDoc.data();
                // Filter out comments from this trip
                const updatedComments = (placeData.comments || []).filter(
                    comment => comment.tripId !== currentTripId
                );

                // Update the document with both changes
                await firebase.firestore()
                    .collection('places')
                    .doc(placeId)
                    .update({
                        trips: firebase.firestore.FieldValue.arrayRemove(currentTripId),
                        comments: updatedComments
                    });
            }
        });

        await Promise.all(deletionPromises);
        console.log('Deletions completed');

        console.log('=== Part 3: Updating Trip Places Order ===');
        
        // Get final order from currentPlaceDisplayList
        const finalOrder = currentPlaceDisplayList
        .filter(p => !p.isMarkedForDeletion)
        .map(p => {
            if (p.isNew) {
                const processed = processedPlaces.find(pp => pp.placeId === p.placeId);
                return processed ? processed.id : null;
            }
            return p.id;
        })
        .filter(id => id !== null);

        console.log('Saving final order:', finalOrder);

        // Update trip document with new order
        await firebase.firestore()
            .collection('trips')
            .doc(currentTripId)
            .update({
                places: finalOrder
            });

        // Update local state
        const tripIndex = userTrips.findIndex(t => t.id === currentTripId);
        if (tripIndex !== -1) {
            // Start with existing placesData
            const placesData = { ...userTrips[tripIndex].placesData };
            
            // Add/update existing places that were just added to the trip
            processedPlaces
                .filter(p => !p.isNew)
                .forEach(place => {
                    const placeToAdd = placesToAdd.find(p => p.placeId === place.placeId);
                    const existingPlace = existingPlacesMap[place.placeId];

                    // If there was commentary, add it to the comments array
                    if (placeToAdd?.commentary?.trim()) {
                        const commentData = {
                            date: formattedDate,
                            msg: placeToAdd.commentary,
                            tripId: currentTripId,
                            tripTitle: tripData.title,
                            userDisplayName: currentUserDisplayName,
                            userId: currentUserId
                        };
                        
                        existingPlace.comments = existingPlace.comments || [];
                        existingPlace.comments.push(commentData);
                    }
                
                    placesData[place.id] = existingPlacesMap[place.placeId];
            });

            // Update with any new places we just created
            processedPlaces
                .filter(p => p.isNew)
                .forEach(newPlace => {
                    const placeToAdd = placesToAdd.find(p => p.placeId === newPlace.placeId);
                    const placeDetail = placeDetails.find(pd => pd.gpid === newPlace.placeId);
                    
                    // Create comments array if there was commentary
                    const comments = placeToAdd?.commentary?.trim() ? [{
                        date: formattedDate,
                        msg: placeToAdd.commentary,
                        tripId: currentTripId,
                        tripTitle: tripData.title,
                        userDisplayName: currentUserDisplayName,
                        userId: currentUserId
                    }] : [];
                    
                    placesData[newPlace.id] = {
                        id: newPlace.id,
                        ...placeDetail,
                        comments
                    };
                });
        
            // Remove any deleted places
            Array.from(placesToDelete).forEach(id => {
                delete placesData[id];
            });
        
            // Update trip data
            userTrips[tripIndex] = {
                ...userTrips[tripIndex],
                places: finalOrder,
                placesData
            };
        }

        // After successful save, clear the Reddit places section
        const redditPlacesSection = document.querySelector('.reddit-places-section');
        if (redditPlacesSection) {
            redditPlacesSection.remove();
        }

        // Reset state
        placesToAdd = [];
        placesToDelete.clear();

        // Rebuild display list from updated cache
        const updatedTripData = userTrips.find(t => t.id === currentTripId);
        currentPlaceDisplayList = updatedTripData.places.map(placeId => {
            const placeData = updatedTripData.placesData[placeId];
            return {
                ...placeData,
                isNew: false,
                isMarkedForDeletion: false
            };
        });

        console.log('Save completed successfully');

        // Refresh the UI
        loadPlacesList();  // This will rebuild the display list without the tags
        loadCommentsList();

    } catch (error) {
        console.error('Error processing places:', error);
        throw error;
    }
}

async function saveUpdatedAttendeesListToFirebase() {
    try {
        const tripRef = firebase.firestore()
            .collection('trips')
            .doc(currentTripId);

        // Get current trip data
        const tripDoc = await tripRef.get();
        if (!tripDoc.exists) {
            throw new Error('Trip not found');
        }

        const batch = firebase.firestore().batch();

        // Handle removals
        for (const userId of attendeesToRemove) {
            // Update trip's attendees list
            batch.update(tripRef, {
                attendees: firebase.firestore.FieldValue.arrayRemove(userId)
            });

            // Update user's trips list
            const userRef = firebase.firestore().collection('users').doc(userId);
            batch.update(userRef, {
                trips: firebase.firestore.FieldValue.arrayRemove(currentTripId)
            });
        }

        // Handle additions
        for (const attendee of attendeesToAdd) {
            // Update trip's attendees list
            batch.update(tripRef, {
                attendees: firebase.firestore.FieldValue.arrayUnion(attendee.userId)
            });

            // Update user's trips list
            const userRef = firebase.firestore().collection('users').doc(attendee.userId);
            batch.update(userRef, {
                trips: firebase.firestore.FieldValue.arrayUnion(currentTripId)
            });
        }

        // Execute all updates atomically
        await batch.commit();

        // Update local state in userTrips
        const tripIndex = userTrips.findIndex(t => t.id === currentTripId);
        if (tripIndex !== -1) {
            // Start with existing data
            let updatedAttendees = [...userTrips[tripIndex].attendees || []];
            let updatedAttendeesData = { ...userTrips[tripIndex].attendeesData || {} };

            // Remove deleted attendees from both arrays and objects
            updatedAttendees = updatedAttendees.filter(
                attendeeId => !attendeesToRemove.has(attendeeId)
            );
            attendeesToRemove.forEach(userId => {
                delete updatedAttendeesData[userId];
            });

            // Add new attendees
            attendeesToAdd.forEach(attendee => {
                if (!updatedAttendees.includes(attendee.userId)) {
                    updatedAttendees.push(attendee.userId);
                    updatedAttendeesData[attendee.userId] = {
                        userId: attendee.userId,
                        displayName: attendee.displayName,
                        pPic: attendee.pPic || '/assets/Butterfly2.png'
                    };
                }
            });

            // Update userTrips with new attendees data
            userTrips[tripIndex] = {
                ...userTrips[tripIndex],
                attendees: updatedAttendees,
                attendeesData: updatedAttendeesData
            };

            // Update currentAttendeesList for the UI
            currentAttendeesList = currentAttendeesList
                .filter(a => !a.isMarkedForDeletion)
                .map(a => ({
                    ...a,
                    isNew: false,
                    isMarkedForDeletion: false
                }));
        }

        // Reset state
        attendeesToAdd = [];
        attendeesToRemove.clear();

        // Refresh the UI
        renderAttendeesList();
        document.getElementById('saveAttendeesBtn').disabled = true;

        console.log('Attendees updated successfully');

    } catch (error) {
        console.error('Error updating attendees:', error);
        throw error;
    }
}

function updateSavePlacesButton() {
    const saveBtn = document.getElementById('savePlacesBtn');
    if (!saveBtn) return;

    const tripData = userTrips.find(trip => trip.id === currentTripId);
    if (!tripData) return;

    // Get original order of existing places
    const originalOrder = tripData.places || [];
    
    // Get current order of existing places (excluding new and deleted places)
    const currentOrder = currentPlaceDisplayList
        .filter(p => !p.isNew && !p.isMarkedForDeletion)
        .map(p => p.id);

    // Check if order has changed
    const orderChanged = originalOrder.length !== currentOrder.length ||
        originalOrder.some((id, index) => id !== currentOrder[index]);

    // Enable button if there are additions, deletions, or order changes
    saveBtn.disabled = placesToAdd.length === 0 && 
                      placesToDelete.size === 0 && 
                      !orderChanged;
}

function initializePlacesAutocomplete() {
    const input = document.getElementById('placesAutocomplete');
    const searchResults = document.getElementById('placesSearchResults');

    function addPlaceToResults(place) {
        const li = document.createElement('li');
        li.textContent = place.description;
        li.onclick = () => {
            console.log('place', place);
            savePlace(place);
            input.value = ''; // Clear the search bar
            searchResults.innerHTML = '';
            loadPlacesList();  // Reload places when selection is made
        }
        searchResults.appendChild(li);
    }

    function savePlace(place) {

        // Add to placesToAdd array
        placesToAdd.push({
            name: place.description.split(',')[0] || place.description,
            placeId: place.place_id
        });

        // Add to the top of display list
        currentPlaceDisplayList.push({
            name: place.description.split(',')[0] || place.description,
            placeId: place.place_id,
            isNew: true,
            isMarkedForDeletion: false
        });

        // Clear search results
        searchResults.innerHTML = '';
        input.value = '';

        // Find the current trip data and refresh places list
        if (currentTripId) {
            const tripData = userTrips.find(trip => trip.id === currentTripId);
            if (tripData) {
                loadPlacesList();
            }
        }
    }

    input.addEventListener('input', debounce(function() {
        if (input.value.length === 0) {
            searchResults.innerHTML = '';
            loadPlacesList();  // Reload places when input is cleared
            return;
        }
        
        if (input.value.length < 3) {
            searchResults.innerHTML = '';
            return;
        }

        console.log('Fetching places for input:', input.value);

        fetch(`/api/googlePlacesProxy?input=${encodeURIComponent(input.value)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                searchResults.innerHTML = ''; // Clear previous results
                if (data.predictions && Array.isArray(data.predictions)) {
                    data.predictions.forEach(prediction => {
                        addPlaceToResults({
                            description: prediction.description,
                            place_id: prediction.place_id,
                        });
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching places:', error);
                searchResults.innerHTML = '<li class="error">Error fetching places</li>';
            });
    }, 300));
}

// Drag and Drop handlers
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.placeId);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    // Clean up all drag indicators
    document.querySelectorAll('.place-item').forEach(item => {
        item.classList.remove('drag-above', 'drag-below');
    });
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Remove all existing indicators
    document.querySelectorAll('.place-item').forEach(item => {
        item.classList.remove('drag-above', 'drag-below');
    });
    
    //const placesList = document.getElementById('placesList');
    const placesList = this.closest('.places-list');
    if (!placesList) return;
    
    const items = Array.from(placesList.querySelectorAll('.place-item'));


    
    // Find the item we're hovering over or closest to
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rect = item.getBoundingClientRect();
        const nextItem = items[i + 1];
        
        // If we're over this item or in its border area
        if (e.clientY <= rect.bottom) {
            const centerY = rect.top + (rect.height / 2);
            const threshold = 5; // Increased threshold for better detection
            
            // If we're very close to the center or top border, default to above
            if (Math.abs(e.clientY - centerY) <= threshold || Math.abs(e.clientY - rect.top) <= threshold) {
                item.classList.add('drag-above');
                return false;
            }
            
            // If we're in the top half of the item
            if (e.clientY < centerY) {
                item.classList.add('drag-above');
            } else {
                // If we're in the bottom half and there's a next item
                if (nextItem) {
                    nextItem.classList.add('drag-above');
                } else {
                    item.classList.add('drag-below');
                }
            }
            return false;
        }
    }
    
    // If we're below all items, add indicator to last item
    if (items.length > 0) {
        items[items.length - 1].classList.add('drag-below');
    }
    
    return false;
}

// Update drag and drop to work with currentPlaceDisplayList
function handleDrop(e) {
    e.preventDefault();
    
    if (draggedElement === this) return;
    
    const draggedId = e.dataTransfer.getData('text/plain');
    const dropTarget = this;

    // Clean up all drag indicators
    document.querySelectorAll('.place-item').forEach(item => {
        item.classList.remove('drag-above', 'drag-below');
    });
    
    const draggedIndex = currentPlaceDisplayList.findIndex(p => 
        p.isNew ? `new-${p.placeId}` === draggedId : p.id === draggedId
    );
    const targetIndex = currentPlaceDisplayList.findIndex(p => 
        p.isNew ? `new-${p.placeId}` === dropTarget.dataset.placeId : p.id === dropTarget.dataset.placeId
    );
    
    // Use the visual indicator to determine where to drop
    const dropAbove = dropTarget.classList.contains('drag-above');
    const newIndex = dropAbove ? targetIndex : targetIndex;
    
    // Move the item in the display list
    const [movedItem] = currentPlaceDisplayList.splice(draggedIndex, 1);
    currentPlaceDisplayList.splice(newIndex, 0, movedItem);
    
    loadPlacesList();
}



function loadCommentsList() {
    const commentsList = document.querySelector('.comments-list');
    if (!commentsList) return;
    commentsList.innerHTML = '';
    
    const tripData = userTrips.find(t => t.id === currentTripId);
    if (!tripData || !tripData.places) return;

    // Create comment items for each place
    tripData.places.forEach(placeId => {
        const placeData = tripData.placesData[placeId];
        if (!placeData) return;

        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        
        // Find place type info
        const placeTypeInfo = PLACE_TYPES.find(type => type.value === placeData.type);
        
        commentItem.innerHTML = `
            <i class="${placeTypeInfo?.icon || 'fa-solid fa-location-dot'}"></i>
            <div class="comment-details">
                <div class="comment-place-name">${placeData.title}</div>
                <div class="comment-place-type">${placeTypeInfo?.label || 'Place'}</div>
            </div>
            <textarea id="commentInput" name="commentInput" rows="4" class="comment-input" placeholder="Add a comment..."></textarea>
            <button class="save-comment-btn" data-place-id="${placeId}">Save</button>
        `;

        // Add auto-resize functionality
        const textarea = commentItem.querySelector('.comment-input');
        textarea.addEventListener('input', function() {
            // Reset height
            this.style.height = 'auto';
            // Set height to scrollHeight to fit all content
            this.style.height = Math.max(84, this.scrollHeight) + 'px';
        });

        // Add event listener for save button
        const saveBtn = commentItem.querySelector('.save-comment-btn');
        saveBtn.addEventListener('click', async () => {
            const commentInput = commentItem.querySelector('.comment-input');
            const comment = commentInput.value.trim();
            
            if (!comment) return;

            try {
                const user = firebase.auth().currentUser;
                const now = new Date();
                const formattedDate = now.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true 
                }).replace(',', ' at');

                const commentData = {
                    date: formattedDate,
                    msg: comment,
                    tripId: currentTripId,
                    tripTitle: tripData.title,
                    userDisplayName: currentUserDisplayName,
                    userId: currentUserId
                };

                // Get the place document
                const placeRef = firebase.firestore().collection('places').doc(placeId);
                
                // Update the comments array
                await placeRef.update({
                    comments: firebase.firestore.FieldValue.arrayUnion(commentData)
                });

                // Clear input and show success
                commentInput.value = '';
                saveBtn.textContent = 'Saved!';
                setTimeout(() => {
                    saveBtn.textContent = 'Save';
                }, 2000);

            } catch (error) {
                console.error('Error saving comment:', error);
                saveBtn.textContent = 'Error';
                setTimeout(() => {
                    saveBtn.textContent = 'Save';
                }, 2000);
            }
        });

        commentsList.appendChild(commentItem);
    });
}

async function processRedditLink(url) {
    const response = await fetch('/.netlify/functions/processRedditLink', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        throw new Error('Failed to process Reddit content');
    }

    return response.json();
}

async function handleRedditExtract() {
    const url = document.getElementById('redditUrl').value;
    if (!url) {
        alert('Please enter a Reddit URL');
        return;
    }

    const button = document.getElementById('saveRedditTripBtn');
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.loading-spinner');
    
    try {
        button.disabled = true;
        buttonText.textContent = 'Processing...';
        spinner.style.display = 'inline-block';
        
        const content = await processRedditLink(url);

        // Populate form fields first
        document.getElementById('title').value = content.title;
        document.getElementById('monthSelect').value = content.month;
        document.getElementById('yearSelect').value = content.year;
        document.getElementById('numPeople').value = content.numPeople;
        document.getElementById('numDays').value = content.days;
        document.getElementById('familyType').value = content.type;
        document.getElementById('shortDescription').value = content.shortDescription;

        const tripId = await saveNewTrip();

        isNewRedditTrip = true;

        // Convert Markdown to HTML for longDescriptionHTML
        let htmlContent = marked.parse(content.longDescription);
        
        // Set the long description in TinyMCE
        tinymce.get('longDescription').setContent(htmlContent);

        // Create the places section
        createRedditPlacesSection(content.places);

    } catch (error) {
        alert('Error processing Reddit content: ' + error.message);
    } finally {
        button.disabled = false;
        buttonText.textContent = 'Save New Trip';
        spinner.style.display = 'none';
    }
}

function createRedditPlacesSection(places) {
    let redditPlacesSection = document.querySelector('.reddit-places-section');
    if (!redditPlacesSection) {
        redditPlacesSection = document.createElement('div');
        redditPlacesSection.className = 'reddit-places-section';
        redditPlacesSection.innerHTML = `
            <h3>Places Automatically Identified</h3>
            <div class="reddit-places-list"></div>
            <div class="search-results-container"></div>
        `;
        
        const searchInput = document.querySelector('#placesTab .form-group');
        searchInput.parentNode.insertBefore(redditPlacesSection, searchInput);
    }

    const placesList = redditPlacesSection.querySelector('.reddit-places-list');
    placesList.innerHTML = '';

    places.forEach(place => {
        const placeButton = document.createElement('button');
        placeButton.className = 'reddit-place-button';
        placeButton.textContent = place.title;
        placeButton.onclick = async () => {
            // Don't process if already marked as skipped
            if (placeButton.classList.contains('skipped')) {
                return;
            }

            const searchResults = document.createElement('div');
            searchResults.className = 'place-search-results';
            
            try {
                const response = await fetch(`/api/googlePlacesProxy?input=${encodeURIComponent(place.title)}`);
                const data = await response.json();
                
                if (data.predictions && data.predictions.length > 0) {
                    // If there's only one result, select it automatically
                    if (data.predictions.length === 1) {
                        const prediction = data.predictions[0];
                        
                        // Add to placesToAdd array
                        placesToAdd.push({
                            name: prediction.description,
                            placeId: prediction.place_id,
                            commentary: place.commentary,
                        });

                        // Add to currentPlaceDisplayList
                        currentPlaceDisplayList.push({
                            name: prediction.description,
                            placeId: prediction.place_id,
                            commentary: place.commentary,
                            isNew: true,
                            isMarkedForDeletion: false
                        });

                        placeButton.remove();

                        const remainingPlaces = redditPlacesSection.querySelectorAll('.reddit-place-button:not(.skipped)');
                        if (remainingPlaces.length === 0) {
                            const skippedPlaces = redditPlacesSection.querySelectorAll('.reddit-place-button.skipped');
                            if (skippedPlaces.length === 0) {
                                redditPlacesSection.remove();
                            }
                        }
                        
                        loadPlacesList();
                        updateSavePlacesButton();
                    } else {
                        // Multiple results - show the search results
                        searchResults.innerHTML = `
                            <div class="search-results-header">
                                <span>Results for "${place.title}":</span>
                                <button class="ignore-place-button">
                                    <i class="fas fa-times"></i> Skip/Ignore
                                </button>
                            </div>
                            <div class="search-results-list"></div>
                        `;

                        const resultsList = searchResults.querySelector('.search-results-list');
                        
                        // Add ignore button handler
                        const ignoreButton = searchResults.querySelector('.ignore-place-button');
                        ignoreButton.onclick = (e) => {
                            e.stopPropagation();
                            // Instead of removing, mark as skipped
                            placeButton.classList.add('skipped');
                            searchResults.remove();
                        };

                        data.predictions.forEach(prediction => {
                            const resultButton = document.createElement('button');
                            resultButton.className = 'place-result-button';
                            resultButton.textContent = prediction.description;
                            resultButton.onclick = () => {
                                placesToAdd.push({
                                    name: prediction.description,
                                    placeId: prediction.place_id,
                                    commentary: place.commentary,
                                });

                                currentPlaceDisplayList.push({
                                    name: prediction.description,
                                    placeId: prediction.place_id,
                                    commentary: place.commentary,
                                    isNew: true,
                                    isMarkedForDeletion: false
                                });

                                placeButton.remove();
                                searchResults.remove();

                                const remainingPlaces = redditPlacesSection.querySelectorAll('.reddit-place-button:not(.skipped)');
                                if (remainingPlaces.length === 0) {
                                    const skippedPlaces = redditPlacesSection.querySelectorAll('.reddit-place-button.skipped');
                                    if (skippedPlaces.length === 0) {
                                        redditPlacesSection.remove();
                                    }
                                }
                                
                                loadPlacesList();
                                updateSavePlacesButton();
                            };
                            resultsList.appendChild(resultButton);
                        });

                        // Remove any existing search results
                        document.querySelectorAll('.place-search-results').forEach(el => el.remove());
                        
                        // Add results to the container below the places list
                        const resultsContainer = redditPlacesSection.querySelector('.search-results-container');
                        resultsContainer.innerHTML = '';
                        resultsContainer.appendChild(searchResults);
                    }
                } else {
                    // No results found - show message
                    searchResults.innerHTML = `
                        <div class="search-results-header">
                            <span>Results for "${place.title}":</span>
                            <button class="ignore-place-button">
                                <i class="fas fa-times"></i> Skip/Ignore
                            </button>
                        </div>
                        <p class="no-results">No results found</p>
                    `;

                    const ignoreButton = searchResults.querySelector('.ignore-place-button');
                    ignoreButton.onclick = (e) => {
                        e.stopPropagation();
                        placeButton.classList.add('skipped');
                        searchResults.remove();
                    };

                    // Remove any existing search results
                    document.querySelectorAll('.place-search-results').forEach(el => el.remove());
                    
                    // Add results to the container
                    const resultsContainer = redditPlacesSection.querySelector('.search-results-container');
                    resultsContainer.innerHTML = '';
                    resultsContainer.appendChild(searchResults);
                }
            } catch (error) {
                console.error('Error searching for place:', error);
                searchResults.innerHTML = '<p class="error">Error searching for place</p>';
            }
        };
        placesList.appendChild(placeButton);
    });
}

function initializeAttendeesSearch() {
    const searchInput = document.getElementById('attendeesSearch');
    const searchResults = document.getElementById('attendeesSearchResults');
    const saveButton = document.getElementById('saveAttendeesBtn');

    let debounceTimeout;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
            const query = searchInput.value.trim();
            if (!query) {
                searchResults.innerHTML = '';
                return;
            }

            try {
                const { hits } = await userIndex.search(query);
                searchResults.innerHTML = '';

                hits.forEach(user => {
                    // Skip if user is already in attendees list
                    if (currentAttendeesList.some(a => a.userId === user.userId)) {
                        return;
                    }

                    const li = document.createElement('li');
                    li.className = 'attendee-result';
                    li.innerHTML = `
                        <div class="attendee-info">
                            <img src="${user.pPic || '/assets/Butterfly2.png'}" alt="${user.displayName}" class="attendee-avatar">
                            <div class="attendee-details">
                                <span class="attendee-name">${user.displayName}</span>
                                <span class="attendee-badge">${user.location}</span>
                            </div>
                        </div>
                    `;

                    li.onclick = () => {
                        addAttendee(user);
                        searchResults.innerHTML = '';
                        searchInput.value = '';
                        saveButton.disabled = false;
                    };

                    searchResults.appendChild(li);
                });
            } catch (error) {
                console.error('Error searching users:', error);
            }
        }, 300);
    });
}

function addAttendee(user) {
    attendeesToAdd.push({
        userId: user.userId,
        displayName: user.displayName,
        pPic: user.pPic
    });

    currentAttendeesList.push({
        userId: user.userId,
        displayName: user.displayName,
        pPic: user.pPic,
        isNew: true
    });

    renderAttendeesList();
}

function renderAttendeesList() {
    const attendeesGrid = document.querySelector('.attendees-grid');
    attendeesGrid.innerHTML = '';

    currentAttendeesList.forEach(attendee => {
        const attendeeElement = document.createElement('div');
        attendeeElement.className = `attendee-item ${attendee.isNew ? 'to-be-added' : ''} ${attendee.isMarkedForDeletion ? 'to-be-removed' : ''}`;
        
        // Only show remove/undo button if not the creator
        const buttonHtml = !attendee.isCreator ? (
            attendee.isMarkedForDeletion 
                ? `<button class="undo-remove-btn">
                     <i class="fas fa-undo"></i>
                   </button>`
                : `<button class="remove-attendee-btn">
                     <i class="fas fa-times"></i>
                   </button>`
        ) : '';

        attendeeElement.innerHTML = `
        <div class="attendee-info">
            <img src="${attendee.pPic || '/assets/Butterfly2.png'}" alt="${attendee.displayName}" class="attendee-avatar">
            <div class="attendee-details">
                <span class="attendee-name">${attendee.displayName}</span>
                ${attendee.isCreator ? '<span class="creator-badge">Trip Creator</span>' : ''}
            </div>
        </div>
        ${buttonHtml}
    `;

        // Only add click handlers if not the creator
        if (!attendee.isCreator) {
            if (attendee.isMarkedForDeletion) {
                attendeeElement.querySelector('.undo-remove-btn').onclick = () => {
                    attendeesToRemove.delete(attendee.userId);
                    const index = currentAttendeesList.findIndex(a => a.userId === attendee.userId);
                    if (index !== -1) {
                        currentAttendeesList[index].isMarkedForDeletion = false;
                    }
                    renderAttendeesList();
                    document.getElementById('saveAttendeesBtn').disabled = false;
                };
            } else {
                const removeBtn = attendeeElement.querySelector('.remove-attendee-btn');
                if (removeBtn) {
                    removeBtn.onclick = () => {
                        if (attendee.isNew) {
                            attendeesToAdd = attendeesToAdd.filter(a => a.userId !== attendee.userId);
                            currentAttendeesList = currentAttendeesList.filter(a => a.userId !== attendee.userId);
                        } else {
                            attendeesToRemove.add(attendee.userId);
                            const index = currentAttendeesList.findIndex(a => a.userId === attendee.userId);
                            if (index !== -1) {
                                currentAttendeesList[index].isMarkedForDeletion = true;
                            }
                        }
                        renderAttendeesList();
                        document.getElementById('saveAttendeesBtn').disabled = false;
                    };
                }
            }
        }

        attendeesGrid.appendChild(attendeeElement);
    });

    // Add the "Invite New User" button at the end
    const inviteButton = document.createElement('div');
    inviteButton.className = 'attendee-item invite-new-user';
    inviteButton.innerHTML = `
        <div class="attendee-info">
            <div class="invite-icon">
                <i class="fas fa-user-plus"></i>
            </div>
            <div class="attendee-details">
                <span class="attendee-name">Invite New User</span>
                <span class="invite-description">Share link to join Cipher</span>
            </div>
        </div>
    `;

    inviteButton.addEventListener('click', () => {
        let tripData = userTrips.find(trip => trip.id === currentTripId);
        showInviteModal(tripData, true); // true for invite mode
    });

    /*
    inviteButton.addEventListener('click', async () => {
        const tripId = currentTripId;
        const inviteUrl = `${window.location.origin}/share?tripId=${tripId}&invite=true`;

        // Remove any existing success messages
        document.querySelectorAll('.share-success-message').forEach(msg => msg.remove());

        // Create success message if it doesn't exist
        let successSpan = document.querySelector('.invite-success-message');
        if (!successSpan) {
            successSpan = document.createElement('span');
            successSpan.className = 'share-success-message';  // reuse same styling
            successSpan.style.display = 'none';
            successSpan.innerHTML = '<i class="fas fa-check"></i> Invitation Link Copied!';
            inviteButton.parentNode.insertBefore(successSpan, inviteButton.nextSibling);
        }
        
        try {
            await navigator.clipboard.writeText(inviteUrl);
            successSpan.style.display = 'inline-flex';
            setTimeout(() => {
                successSpan.style.display = 'none';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy invite URL:', err);
        }
    });
    */

    attendeesGrid.appendChild(inviteButton);
}


/******************************************************************************
 * IMPORTS AND CONSTANTS
 ******************************************************************************/
import { TRIP_TYPES, DEFAULTS, PLACE_TYPES } from '/utils/config.js';
import { showAuthModal } from '/components/signup/signup.js';
import { showMobileWarning } from '/components/mobileWarning/mobileWarning.js';


// Algolia Setup
const searchClient = algoliasearch('WADPYQO9WN', '37148f9e28cd367ebb6c1cfdb4852db6');
const tripIndex = searchClient.initIndex('tripIndex');
const tripIndexDateCreatedDesc = searchClient.initIndex('tripIndex_dateCreatedDesc');

// Constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/******************************************************************************
 * STATE MANAGEMENT
 ******************************************************************************/
const state = {
    currentUser: null,
    currentUserTrips: null,
    currentTrip: null,
    currentDiscoverMap: null,
    currentTripMap: null,
    userConnections: new Set(),
    recentActivity: {
        cache: null,
        lastFetch: null,
        isViewing: false
    },
    filters: {
        tripTypes: [],
        duration: { min: null, max: null },
        isNetworkOnly: true
    },
    view: {
        isMapView: false,
        isTripView: false
    }
};

/******************************************************************************
 * INITIALIZATION AND EVENT LISTENERS
 ******************************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadAndDisplayTripPreview();
        
    } catch (error) {
        console.error('Initialization error:', error);
        displayErrorMessage('Failed to initialize application');
    }
});

/**
 * Determines initial view based on URL parameters
 */
async function loadAndDisplayTripPreview() {
    const loadingOverlay = document.getElementById('loading-overlay');

    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');
    const inviteCode = params.get('invite');

    if (!tripId) {
        console.error('❌ No tripId provided in URL');
        // Maybe show an error message to user
        return;
    }

    const pageContainer = document.querySelector('.page-container');
    const inviteBanner = document.createElement('div');
    inviteBanner.className = 'invite-banner';
    inviteBanner.innerHTML = `
        <span>${inviteCode 
            ? 'You have been invited to join this trip on Cipher! Login or Create an Account now to join.'
            : 'You are viewing this trip on PREVIEW mode in Cipher. Login or Create an Account to join!'
        }</span>
        <button class="get-started-btn">Get Started</button>
    `;
    
    const getStartedBtn = inviteBanner.querySelector('.get-started-btn');
    getStartedBtn.addEventListener('click', showFeatureLockedModal);
    
    pageContainer.insertBefore(inviteBanner, pageContainer.firstChild);

    try {
        // add log saying running fetch with cool icon
        //console.log('🚀 Fetching data for trip preview...');

        const response = await fetch(
            `https://us-central1-cipher-4fa1c.cloudfunctions.net/getPublicTripPreview?tripId=${tripId}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch preview data');

        const { tripData, creatorData } = await response.json();
        
        console.log('✅ Received preview data successfully');
        //console.log('📦 Trip Data:', JSON.stringify(tripData, null, 2));
        //console.log('👤 Creator Data:', JSON.stringify(creatorData, null, 2));

        state.currentUser = creatorData;
        state.currentTrip = tripData;
        state.currentUserTrips = creatorData.tripsDetail.filter(trip => trip !== null);

        showMobileWarning(tripData);
        switchToPreviewView();
        initializeTripTypes();
        initializeEventListeners();
        initializeDefaultState();
        displayTripPreview(tripData);
        displayUserPreview(creatorData);

        attachFeatureLockedHandlers();
    } catch (error) {
        console.error('❌ Error loading preview:', error);
    } finally {
        // Hide loading overlay with a fade effect
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            loadingOverlay.style.opacity = '1';
        }, 300);
    }
}

/**
 * Sets up all event listeners for the page
 */
function initializeEventListeners() {
    // Search and Filter Controls
    document.querySelector('.network-toggle').addEventListener('click', handleNetworkToggle);
    
    // Update these to only store values without searching
    document.getElementById('keywordSearch').addEventListener('input', 
        debounce(updateKeywordState, 300));

    document.querySelector('.days-slider').addEventListener('input', 
        debounce(updateDaysState, 300));
    
    document.getElementById('tripTypesGrid').addEventListener('click', handleTripTypeSelect);
    
    // Add clear all button listener
    document.querySelector('.clear-btn').addEventListener('click', handleClearAll);
}

/**
 * Updates keyword state without triggering search
 */
function updateKeywordState(event) {
    // Just store the value, don't trigger search
    const keyword = event.target.value;
    console.log('🔍 Keyword updated:', keyword);
}

/**
 * Updates days filter state and UI
 */
function updateDaysState(event) {
    const minInput = document.querySelector('.min-days');
    const maxInput = document.querySelector('.max-days');
    const minLabel = document.querySelector('.min-value');
    const maxLabel = document.querySelector('.max-value');
    
    let minValue = parseInt(minInput.value);
    let maxValue = parseInt(maxInput.value);
    
    // Ensure min doesn't exceed max
    if (event.target.classList.contains('min-days')) {
        minValue = Math.min(minValue, maxValue);
        minInput.value = minValue;
    } else {
        maxValue = Math.max(minValue, maxValue);
        maxInput.value = maxValue;
    }
    
    // Update state
    state.filters.duration = {
        min: minValue,
        max: maxValue
    };
    
    // Update labels
    minLabel.textContent = minValue;
    maxLabel.textContent = maxValue === 14 ? '14+' : maxValue;
    
    console.log('📅 Days filter updated:', state.filters.duration);
}


/**
 * Switch between search and trip views
 */
function switchToTripView() {
    document.querySelector('.search-results-view').style.display = 'none';
    document.querySelector('.trip-details-view').style.display = 'block';
    document.querySelector('.search-context').style.display = 'none';
    document.querySelector('.trip-context').style.display = 'block';
}

function switchToPreviewView() {
    document.querySelector('.search-results-view').style.display = 'none';
    document.querySelector('.trip-details-view').style.display = 'block';
    document.querySelector('.search-context').style.display = 'block';
    document.querySelector('.trip-context').style.display = 'none';
}


/******************************************************************************
 * SEARCH AND RESULTS MANAGEMENT
 ******************************************************************************/


/**
 * Handles network toggle button click
 */
function handleNetworkToggle(event) {
    if (!event.target.classList.contains('toggle-btn')) return;
    
    const isAllUsers = event.target.classList.contains('right');
    state.filters.isNetworkOnly = !isAllUsers;
    
    document.querySelectorAll('.network-toggle .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', 
            (btn.classList.contains('right') === isAllUsers));
    });
}

/**
 * Handles trip type selection
 */
function handleTripTypeSelect(event) {
    const chip = event.target.closest('.trip-type-chip');
    if (!chip) return;
    
    const tripType = chip.dataset.type;
    chip.classList.toggle('selected');
    
    if (chip.classList.contains('selected')) {
        state.filters.tripTypes.push(tripType);
    } else {
        state.filters.tripTypes = state.filters.tripTypes.filter(t => t !== tripType);
    }
}



/**
 * Initializes trip type grid
 */
function initializeTripTypes() {
    const grid = document.getElementById('tripTypesGrid');
    grid.innerHTML = Object.entries(TRIP_TYPES).map(([key, value]) => `
        <div class="trip-type-chip" data-type="${key}">
            <i class="${value.icon}"></i> ${value.label}
        </div>
    `).join('');
}


/**
 * Generates HTML for a trip card
 */
function generateTripHTML(trip) {

    return `
        <div class="trip-item" data-trip-id="${trip.tripId}">
            <div class="trip-item-header" style="background-image: url('${trip.tripCoverPic || DEFAULTS.defaultTripCoverPic}')">
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
        </div>
    `;
}

/******************************************************************************
 * UI UTILITIES
 ******************************************************************************/

/**
 * Displays error message to user
 */
function displayErrorMessage(message) {
    // Implementation depends on your UI design
    console.error(message);
}

/******************************************************************************
 * HELPER FUNCTIONS
 ******************************************************************************/
/**
 * Debounces function calls
 */
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


/**
 * Toggles loading state of the UI
 */
function toggleLoadingState(isLoading) {
    // Implementation depends on your UI design
    document.body.style.cursor = isLoading ? 'wait' : 'default';
}

/**
 * Initializes the page to default state
 */
function initializeDefaultState() {
    // Set network toggle to "All Users"
    state.filters.isNetworkOnly = false;
    const networkToggleBtns = document.querySelectorAll('.network-toggle .toggle-btn');
    networkToggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.classList.contains('right'));
    });
    
    // Reset days slider
    const minInput = document.querySelector('.min-days');
    const maxInput = document.querySelector('.max-days');
    const minLabel = document.querySelector('.min-value');
    const maxLabel = document.querySelector('.max-value');
    
    minInput.value = 1;
    maxInput.value = 14;
    minLabel.textContent = '1';
    maxLabel.textContent = '14+';
    
    state.filters.duration = { min: 1, max: 14 };
    
    // Clear trip types - Fix the selector to match the actual class
    state.filters.tripTypes = [];
    document.querySelectorAll('.trip-type-chip').forEach(chip => {
        chip.classList.remove('selected');
    });
    
    // Clear keyword search
    const keywordInput = document.getElementById('keywordSearch');
    if (keywordInput) {
        keywordInput.value = '';
    }
}

/**
 * Handles clear all button click
 */
function handleClearAll() {
    initializeDefaultState();
    //console.log('Filters cleared:', state.filters); // Debug log
}

/******************************************************************************
 * TRIP VIEW FUNCTIONS
 ******************************************************************************/

/**
 * Updates all UI elements with trip data
 */
function updateTripDisplay(tripData) {
    // Update basic trip info
    updateTripHeader(tripData);
    
    // Update tab contents
    updatePlacesTab(tripData);
    updateNotesTab(tripData);
    updateAttendeesTab(tripData);
    updatePhotosTab(tripData);
    updateMapTab(tripData);
    
    // Show/hide tabs based on content
    toggleTabVisibility('notes', !!(tripData.longDescriptionHTML || tripData.longDescription));
    toggleTabVisibility('photos', tripData.photos?.length > 0);
    toggleTabVisibility('attendees', tripData.attendeesDetail?.length > 0);
}

/**
 * Shows/hides tabs based on content availability
 */
function toggleTabVisibility(tabName, hasContent) {
    
    const tabButton = document.querySelector(`.trip-nav-item[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(tabName);
    
    if (tabButton) {
        tabButton.style.display = hasContent ? 'flex' : 'none';
    }
    if (tabContent) {
        tabContent.style.display = hasContent ? 'flex' : 'none';
    }
}

/**
 * Tab system management
 */
function initializeTabSystem() {
    const tabs = document.querySelectorAll('.trip-nav-item');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            showTab(tabName);
        });
    });
}

/**
 * Handles tab switching - shows selected tab content, hides others
 */
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.querySelectorAll('.trip-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    const selectedBtn = document.querySelector(`.trip-nav-item[data-tab="${tabName}"]`);

    if (selectedTab && selectedBtn) {
        selectedTab.style.display = 'block';
        selectedBtn.classList.add('active');
    }


    if (selectedTab) {
        selectedTab.style.display = 'block';
        
        // If this is the map tab and we have a trip loaded, ensure map is visible
        if (tabName === 'map' && state.currentTrip) {
            const mapContainer = document.getElementById('trip-map-container');
            if (mapContainer) {
                mapContainer.style.display = 'block';
                if (state.currentTripMap) {
                    setTimeout(() => {
                        state.currentTripMap.resize();
                    }, 100);
                } else {
                    // If map hasn't been initialized yet, do it now
                    updateMapTab(state.currentTrip);
                }
            }
        }
    }
}

/**
 * Initializes place category filter functionality
 */
function initializePlaceFilters() {
    const filterButtons = document.querySelectorAll('.places-filters .filter-btn');
    const placesGrid = document.querySelector('.places-grid');
    const placesTable = document.querySelector('.places-table');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Get selected category
            const category = button.dataset.category;

            // Filter both grid and table views
            filterPlaces(category);
        });
    });
}

function filterPlaces(category) {
    const cardElements = document.querySelectorAll('.places-grid .place-card');
    const tableElements = document.querySelectorAll('.places-table .place-row');
    
    // Get the selected category from the filter menu
    const selectedOption = document.querySelector('.places-filter-option.selected');
    const selectedText = selectedOption ? selectedOption.querySelector('span').textContent : 'All';
    
    // Map the filter text to category values
    const categoryMap = {
        'All': 'all',
        'To Stay': 'toStay',
        'To Eat/Drink': 'toEat',
        'To Do': 'toDo'
    };
    
    const filterCategory = categoryMap[selectedText] || 'all';

    // Filter card view
    cardElements.forEach(card => {
        const placeCategory = card.dataset.category;
        card.closest('.place-button').style.display = 
            (filterCategory === 'all' || placeCategory === filterCategory) ? 'block' : 'none';
    });

    // Filter table view
    tableElements.forEach(row => {
        const placeCategory = row.dataset.category;
        row.style.display = 
            (filterCategory === 'all' || placeCategory === filterCategory) ? 'grid' : 'none';
    });
}


/**
 * Updates the trip header section with basic trip information
 */
function updateTripHeader(tripData) {
    document.querySelector('.trip-header').style.backgroundImage = `url(${tripData.tripCoverPic || DEFAULTS.defaultTripCoverPic})`;
    document.getElementById('tripTitle').textContent = tripData.title;
    document.getElementById('tripCreator').textContent = tripData.creatorName;
    document.getElementById('tripMonth').textContent = tripData.month;
    document.getElementById('tripYear').textContent = tripData.year;
    document.getElementById('tripShortDescription').textContent = tripData.shortDescription || '';
    document.getElementById('tripDuration').textContent = `${tripData.days} day${parseInt(tripData.days) !== 1 ? 's' : ''}`;
    document.getElementById('tripPeople').textContent = `${tripData.numPeople} ${parseInt(tripData.numPeople) === 1 ? 'person' : 'people'}`;
    
    // Display trip type using your configuration
    const tripType = TRIP_TYPES.find(type => type.value === parseInt(tripData.familyType)) || TRIP_TYPES[0];
    document.getElementById('tripType').textContent = tripType.label;
}

/**
 * Updates the places tab content
 */
function updatePlacesTab(tripData) {    
    if (tripData.placesDetail && tripData.placesDetail.length > 0) {
        // Calculate counts for each category
        const counts = {
            all: tripData.placesDetail.length,
            toStay: tripData.placesDetail.filter(place => 
                PLACE_TYPES.find(type => type.value === place.type)?.category === 'toStay'
            ).length,
            toEat: tripData.placesDetail.filter(place => 
                PLACE_TYPES.find(type => type.value === place.type)?.category === 'toEat'
            ).length,
            toDo: tripData.placesDetail.filter(place => 
                PLACE_TYPES.find(type => type.value === place.type)?.category === 'toDo'
            ).length
        };

         // Update the filter menu counts
        document.querySelectorAll('.places-filter-option').forEach(option => {
            const filterType = option.querySelector('span').textContent;
            const countSpan = option.querySelector('.places-filter-count');
            switch(filterType) {
                case 'All':
                    countSpan.textContent = `(${counts.all})`;
                    break;
                case 'To Stay':
                    countSpan.textContent = `(${counts.toStay})`;
                    break;
                case 'To Eat/Drink':
                    countSpan.textContent = `(${counts.toEat})`;
                    break;
                case 'To Do':
                    countSpan.textContent = `(${counts.toDo})`;
                    break;
            }
        });
        
        const placesGrid = document.querySelector('.places-grid');
        const placesTable = document.querySelector('.places-table');

        placesGrid.innerHTML = tripData.placesDetail
            .map(place => {

                const placeType = PLACE_TYPES.find(type => type.value === place.type) || PLACE_TYPES[0];
                // Check if there's feedback for this trip
                const tripFeedback = place.feedback?.find(f => f.tripId === tripData.tripId);
                const feedbackBadge = tripFeedback ? 
                    (tripFeedback.value === 2 ? 
                        '<div class="place-badge wow">Wow!!</div>' : 
                        '<div class="place-badge skip">Can Skip</div>') 
                    : '';
                
                // Filter comments for this trip
                const tripComments = (place.comments || [])
                    .filter(comment => comment.tripId === tripData.tripId);

                return `
                    <button class="place-button">
                        <div class="place-card" data-category="${placeType.category}">
                            <div class="place-image" style="background-image: url('${place.image || '/assets/PatternBackgroundColor.svg'}')">
                                <div class="place-overlay">
                                    ${feedbackBadge}
                                    <div class="place-content">
                                        <div class="place-header">
                                            <div class="place-title">${place.title}</div>
                                            <div class="place-type">
                                                <i class="${placeType.icon}"></i>
                                                ${placeType.label}
                                            </div>
                                        </div>
                                        ${place.address ? `
                                            <div class="place-address">
                                                ${place.address}
                                            </div>
                                        ` : ''}
                                        <div class="place-rating">
                                            ${place.starRating !== null && place.numReviews !== null ? `
                                                <span class="stars">★</span> ${place.starRating} · ${place.numReviews} reviews
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            ${tripComments.length > 0 ? `
                                <div class="place-comments">
                                    ${tripComments.map(comment => `
                                        <div class="comment">
                                            <div class="comment-content">
                                                <div class="comment-name">${comment.userDisplayName}</div>
                                                <div class="comment-text">${comment.msg}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </button>
                `;
        }).join('');

        // Update table view
        placesTable.innerHTML = tripData.placesDetail
            .map(place => {
                const placeType = PLACE_TYPES.find(type => type.value === place.type) || PLACE_TYPES[0];
                const tripComments = (place.comments || [])
            .filter(comment => comment.tripId === tripData.tripId);
            
            return `
                <div class="place-row" data-category="${placeType.category}">
                    <div class="place-name">
                        ${place.title}
                        ${tripComments.length > 0 ? `
                            <div class="comment-indicator">
                                <i class="fas fa-comment"></i>
                                <div class="comment-tooltip">
                                    ${tripComments.map(comment => `
                                        <div class="comment">
                                            <div class="comment-name">${comment.userDisplayName}</div>
                                            <div class="comment-text">${comment.msg}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="place-type">
                        <i class="${placeType.icon}"></i>
                        ${placeType.label}
                    </div>
                </div>
            `;
        }).join('');
        
        initializePlaceViewToggle();
        initializeFilterMenu();
    }
}

function initializePlaceViewToggle() {
    const toggleButtons = document.querySelectorAll('.places-header .view-toggle-btn');
    const placesGrid = document.querySelector('.places-grid');
    const placesTable = document.querySelector('.places-table');

    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const view = button.dataset.view;
            console.log('View toggle clicked', view);

            // Update active button
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Toggle views
            if (view === 'cards') {
                console.log('Showing cards');
                placesGrid.style.display = 'flex';
                placesTable.style.display = 'none';
            } else {
                console.log('Showing table');
                placesGrid.style.display = 'none';
                placesTable.style.display = 'block';
            }
        });
    });
}

function initializeFilterMenu() {
    const filterButton = document.querySelector('.places-filter-button');
    const filterMenu = document.querySelector('.places-filter-menu');
    const filterOptions = document.querySelectorAll('.places-filter-option');
    const selectedFilter = document.querySelector('.places-selected-filter');

    // Check if already initialized
    if (filterButton.dataset.initialized === 'true') {
        return;
    }

    // Mark as initialized
    filterButton.dataset.initialized = 'true';

    // Toggle menu
    filterButton.addEventListener('click', (e) => {
        console.log('Filter button clicked');
        e.stopPropagation();
        filterMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!filterMenu.contains(e.target) && !filterButton.contains(e.target)) {
            filterMenu.classList.remove('active');
        }
    });

    // Handle filter selection
    filterOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Update selected state
            filterOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Update selected filter display
            const icon = option.querySelector('i').className;
            const text = option.querySelector('span').textContent;
            const count = option.querySelector('.places-filter-count').textContent;

            selectedFilter.innerHTML = `
                <i class="${icon}"></i>
                <span>${text}</span>
                <span>${count}</span>
            `;

            if (text === 'All') {
                selectedFilter.style.display = 'none';
                filterButton.classList.remove('active');
            } else {
                selectedFilter.style.display = 'flex';
                filterButton.classList.add('active');
            }

            // Apply the filter
            filterPlaces();

            // Close menu
            filterMenu.classList.remove('active');
        });
    });
}

/**
 * Updates the notes tab content with formatted description
 */
function updateNotesTab(tripData) {
    //const notesContent = document.querySelector('.notes-content');
    
    const noteContent = tripData.longDescriptionHTML || tripData.longDescription || null;
    const notesContainer = document.querySelector('#notes .notes-content');
    notesContainer.innerHTML = noteContent;
    
    if (!noteContent) {
        notesContainer.innerHTML = '<p class="no-content">No detailed notes available.</p>';
        return;
    }
}

/**
 * Updates the attendees tab content
 */
function updateAttendeesTab(tripData) {
    if (tripData.attendeesDetail && tripData.attendeesDetail.length > 0) {
        const attendeesGrid = document.querySelector('.attendees-grid');
        attendeesGrid.innerHTML = tripData.attendeesDetail
            .map(attendee => `
                <button class="attendee-button" data-user-id="${attendee.id}">
                    <div class="attendee-card">
                        <img class="attendee-photo" 
                             src="${attendee.pPic || '/assets/default-profile.png'}" 
                             alt="${attendee.displayName}"
                             onerror="this.src='/assets/default-profile.png'">
                        <div class="attendee-info">
                            <div class="attendee-name">${attendee.displayName}</div>
                            ${attendee.location ? 
                                `<div class="attendee-location">${attendee.location}</div>` 
                                : ''}
                            ${attendee.id === tripData.creatorId ? 
                                `<div class="attendee-role trip-creator-badge">Trip Creator</div>` 
                                : ''}
                            ${attendee.travelAdvisor ? 
                                `<div class="attendee-role travel-advisor-badge">
                                    Travel Advisor
                                </div>` 
                                : ''}
                        </div>
                        <div class="trips-count">
                            <i class="fas fa-compass"></i>
                            ${(attendee.trips || []).length}
                        </div>
                    </div>
                </button>
            `).join('');
        
        // Add click handlers to all attendee buttons
        document.querySelectorAll('.attendee-button').forEach(button => {
            button.addEventListener('click', async () => {
                const userId = button.dataset.userId;
                await loadUserData(userId);
            });
        });
    } 
}

/**
 * Updates the photos tab content
 */
function updatePhotosTab(tripData) {
    if (tripData.photos && tripData.photos.length > 0) {
        const photosGrid = document.querySelector('.photos-grid');
                // Initialize lightbox
        const { showPhoto } = initializeLightbox(tripData.photos);
        
        // Create photo grid with click handlers
        photosGrid.innerHTML = tripData.photos
            .map((photo, index) => `
                <div class="photo-item">
                    <img src="${photo.uri}" 
                         alt="Trip photo" 
                         loading="lazy"
                         onclick="document.getElementById('lightbox').classList.add('active'); 
                                 document.body.style.overflow='hidden';">
                </div>
            `).join('');

        // Add click handlers to photos
        photosGrid.querySelectorAll('.photo-item').forEach((item, index) => {
            item.addEventListener('click', () => showPhoto(index));
        });
    } 
}

/**
 * Updates the map tab content
 */
function updateMapTab(tripData) {
    if (tripData.placesDetail && tripData.placesDetail.length > 0) {
        //console.log('🗺️ Initializing Trip map');
        
        // Clear any existing map
        if (state.currentTripMap) {
            state.currentTripMap.remove();
            state.currentTripMap = null;
        }
        
        // Make sure we're using the correct container
        const mapContainer = document.getElementById('trip-map-container');
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }
        
        // Ensure container is visible and has height
        mapContainer.style.display = 'block';
        mapContainer.style.height = '400px';
        
        // Initialize new map
        state.currentTripMap = new maplibregl.Map({
            container: 'trip-map-container',
            style: {
                'version': 8,
                'sources': {
                    'osm': {
                        'type': 'raster',
                        'tiles': [
                            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        ],
                        'tileSize': 256,
                        'attribution': '&copy; OpenStreetMap Contributors'
                    }
                },
                'layers': [{
                    'id': 'osm',
                    'type': 'raster',
                    'source': 'osm',
                    'minzoom': 0,
                    'maxzoom': 19
                }]
            }
        });

        // Force resize after map is loaded
        state.currentTripMap.on('load', () => {
            state.currentTripMap.resize();
            
            // Create bounds to fit all markers
            const bounds = new maplibregl.LngLatBounds();
            
            // Add markers for each place
            tripData.placesDetail.forEach(place => {
                if (place.coordinates && place.coordinates.longitude && place.coordinates.latitude) {
                    const el = document.createElement('div');
                    el.className = 'marker';
                    
                    // Get the place type icon/label
                    const placeType = PLACE_TYPES.find(t => t.value === place.type) || PLACE_TYPES[0];
                    
                    el.innerHTML = `
                        <div class="marker-circle">
                            <i class="${placeType.icon}"></i>
                        </div>
                    `;

                    // Create the marker
                    new maplibregl.Marker({
                        element: el,
                        anchor: 'center'
                    })
                    .setLngLat([place.coordinates.longitude, place.coordinates.latitude])
                    .setPopup(
                        new maplibregl.Popup({ offset: 25 })
                            .setHTML(`
                                <div class="map-popup" style="background-image: url('${place.image || '/assets/PatternBackgroundColor.svg'}')">
                                    <div class="map-popup-overlay">
                                        <h2>${place.title}</h2>
                                        <div class="map-popup-type">
                                            <i class="${placeType.icon}"></i>
                                            ${placeType.label}
                                        </div>
                                        ${place.address ? `
                                            <div class="map-popup-address">
                                                ${place.address}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `)
                    )
                    .addTo(state.currentTripMap);

                    // Extend bounds to include this marker
                    bounds.extend([place.coordinates.longitude, place.coordinates.latitude]);
                }
            });

            // Fit map to bounds
            state.currentTripMap.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                maxZoom: 8
            });
        });
    }
}

function initializeLightbox(photos) {
    let currentPhotoIndex = 0;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox.querySelector('img');
    
    // Close lightbox
    const closeLightbox = () => {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';  // Re-enable scrolling
    };

    // Show specific photo
    const showPhoto = (index) => {
        currentPhotoIndex = index;
        lightboxImg.src = photos[index].uri;
    };

    // Navigate photos
    const navigate = (direction) => {
        currentPhotoIndex = (currentPhotoIndex + direction + photos.length) % photos.length;
        showPhoto(currentPhotoIndex);
    };

    // Event listeners
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.prev').addEventListener('click', () => navigate(-1));
    lightbox.querySelector('.next').addEventListener('click', () => navigate(1));

    // Close on background click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        
        switch(e.key) {
            case 'Escape': closeLightbox(); break;
            case 'ArrowLeft': navigate(-1); break;
            case 'ArrowRight': navigate(1); break;
        }
    });

    return { showPhoto, closeLightbox };
}

function initializeFilters() {
    const filterBtn = document.getElementById('tripFilterBtn');
    const filterMenu = document.getElementById('filterMenu');
    

    if (!filterBtn || !filterMenu) return;

    //console.log('Initialize filters called');

    // Toggle filter menu
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterMenu.classList.toggle('show');
        console.log('Showing filter menu');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
            filterMenu.classList.remove('show');
        }
    });

    // Handle checkbox changes
    document.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateFilterState();
        });
    });

    // Handle duration slider
    const durationSlider = document.getElementById('durationSlider');
    
    const minSlider = document.getElementById('minDurationSlider');
    const maxSlider = document.getElementById('maxDurationSlider');
    const currentDuration = document.querySelector('.current-duration');
    
    minSlider.addEventListener('input', (e) => {
        if (parseInt(minSlider.value) > parseInt(maxSlider.value)) {
            minSlider.value = maxSlider.value;
        }
        updateDurationText();
    });

    maxSlider.addEventListener('input', (e) => {
        if (parseInt(maxSlider.value) < parseInt(minSlider.value)) {
            maxSlider.value = minSlider.value;
        }
        updateDurationText();
    });

    function updateDurationText() {
        currentDuration.textContent = `Currently: ${minSlider.value}-${maxSlider.value} days`;
    }

    // Handle apply button
    document.querySelector('.filter-apply-btn').addEventListener('click', () => {
        applyFilters();
        filterMenu.classList.remove('show');
    });

    // Handle clear button in menu
    document.querySelector('.filter-clear-btn').addEventListener('click', () => {
        clearFilters();
        filterMenu.classList.remove('show');
    });

    // Add event delegation for chips and clear all button
    document.querySelector('.active-filters').addEventListener('click', (e) => {
        // Handle remove chip button clicks
        if (e.target.classList.contains('remove-chip')) {
            const chip = e.target.closest('.filter-chip');
            if (chip) {
                removeFilter(chip);
            }
        }
        
        // Handle clear all button clicks
        if (e.target.classList.contains('clear-filters-chip')) {
            clearFilters();
        }
    });
}

function updateFilterState() {
    // Get all checked trip type checkboxes and convert values to integers
    const checkedTypes = document.querySelectorAll('.filter-checkbox input:checked');
    state.filters.tripTypes = Array.from(checkedTypes).map(cb => parseInt(cb.value));
    
    // Update duration
    const minSlider = document.getElementById('minDurationSlider');
    const maxSlider = document.getElementById('maxDurationSlider');
    
    if (minSlider && maxSlider) {
        const isAtInitialValues = 
            minSlider.value === minSlider.min && 
            maxSlider.value === maxSlider.max;

        state.filters.duration = isAtInitialValues ? 
            { min: null, max: null } : 
            { min: parseInt(minSlider.value), max: parseInt(maxSlider.value) };
    }
}

function applyFilters() {
    updateFilterState();
    
    const filteredTrips = state.currentUserTrips.filter(trip => {
        const typeMatch = state.filters.tripTypes.length === 0 || 
                         state.filters.tripTypes.includes(parseInt(trip.familyType));
        
        const tripDays = parseInt(trip.days);
        // Only apply duration filter if both min and max are set
        const durationMatch = 
            (state.filters.duration.min === null && state.filters.duration.max === null) ||
            (tripDays >= state.filters.duration.min && tripDays <= state.filters.duration.max);
        
        return typeMatch && durationMatch;
    });

    updateFilterUI();
    updateTripsList(filteredTrips);
}

function updateFilterUI() {
    const activeFilters = document.getElementById('activeFilters');
    const chipsList = document.querySelector('.filter-chips');
    
    // Create chips HTML
    const chips = [];
    
    // Add trip type chips
    if (state.filters.tripTypes.length > 0) {
        state.filters.tripTypes.forEach(typeValue => {
            const tripType = TRIP_TYPES.find(t => t.value === typeValue);
            if (tripType) {
                chips.push(`
                    <span class="filter-chip" data-type="tripType" data-value="${typeValue}">
                        <i class="${tripType.icon}"></i> ${tripType.label}
                        <button class="remove-chip">×</button>
                    </span>
                `);
            }
        });
    }

    // Add duration chip
    if (state.filters.duration.min !== null && state.filters.duration.max !== null) {
        const minSlider = document.getElementById('minDurationSlider');
        const maxSlider = document.getElementById('maxDurationSlider');
        const isAtInitialValues = 
            minSlider.value === minSlider.min && 
            maxSlider.value === maxSlider.max;

        if (!isAtInitialValues) {
            chips.push(`
                <span class="filter-chip" data-type="duration">
                    ${state.filters.duration.min}-${state.filters.duration.max} days
                    <button class="remove-chip">×</button>
                </span>
            `);
        }
    }

    // Add clear all chip if there are filters
    if (chips.length > 0) {
        chips.push(`<button class="clear-filters-chip">Clear All</button>`);
    }

    // Update UI
    chipsList.innerHTML = chips.join('');
    activeFilters.style.display = chips.length ? 'block' : 'none';
    
}

function removeFilter(chip) {
    if (chip.dataset.type === 'tripType') {
        const checkbox = document.querySelector(`.filter-checkbox input[value="${chip.dataset.value}"]`);
        if (checkbox) checkbox.checked = false;
    } else if (chip.dataset.type === 'duration') {
        const minSlider = document.getElementById('minDurationSlider');
        const maxSlider = document.getElementById('maxDurationSlider');
        if (minSlider && maxSlider) {
            // Reset sliders to their min/max values
            minSlider.value = minSlider.min;
            maxSlider.value = maxSlider.max;
            document.querySelector('.current-duration').textContent = 
                `Currently: ${minSlider.min}-${maxSlider.max} days`;
            
            // Reset duration in state
            state.filters.duration = {
                min: null,
                max: null
            };
        }
    }
    
    // Update state and reapply filters
    updateFilterState();
    applyFilters();
}

function clearFilters() {
    // Reset checkboxes
    document.querySelectorAll('.filter-checkbox input').forEach(cb => cb.checked = false);
    
    // Reset both sliders
    const minSlider = document.getElementById('minDurationSlider');
    const maxSlider = document.getElementById('maxDurationSlider');
    if (minSlider && maxSlider) {
        minSlider.value = minSlider.min;
        maxSlider.value = maxSlider.max;
        document.querySelector('.current-duration').textContent = 
            `Currently: ${minSlider.min}-${maxSlider.max} days`;
    }
    
    // Clear state
    state.filters = {
        tripTypes: [],
        duration: {
            min: null,
            max: null
        }
    };
    
    // Update UI and refilter trips
    updateFilterUI();
    updateTripsList(state.currentUserTrips); // Reset to show all trips
}

function updateTripsList(filteredTrips) {
    const tripsList = document.querySelector('.trips-list');
    tripsList.innerHTML = filteredTrips.map(trip => generateTripHTML(trip)).join('');
    
    // Reattach click handlers
    document.querySelectorAll('.trip-item').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            showFeatureLockedModal();
        });
    });
}


/**
 * Main function to load and display a trip
 */
async function displayTripPreview(tripData) {
    try {

        updateTripDisplay(tripData);
        
        // 4. Initialize interactions
        initializeTabSystem();
        initializePlaceFilters();
        
        // 5. Show default tab
        showTab('places');
        
    } catch (error) {
        console.error('Error loading trip:', error);
        displayErrorMessage('Failed to load trip details');
    } finally {
        toggleLoadingState(false);
    }
}

function displayUserPreview(userData) {

    const userTripsDetail = userData.tripsDetail;

    if (!userData) return;

    // Get unique trip types from user's trips
    const availableTripTypes = [...new Set(userTripsDetail.map(trip => parseInt(trip.familyType)))]
        .map(typeValue => TRIP_TYPES.find(type => type.value === typeValue))
        .filter(type => type); // Remove any undefined values


    const minDays = Math.min(...userTripsDetail.map(trip => parseInt(trip.days)));
    const maxDays = Math.max(...userTripsDetail.map(trip => parseInt(trip.days)));
    
    // Create the creator profile HTML
    const creatorProfile = `
    <div class="creator-card">
        <div class="creator-header" style="background-image: url('${userData.bPic || DEFAULTS.defaultBPic}')">
            <div class="creator-profile-pic">
                <img src="${userData.pPic || DEFAULTS.defaultPPic}" alt="">
            </div>
        </div>
        <div class="creator-info">
            <div class="creator-stats">
                <div class="stat-item" data-stat="trips">
                    <div class="stat-value">${userData.trips?.length || 0}</div>
                    <div class="stat-label">Trips</div>
                </div>
                <div class="stat-item" data-stat="friends">
                    <div class="stat-value">${userData.friends?.length || 0}</div>
                    <div class="stat-label">Following</div>
                </div>
                <div class="stat-item" data-stat="followedBy">
                    <div class="stat-value">${userData.followedBy?.length || 0}</div>
                    <div class="stat-label">Followed By</div>
                </div>
            </div>
            <div class="creator-details-container">
                <div class="creator-details">
                    <div class="creator-name">
                        ${userData.displayName || 'XXX'}
                    </div>
                    <div class="creator-location">${userData.location || ''}</div>
                    <div class="creator-joined">Joined ${new Date(userData.dateJoined._seconds * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                </div>
            </div>
        </div>

        <div class="creator-trips">
            ${!Array.isArray(userData.trips) || userData.trips.length === 0 ? `
                <div class="empty-state" style="text-align: center; font-style: italic; font-size: 14px; padding: 20px;">
                    <p style="margin: 0;">No trips created yet</p>
                </div>
            ` : `
                <div class="trips-filter-bar">
                    <button class="filter-toggle-btn" id="tripFilterBtn">
                        <i class="fas fa-filter"></i>
                        Filter
                    </button>
                    
                    <div class="active-filters" id="activeFilters" style="display: none">
                        <div class="filter-chips">
                            <!-- Filter chips will be inserted here -->
                        </div>
                    </div>

                    <div class="filter-menu" id="filterMenu">
                        ${availableTripTypes.length > 0 ? `
                            <div class="user-filter-section">
                                <h3>Trip Types</h3>
                                <div class="filter-options">
                                    ${availableTripTypes.map(type => `
                                        <label class="filter-checkbox">
                                            <input type="checkbox" value="${type.value}">
                                            <i class="${type.icon}"></i>
                                            ${type.label}
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="user-filter-section">
                            <h3>Duration</h3>
                            <div class="duration-slider">
                                <div class="slider-inputs">
                                    <input type="range" 
                                        min="${minDays}" 
                                        max="${maxDays}" 
                                        value="${minDays}" 
                                        class="slider" 
                                        id="minDurationSlider">
                                    <input type="range" 
                                        min="${minDays}" 
                                        max="${maxDays}" 
                                        value="${maxDays}" 
                                        class="slider" 
                                        id="maxDurationSlider">
                                </div>
                                <div class="slider-labels">
                                    <span>${minDays} days</span>
                                    <span>${maxDays} days</span>
                                </div>
                                <div class="current-duration">Currently: ${minDays}-${maxDays} days</div>
                            </div>
                        </div>

                        <div class="filter-actions">
                            <button class="filter-apply-btn">Apply</button>
                            <button class="filter-clear-btn">Clear</button>
                        </div>
                    </div>
                </div>
                <div class="trips-list">
                    ${userTripsDetail.map(trip => generateTripHTML(trip)).join('')}
                </div>
            `}
        </div>
    </div>
    `;

    document.querySelector('.creator-profile').innerHTML = creatorProfile;

    // Initialize filters after rendering
    initializeFilters();
}

function showFeatureLockedModal() {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');
    localStorage.setItem('redirectTripId', tripId);
    localStorage.setItem('redirectInvite', params.get('invite') === 'true');
    
    const existingModal = document.querySelector('.signup-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHtml = `
        <div class="signup-modal">
            <div class="signup-modal-content">
                <div class="signup-modal-nav">
                    <button class="signup-close-btn">&times;</button>
                </div>
                
                <div class="signup-header-container">
                    <img src="/assets/Butterfly2.png" alt="Cipher" class="signup-butterfly-icon">
                    <div class="signup-modal-header">
                        <h2>Join Cipher</h2>
                        <p>Create an account to access this feature.</p>
                    </div>
                </div>

                <div class="auth-buttons">
                    <button class="auth-btn login">
                        Login
                    </button>
                    <button class="auth-btn signup">
                        Sign Up
                    </button>
                    <div class="divider">
                        <span>or</span>
                    </div>
                    <button class="auth-btn apple">
                        <i class="fab fa-apple"></i>
                        Continue with Apple
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);


    const modal = document.querySelector('.signup-modal');
    const closeBtn = modal.querySelector('.signup-close-btn');
    const loginBtn = modal.querySelector('.auth-btn.login');
    const signupBtn = modal.querySelector('.auth-btn.signup');
    const appleBtn = modal.querySelector('.auth-btn.apple');

    // Close button handler
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Auth button handlers
    loginBtn.addEventListener('click', () => {
        modal.remove();
        showAuthModal('login');
    });

    signupBtn.addEventListener('click', () => {
        modal.remove();
        showAuthModal('signup');
    });

    appleBtn.addEventListener('click', () => {
        modal.remove();
        window.handleAppleSignIn();
    });
}

function attachFeatureLockedHandlers() {
    
    // trip items
    document.querySelectorAll('.trip-item').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            showFeatureLockedModal();
        });
    });
    
    // Stats items
    document.querySelectorAll('.stat-item').forEach(stat => {
        stat.style.cursor = 'pointer';
        stat.addEventListener('click', (e) => {
            e.preventDefault();
            showFeatureLockedModal();
        });
    });

    // Quick links
    document.querySelectorAll('.quick-link-btn, .quick-link-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showFeatureLockedModal();
        });
    });

    // Search Criteria Button
    document.querySelectorAll('.search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            showFeatureLockedModal();
        });
    });
    

    // Attendee cards
    document.querySelectorAll('.attendee-button').forEach(attendee => {
        attendee.style.cursor = 'pointer';
        attendee.addEventListener('click', (e) => {
            e.preventDefault();
            showFeatureLockedModal();
        });
    });
}
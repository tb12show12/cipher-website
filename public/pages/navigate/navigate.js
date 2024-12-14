/******************************************************************************
 * IMPORTS AND CONSTANTS
 ******************************************************************************/
import { TRIP_TYPES, DEFAULTS, PLACE_TYPES } from '/admin/config.js';
import SignupModal from '/components/signup/signup.js'; 

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
        const user = await window.firebaseAuthReady;
        if (!user) {
            window.location.href = '/';
            return;
        }

        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();

        if (!userDoc.exists) {
            console.log('🚀 New user detected, showing signup modal...');
            const modal = new SignupModal();
            modal.showUserInfoStep(user);
            return;
        }

        state.currentUser = user;
        await Promise.all([
            initializeUserProfile(),
            initializeUserConnections(),
            initializeTripTypes()
        ]);
        
        initializeDefaultState();
        initializeEventListeners();
        handleInitialView();
        
    } catch (error) {
        console.error('Initialization error:', error);
        displayErrorMessage('Failed to initialize application');
    }
});

/**
 * Determines initial view based on URL parameters
 */
function handleInitialView() {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');

    if (tripId) {
        // Load specific trip
        loadTrip(tripId);
        switchToTripView();
    } else {
        // Show Recent Activity as default view
        switchToSearchView();
        handleRecentActivity();
    }
}

/**
 * Sets up all event listeners for the page
 */
function initializeEventListeners() {
    
    // Add the new custom event listener here
    document.addEventListener('loadNavigatePage', async (e) => {
        const { userId, tripId } = e.detail;
        if (userId) await loadUserData(userId);
        if (tripId) {
            await loadTrip(tripId);
            switchToTripView();
        }

        // just load Discover / Recent Activity
        if (!userId && !tripId) {
            switchToSearchView();
            handleRecentActivity();
        }
    });
    
    // Search and Filter Controls
    document.querySelector('.network-toggle').addEventListener('click', handleNetworkToggle);
    
    // Update these to only store values without searching
    document.getElementById('keywordSearch').addEventListener('input', 
        debounce(updateKeywordState, 300));
    document.querySelector('.days-slider').addEventListener('input', 
        debounce(updateDaysState, 300));
    
    document.getElementById('tripTypesGrid').addEventListener('click', handleTripTypeSelect);

    // View Controls
    document.querySelector('.view-toggle').addEventListener('click', handleViewToggle);
    document.getElementById('recentActivityButton').addEventListener('click', handleRecentActivity);
    document.getElementById('showMyProfileButton').addEventListener('click', handleShowMyProfile);
    
    // URL History Management
    window.addEventListener('popstate', handleNavigationChange);

    // Search button triggers the actual search
    document.querySelector('.search-btn').addEventListener('click', () => {
        performSearch(document.getElementById('keywordSearch').value);
    });

    // Add this to your existing event listeners setup
    document.getElementById('searchCipherButton').addEventListener('click', handleSearchCipher);

    // Add clear all button listener
    document.querySelector('.clear-btn').addEventListener('click', handleClearAll);
}

/**
 * Handles search Cipher button click
 */
async function handleSearchCipher() {
    console.log('🎯 Search Cipher button clicked');
    
    // Clear all filters
    handleClearAll();
    switchToSearchView();
    
    // Show search context, hide trip context
    document.querySelector('.search-context').style.display = 'block';
    document.querySelector('.trip-context').style.display = 'none';
    
    // Clear selected trip if any
    const selectedTripContainer = document.querySelector('.selected-trip-container');
    if (selectedTripContainer) {
        selectedTripContainer.style.display = 'none';
    }

    const summaryEl = document.querySelector('.search-filters-summary');
    if (summaryEl) {
        summaryEl.remove();
    }

     // Update search results header
     const header = document.querySelector('.search-results-header h2');
     if (header) {
         header.textContent = 'SEARCH CIPHER';
     }
     
     // Add empty state message
     const listView = document.querySelector('.results-content .list-view');
     if (listView) {
         listView.innerHTML = `
             <div class="empty-search-state">
                 <img src="/assets/Butterfly2.png" alt="Cipher" class="empty-state-logo">
                 <h2>Get Started Now</h2>
                 <p>Choose filters from the right to begin your search</p>
             </div>
         `;
     }
    
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

function switchToSearchView() {
    document.querySelector('.search-results-view').style.display = 'block';
    document.querySelector('.trip-details-view').style.display = 'none';
    document.querySelector('.search-context').style.display = 'block';
    document.querySelector('.trip-context').style.display = 'none';
}

/******************************************************************************
 * PROFILE MANAGEMENT
 ******************************************************************************/

/**
 * Loads and displays the user's profile and trips
 */
async function initializeUserProfile() {
    try {
        await loadUserData(state.currentUser.uid);
    } catch (error) {
        console.error('Profile initialization error:', error);
        displayErrorMessage('Failed to load user profile');
    }
}

/**
 * Loads user's network connections
 */
async function initializeUserConnections() {
    try {
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(state.currentUser.uid)
            .get();

        const userData = userDoc.data();

        // If no user document exists, set empty state
        if (!userDoc.exists) {
            console.log('No user document found, initializing empty connections');
            state.userConnections = new Set([]);
            return;
        }
        
        // Combine all connections
        const connections = new Set([
            ...(userData.friends || []),
            ...(userData.tripConnections1 || []),
            ...(userData.tripConnections2 || [])
        ]);

        state.userConnections = connections;
        
    } catch (error) {
        console.error('Connection loading error:', error);
    }
}


/******************************************************************************
 * SEARCH AND RESULTS MANAGEMENT
 ******************************************************************************/

/**
 * Updates the search results header
 */
function updateSearchHeader(title, resultCount) {
    const header = document.querySelector('.search-results-header h2');
    if (header) {
        header.textContent = `${title} (${resultCount})`;
    }
}

/**
 * Displays summary of active search filters
 */
function displaySearchFiltersSummary(keyword) {
    let summaryParts = [];
    
    // Add keyword if present
    if (keyword) {
        summaryParts.push(`"${keyword}"`);
    }

    // Add network filter
    if (state.filters.isNetworkOnly) {
        summaryParts.push('My Network');
    } else {
        summaryParts.push('All Users');
    }
    
    // Add trip types if selected
    if (state.filters.tripTypes.length > 0) {
        const tripTypeLabels = state.filters.tripTypes.map(type => {
            const tripType = TRIP_TYPES.find(t => t.value === parseInt(type));
            return tripType ? tripType.label : type;
        });
        summaryParts.push(`${tripTypeLabels.join(', ')}`);
    } else {
        summaryParts.push('All Trip Types');
    }
    
    // Add days filter if set and not default range
    const { min, max } = state.filters.duration;
    if (min === 1 && max === 14) {
        summaryParts.push('All Lengths');
    } else {
        let daysText = '';
        if (max === 14) {
            daysText = `${min}+ days`;
        } else if (min === max) {
            daysText = `${min} days`;
        } else {
            daysText = `${min}-${max} days`;
        }
        summaryParts.push(daysText);
    }
        
    // Create or update the summary element
    let summaryEl = document.querySelector('.search-filters-summary');
    if (!summaryEl) {
        summaryEl = document.createElement('div');
        summaryEl.className = 'search-filters-summary';
        const headerEl = document.querySelector('.search-results-header');
        headerEl.insertAdjacentElement('afterend', summaryEl);
    }
    
    summaryEl.textContent = summaryParts.length > 0 
        ? `Searching: ${summaryParts.join(' • ')}` 
        : '';
}

/**
 * Performs search with current filters
 */
async function performSearch(keyword = '') {
    try {
        toggleLoadingState(true);

        // Hide selected trip container
        const selectedTripContainer = document.querySelector('.selected-trip-container');
        if (selectedTripContainer) {
            selectedTripContainer.style.display = 'none';
        }

        // Deactivate recent activity button
        const recentActivityBtn = document.getElementById('recentActivityButton');
        if (recentActivityBtn) {
            recentActivityBtn.classList.remove('active');
        }
        state.recentActivity.isViewing = false;
        
        const filters = buildSearchFilters();
        console.log('🔍 Final filter string:', filters); // Debug log
        
        const { hits } = await tripIndex.search(keyword, {
            filters: filters,
            hitsPerPage: 20
        });

        // Filter results by days
        const filteredHits = filterByDays(hits);

        // Update header and show filters summary
        updateSearchHeader('SEARCH RESULTS', filteredHits.length);
        displaySearchFiltersSummary(keyword);
        
        // Display results
        displaySearchResults(filteredHits);
        
    } catch (error) {
        console.error('Search error:', error);
        displayErrorMessage('Search failed');
    } finally {
        toggleLoadingState(false);
    }
}

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
 * Handles show my profile button click
 */
async function handleShowMyProfile() {
    console.log('🎯 Show My Profile button clicked');
    try {
        const authUserId = firebase.auth().currentUser.uid;
        await loadUserData(authUserId);
    } catch (error) {
        console.error('Profile initialization error:', error);
        displayErrorMessage('Failed to load user profile');
    }
}

/**
 * Handles recent activity button click
 */
async function handleRecentActivity() {
    console.log('🎯 Recent Activity button clicked');
    
    // Clear all filters
    initializeDefaultState();
    
    // Remove search filters summary if it exists
    const summaryEl = document.querySelector('.search-filters-summary');
    if (summaryEl) {
        summaryEl.remove();
    }

    // Hide selected trip container
    const selectedTripContainer = document.querySelector('.selected-trip-container');
    if (selectedTripContainer) {
        selectedTripContainer.style.display = 'none';
    }
    
    // Set recent activity state
    state.recentActivity.isViewing = true;
    
    // Update UI and display recent activity
    await displayRecentActivity();
}

/**
 * Loads and displays recent activity
 */
async function displayRecentActivity() {
    try {
        toggleLoadingState(true);
        
        // Update UI state
        const recentActivityBtn = document.getElementById('recentActivityButton');
        recentActivityBtn?.classList.add('active');
        
        // Show correct views
        document.querySelector('.search-results-view').style.display = 'block';
        document.querySelector('.trip-details-view').style.display = 'none';
        document.querySelector('.search-context').style.display = 'block';
        document.querySelector('.trip-context').style.display = 'none';

        // Use cache if valid
        if (isCacheValid()) {
            updateSearchHeader('RECENT ACTIVITY', state.recentActivity.cache.length);
            displaySearchResults(state.recentActivity.cache);
            return;
        }

        // Load fresh data
        const [featuredResults, networkResults] = await Promise.all([
            loadFeaturedTrips(),
            loadNetworkTrips()
        ]);

        const combinedResults = combineAndSortResults(featuredResults, networkResults);
        updateRecentActivityCache(combinedResults);
        
        // Update header and display results
        updateSearchHeader('RECENT ACTIVITY', combinedResults.length);
        displaySearchResults(combinedResults);
        
    } catch (error) {
        console.error('Recent activity error:', error);
        displayErrorMessage('Failed to load recent activity');
    } finally {
        toggleLoadingState(false);
    }
}

/**
 * Builds Algolia filters based on current state
 */
function buildSearchFilters() {
    let combinedFilters = [];

    // Add trip type filters
    if (state.filters.tripTypes.length > 0) {
        const familyTypeFS = state.filters.tripTypes.map(type => `familyType:${type}`).join(' OR ');
        combinedFilters.push(`(${familyTypeFS})`);
    }

    // Add network filter if "My Network" is selected
    if (state.filters.isNetworkOnly && state.userConnections.size > 0) {
        const friendFS = Array.from(state.userConnections)
            .map(id => `attendees:${id}`)
            .join(' OR ');
        combinedFilters.push(`(${friendFS})`);
    }

    // Return the combined filter string
    return combinedFilters.length > 0 ? combinedFilters.join(' AND ') : '';
}

/**
 * Filters results by days if duration filter is set
 */
function filterByDays(hits) {
    const { min, max } = state.filters.duration;
    if (!min && !max) return hits;
    
    return hits.filter(hit => {
        const tripDays = parseInt(hit.days);
        if (max === 14) {
            return tripDays >= min;
        } else {
            return tripDays >= min && tripDays <= max;
        }
    });
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
 * Displays search results in both list and map views
 */
function displaySearchResults(results) {
    console.log('📊 Displaying search results:', results.length);
    
    // Get view containers
    const listView = document.querySelector('.results-content .list-view');
    const mapView = document.querySelector('.results-content .map-view');
    
    if (!listView || !mapView) {
        console.error('❌ Could not find view elements');
        return;
    }

    // Update list view
    if (results.length === 0) {
        listView.innerHTML = '<div class="no-results">No trips found</div>';
    } else {
        listView.innerHTML = results.map(trip => generateTripHTML(trip)).join('');
    }

    // Add click handlers to trip items
    attachTripItemHandlers();

    // Reset and update map
    if (state.currentDiscoverMap) {
        state.currentDiscoverMap.remove();
        state.currentDiscoverMap = null;
    }

    initializeDiscoverMap(results);

    // Update header count if it's recent activity
    if (state.recentActivity.isViewing) {
        const header = document.querySelector('.search-results-header h2');
        if (header) {
            header.textContent = `RECENT ACTIVITY (${results.length})`;
        }
    }
}

/**
 * Generates HTML for a trip card
 */
function generateTripHTML(trip) {

    return `
        <div class="trip-item" data-trip-id="${trip.tripId}">
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
        </div>
    `;
}

/******************************************************************************
 * TRIP DETAILS MANAGEMENT
 ******************************************************************************/

/**
 * Initializes the comment form functionality
 */
function initializeCommentForm() {
    const commentInput = document.getElementById('newCommentText');
    const submitButton = document.getElementById('submitComment');

    // Auto-grow textarea function
    function autoGrow(element) {
        element.style.height = 'auto';
        element.style.height = (element.scrollHeight) + 'px';
    }

    // Handle input changes
    commentInput?.addEventListener('input', () => {
        submitButton.disabled = !commentInput.value.trim();
        autoGrow(commentInput);
    });

    // Handle comment submission
    submitButton?.addEventListener('click', async () => {
        const content = commentInput.value.trim();
        if (!content) return;

        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                displayErrorMessage('Please sign in to comment');
                return;
            }

            const now = new Date();
            const formattedDate = now.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            }) + ' at ' + now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            const comment = {
                msg: content,
                userId: user.uid,
                date: formattedDate
            };

            await firebase.firestore()
                .collection('trips')
                .doc(state.currentTrip.id)
                .update({
                    commentsHistory: firebase.firestore.FieldValue.arrayUnion(comment)
                });

            // Update local state
            if (!state.currentTrip.commentsHistory) {
                state.currentTrip.commentsHistory = [];
            }
            state.currentTrip.commentsHistory.push(comment);

            // Reload comments
            await loadComments();
            
            // Clear input
            commentInput.value = '';
            submitButton.disabled = true;
            commentInput.style.height = 'auto';

        } catch (error) {
            console.error('Error posting comment:', error);
            displayErrorMessage('Failed to post comment');
        }
    });

    // Reset height on initial load
    if (commentInput) {
        autoGrow(commentInput);
    }
}

/**
 * Helper function to format dates
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/******************************************************************************
 * UI UTILITIES
 ******************************************************************************/
/**
 * Toggles between map and list views
 */
function handleViewToggle(event) {
    console.log('🎯 View toggle clicked:', event.target);
    
    // Only handle clicks on buttons or their icons
    const button = event.target.closest('.view-toggle-btn');
    if (!button) return;
    
    // Update button states
    const viewToggle = document.querySelector('.view-toggle');
    viewToggle.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Toggle views based on which button was clicked
    const showMap = button.classList.contains('right');
    console.log('🗺️ Show map:', showMap);
    
    toggleMapView(showMap);
}

/**
 * Updates URL parameters without page reload
 * @param {Object} params - URL parameters to update
 * @param {string} [params.tripId] - Trip ID
 * @param {string} [params.tab] - Active tab name
 */
function updateURL(params = {}) {
    const newUrl = new URL(window.location.href);
    
    // Update parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            newUrl.searchParams.set(key, value);
        }
    });

    // Update browser history
    window.history.pushState(params, '', newUrl);
}

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
 * Checks if recent activity cache is valid
 */
function isCacheValid() {
    return state.recentActivity.cache && 
           state.recentActivity.lastFetch && 
           (Date.now() - state.recentActivity.lastFetch < CACHE_DURATION);
}

/**
 * Toggles loading state of the UI
 */
function toggleLoadingState(isLoading) {
    // Implementation depends on your UI design
    document.body.style.cursor = isLoading ? 'wait' : 'default';
}

/**
 * Handles browser back/forward navigation
 */
function handleNavigationChange(event) {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');
    

    if (tripId) {
        //displayTripDetails(tripId);
        console.log('🚗 Should be loading trip from handleNavigationChange:', tripId);
    } else {
        // Return to search/recent activity view
        document.querySelector('.search-results-view').style.display = 'block';
        document.querySelector('.trip-details-view').style.display = 'none';
        document.querySelector('.search-context').style.display = 'block';
        document.querySelector('.trip-context').style.display = 'none';
        
        if (state.recentActivity.isViewing) {
            displayRecentActivity();
        } else {
            performSearch(document.getElementById('keywordSearch').value);
        }
    }
}

/**
 * Loads featured trips from Algolia
 */
async function loadFeaturedTrips() {
    console.log('🌟 Loading featured trips...');
    const { hits } = await tripIndexDateCreatedDesc.search('', {
        filters: 'featured = 1',
        hitsPerPage: 30
    });
    console.log(`📊 Found ${hits.length} featured trips`);
    return hits;
}

/**
 * Loads trips from user's network
 */
async function loadNetworkTrips() {
    console.log('🤝 Loading network trips...');
    console.log('Network connections:', state.userConnections.size);
    
    if (!state.userConnections.size) {
        console.log('⚠️ No network connections found');
        return [];
    }

    // Change from creatorId to attendees to match discover.js
    const networkFilter = Array.from(state.userConnections)
        .map(id => `attendees:${id}`)
        .join(' OR ');
    console.log('🔍 Network filter:', networkFilter);

    const { hits } = await tripIndexDateCreatedDesc.search('', {
        filters: networkFilter,
        hitsPerPage: 30
    });
    console.log(`📊 Found ${hits.length} network trips`);
    return hits;
}

/**
 * Combines and sorts featured and network results
 */
function combineAndSortResults(featuredResults, networkResults) {
    console.log('🔄 Combining results:', {
        featured: featuredResults.length,
        network: networkResults.length
    });
    
    // Combine results, removing duplicates
    const seen = new Set();
    const combined = [...featuredResults, ...networkResults].filter(trip => {
        if (seen.has(trip.objectID)) {
            console.log(`👥 Duplicate found: ${trip.objectID}`);
            return false;
        }
        seen.add(trip.objectID);
        return true;
    });

    console.log(`📊 Final combined results: ${combined.length} trips`);
    
    // Sort by date created, newest first
    return combined.sort((a, b) => {
        const dateA = new Date(a.dateCreated);
        const dateB = new Date(b.dateCreated);
        return dateB - dateA;
    });
}

/**
 * Updates recent activity cache
 */
function updateRecentActivityCache(results) {
    state.recentActivity.cache = results;
    state.recentActivity.lastFetch = Date.now();
    state.recentActivity.isViewing = true;
}

/**
 * Toggles between map and list views
 */
function toggleMapView(showMap) {
    console.log('🔄 Toggling map view:', showMap);
    
    const resultsContent = document.querySelector('.search-results-column .results-content');
    if (!resultsContent) {
        console.error('❌ Could not find results-content');
        return;
    }
    
    const listView = resultsContent.querySelector('.list-view');
    const mapView = resultsContent.querySelector('.map-view');
    
    console.log('Found elements:', { listView, mapView });
    
    if (!listView || !mapView) {
        console.error('❌ Could not find view elements');
        return;
    }

    if (showMap) {
        listView.style.display = 'none';
        mapView.style.display = 'block';
    } else {
        listView.style.display = 'grid';
        mapView.style.display = 'none';
    }
    
    // Update state
    state.view.isMapView = showMap;
}

function initializeDiscoverMap(hits) {
    console.log('🗺️ Initializing Discovery map');

    // Clear existing map if it exists
    if (state.currentDiscoverMap) {
        state.currentDiscoverMap.remove();
        state.currentDiscoverMap = null;
    }

    state.currentDiscoverMap = new maplibregl.Map({
        container: 'discover-map-container',
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
            'layers': [
                {
                    'id': 'osm',
                    'type': 'raster',
                    'source': 'osm',
                    'minzoom': 0,
                    'maxzoom': 19
                }
            ]
        }
    });

    const bounds = new maplibregl.LngLatBounds();
    const selectedTripContainer = document.querySelector('.selected-trip-container');

    hits.forEach(hit => {
        const el = document.createElement('div');
        el.className = 'marker';
        
        const tripType = TRIP_TYPES.find(t => t.value === parseInt(hit.familyType)) || TRIP_TYPES[0];
        
        el.innerHTML = `
            <div class="marker-circle">
                ${tripType.label.split(' ')[0]} <!-- Get just the emoji part -->
            </div>
        `;

        new maplibregl.Marker({
            element: el,
            anchor: 'center'
        })
        .setLngLat([hit.coordinates.longitude, hit.coordinates.latitude])
        .addTo(state.currentDiscoverMap)
        .getElement().addEventListener('click', () => {
            console.log('🎯 Marker clicked for trip:', hit.title);
            console.log('Selected trip container at click:', selectedTripContainer);

            // Load trip data into the selected trip container
            selectedTripContainer.innerHTML = `
                <button class="trip-item" data-trip-id="${hit.objectID}" data-creator-id="${hit.creatorId}">
                    <div class="trip-item-header" style="background-image: url('${hit.tripCoverPic || '/assets/images/default-cover.jpg'}')">
                        <div class="trip-item-content">
                            <div class="trip-item-main">
                                <div class="trip-item-title-block">
                                    <h3>${hit.title}</h3>
                                    <div class="trip-item-creator">
                                        <span>by ${hit.creatorName}</span>
                                        <span class="meta-separator">•</span>
                                        <span> ${hit.month} ${hit.year} </span>
                                    </div>
                                </div>
                                <div class="trip-item-description">${hit.shortDescription || ''}</div>
                            </div>
                            <div class="trip-item-meta">
                                <div class="trip-item-meta-left">
                                    <span>${hit.days} ${parseInt(hit.days) === 1 ? 'day' : 'days'}</span>
                                    <span class="meta-separator">•</span>
                                    <span>${hit.numPeople} ${parseInt(hit.numPeople) === 1 ? 'person' : 'people'}</span>
                                </div>
                                <div class="trip-item-meta-right">
                                    <span class="trip-type">
                                        <i class="${tripType.icon}"></i>
                                        ${tripType.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </button>
            `;
            selectedTripContainer.style.display = 'block'; // Show the container
            
            const tripItem = selectedTripContainer.querySelector('.trip-item');
            tripItem.addEventListener('click', async () => {
                const tripId = hit.objectID;
                
                // Update URL without page reload
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('tripId', tripId);
                window.history.pushState({ tripId }, '', newUrl);
                
                // Load creator profile since this is from map view (center column)
                await loadUserData(hit.creatorId);
                
                // Load and display trip
                loadTrip(tripId);
                switchToTripView();

                selectedTripContainer.style.display = 'none'; // hide the container
            });

        });

        bounds.extend([hit.coordinates.longitude, hit.coordinates.latitude]);
    });

    state.currentDiscoverMap.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 8
    });
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
    console.log('Filters cleared:', state.filters); // Debug log
}

/******************************************************************************
 * TRIP VIEW FUNCTIONS
 ******************************************************************************/

/**
 * Main function to load and display a trip
 */
async function loadTrip(tripId, loadUserAlso = false) {
    try {
        // Validate tripId
        if (!tripId || typeof tripId !== 'string') {
            console.error('Invalid tripId:', tripId);
            throw new Error('Invalid trip ID');
        }

        toggleLoadingState(true);
        
        // 1. Fetch all data in parallel
        const tripData = await fetchTripData(tripId);

        
        
        // 2. Save to state
        state.currentTrip = tripData;
        
        
        // 3. Update UI
        updateTripDisplay(tripData);
        if (loadUserAlso) {
            await loadUserData(tripData.creatorId);
        }
        
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

/**
 * Fetches all trip-related data in parallel
 */
async function fetchTripData(tripId) {
    try {
        // First fetch trip document
        const tripDoc = await firebase.firestore()
            .collection('trips')
            .doc(tripId)
            .get();

        if (!tripDoc.exists) {
            throw new Error('Trip not found');
        }

        const tripData = tripDoc.data();

        // Fetch places, attendees, and comments in parallel
        const [placeDocs, attendeeDocs, commentDocs] = await Promise.all([
            // Places data
            Promise.all((tripData.places || []).map(placeId => 
                firebase.firestore()
                    .collection('places')
                    .doc(placeId)
                    .get()
            )),
            
            // Attendee data
            Promise.all((tripData.attendees || []).map(userId => 
                firebase.firestore()
                    .collection('users')
                    .doc(userId)
                    .get()
            )),
            
            // Comments with their user data
            firebase.firestore()
                .collection('trips')
                .doc(tripId)
                .collection('comments')
                .orderBy('timestamp', 'desc')
                .get()
        ]);

        // Process comments and fetch user data only if there are comments
        let commentUsers = {};
        const comments = commentDocs.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (comments.length > 0) {
            const userIds = [...new Set(comments.map(comment => comment.userId))];
            const userDocs = await Promise.all(
                userIds.map(userId => 
                    firebase.firestore()
                        .collection('users')
                        .doc(userId)
                        .get()
                )
            );
            
            // Create a map of user data
            commentUsers = Object.fromEntries(
                userDocs
                    .filter(doc => doc.exists)
                    .map(doc => [doc.id, doc.data()])
            );
        }

        // Combine all data
        return {
            ...tripData,
            id: tripId,
            placesDetail: placeDocs
                .filter(doc => doc.exists)
                .map(doc => ({ id: doc.id, ...doc.data() })),
            attendeesDetail: attendeeDocs
                .filter(doc => doc.exists)
                .map(doc => ({ id: doc.id, ...doc.data() })),
            comments: comments.map(comment => ({
                ...comment,
                user: commentUsers[comment.userId] || null
            }))
        };

    } catch (error) {
        console.error('Error fetching trip data:', error);
        throw new Error('Failed to load trip data');
    }
}

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

    loadComments();
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
    const selectedOption = document.querySelector('.filter-option.selected');
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
    document.querySelector('.trip-header').style.backgroundImage = `url(${tripData.tripCoverPic || DEFAULTS.coverImage})`;
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
        document.querySelectorAll('.filter-option').forEach(option => {
            const filterType = option.querySelector('span').textContent;
            const countSpan = option.querySelector('.filter-count');
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
                            <div class="place-image" style="background-image: url('${place.image || '/assets/default-place.jpg'}')">
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
                    <div class="place-name">${place.title}</div>
                    <div class="place-type">
                        <i class="${placeType.icon}"></i>
                        ${placeType.label}
                    </div>
                    <div class="place-actions">
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
    console.log('Initializing trip places filter menu');
    const filterButton = document.querySelector('.filter-button');
    const filterMenu = document.querySelector('.filter-menu');
    const filterOptions = document.querySelectorAll('.filter-option');
    const selectedFilter = document.querySelector('.selected-filter');

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
            const count = option.querySelector('.filter-count').textContent;

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
        console.log('🗺️ Initializing Trip map');
        
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
                if (place.coordinates) {
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
                                <div class="map-popup" style="background-image: url('${place.image || DEFAULTS.coverImage}')">
                                    <div class="map-popup-overlay">
                                        <h2>${place.title}</h2>
                                        <div class="map-popup-type">
                                            <i class="${placeType.icon}"></i>
                                            ${placeType.label}
                                        </div>
                                        <div class="map-popup-address">
                                            ${place.address}
                                        </div>
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

async function loadUserData(userId) {
    const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userId)
            .get();

    const userData = userDoc.data();

    // If no user document exists, set empty state
    if (!userDoc.exists) {
        console.log('No user document found, initializing empty state');
        state.currentUser = {
            trips: [],
            // Add any other default fields needed
        };
        state.currentUserTrips = [];
        displayUserData();
        return;
    }

    // Fetch places data in parallel
    const userTripPromises = (userData.trips || []).map(tripId => 
        firebase.firestore()
            .collection('trips')
            .doc(tripId)
            .get()
            .then(doc => {
                if (!doc.exists) return null;
                return { id: doc.id, ...doc.data() };
            })
    );

    const [userTripsDetail] = await Promise.all([
        Promise.all(userTripPromises)
    ]);

    const validUserTrips = userTripsDetail.filter(trip => trip !== null);

    state.currentUser = userData;
    state.currentUserTrips = validUserTrips;

    displayUserData();
}

function displayUserData() {

    const userData = state.currentUser;
    const userTripsDetail = state.currentUserTrips;

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
        <div class="creator-header" style="background-image: url('${userData.bPic || DEFAULTS.coverImage}')">
            <div class="creator-profile-pic">
                <img src="${userData.pPic || DEFAULTS.profileImage}" alt="">
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
                    <div class="creator-joined">Joined ${new Date(userData.dateJoined?.toDate?.()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
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
    attachTripItemHandlers();
    attachStatHandlers();
}

function attachTripItemHandlers() {
    document.querySelectorAll('.trip-item').forEach(button => {
        button.addEventListener('click', async () => {
            const tripId = button.dataset.tripId;
            
            // Update URL without page reload
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('tripId', tripId);
            window.history.pushState({ tripId }, '', newUrl);
            
            // If trip is clicked from center column, load creator profile
            const isCenterColumn = button.closest('.center-column') !== null;
            
            // Load and display trip
            loadTrip(tripId, isCenterColumn);
            switchToTripView();

        });
    });
}

async function loadComments() {
    const commentsList = document.getElementById('commentsList');
    const commentCount = document.getElementById('commentCount');
    
    try {
        const comments = state.currentTrip.commentsHistory || [];
        
        // Update comment count in header
        commentCount.textContent = comments.length;
        
        // Clear loading message
        commentsList.innerHTML = '';

        if (comments.length === 0) {
            commentsList.innerHTML = `
                <div class="no-comments">
                    No comments yet
                </div>
            `;
            return;
        }

        // Fetch user data for all comments in parallel
        const userPromises = [...new Set(comments.map(comment => comment.userId))]
            .map(userId => 
                firebase.firestore()
                    .collection('users')
                    .doc(userId)
                    .get()
                    .then(doc => {
                        if (!doc.exists) return null;
                        return { id: doc.id, ...doc.data() };
                    })
            );

        const users = await Promise.all(userPromises);
        const userMap = Object.fromEntries(
            users.filter(user => user !== null)
                 .map(user => [user.id, user])
        );

        // Sort comments by date (newest first)
        const sortedComments = [...comments].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        // Render each comment
        sortedComments.forEach(comment => {
            const user = userMap[comment.userId];
            if (!user) return; // Skip if user data not found

            const commentHTML = `
                <div class="comment-item">
                    <div class="comment-avatar">
                        <img src="${user.pPic || '/assets/default-avatar.png'}" 
                             alt="${user.displayName}">
                    </div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <div class="comment-author">
                                <button class="comment-author-btn" data-user-id="${user.userId}">
                                    ${user.displayName}
                                </button>
                                <div class="comment-date">${comment.date}</div>
                            </div>
                        </div>
                        <div class="comment-text">${comment.msg}</div>
                    </div>
                </div>
            `;
            
            commentsList.insertAdjacentHTML('beforeend', commentHTML);
        });

        // Add event listener for author clicks using event delegation
        commentsList.addEventListener('click', async (e) => {
            const authorBtn = e.target.closest('.comment-author-btn');
            if (authorBtn) {
                const userId = authorBtn.dataset.userId;
                await loadUserData(userId);
            }
        });

        initializeCommentForm();

    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = `
            <div class="no-comments">
                Error loading comments
            </div>
        `;
    }
}

async function displayUserList(listType, startIndex = 0, limit = 20) {
    const userData = state.currentUser;
    const userIds = listType === 'friends' ? userData.friends : userData.followedBy;
    
    // Guard against undefined/null userData or empty userIds array
    if (!userData || !Array.isArray(userIds) || userIds.length === 0) {
        const containerClass = `creator-${listType}`;
        const creatorTripsDiv = document.querySelector('.creator-trips');
        creatorTripsDiv.innerHTML = `
            <div class="${containerClass}">
            <div class="empty-state" style="text-align: center; font-style: italic; font-size: 14px; padding: 20px;">
                <p style="margin: 0;">Not ${listType === 'friends' ? 'following' : 'followed by'} anyone yet</p>
            </div>
        </div>
        `;
        return;
    }

    try {
        // Create or get the container
        const containerClass = `creator-${listType}`;
        let container = document.querySelector(`.${containerClass}`);
        if (!container) {
            const creatorTripsDiv = document.querySelector('.creator-trips');
            creatorTripsDiv.innerHTML = `
                <div class="${containerClass}">
                    <div class="user-list"></div>
                    <div class="following-actions">
                        <button class="load-more-btn" style="display: none;">
                            <i class="fas fa-plus"></i> Load More
                        </button>
                        <div class="following-loader" style="display: none;">
                            Loading...
                        </div>
                    </div>
                </div>
            `;
            container = document.querySelector(`.${containerClass}`);
        }

        const userList = container.querySelector('.user-list');
        const loadMoreBtn = container.querySelector('.load-more-btn');
        const loader = container.querySelector('.following-loader');
        
        // Set loading state
        container.dataset.loading = 'true';
        loadMoreBtn.style.display = 'none';
        loader.style.display = 'block';

        // Get current batch of user IDs
        const currentBatch = userIds.slice(startIndex, startIndex + limit);

        // Fetch user documents for just this batch
        const snapshot = await firebase.firestore()
            .collection('users')
            .where(firebase.firestore.FieldPath.documentId(), 'in', currentBatch)
            .get();

        const usersHTML = snapshot.docs.map(doc => {
            const user = { id: doc.id, ...doc.data() };
            return `
                <button class="following-card" data-user-id="${user.id}">
                    <div class="attendee-card" style="box-shadow: none;">
                        <img class="attendee-photo" 
                             src="${user.pPic || '/assets/default-profile.png'}" 
                             alt="${user.displayName}"
                             onerror="this.src='/assets/default-profile.png'">
                        <div class="attendee-info">
                            <div class="attendee-name">${user.displayName}</div>
                            ${user.location ? 
                                `<div class="attendee-location">${user.location}</div>` 
                                : ''
                            }
                            <div class="trips-count">
                                <i class="fas fa-compass"></i>
                                ${(user.trips || []).length}
                            </div>
                        </div>
                    </div>
                </button>
            `;
        }).join('');

        // Append new content
        if (startIndex > 0) {
            userList.insertAdjacentHTML('beforeend', usersHTML);
        } else {
            userList.innerHTML = usersHTML;
        }

        // Add click handlers for new cards
        const newCards = userList.querySelectorAll('.following-card:not([data-initialized])');
        newCards.forEach(card => {
            card.dataset.initialized = 'true';
            card.addEventListener('click', async () => {
                const userId = card.dataset.userId;
                await loadUserData(userId);
            });
        });

        // Update loading state and show/hide load more button
        container.dataset.loading = 'false';
        loader.style.display = 'none';
        
        // Show load more button if there are more users to load
        if (startIndex + limit < userIds.length) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.onclick = async () => {
                await displayUserList(listType, startIndex + limit, limit);
            };
        } else {
            loadMoreBtn.style.display = 'none';
        }

    } catch (error) {
        console.error(`Error loading ${listType} list:`, error);
        const userList = document.querySelector(`.${containerClass} .user-list`);
        if (userList) {
            userList.innerHTML += `
                <div class="error-message">
                    Error loading users. Please try again.
                </div>
            `;
        }
    }
}


function attachStatHandlers() {
    document.querySelectorAll('.stat-item').forEach(stat => {
        stat.addEventListener('click', async () => {
            const statType = stat.dataset.stat;
            
            // Remove active class from all stats
            document.querySelectorAll('.stat-item').forEach(s => 
                s.classList.remove('active'));
            
            if (statType === 'friends' || statType === 'followedBy') {
                stat.classList.add('active');
                await displayUserList(statType);
            } else if (statType === 'trips') {
                stat.classList.add('active');
                displayUserData(); // This will show trips again
            } else {
                console.log('no type found');
            }
            // Add other stat types as needed
        });
    });
}

function initializeFilters() {
    const filterBtn = document.getElementById('tripFilterBtn');
    const filterMenu = document.getElementById('filterMenu');
    

    if (!filterBtn || !filterMenu) return;

    console.log('Initialize filters called');

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
    attachTripItemHandlers();
}
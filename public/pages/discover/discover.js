import { TRIP_TYPES } from '/admin/config.js';

const searchClient = algoliasearch('WADPYQO9WN', '37148f9e28cd367ebb6c1cfdb4852db6');
const tripIndex = searchClient.initIndex('tripIndex');
const tripIndexDateCreatedDesc = searchClient.initIndex('tripIndex_dateCreatedDesc');

let isViewingRecentActivity = false;
let recentActivityCache = null;
let recentActivityLastFetch = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

let currentUser = null;
let userConnections = new Set(); // Will store user's network

const state = {
    currentTrip: null,
    currentUser: null,
    currentUserTrips: null,
    currentMap: null, // Add this to track the map instance
    filters: {
        tripTypes: [],
        duration: {
            min: null,
            max: null
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeTripTypes();
        initializeEventListeners();
        await initializeUserData();
        
        // Automatically show recent activity on page load
        const recentActivityBtn = document.getElementById('recentActivityButton');
        if (recentActivityBtn) {
            recentActivityBtn.click(); // This will trigger the showRecentActivity function
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }

});

async function initializeUserData() {
    // Wait for Firebase auth
    currentUser = await window.firebaseAuthReady;
    if (currentUser) {
        await loadUserConnections();
        await loadUserData(currentUser.uid);
    }
}

async function loadUserConnections() {
    try {
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();
        
        const userData = userDoc.data();
        
        // Add friends to connections
        if (userData.friends) {
            userData.friends.forEach(id => userConnections.add(id));
        }
        
        // Add trip connections
        if (userData.tripConnections1) {
            userData.tripConnections1.forEach(id => userConnections.add(id));
        }
        if (userData.tripConnections2) {
            userData.tripConnections2.forEach(id => userConnections.add(id));
        }
    } catch (error) {
        console.error('Error loading user connections:', error);
    }
}

async function performSearch() {
    try {
        resetRecentActivityView();
        console.log('🔍 Starting search...');

        // Get selected trip types
        const selectedTypes = Array.from(document.querySelectorAll('.trip-type-chip.selected'))
            .map(chip => chip.getAttribute('data-type'));
        console.log('Selected trip types:', selectedTypes);

        // Get days range
        const minDays = parseInt(document.querySelector('.min-days').value);
        const maxDays = parseInt(document.querySelector('.max-days').value);
        console.log('Days range:', { minDays, maxDays });

        // Get network preference
        const isMyNetwork = document.querySelector('.toggle-btn.left').classList.contains('active');
        console.log('My Network only?', isMyNetwork);

        // Build filter parts
        let combinedFilters = [];

        // Add trip type filters
        if (selectedTypes.length > 0) {
            const familyTypeFS = selectedTypes.map(type => `familyType:${type}`).join(' OR ');
            combinedFilters.push(`(${familyTypeFS})`);
        }

        // Add network filter if "My Network" is selected
        if (isMyNetwork && userConnections.size > 0) {
            const friendFS = Array.from(userConnections)
                .map(id => `attendees:${id}`)
                .join(' OR ');
            combinedFilters.push(`(${friendFS})`);
        }

        // NEED TO ADD days filter, it is currently saved in algolia as a string.
       

        // Get keyword
        const keyword = document.getElementById('keywordSearch').value;
        console.log('Search keyword:', keyword);

        // Combine all filters
        const finalFilterString = combinedFilters.join(' AND ');
        console.log('🔍 Final filter string:', finalFilterString);

        // Perform search
        console.log('📤 Sending search request to Algolia...');
        const { hits } = await tripIndex.search(keyword, {
            filters: finalFilterString,
            hitsPerPage: 20,
        });

        // Filter results by days
        const filteredHits = hits.filter(hit => {
            const tripDays = parseInt(hit.days);
            if (maxDays === 14) {
                return tripDays >= minDays;
            } else {
                return tripDays >= minDays && tripDays <= maxDays;
            }
        });
        
        console.log('📥 Search results received:', hits.length);
        console.log('After days filter:', filteredHits.length);

        displaySearchResults(filteredHits);

    } catch (error) {
        console.error('❌ Error performing search:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            status: error.status
        });
        showNoResults('An error occurred while searching');
    }
}

function displaySearchResults(hits) {
    const resultsContainer = document.querySelector('.advanced-search-results');
    const selectedTripContainer = document.querySelector('.selected-trip-container');
    
    // Check which view is currently active before updating content
    const isMapViewActive = resultsContainer.querySelector('.view-toggle-btn.right.active') !== null;

    if (!hits || hits.length === 0) {
        showNoResults();
        return;
    }

    const hitsWithCoordinates = hits.filter(hit => 
        hit.coordinates && 
        hit.coordinates.latitude && 
        hit.coordinates.longitude
    );

    console.log('📍 Hits with valid coordinates:', hitsWithCoordinates.length);

    const resultsHTML = hits.map(hit => `
        <button class="discover-search-result-item" onclick="window.location.href='/tripview?tripId=${hit.objectID}'">
            <div class="trip-item-header" style="background-image: url('${hit.tripCoverPic || '/assets/images/default-cover.jpg'}')">
                <div class="trip-item-content">
                    <div class="trip-date">
                        ${hit.month} ${hit.year}
                    </div>
                    <div class="trip-item-main">
                        <div class="trip-item-title-block">
                            <h3>${hit.title}</h3>
                            <div class="trip-item-creator">
                                by ${hit.creatorName}
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
                                <i class="${TRIP_TYPES.find(t => t.value === parseInt(hit.familyType))?.icon}"></i>
                                ${TRIP_TYPES.find(t => t.value === parseInt(hit.familyType))?.label}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    `).join('');

    resultsContainer.innerHTML = `
        <div class="search-results-header">
            <h2>${isViewingRecentActivity ? 'RECENT ACTIVITY' : 'SEARCH RESULTS'} (${hits.length})</h2>
            <div class="view-toggle">
                <button class="view-toggle-btn left ${!isMapViewActive ? 'active' : ''}">
                    <i class="fas fa-list"></i>
                    List
                </button>
                <button class="view-toggle-btn right ${isMapViewActive ? 'active' : ''}">
                    <i class="fas fa-map"></i>
                    Map
                </button>
            </div>
        </div>
        <div class="results-content">
            <div class="list-view" style="display: ${!isMapViewActive ? 'block' : 'none'}">
                <div class="results-grid">
                    ${resultsHTML}
                </div>
            </div>
            <div class="map-view" style="display: ${isMapViewActive ? 'block' : 'none'}">
                <div id="map-container" style="width: 100%; height: 100%;"></div>
            </div>
        </div>
    `;

    // Add view toggle event listeners
    const viewToggleBtns = resultsContainer.querySelectorAll('.view-toggle-btn');
    const listView = resultsContainer.querySelector('.list-view');
    const mapView = resultsContainer.querySelector('.map-view');
    let map = null;

    // Initialize map immediately if map view is active
    if (isMapViewActive && hitsWithCoordinates.length > 0) {
        initializeMap(hitsWithCoordinates);
    }

    viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('👆 View toggle clicked:', btn.classList.contains('left') ? 'List View' : 'Map View');
            viewToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (btn.classList.contains('left')) {
                listView.style.display = 'block';
                mapView.style.display = 'none';
                selectedTripContainer.style.display = 'none'; // Hide selected trip container
                if (map) {
                    map.remove();
                    map = null;
                }
            } else {
                listView.style.display = 'none';
                mapView.style.display = 'block';
                
                // Show selected trip container if a trip is selected
                if (selectedTripContainer.querySelector('.discover-search-result-item')) {
                    selectedTripContainer.style.display = 'block';
                }
                
                // Initialize map if not already done
                if (!map && hitsWithCoordinates.length > 0) {
                    initializeMap(hitsWithCoordinates);
                }
            }
        });
    });

    function initializeMap(hits) {
        console.log('🗺️ Initializing map');
        map = new maplibregl.Map({
            container: 'map-container',
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
            /*.setPopup(
                new maplibregl.Popup({ offset: 25 })
                .setHTML(`
                    <div class="map-popup" style="background-image: url('${hit.tripCoverPic || '/assets/images/default-cover.jpg'}')">
                        <div class="map-popup-overlay">
                            <h2>${hit.title}</h2>
                            <div class="map-popup-type">
                                <i class="${tripType.icon}"></i>
                                ${tripType.label}
                            </div>
                            <div class="map-popup-address">
                                by ${hit.creatorName}
                            </div>
                        </div>
                    </div>
                `)
            )*/
            .addTo(map)
            .getElement().addEventListener('click', () => {
                console.log('🎯 Marker clicked for trip:', hit.title);
                console.log('Selected trip container at click:', selectedTripContainer);

                // Load trip data into the selected trip container
                selectedTripContainer.innerHTML = `
                    <button class="discover-search-result-item" onclick="window.location.href='/tripview?tripId=${hit.objectID}'">
                        <div class="trip-item-header" style="background-image: url('${hit.tripCoverPic || '/assets/images/default-cover.jpg'}')">
                            <div class="trip-item-content">
                                <div class="trip-date">
                                    ${hit.month} ${hit.year}
                                </div>
                                <div class="trip-item-main">
                                    <div class="trip-item-title-block">
                                        <h3>${hit.title}</h3>
                                        <div class="trip-item-creator">
                                            by ${hit.creatorName}
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
            });

            bounds.extend([hit.coordinates.longitude, hit.coordinates.latitude]);
        });

        map.fitBounds(bounds, {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            maxZoom: 8
        });
    }
}

function showNoResults(message = 'Try adjusting your search criteria') {
    const resultsContainer = document.querySelector('.advanced-search-results');
    resultsContainer.innerHTML = `
        <div class="search-results-header">
            <h2>SEARCH RESULTS</h2>
        </div>
        <div class="no-results">
            <i class="fas fa-search"></i>
            <p>No search results found</p>
            <span>${message}</span>
        </div>
    `;
}

function initializeTripTypes() {
    const tripTypesGrid = document.getElementById('tripTypesGrid');
    
    TRIP_TYPES.forEach(type => {
        const chip = document.createElement('button');
        chip.className = 'trip-type-chip';
        chip.setAttribute('data-type', type.value);
        chip.innerHTML = `
            <i class="${type.icon}"></i>
            ${type.label}
        `;
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
        });
        tripTypesGrid.appendChild(chip);
    });
}

function initializeEventListeners() {
    // Network toggle
    const networkToggleBtns = document.querySelectorAll('.network-toggle .toggle-btn');
    networkToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            networkToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Initialize range slider
    initializeRangeSlider();

    // Add Recent Activity button listener
    document.getElementById('recentActivityButton').addEventListener('click', showRecentActivity);

    // Clear button - Updated functionality
    document.querySelector('.clear-btn').addEventListener('click', () => {
        // Reset keyword search
        document.getElementById('keywordSearch').value = '';
        
        // Reset trip type chips
        document.querySelectorAll('.trip-type-chip').forEach(chip => {
            chip.classList.remove('selected');
        });
        
        // Reset network toggle to "My Network"
        document.querySelector('.toggle-btn.left').click();
        
        // Reset range sliders to default values
        const minSlider = document.querySelector('.min-days');
        const maxSlider = document.querySelector('.max-days');
        minSlider.value = 1;
        maxSlider.value = 14;
        
        // Trigger slider update to refresh the UI
        minSlider.dispatchEvent(new Event('input'));
    });

    // Search button
    document.querySelector('.search-btn').addEventListener('click', performSearch);

    // Add search on Enter key in keyword field
    document.getElementById('keywordSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

function initializeRangeSlider() {
    const minSlider = document.querySelector('.min-days');
    const maxSlider = document.querySelector('.max-days');
    const track = document.querySelector('.slider-track');
    const minLabel = document.querySelector('.min-value');
    const maxLabel = document.querySelector('.max-value');

    function updateSlider() {
        const min = parseInt(minSlider.value);
        const max = parseInt(maxSlider.value);
        
        if (min > max) {
            if (this === minSlider) {
                maxSlider.value = min;
            } else {
                minSlider.value = max;
            }
        }

        const minVal = parseInt(minSlider.value);
        const maxVal = parseInt(maxSlider.value);
        
        const leftPercent = ((minVal - 1) / 13) * 100;
        const rightPercent = ((maxVal - 1) / 13) * 100;
        
        track.style.left = leftPercent + '%';
        track.style.width = (rightPercent - leftPercent) + '%';

        minLabel.textContent = minVal;
        maxLabel.textContent = maxVal === 14 ? '14+' : maxVal;
    }

    minSlider.addEventListener('input', updateSlider);
    maxSlider.addEventListener('input', updateSlider);
    
    // Initialize
    updateSlider();
}

async function showRecentActivity() {
    try {
        isViewingRecentActivity = true;
        const recentActivityBtn = document.getElementById('recentActivityButton');
        recentActivityBtn.classList.add('active');

        const now = Date.now();
        if (recentActivityCache && recentActivityLastFetch && 
            (now - recentActivityLastFetch < CACHE_DURATION)) {
            console.log('📦 Using cached recent activity data');
            displaySearchResults(recentActivityCache);
            return;
        }

        // Build filter for user connections
        let connectionFilters = [];
        
        // Add friends to filter if they exist
        if (currentUser) {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(currentUser.uid)
                .get();
            
            const userData = userDoc.data();
            
            // Collect all unique user IDs from the different connection lists
            const allConnections = new Set([
                ...(userData.friends || []),
                ...(userData.tripConnections1 || []),
                ...(userData.tripConnections2 || [])
            ]);

            connectionFilters = Array.from(allConnections);
        }

        // Do two separate searches
        const featuredResults = await tripIndexDateCreatedDesc.search('', {
            filters: 'featured = 1',
            hitsPerPage: 20
        });

        const networkResults = connectionFilters.length > 0 ? 
            await tripIndexDateCreatedDesc.search('', {
                filters: connectionFilters.map(id => `attendees:${id}`).join(' OR '),
                hitsPerPage: 20
            }) : 
            { hits: [] };

        console.log('🔍 Network filter:', connectionFilters.map(id => `attendees:${id}`).join(' OR '));

        // Combine and deduplicate results
        const allHits = [...featuredResults.hits];
        const seenIds = new Set(allHits.map(hit => hit.objectID));
        
        networkResults.hits.forEach(hit => {
            if (!seenIds.has(hit.objectID)) {
                allHits.push(hit);
                seenIds.add(hit.objectID);
            }
        });

        // Sort by dateCreated (newest first)
        allHits.sort((a, b) => b.dateCreated - a.dateCreated);

        console.log('📊 Recent Activity Results:', allHits.length);
        allHits.forEach((hit, index) => {
            console.log(`${index + 1}. Trip: ${hit.title}`);
            console.log(`   Date Created: ${hit.dateCreated}`);
            console.log(`   Featured: ${hit.featured}`);
            console.log(`   Attendees: ${hit.attendees}`);
            console.log('   ---');
        });

        recentActivityCache = allHits;
        recentActivityLastFetch = now;
        
        displaySearchResults(allHits);

    } catch (error) {
        console.error('Error showing recent activity:', error);
        showNoResults('Error loading recent activity');
    }
}

// Add this function to reset the recent activity view
function resetRecentActivityView() {
    if (isViewingRecentActivity) {
        isViewingRecentActivity = false;
        const recentActivityBtn = document.getElementById('recentActivityButton');
        recentActivityBtn.classList.remove('active');
    }
}

async function loadUserData(userId) {
    const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userId)
            .get();

    const userData = userDoc.data();

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
                <div class="stat-item">
                    <div class="stat-value">${userData.trips?.length || 0}</div>
                    <div class="stat-label">Trips</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${userData.friends?.length || 0}</div>
                    <div class="stat-label">Following</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${userData.followedBy?.length || 0}</div>
                    <div class="stat-label">Followed By</div>
                </div>
            </div>
            <div class="creator-details-container">
                <div class="creator-details">
                    <div class="creator-name">
                        ${userData.displayName}
                    </div>
                    <div class="creator-location">${userData.location || ''}</div>
                    <div class="creator-joined">Joined ${new Date(userData.dateJoined?.toDate?.()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                </div>
            </div>
        </div>

        <div class="creator-trips">
            <div class="trips-list">
                ${userTripsDetail.map(trip => generateTripItemHTML(trip)).join('')}
            </div>
        </div>
    </div>
    `;

    document.querySelector('.creator-profile').innerHTML = creatorProfile;

    // Initialize filters after rendering
    attachTripItemHandlers();
}

function generateTripItemHTML(trip) {
    const tripType = TRIP_TYPES.find(type => type.value === parseInt(trip.familyType)) || TRIP_TYPES[0];
    
    return `
        <button class="trip-item" data-trip-id="${trip.id}">
            <div class="trip-item-header" style="background-image: url('${trip.tripCoverPic || DEFAULTS.coverImage}')">
                <div class="trip-item-content">
                    <div class="trip-item-main">
                        <div class="trip-item-title-block">
                            <h3>${trip.title}</h3>
                            <div class="trip-item-creator">
                                ${trip.month} ${trip.year}
                            </div>
                        </div>
                        <div class="trip-item-description">${trip.shortDescription || ''}</div>
                    </div>
                    <div class="trip-item-meta">
                        <div class="trip-item-meta-left">
                            <span>${trip.days} days</span>
                            <span class="meta-separator">•</span>
                            <span>${trip.attendees?.length || 1} people</span>
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
}

function attachTripItemHandlers() {
    document.querySelectorAll('.trip-item').forEach(button => {
        button.addEventListener('click', async () => {
            const tripId = button.dataset.tripId;
            window.location.href = `/pages/tripview/tripview.html?tripId=${tripId}`;
        });
    });
}

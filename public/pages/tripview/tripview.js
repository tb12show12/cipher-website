import { TRIP_TYPES, PLACE_TYPES, DEFAULTS } from '/admin/config.js';


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

function initializeTabs() {
    const tabs = document.querySelectorAll('.trip-nav-item');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding content
            const tabName = tab.getAttribute('data-tab');
            const content = document.getElementById(tabName);
            if (content) {
                content.classList.add('active');
            }

            // Update URL without page reload
            const url = new URL(window.location);
            url.searchParams.set('tab', tabName);
            window.history.pushState({}, '', url);
        });
    });

    // Handle initial tab state from URL
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') || 'places';  // Default to overview
    const defaultTab = document.querySelector(`[data-tab="${initialTab}"]`);
    if (defaultTab) {
        defaultTab.click();
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


document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for Firebase auth to be ready
        const user = await window.firebaseAuthReady;
        
        if (!user) {
            window.location.href = '/admin/index.html';
            return;
        }
        
        // Get tripId from URL parameters
        const params = new URLSearchParams(window.location.search);
        const tripId = params.get('tripId');
        

        // If there's a tripId, load and display the trip
        if (tripId) {
            const tripMain = document.querySelector('.trip-main');
            if (tripMain) tripMain.style.display = 'block';
            await loadTripData(tripId, true);
            await loadComments();
            initializeTabs();
        } else {
            // Hide trip-main if no trip selected
            await loadUserData(user.uid);
            const tripMain = document.querySelector('.trip-main');
            if (tripMain) tripMain.style.display = 'none';
            initializeTabs();
        }

    } catch (error) {
        console.error('Error initializing:', error);
    }
});

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

async function loadTripData(tripId, firstLoad = false) {
    try {
        cleanupMap();

        // First fetch the trip data
        const tripDoc = await firebase.firestore()
            .collection('trips')
            .doc(tripId)
            .get();

        if (!tripDoc.exists) {
            console.error('Trip not found');
            window.location.href = '/discover';
            return;
        }

        const tripData = tripDoc.data();

        // Fetch places data in parallel
        const placePromises = (tripData.places || []).map(placeId => 
            firebase.firestore()
                .collection('places')
                .doc(placeId)
                .get()
                .then(doc => {
                    if (!doc.exists) return null;
                    return { id: doc.id, ...doc.data() };
                })
        );

        // Fetch attendees data in parallel
        const attendeePromises = (tripData.attendees || []).map(userId => 
            firebase.firestore()
                .collection('users')
                .doc(userId)
                .get()
                .then(doc => {
                    if (!doc.exists) return null;
                    return { id: doc.id, ...doc.data() };
                })
        );

        // Wait for all promises to resolve
        const [placesDetail, attendeesDetail] = await Promise.all([
            Promise.all(placePromises),
            Promise.all(attendeePromises),
        ]);

        // Filter out any null values (from non-existent docs)
        const validPlaces = placesDetail.filter(place => place !== null);
        const validAttendees = attendeesDetail.filter(attendee => attendee !== null);
        
        // Combine all data
        const completeData = {
            ...tripData,
            id: tripId,
            placesDetail: validPlaces,
            attendeesDetail: validAttendees
        };

        // Save and Display the data
        state.currentTrip = completeData;
        displayTripData();

        if (firstLoad) {
            await loadUserData(tripData.creatorId);
        }

    } catch (error) {
        console.error('Error loading trip:', error);
    }
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
                        <div class="filter-section">
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
                    
                    <div class="filter-section">
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
                ${userTripsDetail.map(trip => generateTripItemHTML(trip)).join('')}
            </div>
        </div>
    </div>
    `;

    document.querySelector('.creator-profile').innerHTML = creatorProfile;

    // Initialize filters after rendering
    initializeFilters();
    attachTripItemHandlers();
}

function attachTripItemHandlers() {
    document.querySelectorAll('.trip-item').forEach(button => {
        button.addEventListener('click', async () => {
            const tripId = button.dataset.tripId;

            // Show trip-main section first
            const tripMain = document.querySelector('.trip-main');
            if (tripMain) tripMain.style.display = 'block';
            
            // Update URL without page reload
            const url = new URL(window.location);
            url.searchParams.set('tripId', tripId);
            url.searchParams.set('tab', 'places'); // Always set default tab
            window.history.pushState({}, '', url);
            
            // Load and display the new trip
            await loadTripData(tripId); // Add true parameter to indicate first load
            await loadComments();
            initializeTabs(); // Initialize tabs after loading trip data
        });
    });
}

function updateTripsList(filteredTrips) {
    const tripsList = document.querySelector('.trips-list');
    tripsList.innerHTML = filteredTrips.map(trip => generateTripItemHTML(trip)).join('');
    
    // Reattach click handlers
    attachTripItemHandlers();
}

function resetTabsStructure() {
    const tabContainer = document.querySelector('.trip-nav');
    const contentContainer = document.querySelector('.trip-content');
    
    // Only proceed if we have our containers
    if (!tabContainer || !contentContainer) return;

    // Reset tabs structure
    tabContainer.innerHTML = `
        <button class="trip-nav-item active" data-tab="places">Places</button>
        <button class="trip-nav-item" data-tab="notes">Notes</button>
        <button class="trip-nav-item" data-tab="attendees">Attendees</button>
        <button class="trip-nav-item" data-tab="photos">Photos</button>
        <button class="trip-nav-item" data-tab="map">Map</button>
    `;
}

function displayTripData() {

    resetTabsStructure();
    initializeTabs();
    initializeCommentForm();

    const tripData = state.currentTrip;
    if (!tripData) return;

    // Update header background
    document.querySelector('.trip-header').style.backgroundImage = 
        `url(${tripData.tripCoverPic || DEFAULTS.coverImage})`;

    // Update title
    document.getElementById('tripTitle').textContent = tripData.title;
    
    // Update creator
    document.getElementById('tripCreator').textContent = tripData.creatorName;
    
    // Update month and year
    document.getElementById('tripMonth').textContent = tripData.month;
    document.getElementById('tripYear').textContent = tripData.year;
    
    // Update short description
    document.getElementById('tripShortDescription').textContent = 
        tripData.shortDescription || '';
    
    // Display duration
    document.getElementById('tripDuration').textContent = 
        `${tripData.days} day${parseInt(tripData.days) !== 1 ? 's' : ''}`;
    
    // Display number of people
    document.getElementById('tripPeople').textContent = 
        `${tripData.numPeople} ${parseInt(tripData.numPeople) === 1 ? 'person' : 'people'}`;
    
    // Display trip type using your configuration
    const tripType = TRIP_TYPES.find(type => type.value === parseInt(tripData.familyType)) || TRIP_TYPES[0];
    document.getElementById('tripType').textContent = tripType.label;

    // Handle Notes tab visibility
    const hasNotes = tripData.longDescriptionHTML || tripData.longDescription;
    const notesTab = document.querySelector('[data-tab="notes"]');
    const notesContent = document.getElementById('notes');
    
    if (!hasNotes) {
        // Remove Notes tab and content if no description exists
        notesTab?.remove();
        //notesContent?.remove();
    } else {
        // Show and populate Notes tab
        const noteContent = tripData.longDescriptionHTML || tripData.longDescription;
        const notesContainer = document.querySelector('#notes .notes-content');
        notesContainer.innerHTML = noteContent;
    }

    // Handle Photos tab
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
    } else {
        // If no photos, hide the photos tab
        const photosTab = document.querySelector('[data-tab="photos"]');
        const photosContent = document.getElementById('photos');
        photosTab?.remove();
        //photosContent?.remove();
    }

    // Handle Attendees tab
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
    } else {
        // Hide attendees tab if no attendees
        const attendeesTab = document.querySelector('[data-tab="attendees"]');
        const attendeesContent = document.getElementById('attendees');
        attendeesTab?.remove();
        attendeesContent?.remove();
    }

     // Handle Places tab
     if (tripData.placesDetail && tripData.placesDetail.length > 0) {
        const placesGrid = document.querySelector('.places-grid');
        placesGrid.innerHTML = tripData.placesDetail
            .map(place => {

                const placeType = PLACE_TYPES.find(type => type.value === place.type) || PLACE_TYPES[0];
                // Check if there's feedback for this trip
                const tripFeedback = place.feedback?.find(f => f.tripId === tripData.id);
                const feedbackBadge = tripFeedback ? 
                    (tripFeedback.value === 2 ? 
                        '<div class="place-badge wow">Wow!!</div>' : 
                        '<div class="place-badge skip">Can Skip</div>') 
                    : '';
                
                // Filter comments for this trip
                const tripComments = (place.comments || [])
                    .filter(comment => comment.tripId === tripData.id);

                return `
                    <button class="place-button" onclick="window.location.href='/place?placeId=${place.id}'">
                        <div class="place-card">
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
                                        <div class="place-address">${place.address}</div>
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
    }

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

    // Update filter buttons with counts and icons
    const filtersContainer = document.querySelector('.places-filters');
    filtersContainer.innerHTML = `
        <button class="filter-btn active" data-category="all">
            <i class="fas fa-globe"></i>
            All (${counts.all})
        </button>
        <button class="filter-btn" data-category="toStay">
            <i class="fas fa-bed"></i>
            To Stay (${counts.toStay})
        </button>
        <button class="filter-btn" data-category="toEat">
            <i class="fas fa-utensils"></i>
            To Eat/Drink (${counts.toEat})
        </button>
        <button class="filter-btn" data-category="toDo">
            <i class="fas fa-hiking"></i>
            To Do (${counts.toDo})
        </button>
    `;

    // Add filter functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    const placeCards = document.querySelectorAll('.place-button');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const selectedCategory = button.dataset.category;

            // Filter places
            tripData.placesDetail.forEach((place, index) => {
                const placeCard = placeCards[index];
                const placeType = PLACE_TYPES.find(type => type.value === place.type);
                
                if (selectedCategory === 'all' || placeType?.category === selectedCategory) {
                    placeCard.style.display = '';
                } else {
                    placeCard.style.display = 'none';
                }
            });
        });
    });

    // Handle Map tab
    if (tripData.placesDetail && tripData.placesDetail.length > 0) {
        const map = new maplibregl.Map({
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

        map.on('load', () => {
            map.resize();
        });
        
        // Optional: handle window resizes
        window.addEventListener('resize', () => {
            map.resize();
        });

        // Create bounds to fit all markers
        const bounds = new maplibregl.LngLatBounds();

        // Add markers for each place
        tripData.placesDetail.forEach(place => {
            if (place.coordinates) {
                const placeType = PLACE_TYPES.find(type => type.value === place.type) || PLACE_TYPES[0];
                
                // Create marker element
                const el = document.createElement('div');
                el.className = 'marker';
                el.innerHTML = `            
                    <div class="marker-circle">
                        <i class="${placeType.icon}"></i>
                    </div>
                `;

                 // Add hover effect listeners
                el.addEventListener('mouseenter', () => {
                    el.classList.add('marker-hover');
                });
                
                el.addEventListener('mouseleave', () => {
                    el.classList.remove('marker-hover');
                });
                
                // Add marker to map
                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'center'  // This is important
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
                    .addTo(map);

                // Extend bounds to include this marker
                bounds.extend([place.coordinates.longitude, place.coordinates.latitude]);
            }
        });

        // Fit map to show all markers with padding
        map.fitBounds(bounds, {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            maxZoom: 8,
        });
    }

    const commentInput = document.getElementById('newCommentText');
    const submitButton = document.getElementById('submitComment');

    // Auto-grow textarea function
    function autoGrow(element) {
        element.style.height = 'auto';
        element.style.height = (element.scrollHeight) + 'px';
    }

    // Handle input changes
    commentInput.addEventListener('input', () => {
        submitButton.disabled = !commentInput.value.trim();
        autoGrow(commentInput);
    });

    // Reset height on initial load
    autoGrow(commentInput);

}

function initializeFilters() {
    const filterBtn = document.getElementById('tripFilterBtn');
    const filterMenu = document.getElementById('filterMenu');
    
    // Toggle filter menu
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterMenu.classList.toggle('show');
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

    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = `
            <div class="no-comments">
                Error loading comments
            </div>
        `;
    }
}

function cleanupMap() {
    if (state.currentMap) {
        state.currentMap.remove(); // Remove the previous map instance
        state.currentMap = null;
    }
}

function initializeMap(places) {
    // Clean up any existing map first
    cleanupMap();
    
    // Get the map container
    const mapContainer = document.getElementById('tripMap');
    if (!mapContainer) return;
    
    // Clear the container
    mapContainer.innerHTML = '';
    
    // Create new map instance
    const map = new mapboxgl.Map({
        container: 'tripMap',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [0, 0], // Default center
        zoom: 1
    });
    
    // Store the map instance
    state.currentMap = map;
    
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl());
    
    // Rest of your map initialization code...
    // Add markers, fit bounds, etc.
}

function initializeCommentForm() {
    const submitButton = document.getElementById('submitComment');
    const commentInput = document.getElementById('newCommentText');

    submitButton.addEventListener('click', async () => {
        const comment = commentInput.value.trim();
        if (!comment) return;

        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                console.error('No authenticated user found');
                return;
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
                userId: user.uid
            };

            // Update Firestore
            const tripRef = firebase.firestore()
                .collection('trips')
                .doc(state.currentTrip.id);

            await tripRef.update({
                commentsHistory: firebase.firestore.FieldValue.arrayUnion(commentData)
            });

            // Update local state
            state.currentTrip.commentsHistory = state.currentTrip.commentsHistory || [];
            state.currentTrip.commentsHistory.push(commentData);

            // Clear input and refresh comments display
            commentInput.value = '';
            await loadComments();

        } catch (error) {
            console.error('Error saving comment:', error);
        }
    });

    // Enable/disable submit button based on input
    commentInput.addEventListener('input', () => {
        submitButton.disabled = !commentInput.value.trim();
    });
}


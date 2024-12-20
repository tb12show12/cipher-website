import { TRIP_TYPES, PLACE_TYPES, DEFAULTS } from '/admin/config.js';

const searchClient = algoliasearch('WADPYQO9WN', '37148f9e28cd367ebb6c1cfdb4852db6');
const tripIndex = searchClient.initIndex('tripIndex');
const userIndex = searchClient.initIndex('userIndex');

// Load and inject the navigation HTML
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/components/nav/nav.html');
        const html = await response.text();
        document.getElementById('nav-container').innerHTML = html;
        
        // Wait for Firebase auth to be ready
        const user = await window.firebaseAuthReady;
        
        if (user) {
            try {
                const userDoc = await firebase.firestore()
                    .collection('users')
                    .doc(user.uid)
                    .get();
                
                const userData = userDoc.data();
                
                // Update both profile picture and name if userData exists
                if (userData) {
                    const profileLink = document.querySelector('.nav-item.nav-profile');
                    
                    // Update profile picture if it exists
                    if (userData.pPic) {
                        const profilePic = profileLink.querySelector('.nav-profile-pic');
                        if (profilePic) {
                            profilePic.src = userData.pPic;
                        }
                    }
                    
                    // Update display name
                    const nameSpan = profileLink.querySelector('span');
                    if (nameSpan && userData.displayName) {
                        nameSpan.textContent = userData.displayName;
                    }
                } else {
                    console.log('User data not found');
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        }

        // Add active class based on current page
        const currentPath = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            if (item.getAttribute('href') === currentPath) {
                item.classList.add('active');
            }
        });

        const logoutButton = document.querySelector('i.fa-sign-out-alt').closest('.nav-item');

        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await firebase.auth().signOut();
                window.location.href = '/';
            } catch (error) {
                console.error('Error signing out:', error);
            }
        });

        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('navSearchResults');

        let debounceTimer;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();

            if (query === '') {
                searchResults.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    // Use multipleQueries for better efficiency
                    const { results } = await searchClient.multipleQueries([
                        {
                            indexName: 'tripIndex',
                            query,
                            params: {
                                hitsPerPage: 10,
                                attributesToRetrieve: [
                                    'title', 'shortDescription', 'creatorName', 
                                    'creatorId', 'tripCoverPic', 'month', 'year', 
                                    'familyType', 'numPeople', 'days'
                                ]
                            }
                        },
                        {
                            indexName: 'userIndex',
                            query,
                            params: {
                                hitsPerPage: 10,
                                attributesToRetrieve: [
                                    'displayName', 'pPic', 'location', 'trips'
                                ]
                            }
                        }
                    ]);
    
                    const [tripResults, userResults] = results;
    
                    if (tripResults.hits.length > 0 || userResults.hits.length > 0) {
                        // Generate HTML for trips
                        const tripsHTML = tripResults.hits.length > 0 ? `
                            <div class="search-results-section">
                                <div class="nav-search-results-header">
                                    <i class="fas fa-compass"></i> Trips
                                </div>
                                ${tripResults.hits.map(hit => {
                                    const tripType = TRIP_TYPES.find(type => type.value === parseInt(hit.familyType)) || TRIP_TYPES[0];
                                    return `
                                        <button class="search-result-item" data-trip-id="${hit.objectID}" data-creator-id="${hit.creatorId}">
                                            <div class="search-result-image" 
                                                 style="background-image: url('${hit.tripCoverPic || '/assets/images/default-cover.jpg'}')">
                                            </div>
                                            <div class="search-result-info">
                                                <h4>${hit.title}</h4>
                                                <p>by ${hit.creatorName}</p>
                                                <p>${hit.month} ${hit.year}</p>
                                            </div>
                                            <div class="search-result-details">
                                                <p>${hit.days} ${parseInt(hit.days) === 1 ? 'day' : 'days'} · 
                                                   ${hit.numPeople} ${parseInt(hit.numPeople) === 1 ? 'person' : 'people'}</p>
                                                <p><i class="${tripType.icon}"></i> ${tripType.label}</p>
                                            </div>
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        ` : '';
    
                        // Generate HTML for users
                        const usersHTML = userResults.hits.length > 0 ? `
                            <div class="search-results-section">
                                <div class="nav-search-results-header">
                                    <i class="fas fa-user"></i> Users
                                </div>
                                ${userResults.hits.map(user => `
                                    <button class="search-result-item user-result" data-user-id="${user.objectID}">
                                        <div class="search-result-avatar">
                                            <img src="${user.pPic || '/assets/default-avatar.png'}" alt="${user.displayName}">
                                        </div>
                                        <div class="search-result-info">
                                            <h4>${user.displayName}</h4>
                                            <p>${user.location || 'Location not specified'}</p>
                                        </div>
                                        <div class="search-result-details">
                                            <p><i class="fas fa-compass"></i></p>    
                                            <p>${user.trips?.length || 0} trips</p>    
                                        </div>
                                    </button>
                                `).join('')}
                            </div>
                        ` : '';
    
                        searchResults.innerHTML = tripsHTML + usersHTML;
                        searchResults.style.display = 'block';
                    } else {
                        searchResults.innerHTML = '<div class="no-results">No results found</div>';
                        searchResults.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Search error:', error);
                }
            }, 300);
        });

        // Add click handlers using event delegation
        searchResults.addEventListener('click', async (e) => {
            const tripResult = e.target.closest('.search-result-item:not(.user-result)');
            const userResult = e.target.closest('.user-result');
            
            // Close search results
            searchInput.value = '';
            searchResults.style.display = 'none';
            
            if (tripResult) {
                const tripId = tripResult.dataset.tripId;
                const creatorId = tripResult.dataset.creatorId;
                
                // Check if we're on the navigate page
                if (window.location.pathname.includes('/pages/navigate')) {
                    // Already on navigate, just dispatch event
                    document.dispatchEvent(new CustomEvent('loadNavigatePage', {
                        detail: { tripId, userId: creatorId }
                    }));
                } else {
                    // Redirect to navigate page with parameters
                    window.location.href = `/pages/navigate/navigate.html?tripId=${tripId}`;
                }
            }
            
            if (userResult) {
                const userId = userResult.dataset.userId;
                
                if (window.location.pathname.includes('/pages/navigate')) {
                    // Already on navigate, just dispatch event
                    document.dispatchEvent(new CustomEvent('loadNavigatePage', {
                        detail: { userId }
                    }));
                } else {
                    // Redirect to navigate page with parameter
                    window.location.href = `/pages/navigate/navigate.html?userId=${userId}`;
                }
            }
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });

         // Add click handler for My Profile nav item
        const profileNavItem = document.querySelector('.nav-item.nav-profile');
        if (profileNavItem) {
            profileNavItem.addEventListener('click', async (e) => {
            e.preventDefault();
            //console.log('profileNavItem clicked');

            // Check if we're on the navigate page
            if (window.location.pathname.includes('/pages/navigate')) {
                if (user) {
                //console.log('on navigate page, loading user profile');
                document.dispatchEvent(new CustomEvent('loadNavigatePage', {
                    detail: { userId: user.uid }
                }));
                }
            } else {
                // If not on navigate page, redirect to it first
                //console.log('not on navigate page, redirecting to it first');
                window.location.href = '/pages/navigate/navigate.html';
            }
            });
        }

        const discoverNavItem = document.querySelector('.nav-item.nav-discover');
        if (discoverNavItem) {
            discoverNavItem.addEventListener('click', async (e) => {
                e.preventDefault();
                //console.log('discoverNavItem clicked');

                // Check if we're on the navigate page
                if (window.location.pathname.includes('/pages/navigate')) {
                    if (user) {
                    document.dispatchEvent(new CustomEvent('loadNavigatePage', {
                        detail: { userId: null, tripId: null }
                    }));
                    }
                } else {
                    // If not on navigate page, redirect to it first
                    //console.log('not on navigate page, redirecting to it first');
                    window.location.href = '/pages/navigate/navigate.html';
                }
            });
        }

    } catch (error) {
        console.error('Error loading navigation:', error);
    }
});
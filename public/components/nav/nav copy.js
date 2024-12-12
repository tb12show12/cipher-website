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
                
                // Check if userData exists and has pPic before updating
                if (userData && userData.pPic) {
                    const profilePic = document.querySelector('.nav-item .nav-profile-pic');
                    if (profilePic) {
                        profilePic.src = userData.pPic;
                    }
                } else {
                    console.log('User data or profile picture not found');
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
            
            if (!e.target.value) {
                searchResults.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const { hits } = await tripIndex.search(e.target.value, {
                        hitsPerPage: 5,
                        attributesToRetrieve: ['title', 'shortDescription', 'creatorName', 'creatorId', 'tripCoverPic', 'month', 'year', 'familyType', 'numPeople', 'days'],
                    });

                    if (hits.length > 0) {
                        searchResults.innerHTML = hits.map(hit => {
                            const tripType = TRIP_TYPES.find(type => type.value === parseInt(hit.familyType)) || TRIP_TYPES[0];
                            console.log('hit', hit);
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
                                    <div class="search-result-details" style="text-align: right;">
                                        <p>
                                            ${hit.days} ${parseInt(hit.days) === 1 ? 'day' : 'days'} · 
                                            ${hit.numPeople} ${parseInt(hit.numPeople) === 1 ? 'person' : 'people'}
                                        </p>
                                        <p>
                                            <i class="${tripType.icon}"></i> ${tripType.label}
                                        </p>
                                    </div>
                                </button>
                            `;
                        }).join('');

                        // Add click handler using event delegation
                        searchResults.addEventListener('click', async (e) => {
                            const resultItem = e.target.closest('.search-result-item');
                            if (!resultItem) return;

                            console.log(resultItem.dataset);

                            const tripId = resultItem.dataset.tripId;
                            const creatorId = resultItem.dataset.creatorId;

                            // If we're on navigate page
                            if (window.location.pathname.includes('/pages/navigate')) {
                                // Update URL without reload
                                const newUrl = new URL(window.location.href);
                                newUrl.searchParams.set('tripId', tripId);
                                window.history.pushState({ tripId }, '', newUrl);

                                // Load creator profile and trip
                                document.dispatchEvent(new CustomEvent('loadNavigatePage', {
                                    detail: { userId: creatorId, tripId: tripId }
                                }));

                                // Hide search results
                                searchResults.style.display = 'none';
                            } else {
                                // Redirect to navigate page with tripId
                                window.location.href = `/pages/navigate/navigate.html?tripId=${tripId}`;
                            }
                        });

                        searchResults.style.display = 'block';
                    } else {
                        searchResults.innerHTML = `
                            <div class="search-result-item">
                                <div class="search-result-info">
                                    <p>No results found</p>
                                </div>
                            </div>
                        `;
                        searchResults.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Search error:', error);
                }
            }, 300);
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
                 console.log('profileNavItem clicked');

                 // Check if we're on the navigate page
                 if (window.location.pathname.includes('/pages/navigate')) {
                     if (user) {
                        console.log('on navigate page, loading user profile');
                        document.dispatchEvent(new CustomEvent('loadNavigatePage', {
                            detail: { userId: user.uid }
                        }));
                     }
                 } else {
                     // If not on navigate page, redirect to it first
                     console.log('not on navigate page, redirecting to it first');
                     window.location.href = '/pages/navigate/navigate.html';
                 }
             });
         }

         const discoverNavItem = document.querySelector('.nav-item.nav-discover');
         if (discoverNavItem) {
             discoverNavItem.addEventListener('click', async (e) => {
                 e.preventDefault();
                 console.log('discoverNavItem clicked');

                 // Check if we're on the navigate page
                 if (window.location.pathname.includes('/pages/navigate')) {
                     if (user) {
                        document.dispatchEvent(new CustomEvent('loadNavigatePage', {
                            detail: { userId: null, tripId: null }
                        }));
                     }
                 } else {
                     // If not on navigate page, redirect to it first
                     console.log('not on navigate page, redirecting to it first');
                     window.location.href = '/pages/navigate/navigate.html';
                 }
             });
         }

    } catch (error) {
        console.error('Error loading navigation:', error);
    }
});
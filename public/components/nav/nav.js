const searchClient = algoliasearch('WADPYQO9WN', '37148f9e28cd367ebb6c1cfdb4852db6');
const tripIndex = searchClient.initIndex('tripIndex');

// Load and inject the navigation HTML
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/components/nav/nav.html');
        const html = await response.text();
        document.getElementById('nav-container').innerHTML = html;
        
        // Wait for Firebase auth to be ready
        const user = await window.firebaseAuthReady;
        
        if (user) {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();
            
            const userData = userDoc.data();
            console.log('User Pic: ', userData.pPic);
            
            // Update profile picture if it exists
            const profilePic = document.querySelector('.nav-item .nav-profile-pic');
            if (profilePic && userData?.pPic) {
                profilePic.src = userData.pPic;
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

        // Add logout handler
        const logoutButton = document.querySelector('i.fa-sign-out-alt').closest('.nav-item');
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await firebase.auth().signOut();
                window.location.href = '/admin/index.html';
            } catch (error) {
                console.error('Error signing out:', error);
            }
        });

        
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

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
                        attributesToRetrieve: ['title', 'shortDescription', 'creatorName', 'tripCoverPic', 'month', 'year'],
                    });

                    if (hits.length > 0) {
                        searchResults.innerHTML = hits.map(hit => `
                            <button 
                                onclick="window.location.href='/tripview?tripId=${hit.objectID}'"
                                class="search-result-item">
                                <div class="search-result-image" 
                                     style="background-image: url('${hit.tripCoverPic || '/assets/images/default-cover.jpg'}')">
                                </div>
                                <div class="search-result-info">
                                    <h4>${hit.title}</h4>
                                    <p>by ${hit.creatorName}</p>
                                    <p>${hit.month} ${hit.year}</p>
                                </div>
                            </button>
                        `).join('');
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

    } catch (error) {
        console.error('Error loading navigation:', error);
    }
});
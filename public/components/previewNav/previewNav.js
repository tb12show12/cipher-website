import { TRIP_TYPES, PLACE_TYPES, DEFAULTS } from '/admin/config.js';

const searchClient = algoliasearch('WADPYQO9WN', '37148f9e28cd367ebb6c1cfdb4852db6');
const tripIndex = searchClient.initIndex('tripIndex');
const userIndex = searchClient.initIndex('userIndex');

// Load and inject the navigation HTML
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/components/previewNav/previewNav.html');
        const html = await response.text();
        document.getElementById('nav-container').innerHTML = html;


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
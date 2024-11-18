document.addEventListener("DOMContentLoaded", function() {
    const input = document.getElementById('placesAutocomplete');
    const resultsList = document.getElementById('placesList');

    window.placesAdded = window.placesAdded || [];

    function addPlaceToList(place) {
        const li = document.createElement('li');
        li.textContent = `${place.description}`;
        li.onclick = () => {
            savePlace(place);
            input.value = ''; // Clear the search bar text when a place is clicked
        }
        resultsList.appendChild(li);
    }

    function savePlace(place) {
        const savedList = document.getElementById('savedPlacesList');
        const li = document.createElement('li');
        li.textContent = `${place.description}`;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = function() {
            li.remove();
            window.placesAdded = window.placesAdded.filter(p => p.place_id !== place.place_id);
        };
        li.appendChild(deleteBtn);
        savedList.appendChild(li);

        window.placesAdded.push(place);
        resultsList.innerHTML = '';
    }

    input.addEventListener('input', debounce(function() {
        if (input.value.length < 3) {
            resultsList.innerHTML = '';
            return;
        }

        fetch(`/api/googlePlacesProxy?input=${encodeURIComponent(input.value)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                resultsList.innerHTML = ''; // Clear previous results
                if (data.predictions && Array.isArray(data.predictions)) {
                    data.predictions.forEach(prediction => {
                        addPlaceToList({
                            description: prediction.description,
                            place_id: prediction.place_id,
                        });
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching places:', error);
                resultsList.innerHTML = '<li class="error">Error fetching places</li>';
            });
    }, 300)); // Debounce for 300ms
});

// Add a debounce function to prevent too many API calls
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

// Add a cleanup function that can be called when needed
window.resetPlaces = function() {
    window.placesAdded = [];
    const savedList = document.getElementById('savedPlacesList');
    if (savedList) {
        savedList.innerHTML = '';
    }
    console.log('Places reset');
}
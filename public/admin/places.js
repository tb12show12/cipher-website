document.addEventListener("DOMContentLoaded", function() {
    const input = document.getElementById('placesAutocomplete');
    const resultsList = document.getElementById('placesList');
    let placesAdded = [];

    window.placesAdded = placesAdded;

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
            placesAdded = placesAdded.filter(p => p.place_id !== place.place_id);
        };
        li.appendChild(deleteBtn);
        savedList.appendChild(li);

        placesAdded.push(place);
        resultsList.innerHTML = '';
    }

    input.addEventListener('input', function() {
        if (input.value.length < 3) return; // Reduce unnecessary API calls
        fetch(`/api/googlePlacesProxy?input=${encodeURIComponent(input.value)}`)
            .then(response => response.json())
            .then(data => {
                resultsList.innerHTML = ''; // Clear previous results
                data.predictions.forEach(prediction => {
                    addPlaceToList({
                        description: prediction.description,
                        place_id: prediction.place_id,
                    });
                });
            })
            .catch(error => console.error('Error fetching places:', error));
    });
});
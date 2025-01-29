// Trip Types Configuration (non-module version)

import { TRIP_TYPES, PLACE_TYPES } from "./config";

const DEFAULTS = {
    defaultTripCoverPic: "https://firebasestorage.googleapis.com/v0/b/cipher-4fa1c.appspot.com/o/trips%2Fdefault%2FdefaultTripCoverPic.jpg?alt=media&token=dd4f49c0-08ea-4788-b0d1-d10abdbc7b8a"
};

/*
const TRIP_TYPES = [
    { value: 0, label: '👥 Adults Only' },
    { value: 1, label: '👨‍👩‍👧‍👦 Family Trip' },
    { value: 2, label: '👶 Baby Friendly' },
    { value: 3, label: '🎉 Bachelor/Bachelorette' },
    { value: 4, label: '🏌️ Golf Trip' },
    { value: 5, label: '💍 Honeymoon' },
    { value: 6, label: '🎒 Solo Travels' },
    { value: 7, label: '🚐 RV Trip' }
];

const PLACE_TYPES = [
    {value: 'airbnb', label: 'Airbnb', category:'toStay', icon: 'fa-brands fa-airbnb'},
    {value: 'b&b', label: 'B&B/Inn', category:'toStay', icon: 'fa-solid fa-mug-hot'},
    {value: 'bar', label: 'Bar', category:'toEat', icon: 'fa-solid fa-beer-mug-empty'},
    {value: 'beach', label: 'Beach', category:'toDo', icon: 'fa-solid fa-umbrella-beach'},
    {value: 'biking', label: 'Biking', category:'toDo', icon: 'fa-solid fa-bicycle'},
    {value: 'boating', label: 'Boating', category:'toDo', icon: 'fa-solid fa-sailboat'},
    {value: 'brewery', label: 'Brewery', category:'toEat', icon: 'fa-solid fa-beer-mug-empty'},
    {value: 'campground', label: 'Campground', category:'toStay', icon: 'fa-solid fa-campground'},
    {value: 'casino', label: 'Casino', category:'toDo', icon: 'fa-solid fa-dice'},
    {value: 'club', label: 'Club', category:'toDo', icon: 'fa-solid fa-music'},
    {value: 'concert venue', label: 'Concert Venue', category:'toDo', icon: 'fa-solid fa-music'},
    {value: 'farm', label: 'Farm', category:'toDo', icon: 'fa-solid fa-wheat-awn'},
    {value: 'gallery', label: 'Gallery', category:'toDo', icon: 'fa-solid fa-palette'},
    {value: 'golf', label: 'Golf Course', category:'toDo', icon: 'fa-solid fa-golf-ball-tee'},
    {value: 'hike', label: 'Hike/Walk', category:'toDo', icon: 'fa-solid fa-person-hiking'},
    {value: 'historical-landmark', label: 'Historical Landmark', category:'toDo', icon: 'fa-solid fa-monument'},
    {value: 'hostel', label: 'Hostel', category:'toStay', icon: 'fa-solid fa-bed'},
    {value: 'hotel', label: 'Hotel', category:'toStay', icon: 'fa-solid fa-hotel'},
    {value: 'city/town', label: 'City or Town', category:'toDo', icon: 'fa-solid fa-city'},
    {value: 'lounge', label: 'Lounge', category:'toEat', icon: 'fa-solid fa-martini-glass'},
    {value: 'museum', label: 'Museum', category:'toDo', icon: 'fa-solid fa-landmark'},
    {value: 'other', label: 'Other', category:'toDo', icon: 'fa-solid fa-location-dot'},
    {value: 'park', label: 'Park', category:'toDo', icon: 'fa-solid fa-tree'},
    {value: 'place-of-worship', label: 'Place of Worship', category:'toDo', icon: 'fa-solid fa-place-of-worship'},
    {value: 'rentalProperty', label: 'Rental House', category:'toStay', icon: 'fa-solid fa-house'},
    {value: 'resort', label: 'Resort', category:'toStay', icon: 'fa-solid fa-umbrella-beach'},
    {value: 'restaurant', label: 'Restaurant', category:'toEat', icon: 'fa-solid fa-utensils'},
    {value: 'rv', label: 'RV', category:'toStay', icon: 'fa-solid fa-rv'},
    {value: 'school', label: 'School/University', category:'toDo', icon: 'fa-solid fa-school'},
    {value: 'shopping', label: 'Shopping', category:'toDo', icon: 'fa-solid fa-shopping-bag'},
    {value: 'ski', label: 'Skiing/Snowboarding', category:'toDo', icon: 'fa-solid fa-person-skiing'},
    {value: 'spa', label: 'Spa', category:'toDo', icon: 'fa-solid fa-spa'},
    {value: 'sports venue', label: 'Sports Venue', category:'toDo', icon: 'fa-solid fa-football'},
    {value: 'theater', label: 'Theater', category:'toDo', icon: 'fa-solid fa-masks-theater'},
    {value: 'tour', label: 'Tour', category:'toDo', icon: 'fa-solid fa-map-marked-alt'},
    {value: 'vacasa', label: 'Vacasa', category:'toStay', icon: 'fa-solid fa-house'},
    {value: 'winery', label: 'Winery/Distillery', category:'toEat', icon: 'fa-solid fa-wine-bottle'},
];
*/
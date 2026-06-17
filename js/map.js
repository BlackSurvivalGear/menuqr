import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Map State
let map;
let markers = [];
let businesses = [];

// DOM Elements
const searchInput = document.getElementById('search-input');
const countryFilter = document.getElementById('country-filter');
const cityFilter = document.getElementById('city-filter');
const categoryFilter = document.getElementById('category-filter');
const cuisineFilter = document.getElementById('cuisine-filter');
const applyFiltersBtn = document.getElementById('apply-filters');
const nearMeBtn = document.getElementById('near-me-btn');

/**
 * Initialize the map
 */
function initMap() {
    // Default center (Africa context)
    map = L.map('map').setView([0, 20], 3);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initial fetch
    fetchBusinesses();
}

/**
 * Fetch approved businesses from Firestore
 */
async function fetchBusinesses() {
    try {
        const q = query(collection(db, "businesses"), where("approved", "==", true));
        const querySnapshot = await getDocs(q);

        businesses = [];
        querySnapshot.forEach((doc) => {
            businesses.push({ id: doc.id, ...doc.data() });
        });

        populateCountryFilter();
        renderMarkers(businesses);
    } catch (error) {
        console.error("Error fetching businesses:", error);
    }
}

/**
 * Populate country dropdown with unique countries from data
 */
function populateCountryFilter() {
    const countries = [...new Set(businesses.map(b => b.country).filter(Boolean))].sort();
    countryFilter.innerHTML = '<option value="">All Countries</option>';
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countryFilter.appendChild(option);
    });
}

/**
 * Render markers on the map
 */
function renderMarkers(data) {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    data.forEach(biz => {
        if (biz.latitude && biz.longitude) {
            const marker = L.marker([biz.latitude, biz.longitude]).addTo(map);

            const popupContent = `
                <div class="map-popup">
                    ${biz.logoUrl ? `<img src="${biz.logoUrl}" class="popup-logo">` : '<div class="popup-logo" style="display:flex;align-items:center;justify-content:center;color:#ccc;">No Logo</div>'}
                    <div class="popup-info">
                        <div class="popup-title">${biz.businessName}</div>
                        <div class="popup-meta">${biz.category} • ${biz.city}, ${biz.country}</div>
                        <div class="popup-actions">
                            <a href="menu.html?id=${biz.id}" class="btn btn-primary btn-small">View Menu</a>
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${biz.latitude},${biz.longitude}" target="_blank" class="btn btn-outline btn-small">Directions</a>
                        </div>
                        <div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.25rem; align-items:center; font-size:0.8rem;">
                            ${biz.phone ? `<a href="tel:${biz.phone}" style="color:var(--text-color); font-weight:600;">📞 ${biz.phone}</a>` : ''}
                            ${biz.website ? `<a href="${biz.website}" target="_blank" style="color:var(--primary-color); font-weight:600;">🌐 Visit Website</a>` : ''}
                        </div>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent);
            markers.push(marker);
        }
    });

    // If data exists, adjust view
    if (data.length > 0 && markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

/**
 * Apply filters
 */
function applyFilters() {
    const search = searchInput.value.toLowerCase();
    const country = countryFilter.value;
    const city = cityFilter.value.toLowerCase();
    const category = categoryFilter.value;
    const cuisine = cuisineFilter.value.toLowerCase();

    const filtered = businesses.filter(biz => {
        const matchesSearch = !search || biz.businessName.toLowerCase().includes(search);
        const matchesCountry = !country || biz.country === country;
        const matchesCity = !city || (biz.city && biz.city.toLowerCase().includes(city));
        const matchesCategory = !category || biz.category === category;
        const matchesCuisine = !cuisine || (biz.cuisine && biz.cuisine.toLowerCase().includes(cuisine));
        return matchesSearch && matchesCountry && matchesCity && matchesCategory && matchesCuisine;
    });

    renderMarkers(filtered);
}

/**
 * Near Me functionality
 */
function nearMe() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    nearMeBtn.textContent = "⌛ Finding...";
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 12);
            nearMeBtn.textContent = "📍 Near Me";
        },
        () => {
            alert("Unable to retrieve your location");
            nearMeBtn.textContent = "📍 Near Me";
        }
    );
}

// Event Listeners
applyFiltersBtn.addEventListener('click', applyFilters);
nearMeBtn.addEventListener('click', nearMe);

// Initialize
initMap();

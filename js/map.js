import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";
import { COUNTRIES } from "./countries.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Map State
let map;
let tileLayer;
let markerCluster;
let businesses = [];
let currentTheme = 'dark'; // Default theme

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

    updateMapTiles();

    // Initial fetch
    fetchBusinesses();
}

/**
 * Update map tiles based on current theme
 */
function updateMapTiles() {
    if (tileLayer) {
        map.removeLayer(tileLayer);
    }

    if (currentTheme === 'dark') {
        tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        });
    } else {
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
    }

    tileLayer.addTo(map);
}

/**
 * Fetch all businesses from Firestore
 */
async function fetchBusinesses() {
    try {
        const q = query(collection(db, "businesses"));
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
 * Populate country dropdown with all supported countries
 */
function populateCountryFilter() {
    countryFilter.innerHTML = '<option value="">All Countries</option>';
    COUNTRIES.forEach(country => {
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
    // Clear existing clusters
    if (markerCluster) {
        map.removeLayer(markerCluster);
    }

    markerCluster = L.markerClusterGroup();

    // Custom Icons - Theme Aware
    const goldIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const greyIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const orangeIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    data.forEach(biz => {
        if (biz.latitude && biz.longitude) {
            let icon;
            let statusText = "Pending Verification";
            let statusClass = "status-pending";

            if (currentTheme === 'dark') {
                icon = greyIcon; // Default: Pending (Black/Grey in Dark Mode)
                if (biz.status === "location_issue") {
                    icon = redIcon;
                    statusText = "Needs Attention";
                    statusClass = "status-error";
                } else if (biz.verified) {
                    icon = goldIcon;
                    statusText = "Verified Business";
                    statusClass = "status-verified";
                }
            } else {
                icon = orangeIcon; // Default: Pending (Orange in Standard Mode)
                if (biz.status === "location_issue") {
                    icon = redIcon;
                    statusText = "Location Issue";
                    statusClass = "status-error";
                } else if (biz.verified) {
                    icon = greenIcon;
                    statusText = "Verified Business";
                    statusClass = "status-verified";
                }
            }

            const marker = L.marker([biz.latitude, biz.longitude], { icon: icon });

            const popupContent = `
                <div class="map-popup">
                    ${biz.logoUrl ? `<img src="${biz.logoUrl}" class="popup-logo">` : '<div class="popup-logo" style="display:flex;align-items:center;justify-content:center;color:#ccc;">No Logo</div>'}
                    <div class="popup-info">
                        <div class="popup-title">${biz.businessName}</div>
                        <div class="popup-meta" style="margin-bottom:0.25rem;">${biz.category} • ${biz.city}, ${biz.country}</div>
                        <div class="popup-status ${statusClass}" style="font-size:0.75rem; font-weight:700; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.25rem;">
                            <span class="status-dot"></span> ${statusText}
                        </div>
                        <div class="popup-actions">
                            <a href="business.html?id=${biz.id}" class="btn btn-primary btn-small">View Profile</a>
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
            markerCluster.addLayer(marker);
        }
    });

    map.addLayer(markerCluster);

    // If data exists, adjust view
    if (data.length > 0) {
        map.fitBounds(markerCluster.getBounds().pad(0.1));
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

/**
 * Theme Management
 */
function initTheme() {
    const savedTheme = localStorage.getItem("melaninMapsTheme");
    if (savedTheme) {
        currentTheme = savedTheme;
    }
    applyTheme(currentTheme);
}

function applyTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    // Ensure the body has the melaninmaps-theme class
    document.body.classList.add('melaninmaps-theme');
    localStorage.setItem("melaninMapsTheme", theme);

    // Update Toggle UI
    const darkBtn = document.getElementById('theme-dark-btn');
    const standardBtn = document.getElementById('theme-standard-btn');

    if (darkBtn && standardBtn) {
        if (theme === 'dark') {
            darkBtn.classList.add('active');
            standardBtn.classList.remove('active');
        } else {
            standardBtn.classList.add('active');
            darkBtn.classList.remove('active');
        }
    }

    // Update Map if already initialized
    if (map) {
        updateMapTiles();
        renderMarkers(businesses);
    }
}

// Theme Toggle Listeners
document.getElementById('theme-dark-btn')?.addEventListener('click', () => applyTheme('dark'));
document.getElementById('theme-standard-btn')?.addEventListener('click', () => applyTheme('standard'));

// Initialize
initTheme();
initMap();

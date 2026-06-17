import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const profileContent = document.getElementById('profile-content');
const errorScreen = document.getElementById('error-screen');

const coverPhoto = document.getElementById('cover-photo');
const profileLogo = document.getElementById('profile-logo');
const profileName = document.getElementById('profile-name');
const statusText = document.getElementById('status-text');
const verificationBadge = document.getElementById('verification-status');
const categoryCuisine = document.getElementById('profile-category-cuisine');

const viewMenuBtn = document.getElementById('view-menu-btn');
const directionsBtn = document.getElementById('directions-btn');
const callBtn = document.getElementById('call-btn');
const whatsappBtn = document.getElementById('whatsapp-btn');
const websiteBtn = document.getElementById('website-btn');

const aboutText = document.getElementById('about-text');
const gallerySection = document.getElementById('gallery-section');
const galleryGrid = document.getElementById('gallery-grid');

const contactAddress = document.getElementById('contact-address');
const contactPhone = document.getElementById('contact-phone');
const contactPhoneItem = document.getElementById('contact-phone-item');
const contactEmail = document.getElementById('contact-email');
const contactEmailItem = document.getElementById('contact-email-item');
const contactWebsite = document.getElementById('contact-website');
const contactWebsiteItem = document.getElementById('contact-website-item');
const socialLinksContainer = document.getElementById('social-links');

const hoursSection = document.getElementById('hours-section');
const openNowStatus = document.getElementById('open-now-status');
const hoursTable = document.getElementById('hours-table');

const infoCountry = document.getElementById('info-country');
const infoCity = document.getElementById('info-city');
const infoCategory = document.getElementById('info-category');
const infoCuisine = document.getElementById('info-cuisine');
const infoStatus = document.getElementById('info-status');

/**
 * Main Init function
 */
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const businessId = urlParams.get('id');

    if (!businessId) {
        showError("Invalid business ID.");
        return;
    }

    try {
        const docRef = doc(db, "businesses", businessId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            renderProfile(businessId, data);
            incrementProfileViews(businessId);
        } else {
            showError("Business profile not found.");
        }
    } catch (error) {
        console.error("Error fetching business profile:", error);
        showError("An error occurred while loading the profile.");
    }
}

/**
 * Render profile data to UI
 */
function renderProfile(id, data) {
    // Basic Info
    document.title = `${data.businessName} | MelaninMaps™`;
    profileName.innerText = data.businessName;
    profileLogo.src = data.logoUrl || 'favi.png';
    coverPhoto.src = data.coverImageUrl || 'header.png';
    categoryCuisine.innerText = `${data.category} • ${data.cuisine || 'General'}`;

    // Verification Status
    let statusClass = "status-pending";
    let statusLabel = "Pending Verification";

    if (data.status === "location_issue") {
        statusClass = "status-error";
        statusLabel = "Needs Attention";
    } else if (data.verified) {
        statusClass = "status-verified";
        statusLabel = "Verified Business";
    }

    verificationBadge.className = `verification-badge ${statusClass}`;
    statusText.innerText = statusLabel;

    // Quick Actions
    viewMenuBtn.href = `menu.html?id=${id}`;
    directionsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`;

    if (data.phone) {
        callBtn.href = `tel:${data.phone}`;
        contactPhone.innerText = data.phone;
        contactPhoneItem.classList.remove('hidden');
    } else {
        callBtn.classList.add('hidden');
    }

    if (data.whatsapp) {
        const cleanWhatsApp = data.whatsapp.replace(/\D/g, '');
        whatsappBtn.href = `https://wa.me/${cleanWhatsApp}`;
    } else {
        whatsappBtn.classList.add('hidden');
    }

    if (data.website) {
        websiteBtn.href = data.website;
        contactWebsite.href = data.website;
        contactWebsiteItem.classList.remove('hidden');
    } else {
        websiteBtn.classList.add('hidden');
    }

    // About
    if (data.about) {
        aboutText.innerText = data.about;
    }

    // Contact
    contactAddress.innerText = data.address;
    if (data.email) {
        contactEmail.innerText = data.email;
        contactEmailItem.classList.remove('hidden');
    }

    // Social Media
    renderSocialLinks(data);

    // Opening Hours
    if (data.openingHours && Object.keys(data.openingHours).length > 0) {
        renderOpeningHours(data.openingHours);
    }

    // Gallery
    if (data.galleryImages && data.galleryImages.length > 0) {
        renderGallery(data.galleryImages);
    }

    // Meta Info
    infoCountry.innerText = data.country;
    infoCity.innerText = data.city;
    infoCategory.innerText = data.category;
    infoCuisine.innerText = data.cuisine || 'N/A';
    infoStatus.innerText = statusLabel;
    infoStatus.className = statusClass;

    // Show content
    loadingScreen.classList.add('hidden');
    profileContent.classList.remove('hidden');
}

/**
 * Renders Social Media Icons
 */
function renderSocialLinks(data) {
    const platforms = [
        { key: 'facebook', icon: '📘' },
        { key: 'instagram', icon: '📸' },
        { key: 'tiktok', icon: '🎵' },
        { key: 'twitter', icon: '𝕏' },
        { key: 'youtube', icon: '▶' },
        { key: 'whatsapp', icon: '💬' }
    ];

    socialLinksContainer.innerHTML = '';
    platforms.forEach(p => {
        if (data[p.key]) {
            const a = document.createElement('a');
            a.href = p.key === 'whatsapp' ? `https://wa.me/${data[p.key].replace(/\D/g, '')}` : data[p.key];
            a.target = '_blank';
            a.className = 'social-btn';
            a.innerText = p.icon;
            a.title = p.key.charAt(0).toUpperCase() + p.key.slice(1);
            socialLinksContainer.appendChild(a);
        }
    });
}

/**
 * Renders Opening Hours and calculates Open Now
 */
function renderOpeningHours(hours) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    hoursTable.innerHTML = '';

    days.forEach(day => {
        const row = document.createElement('div');
        row.className = 'hours-row';

        const daySpan = document.createElement('span');
        daySpan.className = 'hours-day';
        daySpan.textContent = day.charAt(0).toUpperCase() + day.slice(1);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'hours-time';
        timeSpan.textContent = hours[day] || 'Closed';

        row.appendChild(daySpan);
        row.appendChild(timeSpan);
        hoursTable.appendChild(row);
    });

    // Calculate Open Now
    const now = new Date();
    const currentDay = days[(now.getDay() + 6) % 7]; // Convert Sun-Sat to Mon-Sun
    const currentTime = now.getHours() * 100 + now.getMinutes();

    const todayHours = hours[currentDay];
    if (todayHours && todayHours.includes('-')) {
        const [open, close] = todayHours.split('-').map(t => parseInt(t.trim().replace(':', '')));
        const span = document.createElement('span');
        if (currentTime >= open && currentTime <= close) {
            span.style.color = 'var(--success-color)';
            span.textContent = '🟢 Open Now';
        } else {
            span.style.color = 'var(--error-color)';
            span.textContent = '🔴 Closed';
        }
        openNowStatus.innerHTML = '';
        openNowStatus.appendChild(span);
    } else {
        const span = document.createElement('span');
        span.style.color = 'var(--error-color)';
        span.textContent = '🔴 Closed';
        openNowStatus.innerHTML = '';
        openNowStatus.appendChild(span);
    }

    hoursSection.classList.remove('hidden');
}

/**
 * Renders Gallery
 */
function renderGallery(images) {
    galleryGrid.innerHTML = '';
    images.forEach(url => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        const img = document.createElement('img');
        img.src = url;
        img.className = 'gallery-img';
        img.loading = 'lazy';
        div.appendChild(img);
        galleryGrid.appendChild(div);
    });
    gallerySection.classList.remove('hidden');
}

/**
 * Increment view count
 */
function incrementProfileViews(id) {
    const docRef = doc(db, "businesses", id);
    updateDoc(docRef, {
        profileViews: increment(1)
    }).catch(err => console.warn("Failed to increment views:", err));
}

function showError(message) {
    loadingScreen.classList.add('hidden');
    errorScreen.classList.remove('hidden');
    document.getElementById('error-message').innerText = message;
}

// Handle Theme
function initTheme() {
    const savedTheme = localStorage.getItem("melaninMapsTheme") || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
}

initTheme();
init();

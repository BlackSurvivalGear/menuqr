import { auth, db, signOut } from "./auth.js";
import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    where,
    getDoc,
    doc,
    startAfter,
    limitToLast,
    endBefore,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// Global state for pagination and filtering
let usersData = [];
let restaurantsData = [];
let menuItemsData = [];

let usersPage = 1;
let restaurantsPage = 1;
const itemsPerPage = 10;

let lastUserDoc = null;
let firstUserDoc = null;
let lastRestaurantDoc = null;
let firstRestaurantDoc = null;

/**
 * Initialize Admin Dashboard
 */
async function init() {
    // Basic UI Tab Switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabContents.forEach(content => {
                if (content.id === tabId) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });
    });

    // Load Stats
    loadStats();

    // Load Users
    loadUsers();

    // Load Restaurants
    loadRestaurants();

    // Event Listeners for Search
    document.getElementById('user-search').addEventListener('input', debounce(() => {
        usersPage = 1;
        loadUsers(document.getElementById('user-search').value);
    }, 500));

    document.getElementById('restaurant-search').addEventListener('input', debounce(() => {
        restaurantsPage = 1;
        loadRestaurants(document.getElementById('restaurant-search').value);
    }, 500));

    // Event Listeners for Exports
    document.getElementById('export-users-btn').addEventListener('click', exportUsersCSV);
    document.getElementById('export-restaurants-btn').addEventListener('click', exportRestaurantsCSV);
}

/**
 * Load Platform Statistics
 */
async function loadStats() {
    try {
        const usersCount = await getCountFromServer(collection(db, "users"));
        const restaurantsCount = await getCountFromServer(collection(db, "restaurants"));
        const menuItemsCount = await getCountFromServer(collection(db, "menuItems"));

        document.getElementById('total-users').innerText = usersCount.data().count;
        document.getElementById('total-restaurants').innerText = restaurantsCount.data().count;
        document.getElementById('total-menu-items').innerText = menuItemsCount.data().count;
        document.getElementById('total-public-menus').innerText = restaurantsCount.data().count; // Assuming each restaurant has a menu
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

/**
 * Load Users Panel
 */
async function loadUsers(searchTerm = "") {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading users...</td></tr>';

    try {
        let q = query(collection(db, "users"), orderBy("createdAt", "desc"));

        // Note: Simple Firestore search is limited. For a real app, use Algolia or similar.
        // Here we'll fetch all and filter client-side for simplicity if searchTerm is provided,
        // OR just do a basic prefix search if possible.
        // Since we need to match email/username/uid, client-side filter is easier for this demo.

        const querySnapshot = await getDocs(q);
        let users = [];

        // We need to check if each user has a restaurant
        const restaurantDocs = await getDocs(collection(db, "restaurants"));
        const restaurantUids = new Set();
        restaurantDocs.forEach(doc => restaurantUids.add(doc.id));

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            users.push({
                uid: doc.id,
                email: data.email || "",
                username: data.email ? data.email.split('@')[0] : "N/A",
                plan: data.plan || "preview",
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                hasRestaurant: restaurantUids.has(doc.id)
            });
        });

        if (searchTerm) {
            users = users.filter(u =>
                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.username.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        usersData = users; // Save for export
        renderUsersTable(users);
    } catch (error) {
        console.error("Error loading users:", error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading users.</td></tr>';
    }
}

function renderUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '';

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.email}</td>
            <td>${user.username}</td>
            <td style="font-family: monospace; font-size: 0.75rem;">${user.uid}</td>
            <td><span class="badge ${user.plan === 'pro' ? 'badge-featured' : ''}">${user.plan}</span></td>
            <td>${user.createdAt.toLocaleDateString()}</td>
            <td>${user.hasRestaurant ? '✅ Yes' : '❌ No'}</td>
        `;
        tableBody.appendChild(tr);
    });

    document.getElementById('users-page-info').innerText = `Total: ${users.length}`;
}

/**
 * Load Restaurants Panel
 */
async function loadRestaurants(searchTerm = "") {
    const tableBody = document.getElementById('restaurants-table-body');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading restaurants...</td></tr>';

    try {
        const q = query(collection(db, "restaurants"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        // Fetch all users to get their plans
        const usersSnapshot = await getDocs(collection(db, "users"));
        const userPlans = {};
        usersSnapshot.forEach(doc => {
            userPlans[doc.id] = doc.data().plan || "preview";
        });

        let restaurants = [];

        // Fetch all menu items to count them per restaurant
        const menuItemsSnapshot = await getDocs(collection(db, "menuItems"));
        const menuCounts = {};
        menuItemsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.restaurantId) {
                menuCounts[data.restaurantId] = (menuCounts[data.restaurantId] || 0) + 1;
            }
        });

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            restaurants.push({
                uid: doc.id,
                businessName: data.businessName || "N/A",
                ownerName: data.ownerName || "N/A",
                ownerEmail: "", // We'll need to link this from users if needed
                plan: userPlans[doc.id] || "preview",
                phone: data.phone || "N/A",
                whatsapp: data.whatsapp || "N/A",
                address: data.address || "N/A",
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                menuCount: menuCounts[doc.id] || 0
            });
        });

        if (searchTerm) {
            restaurants = restaurants.filter(r =>
                r.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        restaurantsData = restaurants; // Save for export
        renderRestaurantsTable(restaurants);
    } catch (error) {
        console.error("Error loading restaurants:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading restaurants.</td></tr>';
    }
}

function renderRestaurantsTable(restaurants) {
    const tableBody = document.getElementById('restaurants-table-body');
    tableBody.innerHTML = '';

    if (restaurants.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No restaurants found.</td></tr>';
        return;
    }

    restaurants.forEach(res => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${res.businessName}</strong></td>
            <td>${res.ownerName}</td>
            <td><span class="badge ${res.plan === 'pro' ? 'badge-featured' : ''}">${res.plan}</span></td>
            <td>${res.phone}</td>
            <td>${res.createdAt.toLocaleDateString()}</td>
            <td>${res.menuCount}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <a href="menu.html?id=${res.uid}" target="_blank" class="btn btn-outline btn-small" title="View Public Menu">👁️</a>
                    <button class="btn btn-outline btn-small view-details" data-uid="${res.uid}" title="View Details">📝</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    document.getElementById('restaurants-page-info').innerText = `Total: ${restaurants.length}`;

    // Add event listeners for details
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.getAttribute('data-uid');
            const res = restaurants.find(r => r.uid === uid);
            alert(`
                Business: ${res.businessName}
                Owner: ${res.ownerName}
                Address: ${res.address}
                Phone: ${res.phone}
                WhatsApp: ${res.whatsapp}
                UID: ${res.uid}
            `);
        });
    });
}

/**
 * CSV Exports
 */
function exportUsersCSV() {
    if (usersData.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Email,Username,UID,Plan,Registration Date,Restaurant Status\n";

    usersData.forEach(u => {
        const row = [
            u.email,
            u.username,
            u.uid,
            u.plan,
            u.createdAt.toISOString(),
            u.hasRestaurant ? "Yes" : "No"
        ].join(",");
        csvContent += row + "\n";
    });

    downloadCSV(csvContent, "scanmenu_users.csv");
}

function exportRestaurantsCSV() {
    if (restaurantsData.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Business Name,Owner Name,Plan,Phone,WhatsApp,Address,Menu URL,Date Created\n";

    restaurantsData.forEach(r => {
        const row = [
            `"${r.businessName.replace(/"/g, '""')}"`,
            `"${r.ownerName.replace(/"/g, '""')}"`,
            r.plan,
            r.phone,
            r.whatsapp,
            `"${r.address.replace(/"/g, '""')}"`,
            `https://scanmenu.africa/menu.html?id=${r.uid}`,
            r.createdAt.toISOString()
        ].join(",");
        csvContent += row + "\n";
    });

    downloadCSV(csvContent, "scanmenu_restaurants.csv");
}

function downloadCSV(content, filename) {
    const encodedUri = encodeURI(content);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Utils
 */
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

// Start
init();

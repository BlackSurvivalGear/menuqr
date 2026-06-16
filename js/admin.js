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
    getCountFromServer,
    updateDoc,
    serverTimestamp,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

import { deleteUser } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

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

    // Modal close listeners
    document.getElementById('close-subscription-modal').addEventListener('click', hideSubscriptionModal);
    document.getElementById('cancel-subscription-btn').addEventListener('click', hideSubscriptionModal);

    // Delete Modal Listeners
    document.getElementById('close-delete-modal').addEventListener('click', hideDeleteModal);
    document.getElementById('cancel-delete-btn').addEventListener('click', hideDeleteModal);
    document.getElementById('delete-confirm-input').addEventListener('input', (e) => {
        document.getElementById('permanently-delete-btn').disabled = (e.target.value !== "DELETE");
    });
    document.getElementById('permanently-delete-btn').addEventListener('click', executeUserDeletion);
}

/**
 * User Deletion Functions
 */
let pendingDeletion = null;

function showDeleteModal(uid, email, businessName) {
    pendingDeletion = { uid, email, businessName };
    document.getElementById('delete-modal-user-email').innerText = email;
    document.getElementById('delete-modal-biz-name').innerText = businessName;
    document.getElementById('delete-confirm-input').value = "";
    document.getElementById('permanently-delete-btn').disabled = true;
    document.getElementById('delete-user-modal').classList.remove('hidden');
}

function hideDeleteModal() {
    pendingDeletion = null;
    document.getElementById('delete-user-modal').classList.add('hidden');
}

async function executeUserDeletion() {
    if (!pendingDeletion) return;

    const { uid, email } = pendingDeletion;
    const deleteBtn = document.getElementById('permanently-delete-btn');
    const originalText = deleteBtn.innerText;

    deleteBtn.disabled = true;
    deleteBtn.innerText = "Deleting...";

    try {
        // 1. Delete Firestore Data
        const batch = writeBatch(db);

        // Delete user doc
        batch.delete(doc(db, "users", uid));

        // Delete restaurant doc
        batch.delete(doc(db, "restaurants", uid));

        // Delete Menu Items
        const menuItemsQ = query(collection(db, "menuItems"), where("restaurantId", "==", uid));
        const menuItemsSnap = await getDocs(menuItemsQ);
        menuItemsSnap.forEach(item => batch.delete(item.ref));

        // Delete Menu Categories
        const categoriesQ = query(collection(db, "menuCategories"), where("restaurantId", "==", uid));
        const categoriesSnap = await getDocs(categoriesQ);
        categoriesSnap.forEach(cat => batch.delete(cat.ref));

        // Execute batch
        await batch.commit();

        // 2. Attempt Auth Deletion (Client-side limitation)
        let authDeleted = false;
        try {
            // Note: This only works if the admin is deleting THEIR OWN account,
            // OR if we are using Admin SDK (not available in client).
            // However, the requirement says "Attempt to delete... If Authentication deletion cannot be performed... Display warning"

            // In a standard Firebase client-side setup, you can't delete another user's auth account.
            // We'll check if the currentUser is the one being deleted (unlikely for admin dashboard).
            if (auth.currentUser && auth.currentUser.uid === uid) {
                await deleteUser(auth.currentUser);
                authDeleted = true;
            } else {
                // Cannot delete another user via client-side Auth API
                throw new Error("Client-side Firebase Auth can only delete the currently authenticated user.");
            }
        } catch (authError) {
            console.warn("Auth deletion skipped or failed:", authError.message);
        }

        hideDeleteModal();

        if (authDeleted) {
            alert("User and all associated data deleted successfully.");
        } else {
            alert(`User data deleted. Firebase Authentication account (${email}) must be removed manually from the Firebase Console.`);
        }

        loadUsers(); // Refresh the table
        loadStats(); // Update stats
    } catch (error) {
        console.error("Error during deletion:", error);
        alert("An error occurred during deletion: " + error.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerText = originalText;
    }
}

/**
 * Subscription Management Functions
 */
let pendingUpdate = null;

function showSubscriptionModal(uid, email, currentPlan, newPlan) {
    pendingUpdate = { uid, newPlan };
    document.getElementById('modal-user-email').innerText = email;
    document.getElementById('modal-current-plan').innerText = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
    document.getElementById('modal-new-plan').innerText = newPlan.charAt(0).toUpperCase() + newPlan.slice(1);
    document.getElementById('subscription-modal').classList.remove('hidden');
}

function hideSubscriptionModal() {
    pendingUpdate = null;
    document.getElementById('subscription-modal').classList.add('hidden');
}

document.getElementById('confirm-subscription-btn').addEventListener('click', async () => {
    if (!pendingUpdate) return;

    const { uid, newPlan } = pendingUpdate;
    const confirmBtn = document.getElementById('confirm-subscription-btn');
    const originalText = confirmBtn.innerText;

    confirmBtn.disabled = true;
    confirmBtn.innerText = "Updating...";

    try {
        const userRef = doc(db, "users", uid);

        // Calculate expiry date (1 year from now for standard/pro, null for preview)
        let subscriptionExpiry = null;
        if (newPlan === "standard" || newPlan === "pro") {
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            subscriptionExpiry = expiryDate;
        }

        const updateData = {
            plan: newPlan,
            subscriptionActivatedAt: serverTimestamp(),
            activatedBy: auth.currentUser ? auth.currentUser.email : "system",
            subscriptionExpiry: subscriptionExpiry
        };

        await updateDoc(userRef, updateData);

        hideSubscriptionModal();
        alert("Subscription updated successfully!");
        loadUsers(); // Refresh the table
    } catch (error) {
        console.error("Error updating subscription:", error);
        alert("Failed to update subscription. See console for details.");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerText = originalText;
    }
});

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
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading users...</td></tr>';

    try {
        let q = query(collection(db, "users"), orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);

        // Fetch all restaurants to link with users
        const restaurantDocs = await getDocs(collection(db, "restaurants"));
        const restaurantMap = {};
        restaurantDocs.forEach(doc => {
            restaurantMap[doc.id] = doc.data();
        });

        let users = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const restaurant = restaurantMap[doc.id] || {};

            users.push({
                uid: doc.id,
                email: data.email || "",
                businessName: restaurant.businessName || "N/A",
                ownerName: restaurant.ownerName || "N/A",
                plan: data.plan || "preview",
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            });
        });

        if (searchTerm) {
            users = users.filter(u =>
                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        usersData = users; // Save for export
        renderUsersTable(users);
    } catch (error) {
        console.error("Error loading users:", error);
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error loading users.</td></tr>';
    }
}

function renderUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '';

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${user.businessName}</strong></td>
            <td>${user.ownerName}</td>
            <td>${user.email}</td>
            <td style="font-family: monospace; font-size: 0.75rem;">${user.uid}</td>
            <td>
                <select class="plan-selector" data-uid="${user.uid}" data-current-plan="${user.plan}" data-email="${user.email}">
                    <option value="preview" ${user.plan === 'preview' ? 'selected' : ''}>Preview</option>
                    <option value="standard" ${user.plan === 'standard' ? 'selected' : ''}>Standard</option>
                    <option value="pro" ${user.plan === 'pro' ? 'selected' : ''}>Pro</option>
                </select>
            </td>
            <td>${user.createdAt.toLocaleDateString()}</td>
            <td>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-primary btn-small update-subscription" data-uid="${user.uid}">Update Subscription</button>
                    <button class="btn btn-error btn-small delete-user-btn" data-uid="${user.uid}" data-email="${user.email}" data-biz="${user.businessName}">Delete User</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    document.getElementById('users-page-info').innerText = `Total: ${users.length}`;

    // Add event listeners for the update buttons
    document.querySelectorAll('.update-subscription').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.getAttribute('data-uid');
            const selector = document.querySelector(`.plan-selector[data-uid="${uid}"]`);
            const newPlan = selector.value;
            const currentPlan = selector.getAttribute('data-current-plan');
            const email = selector.getAttribute('data-email');

            if (newPlan === currentPlan) {
                alert("Please select a different plan to update.");
                return;
            }

            showSubscriptionModal(uid, email, currentPlan, newPlan);
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.getAttribute('data-uid');
            const email = btn.getAttribute('data-email');
            const biz = btn.getAttribute('data-biz');
            showDeleteModal(uid, email, biz);
        });
    });
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
    csvContent += "Restaurant Name,Owner Name,Email,UID,Plan,Registration Date\n";

    usersData.forEach(u => {
        const row = [
            `"${u.businessName.replace(/"/g, '""')}"`,
            `"${u.ownerName.replace(/"/g, '""')}"`,
            u.email,
            u.uid,
            u.plan,
            u.createdAt.toISOString()
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

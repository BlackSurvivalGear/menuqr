import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// DOM Elements
const loadingScreen = document.getElementById("loading-screen");
const menuContainer = document.getElementById("menu-container");
const errorScreen = document.getElementById("error-screen");
const menuContent = document.getElementById("menu-content");

const resName = document.getElementById("res-name");
const resAddress = document.getElementById("res-address");
const resWhatsapp = document.getElementById("res-whatsapp");

const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");

/**
 * Show error screen
 */
function showError(title, message) {
    console.log("Showing error:", title, message);
    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (menuContainer) menuContainer.classList.add("hidden");
    if (errorScreen) {
        errorScreen.classList.remove("hidden");
        if (errorTitle) errorTitle.textContent = title;
        if (errorMessage) errorMessage.textContent = message;
    }
}

/**
 * Show the menu container and hide others
 */
function showMenu() {
    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (errorScreen) errorScreen.classList.add("hidden");
    if (menuContainer) menuContainer.classList.remove("hidden");
}

/**
 * Fetch restaurant details from Firestore
 */
async function fetchRestaurantDetails(uid) {
    try {
        const docRef = doc(firestore, "restaurants", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) {
        console.error("Error fetching restaurant:", e);
    }
    return null;
}

/**
 * Fetch menu items from Firestore
 */
async function fetchMenuItems(uid) {
    try {
        const q = query(
            collection(firestore, "menuItems"),
            where("restaurantId", "==", uid)
        );

        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });

        return items;
    } catch (e) {
        console.error("Error fetching items:", e);
        return [];
    }
}

/**
 * Render restaurant details to the DOM
 */
function renderRestaurantDetails(data) {
    if (resName) resName.textContent = data.businessName || "Restaurant";
    if (resAddress) resAddress.textContent = data.address || "";

    if (data.whatsapp && resWhatsapp) {
        resWhatsapp.href = `https://wa.me/${data.whatsapp.replace(/\D/g, '')}`;
        resWhatsapp.classList.remove("hidden");
    }
}

/**
 * Render empty menu state
 */
function renderEmptyMenu() {
    if (menuContent) {
        menuContent.innerHTML = `
            <div class="empty-state">
                <p>This restaurant has not published any menu items yet.</p>
            </div>
        `;
    }
}

/**
 * Render the full menu grouped by category
 */
function renderMenu(items) {
    // Group by category
    const grouped = items.reduce((acc, item) => {
        const cat = item.category || "Other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    // Sort categories (optional, but good for consistency)
    const categories = Object.keys(grouped).sort();

    if (menuContent) {
        menuContent.innerHTML = "";

        categories.forEach(category => {
            const section = document.createElement("section");
            section.className = "category-section";

            const title = document.createElement("h2");
            title.className = "category-title";
            title.textContent = category;
            section.appendChild(title);

            grouped[category].forEach(item => {
                const itemEl = document.createElement("div");
                itemEl.className = "public-menu-item";
                if (item.available === false) {
                    itemEl.style.opacity = "0.7";
                }

                const itemMain = document.createElement("div");
                itemMain.className = "item-main";

                const itemTop = document.createElement("div");
                itemTop.className = "item-top";

                const itemName = document.createElement("span");
                itemName.className = "item-name";
                itemName.textContent = item.name;
                itemTop.appendChild(itemName);

                if (item.featured) {
                    const popularBadge = document.createElement("span");
                    popularBadge.className = "item-badge badge-popular";
                    popularBadge.textContent = "⭐ Popular";
                    itemTop.appendChild(popularBadge);
                }

                itemMain.appendChild(itemTop);

                if (item.description) {
                    const itemDesc = document.createElement("p");
                    itemDesc.className = "item-description";
                    itemDesc.textContent = item.description;
                    itemMain.appendChild(itemDesc);
                }

                if (item.available === false) {
                    const unavailable = document.createElement("p");
                    unavailable.className = "unavailable-text";
                    unavailable.textContent = "Currently Unavailable";
                    itemMain.appendChild(unavailable);
                }

                const itemPrice = document.createElement("div");
                itemPrice.className = "item-price";
                const priceValue = parseFloat(item.price);
                itemPrice.textContent = `£${isNaN(priceValue) ? "0.00" : priceValue.toFixed(2)}`;

                itemEl.appendChild(itemMain);
                itemEl.appendChild(itemPrice);
                section.appendChild(itemEl);
            });

            menuContent.appendChild(section);
        });
    }
}

/**
 * Initialize the public menu page
 */
async function init() {
    console.log("Initializing public menu...");
    const urlParams = new URLSearchParams(window.location.search);
    const restaurantUid = urlParams.get("id");

    if (!restaurantUid) {
        showError("Invalid URL", "This menu is currently unavailable.");
        return;
    }

    try {
        const restaurantData = await fetchRestaurantDetails(restaurantUid);
        if (!restaurantData) {
            showError("Not Found", "This menu is currently unavailable.");
            return;
        }

        renderRestaurantDetails(restaurantData);

        const menuItems = await fetchMenuItems(restaurantUid);
        if (menuItems.length === 0) {
            renderEmptyMenu();
        } else {
            renderMenu(menuItems);
        }

        showMenu();
    } catch (error) {
        console.error("Error loading menu:", error);
        showError("Error", "Something went wrong while loading the menu.");
    }
}

// Start the application
init();

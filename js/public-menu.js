import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// Order State
let cart = [];
let currentRestaurantData = null;

// DOM Elements
const loadingScreen = document.getElementById("loading-screen");
const menuContainer = document.getElementById("menu-container");
const errorScreen = document.getElementById("error-screen");
const menuContent = document.getElementById("menu-content");

const resName = document.getElementById("res-name");
const resAddress = document.getElementById("res-address");
const orderOptionsContainer = document.getElementById("order-options-container");
const menuLayout = document.getElementById("menu-layout");

const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");

/**
 * Show error screen
 */
function showError(title, message) {
    console.log("Showing error:", title, message);
    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (menuLayout) menuLayout.classList.add("hidden");
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
    if (menuLayout) menuLayout.classList.remove("hidden");
}

/**
 * Fetch business details from Firestore
 */
async function fetchBusinessDetails(uid) {
    try {
        // Try businesses collection first
        let docRef = doc(firestore, "businesses", uid);
        let docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }

        // Migration fallback
        docRef = doc(firestore, "restaurants", uid);
        docSnap = await getDoc(docRef);
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
    currentRestaurantData = data;

    // Add logo if available
    if (data.logoUrl && resName) {
        // Check if logo already exists to avoid duplication
        const existingLogo = document.querySelector(".restaurant-logo");
        if (!existingLogo) {
            const logoContainer = document.createElement("div");
            logoContainer.className = "logo-container";

            const logoImg = document.createElement("img");
            logoImg.src = data.logoUrl;
            logoImg.alt = data.businessName || "Restaurant Logo";
            logoImg.className = "restaurant-logo";

            logoContainer.appendChild(logoImg);

            // Ensure logo is at the top of the header, before the name
            const header = resName.closest('.restaurant-header');
            if (header) {
                header.prepend(logoContainer);
            } else if (resName.parentNode) {
                resName.parentNode.insertBefore(logoContainer, resName);
            }
        }
    }

    if (resName) resName.textContent = data.businessName || "Restaurant";
    if (resAddress) resAddress.textContent = data.address || "";

    renderOrderChannels(data);
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
                const currencySymbol = currentRestaurantData.currencySymbol || "£";
                itemPrice.textContent = `${currencySymbol}${isNaN(priceValue) ? "0.00" : priceValue.toFixed(2)}`;

                itemEl.appendChild(itemMain);

                // Order Action Container
                const actionContainer = document.createElement("div");
                actionContainer.style.display = "flex";
                actionContainer.style.flexDirection = "column";
                actionContainer.style.alignItems = "flex-end";
                actionContainer.style.gap = "0.5rem";

                actionContainer.appendChild(itemPrice);

                itemEl.appendChild(actionContainer);
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
        const restaurantData = await fetchBusinessDetails(restaurantUid);
        if (!restaurantData) {
            showError("Not Found", "This menu is currently unavailable.");
            return;
        }

        try {
            renderRestaurantDetails(restaurantData);
        } catch (e) {
            console.error("Error rendering restaurant details:", e);
        }

        const menuItems = await fetchMenuItems(restaurantUid);
        try {
            if (menuItems.length === 0) {
                renderEmptyMenu();
            } else {
                renderMenu(menuItems);
            }
        } catch (e) {
            console.error("Error rendering menu items:", e);
        }

        showMenu();
    } catch (error) {
        console.error("Error loading menu:", error);
        showError("Error", "Something went wrong while loading the menu.");
    } finally {
        // Ensure loading screen is hidden in all cases where it might have been left visible
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            loadingScreen.classList.add('hidden');
        }
    }
}

/**
 * Render Order Channels
 */
function renderOrderChannels(data) {
    if (!orderOptionsContainer) return;
    orderOptionsContainer.innerHTML = "";

    const channels = data.orderChannels || [];
    let hasOptions = false;

    // Header for the section
    const header = document.createElement("h2");
    header.className = "order-now-title";
    header.textContent = "Order Now";

    const channelsList = document.createElement("div");
    channelsList.className = "order-channels-list";

    // Render all channels from the array
    channels.forEach(channel => {
        if (channel.url) {
            hasOptions = true;
            const btn = document.createElement("a");
            btn.href = channel.url;
            btn.target = "_blank";

            if (channel.type === "whatsapp") {
                btn.className = "btn btn-whatsapp-order";
                btn.textContent = "Order on WhatsApp";
            } else if (channel.type === "phone") {
                btn.className = "btn btn-phone-order";
                btn.textContent = "Call to Order";
            } else {
                btn.className = "btn btn-delivery-channel";
                btn.textContent = `Order via ${channel.name}`;
            }
            channelsList.appendChild(btn);
        }
    });

    if (hasOptions) {
        orderOptionsContainer.appendChild(header);
        orderOptionsContainer.appendChild(channelsList);
        orderOptionsContainer.classList.remove("hidden");
    } else {
        orderOptionsContainer.classList.add("hidden");
    }
}

// Start the application
init();

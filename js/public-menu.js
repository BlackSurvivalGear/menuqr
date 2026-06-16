import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
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
const resWhatsapp = document.getElementById("res-whatsapp");
const cartPanel = document.getElementById("cart-panel");

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
            resName.parentNode.insertBefore(logoContainer, resName);
        }
    }

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

                // Order Action Container
                const actionContainer = document.createElement("div");
                actionContainer.style.display = "flex";
                actionContainer.style.flexDirection = "column";
                actionContainer.style.alignItems = "flex-end";
                actionContainer.style.gap = "0.5rem";

                actionContainer.appendChild(itemPrice);

                if (item.available !== false) {
                    const addBtn = document.createElement("button");
                    addBtn.className = "btn-add-order";
                    addBtn.textContent = "Add to Order";
                    addBtn.onclick = () => addToCart(item);
                    actionContainer.appendChild(addBtn);
                }

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

/**
 * Add an item to the cart
 */
function addToCart(item) {
    const existingItem = cart.find(i => i.id === item.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price) || 0,
            quantity: 1
        });
    }
    renderCart();
}

/**
 * Update the quantity of an item in the cart
 */
function updateQuantity(itemId, delta) {
    const itemIndex = cart.findIndex(i => i.id === itemId);
    if (itemIndex !== -1) {
        cart[itemIndex].quantity += delta;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1);
        }
    }
    renderCart();
}

/**
 * Render the cart panel UI
 */
function renderCart() {
    if (!cartPanel) return;

    if (cart.length === 0) {
        cartPanel.classList.add("hidden");
        return;
    }

    cartPanel.classList.remove("hidden");

    let total = 0;
    const itemsHtml = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">£${item.price.toFixed(2)} each</span>
                </div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                </div>
            </div>
        `;
    }).join("");

    cartPanel.innerHTML = `
        <div class="cart-header">
            <h3>Your Order</h3>
            <button class="btn btn-link btn-small" onclick="clearCart()" style="color: var(--error-color)">Clear All</button>
        </div>
        <div class="cart-items">
            ${itemsHtml}
        </div>
        <div class="cart-total">
            <span>Total:</span>
            <span>£${total.toFixed(2)}</span>
        </div>
        <button class="btn btn-whatsapp-order" onclick="sendWhatsAppOrder()">
            Order via WhatsApp
        </button>
    `;
}

/**
 * Clear the entire cart
 */
function clearCart() {
    cart = [];
    renderCart();
}

/**
 * Format and send the order via WhatsApp
 */
function sendWhatsAppOrder() {
    if (!currentRestaurantData || cart.length === 0) return;

    const restaurantName = currentRestaurantData.businessName || "Restaurant";
    const whatsappNumber = (currentRestaurantData.whatsapp || "").replace(/\D/g, "");

    if (!whatsappNumber) {
        alert("This restaurant doesn't have a WhatsApp number configured.");
        return;
    }

    let total = 0;
    const itemsList = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `${item.quantity} × ${item.name} (£${item.price.toFixed(2)})`;
    }).join("\n");

    const message = `Hello ${restaurantName},

I'd like to place the following order:

${itemsList}

Order Total: £${total.toFixed(2)}

Collection or Delivery:
Customer Name:

Thank you.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
}

// Expose functions to window for onclick handlers in string templates
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.clearCart = clearCart;
window.sendWhatsAppOrder = sendWhatsAppOrder;

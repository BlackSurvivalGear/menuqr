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
const orderOptionsContainer = document.getElementById("order-options-container");
const menuLayout = document.getElementById("menu-layout");

const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");

// Cart Elements
const cartSummary = document.getElementById("cart-summary");
const cartPanel = document.getElementById("cart-panel");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotalValue = document.getElementById("cart-total-value");
const closeCartBtn = document.getElementById("close-cart");
const whatsappOrderBtn = document.getElementById("whatsapp-order-btn");

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
                actionContainer.className = "item-action-container";
                actionContainer.style.display = "flex";
                actionContainer.style.flexDirection = "column";
                actionContainer.style.alignItems = "flex-end";
                actionContainer.style.gap = "0.75rem";

                actionContainer.appendChild(itemPrice);

                if (item.available !== false) {
                    const addToCartBtn = document.createElement("button");
                    addToCartBtn.className = "add-to-cart-btn";
                    addToCartBtn.textContent = "Add to Cart";
                    addToCartBtn.onclick = () => addToCart(item);
                    actionContainer.appendChild(addToCartBtn);
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
 * Cart Logic Implementation
 */

function addToCart(item) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: 1
        });
    }
    updateCartUI();
}

function removeFromCart(itemId) {
    cart = cart.filter(i => i.id !== itemId);
    updateCartUI();
}

function updateQuantity(itemId, delta) {
    const item = cart.find(i => i.id === itemId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            updateCartUI();
        }
    }
}

function calculateTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function updateCartUI() {
    const total = calculateTotal();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const currencySymbol = currentRestaurantData?.currencySymbol || "£";

    // Update Summary Button
    if (cartSummary) {
        if (count > 0) {
            cartSummary.classList.remove("hidden");
            const countEl = cartSummary.querySelector(".cart-count");
            const totalEl = cartSummary.querySelector(".cart-total");
            if (countEl) countEl.textContent = count;
            if (totalEl) totalEl.textContent = `${currencySymbol}${total.toFixed(2)}`;
        } else {
            cartSummary.classList.add("hidden");
            cartPanel.classList.add("hidden");
        }
    }

    // Update Cart Panel Items
    if (cartItemsContainer) {
        cartItemsContainer.innerHTML = "";
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem 0;">Your cart is empty.</p>';
        } else {
            cart.forEach(item => {
                const itemEl = document.createElement("div");
                itemEl.className = "cart-item";
                itemEl.innerHTML = `
                    <div class="cart-item-info">
                        <span class="cart-item-name">${item.name}</span>
                        <span class="cart-item-price">${currencySymbol}${item.price.toFixed(2)}</span>
                    </div>
                    <div class="cart-item-controls">
                        <button class="qty-btn" onclick="window.updateCartQty('${item.id}', -1)">-</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button class="qty-btn" onclick="window.updateCartQty('${item.id}', 1)">+</button>
                    </div>
                `;
                cartItemsContainer.appendChild(itemEl);
            });
        }
    }

    if (cartTotalValue) {
        cartTotalValue.textContent = `${currencySymbol}${total.toFixed(2)}`;
    }
}

// Expose functions to window for testing and interaction
window.addToCart = addToCart;
window.updateCartQty = (id, delta) => updateQuantity(id, delta);

/**
 * WhatsApp Integration
 */

function generateWhatsAppMessage() {
    if (!currentRestaurantData) return "";

    const currencySymbol = currentRestaurantData.currencySymbol || "£";
    const bizName = currentRestaurantData.businessName || "Restaurant";

    let message = `Hello ${bizName},\n\nI would like to place an order:\n\n`;

    cart.forEach(item => {
        message += `${item.quantity}x ${item.name} (${currencySymbol}${(item.price * item.quantity).toFixed(2)})\n\n`;
    });

    message += `Total: ${currencySymbol}${calculateTotal().toFixed(2)}\n\n`;
    message += `Name:\n\nCollection or Delivery:\n\nAddress (if delivery):\n\nThank you.`;

    return encodeURIComponent(message);
}

function sendWhatsAppOrder() {
    const channels = currentRestaurantData.orderChannels || [];
    const whatsappChannel = channels.find(c => c.type === "whatsapp");

    if (!whatsappChannel || !whatsappChannel.url) {
        alert("This restaurant has not configured a WhatsApp number for orders.");
        return;
    }

    // Extract base number link and append message
    const baseUrl = whatsappChannel.url;
    const message = generateWhatsAppMessage();
    const finalUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}text=${message}`;

    window.open(finalUrl, "_blank");
}

// Event Listeners for Cart
if (cartSummary) {
    cartSummary.onclick = () => {
        cartPanel.classList.toggle("hidden");
    };
}

if (closeCartBtn) {
    closeCartBtn.onclick = () => {
        cartPanel.classList.add("hidden");
    };
}

if (whatsappOrderBtn) {
    whatsappOrderBtn.onclick = () => {
        sendWhatsAppOrder();
    };
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

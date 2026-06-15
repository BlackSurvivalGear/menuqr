import { auth, db } from "./auth.js";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// DOM Elements
const menuItemsList = document.getElementById("menu-items-list");
const menuError = document.getElementById("menu-error");
const addMenuItemBtn = document.getElementById("add-menu-item-btn");
const menuItemModal = document.getElementById("menu-item-modal");
const menuItemForm = document.getElementById("menu-item-form");
const cancelItemBtn = document.getElementById("cancel-item-btn");
const closeModalBtn = document.querySelector(".close-modal");
const modalTitle = document.getElementById("modal-title");
const categorySelect = document.getElementById("item-category");
const customCategoryGroup = document.getElementById("custom-category-group");

let currentUserId = null;

/**
 * Initializes the Menu Builder
 * @param {string} uid
 */
export function initMenuItems(uid) {
    currentUserId = uid;

    if (addMenuItemBtn) {
        addMenuItemBtn.addEventListener("click", () => openModal());
    }

    if (cancelItemBtn) {
        cancelItemBtn.addEventListener("click", closeModal);
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeModal);
    }

    if (menuItemForm) {
        menuItemForm.addEventListener("submit", handleFormSubmit);
    }

    if (categorySelect) {
        categorySelect.addEventListener("change", handleCategoryChange);
    }

    fetchMenuItems();
}

/**
 * Opens the modal for adding or editing
 * @param {Object|null} item - Item to edit, or null for new item
 */
function openModal(item = null) {
    menuItemForm.reset();
    document.getElementById("item-id").value = item ? item.id : "";
    modalTitle.innerText = item ? "Edit Menu Item" : "Add Menu Item";

    if (item) {
        document.getElementById("item-name").value = item.name || "";
        document.getElementById("item-description").value = item.description || "";
        document.getElementById("item-price").value = item.price || "";

        const standardCategories = ["Breakfast", "Lunch", "Dinner", "Drinks", "Desserts", "Sides", "Specials", "Other"];
        if (standardCategories.includes(item.category)) {
            categorySelect.value = item.category;
            customCategoryGroup.classList.add("hidden");
        } else {
            categorySelect.value = "custom";
            customCategoryGroup.classList.remove("hidden");
            document.getElementById("custom-category").value = item.category || "";
        }

        document.getElementById("item-available").checked = item.available !== false;
        document.getElementById("item-featured").checked = !!item.featured;
    } else {
        customCategoryGroup.classList.add("hidden");
        document.getElementById("item-available").checked = true;
        document.getElementById("item-featured").checked = false;
    }

    menuItemModal.classList.remove("hidden");
}

/**
 * Closes the modal
 */
function closeModal() {
    menuItemModal.classList.add("hidden");
    menuItemForm.reset();
}

/**
 * Handles category dropdown changes
 */
function handleCategoryChange() {
    if (categorySelect.value === "custom") {
        customCategoryGroup.classList.remove("hidden");
    } else {
        customCategoryGroup.classList.add("hidden");
    }
}

/**
 * Handles form submission for both add and edit
 * @param {Event} e
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    const itemId = document.getElementById("item-id").value;
    const name = document.getElementById("item-name").value.trim();
    const description = document.getElementById("item-description").value.trim();
    const price = parseFloat(document.getElementById("item-price").value);

    let category = categorySelect.value;
    if (category === "custom") {
        category = document.getElementById("custom-category").value.trim() || "Other";
    }

    const available = document.getElementById("item-available").checked;
    const featured = document.getElementById("item-featured").checked;

    if (!name || isNaN(price)) {
        showError("Please fill in all required fields and provide a valid price.");
        return;
    }

    const itemData = {
        restaurantId: currentUserId,
        name,
        description,
        price,
        category,
        available,
        featured,
        updatedAt: serverTimestamp()
    };

    // Debug logging
    console.log("auth.currentUser.uid:", auth.currentUser ? auth.currentUser.uid : "null");
    console.log("menu item payload:", itemData);
    console.log("restaurantId value:", itemData.restaurantId);
    console.log("price value:", itemData.price);
    console.log("price type:", typeof itemData.price);

    try {
        if (itemId) {
            // Update
            await updateDoc(doc(db, "menuItems", itemId), itemData);
            showSuccess("Menu item updated successfully!");
        } else {
            // Create
            itemData.createdAt = serverTimestamp();
            await addDoc(collection(db, "menuItems"), itemData);
            showSuccess("Menu item added successfully!");
        }

        closeModal();
        fetchMenuItems();
    } catch (error) {
        console.error("Detailed Error saving menu item:", error);
        // Expose raw error message for debugging as requested
        showError(`Firebase Error: ${error.message || error.code || "Unknown error"}`);
    }
}

/**
 * Fetches menu items from Firestore
 */
async function fetchMenuItems() {
    if (!currentUserId || !menuItemsList) return;

    try {
        const q = query(
            collection(db, "menuItems"),
            where("restaurantId", "==", currentUserId)
        );

        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });

        renderMenuItems(items);
    } catch (error) {
        console.error("Error fetching menu items:", error);
        showError(getFriendlyErrorMessage(error));
    }
}

/**
 * Renders the menu items in the dashboard
 * @param {Array} items
 */
function renderMenuItems(items) {
    menuItemsList.innerHTML = "";

    if (items.length === 0) {
        menuItemsList.innerHTML = '<p class="text-muted">No menu items added yet. Click the button above to create your first item!</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "menu-item-card";

        // Header
        const header = document.createElement("div");
        header.className = "menu-item-header";
        const nameSpan = document.createElement("span");
        nameSpan.className = "menu-item-name";
        nameSpan.textContent = item.name;
        const priceSpan = document.createElement("span");
        priceSpan.className = "menu-item-price";
        priceSpan.textContent = `£${item.price.toFixed(2)}`;
        header.appendChild(nameSpan);
        header.appendChild(priceSpan);

        // Category
        const categoryDiv = document.createElement("div");
        categoryDiv.className = "menu-item-category";
        categoryDiv.textContent = item.category;

        // Description
        const descDiv = document.createElement("div");
        descDiv.className = "menu-item-description";
        descDiv.textContent = item.description || "";

        // Badges
        const badgesDiv = document.createElement("div");
        badgesDiv.className = "menu-item-badges";
        const availBadge = document.createElement("span");
        availBadge.className = `badge ${item.available ? 'badge-available' : 'badge-unavailable'}`;
        availBadge.textContent = item.available ? 'Available' : 'Unavailable';
        badgesDiv.appendChild(availBadge);
        if (item.featured) {
            const featuredBadge = document.createElement("span");
            featuredBadge.className = "badge badge-featured";
            featuredBadge.textContent = "★ Featured";
            badgesDiv.appendChild(featuredBadge);
        }

        // Actions
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "menu-item-actions";
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-outline btn-small edit-btn";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openModal(item));
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-outline btn-small delete-btn";
        deleteBtn.style.color = "var(--error-color)";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => handleDeleteItem(item.id));
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        card.appendChild(header);
        card.appendChild(categoryDiv);
        card.appendChild(descDiv);
        card.appendChild(badgesDiv);
        card.appendChild(actionsDiv);

        menuItemsList.appendChild(card);
    });
}

/**
 * Handles item deletion
 * @param {string} id
 */
async function handleDeleteItem(id) {
    if (confirm("Are you sure you want to delete this menu item?")) {
        try {
            await deleteDoc(doc(db, "menuItems", id));
            showSuccess("Menu item deleted successfully!");
            fetchMenuItems();
        } catch (error) {
            console.error("Error deleting item:", error);
            showError(getFriendlyErrorMessage(error));
        }
    }
}

/**
 * Error handling helper
 * @param {Error} error
 */
function getFriendlyErrorMessage(error) {
    if (error.code === 'permission-denied') {
        return "You don't have permission to perform this action.";
    }
    if (error.message && error.message.includes("network")) {
        return "Network error. Please check your connection.";
    }
    return "An unexpected error occurred. Please try again.";
}

/**
 * Shows error message
 * @param {string} message
 */
function showError(message) {
    if (menuError) {
        menuError.innerText = message;
        menuError.classList.remove("error-box");
        menuError.classList.add("error-box");
        menuError.classList.remove("hidden");
        setTimeout(() => menuError.classList.add("hidden"), 5000);
    } else {
        alert(message);
    }
}

/**
 * Shows success message
 * @param {string} message
 */
function showSuccess(message) {
    if (menuError) {
        menuError.innerText = message;
        menuError.classList.remove("error-box");
        menuError.style.backgroundColor = "#dcfce7";
        menuError.style.color = "#166534";
        menuError.classList.remove("hidden");
        setTimeout(() => {
            menuError.classList.add("hidden");
            menuError.classList.add("error-box");
            menuError.style.backgroundColor = "";
            menuError.style.color = "";
        }, 5000);
    } else {
        alert(message);
    }
}

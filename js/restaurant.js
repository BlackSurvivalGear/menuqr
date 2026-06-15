import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const restaurantForm = document.getElementById("restaurant-form");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const errorMessage = document.getElementById("error-message");
const successMessage = document.getElementById("success-message");
const pageTitle = document.getElementById("page-title");
const cancelBtn = document.getElementById("cancel-btn");

let isEditMode = false;
let currentUser = null;

// Form fields
const businessNameInput = document.getElementById("businessName");
const ownerNameInput = document.getElementById("ownerName");
const phoneInput = document.getElementById("phone");
const whatsappInput = document.getElementById("whatsapp");
const addressInput = document.getElementById("address");

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const urlParams = new URLSearchParams(window.location.search);
        isEditMode = urlParams.get('edit') === 'true';

        if (isEditMode) {
            setupEditMode();
        } else {
            // Check if profile already exists, if so redirect to dashboard (unless explicitly editing)
            const docRef = doc(db, "restaurants", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                window.location.href = "dashboard.html";
            }
        }
    } else {
        window.location.href = "login.html";
    }
});

async function setupEditMode() {
    pageTitle.innerText = "Edit Restaurant Profile";
    cancelBtn.classList.remove("hidden");

    try {
        const docRef = doc(db, "restaurants", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            businessNameInput.value = data.businessName || "";
            ownerNameInput.value = data.ownerName || "";
            phoneInput.value = data.phone || "";
            whatsappInput.value = data.whatsapp || "";
            addressInput.value = data.address || "";
        }
    } catch (error) {
        console.error("Error fetching restaurant data:", error);
        showError("Failed to load restaurant profile.");
    }
}

function showError(message) {
    errorMessage.innerText = message;
    errorMessage.classList.remove("hidden");
    successMessage.classList.add("hidden");
}

function showSuccess(message) {
    successMessage.innerText = message;
    successMessage.classList.remove("hidden");
    errorMessage.classList.add("hidden");
}

restaurantForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const businessName = businessNameInput.value.trim();
    const ownerName = ownerNameInput.value.trim();
    const phone = phoneInput.value.trim();
    const whatsapp = whatsappInput.value.trim();
    const address = addressInput.value.trim();

    // Basic Validation
    if (!businessName || !ownerName || !phone || !whatsapp || !address) {
        showError("All fields are required.");
        return;
    }

    // Reset UI
    errorMessage.classList.add("hidden");
    btnText.classList.add("hidden");
    btnLoader.classList.remove("hidden");
    submitBtn.disabled = true;

    try {
        const restaurantData = {
            ownerUid: currentUser.uid,
            businessName,
            ownerName,
            phone,
            whatsapp,
            address,
            updatedAt: serverTimestamp()
        };

        const docRef = doc(db, "restaurants", currentUser.uid);

        if (isEditMode) {
            await updateDoc(docRef, restaurantData);
        } else {
            restaurantData.createdAt = serverTimestamp();
            await setDoc(docRef, restaurantData);
        }

        showSuccess("Profile saved successfully! Redirecting...");

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1500);

    } catch (error) {
        console.error("Firestore Error:", error);
        if (error.code === 'permission-denied') {
            showError("Permission denied. You can only manage your own restaurant profile.");
        } else {
            showError("An error occurred while saving. Please try again.");
        }

        // Restore UI
        btnText.classList.remove("hidden");
        btnLoader.classList.add("hidden");
        submitBtn.disabled = false;
    }
});

import { auth, db, storage } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";

const restaurantForm = document.getElementById("restaurant-form");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const errorMessage = document.getElementById("error-message");
const successMessage = document.getElementById("success-message");
const pageTitle = document.getElementById("page-title");
const cancelBtn = document.getElementById("cancel-btn");

let isEditMode = false;
let existingCreatedAt = null;
let currentLogoUrl = null;
let selectedFile = null;

// Form fields
const logoInput = document.getElementById("restaurant-logo");
const selectLogoBtn = document.getElementById("select-logo-btn");
const logoPreviewContainer = document.getElementById("logo-preview-container");
const uploadProgressContainer = document.getElementById("upload-progress-container");
const uploadProgressBar = document.getElementById("upload-progress-bar");

const businessNameInput = document.getElementById("businessName");
const ownerNameInput = document.getElementById("ownerName");
const phoneInput = document.getElementById("phone");
const whatsappInput = document.getElementById("whatsapp");
const addressInput = document.getElementById("address");

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const urlParams = new URLSearchParams(window.location.search);
        isEditMode = urlParams.get('edit') === 'true';

        // Check if profile already exists
        const docRef = doc(db, "restaurants", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            existingCreatedAt = data.createdAt;

            if (isEditMode) {
                setupEditMode(data);
            } else {
                // If profile already exists and not explicitly editing, redirect to dashboard
                window.location.href = "dashboard.html";
            }
        } else if (isEditMode) {
            // If edit mode requested but no profile exists, treat as new setup
            isEditMode = false;
            pageTitle.innerText = "Restaurant Profile Setup";
        }
    } else {
        window.location.href = "login.html";
    }
});

async function setupEditMode(data) {
    pageTitle.innerText = "Edit Restaurant Profile";
    cancelBtn.classList.remove("hidden");

    try {
        businessNameInput.value = data.businessName || "";
        ownerNameInput.value = data.ownerName || "";
        phoneInput.value = data.phone || "";
        whatsappInput.value = data.whatsapp || "";
        addressInput.value = data.address || "";
        currentLogoUrl = data.logoUrl || null;

        if (currentLogoUrl) {
            renderLogoPreview(currentLogoUrl);
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

function renderLogoPreview(url) {
    logoPreviewContainer.innerHTML = `<img src="${url}" alt="Logo Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
}

if (selectLogoBtn) {
    selectLogoBtn.addEventListener("click", () => logoInput.click());
}

if (logoInput) {
    logoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showError("Please select a valid image file (PNG, JPG, or WEBP).");
            logoInput.value = "";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showError("File size must be less than 2MB.");
            logoInput.value = "";
            return;
        }

        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            renderLogoPreview(e.target.result);
        };
        reader.readAsDataURL(file);
        errorMessage.classList.add("hidden");
    });
}

async function uploadLogo(uid) {
    if (!selectedFile) return currentLogoUrl;

    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, `restaurant-logos/${uid}/logo`);
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);

        uploadProgressContainer.classList.remove("hidden");

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                uploadProgressBar.style.width = progress + '%';
            },
            (error) => {
                console.error("Upload error:", error);
                uploadProgressContainer.classList.add("hidden");
                reject(error);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                uploadProgressContainer.classList.add("hidden");
                resolve(downloadURL);
            }
        );
    });
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
        if (!auth.currentUser) {
            showError("You must be logged in to save a profile.");
            return;
        }

        const logoUrl = await uploadLogo(auth.currentUser.uid);

        const restaurantData = {
            ownerUid: auth.currentUser.uid,
            businessName,
            ownerName,
            phone,
            whatsapp,
            address,
            logoUrl: logoUrl || "",
            createdAt: isEditMode ? existingCreatedAt : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Ensure createdAt is never null if we're in edit mode but it was missing
        if (isEditMode && !restaurantData.createdAt) {
            restaurantData.createdAt = serverTimestamp();
        }

        const docRef = doc(db, "restaurants", auth.currentUser.uid);

        // Use setDoc for both creation and updates to ensure all fields are written
        // and to comply with the requirement of using the UID as the document ID.
        await setDoc(docRef, restaurantData);

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

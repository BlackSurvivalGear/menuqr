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

// Logo elements
const logoInput = document.getElementById("logo-input");
const uploadLogoBtn = document.getElementById("upload-logo-btn");
const replaceLogoBtn = document.getElementById("replace-logo-btn");
const removeLogoBtn = document.getElementById("remove-logo-btn");
const logoPreview = document.getElementById("logo-preview");
const noLogoText = document.getElementById("no-logo-text");
const progressContainer = document.getElementById("upload-progress-container");
const progressBar = document.getElementById("upload-progress-bar");
const uploadStatus = document.getElementById("upload-status");

let isEditMode = false;
let existingCreatedAt = null;
let currentLogoUrl = "";

const CLOUDINARY_CLOUD_NAME = "dekre5agw";
const CLOUDINARY_UPLOAD_PRESET = "scanmenu_logos";

// Form fields
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
            currentLogoUrl = data.logoUrl || "";

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

    if (data.logoUrl) {
        showLogoPreview(data.logoUrl);
    }

    try {
        businessNameInput.value = data.businessName || "";
        ownerNameInput.value = data.ownerName || "";
        phoneInput.value = data.phone || "";
        whatsappInput.value = data.whatsapp || "";
        addressInput.value = data.address || "";
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

// Logo Management functions
function showLogoPreview(url) {
    logoPreview.src = url;
    logoPreview.classList.remove("hidden");
    noLogoText.classList.add("hidden");
    uploadLogoBtn.classList.add("hidden");
    replaceLogoBtn.classList.remove("hidden");
    removeLogoBtn.classList.remove("hidden");
}

function hideLogoPreview() {
    logoPreview.src = "";
    logoPreview.classList.add("hidden");
    noLogoText.classList.remove("hidden");
    uploadLogoBtn.classList.remove("hidden");
    replaceLogoBtn.classList.add("hidden");
    removeLogoBtn.classList.add("hidden");
}

uploadLogoBtn.addEventListener("click", () => logoInput.click());
replaceLogoBtn.addEventListener("click", () => logoInput.click());

removeLogoBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to remove the logo?")) {
        currentLogoUrl = "";
        hideLogoPreview();
        showSuccess("Logo removed successfully. Save profile to apply changes.");

        // Optionally update Firestore immediately if we're in edit mode
        if (auth.currentUser) {
            const docRef = doc(db, "restaurants", auth.currentUser.uid);
            await updateDoc(docRef, {
                logoUrl: "",
                updatedAt: serverTimestamp()
            });
        }
    }
});

logoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError("File size too large. Maximum size is 5MB.");
        return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        showError("Invalid file type. Please upload PNG, JPG, or WEBP.");
        return;
    }

    uploadFile(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
});

async function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    progressContainer.classList.remove("hidden");
    uploadStatus.classList.remove("hidden");
    uploadStatus.innerText = "Uploading logo...";
    progressBar.style.width = "0%";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressBar.style.width = percentComplete + "%";
        }
    };

    xhr.onload = async () => {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            currentLogoUrl = response.secure_url;
            showLogoPreview(currentLogoUrl);
            showSuccess("Logo uploaded successfully! Save profile to apply changes.");

            progressContainer.classList.add("hidden");
            uploadStatus.innerText = "Upload complete!";
            setTimeout(() => uploadStatus.classList.add("hidden"), 3000);
        } else {
            console.error("Cloudinary Error:", xhr.responseText);
            showError("Upload failed. Please try again.");
            progressContainer.classList.add("hidden");
            uploadStatus.classList.add("hidden");
        }
    };

    xhr.onerror = () => {
        showError("Upload failed. Please check your connection.");
        progressContainer.classList.add("hidden");
        uploadStatus.classList.add("hidden");
    };

    xhr.send(formData);
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

        const restaurantData = {
            ownerUid: auth.currentUser.uid,
            businessName,
            ownerName,
            phone,
            whatsapp,
            address,
            logoUrl: currentLogoUrl,
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

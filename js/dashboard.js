import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { initMenuItems } from "./menu-items.js";
import { initQRManager } from "./qr-manager.js";

const userEmailEl = document.getElementById("user-email");
const userDisplayEmailEl = document.getElementById("user-display-email");
const userUidEl = document.getElementById("user-uid");
const userCreatedAtEl = document.getElementById("user-created-at");

// Restaurant elements
const bizNameEl = document.getElementById("biz-name");
const ownerNameEl = document.getElementById("owner-name");
const bizPhoneEl = document.getElementById("biz-phone");
const bizWhatsappEl = document.getElementById("biz-whatsapp");
const bizAddressEl = document.getElementById("biz-address");
const editProfileBtn = document.getElementById("edit-profile-btn");

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, fetch Firestore data
        try {
            userEmailEl.innerText = user.email;
            userDisplayEmailEl.innerText = user.email.split('@')[0];
            userUidEl.innerText = user.uid;

            // Fetch User Account Info
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.createdAt) {
                    const date = userData.createdAt.toDate();
                    userCreatedAtEl.innerText = date.toLocaleString();
                } else {
                    userCreatedAtEl.innerText = "N/A";
                }
            } else {
                userCreatedAtEl.innerText = "Not found in records";
            }

            // Fetch Restaurant Profile Info
            const restDocRef = doc(db, "restaurants", user.uid);
            const restDoc = await getDoc(restDocRef);

            if (restDoc.exists()) {
                const restData = restDoc.data();
                bizNameEl.innerText = restData.businessName || "N/A";
                ownerNameEl.innerText = restData.ownerName || "N/A";
                bizPhoneEl.innerText = restData.phone || "N/A";
                bizWhatsappEl.innerText = restData.whatsapp || "N/A";
                bizAddressEl.innerText = restData.address || "N/A";

                // Initialize menu items management
                initMenuItems(user.uid);

                // Initialize QR Code management
                initQRManager(user.uid, restData.businessName);
            } else {
                // If profile doesn't exist, redirection in auth.js will handle it
                // but we can set friendly messages just in case
                bizNameEl.innerText = "No profile found";
                ownerNameEl.innerText = "No profile found";
                bizPhoneEl.innerText = "No profile found";
                bizWhatsappEl.innerText = "No profile found";
                bizAddressEl.innerText = "No profile found";
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            userCreatedAtEl.innerText = "Error loading";
            bizNameEl.innerText = "Error loading";
        }
    }
});

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
        window.location.href = "restaurant.html?edit=true";
    });
}

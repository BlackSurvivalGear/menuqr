import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
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
            let userPlan = "preview";

            if (userDoc.exists()) {
                const userData = userDoc.data();
                userPlan = userData.plan || "preview";
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
                initMenuItems(user.uid, userPlan);

                // Show usage card
                renderUsageCard(user.uid, userPlan);

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

/**
 * Renders the Plan Usage card
 * @param {string} uid
 * @param {string} plan
 */
async function renderUsageCard(uid, plan = "preview") {
    const usageSection = document.getElementById("plan-usage-section");
    if (!usageSection) return;

    try {
        const q = query(
            collection(db, "menuItems"),
            where("restaurantId", "==", uid)
        );
        const querySnapshot = await getDocs(q);

        const usage = {
            "Main Courses": 0,
            "Drinks": 0,
            "Starters": 0,
            "Desserts": 0,
            "Sides": 0,
            "Specials": 0,
            "Custom Categories": 0
        };

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const normalized = getNormalizedCategory(data.category);
            if (normalized) {
                if (usage.hasOwnProperty(normalized)) {
                    usage[normalized]++;
                } else {
                    usage["Custom Categories"]++;
                }
            } else if (data.category) {
                usage["Custom Categories"]++;
            }
        });

        const isPreview = plan === "preview";

        usageSection.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin-bottom: 0;">${isPreview ? 'Preview Plan Usage' : 'Menu Usage'}</h3>
                <span class="badge badge-featured">${isPreview ? 'Preview Plan' : 'Pro Plan'}</span>
            </div>
            <div class="usage-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="stat-card" style="padding: 1rem; background: var(--bg-light);">
                    <div style="font-size: 0.875rem; color: var(--text-muted);">Main Courses</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${usage["Main Courses"]}${isPreview ? ' / 4' : ''}</div>
                </div>
                <div class="stat-card" style="padding: 1rem; background: var(--bg-light);">
                    <div style="font-size: 0.875rem; color: var(--text-muted);">Starters</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${usage["Starters"]}${isPreview ? ' / 2' : ''}</div>
                </div>
                <div class="stat-card" style="padding: 1rem; background: var(--bg-light);">
                    <div style="font-size: 0.875rem; color: var(--text-muted);">Drinks</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${usage["Drinks"]}${isPreview ? ' / 2' : ''}</div>
                </div>
                <div class="stat-card" style="padding: 1rem; background: var(--bg-light);">
                    <div style="font-size: 0.875rem; color: var(--text-muted);">Desserts</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${usage["Desserts"]}${isPreview ? ' / 2' : ''}</div>
                </div>
                <div class="stat-card locked-stat" style="padding: 1rem; background: var(--bg-light); cursor: ${isPreview ? 'pointer' : 'default'};">
                    <div style="font-size: 0.875rem; color: var(--text-muted);">${isPreview ? '🔒 ' : ''}Sides</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${usage["Sides"]}${isPreview ? ' / 0' : ''}</div>
                </div>
                <div class="stat-card locked-stat" style="padding: 1rem; background: var(--bg-light); cursor: ${isPreview ? 'pointer' : 'default'};">
                    <div style="font-size: 0.875rem; color: var(--text-muted);">${isPreview ? '🔒 ' : ''}Specials</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${usage["Specials"]}${isPreview ? ' / 0' : ''}</div>
                </div>
                <div class="stat-card locked-stat" style="padding: 1rem; background: var(--bg-light); cursor: ${isPreview ? 'pointer' : 'default'};">
                    <div style="font-size: 0.875rem; color: var(--text-muted);">${isPreview ? '🔒 ' : ''}Custom Categories</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${usage["Custom Categories"]}${isPreview ? ' / 0' : ''}</div>
                </div>
            </div>
            ${isPreview ? '<p style="margin-bottom: 0; font-size: 0.875rem;">Upgrade to Pro to unlock unlimited menu items and advanced categories.</p>' : ''}
        `;

        if (isPreview) {
            usageSection.querySelectorAll('.locked-stat').forEach(el => {
                el.addEventListener('click', () => {
                    const modal = document.getElementById('upgrade-modal');
                    if (modal) modal.classList.remove('hidden');
                });
            });
        }

        usageSection.classList.remove("hidden");
    } catch (error) {
        console.error("Error rendering usage card:", error);
    }
}

/**
 * Normalizes category name (duplicated from menu-items.js for dashboard display)
 */
function getNormalizedCategory(category) {
    if (!category) return null;
    const cat = category.toLowerCase().trim();
    if (cat === "main" || cat === "mains" || cat === "main courses" || cat === "main course") return "Main Courses";
    if (cat === "starter" || cat === "starters") return "Starters";
    if (cat === "drink" || cat === "drinks") return "Drinks";
    if (cat === "dessert" || cat === "desserts") return "Desserts";
    if (cat === "side" || cat === "sides") return "Sides";
    if (cat === "special" || cat === "specials") return "Specials";
    return null;
}

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
        window.location.href = "restaurant.html?edit=true";
    });
}

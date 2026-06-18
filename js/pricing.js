import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-functions.js";
import firebaseConfig from "./firebase-config.js";

const paypalModal = document.getElementById("paypal-modal");
const paypalModalTitle = document.getElementById("paypal-modal-title");
const closeModalBtns = [
    document.getElementById("close-modal"),
    document.getElementById("close-modal-btn")
];
const upgradeBtns = document.querySelectorAll(".upgrade-btn");

let userPlan = "preview";
let selectedPlan = "";
let paypalButtons = null;

const PLAN_PRICES = {
    standard: "9.99",
    pro: "49.99"
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                userPlan = userDoc.data().plan || "preview";
            }

            updateUIForCurrentPlan(userPlan);
        } catch (error) {
            console.error("Error fetching user plan:", error);
            updateUIForCurrentPlan("preview");
        }
    } else {
        // User not logged in, they can see the plans but clicking upgrade will prompt login
        updateUIForCurrentPlan(null);
    }
});

function updateUIForCurrentPlan(plan) {
    upgradeBtns.forEach(btn => {
        const btnPlan = btn.getAttribute("data-plan");

        if (plan === btnPlan) {
            btn.innerText = "Current Plan";
            btn.disabled = true;
            btn.classList.remove("btn-primary", "btn-secondary");
            btn.classList.add("btn-outline");

            // Highlight current plan card
            const card = document.getElementById(`card-${btnPlan}`);
            if (card) {
                card.style.borderColor = "var(--primary-color)";
                card.style.backgroundColor = "rgba(0, 135, 81, 0.02)";
            }
        } else {
            // If user is on a higher plan, show "Current Plan" (implicitly, but here we just handle upgrade)
            // or if they are on "standard" and looking at "preview", maybe still disabled
            const planWeights = { "preview": 1, "standard": 2, "pro": 3 };
            if (plan && planWeights[btnPlan] < planWeights[plan]) {
                btn.innerText = "Included";
                btn.disabled = true;
                btn.classList.remove("btn-primary", "btn-secondary");
                btn.classList.add("btn-outline");
            } else {
                if (btnPlan === "standard") {
                    btn.innerText = "Upgrade to Standard";
                } else if (btnPlan === "pro") {
                    btn.innerText = "Upgrade to Pro";
                } else {
                    btn.innerText = "Upgrade";
                }
                btn.disabled = false;
            }
        }
    });
}

async function handleUpgrade(plan) {
    if (!auth.currentUser) {
        window.location.href = "login.html?mode=register";
        return;
    }

    if (plan === "preview" || !PLAN_PRICES[plan]) return;

    selectedPlan = plan;

    if (paypalModal) {
        if (paypalModalTitle) {
            paypalModalTitle.innerText = `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}?`;
        }
        paypalModal.classList.remove("hidden");
        renderPayPalButtons(plan);
    }
}

async function renderPayPalButtons(plan) {
    const container = document.getElementById("paypal-button-container");
    if (!container) return;

    // Clear previous buttons
    container.innerHTML = "";

    // Load PayPal SDK if not loaded
    if (!window.paypal) {
        const script = document.createElement("script");
        // Check if PAYPAL_CLIENT_ID is in firebaseConfig, otherwise use a placeholder
        const clientId = firebaseConfig.paypalClientId || "YOUR_PAYPAL_CLIENT_ID";
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            initPayPalButtons(plan);
        };
    } else {
        initPayPalButtons(plan);
    }
}

function initPayPalButtons(plan) {
    if (paypalButtons) {
        paypalButtons.close();
    }

    paypalButtons = window.paypal.Buttons({
        createOrder: (data, actions) => {
            return actions.order.create({
                purchase_units: [{
                    description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - ScanMenu.Africa`,
                    amount: {
                        currency_code: "USD",
                        value: PLAN_PRICES[plan]
                    },
                    custom_id: `${auth.currentUser.uid}|${plan}|${auth.currentUser.email}`
                }],
                application_context: {
                    shipping_preference: "NO_SHIPPING"
                }
            });
        },
        onApprove: async (data, actions) => {
            // Show loading state
            const container = document.getElementById("paypal-button-container");
            container.innerHTML = "<div class='loader'>Verifying payment...</div>";

            try {
                const functions = getFunctions();
                const verifyPayPalPayment = httpsCallable(functions, 'verifyPayPalPayment');
                const result = await verifyPayPalPayment({
                    orderId: data.orderID,
                    plan: plan
                });

                if (result.data.success) {
                    alert("Success! Your account has been upgraded.");
                    window.location.reload();
                } else {
                    alert("Payment verification failed. Please contact support.");
                }
            } catch (error) {
                console.error("Verification error:", error);
                alert("An error occurred while verifying your payment. Please contact support.");
            }
        },
        onError: (err) => {
            console.error("PayPal Error:", err);
            alert("An error occurred with PayPal. Please try again.");
        }
    });

    paypalButtons.render("#paypal-button-container");
}

upgradeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const targetPlan = btn.getAttribute("data-plan");
        handleUpgrade(targetPlan);
    });
});

closeModalBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener("click", () => {
            if (paypalModal) paypalModal.classList.add("hidden");
        });
    }
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
    if (e.target === paypalModal) {
        paypalModal.classList.add("hidden");
    }
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements for Login/Register
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const errorMessage = document.getElementById("error-message");
const toggleAuthBtn = document.getElementById("toggle-auth");
const passwordHint = document.getElementById("password-hint");

let isRegisterMode = false;
let isRedirectingAfterAuth = false;

// Check URL parameters for registration mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') === 'register') {
    setAuthMode(true);
}

// Function to toggle between Login and Register
function setAuthMode(isRegister) {
    isRegisterMode = isRegister;
    if (isRegisterMode) {
        authTitle.innerText = "Create Account";
        authSubtitle.innerText = "Join ScanMenuQR today!";
        btnText.innerText = "Create Account";
        toggleAuthBtn.innerText = "Sign In";
        const switchTextEl = document.getElementById("switch-text");
        if (switchTextEl) {
            switchTextEl.innerHTML = `Already have an account? <a href="#" id="toggle-auth">Sign In</a>`;
            document.getElementById("toggle-auth").addEventListener("click", (e) => {
                e.preventDefault();
                setAuthMode(!isRegisterMode);
            });
        }
        passwordHint.classList.remove("hidden");
    } else {
        authTitle.innerText = "Sign In";
        authSubtitle.innerText = "Welcome back! Please enter your details.";
        btnText.innerText = "Sign In";
        toggleAuthBtn.innerText = "Create Account";
        const switchTextEl = document.getElementById("switch-text");
        if (switchTextEl) {
            switchTextEl.innerHTML = `Don't have an account? <a href="#" id="toggle-auth">Create Account</a>`;
            document.getElementById("toggle-auth").addEventListener("click", (e) => {
                e.preventDefault();
                setAuthMode(!isRegisterMode);
            });
        }
        passwordHint.classList.add("hidden");
    }
    errorMessage.classList.add("hidden");
}

if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setAuthMode(!isRegisterMode);
    });
}

// Map Firebase error codes to friendly messages
function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/user-disabled":
            return "This account has been disabled.";
        case "auth/user-not-found":
            return "No account found with this email.";
        case "auth/wrong-password":
            return "Incorrect password. Please try again.";
        case "auth/email-already-in-use":
            return "This email is already registered.";
        case "auth/weak-password":
            return "Password must be at least 6 characters long.";
        case "auth/network-request-failed":
            return "Network error. Please check your connection.";
        case "auth/invalid-credential":
            return "Invalid email or password.";
        default:
            return "An unexpected error occurred. Please try again.";
    }
}

// Form Submission handling
if (authForm) {
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // Reset UI
        errorMessage.classList.add("hidden");
        btnText.classList.add("hidden");
        btnLoader.classList.remove("hidden");
        authSubmitBtn.disabled = true;

        try {
            if (isRegisterMode) {
                // Register
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Create user document in Firestore
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    email: user.email,
                    createdAt: serverTimestamp()
                });

                isRedirectingAfterAuth = true;
                window.location.href = "dashboard.html";
            } else {
                // Login
                await signInWithEmailAndPassword(auth, email, password);
                isRedirectingAfterAuth = true;
                window.location.href = "dashboard.html";
            }
        } catch (error) {
            console.error("Auth Error:", error);
            errorMessage.innerText = getFriendlyErrorMessage(error.code);
            errorMessage.classList.remove("hidden");

            // Restore UI
            btnText.classList.remove("hidden");
            btnLoader.classList.add("hidden");
            authSubmitBtn.disabled = false;
        }
    });
}

// Logout functionality
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            // Explicitly redirect to index.html as per requirements
            window.location.href = "index.html";
        } catch (error) {
            console.error("Logout Error:", error);
        }
    });
}

// Authentication state listener and redirection logic
onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    const currentPage = path.substring(path.lastIndexOf('/') + 1) || "index.html";

    // If we are currently handling a manual redirect after auth action, skip this listener
    if (isRedirectingAfterAuth) return;

    if (user) {
        // User is signed in
        if (currentPage === "login.html" || currentPage === "index.html") {
            window.location.href = "dashboard.html";
        }
    } else {
        // User is signed out
        if (currentPage === "dashboard.html") {
            // Requirement: unauthenticated users accessing dashboard.html must be redirected to login.html
            window.location.href = "login.html";
        }
    }
});

export { auth, db, signOut };

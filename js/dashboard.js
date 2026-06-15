import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const userEmailEl = document.getElementById("user-email");
const userDisplayEmailEl = document.getElementById("user-display-email");
const userUidEl = document.getElementById("user-uid");
const userCreatedAtEl = document.getElementById("user-created-at");

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, fetch Firestore data
        try {
            userEmailEl.innerText = user.email;
            userDisplayEmailEl.innerText = user.email.split('@')[0];
            userUidEl.innerText = user.uid;

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
                console.error("No such document in Firestore!");
                userCreatedAtEl.innerText = "Not found in records";
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            userCreatedAtEl.innerText = "Error loading date";
        }
    }
});

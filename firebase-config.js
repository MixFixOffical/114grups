import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCKMeyABL01rsQ-FcLAn81QO5TvSdxFjU",
    authDomain: "othets-1aa03.firebaseapp.com",
    projectId: "othets-1aa03",
    storageBucket: "othets-1aa03.firebasestorage.app",
    messagingSenderId: "528392191591",
    appId: "1:528392191591:web:1e97790e6f9f0a6e175ec2",
    measurementId: "G-F50WVZRXZJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// firebase-config.js (compat)
const firebaseConfig = {
    apiKey: "AIzaSyCKMeyABL01rsQ-FcLAn81QO5TvSdxSFjU",
  authDomain: "othets-1aa03.firebaseapp.com",
  projectId: "othets-1aa03",
  storageBucket: "othets-1aa03.firebasestorage.app",
  messagingSenderId: "528392191591",
  appId: "1:528392191591:web:1e97790e6f9f0a6e175ec2",
  measurementId: "G-F50WVZRXZJ"
};

firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
window.auth = firebase.auth();

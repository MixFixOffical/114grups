// firebase-config.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Конфигурация Firebase проекта
const firebaseConfig = {
  apiKey: "AIzaSyAHuLu3Ud4YFzWXlwkCUtrgOPvFINFTJPw",
  authDomain: "sokrat-7c938.firebaseapp.com",
  projectId: "sokrat-7c938",
  storageBucket: "sokrat-7c938.firebasestorage.app",
  messagingSenderId: "19858604945",
  appId: "1:19858604945:web:8ec6dc1a81dba35c481030",
  measurementId: "G-B3SDDN1T50"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Analytics (только в браузере)
let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Auth и Firestore — то, что нужно страницам
const auth = getAuth(app);
const db = getFirestore(app);

// Карта: роль → домашняя страница
const HOME_BY_ROLE = {
  admin:      'adminhome.html',
  director:   'directorhome.html',
  deputy_ur:  'deputy_urhome.html',
  cmc_chair:  'cmc_chairhome.html',
  methodist:  'methodisthome.html',
  teacher:    'teacherhome.html'
};

export { app, analytics, auth, db, firebaseConfig, HOME_BY_ROLE };

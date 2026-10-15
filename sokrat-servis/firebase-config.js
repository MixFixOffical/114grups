// firebase-config.js
// Импорт необходимых функций из Firebase SDK
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Конфигурация Firebase проекта
// Для Firebase JS SDK v7.20.0 и выше measurementId опционален
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

// Инициализация Analytics (опционально, только для браузера)
let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

export { app, analytics, firebaseConfig };

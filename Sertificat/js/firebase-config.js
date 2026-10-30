// =====================================================================
//  ПОДКЛЮЧЕНИЕ К FIREBASE — единственный файл, где нужно что-то менять
//  Вставьте конфиг из Firebase Console → Project settings → Your apps
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, getDocs, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx"
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR");

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Реэкспорт функций, чтобы index.html импортировал всё из одного файла
export {
  collection, doc, setDoc, getDoc, updateDoc, getDocs, deleteDoc,
  query, where, serverTimestamp,
  ref, uploadBytes, getDownloadURL, deleteObject
};

/** Вызывает callback(user) после входа. Если пользователя нет — входит анонимно. */
export function onUser(callback) {
  onAuthStateChanged(auth, user => {
    if (user) callback(user);
    else signInAnonymously(auth).catch(err => console.error("Ошибка входа:", err));
  });
}

/*
 * ПРАВИЛА БЕЗОПАСНОСТИ (скопировать в консоль Firebase)
 *
 * Firestore Database → Rules:
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /works/{workId} {
 *       allow read, update, delete: if request.auth != null
 *         && resource.data.ownerId == request.auth.uid;
 *       allow create: if request.auth != null
 *         && request.resource.data.ownerId == request.auth.uid;
 *     }
 *     match /certificates/{certId} {
 *       allow read, update, delete: if request.auth != null
 *         && resource.data.ownerId == request.auth.uid;
 *       allow create: if request.auth != null
 *         && request.resource.data.ownerId == request.auth.uid;
 *     }
 *   }
 * }
 *
 * Storage → Rules:
 *
 * rules_version = '2';
 * service firebase.storage {
 *   match /b/{bucket}/o {
 *     match /certificates/{uid}/{file=**} {
 *       allow read, delete: if request.auth != null && request.auth.uid == uid;
 *       allow create, update: if request.auth != null
 *         && request.auth.uid == uid
 *         && request.resource.contentType == 'application/pdf'
 *         && request.resource.size < 10 * 1024 * 1024;
 *     }
 *   }
 * }
 *
 * Authentication → Sign-in method → включить «Anonymous».
 */

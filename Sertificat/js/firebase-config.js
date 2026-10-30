/* =====================================================================
   ПОДКЛЮЧЕНИЕ К FIREBASE — единственный файл, где нужно что-то менять.
   Вставьте конфиг из Firebase Console → Project settings → Your apps → Web app.
   ===================================================================== */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx"
};

(function () {
  const configured = !firebaseConfig.apiKey.startsWith("YOUR");
  let auth = null, db = null, storage = null;

  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
  } catch (e) {
    console.error("Firebase не инициализирован:", e);
  }

  window.FB = {
    configured,
    auth,
    db,
    storage,
    serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp(),

    /** callback(user) вызывается после входа; если пользователя нет — входим анонимно. */
    onUser(callback, onError) {
      auth.onAuthStateChanged(user => {
        if (user) callback(user);
        else auth.signInAnonymously().catch(err => onError && onError(err));
      });
    }
  };
})();

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

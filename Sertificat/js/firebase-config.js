/* =====================================================================
   ПОДКЛЮЧЕНИЕ К FIREBASE — единственный файл, где нужно что-то менять.
   Storage НЕ используется: PDF хранится в Firestore (поле pdfBase64).
   ===================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyA_TA5KIOH5GQxBw6ThLCP56PgDJtRWR6I",
  authDomain: "mixfixbank1.firebaseapp.com",
  databaseURL: "https://mixfixbank1-default-rtdb.firebaseio.com",
  projectId: "mixfixbank1",
  storageBucket: "mixfixbank1.firebasestorage.app",
  messagingSenderId: "82594956649",
  appId: "1:82594956649:web:a4dc8434d59c57a21069f8",
  measurementId: "G-P8BTGTR3D2"
};

(function () {
  const configured = !firebaseConfig.apiKey.startsWith("YOUR");
  let auth = null, db = null;

  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (e) {
    console.error("Firebase не инициализирован:", e);
  }

  window.FB = {
    configured,
    auth,
    db,
    serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp(),

    onUser(callback, onError) {
      auth.onAuthStateChanged(user => {
        if (user) callback(user);
        else auth.signInAnonymously().catch(err => onError && onError(err));
      });
    }
  };
})();

/*
 * =====================================================================
 * ПРАВИЛА FIRESTORE — скопировать в Firestore Database → Rules → Publish
 * =====================================================================
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *
 *     match /works/{workId} {
 *       allow read, update, delete: if request.auth != null
 *         && resource.data.ownerId == request.auth.uid;
 *       allow create: if request.auth != null
 *         && request.resource.data.ownerId == request.auth.uid;
 *     }
 *
 *     match /certificates/{certId} {
 *       allow read, update, delete: if request.auth != null
 *         && resource.data.ownerId == request.auth.uid;
 *       allow create: if request.auth != null
 *         && request.resource.data.ownerId == request.auth.uid;
 *     }
 *
 *     match /{document=**} {
 *       allow read, write: if false;
 *     }
 *   }
 * }
 *
 * ── Authentication → Sign-in method ────────────────────────────────
 * Включить «Anonymous».
 *
 * ── Storage → Rules ────────────────────────────────────────────────
 * Не нужны: Storage не используется.
 */

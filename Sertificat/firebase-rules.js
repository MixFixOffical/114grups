/*
 * ПРАВИЛА БЕЗОПАСНОСТИ FIREBASE
 *
 * 1) Firestore: Firebase Console → Firestore Database → Rules → вставить firestoreRules → Publish
 * 2) Storage:   Firebase Console → Storage → Rules → вставить storageRules → Publish
 * 3) Authentication: Sign-in method → включить «Anonymous» (анонимный вход).
 *
 * Каждый пользователь видит и меняет только свои данные (по auth.uid).
 */

export const firestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Работы (тема, предмет, группы и студенты с оценками)
    match /works/{workId} {
      allow read, update, delete: if request.auth != null
        && resource.data.ownerId == request.auth.uid;
      allow create: if request.auth != null
        && request.resource.data.ownerId == request.auth.uid;
    }

    // Сертификаты (метаданные PDF)
    match /certificates/{certId} {
      allow read, update, delete: if request.auth != null
        && resource.data.ownerId == request.auth.uid;
      allow create: if request.auth != null
        && request.resource.data.ownerId == request.auth.uid;
    }
  }
}`;

export const storageRules = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // PDF-сертификаты: папка certificates/{uid}/...
    match /certificates/{uid}/{file=**} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.contentType == 'application/pdf'
        && request.resource.size < 10 * 1024 * 1024;
    }
  }
}`;

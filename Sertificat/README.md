# CertGen — генератор сертификатов

## Структура
```
certgen/
├── index.html
├── css/style.css
├── js/
│   ├── firebase-config.js   ← вставьте свой конфиг Firebase
│   ├── certificate.js       ← дизайн и генерация PDF
│   └── app.js               ← логика приложения
└── firebase-rules.js        ← правила Firestore и Storage (для копирования в консоль)
```

## Настройка Firebase
1. Создайте проект на https://console.firebase.google.com
2. Добавьте Web-приложение, скопируйте конфиг в `js/firebase-config.js`.
3. Authentication → Sign-in method → включите **Anonymous**.
4. Firestore Database → Create database → вставьте `firestoreRules` из `firebase-rules.js` → Publish.
5. Storage → Get started → вставьте `storageRules` → Publish.

## Запуск
ES-модули не работают при открытии файла двойным кликом, нужен локальный сервер:
- VS Code → расширение **Live Server**, или
- `python -m http.server 8080` в папке проекта и откройте http://localhost:8080

## Формат оценок
`5/3`, `4,5/5`, `5` — всё сохраняется как введено и выводится в сертификат.

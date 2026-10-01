/* =========================================================
   SERVICE WORKER — Посещаемость
========================================================= */

const CACHE_NAME = "attendance-v1";
const OFFLINE_URL = "offline.html";

// Ресурсы для предзагрузки
const PRECACHE_URLS = [
    "/",
    "/index.html",
    "/offline.html",
    "/manifest.json"
];

/* ---------- Установка ---------- */
self.addEventListener("install", function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(PRECACHE_URLS).catch(function(err) {
                    console.warn("Не удалось предзагрузить часть ресурсов:", err);
                });
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

/* ---------- Активация ---------- */
self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME;
                }).map(function(key) {
                    return caches.delete(key);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

/* ---------- Fetch ---------- */
self.addEventListener("fetch", function(event) {
    const req = event.request;

    // Не трогаем не-GET и запросы Firebase
    if (req.method !== "GET") return;
    if (req.url.includes("firebase") || req.url.includes("googleapis")) return;
    if (req.url.startsWith("chrome-extension://")) return;

    // Навигационные запросы — network-first с fallback на офлайн
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then(function(response) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(req, copy);
                    });
                    return response;
                })
                .catch(function() {
                    return caches.match(req).then(function(cached) {
                        return cached || caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // Остальные — cache-first, обновление в фоне
    event.respondWith(
        caches.match(req).then(function(cached) {
            const fetchPromise = fetch(req).then(function(response) {
                if (response && response.status === 200) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(req, copy);
                    });
                }
                return response;
            }).catch(function() {
                return cached;
            });

            return cached || fetchPromise;
        })
    );
});

/* ---------- Сообщения ---------- */
self.addEventListener("message", function(event) {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

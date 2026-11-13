/* =========================================================
   SERVICE WORKER — Посещаемость
========================================================= */

const CACHE_NAME = "attendance-v3";
const OFFLINE_URL = "/offline.html";

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
                // addAll падает целиком, если хоть один ресурс недоступен.
                // Поэтому грузим по одному, чтобы offline.html точно попал в кэш.
                return Promise.all(
                    PRECACHE_URLS.map(function(url) {
                        return cache.add(url).catch(function(err) {
                            console.warn("Precache skip:", url, err);
                        });
                    })
                );
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

/* ---------- Утилита: безопасное кэширование ---------- */
function safePut(cacheName, request, response) {
    // Кэшируем только успешные GET-ответы. 206/opaque/redirect — пропускаем.
    if (!response) return;
    if (response.status !== 200) return;
    if (response.type === "opaque") return;
    if (response.type === "opaqueredirect") return;
    if (response.redirected) return;

    const copy = response.clone();
    caches.open(cacheName)
        .then(function(cache) {
            return cache.put(request, copy);
        })
        .catch(function(err) {
            console.warn("cache.put skipped:", request.url, err);
        });
}

/* ---------- Фолбэк-ответ ---------- */
function offlineFallback() {
    return caches.match(OFFLINE_URL).then(function(cached) {
        if (cached) return cached;
        return new Response(
            "<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;padding:40px'>" +
            "<h2>Нет соединения</h2><p>Проверьте интернет и обновите страницу.</p>" +
            "</body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    });
}

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
                    safePut(CACHE_NAME, req, response);
                    return response;
                })
                .catch(function() {
                    return caches.match(req).then(function(cached) {
                        return cached || offlineFallback();
                    });
                })
        );
        return;
    }

    // Остальные — cache-first, обновление в фоне
    event.respondWith(
        caches.match(req).then(function(cached) {
            const fetchPromise = fetch(req)
                .then(function(response) {
                    safePut(CACHE_NAME, req, response);
                    return response;
                })
                .catch(function() {
                    // Возвращаем кэш или явный Response, чтобы respondWith не получил undefined
                    return cached || Response.error();
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

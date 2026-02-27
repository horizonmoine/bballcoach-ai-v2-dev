const CACHE_NAME = "bballcoach-v2.1";
const STATIC_ASSETS = [
    "/",
    "/manifest.json",
    "/icon-192x192.png",
    "/icon-512x512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(console.error))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Bypass non-GET requests
    if (request.method !== "GET") return;

    // Bypass cross-origin requests (e.g. Supabase)
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Network-first for API calls
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(
            fetch(request).catch(async () => {
                return new Response(JSON.stringify({ error: "Offline" }), {
                    status: 503,
                    headers: { "Content-Type": "application/json" },
                });
            })
        );
        return;
    }

    // Network-first for HTML pages (navigation requests)
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(async () => {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match("/");
                if (cachedResponse) return cachedResponse;
                return new Response("Offline", { status: 503, statusText: "Offline" });
            })
        );
        return;
    }

    // Cache-first (Stale-while-revalidate) for static assets
    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    return null;
                });

            return cached || networkFetch.then(res => res || new Response("", { status: 404 }));
        })
    );
});

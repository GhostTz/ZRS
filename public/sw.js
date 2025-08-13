const CACHE_NAME = 'zrs-cache-v1';
const urlsToCache = [
    '/zrs/',
    '/zrs/index.html',
    '/zrs/index.css',
    '/zrs/index.js',
    '/zrs/css/global.css',
    '/zrs/dashboard/dashboard.html',
    '/zrs/dashboard/dashboard.css',
    '/zrs/dashboard/dashboard.js',
    '/zrs/Requests/requests.html',
    '/zrs/Requests/requests.css',
    '/zrs/Requests/requests.js',
    '/zrs/Requests/new_request.html',
    '/zrs/Requests/new_request.css',
    '/zrs/Requests/new_request.js',
    '/zrs/Requests/my_requests.html',
    '/zrs/Requests/my_requests.css',
    '/zrs/Requests/my_requests.js',
    '/zrs/Settings/settings.html',
    '/zrs/Settings/settings.css',
    '/zrs/Settings/settings.js',
    '/zrs/assets/logo.png',
    '/zrs/assets/pfp_placeholder.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installiere...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching App Shell');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('/api/')) {
        return event.respondWith(fetch(event.request));
    }
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});

self.addEventListener('push', function(event) {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/zrs/assets/icons/icon-192x192.png',
        badge: '/zrs/assets/icons/icon-192x192.png'
    };
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});
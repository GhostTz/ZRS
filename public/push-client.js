// public/push-client.js
self.addEventListener('push', function(event) {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/zrs/assets/logo.png', // Optional: Ein Icon für die Benachrichtigung
        badge: '/zrs/assets/logo.png' // Optional: Ein kleines Badge (Android)
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});
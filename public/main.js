if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/zrs/sw.js', { scope: '/zrs/' })
            .then(registration => {
                console.log('ServiceWorker registriert mit Scope:', registration.scope);
            })
            .catch(err => {
                console.error('ServiceWorker Registrierung fehlgeschlagen:', err);
            });
    });
}
// Auth Guard - Führt die Sitzungsprüfung aus, bevor irgendetwas anderes geladen wird.
(async function checkAuth() {
    const accessToken = localStorage.getItem('zrs_accessToken');
    if (!accessToken) {
        window.location.href = '/zrs/';
        return;
    }

    try {
        const response = await fetch('/zrs/api/auth/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });

        if (!response.ok) {
            throw new Error('Sitzung ungültig.');
        }

        console.log('Sitzung ist gültig.');
        // Nur wenn die Sitzung gültig ist, den Rest der Seite initialisieren.
        initializePage();

    } catch (error) {
        console.error('Authentifizierungsfehler:', error.message);
        localStorage.removeItem('zrs_accessToken');
        localStorage.removeItem('zrs_user');
        window.location.href = '/zrs/';
    }
})();

function initializePage() {
    function initializeNavigation() {
        const navMenu = document.getElementById('nav-menu');
        const mainContent = document.getElementById('main-content');
        const userProfileNav = document.getElementById('user-profile-nav');
        const navUsername = document.getElementById('nav-username');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const overlay = document.getElementById('overlay');
        const toggleMenu = (isActive) => {
            navMenu.classList.toggle('active', isActive);
            overlay.classList.toggle('active', isActive);
        };
        if (window.innerWidth > 768) {
            navMenu.addEventListener('mouseenter', () => {
                navMenu.classList.add('expanded');
                mainContent.classList.add('expanded');
            });
            navMenu.addEventListener('mouseleave', () => {
                navMenu.classList.remove('expanded');
                mainContent.classList.remove('expanded');
            });
        }
        mobileMenuToggle.addEventListener('click', () => toggleMenu(true));
        overlay.addEventListener('click', () => toggleMenu(false));
        try {
            const user = JSON.parse(localStorage.getItem('zrs_user'));
            if (user && user.Name) {
                navUsername.textContent = user.Name;
            }
        } catch (error) {
            console.error("Fehler beim Parsen der Benutzerdaten:", error);
            navUsername.textContent = "Error";
        }
        userProfileNav.addEventListener('click', () => {
            window.location.href = '/zrs/Settings/settings.html';
        });
    }
    
    initializeNavigation();

    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('zrs_accessToken');
        localStorage.removeItem('zrs_user');
        window.location.href = '/zrs/';
    });

    const subscriptionDetails = document.getElementById('subscription-details');

    const loadSubscriptionInfo = async () => {
        const user = JSON.parse(localStorage.getItem('zrs_user'));
        if (!user) {
            subscriptionDetails.innerHTML = '<p>Fehler: Benutzerdaten nicht gefunden.</p>';
            return;
        }
        try {
            const response = await fetch(`/zrs/api/user/subscription?userId=${user.Id}`);
            const sub = await response.json();
            if (sub && sub.status === 'active') {
                const startDate = new Date(sub.startDate);
                const endDate = new Date(sub.endDate);
                const now = new Date();
                const totalDuration = endDate - startDate;
                const elapsedDuration = now - startDate;
                let progress = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));
                const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                const daysLeftText = daysLeft > 0 ? `${daysLeft} Tag(e)` : 'Heute';
                subscriptionDetails.innerHTML = `
                    <dl class="subscription-info"><dt>Status</dt><dd style="color: var(--success); font-weight: bold;">Aktiv</dd><dt>Gültig bis</dt><dd>${endDate.toLocaleDateString('de-DE')}</dd><dt>Zahlungsmethode</dt><dd>${sub.paymentMethod || 'N/A'}</dd><dt>Verbleibende Zeit</dt><dd>${daysLeftText}</dd></dl>
                    <div class="progress-bar-container"><div class="progress-bar"><div class="progress-bar-inner" style="width: ${progress}%;"></div></div><p class="progress-bar-label">${Math.round(progress)}% verbraucht</p></div>
                `;
            } else {
                subscriptionDetails.innerHTML = `
                    <dl class="subscription-info"><dt>Status</dt><dd style="color: var(--success); font-weight: bold;">Aktiv</dd><dt>Gültig bis</dt><dd>Unbegrenzt</dd></dl>
                `;
            }
        } catch (error) {
            console.error(error);
            subscriptionDetails.innerHTML = `<p>Fehler beim Laden der Abo-Daten.</p>`;
        }
    };
    
    loadSubscriptionInfo();

    const passwordForm = document.getElementById('password-change-form');
    const changePasswordButton = document.getElementById('change-password-button');
    passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const passwordMessage = document.getElementById('password-message');
        passwordMessage.textContent = '';
        passwordMessage.className = 'message';
        if (newPassword.length < 8) {
            passwordMessage.textContent = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.';
            passwordMessage.classList.add('error'); return;
        }
        if (newPassword !== confirmPassword) {
            passwordMessage.textContent = 'Die neuen Passwörter stimmen nicht überein.';
            passwordMessage.classList.add('error'); return;
        }
        changePasswordButton.disabled = true;
        changePasswordButton.textContent = 'Ändere...';
        try {
            const accessToken = localStorage.getItem('zrs_accessToken');
            const response = await fetch('/zrs/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Ein unbekannter Fehler ist aufgetreten.');
            passwordMessage.textContent = data.message;
            passwordMessage.classList.add('success');
            passwordForm.reset();
        } catch (error) {
            passwordMessage.textContent = error.message;
            passwordMessage.classList.add('error');
        } finally {
            changePasswordButton.disabled = false;
            changePasswordButton.textContent = 'Speichern';
        }
    });

    // --- LOGIK FÜR PUSH-BENACHRICHTIGUNGEN (AKTUALISIERT) ---
    const pushButton = document.getElementById('toggle-push-button');
    const feedbackText = document.getElementById('notification-feedback');
    let isSubscribed = false;
    let swRegistration = null;

    async function getVapidPublicKey() {
        const response = await fetch('/zrs/api/push/vapidPublicKey');
        return response.json();
    }

    async function initializePush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            pushButton.textContent = 'Push nicht unterstützt';
            pushButton.disabled = true;
            return;
        }
        try {
            swRegistration = await navigator.serviceWorker.ready;
            console.log('Service Worker ist bereit:', swRegistration);
            await updateUI();
        } catch (error) {
            console.error('Fehler beim Abrufen des Service Workers:', error);
            pushButton.textContent = 'Push nicht unterstützt';
            pushButton.disabled = true;
        }
    }

    async function updateUI() {
        if (!swRegistration) return;
        const subscription = await swRegistration.pushManager.getSubscription();
        isSubscribed = (subscription !== null);
        if (isSubscribed) {
            pushButton.textContent = 'Benachrichtigungen auf diesem Gerät deaktivieren';
            pushButton.classList.add('subscribed');
        } else {
            pushButton.textContent = 'Benachrichtigungen auf diesem Gerät aktivieren';
            pushButton.classList.remove('subscribed');
        }
        pushButton.disabled = false;
    }

    async function handleSubscribeClick() {
        pushButton.disabled = true;
        if (isSubscribed) {
            await unsubscribeUser();
        } else {
            await subscribeUser();
        }
    }

    async function subscribeUser() {
        try {
            const { publicKey } = await getVapidPublicKey();
            const applicationServerKey = urlB64ToUint8Array(publicKey);
            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });
            await saveSubscriptionToServer(subscription);
            feedbackText.textContent = 'Erfolgreich abonniert!';
            feedbackText.className = 'message success';
        } catch (err) {
            console.error('Abonnement fehlgeschlagen: ', err);
            feedbackText.textContent = 'Abonnement fehlgeschlagen. Bitte Berechtigung erteilen.';
            feedbackText.className = 'message error';
        }
        await updateUI();
    }

    async function unsubscribeUser() {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
            await deleteSubscriptionFromServer(subscription);
            await subscription.unsubscribe();
            feedbackText.textContent = 'Abonnement beendet.';
            feedbackText.className = 'message';
        }
        await updateUI();
    }

    pushButton.addEventListener('click', handleSubscribeClick);

    function urlB64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
        return outputArray;
    }

    async function saveSubscriptionToServer(subscription) {
        const accessToken = localStorage.getItem('zrs_accessToken');
        await fetch('/zrs/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify(subscription)
        });
    }

    async function deleteSubscriptionFromServer(subscription) {
        const accessToken = localStorage.getItem('zrs_accessToken');
        await fetch('/zrs/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
    }

    initializePush();
}
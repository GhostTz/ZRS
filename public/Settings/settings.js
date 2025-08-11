// Auth Guard
(async function checkAuth() {
    const accessToken = localStorage.getItem('zrs_accessToken');
    if (!accessToken) { window.location.href = '/zrs/'; return; }
    try {
        const response = await fetch('/zrs/api/auth/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });
        if (!response.ok) throw new Error('Sitzung ungültig.');
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
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordMessage = document.getElementById('password-message');
    const changePasswordButton = document.getElementById('change-password-button');

    passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        passwordMessage.textContent = '';
        passwordMessage.className = 'message';
        if (newPassword.length < 8) {
            passwordMessage.textContent = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.';
            passwordMessage.classList.add('error');
            return;
        }
        if (newPassword !== confirmPassword) {
            passwordMessage.textContent = 'Die neuen Passwörter stimmen nicht überein.';
            passwordMessage.classList.add('error');
            return;
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
            if (!response.ok) {
                throw new Error(data.message || 'Ein unbekannter Fehler ist aufgetreten.');
            }
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
}
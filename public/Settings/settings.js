document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('zrs_accessToken')) {
        window.location.href = '/zrs/';
        return;
    }

    function initializeNavigation() { /* ... (unveränderter Code) ... */ }
    initializeNavigation();

    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', () => { /* ... (unveränderter Code) ... */ });

    // ================== NEUE LOGIK FÜR ABO-ANZEIGE ==================
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

            if (sub.status === 'active') {
                const startDate = new Date(sub.startDate);
                const endDate = new Date(sub.endDate);
                const now = new Date();

                const totalDuration = endDate - startDate;
                const elapsedDuration = now - startDate;
                let progress = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));

                const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                const daysLeftText = daysLeft > 0 ? `${daysLeft} Tag(e)` : 'Heute';

                subscriptionDetails.innerHTML = `
                    <dl class="subscription-info">
                        <dt>Status</dt>
                        <dd style="color: var(--success); font-weight: bold;">Aktiv</dd>
                        
                        <dt>Gültig bis</dt>
                        <dd>${endDate.toLocaleDateString('de-DE')}</dd>
                        
                        <dt>Zahlungsmethode</dt>
                        <dd>${sub.paymentMethod || 'N/A'}</dd>
                        
                        <dt>Verbleibende Zeit</dt>
                        <dd>${daysLeftText}</dd>
                    </dl>
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-bar-inner" style="width: ${progress}%;"></div>
                        </div>
                        <p class="progress-bar-label">${Math.round(progress)}% verbraucht</p>
                    </div>
                `;
            } else {
                // Der "Unendlich"-Fall für Admins oder User ohne Abo
                subscriptionDetails.innerHTML = `
                    <dl class="subscription-info">
                        <dt>Status</dt>
                        <dd style="color: var(--success); font-weight: bold;">Aktiv</dd>
                        
                        <dt>Gültig bis</dt>
                        <dd>Unbegrenzt</dd>
                    </dl>
                `;
            }
        } catch (error) {
            console.error(error);
            subscriptionDetails.innerHTML = `<p>Fehler beim Laden der Abo-Daten.</p>`;
        }
    };
    
    loadSubscriptionInfo();
    // =====================================================================

    const passwordForm = document.getElementById('password-change-form');
    passwordForm.addEventListener('submit', async (event) => { /* ... (unveränderter Code) ... */ });
});
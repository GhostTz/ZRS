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

    const requestsList = document.getElementById('requests-list');

    const createRequestElement = (request) => {
        const element = document.createElement('div');
        element.className = 'request-item';
        const posterUrl = request.mediaPosterPath ? `https://image.tmdb.org/t/p/w92${request.mediaPosterPath}` : 'https://via.placeholder.com/60x90.png?text=N/A';
        const requestDate = new Date(request.requestDate).toLocaleDateString('de-DE');
        let statusIcon, statusText;
        switch (request.status) {
            case 'accepted': statusIcon = '✅'; statusText = 'Verfügbar'; break;
            case 'rejected': statusIcon = '❌'; statusText = 'Abgelehnt'; break;
            default: statusIcon = '🕒'; statusText = 'In Bearbeitung'; break;
        }
        element.innerHTML = `
            <img class="request-item-poster" src="${posterUrl}" alt="Poster">
            <div class="request-item-details"><h3>${request.mediaTitle}</h3><p>Angefragt am: ${requestDate}</p></div>
            <div class="request-item-status status-${request.status}">${statusIcon}<span>${statusText}</span></div>
        `;
        return element;
    };

    const loadMyRequests = async () => {
        requestsList.innerHTML = '<div class="loader"></div>';
        const user = JSON.parse(localStorage.getItem('zrs_user'));
        if (!user) {
            requestsList.innerHTML = '<p>Fehler: Benutzerdaten nicht gefunden.</p>';
            return;
        }
        try {
            const response = await fetch(`/zrs/api/my-requests?userId=${user.Id}`);
            if (!response.ok) throw new Error('Fehler beim Laden der Anfragen.');
            const requests = await response.json();
            requestsList.innerHTML = '';
            if (requests.length === 0) {
                requestsList.innerHTML = '<p>Du hast noch keine Anfragen gestellt.</p>';
            } else {
                requests.forEach(request => requestsList.appendChild(createRequestElement(request)));
            }
        } catch (error) {
            console.error(error);
            requestsList.innerHTML = `<p>${error.message}</p>`;
        }
    };
    loadMyRequests();
}
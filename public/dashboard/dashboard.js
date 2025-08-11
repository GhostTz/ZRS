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
    console.log('Benutzer ist eingeloggt. Dashboard wird geladen.');

    function initializeNavigation() {
        const navMenu = document.getElementById('nav-menu');
        const mainContent = document.getElementById('main-content');
        const userProfileNav = document.getElementById('user-profile-nav');
        const navUsername = document.getElementById('nav-username');
        const welcomeUsername = document.getElementById('welcome-username');
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
                if (welcomeUsername) {
                    welcomeUsername.textContent = user.Name;
                }
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
}
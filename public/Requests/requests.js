document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard
    if (!localStorage.getItem('zrs_accessToken')) {
        window.location.href = '/zrs/';
        return;
    }

    // Standard-Navigationslogik
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
});
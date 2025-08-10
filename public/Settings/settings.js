document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('zrs_accessToken')) {
        window.location.href = '/zrs/'; // Korrigierter Pfad
        return;
    }

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
            window.location.href = '/zrs/Settings/settings.html'; // Korrigierter Pfad
        });
    }
    
    initializeNavigation();

    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('zrs_accessToken');
        localStorage.removeItem('zrs_user');
        window.location.href = '/zrs/'; // Korrigierter Pfad
    });

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
            // ================== KORREKTUR HIER ==================
            const response = await fetch(`/zrs/api/my-requests?userId=${user.Id}`);
            // ======================================================
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
            // ================== KORREKTUR HIER ==================
            const response = await fetch('/zrs/api/user/change-password', {
            // ======================================================
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
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
});
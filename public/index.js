document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('zrs_accessToken')) {
        window.location.href = '/zrs/dashboard/dashboard.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        errorMessage.textContent = '';
        loginButton.disabled = true;
        loginButton.textContent = 'Melde an...';

        try {
            // ================== KORREKTUR HIER ==================
            const response = await fetch('/zrs/api/login', {
            // ======================================================
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Ein unbekannter Fehler ist aufgetreten.');
            }
            
            console.log('Login erfolgreich!', data);
            localStorage.setItem('zrs_accessToken', data.accessToken);
            localStorage.setItem('zrs_user', JSON.stringify(data.user));

            window.location.href = '/zrs/dashboard/dashboard.html'; 

        } catch (error) {
            errorMessage.textContent = error.message;
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
        }
    });
});
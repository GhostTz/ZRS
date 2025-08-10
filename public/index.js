document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard: Wenn der Benutzer bereits eingeloggt ist, direkt zum Dashboard weiterleiten.
    if (localStorage.getItem('zrs_accessToken')) {
        window.location.href = '/dashboard/dashboard.html';
        return; // Stoppt die Ausführung, um ein Aufblitzen der Login-Seite zu verhindern
    }

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Verhindert das Neuladen der Seite

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // UI für Ladevorgang aktualisieren
        errorMessage.textContent = '';
        loginButton.disabled = true;
        loginButton.textContent = 'Melde an...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Zeigt die Fehlermeldung vom Server an
                throw new Error(data.message || 'Ein unbekannter Fehler ist aufgetreten.');
            }
            
            // Login war erfolgreich
            console.log('Login erfolgreich!', data);
            
            // Speichere den AccessToken und die User-Daten im Browser, um eingeloggt zu bleiben
            localStorage.setItem('zrs_accessToken', data.accessToken);
            localStorage.setItem('zrs_user', JSON.stringify(data.user));

            // Leite zur neuen Dashboard-Seite weiter
            window.location.href = '/dashboard/dashboard.html'; 

        } catch (error) {
            errorMessage.textContent = error.message;
        } finally {
            // UI zurücksetzen
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
        }
    });
});
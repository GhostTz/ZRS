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

    const resultsGrid = document.getElementById('results-grid');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsTitle = document.getElementById('results-title');

    const displayMedia = (items) => {
        resultsGrid.innerHTML = '';
        if (!items || items.length === 0) {
            resultsGrid.innerHTML = '<p>Keine Ergebnisse gefunden.</p>';
            return;
        }
        items.forEach(item => {
            if (item.media_type !== 'movie' && item.media_type !== 'tv') return;
            const title = item.title || item.name;
            const year = item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4) || '';
            const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : 'https://via.placeholder.com/342x513.png?text=Kein+Bild';
            const card = document.createElement('div');
            card.className = 'media-card';
            card.innerHTML = `
                <div class="poster-wrapper"><img src="${posterPath}" alt="${title}" loading="lazy"></div>
                <div class="media-card-info"><h3>${title}</h3><div class="card-footer"><span>${year}</span><button class="request-btn" data-id="${item.id}" data-type="${item.media_type}"><i class="fas fa-plus"></i> Anfragen</button></div></div>
            `;
            resultsGrid.appendChild(card);
        });
    };

    const handleRequest = async (event) => {
        const button = event.target.closest('.request-btn');
        if (!button) return;

        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const mediaId = button.dataset.id;
        const mediaType = button.dataset.type;
        const user = JSON.parse(localStorage.getItem('zrs_user'));

        try {
            // ================== KORREKTUR HIER ==================
            const response = await fetch('/zrs/api/request', {
            // ======================================================
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaId, mediaType, user })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Ein unbekannter Fehler ist aufgetreten.');
            button.innerHTML = '<i class="fas fa-check"></i> Angefragt!';
            button.classList.add('success');
        } catch (error) {
            alert(error.message);
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-plus"></i> Anfragen';
            button.classList.remove('success');
        }
    };
    
    resultsGrid.addEventListener('click', handleRequest);

    const performSearch = async (query) => {
        resultsTitle.textContent = `Suchergebnisse für "${query}"`;
        resultsGrid.innerHTML = '<div class="loader"></div>';
        try {
            // ================== KORREKTUR HIER ==================
            const response = await fetch(`/zrs/api/tmdb/search?q=${encodeURIComponent(query)}`);
            // ======================================================
            const data = await response.json();
            displayMedia(data.results);
        } catch (error) {
            console.error('Fehler bei der Suche:', error);
            resultsGrid.innerHTML = '<p>Fehler bei der Suche. Bitte versuchen Sie es erneut.</p>';
        }
    };

    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const query = searchInput.value.trim();
        if (query) performSearch(query);
    });

    const loadPopular = async () => {
        resultsTitle.textContent = 'Aktuell Beliebt';
        resultsGrid.innerHTML = '<div class="loader"></div>';
        try {
            // ================== KORREKTUR HIER ==================
            const response = await fetch('/zrs/api/tmdb/popular');
            // ======================================================
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Serverfehler');
            displayMedia(data.results);
        } catch (error) {
            console.error('Fehler beim Laden der beliebten Titel:', error);
            resultsGrid.innerHTML = '<p>Fehler beim Laden der beliebten Titel. Bitte versuchen Sie es erneut.</p>';
        }
    };

    loadPopular();
});
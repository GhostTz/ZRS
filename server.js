require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { createRequestEmbed } = require('./dc/handler/requestHandler');

// --- Konfiguration ---
const PORT = process.env.SERVER_PORT || 3000;
const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!JELLYFIN_URL || !JELLYFIN_API_KEY || !TMDB_API_KEY || !DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    console.error('❌ FEHLER: Eine oder mehrere Konfigurationsvariablen in der .env-Datei fehlen.');
    process.exit(1);
}

// --- "DATENBANK"-HELFER ---
const dbDir = path.join(__dirname, 'db');
const requestsFile = path.join(dbDir, 'requests.json');

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const db = {
    readRequests: () => {
        if (!fs.existsSync(requestsFile) || fs.readFileSync(requestsFile).length === 0) return [];
        try {
            return JSON.parse(fs.readFileSync(requestsFile));
        } catch (e) {
            console.error("Fehler beim Parsen der requests.json: ", e);
            return [];
        }
    },
    writeRequests: (requests) => {
        fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
    },
    saveRequest: (requestData) => {
        const requests = db.readRequests();
        requests.unshift(requestData);
        db.writeRequests(requests);
    },
    updateRequestStatus: (requestId, status, adminUsername) => {
        let requests = db.readRequests();
        const requestIndex = requests.findIndex(r => r.requestId === requestId);
        if (requestIndex !== -1) {
            requests[requestIndex].status = status;
            requests[requestIndex].handledBy = adminUsername;
            requests[requestIndex].handledAt = new Date().toISOString();
            db.writeRequests(requests);
            return requests[requestIndex];
        }
        return null;
    }
};

// --- Discord Client & Express App Initialisierung ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- API Route für den Jellyfin Login ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Benutzername und Passwort sind erforderlich.' });
    try {
        const authHeader = `MediaBrowser Client="ZRS", Device="WebApp", DeviceId="ZRS-WebApp", Version="1.0.0"`;
        const response = await fetch(`${JELLYFIN_URL}/Users/AuthenticateByName`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': authHeader },
            body: JSON.stringify({ Username: username, Pw: password })
        });
        if (!response.ok) {
            if (response.status === 401) return res.status(401).json({ message: 'Benutzername oder Passwort ist falsch.' });
            return res.status(response.status).json({ message: 'Ein Fehler ist auf dem Jellyfin-Server aufgetreten.' });
        }
        const sessionInfo = await response.json();
        res.status(200).json({ message: 'Login erfolgreich!', accessToken: sessionInfo.AccessToken, user: sessionInfo.User });
    } catch (error) {
        console.error('Login API Fehler:', error);
        res.status(500).json({ message: 'Interner Serverfehler.' });
    }
});


// --- Route, um beliebte Filme UND Serien abzurufen ---
app.get('/api/tmdb/popular', async (req, res) => {
    try {
        const moviesUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=de-DE&page=1`;
        const tvUrl = `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=de-DE&page=1`;
        const [moviesResponse, tvResponse] = await Promise.all([fetch(moviesUrl), fetch(tvUrl)]);
        if (!moviesResponse.ok || !tvResponse.ok) throw new Error('Fehler beim Abrufen der TMDB-Daten.');
        const moviesData = await moviesResponse.json();
        const tvData = await tvResponse.json();
        const movies = moviesData.results.map(item => ({ ...item, media_type: 'movie' }));
        const tvShows = tvData.results.map(item => ({ ...item, media_type: 'tv' }));
        const combinedResults = [...movies, ...tvShows].sort(() => 0.5 - Math.random());
        res.status(200).json({ results: combinedResults });
    } catch (error) {
        console.error('TMDB Popular API Fehler:', error);
        res.status(500).json({ message: 'Fehler beim Abrufen der beliebten Titel.' });
    }
});


// --- Route für die Suche nach Filmen und Serien ---
app.get('/api/tmdb/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ message: 'Ein Suchbegriff ist erforderlich.' });
    try {
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=de-DE&query=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Fehler beim Abrufen der TMDB-Daten.');
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('TMDB Search API Fehler:', error);
        res.status(500).json({ message: 'Fehler bei der Suche.' });
    }
});


// --- Route zum Erstellen einer neuen Anfrage ---
app.post('/api/request', async (req, res) => {
    const { mediaId, mediaType, user } = req.body;
    if (!mediaId || !mediaType || !user) return res.status(400).json({ message: 'Unvollständige Anfrage.' });
    try {
        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${TMDB_API_KEY}&language=de-DE`;
        const tmdbResponse = await fetch(detailsUrl);
        if (!tmdbResponse.ok) throw new Error('Konnte Mediendetails nicht abrufen.');
        const mediaDetails = await tmdbResponse.json();
        const titleToCheck = mediaDetails.title || mediaDetails.name;
        const yearToCheck = parseInt((mediaDetails.release_date || mediaDetails.first_air_date || '0').substring(0, 4));
        const jellyfinSearchUrl = `${JELLYFIN_URL}/Items?searchTerm=${encodeURIComponent(titleToCheck)}&Recursive=true&IncludeItemTypes=Movie,Series`;
        const jellyfinHeaders = { 'X-Emby-Token': JELLYFIN_API_KEY };
        const jellyfinResponse = await fetch(jellyfinSearchUrl, { headers: jellyfinHeaders });
        if (!jellyfinResponse.ok) {
            console.warn(`Warnung: Jellyfin-Check für Titel "${titleToCheck}" fehlgeschlagen. Status: ${jellyfinResponse.status}`);
        } else {
            const jellyfinData = await jellyfinResponse.json();
            const exists = jellyfinData.Items.some(item =>
                item.Name.toLowerCase() === titleToCheck.toLowerCase() &&
                item.ProductionYear === yearToCheck
            );
            if (exists) {
                console.log(`Abgebrochen: "${titleToCheck}" (${yearToCheck}) existiert bereits auf dem Jellyfin-Server.`);
                return res.status(409).json({ message: 'Dieser Titel ist bereits auf dem Server verfügbar!' });
            }
        }
        const allRequests = db.readRequests();
        const existingRequest = allRequests.find(r => r.mediaTmdbId.toString() === mediaId.toString());
        if (existingRequest) {
            let userMessage = '';
            switch (existingRequest.status) {
                case 'pending': userMessage = 'Dieser Titel wurde bereits angefragt und ist in Bearbeitung.'; break;
                case 'accepted': userMessage = 'Dieser Titel ist bereits verfügbar!'; break;
                case 'rejected': userMessage = 'Dieser Titel wurde bereits angefragt und in der Vergangenheit abgelehnt.'; break;
                default: userMessage = 'Dieser Titel wurde bereits angefragt.';
            }
            console.log(`Abgebrochen: Duplikatsanfrage für TMDB ID ${mediaId} mit Status "${existingRequest.status}".`);
            return res.status(409).json({ message: userMessage });
        }
        mediaDetails.media_type = mediaType;
        const requestId = `${Date.now()}-${user.Id.slice(0, 8)}`;
        db.saveRequest({ requestId, requesterJellyfinId: user.Id, requesterJellyfinUsername: user.Name, requestDate: new Date().toISOString(), status: 'pending', mediaType, mediaTmdbId: mediaDetails.id, mediaTitle: mediaDetails.title || mediaDetails.name, mediaPosterPath: mediaDetails.poster_path });
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (!channel) return res.status(500).json({ message: 'Discord-Kanal nicht gefunden.' });
        const messagePayload = createRequestEmbed(mediaDetails, user, requestId);
        await channel.send(messagePayload);
        res.status(200).json({ message: 'Anfrage erfolgreich gespeichert und an Discord gesendet!' });
    } catch (error) {
        console.error('Fehler bei /api/request:', error);
        res.status(500).json({ message: 'Ein interner Fehler ist aufgetreten.' });
    }
});


// --- API Route zum Abrufen persönlicher Anfragen ---
app.get('/api/my-requests', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ message: 'Benutzer-ID ist erforderlich.' });
    }
    const allRequests = db.readRequests();
    const userRequests = allRequests.filter(r => r.requesterJellyfinId === userId);
    res.status(200).json(userRequests);
});


// --- API ROUTE ZUM ÄNDERN DES PASSWORTS (MIT DER FINALEN KORREKTUR) ---
app.post('/api/user/change-password', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentifizierungstoken fehlt oder ist ungültig.' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Alle Felder sind erforderlich.' });
    }

    try {
        const meResponse = await fetch(`${JELLYFIN_URL}/Users/Me`, {
            headers: { 'Authorization': `MediaBrowser Token="${accessToken}"` }
        });
        if (!meResponse.ok) throw new Error('Benutzersitzung ist ungültig oder abgelaufen.');
        const user = await meResponse.json();
        const userId = user.Id;
        
        // ======================== FINALE KORREKTUR HIER ========================
        // KORREKTUR 1: Die URL wurde gemäß der Doku angepasst (Query-Parameter)
        const changePasswordUrl = `${JELLYFIN_URL}/Users/Password?userId=${userId}`;
        // =======================================================================

        const changePasswordResponse = await fetch(changePasswordUrl, {
            method: 'POST',
            headers: {
                'Authorization': `MediaBrowser Token="${accessToken}"`,
                'Content-Type': 'application/json'
            },
            // =======================================================================
            // KORREKTUR 2: Der Body wurde gemäß der Doku angepasst (CurrentPw, NewPw)
            body: JSON.stringify({
                CurrentPw: currentPassword,
                NewPw: newPassword
            })
            // =======================================================================
        });

        if (changePasswordResponse.status === 204) {
            return res.status(200).json({ message: 'Passwort erfolgreich geändert!' });
        } else if (changePasswordResponse.status === 401) {
            return res.status(401).json({ message: 'Das aktuelle Passwort ist nicht korrekt.' });
        } else {
            const errorText = await changePasswordResponse.text();
            console.error("Jellyfin-Antwort bei Passwortänderung (Status " + changePasswordResponse.status + "):", errorText);
            throw new Error(`Jellyfin-Server hat mit einem Fehler geantwortet.`);
        }

    } catch (error) {
        console.error('Fehler bei der Passwortänderung:', error);
        res.status(500).json({ message: error.message || 'Ein interner Serverfehler ist aufgetreten.' });
    }
});


// --- DISCORD INTERACTION LISTENER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const [command, action, requestId] = interaction.customId.split(':');
    if (command !== 'request') return;
    
    await interaction.deferUpdate();

    try {
        const originalMessage = interaction.message;
        const originalEmbed = originalMessage.embeds[0];
        const newStatus = action === 'approve' ? 'accepted' : 'rejected';
        const updatedRequest = db.updateRequestStatus(requestId, newStatus, interaction.user.username);

        if (updatedRequest) {
            const newEmbed = EmbedBuilder.from(originalEmbed)
                .setColor(newStatus === 'accepted' ? '#28a745' : '#dc3545')
                .addFields({ name: 'Status', value: `${newStatus === 'accepted' ? '✅ Hochgeladen' : '❌ Abgelehnt'} durch ${interaction.user.username}`, inline: false });
            
            await interaction.editReply({ embeds: [newEmbed], components: [] });
            console.log(`Request ${requestId} wurde von ${interaction.user.username} auf "${newStatus}" gesetzt.`);
        } else {
            await interaction.editReply({ content: 'Fehler: Dieser Request wurde nicht in der Datenbank gefunden.', embeds: [], components: [] });
        }
    } catch (error) {
        console.error(`Fehler beim Bearbeiten der Interaktion für Request ${requestId}:`, error);
        await interaction.followUp({ content: 'Ein Fehler ist aufgetreten. Bitte prüfe die Konsole.', ephemeral: true });
    }
});


// --- Server & Bot Start ---
client.login(DISCORD_BOT_TOKEN);
app.listen(PORT, () => {
    console.log(`✅ ZRS-Server läuft auf http://localhost:${PORT}`);
});
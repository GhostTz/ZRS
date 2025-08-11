require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, Collection } = require('discord.js');
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
const subsFile = path.join(dbDir, 'subs.json');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const db = {
    readRequests: () => {
        if (!fs.existsSync(requestsFile) || fs.readFileSync(requestsFile).length === 0) return [];
        try { return JSON.parse(fs.readFileSync(requestsFile)); }
        catch (e) { console.error("Fehler beim Parsen der requests.json: ", e); return []; }
    },
    writeRequests: (requests) => fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2)),
    saveRequest: (requestData) => { const r = db.readRequests(); r.unshift(requestData); db.writeRequests(r); },
    updateRequestStatus: (id, status, admin) => {
        let r = db.readRequests();
        const i = r.findIndex(req => req.requestId === id);
        if (i !== -1) { r[i].status = status; r[i].handledBy = admin; r[i].handledAt = new Date().toISOString(); db.writeRequests(r); return r[i]; }
        return null;
    },
    readSubscriptions: () => {
        if (!fs.existsSync(subsFile) || fs.readFileSync(subsFile).length === 0) return [];
        try { return JSON.parse(fs.readFileSync(subsFile)); }
        catch (e) { console.error("Fehler beim Parsen der subs.json: ", e); return []; }
    },
    writeSubscriptions: (subs) => fs.writeFileSync(subsFile, JSON.stringify(subs, null, 2)),
    saveSubscription: (subData) => {
        const subs = db.readSubscriptions();
        const existingSubIndex = subs.findIndex(s => s.jellyfinUsername.toLowerCase() === subData.jellyfinUsername.toLowerCase());
        if (existingSubIndex > -1) {
            subs[existingSubIndex] = subData;
        } else {
            subs.unshift(subData);
        }
        db.writeSubscriptions(subs);
    }
};

// --- Discord Client & Befehls-Lader ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, 'dc/commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./dc/commands/${file}`);
    client.commands.set(command.name, command);
}

// --- Express App ---
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- API ROUTE ZUR SITZUNGSVALIDIERUNG ---
app.post('/api/auth/validate', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) {
        return res.status(401).json({ valid: false, message: 'Kein Token bereitgestellt.' });
    }

    try {
        const response = await fetch(`${JELLYFIN_URL}/Users/Me`, {
            headers: { 'Authorization': `MediaBrowser Token="${accessToken}"` }
        });

        if (response.ok) {
            res.status(200).json({ valid: true });
        } else {
            res.status(401).json({ valid: false, message: 'Sitzung ungültig.' });
        }
    } catch (error) {
        console.error('Fehler bei der Sitzungsvalidierung:', error);
        res.status(500).json({ valid: false, message: 'Interner Serverfehler.' });
    }
});


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
    if (!userId) return res.status(400).json({ message: 'Benutzer-ID ist erforderlich.' });
    const allRequests = db.readRequests();
    const userRequests = allRequests.filter(r => r.requesterJellyfinId === userId);
    res.status(200).json(userRequests);
});


// --- API ROUTE ZUM ÄNDERN DES PASSWORTS ---
app.post('/api/user/change-password', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentifizierungstoken fehlt oder ist ungültig.' });
    const accessToken = authHeader.split(' ')[1];
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Alle Felder sind erforderlich.' });
    try {
        const meResponse = await fetch(`${JELLYFIN_URL}/Users/Me`, { headers: { 'Authorization': `MediaBrowser Token="${accessToken}"` } });
        if (!meResponse.ok) throw new Error('Benutzersitzung ist ungültig oder abgelaufen.');
        const user = await meResponse.json();
        const userId = user.Id;
        const changePasswordUrl = `${JELLYFIN_URL}/Users/Password?userId=${userId}`;
        const changePasswordResponse = await fetch(changePasswordUrl, {
            method: 'POST',
            headers: { 'Authorization': `MediaBrowser Token="${accessToken}"`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ CurrentPw: currentPassword, NewPw: newPassword })
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


// --- API ROUTE ZUM ABRUFEN DES ABO-STATUS ---
app.get('/api/user/subscription', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ message: 'Benutzer-ID ist erforderlich.' });
    }
    try {
        const subs = db.readSubscriptions();
        const userSub = subs.find(s => s.jellyfinUserId === userId && (s.status === 'active' || new Date(s.endDate) > new Date()));
        if (userSub && userSub.status !== 'revoked' && userSub.status !== 'deleted') {
            res.status(200).json(userSub);
        } else {
            res.status(200).json({ status: 'none', message: 'Kein aktives Abo gefunden.' });
        }
    } catch (error) {
        console.error('Fehler beim Abrufen des Abonnements:', error);
        res.status(500).json({ message: 'Interner Serverfehler.' });
    }
});


// --- DISCORD INTERACTION ROUTER ---
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            if (interaction.commandName === 'sub' && interaction.options.getSubcommand() === 'info') {
                await command.handleInfo(interaction, db, JELLYFIN_URL, JELLYFIN_API_KEY);
            } else {
                await command.execute(interaction);
            }
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) await interaction.followUp({ content: 'Beim Ausführen ist ein Fehler aufgetreten!', ephemeral: true });
            else await interaction.reply({ content: 'Beim Ausführen ist ein Fehler aufgetreten!', ephemeral: true });
        }
        return;
    }
    if (interaction.isModalSubmit()) {
        const [commandName] = interaction.customId.split(':');
        const modalCommand = client.commands.get(commandName);
        if (modalCommand && typeof modalCommand.handleModalSubmit === 'function') {
            await modalCommand.handleModalSubmit(interaction, JELLYFIN_URL, JELLYFIN_API_KEY, db);
        }
        return;
    }
    if (interaction.isButton()) {
        const [commandName, action, data] = interaction.customId.split(':');
        if (commandName === 'request') {
            await interaction.deferUpdate();
            const requestId = data;
            const originalMessage = interaction.message;
            const originalEmbed = originalMessage.embeds[0];
            const newStatus = action === 'approve' ? 'accepted' : 'rejected';
            const updatedRequest = db.updateRequestStatus(requestId, newStatus, interaction.user.username);
            if (updatedRequest) {
                const newEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(newStatus === 'accepted' ? '#28a745' : '#dc3545')
                    .addFields({ name: 'Status', value: `${newStatus === 'accepted' ? '✅ Hochgeladen' : '❌ Abgelehnt'} durch ${interaction.user.username}`, inline: false });
                await interaction.editReply({ embeds: [newEmbed], components: [] });
            } else {
                await interaction.editReply({ content: 'Fehler: Dieser Request wurde nicht in der Datenbank gefunden.', embeds: [], components: [] });
            }
        } else if (commandName === 'sub') {
            const buttonCommand = client.commands.get(commandName);
            if (buttonCommand && typeof buttonCommand.handleButtonInteraction === 'function') {
                await buttonCommand.handleButtonInteraction(interaction, db, JELLYFIN_URL, JELLYFIN_API_KEY);
            }
        }
        return;
    }
});


// --- Server & Bot Start ---
client.login(DISCORD_BOT_TOKEN);
app.listen(PORT, () => {
    console.log(`✅ ZRS-Server läuft auf http://localhost:${PORT}`);
});
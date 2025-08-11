// deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'sub',
        description: 'Verwaltet Benutzer-Abonnements.',
        options: [
            {
                name: 'add',
                description: 'Fügt ein neues Abonnement für einen Benutzer hinzu.',
                type: 1, // SUB_COMMAND
            },
            {
                name: 'remove',
                description: 'Entfernt ein Abonnement und deaktiviert den Benutzer.',
                type: 1, // SUB_COMMAND
            },
            {
                name: 'info',
                description: 'Zeigt Informationen über das Abonnement eines Benutzers an.',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'username',
                        description: 'Der Jellyfin-Benutzername, der überprüft werden soll.',
                        type: 3, // STRING
                        required: true,
                    }
                ]
            }
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log(`Starte das Registrieren von ${commands.length} (/) Anwendungsbefehlen.`);

        // Die put-Methode synchronisiert die Befehle vollständig.
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
            { body: commands },
        );

        console.log(`Erfolgreich ${data.length} (/) Anwendungsbefehle neu geladen.`);
    } catch (error) {
        console.error(error);
    }
})();
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');

// --- HILFSFUNKTIONEN ---

async function findJellyfinUser(username, JELLYFIN_URL, JELLYFIN_API_KEY) {
    try {
        const usersResponse = await fetch(`${JELLYFIN_URL}/Users`, { headers: { 'X-Emby-Token': JELLYFIN_API_KEY } });
        if (!usersResponse.ok) return { error: 'Konnte Jellyfin-Benutzer nicht abrufen.' };
        const users = await usersResponse.json();
        const user = users.find(u => u.Name.toLowerCase() === username.toLowerCase());
        if (!user) return { user: null };
        return { user };
    } catch (error) {
        return { error: 'Fehler bei der Jellyfin-API-Anfrage.' };
    }
}

async function deleteJellyfinUser(userId, JELLYFIN_URL, JELLYFIN_API_KEY) {
    const deleteUrl = `${JELLYFIN_URL}/Users/${userId}`;
    const jellyfinHeaders = { 'Authorization': `MediaBrowser Token="${JELLYFIN_API_KEY}"` };
    try {
        const response = await fetch(deleteUrl, { method: 'DELETE', headers: jellyfinHeaders });
        if (response.status === 204) return { success: true };
        return { error: `Fehler beim Löschen des Benutzers (Status: ${response.status})` };
    } catch (error) {
        console.error("Fehler in deleteJellyfinUser:", error);
        return { error: error.message };
    }
}


// --- BEFEHLS-LOGIK ---
module.exports = {
    name: 'sub',

    async execute(interaction) {
        const subCommand = interaction.options.getSubcommand();
        switch (subCommand) {
            case 'add': await this.handleAdd(interaction); break;
            case 'remove': await this.handleRemove(interaction); break;
            case 'info': break;
        }
    },

    async handleAdd(interaction) {
        const modal = new ModalBuilder().setCustomId('sub:add_modal').setTitle('Neues Abonnement erstellen');
        const usernameInput = new TextInputBuilder().setCustomId('jellyfin_username').setLabel("Jellyfin-Benutzername").setStyle(TextInputStyle.Short).setRequired(true);
        const durationInput = new TextInputBuilder().setCustomId('duration_months').setLabel("Dauer in Monaten (z.B. 1, 3, 12)").setStyle(TextInputStyle.Short).setRequired(true);
        const paymentInput = new TextInputBuilder().setCustomId('payment_method').setLabel("Zahlungsmethode/Notiz").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(usernameInput), new ActionRowBuilder().addComponents(durationInput), new ActionRowBuilder().addComponents(paymentInput));
        await interaction.showModal(modal);
    },

    async handleRemove(interaction) {
        const modal = new ModalBuilder().setCustomId('sub:remove_modal').setTitle('Abonnement & Benutzer löschen');
        const usernameInput = new TextInputBuilder().setCustomId('jellyfin_username').setLabel("Jellyfin-Benutzername").setStyle(TextInputStyle.Short).setRequired(true);
        const reasonInput = new TextInputBuilder().setCustomId('removal_reason').setLabel("Grund für die Löschung").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(usernameInput), new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    },

    async handleInfo(interaction, db, JELLYFIN_URL, JELLYFIN_API_KEY) {
        await interaction.deferReply();
        const username = interaction.options.getString('username');
        const [jellyfinResult, subInfo] = await Promise.all([
            findJellyfinUser(username, JELLYFIN_URL, JELLYFIN_API_KEY),
            db.readSubscriptions().find(s => s.jellyfinUsername.toLowerCase() === username.toLowerCase())
        ]);
        const jellyfinUser = jellyfinResult.user;
        if (!jellyfinUser && !subInfo) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#dc3545').setTitle('Nicht gefunden').setDescription(`Der Benutzer "${username}" konnte weder in Jellyfin noch in der Abonnement-Datenbank gefunden werden.`)] });
        }
        const embed = new EmbedBuilder().setTitle(`Info für: ${username}`);
        if (jellyfinUser) {
            embed.addFields({ name: 'Jellyfin-Status', value: '✅ Account existiert', inline: true }, { name: 'Jellyfin User ID', value: `\`${jellyfinUser.Id}\``, inline: true });
        } else {
            embed.addFields({ name: 'Jellyfin-Status', value: '❌ Account existiert nicht (gelöscht)', inline: true });
        }
        if (subInfo) {
            const endDate = new Date(subInfo.endDate);
            const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            if (subInfo.status === 'deleted' || subInfo.status === 'revoked') {
                embed.setColor('#6c757d').addFields({ name: 'Abo-Status', value: `❌ Gelöscht/Entfernt am ${new Date(subInfo.endDate).toLocaleDateString('de-DE')}` });
                if(subInfo.removalReason) embed.addFields({ name: 'Grund', value: subInfo.removalReason });
            } else if (daysLeft > 0) {
                embed.setColor('#28a745').addFields({ name: 'Abo-Status', value: '✅ Aktiv' }, { name: 'Endet in', value: `${daysLeft} Tag(en)`, inline: true }, { name: 'Zahlungsmethode', value: subInfo.paymentMethod, inline: true });
            } else {
                embed.setColor('#ffc107').addFields({ name: 'Abo-Status', value: '🕒 Abgelaufen' }, { name: 'Endete am', value: endDate.toLocaleDateString('de-DE'), inline: true }, { name: 'Zahlungsmethode', value: subInfo.paymentMethod, inline: true });
            }
        } else {
            embed.setColor('#17a2b8').addFields({ name: 'Abo-Status', value: 'ℹ️ Kein Abonnement-Eintrag gefunden' });
        }
        await interaction.editReply({ embeds: [embed] });
    },

    async handleModalSubmit(interaction, JELLYFIN_URL, JELLYFIN_API_KEY, db) {
        const [_, action] = interaction.customId.split(':');
        await interaction.deferReply({ ephemeral: true });
        const jellyfinUsername = interaction.fields.getTextInputValue('jellyfin_username');
        
        if (action === 'add_modal') {
            const { user: jellyfinUser, error: jellyfinError } = await findJellyfinUser(jellyfinUsername, JELLYFIN_URL, JELLYFIN_API_KEY);
            if (jellyfinError || !jellyfinUser) return interaction.editReply({ content: `Fehler: ${jellyfinError || `Benutzer "${jellyfinUsername}" nicht gefunden.`}`, ephemeral: true });
            
            const existingSub = db.readSubscriptions().find(s => s.jellyfinUsername.toLowerCase() === jellyfinUser.Name.toLowerCase());

            const durationMonths = parseInt(interaction.fields.getTextInputValue('duration_months'), 10);
            const paymentMethod = interaction.fields.getTextInputValue('payment_method');
            if (isNaN(durationMonths) || durationMonths < 1) return interaction.editReply({ content: 'Fehler: Die Dauer muss eine positive Zahl sein.', ephemeral: true });
            
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(startDate.getMonth() + durationMonths);

            const confirmationData = { jellyfinUserId: jellyfinUser.Id, jellyfinUsername: jellyfinUser.Name, durationMonths, paymentMethod, startDate: startDate.toISOString(), endDate: endDate.toISOString(), status: 'active' };
            
            const embed = new EmbedBuilder().setTitle('Abo-Bestätigung').setColor('#f0ad4e')
                .addFields(
                    { name: 'Jellyfin User', value: `${jellyfinUser.Name}` },
                    { name: 'Laufzeit', value: `${durationMonths} Monat(e)`, inline: true },
                    { name: 'Enddatum', value: endDate.toLocaleDateString('de-DE'), inline: true }
                );

            if (existingSub) {
                embed.addFields({
                    name: '⚠️ Hinweis',
                    value: 'Ein altes Abo für diesen Benutzer existiert bereits. Durch das Speichern werden die alten Daten überschrieben.'
                }).setColor('#ffc107');
            }

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sub:confirm_save:${jellyfinUser.Id}`).setLabel('Speichern').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`sub:cancel:${jellyfinUser.Id}`).setLabel('Abbrechen').setStyle(ButtonStyle.Danger)
            );

            interaction.client.tempSubData = interaction.client.tempSubData || new Map();
            interaction.client.tempSubData.set(jellyfinUser.Id, confirmationData);
            await interaction.editReply({ content: 'Bitte bestätigen:', embeds: [embed], components: [buttons], ephemeral: true });
        }

        if (action === 'remove_modal') {
            const { user: jellyfinUser, error: jellyfinError } = await findJellyfinUser(jellyfinUsername, JELLYFIN_URL, JELLYFIN_API_KEY);
            if (jellyfinError || !jellyfinUser) return interaction.editReply({ content: `Fehler: ${jellyfinError || `Benutzer "${jellyfinUsername}" nicht gefunden.`}`, ephemeral: true });
            
            const subInfo = db.readSubscriptions().find(s => s.jellyfinUserId === jellyfinUser.Id);
            if (!subInfo) return interaction.editReply({ content: `Fehler: Für "${jellyfinUsername}" existiert kein Abonnement-Eintrag.`, ephemeral: true });

            const reason = interaction.fields.getTextInputValue('removal_reason');
            const removalData = { reason };
            const embed = new EmbedBuilder().setTitle('LÖSCH-BESTÄTIGUNG').setColor('#dc3545').setDescription(`**ACHTUNG!** Diese Aktion löscht den Jellyfin-Account von **${jellyfinUser.Name}** endgültig und unwiderruflich.`).addFields({ name: 'Grund', value: reason });
            const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sub:confirm_remove:${jellyfinUser.Id}`).setLabel('Endgültig löschen').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`sub:cancel:${jellyfinUser.Id}`).setLabel('Abbrechen').setStyle(ButtonStyle.Secondary));
            
            interaction.client.tempRemovalData = interaction.client.tempRemovalData || new Map();
            interaction.client.tempRemovalData.set(jellyfinUser.Id, removalData);
            await interaction.editReply({ content: 'Bitte die endgültige Löschung bestätigen:', embeds: [embed], components: [buttons], ephemeral: true });
        }
    },

    async handleButtonInteraction(interaction, db, JELLYFIN_URL, JELLYFIN_API_KEY) {
        const [_, action, userId] = interaction.customId.split(':');

        if (action === 'cancel') {
            interaction.client.tempSubData?.delete(userId);
            interaction.client.tempRemovalData?.delete(userId);
            return interaction.update({ content: 'Vorgang abgebrochen.', embeds: [], components: [] });
        }

        if (action === 'confirm_save') {
            const subData = interaction.client.tempSubData?.get(userId);
            if (!subData) return interaction.update({ content: 'Fehler: Temporäre Daten abgelaufen. Bitte neu starten.', embeds: [], components: [] });
            
            db.saveSubscription(subData);
            interaction.client.tempSubData.delete(userId);
            return interaction.update({ content: `✅ Abonnement für **${subData.jellyfinUsername}** erfolgreich gespeichert!`, embeds: [], components: [] });
        }

        if (action === 'confirm_remove') {
            const removalData = interaction.client.tempRemovalData?.get(userId);
            const subs = db.readSubscriptions();
            const subDataIndex = subs.findIndex(s => s.jellyfinUserId === userId);
            if (subDataIndex === -1) return interaction.update({ content: 'Fehler: Kein Abonnement für diesen Benutzer gefunden.', embeds: [], components: [] });
            
            const { success, error } = await deleteJellyfinUser(userId, JELLYFIN_URL, JELLYFIN_API_KEY);
            if (error) return interaction.update({ content: `Fehler beim Löschen des Jellyfin-Users: ${error}`, embeds: [], components: [] });

            subs[subDataIndex].status = 'deleted';
            subs[subDataIndex].endDate = new Date().toISOString();
            subs[subDataIndex].removalReason = removalData?.reason || 'Kein Grund angegeben';
            db.writeSubscriptions(subs);
            
            interaction.client.tempRemovalData?.delete(userId);
            return interaction.update({ content: `✅ Der Jellyfin-Account für **${subs[subDataIndex].jellyfinUsername}** wurde endgültig gelöscht.`, embeds: [], components: [] });
        }
    }
};
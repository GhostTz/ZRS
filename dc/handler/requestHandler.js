const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Die Funktion erhält jetzt die requestId, um sie in die Buttons einzubauen
function createRequestEmbed(mediaDetails, requester, requestId) {
    const type = mediaDetails.media_type === 'movie' ? 'movie' : 'tv';

    const embed = new EmbedBuilder()
        .setColor('#e94560') // Einheitliche Farbe für "Pending"
        .setTitle(mediaDetails.title || mediaDetails.name)
        .setURL(`https://www.themoviedb.org/${type}/${mediaDetails.id}`)
        .setDescription(mediaDetails.overview || 'Keine Beschreibung verfügbar.')
        .addFields({ name: 'Angefragt von', value: requester.Name || 'Unbekannt', inline: true })
        .setFooter({ text: `Request ID: ${requestId}` })
        .setTimestamp();

    if (mediaDetails.poster_path) {
        embed.setImage(`https://image.tmdb.org/t/p/w500${mediaDetails.poster_path}`);
    }
    if (mediaDetails.release_date || mediaDetails.first_air_date) {
        const year = (mediaDetails.release_date || mediaDetails.first_air_date).substring(0, 4);
        embed.addFields({ name: 'Jahr', value: year, inline: true });
    }

    // ================== KORRIGIERTE BUTTON-IDs ==================
    // Neues Format: command:action:data
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`request:approve:${requestId}`)
                .setLabel('Hochgeladen')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`request:decline:${requestId}`)
                .setLabel('Ablehnen')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );
    // ==========================================================
        
    return { embeds: [embed], components: [row] };
}

module.exports = { createRequestEmbed };
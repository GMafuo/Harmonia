// Charte graphique Harmonia - Inspirée de l'identité visuelle
const COLORS = {
    primary: 0xF59E0B,      // Orange doré principal (Amber-500)
    secondary: 0xFBBF24,    // Jaune doré (Amber-400)
    success: 0x10B981,      // Vert pour succès
    error: 0xEF4444,        // Rouge pour erreurs
    info: 0x3B82F6,         // Bleu pour info
    playing: 0xF97316,      // Orange vif pour lecture
    queue: 0xFBBF24,        // Jaune doré pour la queue
};

const EMOJIS = {
    play: '🎵',
    pause: '⏸️',
    resume: '▶️',
    skip: '⏭️',
    stop: '⏹️',
    queue: '📋',
    nowPlaying: '🎶',
    shuffle: '🔀',
    clear: '🗑️',
    music: '🎧',
    note: '🎼',
    fire: '🔥',
    sparkles: '✨',
    headphones: '🎧',
};

module.exports = {
    COLORS,
    EMOJIS,
    
    // Template pour embed standard
    createEmbed(title, description, color = COLORS.primary) {
        const { EmbedBuilder } = require('discord.js');
        const iconURL = 'https://imgur.com/FvV2kAy.png';
        return new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: 'Harmonia - The spirit of music', iconURL: iconURL });
    },
    
    // Template pour now playing
    createNowPlayingEmbed(song) {
        const { EmbedBuilder } = require('discord.js');
        return new EmbedBuilder()
            .setColor(COLORS.playing)
            .setAuthor({ name: 'Lecture en cours', iconURL: iconURL })
            .setTitle(`${EMOJIS.nowPlaying} ${song.title}`)
            .addFields(
                { name: `${EMOJIS.music} Durée`, value: `\`${song.duration}\``, inline: true },
                { name: `${EMOJIS.headphones} Demandé par`, value: song.requester, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Harmonia', iconURL: iconURL });
    },
    
    // Template pour la queue
    createQueueEmbed(queue, currentSong = null) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setColor(COLORS.queue)
            .setAuthor({ name: 'File d\'attente', iconURL: iconURL })
            .setTitle(`${EMOJIS.queue} Chansons en attente`);
        
        if (currentSong) {
            embed.addFields({
                name: `${EMOJIS.nowPlaying} En cours`,
                value: `**${currentSong.title}** - \`${currentSong.duration}\``,
                inline: false
            });
        }
        
        if (queue.length > 0) {
            const queueList = queue.slice(0, 10).map((song, index) => 
                `**${index + 1}.** ${song.title} - \`${song.duration}\``
            ).join('\n');
            
            embed.addFields({
                name: `${EMOJIS.music} Prochaines chansons`,
                value: queueList,
                inline: false
            });
            
            if (queue.length > 10) {
                embed.addFields({
                    name: '➕ Et plus encore...',
                    value: `${queue.length - 10} autre(s) chanson(s)`,
                    inline: false
                });
            }
        }
        
        embed.setFooter({ 
            text: `${queue.length} chanson(s) en attente • Harmonia`, 
            iconURL: iconURL
        })
        .setTimestamp();
        
        return embed;
    }
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Importer les fonctions depuis play.js
const playCommand = require('./play.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Affiche la file d\'attente des chansons'),

    async execute(interaction) {
        try {
            const queue = playCommand.getQueue(interaction.guildId);
            
            if (!queue || queue.length === 0) {
                return await interaction.reply({
                    content: '❌ La file d\'attente est vide !',
                    flags: [4096]
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎵 File d\'attente')
                .setDescription(queue.map((song, index) => 
                    `**${index + 1}.** ${song.title} - \`${song.duration}\` (Demandé par ${song.requester})`
                ).join('\n'))
                .setFooter({ text: `${queue.length} chanson(s) en attente` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors de l\'affichage de la queue:', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de l\'affichage de la file d\'attente !',
                flags: [4096]
            });
        }
    },
};

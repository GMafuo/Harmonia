const { SlashCommandBuilder } = require('discord.js');
const playCommand = require('./play.js');
const { createQueueEmbed, EMOJIS } = require('../../utils/embedStyles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Affiche la file d\'attente des chansons'),

    async execute(interaction) {
        try {
            const queue = playCommand.getQueue(interaction.guildId);
            const currentSong = playCommand.getCurrentSong(interaction.guildId);
            
            if ((!queue || queue.length === 0) && !currentSong) {
                return await interaction.reply({
                    content: '❌ La file d\'attente est vide !',
                    flags: [4096]
                });
            }

            const embed = createQueueEmbed(queue || [], currentSong);

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

const { SlashCommandBuilder } = require('discord.js');
const playCommand = require('./play.js');
const { createEmbed, COLORS, EMOJIS } = require('../../utils/embedStyles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Mélange la file d\'attente'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            if (!interaction.member.voice.channel) {
                return await interaction.editReply('❌ Tu dois être dans un salon vocal !');
            }

            const queue = playCommand.getQueue(interaction.guildId);

            if (!queue || queue.length === 0) {
                return await interaction.editReply('❌ La file d\'attente est vide !');
            }

            if (queue.length === 1) {
                return await interaction.editReply('❌ Il n\'y a qu\'une seule chanson dans la file d\'attente !');
            }

            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }

            const embed = createEmbed(
                `${EMOJIS.shuffle} File d'attente mélangée`,
                `**${queue.length}** chanson${queue.length > 1 ? 's' : ''} mélangée${queue.length > 1 ? 's' : ''} dans un ordre aléatoire ${EMOJIS.sparkles}`,
                COLORS.success
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur lors du shuffle:', error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ Une erreur est survenue lors du mélange !').catch(console.error);
            }
        }
    }
};

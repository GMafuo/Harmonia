const { SlashCommandBuilder } = require('discord.js');
const playCommand = require('./play.js');
const { createEmbed, COLORS, EMOJIS } = require('../../utils/embedStyles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Vide toute la file d\'attente'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Vérifier si l'utilisateur est dans un salon vocal
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.editReply('❌ Tu dois être dans un salon vocal !');
            }

            // Récupérer la queue
            const queue = playCommand.getQueue(interaction.guildId);

            if (!queue || queue.length === 0) {
                return await interaction.editReply('❌ La file d\'attente est déjà vide !');
            }

            const count = queue.length;
            
            // Vider la queue
            queue.length = 0;

            const embed = createEmbed(
                `${EMOJIS.clear} File d'attente vidée`,
                `**${count}** chanson${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''} avec succès.`,
                COLORS.success
            );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors du clear:', error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ Une erreur est survenue lors du nettoyage !').catch(console.error);
            }
        }
    }
};

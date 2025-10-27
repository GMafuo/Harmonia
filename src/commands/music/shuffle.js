const { SlashCommandBuilder } = require('discord.js');
const playCommand = require('./play.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Mélange la file d\'attente'),

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
                return await interaction.editReply('❌ La file d\'attente est vide !');
            }

            if (queue.length === 1) {
                return await interaction.editReply('❌ Il n\'y a qu\'une seule chanson dans la file d\'attente !');
            }

            // Algorithme de Fisher-Yates pour mélanger
            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }

            await interaction.editReply(`🔀 File d'attente mélangée ! **${queue.length}** chanson${queue.length > 1 ? 's' : ''} dans un ordre aléatoire.`);

        } catch (error) {
            console.error('Erreur lors du shuffle:', error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ Une erreur est survenue lors du mélange !').catch(console.error);
            }
        }
    }
};

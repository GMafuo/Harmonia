const { SlashCommandBuilder } = require('discord.js');
const playCommand = require('./play.js');
const { createNowPlayingEmbed, EMOJIS } = require('../../utils/embedStyles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Affiche la musique en cours de lecture'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Vérifier si l'utilisateur est dans un salon vocal
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.editReply(`❌ Tu dois être dans un salon vocal !`);
            }

            // Récupérer le player et la chanson en cours
            const player = playCommand.getPlayer(interaction.guildId);
            const currentSong = playCommand.getCurrentSong(interaction.guildId);

            if (!player || !currentSong) {
                return await interaction.editReply('❌ Aucune musique n\'est en cours de lecture !');
            }

            // Créer l'embed avec le style Harmonia
            const embed = createNowPlayingEmbed(currentSong);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de nowplaying:', error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ Une erreur est survenue !').catch(console.error);
            }
        }
    }
};

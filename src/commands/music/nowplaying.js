const { SlashCommandBuilder } = require('discord.js');
const playCommand = require('./play.js');
const { createNowPlayingEmbed } = require('../../utils/embedStyles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Affiche la musique en cours de lecture'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            if (!interaction.member.voice.channel) {
                return await interaction.editReply('❌ Tu dois être dans un salon vocal !');
            }

            const player = playCommand.getPlayer(interaction.guildId);
            const currentSong = playCommand.getCurrentSong(interaction.guildId);

            if (!player || !currentSong) {
                return await interaction.editReply('❌ Aucune musique n\'est en cours de lecture !');
            }

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

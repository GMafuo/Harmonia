const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const playCommand = require('./play.js');

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
                return await interaction.editReply('❌ Tu dois être dans un salon vocal !');
            }

            // Récupérer le player et la chanson en cours
            const player = playCommand.getPlayer(interaction.guildId);
            const currentSong = playCommand.getCurrentSong(interaction.guildId);

            if (!player || !currentSong) {
                return await interaction.editReply('❌ Aucune musique n\'est en cours de lecture !');
            }

            // Créer un embed pour afficher la chanson
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎵 Lecture en cours')
                .setDescription(`**${currentSong.title}**`)
                .addFields(
                    { name: '⏱️ Durée', value: currentSong.duration, inline: true },
                    { name: '👤 Demandé par', value: currentSong.requester, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de nowplaying:', error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ Une erreur est survenue !').catch(console.error);
            }
        }
    }
};

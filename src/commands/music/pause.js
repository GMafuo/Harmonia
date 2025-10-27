const { SlashCommandBuilder } = require('discord.js');

// Importer la Map des players depuis play.js
const playCommand = require('./play.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Met en pause la musique en cours'),

    async execute(interaction) {
        try {
            // Vérifier si l'utilisateur est dans un salon vocal
            if (!interaction.member.voice.channel) {
                return await interaction.reply({
                    content: '❌ Tu dois être dans un salon vocal !',
                    flags: [4096]
                });
            }

            const player = playCommand.getPlayer(interaction.guildId);
            
            if (!player) {
                return await interaction.reply({
                    content: '❌ Aucune musique n\'est en cours de lecture !',
                    flags: [4096]
                });
            }

            player.pause();
            await interaction.reply('⏸️ Musique mise en pause !');
        } catch (error) {
            console.error('Erreur lors de la pause:', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de la mise en pause !',
                flags: [4096]
            });
        }
    },
}; 
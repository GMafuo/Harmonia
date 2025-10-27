const { SlashCommandBuilder } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

// Importer les fonctions depuis play.js
const playCommand = require('./play.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Passe à la chanson suivante'),

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

            const queue = playCommand.getQueue(interaction.guildId);
            
            if (!queue || queue.length === 0) {
                await interaction.reply('⏭️ Pas de chanson suivante, arrêt de la lecture...');
                player.stop();
            } else {
                await interaction.reply(`⏭️ Chanson passée ! (${queue.length} chanson(s) restante(s))`);
                player.stop(); // Stop déclenche l'événement Idle qui appelle playNext
            }
        } catch (error) {
            console.error('Erreur lors du skip:', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors du passage de la chanson !',
                flags: [4096]
            });
        }
    },
};

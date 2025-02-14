const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Joue une musique depuis YouTube')
        .addStringOption(option =>
            option.setName('recherche')
                .setDescription('Lien YouTube')
                .setRequired(true)),

    async execute(interaction) {
        try {
            if (!interaction.member.voice.channel) {
                return await interaction.reply({
                    content: 'Tu dois être dans un salon vocal !',
                    ephemeral: true
                });
            }

            await interaction.deferReply();
            const url = interaction.options.getString('recherche');

            // Vérifie si c'est un lien YouTube valide
            if (!ytdl.validateURL(url)) {
                return await interaction.editReply('❌ Merci de fournir un lien YouTube valide ! (ex: https://www.youtube.com/watch?v=...)');
            }

            try {
                const videoInfo = await ytdl.getInfo(url);
                await interaction.editReply(`📀 Préparation de : ${videoInfo.videoDetails.title}`);

                const connection = joinVoiceChannel({
                    channelId: interaction.member.voice.channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });

                const player = createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Play
                    }
                });

                connection.subscribe(player);

                const stream = ytdl(url, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    highWaterMark: 1 << 25
                });

                const resource = createAudioResource(stream, {
                    inlineVolume: true
                });

                resource.volume?.setVolume(0.5);
                player.play(resource);

                player.on(AudioPlayerStatus.Playing, () => {
                    interaction.editReply(`🎵 En lecture : ${videoInfo.videoDetails.title}`);
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    interaction.editReply(`✅ Lecture terminée : ${videoInfo.videoDetails.title}`);
                    connection.destroy();
                });

                player.on('error', error => {
                    console.error('Erreur du lecteur:', error);
                    interaction.editReply(`❌ Erreur : ${error.message}`);
                    connection.destroy();
                });

            } catch (error) {
                console.error('Erreur YouTube:', error);
                return await interaction.editReply('❌ Impossible de lire cette vidéo. Elle est peut-être restreinte ou privée.');
            }

        } catch (error) {
            console.error('Erreur générale:', error);
            if (interaction.deferred) {
                await interaction.editReply('❌ Une erreur est survenue lors de la lecture !');
            } else {
                await interaction.reply({
                    content: '❌ Une erreur est survenue lors de la lecture !',
                    ephemeral: true
                });
            }
        }
    },
}; 
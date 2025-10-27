const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const { spawn } = require('child_process');

// Map pour stocker les players par guild
const players = new Map();

// Map pour stocker les files d'attente par guild
const queues = new Map();

// Fonction pour récupérer un player
function getPlayer(guildId) {
    return players.get(guildId);
}

// Fonction pour récupérer la queue
function getQueue(guildId) {
    return queues.get(guildId);
}

// Fonction pour jouer la prochaine chanson
async function playNext(guildId, voiceChannel, textChannel) {
    const queue = queues.get(guildId);
    
    if (!queue || queue.length === 0) {
        console.log('File d\'attente vide, fin de lecture');
        // Quitter le canal vocal après 1 minute d'inactivité
        setTimeout(() => {
            const currentQueue = queues.get(guildId);
            if (!currentQueue || currentQueue.length === 0) {
                const { getVoiceConnection } = require('@discordjs/voice');
                const connection = getVoiceConnection(guildId);
                if (connection) {
                    connection.destroy();
                    players.delete(guildId);
                    queues.delete(guildId);
                }
            }
        }, 60000);
        return;
    }
    
    const nextSong = queue.shift();
    console.log('Lecture de la prochaine chanson:', nextSong.title);
    
    try {
        // Créer le stream avec yt-dlp
        const ytdlpPath = process.env.LOCALAPPDATA + '\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe';
        
        const ytdlpProcess = spawn(ytdlpPath, [
            '-f', 'bestaudio',
            '--no-playlist',
            '-o', '-',
            nextSong.url
        ]);

        ytdlpProcess.on('error', (error) => {
            console.error('Erreur yt-dlp:', error);
            playNext(guildId, voiceChannel, textChannel);
        });

        ytdlpProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('ERROR')) {
                console.log('yt-dlp:', msg.trim());
            }
        });

        const stream = ytdlpProcess.stdout;
        
        // Rejoindre le canal vocal
        const { joinVoiceChannel } = require('@discordjs/voice');
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        // Créer ou récupérer le player
        let player = players.get(guildId);
        if (!player) {
            const { createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
            player = createAudioPlayer();
            players.set(guildId, player);
            
            player.on(AudioPlayerStatus.Idle, () => {
                console.log('Chanson terminée, prochaine...');
                playNext(guildId, voiceChannel, textChannel);
            });

            player.on('error', error => {
                console.error('Erreur du player:', error);
                playNext(guildId, voiceChannel, textChannel);
            });
        }

        // Créer la ressource audio
        const { createAudioResource, StreamType } = require('@discordjs/voice');
        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });

        connection.subscribe(player);
        player.play(resource);

        // Envoyer un message dans le canal texte
        if (textChannel && textChannel.permissionsFor && textChannel.permissionsFor(textChannel.client.user)?.has(['ViewChannel', 'SendMessages'])) {
            textChannel.send(`▶️ Lecture en cours : **${nextSong.title}** - \`${nextSong.duration}\``).catch(console.error);
        }
        
    } catch (error) {
        console.error('Erreur lors de la lecture:', error);
        playNext(guildId, voiceChannel, textChannel);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Joue une musique depuis YouTube ou Spotify')
        .addStringOption(option =>
            option.setName('recherche')
                .setDescription('Lien YouTube, Spotify ou terme de recherche')
                .setRequired(true)),

    async execute(interaction) {
        // Defer IMMÉDIATEMENT
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('Impossible de defer la réponse:', error);
            return;
        }

        try {
            // Vérifier si l'utilisateur est dans un salon vocal
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.editReply('❌ Tu dois être dans un salon vocal !');
            }

            const query = interaction.options.getString('recherche');
            
            await interaction.editReply('🔍 Recherche en cours...');

            console.log('Query reçue:', query);

            // Vérifier le type de lien/recherche
            let videoUrl;
            const ytValidate = play.yt_validate(query);
            
            console.log('Validation YouTube:', ytValidate);
            
            if (ytValidate === 'video') {
                videoUrl = query;
            } else if (ytValidate === 'playlist') {
                return await interaction.editReply('❌ Les playlists ne sont pas encore supportées.');
            } else {
                // Recherche YouTube avec play-dl
                const searchResults = await play.search(query, { limit: 1 });
                console.log('Résultats de recherche:', searchResults.length);
                if (!searchResults || searchResults.length === 0) {
                    return await interaction.editReply('❌ Aucun résultat trouvé.');
                }
                videoUrl = searchResults[0].url;
            }

            console.log('URL vidéo finale:', videoUrl);

            // Obtenir les informations avec play-dl pour le titre
            let video;
            try {
                const videoInfo = await play.video_info(videoUrl);
                video = videoInfo.video_details;
                console.log('Video info récupérée:', video.title);
            } catch (error) {
                console.error('Erreur lors de la récupération des infos:', error);
                video = { title: 'Vidéo YouTube', durationInSec: 0, url: videoUrl };
            }

            // Formater la durée
            const duration = video.durationInSec || 0;
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const formattedDuration = duration > 0 ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : 'En direct';

            // Créer l'objet chanson
            const song = {
                title: video.title,
                url: videoUrl,
                duration: formattedDuration,
                requester: interaction.user.tag
            };

            // Initialiser la queue si elle n'existe pas
            if (!queues.has(interaction.guildId)) {
                queues.set(interaction.guildId, []);
            }

            const queue = queues.get(interaction.guildId);
            const isPlaying = players.has(interaction.guildId);

            // Ajouter la chanson à la queue
            queue.push(song);

            if (isPlaying) {
                // Si une musique est déjà en cours, juste ajouter à la queue
                await interaction.editReply(`✅ Ajouté à la file : **${song.title}** - \`${song.duration}\` (Position: ${queue.length})`);
            } else {
                // Si rien n'est en cours, démarrer la lecture
                await interaction.editReply(`🎵 Démarrage de la lecture...`);
                playNext(interaction.guildId, voiceChannel, interaction.channel);
            }
            
        } catch (error) {
            console.error('Erreur lors de la lecture:', error);
            
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ Une erreur est survenue lors de la lecture !').catch(console.error);
            }
        }
    },
    
    // Exporter les fonctions pour accéder au player et à la queue
    getPlayer,
    getQueue,
    playNext
};

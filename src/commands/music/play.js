const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const { spawn } = require('child_process');
const SpotifyWebApi = require('spotify-web-api-node');

// Initialiser l'API Spotify
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

// Map pour stocker les players par guild
const players = new Map();

// Map pour stocker les files d'attente par guild
const queues = new Map();

// Variable pour stocker le token Spotify
let spotifyAccessToken = null;
let spotifyTokenExpiry = null;

// Fonction pour obtenir un token Spotify valide
async function getSpotifyToken() {
    try {
        if (!spotifyAccessToken || !spotifyTokenExpiry || Date.now() >= spotifyTokenExpiry) {
            console.log('Rafraîchissement du token Spotify...');
            const data = await spotifyApi.refreshAccessToken();
            spotifyAccessToken = data.body['access_token'];
            spotifyTokenExpiry = Date.now() + (data.body['expires_in'] * 1000);
            spotifyApi.setAccessToken(spotifyAccessToken);
            console.log('Token Spotify obtenu avec succès');
        }
        return spotifyAccessToken;
    } catch (error) {
        console.error('Erreur lors de l\'obtention du token Spotify:', error);
        throw error;
    }
}

// Fonction pour extraire l'ID et le type d'un lien Spotify
function extractSpotifyInfo(url) {
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) {
        return { type: 'track', id: trackMatch[1] };
    }
    
    const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) {
        return { type: 'playlist', id: playlistMatch[1] };
    }
    
    const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
    if (albumMatch) {
        return { type: 'album', id: albumMatch[1] };
    }
    
    return null;
}

// Fonction pour récupérer les infos d'une track Spotify
async function getSpotifyTrackInfo(trackId) {
    try {
        await getSpotifyToken();
        const data = await spotifyApi.getTrack(trackId);
        const track = data.body;
        
        return {
            title: `${track.artists.map(a => a.name).join(', ')} - ${track.name}`,
            artist: track.artists.map(a => a.name).join(', '),
            name: track.name,
            duration: Math.floor(track.duration_ms / 1000)
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des infos Spotify:', error);
        throw error;
    }
}

// Fonction pour récupérer les tracks d'une playlist Spotify
async function getSpotifyPlaylistTracks(playlistId) {
    try {
        await getSpotifyToken();
        console.log('Tentative de récupération de la playlist:', playlistId);
        
        const tracks = [];
        let offset = 0;
        let total = 0;
        
        do {
            const data = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit: 100 });
            total = data.body.total;
            
            console.log(`Récupération de ${data.body.items.length} tracks (offset: ${offset}/${total})`);
            
            for (const item of data.body.items) {
                if (item.track && !item.track.is_local) {
                    tracks.push({
                        title: `${item.track.artists.map(a => a.name).join(', ')} - ${item.track.name}`,
                        artist: item.track.artists.map(a => a.name).join(', '),
                        name: item.track.name,
                        duration: Math.floor(item.track.duration_ms / 1000)
                    });
                }
            }
            
            offset += 100;
        } while (offset < total);
        
        console.log(`Total de tracks récupérées: ${tracks.length}`);
        return tracks;
    } catch (error) {
        console.error('Erreur lors de la récupération de la playlist Spotify:', error);
        
        // Messages d'erreur plus explicites
        if (error.statusCode === 404) {
            throw new Error('Playlist introuvable. Assurez-vous que la playlist est publique.');
        } else if (error.statusCode === 401) {
            throw new Error('Erreur d\'authentification Spotify. Vérifiez vos credentials.');
        } else if (error.statusCode === 403) {
            throw new Error('Accès refusé. La playlist est peut-être privée.');
        }
        
        throw error;
    }
}

// Fonction pour récupérer les tracks d'un album Spotify
async function getSpotifyAlbumTracks(albumId) {
    try {
        await getSpotifyToken();
        const data = await spotifyApi.getAlbum(albumId);
        const album = data.body;
        
        return album.tracks.items.map(track => ({
            title: `${track.artists.map(a => a.name).join(', ')} - ${track.name}`,
            artist: track.artists.map(a => a.name).join(', '),
            name: track.name,
            duration: Math.floor(track.duration_ms / 1000)
        }));
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'album Spotify:', error);
        throw error;
    }
}

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

            // Vérifier si c'est un lien Spotify
            let videoUrl;
            let songTitle;
            let songDuration;
            let spotifyTracks = [];
            
            if (query.includes('spotify.com')) {
                console.log('Détection d\'un lien Spotify');
                const spotifyInfo = extractSpotifyInfo(query);
                
                if (!spotifyInfo) {
                    return await interaction.editReply('❌ Lien Spotify invalide.');
                }
                
                try {
                    if (spotifyInfo.type === 'track') {
                        // Track individuelle
                        const spotifyTrack = await getSpotifyTrackInfo(spotifyInfo.id);
                        console.log('Info Spotify récupérée:', spotifyTrack.title);
                        spotifyTracks.push(spotifyTrack);
                    } else if (spotifyInfo.type === 'playlist') {
                        // Playlist
                        await interaction.editReply('📋 Récupération de la playlist Spotify...');
                        spotifyTracks = await getSpotifyPlaylistTracks(spotifyInfo.id);
                        console.log(`Playlist Spotify récupérée: ${spotifyTracks.length} chansons`);
                        
                        if (spotifyTracks.length === 0) {
                            return await interaction.editReply('❌ La playlist est vide ou ne contient que des tracks locales.');
                        }
                        
                        await interaction.editReply(`📋 Ajout de ${spotifyTracks.length} chansons à la file d'attente...`);
                    } else if (spotifyInfo.type === 'album') {
                        // Album
                        await interaction.editReply('💿 Récupération de l\'album Spotify...');
                        spotifyTracks = await getSpotifyAlbumTracks(spotifyInfo.id);
                        console.log(`Album Spotify récupéré: ${spotifyTracks.length} chansons`);
                        
                        if (spotifyTracks.length === 0) {
                            return await interaction.editReply('❌ L\'album est vide.');
                        }
                        
                        await interaction.editReply(`💿 Ajout de ${spotifyTracks.length} chansons à la file d'attente...`);
                    }
                    
                    // Traiter chaque track Spotify
                    const queue = queues.get(interaction.guildId) || [];
                    const isPlaying = players.has(interaction.guildId);
                    let addedCount = 0;
                    
                    for (const spotifyTrack of spotifyTracks) {
                        try {
                            // Rechercher l'équivalent sur YouTube
                            const searchQuery = spotifyTrack.title;
                            const searchResults = await play.search(searchQuery, { limit: 1 });
                            
                            if (searchResults && searchResults.length > 0) {
                                const minutes = Math.floor(spotifyTrack.duration / 60);
                                const seconds = spotifyTrack.duration % 60;
                                const duration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                                
                                const song = {
                                    title: spotifyTrack.title,
                                    url: searchResults[0].url,
                                    duration: duration,
                                    requester: interaction.user.tag
                                };
                                
                                queue.push(song);
                                addedCount++;
                                console.log(`Ajouté: ${spotifyTrack.title}`);
                            } else {
                                console.log(`Introuvable sur YouTube: ${spotifyTrack.title}`);
                            }
                        } catch (error) {
                            console.error(`Erreur pour ${spotifyTrack.title}:`, error);
                        }
                    }
                    
                    // Initialiser la queue si nécessaire
                    if (!queues.has(interaction.guildId)) {
                        queues.set(interaction.guildId, queue);
                    }
                    
                    if (addedCount === 0) {
                        return await interaction.editReply('❌ Aucune chanson n\'a pu être trouvée sur YouTube.');
                    }
                    
                    if (isPlaying) {
                        await interaction.editReply(`✅ ${addedCount} chanson${addedCount > 1 ? 's' : ''} ajoutée${addedCount > 1 ? 's' : ''} à la file d'attente !`);
                    } else {
                        await interaction.editReply(`🎵 Démarrage de la lecture de ${addedCount} chanson${addedCount > 1 ? 's' : ''}...`);
                        playNext(interaction.guildId, voiceChannel, interaction.channel);
                    }
                    
                    return;
                    
                } catch (error) {
                    console.error('Erreur Spotify:', error);
                    
                    // Message d'erreur plus explicite
                    let errorMessage = '❌ Erreur lors de la récupération des informations Spotify.';
                    if (error.message.includes('publique') || error.message.includes('privée') || error.message.includes('introuvable')) {
                        errorMessage = `❌ ${error.message}`;
                    }
                    
                    return await interaction.editReply(errorMessage);
                }
            } else {
                // Vérifier le type de lien/recherche YouTube
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
            }

            console.log('URL vidéo finale:', videoUrl);

            // Obtenir les informations avec play-dl pour le titre (si pas déjà récupéré depuis Spotify)
            if (!songTitle) {
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
                songDuration = duration > 0 ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : 'En direct';
                songTitle = video.title;
            }

            // Créer l'objet chanson
            const song = {
                title: songTitle,
                url: videoUrl,
                duration: songDuration,
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

const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const { spawn } = require('child_process');
const SpotifyWebApi = require('spotify-web-api-node');
const { COLORS, EMOJIS, createEmbed } = require('../../utils/embedStyles');

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

const players = new Map();
const queues = new Map();
const connections = new Map();
const currentSongs = new Map();
const searchCache = new Map();
const preloadingProcesses = new Map();

let spotifyAccessToken = null;
let spotifyTokenExpiry = null;

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

async function getSpotifyPlaylistTracks(playlistId) {
    try {
        await getSpotifyToken();
        
        const tracks = [];
        let offset = 0;
        let total = 0;
        
        do {
            const data = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit: 100 });
            total = data.body.total;
            
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
        
        return tracks;
    } catch (error) {
        console.error('Erreur lors de la récupération de la playlist Spotify:', error);
        
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

function getPlayer(guildId) {
    return players.get(guildId);
}

function getQueue(guildId) {
    return queues.get(guildId);
}

function getCurrentSong(guildId) {
    return currentSongs.get(guildId);
}

async function searchYouTube(query) {
    if (searchCache.has(query)) {
        return searchCache.get(query);
    }
    
    const searchResults = await play.search(query, { limit: 1 });
    
    if (searchResults && searchResults.length > 0) {
        const result = searchResults[0].url;
        if (searchCache.size > 100) {
            const firstKey = searchCache.keys().next().value;
            searchCache.delete(firstKey);
        }
        searchCache.set(query, result);
        return result;
    }
    
    return null;
}

async function preloadNextSong(guildId) {
    const queue = queues.get(guildId);
    
    if (!queue || queue.length === 0) {
        return;
    }
    
    const nextSong = queue[0];
    
    if (preloadingProcesses.has(guildId)) {
        return;
    }
    
    console.log('Préchargement de:', nextSong.title);
    
    try {
        const ytdlpPath = process.env.LOCALAPPDATA + '\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe';
        
        const ytdlpProcess = spawn(ytdlpPath, [
            '-f', 'bestaudio',
            '--no-playlist',
            '--quiet',
            '--simulate',
            nextSong.url
        ]);
        
        preloadingProcesses.set(guildId, ytdlpProcess);
        
        ytdlpProcess.on('close', () => {
            preloadingProcesses.delete(guildId);
            console.log('Préchargement terminé pour:', nextSong.title);
        });
        
    } catch (error) {
        console.error('Erreur de préchargement:', error);
        preloadingProcesses.delete(guildId);
    }
}

async function playNext(guildId, voiceChannel, textChannel) {
    const queue = queues.get(guildId);
    
    if (!queue || queue.length === 0) {
        currentSongs.delete(guildId);
        setTimeout(() => {
            const currentQueue = queues.get(guildId);
            if (!currentQueue || currentQueue.length === 0) {
                const { getVoiceConnection } = require('@discordjs/voice');
                const connection = getVoiceConnection(guildId);
                if (connection) {
                    connection.destroy();
                    players.delete(guildId);
                    queues.delete(guildId);
                    connections.delete(guildId);
                }
            }
        }, 60000);
        return;
    }
    
    const nextSong = queue.shift();
    currentSongs.set(guildId, nextSong);
    
    try {
        if (preloadingProcesses.has(guildId)) {
            preloadingProcesses.get(guildId).kill();
            preloadingProcesses.delete(guildId);
        }
        
        const ytdlpPath = process.env.LOCALAPPDATA + '\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe';
        
        const ytdlpProcess = spawn(ytdlpPath, [
            '-f', 'bestaudio',
            '--no-playlist',
            '--buffer-size', '16K',
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
        
        let connection = connections.get(guildId);
        if (!connection) {
            const { joinVoiceChannel } = require('@discordjs/voice');
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            connections.set(guildId, connection);
        }

        let player = players.get(guildId);
        if (!player) {
            const { createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
            player = createAudioPlayer();
            players.set(guildId, player);
            
            player.on(AudioPlayerStatus.Idle, () => {
                playNext(guildId, voiceChannel, textChannel);
            });
            
            player.on(AudioPlayerStatus.Playing, () => {
                setTimeout(() => preloadNextSong(guildId), 5000);
            });

            player.on('error', error => {
                console.error('Erreur du player:', error);
                playNext(guildId, voiceChannel, textChannel);
            });
        }

        const { createAudioResource, StreamType } = require('@discordjs/voice');
        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: false
        });

        connection.subscribe(player);
        player.play(resource);

        if (textChannel && textChannel.permissionsFor && textChannel.permissionsFor(textChannel.client.user)?.has(['ViewChannel', 'SendMessages'])) {
            const embed = createEmbed(
                `${EMOJIS.nowPlaying} Lecture en cours`,
                `**${nextSong.title}**\n\n${EMOJIS.music} Durée: \`${nextSong.duration}\`\n${EMOJIS.headphones} Demandé par: ${nextSong.requester}`,
                COLORS.playing
            );
            textChannel.send({ embeds: [embed] }).catch(console.error);
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
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('Impossible de defer la réponse:', error);
            return;
        }

        try {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return await interaction.editReply('❌ Tu dois être dans un salon vocal !');
            }

            const query = interaction.options.getString('recherche');
            
            await interaction.editReply('🔍 Recherche en cours...');

            let videoUrl;
            let songTitle;
            let songDuration;
            let spotifyTracks = [];
            
            if (query.includes('spotify.com')) {
                const spotifyInfo = extractSpotifyInfo(query);
                
                if (!spotifyInfo) {
                    return await interaction.editReply('❌ Lien Spotify invalide.');
                }
                
                try {
                    if (spotifyInfo.type === 'track') {
                        const spotifyTrack = await getSpotifyTrackInfo(spotifyInfo.id);
                        spotifyTracks.push(spotifyTrack);
                    } else if (spotifyInfo.type === 'playlist') {
                        await interaction.editReply('📋 Récupération de la playlist Spotify...');
                        spotifyTracks = await getSpotifyPlaylistTracks(spotifyInfo.id);
                        
                        if (spotifyTracks.length === 0) {
                            return await interaction.editReply('❌ La playlist est vide ou ne contient que des tracks locales.');
                        }
                        
                        await interaction.editReply(`📋 Ajout de ${spotifyTracks.length} chansons à la file d'attente...`);
                    } else if (spotifyInfo.type === 'album') {
                        await interaction.editReply('💿 Récupération de l\'album Spotify...');
                        spotifyTracks = await getSpotifyAlbumTracks(spotifyInfo.id);
                        
                        if (spotifyTracks.length === 0) {
                            return await interaction.editReply('❌ L\'album est vide.');
                        }
                        
                        await interaction.editReply(`💿 Ajout de ${spotifyTracks.length} chansons à la file d'attente...`);
                    }
                    
                    const queue = queues.get(interaction.guildId) || [];
                    const isPlaying = players.has(interaction.guildId);
                    let addedCount = 0;
                    
                    for (const spotifyTrack of spotifyTracks) {
                        try {
                            const searchQuery = spotifyTrack.title;
                            const videoUrl = await searchYouTube(searchQuery);
                            
                            if (videoUrl) {
                                const minutes = Math.floor(spotifyTrack.duration / 60);
                                const seconds = spotifyTrack.duration % 60;
                                const duration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                                
                                const song = {
                                    title: spotifyTrack.title,
                                    url: videoUrl,
                                    duration: duration,
                                    requester: interaction.user.tag
                                };
                                
                                queue.push(song);
                                addedCount++;
                            }
                        } catch (error) {
                            console.error(`Erreur pour ${spotifyTrack.title}:`, error);
                        }
                    }
                    
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
                    
                    let errorMessage = '❌ Erreur lors de la récupération des informations Spotify.';
                    if (error.message.includes('publique') || error.message.includes('privée') || error.message.includes('introuvable')) {
                        errorMessage = `❌ ${error.message}`;
                    }
                    
                    return await interaction.editReply(errorMessage);
                }
            } else {
                const ytValidate = play.yt_validate(query);
                
                if (ytValidate === 'video') {
                    videoUrl = query;
                } else if (ytValidate === 'playlist') {
                    return await interaction.editReply('❌ Les playlists YouTube ne sont pas encore supportées.');
                } else {
                    videoUrl = await searchYouTube(query);
                    if (!videoUrl) {
                        return await interaction.editReply('❌ Aucun résultat trouvé.');
                    }
                }
            }

            if (!songTitle) {
                let video;
                try {
                    const videoInfo = await play.video_info(videoUrl);
                    video = videoInfo.video_details;
                } catch (error) {
                    console.error('Erreur lors de la récupération des infos:', error);
                    video = { title: 'Vidéo YouTube', durationInSec: 0, url: videoUrl };
                }


                const duration = video.durationInSec || 0;
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                songDuration = duration > 0 ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : 'En direct';
                songTitle = video.title;
            }

            const song = {
                title: songTitle,
                url: videoUrl,
                duration: songDuration,
                requester: interaction.user.tag
            };

            if (!queues.has(interaction.guildId)) {
                queues.set(interaction.guildId, []);
            }

            const queue = queues.get(interaction.guildId);
            const isPlaying = players.has(interaction.guildId);

            queue.push(song);

            if (isPlaying) {
                const embed = createEmbed(
                    `${EMOJIS.play} Ajouté à la file`,
                    `**${song.title}**\n\n${EMOJIS.music} Durée: \`${song.duration}\`\n📍 Position: **${queue.length}**`,
                    COLORS.secondary
                );
                await interaction.editReply({ embeds: [embed] });
            } else {
                const embed = createEmbed(
                    `${EMOJIS.fire} Démarrage de la lecture`,
                    `Harmonia va jouer **${song.title}** ${EMOJIS.sparkles}`,
                    COLORS.playing
                );
                await interaction.editReply({ embeds: [embed] });
                playNext(interaction.guildId, voiceChannel, interaction.channel);
            }
            
        } catch (error) {
            console.error('Erreur lors de la lecture:', error);
            
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ Une erreur est survenue lors de la lecture !').catch(console.error);
            }
        }
    },
    
    getPlayer,
    getQueue,
    getCurrentSong,
    playNext
};

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const play = require('play-dl');
require('dotenv').config();

// Configure play-dl avant tout
play.setToken({
    youtube: {
        cookie: process.env.YOUTUBE_COOKIE
    }
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// Collection pour stocker les commandes
client.commands = new Collection();

// Charge les commandes
const commandsPath = path.join(__dirname, 'commands/music');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        try {
            const errorMessage = { 
                content: 'Une erreur est survenue !', 
                ephemeral: true 
            };

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(errorMessage);
            } else {
                await interaction.editReply(errorMessage);
            }
        } catch (err) {
            console.error('Erreur lors de la réponse à l\'interaction:', err);
        }
    }
});

client.once('ready', () => {
    console.log(`🎵 Harmonia est en ligne en tant que ${client.user.tag}`);
});

// Gestion des erreurs
process.on('unhandledRejection', error => {
    console.error('Erreur non gérée:', error);
});

client.login(process.env.TOKEN); 
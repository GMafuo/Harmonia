const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

client.commands = new Collection();

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
        console.error('Erreur lors de l\'exécution de la commande:', error);
        
        const errorMessage = '❌ Une erreur est survenue !';
        
        try {
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply(errorMessage);
            } else if (!interaction.replied) {
                await interaction.reply({ content: errorMessage, flags: [4096] });
            }
        } catch (e) {
            console.error('Impossible de répondre à l\'interaction:', e);
        }
    }
});

client.once('ready', () => {
    console.log(`🎵 Harmonia est en ligne en tant que ${client.user.tag}`);
});

process.on('unhandledRejection', error => {
    console.error('Erreur non gérée:', error);
});

client.login(process.env.TOKEN); 
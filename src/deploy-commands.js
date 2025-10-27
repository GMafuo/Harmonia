const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];

// Charger toutes les commandes depuis le dossier commands/music
const commandsPath = path.join(__dirname, 'commands', 'music');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Chargé: ${command.data.name}`);
    } else {
        console.log(`[ATTENTION] La commande ${filePath} n'a pas les propriétés "data" ou "execute" requises.`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log(`Début de l'enregistrement de ${commands.length} commandes...`);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Commandes enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }
})(); 
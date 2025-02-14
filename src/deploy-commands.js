const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'play',
        description: 'Joue une musique depuis YouTube',
        options: [{
            name: 'recherche',
            description: 'Lien YouTube ou terme de recherche',
            type: 3, // 3 = STRING
            required: true
        }]
    },
    {
        name: 'pause',
        description: 'Met en pause la musique en cours'
    },
    {
        name: 'resume',
        description: 'Reprend la lecture de la musique'
    },
    {
        name: 'skip',
        description: 'Passe à la musique suivante'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Début de l\'enregistrement des commandes...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Commandes enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }
})(); 
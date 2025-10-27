#!/bin/bash
# Script pour installer yt-dlp sur Render (Linux)

echo "Installation de yt-dlp..."

# Créer un répertoire local pour yt-dlp
mkdir -p $HOME/.local/bin

# Télécharger yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o $HOME/.local/bin/yt-dlp

# Rendre exécutable
chmod a+rx $HOME/.local/bin/yt-dlp

# Ajouter au PATH
export PATH="$HOME/.local/bin:$PATH"

echo "yt-dlp installé avec succès dans $HOME/.local/bin/yt-dlp"
echo "Vérification de l'installation..."
$HOME/.local/bin/yt-dlp --version || echo "Erreur lors de la vérification"

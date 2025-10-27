#!/bin/bash
# Script de démarrage pour Railway

echo "🚀 Démarrage de Harmonia..."

# Vérifier et installer yt-dlp si nécessaire
if ! command -v yt-dlp &> /dev/null; then
    echo "⚠️ yt-dlp non trouvé, installation..."
    
    if command -v python3 &> /dev/null; then
        echo "📦 Installation via pip..."
        python3 -m pip install --user -U yt-dlp
        export PATH="$HOME/.local/bin:$PATH"
        
        if command -v yt-dlp &> /dev/null || [ -f "$HOME/.local/bin/yt-dlp" ]; then
            echo "✅ yt-dlp installé avec succès"
        fi
    else
        echo "❌ Python non disponible, téléchargement direct..."
        mkdir -p $HOME/.local/bin
        curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o $HOME/.local/bin/yt-dlp
        chmod a+rx $HOME/.local/bin/yt-dlp
        export PATH="$HOME/.local/bin:$PATH"
    fi
else
    echo "✅ yt-dlp déjà installé"
fi

# Ajouter $HOME/.local/bin au PATH
export PATH="$HOME/.local/bin:$PATH"

# Afficher le chemin de yt-dlp
if command -v yt-dlp &> /dev/null; then
    echo "📂 yt-dlp trouvé: $(which yt-dlp)"
    yt-dlp --version
elif [ -f "$HOME/.local/bin/yt-dlp" ]; then
    echo "📂 yt-dlp trouvé dans: $HOME/.local/bin/yt-dlp"
    $HOME/.local/bin/yt-dlp --version
fi

# Démarrer le bot
echo "🎵 Lancement du bot Discord..."
node src/index.js

#!/bin/bash
# Script pour installer les dépendances système sur Railway

echo "🔧 Installation des dépendances système..."

# Installer yt-dlp via pip si Python est disponible
if command -v python3 &> /dev/null; then
    echo "📦 Installation de yt-dlp via pip..."
    python3 -m pip install --user -U yt-dlp
    
    if command -v yt-dlp &> /dev/null; then
        echo "✅ yt-dlp installé avec succès"
        yt-dlp --version
    else
        echo "⚠️ yt-dlp installé mais pas dans le PATH, vérification..."
        if [ -f "$HOME/.local/bin/yt-dlp" ]; then
            echo "✅ yt-dlp trouvé dans $HOME/.local/bin/"
            export PATH="$HOME/.local/bin:$PATH"
        fi
    fi
else
    echo "❌ Python non trouvé, impossible d'installer yt-dlp via pip"
fi

echo "✅ Installation terminée"

#!/bin/bash
# Script pour installer yt-dlp sur Railway/Render (Linux)

echo "🔧 Installation de yt-dlp..."

# Vérifier si Python est disponible pour installer via pip
if command -v python3 &> /dev/null; then
    echo "Python détecté, installation via pip..."
    python3 -m pip install --user -U yt-dlp
    
    # Vérifier l'installation
    if command -v yt-dlp &> /dev/null; then
        echo "✅ yt-dlp installé avec succès via pip"
        yt-dlp --version
        exit 0
    fi
fi

# Fallback: téléchargement direct
echo "Installation manuelle de yt-dlp..."

# Créer un répertoire local pour yt-dlp
mkdir -p $HOME/.local/bin

# Télécharger yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o $HOME/.local/bin/yt-dlp

# Rendre exécutable
chmod a+rx $HOME/.local/bin/yt-dlp

# Vérification
if [ -f "$HOME/.local/bin/yt-dlp" ]; then
    echo "✅ yt-dlp installé avec succès dans $HOME/.local/bin/yt-dlp"
    $HOME/.local/bin/yt-dlp --version || echo "⚠️ Erreur lors de la vérification"
else
    echo "❌ Erreur: yt-dlp non installé"
    exit 1
fi

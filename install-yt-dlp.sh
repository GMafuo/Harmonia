#!/bin/bash
# Script pour installer yt-dlp sur Render (Linux)

echo "Installation de yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
echo "yt-dlp installé avec succès !"

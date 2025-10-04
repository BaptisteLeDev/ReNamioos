"""
Module keep_alive pour maintenir le bot en ligne
Utilisé principalement pour l'hébergement gratuit (Replit, etc.)
"""
from flask import Flask
from threading import Thread
import logging

# Désactiver les logs Flask pour un affichage plus propre
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

@app.route('/')
def home():
    return """
    <html>
        <head><title>ReNamio Bot</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🤖 ReNamio est en ligne !</h1>
            <p>Bot Discord de renommage avec polices stylisées</p>
            <p style="color: green;">✅ Statut : Actif</p>
        </body>
    </html>
    """

@app.route('/health')
def health():
    return {"status": "online", "bot": "ReNamio"}, 200

def run():
    """Lance le serveur Flask"""
    app.run(host='0.0.0.0', port=8080, debug=False)

def keep_alive():
    """Lance le serveur dans un thread séparé"""
    print("🌐 Serveur keep-alive démarré sur le port 8080")
    t = Thread(target=run, daemon=True)
    t.start()

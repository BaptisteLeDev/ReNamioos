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
    # Récupérer les stats du bot si disponible
    try:
        from __main__ import bot
        server_count = len(bot.guilds)
        bot_name = str(bot.user)
    except:
        server_count = "..."
        bot_name = "ReNamioos"
    
    return f"""
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ReNamioos Bot - Status</title>
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #0a0e27 0%, #1a1d3a 100%);
                    color: #e0e0e0;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }}
                
                .container {{
                    text-align: center;
                    padding: 40px;
                    background: rgba(15, 20, 40, 0.8);
                    border-radius: 20px;
                    border: 2px solid;
                    border-image: linear-gradient(
                        45deg,
                        #667eea 0%,
                        #764ba2 25%,
                        #f093fb 50%,
                        #4facfe 75%,
                        #00f2fe 100%
                    ) 1;
                    box-shadow: 
                        0 0 30px rgba(102, 126, 234, 0.3),
                        0 0 60px rgba(118, 75, 162, 0.2),
                        inset 0 0 30px rgba(0, 242, 254, 0.1);
                    backdrop-filter: blur(10px);
                    max-width: 600px;
                    animation: float 6s ease-in-out infinite;
                }}
                
                @keyframes float {{
                    0%, 100% {{ transform: translateY(0px); }}
                    50% {{ transform: translateY(-10px); }}
                }}
                
                h1 {{
                    font-size: 2.5em;
                    margin-bottom: 20px;
                    background: linear-gradient(45deg, #667eea, #764ba2, #f093fb);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-shadow: 0 0 30px rgba(102, 126, 234, 0.5);
                    animation: glow 2s ease-in-out infinite alternate;
                }}
                
                @keyframes glow {{
                    from {{
                        filter: drop-shadow(0 0 5px #667eea) drop-shadow(0 0 10px #764ba2);
                    }}
                    to {{
                        filter: drop-shadow(0 0 10px #764ba2) drop-shadow(0 0 20px #f093fb);
                    }}
                }}
                
                .status {{
                    display: inline-block;
                    padding: 15px 30px;
                    margin: 20px 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50px;
                    font-size: 1.2em;
                    font-weight: bold;
                    color: white;
                    box-shadow: 
                        0 0 20px rgba(102, 126, 234, 0.6),
                        0 0 40px rgba(118, 75, 162, 0.4);
                    animation: pulse 2s ease-in-out infinite;
                }}
                
                @keyframes pulse {{
                    0%, 100% {{ transform: scale(1); }}
                    50% {{ transform: scale(1.05); }}
                }}
                
                .info {{
                    margin: 30px 0;
                    padding: 20px;
                    background: rgba(102, 126, 234, 0.1);
                    border-radius: 15px;
                    border: 1px solid rgba(102, 126, 234, 0.3);
                }}
                
                .info-item {{
                    margin: 15px 0;
                    font-size: 1.1em;
                }}
                
                .label {{
                    color: #a0a0a0;
                    font-weight: 500;
                }}
                
                .value {{
                    color: #4facfe;
                    font-weight: bold;
                    text-shadow: 0 0 10px rgba(79, 172, 254, 0.5);
                }}
                
                .description {{
                    margin-top: 20px;
                    padding: 15px;
                    background: linear-gradient(135deg, 
                        rgba(255, 235, 59, 0.1) 0%, 
                        rgba(129, 212, 250, 0.1) 100%);
                    border-radius: 10px;
                    border-left: 4px solid;
                    border-image: linear-gradient(180deg, #ffeb3b, #81d4fa) 1;
                }}
                
                .particles {{
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: -1;
                }}
                
                .particle {{
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    background: radial-gradient(circle, #667eea, transparent);
                    border-radius: 50%;
                    animation: particle-float linear infinite;
                    opacity: 0.6;
                }}
                
                @keyframes particle-float {{
                    0% {{
                        transform: translateY(100vh) translateX(0);
                        opacity: 0;
                    }}
                    10% {{
                        opacity: 0.6;
                    }}
                    90% {{
                        opacity: 0.6;
                    }}
                    100% {{
                        transform: translateY(-100px) translateX(100px);
                        opacity: 0;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="particles">
                <div class="particle" style="left: 10%; animation-duration: 8s; animation-delay: 0s;"></div>
                <div class="particle" style="left: 20%; animation-duration: 12s; animation-delay: 2s;"></div>
                <div class="particle" style="left: 30%; animation-duration: 10s; animation-delay: 4s;"></div>
                <div class="particle" style="left: 40%; animation-duration: 14s; animation-delay: 1s;"></div>
                <div class="particle" style="left: 50%; animation-duration: 9s; animation-delay: 3s;"></div>
                <div class="particle" style="left: 60%; animation-duration: 11s; animation-delay: 5s;"></div>
                <div class="particle" style="left: 70%; animation-duration: 13s; animation-delay: 2s;"></div>
                <div class="particle" style="left: 80%; animation-duration: 10s; animation-delay: 4s;"></div>
                <div class="particle" style="left: 90%; animation-duration: 12s; animation-delay: 1s;"></div>
            </div>
            
            <div class="container">
                <h1>🤖 ReNamioos</h1>
                <div class="status">✅ En ligne</div>
                
                <div class="info">
                    <div class="info-item">
                        <span class="label">Bot:</span>
                        <span class="value">{bot_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Serveurs:</span>
                        <span class="value">{server_count}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Uptime:</span>
                        <span class="value">24/7</span>
                    </div>
                </div>
                
                <div class="description">
                    <p>🎨 Bot Discord de renommage avec polices stylisées</p>
                    <p style="margin-top: 10px; font-size: 0.9em; color: #a0a0a0;">
                        Transforme automatiquement les pseudos en 8 styles Unicode différents
                    </p>
                </div>
            </div>
            
            <script>
                // Mise à jour automatique du nombre de serveurs toutes les 30 secondes
                setInterval(() => {{
                    fetch('/health')
                        .then(response => response.json())
                        .then(data => {{
                            if (data.servers !== undefined) {{
                                document.querySelector('.info-item:nth-child(2) .value').textContent = data.servers;
                            }}
                        }})
                        .catch(err => console.log('Refresh stats error:', err));
                }}, 30000);
            </script>
        </body>
    </html>
    """

@app.route('/health')
def health():
    # Récupérer les stats du bot en temps réel
    try:
        from __main__ import bot
        return {
            "status": "online",
            "bot": str(bot.user),
            "servers": len(bot.guilds)
        }, 200
    except:
        return {
            "status": "online",
            "bot": "ReNamioos",
            "servers": 0
        }, 200

@app.route('/status')
def status():
    from datetime import datetime
    try:
        from __main__ import bot
        return {
            "message": "Bot en ligne",
            "bot": str(bot.user),
            "servers": len(bot.guilds),
            "timestamp": datetime.now().isoformat()
        }, 200
    except:
        return {
            "message": "Bot en ligne",
            "timestamp": datetime.now().isoformat()
        }, 200

def run():
    """Lance le serveur Flask"""
    # Utilise le port fourni par Render (variable d'environnement PORT)
    # Ou 8080 par défaut pour local
    import os
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)

def keep_alive():
    """Lance le serveur dans un thread séparé"""
    import os
    port = int(os.environ.get('PORT', 8080))
    print(f"🌐 Serveur keep-alive démarré sur le port {port}")
    t = Thread(target=run, daemon=True)
    t.start()

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
    <!DOCTYPE html>
    <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ReNamioos Bot - Status</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
            <style>
                :root {{
                    --bg-primary: #0a0a0a;
                    --bg-secondary: #1a1a1a;
                    --bg-card: #1e1e1e;
                    
                    --text-primary: #ffffff;
                    --text-secondary: #b3b3b3;
                    --text-muted: #666666;
                    
                    --accent-yellow: #fbbf24;
                    --accent-purple: #8b5cf6;
                    --accent-blue: #646cff;
                    
                    --green-primary: #10b981;
                    
                    --border-purple: rgba(139, 92, 246, 0.3);
                    --border-subtle: rgba(255, 255, 255, 0.1);
                    
                    --radius-sm: 0.5rem;
                    --radius-md: 1rem;
                    --radius-lg: 1.5rem;
                    
                    --spacing-md: 1rem;
                    --spacing-lg: 1.5rem;
                    --spacing-xl: 2rem;
                    
                    --font-primary: 'Share Tech Mono', monospace;
                    
                    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
                    --shadow-lg: 0 8px 32px rgba(139, 92, 246, 0.1);
                    
                    --transition-base: 0.3s ease;
                }}
                
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: var(--font-primary);
                    line-height: 1.5;
                    color: var(--text-primary);
                    background: radial-gradient(
                        ellipse 70% 55% at 50% 50%,
                        rgba(255, 20, 147, 0.15),
                        transparent 50%
                    ),
                    radial-gradient(
                        ellipse 160% 130% at 10% 10%,
                        rgba(0, 255, 255, 0.12),
                        transparent 60%
                    ),
                    radial-gradient(
                        ellipse 160% 130% at 90% 90%,
                        rgba(138, 43, 226, 0.18),
                        transparent 65%
                    ),
                    radial-gradient(
                        ellipse 110% 50% at 80% 30%,
                        rgba(255, 215, 0, 0.08),
                        transparent 40%
                    ),
                    #000000;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: var(--spacing-md);
                }}
                
                .container {{
                    text-align: center;
                    padding: var(--spacing-xl);
                    background: var(--bg-card);
                    border-radius: var(--radius-lg);
                    border: 2px solid var(--border-purple);
                    box-shadow: var(--shadow-lg);
                    backdrop-filter: blur(10px);
                    max-width: 600px;
                    width: 100%;
                }}
                
                h1 {{
                    font-size: 2.5rem;
                    margin-bottom: var(--spacing-lg);
                    color: var(--text-primary);
                    font-weight: 600;
                }}
                
                .status {{
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    margin: var(--spacing-lg) 0;
                    background: var(--bg-secondary);
                    border: 2px solid var(--green-primary);
                    border-radius: 2rem;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }}
                
                .status-indicator {{
                    width: 12px;
                    height: 12px;
                    background: var(--green-primary);
                    border-radius: 50%;
                    animation: pulse 2s ease-in-out infinite;
                }}
                
                @keyframes pulse {{
                    0%, 100% {{ opacity: 1; }}
                    50% {{ opacity: 0.5; }}
                }}
                
                .info {{
                    margin: var(--spacing-xl) 0;
                    padding: var(--spacing-lg);
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border-subtle);
                }}
                
                .info-item {{
                    margin: var(--spacing-md) 0;
                    font-size: 1.1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }}
                
                .label {{
                    color: var(--text-secondary);
                    font-weight: 500;
                }}
                
                .value {{
                    color: var(--accent-purple);
                    font-weight: 700;
                }}
                
                .description {{
                    margin-top: var(--spacing-lg);
                    padding: var(--spacing-md);
                    background: rgba(139, 92, 246, 0.05);
                    border-radius: var(--radius-sm);
                    border-left: 3px solid var(--accent-yellow);
                }}
                
                .description p {{
                    color: var(--text-secondary);
                    margin: 0.5rem 0;
                }}
                
                .description p:first-child {{
                    color: var(--text-primary);
                    font-weight: 600;
                }}
                
                @media (max-width: 768px) {{
                    h1 {{
                        font-size: 2rem;
                    }}
                    .container {{
                        padding: var(--spacing-lg);
                    }}
                    .info-item {{
                        font-size: 1rem;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 ReNamioos</h1>
                <div class="status">
                    <span class="status-indicator"></span>
                    En ligne
                </div>
                
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
                    <p>Transforme automatiquement les pseudos en 9 styles Unicode différents</p>
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

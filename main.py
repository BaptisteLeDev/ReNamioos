"""
ReNamio - Bot Discord de renommage avec polices stylisées
Point d'entrée principal avec support keep-alive
"""

# Import du keep-alive en premier (pour hébergement gratuit)
try:
    from keep_alive import keep_alive
    keep_alive()
    print("✅ Keep-alive activé")
except ImportError:
    print("⚠️ Keep-alive non disponible (Flask non installé)")
except Exception as e:
    print(f"⚠️ Erreur keep-alive : {e}")

# Imports du bot
import discord
from discord import app_commands
from discord.ext import commands
import os
from dotenv import load_dotenv
import random
import json

# ==================== CHARGEMENT CONFIGURATION ====================

load_dotenv()
TOKEN = os.getenv("TOKEN")  # Utilise TOKEN comme dans ton .env

# Charger les styles depuis styles.json
def charger_styles():
    try:
        with open("styles.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print("⚠️ Fichier styles.json introuvable")
        return {}
    except json.JSONDecodeError:
        print("⚠️ Erreur de lecture du fichier styles.json")
        return {}

# Charger la configuration des rôles
def charger_roles():
    try:
        with open("role.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print("⚠️ Fichier role.json introuvable")
        return {}
    except json.JSONDecodeError:
        print("⚠️ Erreur de lecture du fichier role.json")
        return {}

STYLES = charger_styles()
ROLE_CONFIG = charger_roles()

# ==================== CONFIGURATION BOT ====================

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

# ==================== FONCTIONS UTILITAIRES ====================

def convertir_texte(texte: str, style: str) -> str:
    """Convertit un texte avec le style choisi"""
    if style not in STYLES:
        return None
    
    style_dict = STYLES[style]
    resultat = ""
    
    for char in texte:
        resultat += style_dict.get(char, char)
    
    return resultat

# ==================== ÉVÉNEMENTS ====================

@bot.event
async def on_ready():
    print(f"✅ {bot.user} est connecté !")
    print(f"📊 Serveurs: {len(bot.guilds)}")
    print(f"🎨 Styles disponibles: {len(STYLES)}")
    print(f"🎭 Rôles avec auto-rename: {len(ROLE_CONFIG)}")
    
    try:
        synced = await bot.tree.sync()
        print(f"✅ {len(synced)} commande(s) slash synchronisée(s)")
    except Exception as e:
        print(f"❌ Erreur lors de la synchronisation : {e}")

@bot.event
async def on_member_update(before, after):
    """Auto-rename sur changement de rôle"""
    if before.roles == after.roles:
        return
    
    # Ajout de rôle
    if len(before.roles) < len(after.roles):
        new_role = next((role for role in after.roles if role not in before.roles), None)
        
        if new_role:
            print(f"📌 {after.name} a reçu le rôle : {new_role.name}")
            
            for style, role_names in ROLE_CONFIG.items():
                if new_role.name in role_names:
                    print(f"🎯 Rôle trouvé ! Application du style '{style}'")
                    
                    nom_actuel = after.name
                    nom_stylise = convertir_texte(nom_actuel, style)
                    
                    if nom_stylise is None:
                        print(f"⚠️ Style '{style}' introuvable")
                        continue
                    
                    if len(nom_stylise) > 32:
                        print(f"⚠️ Pseudo trop long : {len(nom_stylise)} caractères")
                        nom_stylise = nom_stylise[:32]
                    
                    try:
                        await after.edit(nick=nom_stylise)
                        print(f"✅ {after.name} renommé en {nom_stylise}")
                    except discord.Forbidden:
                        print(f"❌ Permissions insuffisantes pour {after.name}")
                    except discord.HTTPException as e:
                        print(f"❌ Erreur : {e}")
                    
                    break
    
    # Retrait de rôle
    elif len(before.roles) > len(after.roles):
        removed_role = next((role for role in before.roles if role not in after.roles), None)
        
        if removed_role:
            print(f"📌 {after.name} a perdu le rôle : {removed_role.name}")
            
            for style, role_names in ROLE_CONFIG.items():
                if removed_role.name in role_names:
                    print(f"🔄 Remise du pseudo par défaut")
                    
                    try:
                        await after.edit(nick=None)
                        print(f"✅ {after.name} a retrouvé son pseudo par défaut")
                    except discord.Forbidden:
                        print(f"❌ Permissions insuffisantes")
                    except discord.HTTPException as e:
                        print(f"❌ Erreur : {e}")
                    
                    break

# ==================== COMMANDES SLASH ====================

@bot.tree.command(name="ping", description="Teste si le bot répond")
async def slash_ping(interaction: discord.Interaction):
    await interaction.response.send_message("🏓 Pong !")

@bot.tree.command(name="styles", description="Affiche tous les styles disponibles")
async def slash_styles(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🎨 Styles disponibles",
        description="Tous les styles de police :",
        color=discord.Color.blue()
    )
    
    for style_name in STYLES.keys():
        exemple = convertir_texte("ReNamio", style_name)
        embed.add_field(name=style_name.capitalize(), value=exemple, inline=False)
    
    embed.set_footer(text="Utilisez /rename pour renommer")
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="convert", description="Convertit un texte dans le style choisi")
@app_commands.describe(
    style="Le style de police",
    texte="Le texte à convertir"
)
async def slash_convert(interaction: discord.Interaction, style: str, texte: str):
    style = style.lower()
    
    if style not in STYLES:
        await interaction.response.send_message(
            f"❌ Style inconnu ! Utilisez `/styles`",
            ephemeral=True
        )
        return
    
    resultat = convertir_texte(texte, style)
    
    embed = discord.Embed(
        title=f"✨ Style: {style.capitalize()}",
        description=resultat,
        color=discord.Color.green()
    )
    embed.set_footer(text=f"Demandé par {interaction.user.display_name}")
    
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="rename", description="Renomme un membre avec un style")
@app_commands.describe(
    membre="Le membre à renommer",
    style="Le style de police",
    nouveau_nom="Le nouveau nom (optionnel)"
)
@app_commands.checks.has_permissions(manage_nicknames=True)
async def slash_rename(interaction: discord.Interaction, membre: discord.Member, style: str, nouveau_nom: str = None):
    style = style.lower()
    
    if style not in STYLES:
        await interaction.response.send_message(
            f"❌ Style inconnu !",
            ephemeral=True
        )
        return
    
    if nouveau_nom is None:
        nouveau_nom = membre.display_name
    
    nom_stylise = convertir_texte(nouveau_nom, style)
    
    if len(nom_stylise) > 32:
        await interaction.response.send_message(
            f"❌ Pseudo trop long ({len(nom_stylise)}/32) !",
            ephemeral=True
        )
        return
    
    try:
        ancien_nom = membre.display_name
        await membre.edit(nick=nom_stylise)
        
        embed = discord.Embed(
            title="✅ Renommage réussi !",
            color=discord.Color.green()
        )
        embed.add_field(name="Membre", value=membre.mention, inline=True)
        embed.add_field(name="Style", value=style.capitalize(), inline=True)
        embed.add_field(name="Ancien nom", value=ancien_nom, inline=False)
        embed.add_field(name="Nouveau nom", value=nom_stylise, inline=False)
        
        await interaction.response.send_message(embed=embed)
    except discord.Forbidden:
        await interaction.response.send_message("❌ Permission refusée !", ephemeral=True)
    except discord.HTTPException as e:
        await interaction.response.send_message(f"❌ Erreur : {e}", ephemeral=True)

@bot.tree.command(name="random", description="Renomme avec un style aléatoire")
@app_commands.describe(
    membre="Le membre à renommer",
    nouveau_nom="Le nouveau nom (optionnel)"
)
@app_commands.checks.has_permissions(manage_nicknames=True)
async def slash_random(interaction: discord.Interaction, membre: discord.Member, nouveau_nom: str = None):
    style = random.choice(list(STYLES.keys()))
    
    if nouveau_nom is None:
        nouveau_nom = membre.display_name
    
    nom_stylise = convertir_texte(nouveau_nom, style)
    
    if len(nom_stylise) > 32:
        await interaction.response.send_message(
            f"❌ Pseudo trop long !",
            ephemeral=True
        )
        return
    
    try:
        await membre.edit(nick=nom_stylise)
        
        embed = discord.Embed(
            title="🎲 Renommage aléatoire !",
            color=discord.Color.purple()
        )
        embed.add_field(name="Membre", value=membre.mention, inline=True)
        embed.add_field(name="Style", value=f"🎰 {style.capitalize()}", inline=True)
        embed.add_field(name="Nouveau nom", value=nom_stylise, inline=False)
        
        await interaction.response.send_message(embed=embed)
    except discord.Forbidden:
        await interaction.response.send_message("❌ Permission refusée !", ephemeral=True)
    except discord.HTTPException as e:
        await interaction.response.send_message(f"❌ Erreur : {e}", ephemeral=True)

@bot.tree.command(name="aide", description="Affiche l'aide du bot")
async def slash_aide(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🤖 ReNamio - Guide",
        description="Bot de renommage stylisé",
        color=discord.Color.gold()
    )
    
    embed.add_field(name="/ping", value="Teste le bot", inline=False)
    embed.add_field(name="/styles", value="Liste des styles", inline=False)
    embed.add_field(name="/convert", value="Convertit un texte", inline=False)
    embed.add_field(name="/rename", value="Renomme un membre", inline=False)
    embed.add_field(name="/random", value="Style aléatoire", inline=False)
    
    embed.set_footer(text="Auto-rename activé • Créé avec ❤️")
    
    await interaction.response.send_message(embed=embed)

# ==================== GESTION D'ERREURS ====================

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    print(f"Erreur : {error}")

# ==================== LANCEMENT ====================

def main():
    if not TOKEN:
        print("❌ Token introuvable dans .env")
        print("💡 Ajoutez : TOKEN=votre_token")
        return
    
    print("🚀 Démarrage du bot...")
    try:
        bot.run(TOKEN)
    except Exception as e:
        print(f"❌ Erreur : {e}")

if __name__ == '__main__':
    main()

"""
ReNamioos - Bot Discord de renommage avec polices stylisées
"""

# Import du keep-alive en premier (pour hébergement gratuit)
try:
    from keep_alive import keep_alive
    keep_alive()
    print("✅ Keep-alive activé")
except ImportError:
    print("⚠️ keep_alive.py non trouvé, mode local uniquement")
except Exception as e:
    print(f"❌ Erreur keep-alive: {e}")

print("🚀 Démarrage du bot...")

# Imports standards
import os
import json
import random
import re
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

# ==================== CHARGEMENT CONFIGURATION ====================

load_dotenv()
TOKEN = os.getenv("TOKEN")

def charger_styles():
    """Charge les styles depuis styles.json"""
    try:
        with open("styles.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            # Séparer les conversions des styles
            conversions = data.pop("conversions", {})
            return data, conversions
    except FileNotFoundError:
        print("❌ Fichier styles.json introuvable")
        return {}, {}
    except json.JSONDecodeError:
        print("❌ Erreur lors du chargement de styles.json")
        return {}, {}

def charger_roles():
    """Charge la configuration des rôles depuis role.json"""
    try:
        with open("role.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print("⚠️ Fichier role.json introuvable")
        return {}
    except json.JSONDecodeError:
        print("❌ Erreur lors du chargement de role.json")
        return {}

STYLES, CONVERSIONS = charger_styles()
ROLE_CONFIG = charger_roles()

# ==================== CONFIGURATION BOT ====================

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

# ==================== FONCTIONS UTILITAIRES ====================

def nettoyer_pseudo(texte: str) -> str:
    """Nettoie le pseudo en retirant les caractères spéciaux au début et à la fin"""
    # Retire les caractères spéciaux au début
    texte = re.sub(r'^[^a-zA-Z0-9]+', '', texte)
    # Retire les caractères spéciaux à la fin
    texte = re.sub(r'[^a-zA-Z0-9]+$', '', texte)
    return texte

def convertir_chiffres(texte: str) -> str:
    """Convertit les chiffres en lettres selon le mapping"""
    for chiffre, lettre in CONVERSIONS.items():
        texte = texte.replace(chiffre, lettre)
    return texte

def mettre_majuscule_debut(texte: str) -> str:
    """Met une majuscule à la première lettre"""
    if not texte:
        return texte
    # Trouve la première lettre
    for i, char in enumerate(texte):
        if char.isalpha():
            return texte[:i] + texte[i].upper() + texte[i+1:]
    return texte

def convertir_texte(texte: str, style: str) -> str:
    """Convertit un texte dans le style choisi avec preprocessing"""
    if style not in STYLES:
        return texte
    
    # 1. Nettoyer les caractères spéciaux
    texte = nettoyer_pseudo(texte)
    
    # 2. Convertir les chiffres en lettres
    texte = convertir_chiffres(texte)
    
    # 3. Mettre la première lettre en majuscule
    texte = mettre_majuscule_debut(texte)
    
    # 4. Appliquer le style
    style_map = STYLES[style]
    resultat = ""
    for char in texte:
        resultat += style_map.get(char, char)
    
    return resultat

# ==================== ÉVÉNEMENTS ====================

@bot.event
async def on_ready():
    """Événement déclenché quand le bot est prêt"""
    print(f"✅ {bot.user} est connecté !")
    print(f"📊 Serveurs: {len(bot.guilds)}")
    print(f"🎨 Styles disponibles: {len(STYLES)}")
    
    # Compter le nombre de rôles configurés
    total_roles = sum(len(roles) for roles in ROLE_CONFIG.values())
    print(f"🎭 Rôles avec auto-rename: {total_roles}")
    
    # Synchroniser les commandes slash
    try:
        synced = await bot.tree.sync()
        print(f"✅ {len(synced)} commande(s) slash synchronisée(s)")
    except Exception as e:
        print(f"❌ Erreur lors de la synchronisation: {e}")

@bot.event
async def on_member_update(before: discord.Member, after: discord.Member):
    """Détecte les changements de rôles et renomme automatiquement"""
    # Ignorer si ce n'est pas un changement de rôle
    if before.roles == after.roles:
        return
    
    # Détection d'ajout de rôle
    if len(before.roles) < len(after.roles):
        new_role = next((role for role in after.roles if role not in before.roles), None)
        if new_role:
            print(f"📌 {after.name} a reçu le rôle : {new_role.name}")
            
            # Vérifier si ce rôle est dans la configuration
            for style, role_names in ROLE_CONFIG.items():
                if new_role.name in role_names:
                    print(f"🎯 Rôle trouvé ! Application du style '{style}'")
                    try:
                        # Convertir le pseudo actuel
                        nouveau_pseudo = convertir_texte(after.name, style)
                        
                        # Limiter à 32 caractères (limite Discord)
                        if len(nouveau_pseudo) > 32:
                            nouveau_pseudo = nouveau_pseudo[:32]
                        
                        # Renommer le membre
                        await after.edit(nick=nouveau_pseudo)
                        print(f"✅ {after.name} renommé en {nouveau_pseudo} (style: {style})")
                    except discord.Forbidden:
                        print(f"❌ Permissions insuffisantes pour renommer {after.name}")
                    except Exception as e:
                        print(f"❌ Erreur lors du renommage: {e}")
                    break
    
    # Détection de retrait de rôle
    elif len(before.roles) > len(after.roles):
        removed_role = next((role for role in before.roles if role not in after.roles), None)
        if removed_role:
            print(f"📌 {after.name} a perdu le rôle : {removed_role.name}")
            
            # Vérifier si ce rôle était dans la configuration
            for style, role_names in ROLE_CONFIG.items():
                if removed_role.name in role_names:
                    print(f"🔄 Rôle stylisé retiré ! Remise du pseudo par défaut")
                    try:
                        # Remettre le pseudo par défaut (nom Discord)
                        await after.edit(nick=None)
                        print(f"✅ {after.name} a retrouvé son pseudo par défaut")
                    except discord.Forbidden:
                        print(f"❌ Permissions insuffisantes pour réinitialiser {after.name}")
                    except Exception as e:
                        print(f"❌ Erreur lors de la réinitialisation: {e}")
                    break

# ==================== AUTOCOMPLÉTION ====================

@bot.tree.command(name="convert", description="Convertit un texte dans un style Unicode")
@app_commands.describe(
    style="Choisis un style de police",
    texte="Le texte à convertir"
)
async def convert_slash(interaction: discord.Interaction, style: str, texte: str):
    """Commande slash pour convertir du texte"""
    if style not in STYLES:
        await interaction.response.send_message(
            f"❌ Style '{style}' inconnu. Utilise `/styles` pour voir la liste.",
            ephemeral=True
        )
        return
    
    resultat = convertir_texte(texte, style)
    
    embed = discord.Embed(
        title=f"✨ Conversion en {style}",
        color=discord.Color.blue()
    )
    embed.add_field(name="📝 Original", value=texte, inline=False)
    embed.add_field(name="🎨 Résultat", value=resultat, inline=False)
    
    await interaction.response.send_message(embed=embed)

@convert_slash.autocomplete('style')
async def style_autocomplete(interaction: discord.Interaction, current: str):
    """Autocomplétion pour le choix du style"""
    # Filtrer les styles qui commencent par la saisie actuelle
    choices = [
        app_commands.Choice(name=style.capitalize(), value=style)
        for style in STYLES.keys()
        if current.lower() in style.lower()
    ]
    # Discord limite à 25 choix maximum
    return choices[:25]

# ==================== COMMANDES SLASH ====================

@bot.tree.command(name="ping", description="Teste si le bot répond")
async def ping_slash(interaction: discord.Interaction):
    """Commande slash ping"""
    latence = round(bot.latency * 1000)
    await interaction.response.send_message(f"🏓 Pong ! Latence: {latence}ms")

@bot.tree.command(name="styles", description="Affiche tous les styles disponibles")
async def styles_slash(interaction: discord.Interaction):
    """Commande slash pour afficher les styles"""
    embed = discord.Embed(
        title="🎨 Styles disponibles",
        description="Voici tous les styles de police disponibles",
        color=discord.Color.gold()
    )
    
    exemples = {
        "cercles": "🅡🅔🅝🅐🅜🅘🅞",
        "cursive": "𝓡𝓮𝓝𝓪𝓶𝓲𝓸",
        "gothique": "ℜ𝔢𝔑𝔞𝔪𝔦𝔬",
        "gras": "𝗥𝗲𝗡𝗮𝗺𝗶𝗼",
        "monospace": "𝚁𝚎𝙽𝚊𝚼𝚖𝚒𝚘",
        "carres": "🅁🄴🄽🄰🄼🄸🄾",
        "double": "ℝ𝕖ℕ𝕒𝕞𝕚𝕠",
        "fullwidth": "ＲｅＮａｍｉｏ"
    }
    
    for style in STYLES.keys():
        exemple = exemples.get(style, "ReNamio")
        embed.add_field(
            name=f"**{style.capitalize()}**",
            value=exemple,
            inline=True
        )
    
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="rename", description="Renomme un membre avec un style")
@app_commands.describe(
    membre="Le membre à renommer",
    style="Le style à appliquer",
    nouveau_nom="Le nouveau nom (optionnel, utilise le nom actuel par défaut)"
)
async def rename_slash(
    interaction: discord.Interaction,
    membre: discord.Member,
    style: str,
    nouveau_nom: str = None
):
    """Commande slash pour renommer un membre"""
    # Vérifier les permissions
    if not interaction.user.guild_permissions.manage_nicknames:
        await interaction.response.send_message(
            "❌ Tu n'as pas la permission de gérer les surnoms.",
            ephemeral=True
        )
        return
    
    if style not in STYLES:
        await interaction.response.send_message(
            f"❌ Style '{style}' inconnu. Utilise `/styles` pour voir la liste.",
            ephemeral=True
        )
        return
    
    # Utiliser le nom actuel si aucun nouveau nom n'est fourni
    nom_a_convertir = nouveau_nom if nouveau_nom else (membre.nick or membre.name)
    
    # Convertir le nom
    nouveau_pseudo = convertir_texte(nom_a_convertir, style)
    
    # Limiter à 32 caractères
    if len(nouveau_pseudo) > 32:
        nouveau_pseudo = nouveau_pseudo[:32]
    
    try:
        await membre.edit(nick=nouveau_pseudo)
        
        embed = discord.Embed(
            title="✅ Membre renommé",
            color=discord.Color.green()
        )
        embed.add_field(name="👤 Membre", value=membre.mention, inline=True)
        embed.add_field(name="🎨 Style", value=style.capitalize(), inline=True)
        embed.add_field(name="📝 Nouveau pseudo", value=nouveau_pseudo, inline=False)
        
        await interaction.response.send_message(embed=embed)
    except discord.Forbidden:
        await interaction.response.send_message(
            "❌ Je n'ai pas la permission de renommer ce membre.",
            ephemeral=True
        )
    except Exception as e:
        await interaction.response.send_message(
            f"❌ Erreur: {str(e)}",
            ephemeral=True
        )

@rename_slash.autocomplete('style')
async def rename_style_autocomplete(interaction: discord.Interaction, current: str):
    """Autocomplétion pour le style de la commande rename"""
    choices = [
        app_commands.Choice(name=style.capitalize(), value=style)
        for style in STYLES.keys()
        if current.lower() in style.lower()
    ]
    return choices[:25]

@bot.tree.command(name="random", description="Renomme un membre avec un style aléatoire")
@app_commands.describe(
    membre="Le membre à renommer",
    nouveau_nom="Le nouveau nom (optionnel)"
)
async def random_slash(
    interaction: discord.Interaction,
    membre: discord.Member,
    nouveau_nom: str = None
):
    """Commande slash pour renommer avec un style aléatoire"""
    # Vérifier les permissions
    if not interaction.user.guild_permissions.manage_nicknames:
        await interaction.response.send_message(
            "❌ Tu n'as pas la permission de gérer les surnoms.",
            ephemeral=True
        )
        return
    
    # Choisir un style aléatoire
    style = random.choice(list(STYLES.keys()))
    
    # Utiliser le nom actuel si aucun nouveau nom n'est fourni
    nom_a_convertir = nouveau_nom if nouveau_nom else (membre.nick or membre.name)
    
    # Convertir le nom
    nouveau_pseudo = convertir_texte(nom_a_convertir, style)
    
    # Limiter à 32 caractères
    if len(nouveau_pseudo) > 32:
        nouveau_pseudo = nouveau_pseudo[:32]
    
    try:
        await membre.edit(nick=nouveau_pseudo)
        
        embed = discord.Embed(
            title="🎲 Membre renommé (aléatoire)",
            color=discord.Color.purple()
        )
        embed.add_field(name="👤 Membre", value=membre.mention, inline=True)
        embed.add_field(name="🎨 Style", value=style.capitalize(), inline=True)
        embed.add_field(name="📝 Nouveau pseudo", value=nouveau_pseudo, inline=False)
        
        await interaction.response.send_message(embed=embed)
    except discord.Forbidden:
        await interaction.response.send_message(
            "❌ Je n'ai pas la permission de renommer ce membre.",
            ephemeral=True
        )
    except Exception as e:
        await interaction.response.send_message(
            f"❌ Erreur: {str(e)}",
            ephemeral=True
        )

@bot.tree.command(name="aide", description="Affiche l'aide du bot")
async def aide_slash(interaction: discord.Interaction):
    """Commande slash d'aide"""
    embed = discord.Embed(
        title="📖 Aide - ReNamio",
        description="Bot de renommage avec polices Unicode stylisées",
        color=discord.Color.blue()
    )
    
    embed.add_field(
        name="🎨 Commandes principales",
        value=(
            "`/styles` - Affiche tous les styles\n"
            "`/convert <style> <texte>` - Convertit du texte\n"
            "`/rename <membre> <style> [nom]` - Renomme un membre\n"
            "`/random <membre> [nom]` - Style aléatoire\n"
            "`/ping` - Teste la connexion"
        ),
        inline=False
    )
    
    embed.add_field(
        name="✨ Fonctionnalités",
        value=(
            "• 8 styles de polices Unicode\n"
            "• Auto-rename avec rôles\n"
            "• Conversion automatique chiffres → lettres\n"
            "• Majuscule automatique en début\n"
            "• Nettoyage des caractères spéciaux"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🎭 Auto-rename",
        value=(
            f"Rôles configurés: {sum(rôle_config) for rôle_config in ROLE_CONFIG.values()}\n"
            "Le pseudo change automatiquement avec le rôle !"
        ),
        inline=False
    )
    
    embed.set_footer(text="Créé avec ❤️ par Baptiste")
    
    await interaction.response.send_message(embed=embed)

# ==================== LANCEMENT ====================

def main():
    """Fonction principale pour lancer le bot"""
    if not TOKEN:
        print("❌ TOKEN manquant dans le fichier .env")
        return
    
    try:
        bot.run(TOKEN)
    except discord.LoginFailure:
        print("❌ Token Discord invalide")
    except Exception as e:
        print(f"❌ Erreur fatale: {e}")

if __name__ == "__main__":
    main()

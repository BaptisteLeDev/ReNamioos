import discord
from discord import app_commands
from discord.ext import commands
import os
from dotenv import load_dotenv
import random
import json

# ==================== CHARGEMENT CONFIGURATION ====================

# Charger les variables d'environnement
load_dotenv()
TOKEN = os.getenv("TOKEN")

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
    
    # Synchroniser les commandes slash
    try:
        synced = await bot.tree.sync()
        print(f"✅ {len(synced)} commande(s) slash synchronisée(s)")
    except Exception as e:
        print(f"❌ Erreur lors de la synchronisation des commandes : {e}")

@bot.event
async def on_member_update(before, after):
    """Détecte quand un membre reçoit ou perd un rôle et gère le renommage automatiquement"""
    
    # Ignorer si ce n'est pas un changement de rôle
    if before.roles == after.roles:
        return
    
    # Vérifie si un rôle a été ajouté
    if len(before.roles) < len(after.roles):
        # Trouve le nouveau rôle
        new_role = next((role for role in after.roles if role not in before.roles), None)
        
        if new_role:
            print(f"📌 {after.name} a reçu le rôle : {new_role.name}")
            
            # Vérifie si ce rôle est dans la configuration
            for style, role_names in ROLE_CONFIG.items():
                if new_role.name in role_names:
                    print(f"🎯 Rôle trouvé ! Application du style '{style}'")
                    
                    # Récupère le pseudo actuel du membre (son nom d'utilisateur, pas le nickname)
                    nom_actuel = after.name
                    
                    # Convertit le nom avec le style associé
                    nom_stylise = convertir_texte(nom_actuel, style)
                    
                    if nom_stylise is None:
                        print(f"⚠️ Style '{style}' introuvable")
                        continue
                    
                    # Vérifie la longueur (Discord limite à 32 caractères)
                    if len(nom_stylise) > 32:
                        print(f"⚠️ Pseudo trop long pour {after.name}: {len(nom_stylise)} caractères")
                        nom_stylise = nom_stylise[:32]
                    
                    try:
                        await after.edit(nick=nom_stylise)
                        print(f"✅ {after.name} renommé en {nom_stylise} (style: {style})")
                    except discord.Forbidden:
                        print(f"❌ Permissions insuffisantes pour renommer {after.name}")
                    except discord.HTTPException as e:
                        print(f"❌ Erreur lors du renommage de {after.name}: {e}")
                    
                    break
    
    # Vérifie si un rôle a été retiré
    elif len(before.roles) > len(after.roles):
        # Trouve le rôle retiré
        removed_role = next((role for role in before.roles if role not in after.roles), None)
        
        if removed_role:
            print(f"📌 {after.name} a perdu le rôle : {removed_role.name}")
            
            # Vérifie si ce rôle était dans la configuration
            for style, role_names in ROLE_CONFIG.items():
                if removed_role.name in role_names:
                    print(f"🔄 Rôle stylisé retiré ! Remise du pseudo par défaut")
                    
                    try:
                        # Remet le pseudo par défaut (None = pseudo d'origine)
                        await after.edit(nick=None)
                        print(f"✅ {after.name} a retrouvé son pseudo par défaut")
                    except discord.Forbidden:
                        print(f"❌ Permissions insuffisantes pour réinitialiser le pseudo de {after.name}")
                    except discord.HTTPException as e:
                        print(f"❌ Erreur lors de la réinitialisation du pseudo de {after.name}: {e}")
                    
                    break

# ==================== COMMANDES PREFIX (!) ====================

@bot.command(name="ping")
async def ping(ctx):
    """Teste si le bot répond"""
    await ctx.send("🏓 Pong !")

# ==================== COMMANDES SLASH (/) ====================

@bot.tree.command(name="ping", description="Teste si le bot répond")
async def slash_ping(interaction: discord.Interaction):
    """Teste si le bot répond"""
    await interaction.response.send_message("🏓 Pong !")

@bot.command(name="styles")
async def liste_styles(ctx):
    """Affiche tous les styles disponibles"""
    embed = discord.Embed(
        title="🎨 Styles disponibles",
        description="Voici tous les styles de police disponibles :",
        color=discord.Color.blue()
    )
    
    for style_name in STYLES.keys():
        exemple = convertir_texte("ReNamioos", style_name)
        embed.add_field(name=style_name.capitalize(), value=exemple, inline=False)
    
    embed.set_footer(text="Utilisez /rename ou !rename pour renommer")
    await ctx.send(embed=embed)

@bot.tree.command(name="styles", description="Affiche tous les styles de police disponibles")
async def slash_styles(interaction: discord.Interaction):
    """Affiche tous les styles disponibles"""
    embed = discord.Embed(
        title="🎨 Styles disponibles",
        description="Voici tous les styles de police disponibles :",
        color=discord.Color.blue()
    )
    
    for style_name in STYLES.keys():
        exemple = convertir_texte("ReNamioos", style_name)
        embed.add_field(name=style_name.capitalize(), value=exemple, inline=False)
    
    embed.set_footer(text="Utilisez /rename pour renommer un membre")
    await interaction.response.send_message(embed=embed)

@bot.command(name="convert")
async def convertir(ctx, style: str, *, texte: str):
    """Convertit un texte dans le style choisi"""
    style = style.lower()
    
    if style not in STYLES:
        await ctx.send(f"❌ Style inconnu ! Utilisez `/styles` pour voir la liste.")
        return
    
    resultat = convertir_texte(texte, style)
    
    embed = discord.Embed(
        title=f"✨ Style: {style.capitalize()}",
        description=resultat,
        color=discord.Color.green()
    )
    embed.set_footer(text=f"Demandé par {ctx.author.display_name}")
    
    await ctx.send(embed=embed)

@bot.tree.command(name="convert", description="Convertit un texte dans le style choisi")
@app_commands.describe(
    style="Le style de police à appliquer",
    texte="Le texte à convertir"
)
async def slash_convert(interaction: discord.Interaction, style: str, texte: str):
    """Convertit un texte dans le style choisi"""
    style = style.lower()
    
    if style not in STYLES:
        await interaction.response.send_message(
            f"❌ Style inconnu ! Utilisez `/styles` pour voir la liste.",
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

@bot.command(name="rename")
@commands.has_permissions(manage_nicknames=True)
async def renommer(ctx, membre: discord.Member, style: str, *, nouveau_nom: str = None):
    """Renomme un membre avec un style de police"""
    style = style.lower()
    
    if style not in STYLES:
        await ctx.send(f"❌ Style inconnu ! Utilisez `/styles` pour voir la liste.")
        return
    
    if nouveau_nom is None:
        nouveau_nom = membre.display_name
    
    nom_stylise = convertir_texte(nouveau_nom, style)
    
    if len(nom_stylise) > 32:
        await ctx.send(f"❌ Le pseudo stylisé est trop long ({len(nom_stylise)}/32 caractères)!")
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
        embed.set_footer(text=f"Modifié par {ctx.author.display_name}")
        
        await ctx.send(embed=embed)
    except discord.Forbidden:
        await ctx.send("❌ Je n'ai pas la permission de renommer ce membre !")
    except discord.HTTPException as e:
        await ctx.send(f"❌ Erreur lors du renommage : {e}")

@bot.tree.command(name="rename", description="Renomme un membre avec un style de police stylisé")
@app_commands.describe(
    membre="Le membre à renommer",
    style="Le style de police à appliquer",
    nouveau_nom="Le nouveau nom (optionnel, utilise le nom actuel si non spécifié)"
)
@app_commands.checks.has_permissions(manage_nicknames=True)
async def slash_rename(interaction: discord.Interaction, membre: discord.Member, style: str, nouveau_nom: str = None):
    """Renomme un membre avec un style de police"""
    style = style.lower()
    
    if style not in STYLES:
        await interaction.response.send_message(
            f"❌ Style inconnu ! Utilisez `/styles` pour voir la liste.",
            ephemeral=True
        )
        return
    
    if nouveau_nom is None:
        nouveau_nom = membre.display_name
    
    nom_stylise = convertir_texte(nouveau_nom, style)
    
    if len(nom_stylise) > 32:
        await interaction.response.send_message(
            f"❌ Le pseudo stylisé est trop long ({len(nom_stylise)}/32 caractères)!",
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
        embed.set_footer(text=f"Modifié par {interaction.user.display_name}")
        
        await interaction.response.send_message(embed=embed)
    except discord.Forbidden:
        await interaction.response.send_message("❌ Je n'ai pas la permission de renommer ce membre !", ephemeral=True)
    except discord.HTTPException as e:
        await interaction.response.send_message(f"❌ Erreur lors du renommage : {e}", ephemeral=True)

@bot.command(name="random")
async def renommer_aleatoire(ctx, membre: discord.Member, *, nouveau_nom: str = None):
    """Renomme un membre avec un style aléatoire"""
    style = random.choice(list(STYLES.keys()))
    
    if nouveau_nom is None:
        nouveau_nom = membre.display_name
    
    nom_stylise = convertir_texte(nouveau_nom, style)
    
    if len(nom_stylise) > 32:
        await ctx.send(f"❌ Le pseudo stylisé est trop long ({len(nom_stylise)}/32 caractères)!")
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
        
        await ctx.send(embed=embed)
    except discord.Forbidden:
        await ctx.send("❌ Je n'ai pas la permission de renommer ce membre !")
    except discord.HTTPException as e:
        await ctx.send(f"❌ Erreur lors du renommage : {e}")

@bot.tree.command(name="random", description="Renomme un membre avec un style aléatoire")
@app_commands.describe(
    membre="Le membre à renommer",
    nouveau_nom="Le nouveau nom (optionnel)"
)
@app_commands.checks.has_permissions(manage_nicknames=True)
async def slash_random(interaction: discord.Interaction, membre: discord.Member, nouveau_nom: str = None):
    """Renomme un membre avec un style aléatoire"""
    style = random.choice(list(STYLES.keys()))
    
    if nouveau_nom is None:
        nouveau_nom = membre.display_name
    
    nom_stylise = convertir_texte(nouveau_nom, style)
    
    if len(nom_stylise) > 32:
        await interaction.response.send_message(
            f"❌ Le pseudo stylisé est trop long ({len(nom_stylise)}/32 caractères)!",
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
        await interaction.response.send_message("❌ Je n'ai pas la permission de renommer ce membre !", ephemeral=True)
    except discord.HTTPException as e:
        await interaction.response.send_message(f"❌ Erreur lors du renommage : {e}", ephemeral=True)

@bot.command(name="aide")
async def aide(ctx):
    """Affiche l'aide du bot"""
    embed = discord.Embed(
        title="🤖 ReNamioos - Guide d'utilisation",
        description="Bot de renommage avec polices stylisées\n**Utilisez `/` pour les commandes slash !**",
        color=discord.Color.gold()
    )
    
    embed.add_field(
        name="/ping",
        value="Teste si le bot répond",
        inline=False
    )
    embed.add_field(
        name="/styles",
        value="Affiche tous les styles disponibles",
        inline=False
    )
    embed.add_field(
        name="/convert <style> <texte>",
        value="Convertit un texte dans le style choisi",
        inline=False
    )
    embed.add_field(
        name="/rename <@user> <style> [nom]",
        value="Renomme un membre avec un style",
        inline=False
    )
    embed.add_field(
        name="/random <@user> [nom]",
        value="Renomme avec un style aléatoire",
        inline=False
    )
    
    embed.set_footer(text="Auto-rename activé pour certains rôles • Créé avec ❤️")
    
    await ctx.send(embed=embed)

@bot.tree.command(name="aide", description="Affiche l'aide du bot")
async def slash_aide(interaction: discord.Interaction):
    """Affiche l'aide du bot"""
    embed = discord.Embed(
        title="🤖 ReNamioos - Guide d'utilisation",
        description="Bot de renommage avec polices stylisées",
        color=discord.Color.gold()
    )
    
    embed.add_field(
        name="/ping",
        value="Teste si le bot répond",
        inline=False
    )
    embed.add_field(
        name="/styles",
        value="Affiche tous les styles disponibles",
        inline=False
    )
    embed.add_field(
        name="/convert <style> <texte>",
        value="Convertit un texte dans le style choisi",
        inline=False
    )
    embed.add_field(
        name="/rename <@user> <style> [nom]",
        value="Renomme un membre avec un style",
        inline=False
    )
    embed.add_field(
        name="/random <@user> [nom]",
        value="Renomme avec un style aléatoire",
        inline=False
    )
    
    embed.set_footer(text="Auto-rename activé pour certains rôles • Créé avec ❤️")
    
    await interaction.response.send_message(embed=embed)

# ==================== GESTION D'ERREURS ====================

@renommer.error
async def rename_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("❌ Vous n'avez pas la permission de gérer les pseudos !")
    elif isinstance(error, commands.MemberNotFound):
        await ctx.send("❌ Membre introuvable !")
    elif isinstance(error, commands.MissingRequiredArgument):
        await ctx.send("❌ Syntaxe: `!rename <@user> <style> [nom]`")

@bot.event
async def on_command_error(ctx, error):
    """Gestion globale des erreurs"""
    if isinstance(error, commands.CommandNotFound):
        return  # Ignorer les commandes inexistantes
    elif isinstance(error, discord.Forbidden):
        try:
            await ctx.send("❌ Je n'ai pas les permissions nécessaires ! Vérifiez que j'ai les permissions suivantes :\n"
                          "• Envoyer des messages\n"
                          "• Intégrer des liens\n"
                          "• Gérer les pseudos (pour la commande rename)")
        except:
            print(f"❌ Impossible d'envoyer un message dans {ctx.channel}. Permissions manquantes!")
    elif isinstance(error, commands.CommandInvokeError):
        original_error = error.original
        if isinstance(original_error, discord.Forbidden):
            try:
                await ctx.send("❌ Je n'ai pas les permissions nécessaires pour effectuer cette action !")
            except:
                print(f"❌ Permissions manquantes dans {ctx.channel}")
        else:
            print(f"Erreur lors de l'exécution de la commande : {error}")
    else:
        print(f"Erreur non gérée : {error}")

# ==================== LANCEMENT DU BOT ====================

def main():
    """Fonction principale pour lancer le bot"""
    if not TOKEN:
        print("❌ Erreur : Token introuvable dans le fichier .env")
        print("💡 Assurez-vous que votre fichier .env contient : TOKEN=votre_token_ici")
        return
    
    print("🚀 Démarrage du bot...")
    try:
        bot.run(TOKEN)
    except Exception as e:
        print(f"❌ Erreur lors du démarrage du bot : {e}")

if __name__ == '__main__':
    main()

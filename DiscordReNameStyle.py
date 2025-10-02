import discord
from discord.ext import commands
import os
from dotenv import load_dotenv
import random

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# Récupérer le token depuis le fichier .env
TOKEN = os.getenv("TOKEN")

# Définir les intents nécessaires
intents = discord.Intents.default()
intents.guilds = True
intents.members = True  # Nécessaire pour renommer les membres
intents.message_content = True  # Nécessaire pour lire le contenu des messages

# Définir le préfixe des commandes (ex. "!")
bot = commands.Bot(command_prefix="!", intents=intents)

# ==================== STYLES DE POLICES ====================

STYLES = {
    "cercles": {
        "a": "🅐", "b": "🅑", "c": "🅒", "d": "🅓", "e": "🅔", "f": "🅕", "g": "🅖", "h": "🅗",
        "i": "🅘", "j": "🅙", "k": "🅚", "l": "🅛", "m": "🅜", "n": "🅝", "o": "🅞", "p": "🅟",
        "q": "🅠", "r": "🅡", "s": "🅢", "t": "🅣", "u": "🅤", "v": "🅥", "w": "🅦", "x": "🅧",
        "y": "🅨", "z": "🅩",
        "A": "🅐", "B": "🅑", "C": "🅒", "D": "🅓", "E": "🅔", "F": "🅕", "G": "🅖", "H": "🅗",
        "I": "🅘", "J": "🅙", "K": "🅚", "L": "🅛", "M": "🅜", "N": "🅝", "O": "🅞", "P": "🅟",
        "Q": "🅠", "R": "🅡", "S": "🅢", "T": "🅣", "U": "🅤", "V": "🅥", "W": "🅦", "X": "🅧",
        "Y": "🅨", "Z": "🅩"
    },
    "cursive": {
        "a": "𝓪", "b": "𝓫", "c": "𝓬", "d": "𝓭", "e": "𝓮", "f": "𝓯", "g": "𝓰", "h": "𝓱",
        "i": "𝓲", "j": "𝓳", "k": "𝓴", "l": "𝓵", "m": "𝓶", "n": "𝓷", "o": "𝓸", "p": "𝓹",
        "q": "𝓺", "r": "𝓻", "s": "𝓼", "t": "𝓽", "u": "𝓾", "v": "𝓿", "w": "𝔀", "x": "𝔁",
        "y": "𝔂", "z": "𝔃",
        "A": "𝓐", "B": "𝓑", "C": "𝓒", "D": "𝓓", "E": "𝓔", "F": "𝓕", "G": "𝓖", "H": "𝓗",
        "I": "𝓘", "J": "𝓙", "K": "𝓚", "L": "𝓛", "M": "𝓜", "N": "𝓝", "O": "𝓞", "P": "𝓟",
        "Q": "𝓠", "R": "𝓡", "S": "𝓢", "T": "𝓣", "U": "𝓤", "V": "𝓥", "W": "𝓦", "X": "𝓧",
        "Y": "𝓨", "Z": "𝓩"
    },
    "gothique": {
        "a": "𝔞", "b": "𝔟", "c": "𝔠", "d": "𝔡", "e": "𝔢", "f": "𝔣", "g": "𝔤", "h": "𝔥",
        "i": "𝔦", "j": "𝔧", "k": "𝔨", "l": "𝔩", "m": "𝔪", "n": "𝔫", "o": "𝔬", "p": "𝔭",
        "q": "𝔮", "r": "𝔯", "s": "𝔰", "t": "𝔱", "u": "𝔲", "v": "𝔳", "w": "𝔴", "x": "𝔵",
        "y": "𝔶", "z": "𝔷",
        "A": "𝔄", "B": "𝔅", "C": "ℭ", "D": "𝔇", "E": "𝔈", "F": "𝔉", "G": "𝔊", "H": "ℌ",
        "I": "ℑ", "J": "𝔍", "K": "𝔎", "L": "𝔏", "M": "𝔐", "N": "𝔑", "O": "𝔒", "P": "𝔓",
        "Q": "𝔔", "R": "ℜ", "S": "𝔖", "T": "𝔗", "U": "𝔘", "V": "𝔙", "W": "𝔚", "X": "𝔛",
        "Y": "𝔜", "Z": "ℨ"
    },
    "gras": {
        "a": "𝗮", "b": "𝗯", "c": "𝗰", "d": "𝗱", "e": "𝗲", "f": "𝗳", "g": "𝗴", "h": "𝗵",
        "i": "𝗶", "j": "𝗷", "k": "𝗸", "l": "𝗹", "m": "𝗺", "n": "𝗻", "o": "𝗼", "p": "𝗽",
        "q": "𝗾", "r": "𝗿", "s": "𝘀", "t": "𝘁", "u": "𝘂", "v": "𝘃", "w": "𝘄", "x": "𝘅",
        "y": "𝘆", "z": "𝘇",
        "A": "𝗔", "B": "𝗕", "C": "𝗖", "D": "𝗗", "E": "𝗘", "F": "𝗙", "G": "𝗚", "H": "𝗛",
        "I": "𝗜", "J": "𝗝", "K": "𝗞", "L": "𝗟", "M": "𝗠", "N": "𝗡", "O": "𝗢", "P": "𝗣",
        "Q": "𝗤", "R": "𝗥", "S": "𝗦", "T": "𝗧", "U": "𝗨", "V": "𝗩", "W": "𝗪", "X": "𝗫",
        "Y": "𝗬", "Z": "𝗭"
    },
    "monospace": {
        "a": "𝚊", "b": "𝚋", "c": "𝚌", "d": "𝚍", "e": "𝚎", "f": "𝚏", "g": "𝚐", "h": "𝚑",
        "i": "𝚒", "j": "𝚓", "k": "𝚔", "l": "𝚕", "m": "𝚖", "n": "𝚗", "o": "𝚘", "p": "𝚙",
        "q": "𝚚", "r": "𝚛", "s": "𝚜", "t": "𝚝", "u": "𝚞", "v": "𝚟", "w": "𝚠", "x": "𝚡",
        "y": "𝚢", "z": "𝚣",
        "A": "𝙰", "B": "𝙱", "C": "𝙲", "D": "𝙳", "E": "𝙴", "F": "𝙵", "G": "𝙶", "H": "𝙷",
        "I": "𝙸", "J": "𝙹", "K": "𝙺", "L": "𝙻", "M": "𝙼", "N": "𝙽", "O": "𝙾", "P": "𝙿",
        "Q": "𝚀", "R": "𝚁", "S": "𝚂", "T": "𝚃", "U": "𝚄", "V": "𝚅", "W": "𝚆", "X": "𝚇",
        "Y": "𝚈", "Z": "𝚉"
    },
    "carres": {
        "a": "🄰", "b": "🄱", "c": "🄲", "d": "🄳", "e": "🄴", "f": "🄵", "g": "🄶", "h": "🄷",
        "i": "🄸", "j": "🄹", "k": "🄺", "l": "🄻", "m": "🄼", "n": "🄽", "o": "🄾", "p": "🄿",
        "q": "🅀", "r": "🅁", "s": "🅂", "t": "🅃", "u": "🅄", "v": "🅅", "w": "🅆", "x": "🅇",
        "y": "🅈", "z": "🅉",
        "A": "🄰", "B": "🄱", "C": "🄲", "D": "🄳", "E": "🄴", "F": "🄵", "G": "🄶", "H": "🄷",
        "I": "🄸", "J": "🄹", "K": "🄺", "L": "🄻", "M": "🄼", "N": "🄽", "O": "🄾", "P": "🄿",
        "Q": "🅀", "R": "🅁", "S": "🅂", "T": "🅃", "U": "🅄", "V": "🅅", "W": "🅆", "X": "🅇",
        "Y": "🅈", "Z": "🅉"
    },
    "double": {
        "a": "𝕒", "b": "𝕓", "c": "𝕔", "d": "𝕕", "e": "𝕖", "f": "𝕗", "g": "𝕘", "h": "𝕙",
        "i": "𝕚", "j": "𝕛", "k": "𝕜", "l": "𝕝", "m": "𝕞", "n": "𝕟", "o": "𝕠", "p": "𝕡",
        "q": "𝕢", "r": "𝕣", "s": "𝕤", "t": "𝕥", "u": "𝕦", "v": "𝕧", "w": "𝕨", "x": "𝕩",
        "y": "𝕪", "z": "𝕫",
        "A": "𝔸", "B": "𝔹", "C": "ℂ", "D": "𝔻", "E": "𝔼", "F": "𝔽", "G": "𝔾", "H": "ℍ",
        "I": "𝕀", "J": "𝕁", "K": "𝕂", "L": "𝕃", "M": "𝕄", "N": "ℕ", "O": "𝕆", "P": "ℙ",
        "Q": "ℚ", "R": "ℝ", "S": "𝕊", "T": "𝕋", "U": "𝕌", "V": "𝕍", "W": "𝕎", "X": "𝕏",
        "Y": "𝕐", "Z": "ℤ"
    },
    "fullwidth": {
        "a": "ａ", "b": "ｂ", "c": "ｃ", "d": "ｄ", "e": "ｅ", "f": "ｆ", "g": "ｇ", "h": "ｈ",
        "i": "ｉ", "j": "ｊ", "k": "ｋ", "l": "ｌ", "m": "ｍ", "n": "ｎ", "o": "ｏ", "p": "ｐ",
        "q": "ｑ", "r": "ｒ", "s": "ｓ", "t": "ｔ", "u": "ｕ", "v": "ｖ", "w": "ｗ", "x": "ｘ",
        "y": "ｙ", "z": "ｚ",
        "A": "Ａ", "B": "Ｂ", "C": "Ｃ", "D": "Ｄ", "E": "Ｅ", "F": "Ｆ", "G": "Ｇ", "H": "Ｈ",
        "I": "Ｉ", "J": "Ｊ", "K": "Ｋ", "L": "Ｌ", "M": "Ｍ", "N": "Ｎ", "O": "Ｏ", "P": "Ｐ",
        "Q": "Ｑ", "R": "Ｒ", "S": "Ｓ", "T": "Ｔ", "U": "Ｕ", "V": "Ｖ", "W": "Ｗ", "X": "Ｘ",
        "Y": "Ｙ", "Z": "Ｚ"
    }
}

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

# ==================== COMMANDES ====================

@bot.command(name="ping")
async def ping(ctx):
    """Teste si le bot répond"""
    await ctx.send("🏓 Pong !")

@bot.command(name="styles")
async def liste_styles(ctx):
    """Affiche tous les styles disponibles"""
    try:
        embed = discord.Embed(
            title="🎨 Styles disponibles",
            description="Voici tous les styles de police disponibles :",
            color=discord.Color.blue()
        )
        
        for style_name in STYLES.keys():
            exemple = convertir_texte("ReNamio", style_name)
            embed.add_field(name=style_name.capitalize(), value=exemple, inline=False)
        
        embed.set_footer(text="Utilisez !rename <@user> <style> pour renommer quelqu'un")
        await ctx.send(embed=embed)
    except discord.Forbidden:
        # Si le bot n'a pas la permission d'envoyer des embeds, envoyer un message simple
        message = "🎨 **Styles disponibles :**\n\n"
        for style_name in STYLES.keys():
            exemple = convertir_texte("ReNamio", style_name)
            message += f"**{style_name.capitalize()}** : {exemple}\n"
        message += "\n💡 Utilisez `!rename <@user> <style>` pour renommer quelqu'un"
        await ctx.send(message)

@bot.command(name="convert")
async def convertir(ctx, style: str, *, texte: str):
    """Convertit un texte dans le style choisi
    
    Exemple: !convert cursive Mon Pseudo"""
    style = style.lower()
    
    if style not in STYLES:
        await ctx.send(f"❌ Style inconnu ! Utilisez `!styles` pour voir la liste.")
        return
    
    resultat = convertir_texte(texte, style)
    
    embed = discord.Embed(
        title=f"✨ Style: {style.capitalize()}",
        description=resultat,
        color=discord.Color.green()
    )
    embed.set_footer(text=f"Demandé par {ctx.author.display_name}")
    
    await ctx.send(embed=embed)

@bot.command(name="rename")
@commands.has_permissions(manage_nicknames=True)
async def renommer(ctx, membre: discord.Member, style: str, *, nouveau_nom: str = None):
    """Renomme un membre avec un style de police
    
    Exemple: !rename @User cursive NouveauNom
    Si aucun nom n'est fourni, utilise le nom actuel du membre"""
    
    style = style.lower()
    
    if style not in STYLES:
        await ctx.send(f"❌ Style inconnu ! Utilisez `!styles` pour voir la liste.")
        return
    
    # Si pas de nouveau nom, utiliser le nom actuel
    if nouveau_nom is None:
        nouveau_nom = membre.display_name
    
    # Convertir le nom
    nom_stylise = convertir_texte(nouveau_nom, style)
    
    # Vérifier la longueur (Discord limite à 32 caractères)
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

@bot.command(name="random")
async def renommer_aleatoire(ctx, membre: discord.Member, *, nouveau_nom: str = None):
    """Renomme un membre avec un style aléatoire
    
    Exemple: !random @User NouveauNom"""
    
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

@bot.command(name="aide")
async def aide(ctx):
    """Affiche l'aide du bot"""
    embed = discord.Embed(
        title="🤖 ReNamio - Guide d'utilisation",
        description="Bot de renommage avec polices stylisées",
        color=discord.Color.gold()
    )
    
    embed.add_field(
        name="!styles",
        value="Affiche tous les styles disponibles",
        inline=False
    )
    embed.add_field(
        name="!convert <style> <texte>",
        value="Convertit un texte dans le style choisi\nEx: `!convert cursive Mon Texte`",
        inline=False
    )
    embed.add_field(
        name="!rename <@user> <style> [nom]",
        value="Renomme un membre avec un style\nEx: `!rename @User gothique NouveauNom`",
        inline=False
    )
    embed.add_field(
        name="!random <@user> [nom]",
        value="Renomme avec un style aléatoire\nEx: `!random @User`",
        inline=False
    )
    embed.add_field(
        name="!ping",
        value="Teste si le bot répond",
        inline=False
    )
    
    embed.set_footer(text="Créé avec ❤️ pour Discord")
    
    await ctx.send(embed=embed)

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

if TOKEN:
    print("🚀 Démarrage du bot...")
    bot.run(TOKEN)
else:
    print("❌ Erreur : Token introuvable dans le fichier .env")
    print("💡 Assurez-vous que votre fichier .env contient : TOKEN=votre_token_ici")

# 🤖 ReNamio# 🤖 ReNamio



ReNamio est un **bot Discord en Python** qui transforme vos pseudos en versions stylisées grâce à l'Unicode.  ReNamio est un **bot Discord en Python** qui transforme vos pseudos en versions stylisées grâce à l’Unicode.  

Pratique pour donner une identité unique, surprendre vos amis ou personnaliser vos serveurs Discord.  Pratique pour donner une identité unique, surprendre vos amis ou personnaliser vos serveurs Discord.  



------



## ✨ Fonctionnalités## ✨ Fonctionnalités



- 🔤 **8 styles de polices** : cercles, cursive, gothique, gras, monospace, carrés, double, fullwidth- 🔤 Génère plusieurs styles de texte (carrés, gothique, cursive, fullwidth, etc.)

- 🎲 **Commande aléatoire** : laisse ReNamio choisir un style pour toi- 🎲 Commande aléatoire : laisse ReNamio choisir pour toi

- 🛠️ **Commandes simples** : interface intuitive avec préfixe `!`- 🛠️ Commandes simples via prefix (`!`) ou slash commands

- 👤 **Renommage automatique** : renomme les membres du serveur (avec permissions)- 👤 Peut renommer automatiquement un membre (si le bot a la permission)

- 🎨 **Aperçu des styles** : visualise tous les styles avant de les utiliser- 📜 Extensible : facile d’ajouter de nouveaux styles

- 📜 **Extensible** : facile d'ajouter de nouveaux styles

---

---

## 📦 Installation

## 🎨 Exemples de Styles

### 1. Pré-requis

| Style | Exemple |- Python **3.10+**

|-------|---------|- Une application bot Discord → [Créer un bot](https://discord.com/developers/applications)

| **Cercles** | 🅡🅔🅝🅐🅜🅘🅞 |

| **Cursive** | 𝓡𝓮𝓝𝓪𝓶𝓲𝓸 |### 2. Cloner le projet

| **Gothique** | ℜ𝔢𝔑𝔞𝔪𝔦𝔬 |```bash

| **Gras** | 𝗥𝗲𝗡𝗮𝗺𝗶𝗼 |git clone https://github.com/toncompte/ReNamio.git

| **Monospace** | 𝚁𝚎𝙽𝚊𝚖𝚒𝚘 |cd ReNamio

| **Carrés** | 🅁🄴🄽🄰🄼🄸🄾 |
| **Double** | ℝ𝕖ℕ𝕒𝕞𝕚𝕠 |
| **Fullwidth** | ＲｅＮａｍｉｏ |

---

## 📦 Installation

### 1. Pré-requis
- Python **3.10+**
- Une application bot Discord → [Créer un bot](https://discord.com/developers/applications)

### 2. Cloner le projet
```bash
git clone https://github.com/BaptisteLeDev/ReNamio.git
cd ReNamio
```

### 3. Installer les dépendances
```bash
pip install discord.py python-dotenv
```

Ou avec Python directement :
```bash
python -m pip install discord.py python-dotenv
```

### 4. Configurer le bot

#### a) Créer une application Discord
1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Cliquez sur **"New Application"**
3. Donnez un nom à votre application (ex: ReNamio)
4. Allez dans l'onglet **"Bot"**

#### b) Activer les Intents Privilégiés ⚠️
**IMPORTANT** : Sans cette étape, le bot ne fonctionnera pas !

Dans l'onglet **Bot**, activez les **Privileged Gateway Intents** :
- ✅ **SERVER MEMBERS INTENT** (obligatoire pour renommer)
- ✅ **MESSAGE CONTENT INTENT** (obligatoire pour les commandes)

Cliquez sur **"Save Changes"**

#### c) Récupérer le token
1. Dans l'onglet **"Bot"**, cliquez sur **"Reset Token"**
2. Copiez le token généré
3. Créez un fichier `.env` à la racine du projet :
```env
TOKEN=votre_token_ici
```

⚠️ **Ne partagez JAMAIS votre token !** Le fichier `.env` est déjà dans `.gitignore`.

#### d) Inviter le bot sur votre serveur
1. Allez dans l'onglet **"OAuth2"** → **"URL Generator"**
2. Sélectionnez les scopes :
   - ✅ `bot`
   - ✅ `applications.commands`
3. Sélectionnez les permissions :
   - ✅ `Manage Nicknames`
   - ✅ `Send Messages`
   - ✅ `Embed Links`
4. Copiez l'URL générée et ouvrez-la dans votre navigateur
5. Sélectionnez votre serveur et autorisez le bot

---

## 🚀 Lancement

```bash
python DiscordReNameStyle.py
```

Si tout fonctionne, vous verrez :
```
🚀 Démarrage du bot...
✅ ReNamio#1234 est connecté !
📊 Serveurs: 1
🎨 Styles disponibles: 8
```

---

## 📖 Commandes

| Commande | Description | Exemple |
|----------|-------------|---------|
| `!ping` | Teste si le bot répond | `!ping` |
| `!styles` | Affiche tous les styles disponibles | `!styles` |
| `!convert <style> <texte>` | Convertit un texte dans le style choisi | `!convert cursive Mon Pseudo` |
| `!rename <@user> <style> [nom]` | Renomme un membre avec un style | `!rename @User gothique NouveauNom` |
| `!random <@user> [nom]` | Renomme avec un style aléatoire | `!random @User` |
| `!aide` | Affiche l'aide complète | `!aide` |

### Exemples d'utilisation

#### Convertir du texte
```
!convert cursive Bonjour Discord
```
Résultat : 𝓑𝓸𝓷𝓳𝓸𝓾𝓻 𝓓𝓲𝓼𝓬𝓸𝓻𝓭

#### Renommer un membre
```
!rename @Baptiste cercles Baptiste
```
Résultat : Le pseudo de Baptiste devient 🅑🅐🅟🅣🅘🅢🅣🅔

#### Renommer avec le pseudo actuel
```
!rename @Baptiste cursive
```
Le bot utilisera le pseudo actuel du membre.

#### Style aléatoire
```
!random @Baptiste
```
Le bot choisira un style au hasard !

---

## ⚙️ Configuration

### Permissions requises

Le bot a besoin des permissions suivantes :
- **Manage Nicknames** : Pour renommer les membres
- **Send Messages** : Pour envoyer des messages
- **Embed Links** : Pour afficher les embeds stylisés

### Limitations Discord

- Les pseudos sont limités à **32 caractères** maximum
- Le bot ne peut pas renommer les propriétaires de serveur
- Le bot ne peut pas renommer les membres ayant un rôle supérieur au sien

---

## 🔧 Développement

### Structure du projet
```
ReNamio/
├── DiscordReNameStyle.py  # Code principal du bot
├── .env                    # Configuration (token)
├── .gitignore             # Fichiers à ignorer
└── README.md              # Ce fichier
```

### Ajouter un nouveau style

1. Ouvrez `DiscordReNameStyle.py`
2. Dans le dictionnaire `STYLES`, ajoutez votre style :
```python
"nouveau_style": {
    "a": "𝕒", "b": "𝕓", "c": "𝕔", # ... etc
    "A": "𝔸", "B": "𝔹", "C": "ℂ", # ... etc
}
```
3. Redémarrez le bot

---

## 🐛 Résolution de problèmes

### Le bot ne se connecte pas
1. Vérifiez que votre token est correct dans `.env`
2. Vérifiez que les **intents privilégiés** sont activés (voir section Installation)
3. Vérifiez votre connexion internet

### Les commandes ne s'affichent pas
Les commandes avec préfixe `!` apparaissent quand vous tapez `!` dans le chat.  
Si elles n'apparaissent pas, vérifiez que :
- Le bot est bien en ligne
- Le **MESSAGE CONTENT INTENT** est activé
- Vous avez la permission d'envoyer des messages dans le salon

### "Je n'ai pas la permission de renommer ce membre"
- Vérifiez que le bot a la permission **Manage Nicknames**
- Vérifiez que le rôle du bot est **au-dessus** du rôle du membre à renommer
- Vous ne pouvez pas renommer le propriétaire du serveur

### "Le pseudo stylisé est trop long"
Discord limite les pseudos à 32 caractères. Essayez avec un pseudo plus court.

---

## 📝 Licence

Ce projet est sous licence MIT. Vous êtes libre de l'utiliser, le modifier et le distribuer.

---

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- 🐛 Signaler des bugs
- 💡 Proposer de nouvelles fonctionnalités
- 🎨 Ajouter de nouveaux styles
- 📖 Améliorer la documentation

---

## 📞 Support

- 🌐 [GitHub Issues](https://github.com/BaptisteLeDev/ReNamio/issues)
- 📧 Contact : [Créer une issue](https://github.com/BaptisteLeDev/ReNamio/issues/new)

---

## 🎉 Crédits

Créé avec ❤️ pour la communauté Discord  
Utilise [discord.py](https://github.com/Rapptz/discord.py)

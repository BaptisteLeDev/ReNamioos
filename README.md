# 🤖 ReNamioos

> ## ⚠️ Réécriture en cours — Bun / TypeScript
>
> ReNamioos est en cours de **réécriture** de Python vers **Bun / TypeScript** (Discord.js 14),
> bot pilote de la flotte (cf. [`decisions/0001`](decisions/0001-langage-cible-reecriture.md) et
> [`decisions/0002`](decisions/0002-pattern-starter.md)). Pendant la transition, le **legacy Python
> (`bot.py`) reste intact** jusqu'à la bascule (slice B7) ; le scaffold TS **coexiste** à la racine.
>
> - **Lancer la version TS** : `bun install` puis `bun run dev` (API Fastify + bot Discord).
> - **Tests** : `bun test` · **Typecheck** : `bun run typecheck` · **Commandes** : `bun run deploy-commands`.
> - **Config** : copier `.env.example` en `.env` (variables `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`,
>   `PORT`, …).
> - **Architecture cible** : voir [`ARCHITECTURE.md`](ARCHITECTURE.md) (DDD : domaine pur isolé,
>   ACL ciblée Discord, API conforme au contrat monitoring `/health` + `/stats`).
> - **Domaine de stylisation** : voir [`src/domain/README.md`](src/domain/README.md) (langage
>   ubiquitaire, API cible, invariants pinnés) — implémenté en slice B3.
>
> La documentation Python ci-dessous décrit le **comportement legacy de référence** (cf. aussi
> [`docs/caracterisation.md`](docs/caracterisation.md)).

---

## Version Python (legacy, référence jusqu'à B7)

**ReNamioos** est un bot Discord en Python qui transforme automatiquement les pseudos en versions stylisées grâce à l'Unicode.

## ✨ Fonctionnalités

- 🎨 **8 styles de polices** : cercles, cursive, gothique, gras, monospace, carrés, double, fullwidth
- ⚡ **Commandes Slash (/)** : Interface moderne avec auto-complétion
- 🎭 **Auto-rename sur rôles** : Renommage automatique quand un membre obtient un rôle spécifique
- 🔄 **Restauration automatique** : Remet le pseudo par défaut quand le rôle est retiré
- 🎲 **Renommage aléatoire** : Laisse le bot choisir un style au hasard
- 🛠️ **Interface intuitive** : Commandes simples et claires

---

## 🎨 Exemples de Styles

| Style | Exemple |
|-------|---------|
| **Cercles** | 🅡🅔🅝🅐🅜🅘🅞 |
| **Cursive** | 𝓡𝓮𝓝𝓪𝓶𝓲𝓸 |
| **Gothique** | ℜ𝔢𝔑𝔞𝔪𝔦𝔬 |
| **Gras** | 𝗥𝗲𝗡𝗮𝗺𝗶𝗼 |
| **Monospace** | 𝚁𝚎𝙽𝚊𝚖𝚒𝚘 |
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
git clone https://github.com/BaptisteLeDev/ReNamioos.git
cd ReNamioos
```

### 3. Installer les dépendances
```bash
pip install -r requirements.txt
```

### 4. Configurer le bot

#### a) Créer une application Discord
1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Cliquez sur **"New Application"**
3. Donnez un nom à votre application (ex: ReNamioos)
4. Allez dans l'onglet **"Bot"**

#### b) Activer les Intents Privilégiés ⚠️
**IMPORTANT** : Dans l'onglet **Bot**, activez tous les **Privileged Gateway Intents** :
- ✅ **PRESENCE INTENT**
- ✅ **SERVER MEMBERS INTENT** (obligatoire pour l'auto-rename)
- ✅ **MESSAGE CONTENT INTENT**

#### c) Configurer le token
1. Dans l'onglet **"Bot"**, copiez le token
2. Créez un fichier `.env` à la racine du projet :
```env
TOKEN=votre_token_ici
```

⚠️ **Ne partagez JAMAIS votre token !**

#### d) Inviter le bot
1. Allez dans l'onglet **"OAuth2"** → **"URL Generator"**
2. Sélectionnez :
   - ✅ `bot`
   - ✅ `applications.commands`
3. Permissions :
   - ✅ `Manage Nicknames`
   - ✅ `Send Messages`
   - ✅ `Embed Links`
4. Copiez l'URL et invitez le bot sur votre serveur

---

## 🚀 Lancement

```bash
python DiscordReNameStyle.py
```

Si tout fonctionne :
```
✅ ReNamioos#4970 est connecté !
📊 Serveurs: 1
🎨 Styles disponibles: 8
🎭 Rôles avec auto-rename: 1
✅ 6 commande(s) slash synchronisée(s)
```

---

## 📖 Commandes

### Commandes Slash (/)

| Commande | Description | Exemple |
|----------|-------------|---------|
| `/ping` | Teste si le bot répond | `/ping` |
| `/styles` | Affiche tous les styles disponibles | `/styles` |
| `/convert <style> <texte>` | Convertit un texte | `/convert cursive Bonjour` |
| `/rename <@user> <style> [nom]` | Renomme un membre | `/rename @User cursive` |
| `/random <@user> [nom]` | Style aléatoire | `/random @User` |
| `/aide` | Affiche l'aide | `/aide` |

### Commandes Prefix (!)

Les commandes avec `!` sont aussi disponibles pour la compatibilité :
- `!ping`, `!styles`, `!convert`, `!rename`, `!random`, `!aide`

---

## 🎭 Auto-Rename sur Rôles

Le bot peut renommer automatiquement les membres quand ils obtiennent un rôle spécifique.

### Configuration

Éditez le fichier `role.json` :
```json
{
    "cursive": ["Nom du Rôle 1"],
    "gothique": ["Nom du Rôle 2", "Autre Rôle"],
    "cercles": ["VIP"]
}
```

### Fonctionnement

1. **Membre obtient le rôle** → Son pseudo est converti avec le style associé
2. **Membre perd le rôle** → Son pseudo est remis par défaut

**Exemple** :
```
Membre "Baptiste" obtient le rôle "Éclats d'Aether"
→ Renommé en "𝓑𝓪𝓹𝓽𝓲𝓼𝓽𝓮"

Membre perd le rôle
→ Redevient "Baptiste"
```

---

## ⚙️ Configuration

### Structure du projet
```
ReNamioos/
├── DiscordReNameStyle.py  # Code principal
├── styles.json            # Définition des styles
├── role.json             # Configuration auto-rename
├── .env                  # Token (ne pas commit !)
├── .gitignore           # Fichiers à ignorer
├── requirements.txt     # Dépendances
└── README.md           # Documentation
```

### Ajouter un nouveau style

1. Éditez `styles.json`
2. Ajoutez votre style :
```json
"nouveau_style": {
    "a": "𝕒", "b": "𝕓", "c": "𝕔",
    "A": "𝔸", "B": "𝔹", "C": "ℂ"
}
```
3. Redémarrez le bot

---

## 🐛 Résolution de problèmes

### Le bot ne se connecte pas
- Vérifiez le token dans `.env`
- Vérifiez que tous les **intents** sont activés
- Vérifiez votre connexion internet

### Les commandes slash n'apparaissent pas
- Attendez quelques minutes (synchronisation Discord)
- Réinvitez le bot avec le scope `applications.commands`
- Redémarrez Discord

### L'auto-rename ne fonctionne pas
- Vérifiez que **SERVER MEMBERS INTENT** est activé
- Vérifiez que le bot a la permission **Manage Nicknames**
- Vérifiez que le rôle du bot est **au-dessus** des membres à renommer
- Vérifiez le nom exact du rôle dans `role.json`

### "Permissions insuffisantes"
- Le bot doit avoir **Manage Nicknames**
- Le rôle du bot doit être **au-dessus** du membre
- Impossible de renommer le propriétaire du serveur

---

## 📝 Licence

MIT License - Vous êtes libre d'utiliser, modifier et distribuer ce projet.

---

## 🤝 Contribution

Les contributions sont bienvenues !
- 🐛 Signaler des bugs via [Issues](https://github.com/BaptisteLeDev/ReNamioos/issues)
- 💡 Proposer des fonctionnalités
- 🎨 Ajouter de nouveaux styles
- 📖 Améliorer la documentation

---

## 📞 Support

- 🌐 [GitHub Issues](https://github.com/BaptisteLeDev/ReNamioos/issues)
- 📧 [Créer une issue](https://github.com/BaptisteLeDev/ReNamioos/issues/new)

---

## 🎉 Crédits

Créé avec ❤️ par Baptiste pour la communauté Discord  
Utilise [discord.py](https://github.com/Rapptz/discord.py)

---

## ⚠️ Avertissement de Sécurité

**Ne partagez JAMAIS** :
- Votre token Discord (`.env`)
- Votre secret client
- Vos clés API

Le fichier `.env` est déjà dans `.gitignore` pour éviter les commits accidentels.

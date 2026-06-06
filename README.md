# 🤖 ReNamioos

ReNamioos est un bot Discord en **Bun / TypeScript** (Discord.js 14) qui transforme
automatiquement les pseudos en versions stylisées grâce à l'Unicode. C'est le bot **pilote**
de la flotte (cf. [`decisions/0001`](decisions/0001-langage-cible-reecriture.md) langage cible,
[`decisions/0002`](decisions/0002-pattern-starter.md) pattern du pilote).

Le bot est doublé d'une **API HTTP de supervision** (`/health` + `/stats`) consommée par le
monitoring de la flotte. Voir [`ARCHITECTURE.md`](ARCHITECTURE.md) (DDD : domaine pur isolé,
ACL ciblée Discord, contrat monitoring) et [`src/domain/README.md`](src/domain/README.md)
(langage ubiquitaire du domaine de stylisation, API, invariants).

## ✨ Fonctionnalités

- 🎨 **8 styles de polices** : cercles, cursive, gothique, gras, monospace, carrés, double, fullwidth
- ⚡ **Commandes Slash (/)** : interface moderne avec auto-complétion
- 🎭 **Auto-rename sur rôles** : renommage automatique quand un membre obtient un rôle mappé
- 🔄 **Restauration automatique** : remet le pseudo par défaut quand le rôle est retiré
- 🎲 **Renommage aléatoire** : laisse le bot choisir un style au hasard
- 🛠️ **Interface intuitive** : commandes simples et claires

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
- **Bun 1.3.x** ([installation](https://bun.sh))
- Une application bot Discord → [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Cloner le projet
```bash
git clone https://github.com/BaptisteLeDev/ReNamioos.git
cd ReNamioos
```

### 3. Installer les dépendances
```bash
bun install
```

### 4. Configurer le bot

#### a) Créer une application Discord
1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Cliquez sur **"New Application"**
3. Donnez un nom à votre application (ex: ReNamioos)
4. Allez dans l'onglet **"Bot"**

#### b) Activer les Intents Privilégiés ⚠️
Dans l'onglet **Bot**, activez **SERVER MEMBERS INTENT** (`GuildMembers`) : il est
**obligatoire** pour l'auto-rename. Sans lui, l'événement `guildMemberUpdate` n'arrive jamais
et l'auto-rename reste silencieusement inerte (cf. [`ARCHITECTURE.md`](ARCHITECTURE.md), § Auto-rename).

#### c) Configurer l'environnement
Copiez `.env.example` en `.env` à la racine et renseignez les variables (validées par zod
au boot, cf. `src/config.ts`) :

| Variable | Rôle | Défaut |
|---|---|---|
| `DISCORD_TOKEN` | token du bot (jamais committé) | requis |
| `DISCORD_APPLICATION_ID` | id de l'application | requis |
| `DISCORD_GUILD_ID` | guilde de déploiement des commandes (dev) | optionnel |
| `PORT` | port de l'API de supervision | `8199` |
| `HOST` | interface d'écoute de l'API | `0.0.0.0` |
| `AUTO_RENAME_CONFIG_PATH` | chemin du mapping auto-rename | `auto-rename.json` |
| `NODE_ENV` | `development` / `production` / `test` | `development` |

⚠️ **Ne partagez JAMAIS votre token.** Le fichier `.env` est dans `.gitignore`.

#### d) Inviter le bot
1. Onglet **"OAuth2"** → **"URL Generator"**
2. Scopes : `bot`, `applications.commands`
3. Permissions : `Manage Nicknames`, `Send Messages`, `Embed Links`
4. Copiez l'URL et invitez le bot

---

## 🚀 Build & lancement

Bun exécute le TypeScript directement, aucun build n'est requis pour lancer.

```bash
bun install               # installe les dépendances (lockfile bun.lock)
bun run dev               # lance API + bot en watch (développement)
bun run start             # lance API + bot (src/index.ts)
bun run deploy-commands   # enregistre les commandes slash auprès de Discord
```

Vérification (mêmes étapes que le gate CI) :

```bash
bun run typecheck         # tsc --noEmit, mode strict
bun test                  # runner natif bun:test (suite de caractérisation + unitaires)
docker build -t renamioos .   # image Bun + gate typecheck/test au build
```

L'API démarre **avant** le bot : `GET /health` répond même si le login Discord échoue
(cf. [`ARCHITECTURE.md`](ARCHITECTURE.md), § Bootstrap et § Contrat de supervision).

---

## 📖 Commandes

| Commande | Description | Exemple |
|----------|-------------|---------|
| `/ping` | Teste si le bot répond | `/ping` |
| `/styles` | Affiche tous les styles disponibles | `/styles` |
| `/convert <style> <texte>` | Convertit un texte | `/convert cursive Bonjour` |
| `/rename <@user> <style> [nom]` | Renomme un membre | `/rename @User cursive` |
| `/random <@user> [nom]` | Style aléatoire | `/random @User` |
| `/aide` | Affiche l'aide | `/aide` |

---

## 🎭 Auto-Rename sur Rôles

Le bot peut renommer automatiquement les membres quand ils obtiennent un rôle mappé.

### Configuration

Le mapping `roleId → styleName` vit dans **`auto-rename.json`** (exemple :
[`auto-rename.example.json`](auto-rename.example.json)), chemin configurable via
`AUTO_RENAME_CONFIG_PATH`. Il est chargé et validé par zod au boot (style inconnu, fichier
absent ou JSON malformé ⇒ échec de boot explicite). Voir
[`decisions/0004-auto-rename.md`](decisions/0004-auto-rename.md).

```json
{
  "123456789012345678": "cursive",
  "234567890123456789": "gothique"
}
```

L'**ordre des clés** du fichier définit la priorité quand plusieurs rôles mappés sont gagnés
en même temps.

### Fonctionnement

1. **Membre gagne un rôle mappé** → son pseudo est stylisé avec le style associé
2. **Membre perd le rôle** → l'auto-rename n'agit que sur les gains (les retraits ne déclenchent rien)

**Exemple** :
```
Membre "Baptiste" gagne le rôle mappé sur "cursive"
→ Renommé en "𝓑𝓪𝓹𝓽𝓲𝓼𝓽𝓮"
```

---

## ⚙️ Structure du projet

```
ReNamioos/
├── src/                    # code TypeScript (domaine pur, adapters Discord, API)
│   ├── index.ts            # bootstrap : API d'abord, puis bot
│   ├── config.ts           # config zod (seule source d'env)
│   ├── config/             # chargeur+validation du mapping auto-rename
│   ├── client.ts           # BotClient (adapter Discord, StatsProvider)
│   ├── deploy-commands.ts  # enregistrement des commandes slash
│   ├── api/                # server.ts, stats-provider.ts (port), contract.test.ts
│   ├── commands/           # ping, styles, convert, rename, random, aide + helpers
│   ├── events/             # guild-member-update.ts (adapter auto-rename)
│   └── domain/             # logique pure (stylisation, auto-rename) + data/styles.json
├── docs/                   # caracterisation.md (archive legacy), stories.md
├── decisions/              # ADR (0001 langage, 0002 pattern, 0003 corrections, 0004 auto-rename)
├── auto-rename.json        # mapping auto-rename (roleId → styleName), versionné
├── auto-rename.example.json
├── Dockerfile              # image Bun (gate typecheck/test au build)
├── .dockerignore
├── .github/workflows/ci.yml # gate qualité + CD gated (tailnet → Dokploy)
├── package.json            # runtime bun, scripts dev/start/test/typecheck/deploy-commands
├── tsconfig.json           # strict, noEmit
└── .env.example            # placeholders (jamais de secret réel)
```

### Ajouter un nouveau style

Les tables de glyphes sont une config fichier versionnée dans
`src/domain/data/styles.json`. Ajoutez votre style, puis ajustez le domaine de stylisation
si nécessaire (cf. [`src/domain/README.md`](src/domain/README.md)) et relancez les tests.

---

## 🐛 Résolution de problèmes

### Le bot ne se connecte pas
- Vérifiez `DISCORD_TOKEN` dans `.env`
- Vérifiez votre connexion internet

### Les commandes slash n'apparaissent pas
- Relancez `bun run deploy-commands`
- Attendez la synchronisation Discord (quelques minutes en global)
- Réinvitez le bot avec le scope `applications.commands`

### L'auto-rename ne fonctionne pas
- Vérifiez que **SERVER MEMBERS INTENT** est activé dans le Dev Portal
- Vérifiez que le bot a la permission **Manage Nicknames**
- Vérifiez que le rôle du bot est **au-dessus** des membres à renommer
- Vérifiez les `roleId` mappés dans `auto-rename.json`

### "Permissions insuffisantes"
- Le bot doit avoir **Manage Nicknames**
- Le rôle du bot doit être **au-dessus** du membre
- Impossible de renommer le propriétaire du serveur

---

## 📝 Licence

MIT License - Vous êtes libre d'utiliser, modifier et distribuer ce projet.

---

## 🤝 Contribution

Les contributions sont bienvenues :
- 🐛 Signaler des bugs via [Issues](https://github.com/BaptisteLeDev/ReNamioos/issues)
- 💡 Proposer des fonctionnalités
- 🎨 Ajouter de nouveaux styles
- 📖 Améliorer la documentation

---

## ⚠️ Avertissement de Sécurité

**Ne partagez JAMAIS** votre token Discord, votre secret client ni vos clés API.
Le fichier `.env` est déjà dans `.gitignore` pour éviter les commits accidentels.

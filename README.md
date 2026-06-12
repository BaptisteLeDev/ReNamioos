# 🤖 ReNamioos

ReNamioos est un bot Discord en **Bun / TypeScript** (Discord.js 14) qui transforme
automatiquement les pseudos en versions stylisées grâce à l'Unicode. C'est le bot **pilote**
de la flotte (cf. [`decisions/0001`](docs/decisions/0001-langage-cible-reecriture.md) langage cible,
[`decisions/0002`](docs/decisions/0002-pattern-starter.md) pattern du pilote).

Le bot est doublé d'une **API HTTP de supervision** (`/health` + `/stats`) consommée par le
monitoring de la flotte. Voir [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) (DDD : domaine pur isolé,
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
et l'auto-rename reste silencieusement inerte (cf. [`ARCHITECTURE.md`](docs/ARCHITECTURE.md), § Auto-rename).

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
| `AUTO_RENAME_CONFIG_PATH` | chemin du mapping auto-rename (mode fichier / fallback) | `auto-rename.json` |
| `DATABASE_URL` | URL Postgres Neon ; **absente** = mode fichier (dev), **présente** = mode Neon par serveur | optionnel |
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
(cf. [`ARCHITECTURE.md`](docs/ARCHITECTURE.md), § Bootstrap et § Contrat de supervision).

---

## 📖 Commandes

| Commande | Description | Exemple |
|----------|-------------|---------|
| `/ping` | Teste si le bot répond | `/ping` |
| `/styles` | Affiche tous les styles disponibles | `/styles` |
| `/convert <style> <texte>` | Convertit un texte | `/convert cursive Bonjour` |
| `/rename <@user> <style> [nom]` | Renomme un membre | `/rename @User cursive` |
| `/random <@user> [nom]` | Style aléatoire | `/random @User` |
| `/auto-rename add\|remove\|list` | Configure l'auto-rename du serveur (admin `Manage Server`) | `/auto-rename add role:@VIP style:Cursive` |
| `/renamioos opt-out\|opt-in` | Refuse / réactive l'auto-rename te concernant sur ce serveur | `/renamioos opt-out` |
| `/aide` | Affiche l'aide | `/aide` |

---

## 🎭 Auto-Rename sur Rôles

Le bot renomme automatiquement les membres quand ils obtiennent un rôle mappé. La config est
**par serveur** et **modifiable depuis Discord** (depuis le lot B8 ; voir
[`decisions/0005-config-auto-rename-neon.md`](docs/decisions/0005-config-auto-rename-neon.md), qui
supersède la config fichier d'[ADR-0004](docs/decisions/0004-auto-rename.md)).

### Configuration depuis Discord (mode Neon)

Avec `DATABASE_URL` défini (production), un admin (`Manage Server`) configure tout via
`/auto-rename` :

| Sous-commande | Effet |
|---|---|
| `/auto-rename add role:<@rôle> style:<style>` | mappe un rôle à un style (sélecteur de rôle natif + choix de style) |
| `/auto-rename remove role:<@rôle>` | retire le mapping d'un rôle |
| `/auto-rename list` | liste les mappings du serveur avec un aperçu de chaque style |

La config vit dans une table **Neon** (`auto_rename_mappings`, clé `(guild_id, role_id)`) :
multi-serveur par construction, persistante, sans redéploiement. La **provenance des données** est
centralisée derrière un port unique (`MappingStore`) : `/auto-rename`, `/aide` et l'événement
`guildMemberUpdate` lisent tous la même source (cf. [`ARCHITECTURE.md`](docs/ARCHITECTURE.md),
§ Auto-rename). L'**ordre d'ajout** définit la priorité quand plusieurs rôles mappés sont gagnés
en même temps.

### Consentement membre (opt-out)

Chaque membre peut **refuser** l'auto-rename sur lui avec `/renamioos opt-out` (et le réactiver avec
`/renamioos opt-in`), **par serveur**. Un membre opt-out n'est jamais renommé automatiquement, quel
que soit le style déclenché par ses rôles. Le consentement a sa propre provenance centralisée (port
`OptOutStore`, table Neon `auto_rename_optouts`) ; une ligne n'existe **que** pour un membre opt-out
(minimisation D8). Voir [`decisions/0007-opt-out-membre.md`](decisions/0007-opt-out-membre.md).

### Mode fichier (développement)

Sans `DATABASE_URL`, le bot lit le mapping `roleId → styleName` du fichier **`auto-rename.json`**
(exemple : [`auto-rename.example.json`](auto-rename.example.json), chemin configurable via
`AUTO_RENAME_CONFIG_PATH`), validé par zod au boot. En mode fichier, `/auto-rename add|remove`
est refusé (le fichier dev s'édite à la main) :

```json
{
  "123456789012345678": "cursive",
  "234567890123456789": "gothique"
}
```

**Transition** : en mode Neon, tant qu'un serveur n'a **aucun** mapping en base, le fichier est
lu en **fallback lecture** (le temps que l'admin recrée sa config via `/auto-rename`). Dès qu'un
mapping Neon existe pour le serveur, le fichier est ignoré pour ce serveur. Ce fallback est
transitoire (à retirer une release plus tard).

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
│   ├── config.ts           # config zod (seule source d'env, dont DATABASE_URL optionnelle)
│   ├── config/             # chargeur+validation du mapping fichier auto-rename
│   ├── client.ts           # BotClient (adapter Discord, StatsProvider)
│   ├── deploy-commands.ts  # enregistrement des commandes slash
│   ├── api/                # server.ts, stats-provider.ts (port), contract.test.ts
│   ├── db/                 # schema drizzle + client pg/Neon (init paresseuse)
│   ├── mapping/            # port MappingStore + adapters Neon/fichier (provenance auto-rename)
│   ├── commands/           # ping, styles, convert, rename, random, auto-rename, aide + helpers
│   ├── events/             # guild-member-update.ts (adapter auto-rename → MappingStore)
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
- Vérifiez les mappings du serveur avec `/auto-rename list` (mode Neon) ou les `roleId` de
  `auto-rename.json` (mode fichier / fallback)

### `/auto-rename add` répond « mode fichier en lecture seule »
- L'écriture exige le mode Neon : définissez `DATABASE_URL`. En développement sans base, éditez
  `auto-rename.json` à la main.

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

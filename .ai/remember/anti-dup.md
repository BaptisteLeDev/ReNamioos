# Anti-duplication — ReNamioos

> Abstractions de centralisation déjà en place + dette de duplication connue. Avant d'ajouter,
> chercher l'existant et brancher dessus.

## Abstractions de centralisation existantes (à réutiliser, pas redoubler)

| Centralise | Point unique | Conséquence |
|---|---|---|
| Lecture d'environnement | `src/config.ts` (zod) | Nouvelle variable = un seul fichier (+ `.env.example`). |
| Provenance auto-rename | port `MappingStore` (`src/mapping/`) | `/auto-rename`, `/aide`, `guildMemberUpdate` lisent le même port. Changer la source = un adapter. |
| Provenance commandes connues | port `CommandSyncStore` (`src/command-sync/`) | `/update` consomme le port, jamais Neon/fichier en direct. |
| Métriques exposées | port `StatsProvider` + `BotClient.getStats()` | `/stats` ne touche pas Discord.js. |
| Stylisation | domaine pur `src/domain/stylisation.ts` | Aucune commande ne reconstruit le pipeline glyphe. |
| Flux de rename | `appliquerRename` / `src/commands/styliser.ts` | `/rename`, `/random`, auto-rename partagent hiérarchie + troncature + edit. |
| Tables de glyphes | `src/domain/data/styles.json` via `src/domain/styles.ts` | Ajouter un style = éditer le JSON, pas le code. |
| Couleurs / embeds | centralisés sur `feat/v1-release` (`refactor(commands): centralise couleurs et reutilise embedRenameOk`) | embeds réutilisés au lieu d'être recopiés. |

## Dette de duplication connue (flotte)

- **Durcissement de l'API monitoring à centraliser dans le Template v2** (Discord-TemplateBot#15).
  Le pattern `/stats` exposé sur `0.0.0.0` + `CORS origin: true` + pas de rate limit vient du
  Template v2 et touche **4 bots**, dont ReNamioos. ADR-0006 (branche `fix/security-v1`) corrige
  ReNamioos localement (auth Bearer `/stats`, CORS allowlist, rate limit, borne `/convert`), mais
  le durcissement doit **remonter dans le Template v2** pour éviter de re-corriger chaque bot.
  Tant que ce n'est pas centralisé, chaque bot porte sa copie du durcissement = dette active.

## Points de vigilance (pas de la dette, mais à surveiller)

- **Fallback fichier transitoire** (`CompositeMappingStore`) : lecture du fichier tant qu'une guild
  n'a rien en Neon. À retirer une release après migration complète. Documenté comme transitoire.
- **command-sync vs mapping** : deux ports avec le même squelette Neon/fichier/composite. Si un
  troisième « store par serveur » apparaît, envisager une factory commune (règle de 3 : on est à 2).

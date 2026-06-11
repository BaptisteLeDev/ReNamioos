# Progress — ReNamioos

> État courant. Daté **2026-06-11**. Source : `git log`, `gh pr list`, branches locales/remote.

## Sur `main` (livré)

- Réécriture Bun/TS complète (B1 à B8), legacy Python retiré (B7).
- Domaine de stylisation pur (9 styles), corrections B4 (ADR-0003).
- Auto-rename par rôles : domaine pur + adapter `guildMemberUpdate` (B6), config par serveur en
  Neon avec commande admin `/auto-rename`, cache, fallback fichier (B8, ADR-0005).
- API HTTP de supervision (`/health`, `/stats`), contrat monitoring, bootstrap API-d'abord.
- Dockerfile (gate typecheck/test au build), CI gate + CD gated (tailnet → Dokploy).
- `.env.production` chiffré (dotenvx), correctif PATH dotenvx.
- Commande `/update` : re-sync des slash-commands admin + diff des nouvelles commandes
  (dernier commit `main` : `bccd952`). Introduit le port `CommandSyncStore` (`src/command-sync/`),
  **pas encore reflété dans `ARCHITECTURE.md`**.

## Branches feature ouvertes + PR

| Branche | PR | Base | Contenu |
|---|---|---|---|
| `feat/v1-release` | [#20](https://github.com/BaptisteLeDev/ReNamioos/pull/20) → `main` | `main` | Prep release v2.0.0 (version, CHANGELOG), fix priorité auto-rename à la réédition, centralisation couleurs/embeds. |
| `fix/security-v1` | [#30](https://github.com/BaptisteLeDev/ReNamioos/pull/30) → `feat/v1-release` | `feat/v1-release` | Durcissement API (ADR-0006) : auth Bearer `/stats`, CORS allowlist, rate limit, borne `/convert` (#22 #23 #24). |
| `feat/website` | [#21](https://github.com/BaptisteLeDev/ReNamioos/pull/21) → `main` | `main` | Landing Astro consommant `@bdf/design` ; aperçus de styles générés depuis `styles.json`, build statique dans `website/`. |
| `bot-v1` (remote) | — | — | Branche de release antérieure (remote only). |

## Reste à faire / pistes

- Faire atterrir les PR de release : #30 (sécurité) dans #20 (v1-release), puis #20 dans `main`.
- Faire atterrir #21 (website) sur `main`.
- Mettre `ARCHITECTURE.md` à jour pour décrire le bounded context `command-sync` / commande `/update`.
- Remonter le durcissement API dans le **Template v2** (dette flotte, Discord-TemplateBot#15) au
  lieu de le garder local à ReNamioos.
- Retirer le fallback fichier transitoire de `CompositeMappingStore` une release après migration Neon.

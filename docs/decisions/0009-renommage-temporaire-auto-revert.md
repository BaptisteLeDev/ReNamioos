# ADR-0009 — Renommage temporaire / programmé avec auto-revert

- **Statut** : accepté · **Date** : 2026-06-13
- **Contexte amont** : issue #38 (label `enhancement`). Permettre `/rename ... duree:2h`
  (ou une date) : le pseudo se réverte automatiquement à l'échéance, p. ex. le temps d'un event.

## Contexte

Le round-trip d'auto-rename (#25, ADR-0004) mémorise déjà le pseudo source avant stylisation et le
restaure quand le membre perd son dernier rôle mappé. #38 ajoute un **second déclencheur** de
restauration : le **temps**. Plutôt qu'une table parallèle, on réutilise la persistance #25 en lui
ajoutant une échéance, conformément au mandat « provenance des données centralisée ».

## Décision

- **Domaine pur** (`src/domain/rename-temporaire.ts`) :
  - `parserEcheance(saisie, maintenant)` traduit `2h`/`30m`/`7j` ou une date ISO en epoch ms ;
    refuse format inconnu, durée nulle/négative, date passée, durée > plafond (1 an).
  - `estEchu(expiresAt, maintenant)` = `expiresAt <= maintenant` : la décision « reverter ? ».
- **Persistance réutilisée** (`src/original-nick/`, port `OriginalNickStore`) : colonne `expires_at`
  NULLABLE sur `auto_rename_original_nicks` (NULL = revert par rôle #25, inchangé). `rememberIfAbsent`
  prend un `expiresAt?` (idempotent : n'écrase ni le pseudo ni l'échéance). Nouvelle requête `listDue`
  (lignes échues, toutes guildes, via index partiel `where expires_at is not null`).
- **Commande** (`src/commands/rename.ts`) : `/rename` devient une fabrique recevant
  `OriginalNickStore` et expose une option `duree` optionnelle. Avec `duree` : on **mémorise le pseudo
  source AVANT de styliser** (avec l'échéance), on stylise ; si le rename échoue, on oublie l'échéance
  (rien à reverter). Sans `duree` : renommage permanent classique (aucune échéance).
- **Job de balayage** (`src/jobs/`) : `balayerEcheances` (orchestrateur pur, port `restaurer` injecté)
  lit `listDue(now)`, restaure via `restaurerPseudo` (flux partagé #25/`/rename`), puis `forget` en cas
  de succès. `demarrerBalayagePeriodique` (adapter Discord + `setInterval` 1 min) est branché au boot
  après login et arrêté au graceful shutdown.

## Invariants préservés

- **`getStats` synchrone** et **contrat `/stats`** inchangés (le job ne touche pas aux métriques).
- **Schéma Neon cohérent** : `expires_at` ajouté en NULLABLE (rétro-compatible avec les lignes #25
  existantes) + index partiel ; PK `(guild_id, member_id)` inchangée.
- **Domaine pur** : aucune dépendance discord.js dans `domain/` ni `sweep-temporaire.ts` (ACL, ADR-0002).
- **Anti-duplication** : une seule voie d'écriture de pseudo (`restaurerPseudo`/`appliquerRename`) ;
  une seule provenance du pseudo d'origine + échéance.

## Conséquences

- DDL à provisionner sur Neon : `alter table auto_rename_original_nicks add column expires_at timestamptz;`
  + l'index partiel (cf. `src/db/schema.ts`). Comme les autres tables, aucune migration générée depuis ce repo.
- Granularité de revert = intervalle de balayage (1 min) : suffisant pour des durées en heures/jours.
- Échéances bornées à 1 an (anti-saisie absurde) ; au-delà, refus propre côté commande.

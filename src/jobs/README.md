# Jobs périodiques — balayage des renommages temporaires (bounded context)

> **Responsabilité unique** : exécuter périodiquement les tâches de fond, à commencer par le
> **balayage des renommages temporaires échus** (issue
> [#38](https://github.com/BaptisteLeDev/ReNamioos/issues/38)) : restaurer les pseudos dont
> l'échéance est passée. La **décision** « faut-il reverter maintenant » reste pure (domaine) ;
> ce contexte n'est qu'un **orchestrateur** entre le store de provenance et Discord.

## Langage ubiquitaire

| Terme | Définition |
|---|---|
| **Renommage temporaire** | Un `/rename ... duree:2h` : le pseudo se réverte automatiquement à l'échéance. |
| **Échéance** (`expiresAt`) | Date d'auto-revert (epoch ms), portée par la ligne du pseudo d'origine (#25/#38). |
| **Balayage** (`sweep`) | Passage périodique qui restaure toutes les lignes dues (`expiresAt <= maintenant`). |
| **Ligne due** | Ligne dont l'échéance est passée — à restaurer puis oublier. |
| **Restauration conservée** | En cas d'échec (membre parti, permission), la ligne **n'est pas** oubliée : retentée au prochain passage. |

## API publique

```ts
// sweep-temporaire.ts — orchestrateur PUR (testable sans Discord)
balayerEcheances(deps: {
  store: OriginalNickStore;
  restaurer: (e: EcheanceARestaurer) => Promise<{ ok: true } | { ok: false; message: string }>;
  maintenant?: () => number;
}): Promise<void>;

// index.ts — composition + adapter Discord
creerRestaurerDiscord(client): (e) => Promise<...>;      // résout le membre, repose le pseudo
demarrerBalayagePeriodique({ client, store, intervalleMs? }): () => void; // renvoie l'arrêt (clearInterval)
```

## Fichiers et responsabilités

| Fichier | Rôle |
|---|---|
| `sweep-temporaire.ts` | **Orchestrateur pur** : lit `store.listDue(now)`, appelle `restaurer` (port injecté), `forget` en cas de succès. Aucun import discord.js. |
| `index.ts` | **Composition** : adapter Discord (`creerRestaurerDiscord` via `restaurerPseudo`) + minuteur `setInterval` (`demarrerBalayagePeriodique`). |

## Provenance des données

Aucune provenance propre : le job **consomme** `OriginalNickStore` (`src/original-nick/`), provenance
unique du pseudo d'origine et de son échéance (#25/#38). Il ne lit jamais la table en direct.

## Invariants

- **Décision pure** : « échue ? » = `expiresAt <= maintenant` (`estEchu`, `src/domain/rename-temporaire.ts`),
  appliquée par `listDue`. Le job ne décide rien lui-même.
- **Anti-duplication** : la restauration passe par `restaurerPseudo` (`src/commands/styliser.ts`), même
  chemin que le round-trip par rôle (#25) et `/rename` — pas de second code d'écriture de pseudo.
- **Jamais de perte silencieuse** : un échec/exception sur une ligne est tracé en `warn` structuré et la
  ligne est **conservée** (retentée) ; une erreur sur une ligne n'interrompt pas les suivantes.
- **N'impacte pas le chemin chaud** : le balayage est périodique (1 min par défaut) et `listDue` s'appuie
  sur l'index partiel `expires_at` (les lignes #25 sans échéance sont ignorées).

## Tests

`sweep-temporaire.test.ts` couvre l'orchestration sur un store mémoire et un `restaurer` factice :
restauration + oubli des dues, conservation sur échec, no-op sans due, robustesse inter-lignes. La
décision pure est testée dans `src/domain/rename-temporaire.test.ts`. L'adapter Discord (`index.ts`)
est couvert par le typecheck et l'exécution réelle.

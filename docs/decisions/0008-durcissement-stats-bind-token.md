# ADR-0008 — Durcissement /stats : bind loopback, token ≥ 32 octets, comparaison constante

- **Statut** : accepté · **Date** : 2026-06-13
- **Contexte amont** : audit défensif 2026-06-12, issue #37 (label `security`). Complète
  ADR-0006 (qui avait introduit le gate Bearer, le CORS allowlist et le rate limit) en
  fermant les angles morts restants de la couche HTTP.

## Contexte

ADR-0006 rendait `STATS_TOKEN` **optionnel** et gardait `HOST=0.0.0.0` par défaut. Trois
faiblesses subsistaient :

1. **SEC-001 (haute, CWE-306/200)** — bind `0.0.0.0` par défaut + token optionnel : en prod,
   `/stats` pouvait être exposé au réseau sans aucune auth (le monitor scrape sans Bearer si
   le token n'est pas configuré). La sécurité reposait sur une convention de déploiement, pas
   sur le code.
2. **SEC-003 (basse)** — `STATS_TOKEN` sans longueur minimale : un token court (brute-forçable)
   était accepté.
3. **SEC-004 (basse, CWE-208)** — `tokenValide` (`src/api/server.ts`) court-circuitait sur une
   différence de longueur avant `timingSafeEqual`, ce qui fuite la longueur du secret par timing.

## Décision

- **Défaut loopback.** `HOST` défaut = `127.0.0.1` (`src/config.ts`). L'API n'est plus exposée
  hors machine par défaut.
- **Token requis hors loopback.** Si `HOST` n'est pas loopback (`127.0.0.0/8`, `::1`, `localhost`),
  `STATS_TOKEN` devient **obligatoire** et le boot **échoue fort** s'il manque (`loadConfig`
  lève, `superRefine` Zod). Détection centralisée dans `estLoopback(host)`.
- **Longueur minimale.** `STATS_TOKEN` : `z.string().min(32)` (SEC-003), appliqué que le bind
  soit loopback ou non (cohérence : un token configuré doit toujours être robuste).
- **Comparaison constante hash-puis-compare.** `tokenValide` ne court-circuite plus sur la
  longueur : longueurs égales → `timingSafeEqual` direct ; longueurs différentes → SHA-256 des
  deux côtés puis `timingSafeEqual` sur les digests (même taille). Pattern repris de
  `monitoring/src/infrastructure/http/action-auth.ts` (`tokensMatch`) — un seul pattern d'auth
  par token dans la flotte (anti-duplication).

## Invariants préservés

- `/health` reste **toujours** public (contrat `bdf-monitor` : preuve de vie indépendante de l'auth).
- Le contrat `/stats` (noms de champs) et l'invariant `getStats` **synchrone** sont inchangés.
- Rétro-compat dev : sur loopback, `STATS_TOKEN` reste optionnel → `/stats` ouvert en local.

## Conséquences

- Déploiement prod : pour exposer `/stats` (bind non-loopback), il FAUT fournir un `STATS_TOKEN`
  ≥ 32 octets, sinon le bot refuse de démarrer. Documenté dans `README.md`.
- Le même pattern hash-puis-compare existe dans `bdf-monitor` ; à terme, candidat à extraction
  dans un module partagé de la flotte si une 3ᵉ occurrence apparaît (règle de 3).

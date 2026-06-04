# tests/ — Harnais de caractérisation ReNamioos

Ces tests **pinnent le comportement actuel** de la logique pure de `bot.py`
(conversion de texte stylisé) en mémoire, sans Discord ni I/O réseau. Ils
constituent le **filet de sécurité** de la future réécriture en Bun/TypeScript
(voir `decisions/0001-langage-cible-reecriture.md`) : la nouvelle implémentation
devra reproduire ces sorties à l'identique.

> Ce sont des tests de **caractérisation**, pas de spécification : ils décrivent
> ce qui **EST**, y compris les bugs. Aucun bug n'est corrigé. Les comportements
> surprenants sont annotés `COMPORTEMENT PINNE` et catalogués dans
> [`docs/caracterisation.md`](../docs/caracterisation.md).

## Lancer

Pré-requis : Python 3.10+ et `pytest`.

```bash
pip install -r requirements-dev.txt
pytest            # depuis la racine du repo
```

Sur Windows, forcer l'UTF-8 si la console capture mal les glyphes :

```powershell
$env:PYTHONUTF8 = '1'; pytest
```

## Technique d'import (sans démarrer le bot)

Importer `bot.py` déclenche des effets de bord au niveau module : `keep_alive()`
(serveur Flask), `import discord`, `commands.Bot(...)`, et les décorateurs
`@bot.tree.command`. On NE MODIFIE PAS `bot.py`.

`conftest.py` injecte des **modules factices** (stubs) dans `sys.modules` AVANT
l'import via `importlib` : `keep_alive`, `dotenv` et tout l'arbre `discord`
(`Intents`, `Color`, `Embed`, `Bot.tree.command`, etc.). `bot.run(TOKEN)` n'étant
appelé que sous `if __name__ == "__main__"`, aucune connexion réseau n'a lieu.
`charger_styles()` / `charger_roles()` s'exécutent réellement (cwd positionné sur
la racine du repo) — c'est le comportement de chargement qu'on veut pinner.

Helper exposé : `conftest.load_bot_module()` renvoie le module importé, d'où l'on
lit `convertir_texte`, `nettoyer_pseudo`, `convertir_chiffres`,
`mettre_majuscule_debut`, `STYLES`, `CONVERSIONS`, `ROLE_CONFIG`.

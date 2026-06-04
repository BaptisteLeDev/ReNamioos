"""
Harnais d'import des fonctions pures de bot.py SANS demarrer le bot.

PROBLEME : importer bot.py declenche des effets de bord au niveau module :
  - ligne 8  : keep_alive()  -> demarre un serveur Flask dans un thread
  - ligne 22 : import discord, discord.ext.commands, discord.app_commands
  - ligne 25 : from dotenv import load_dotenv
  - ligne 64-65 : discord.Intents.all() + commands.Bot(...)
  - les decorateurs @bot.tree.command(...) s'executent a l'import

CONTRAINTE : on NE MODIFIE PAS bot.py (lecture seule, harnais de
caracterisation pour la future reecriture Bun/TS).

TECHNIQUE : on injecte des modules factices (stubs) dans sys.modules AVANT
d'importer bot.py via importlib. Les stubs fournissent juste assez d'API pour
que le code de niveau module s'execute sans I/O reseau ni connexion Discord :
  - keep_alive.keep_alive   -> no-op
  - dotenv.load_dotenv      -> no-op
  - discord.*               -> objets factices (Intents, Color, Embed, Member,
    Interaction, Forbidden, LoginFailure...) et un Bot dont .tree.command et
    .event renvoient un decorateur identite, .latency est un float.

bot.run(TOKEN) n'est appele que dans main() sous le garde __name__ == "__main__",
donc il ne s'execute jamais a l'import : aucune connexion reseau.

Le chargement reel de styles.json / role.json (charger_styles / charger_roles)
s'execute pour de vrai a l'import (lignes 59-60), avec le cwd positionne sur la
racine du repo : c'est justement le comportement qu'on veut pinner.
"""

import importlib.util
import os
import sys
import types
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BOT_PATH = REPO_ROOT / "bot.py"


def _make_stub_modules():
    """Construit les stubs minimaux pour neutraliser les effets de bord."""

    # --- keep_alive ---
    keep_alive_stub = types.ModuleType("keep_alive")
    keep_alive_stub.keep_alive = lambda *a, **k: None

    # --- dotenv ---
    dotenv_stub = types.ModuleType("dotenv")
    dotenv_stub.load_dotenv = lambda *a, **k: None

    # --- discord ---
    discord_stub = types.ModuleType("discord")

    def _identity_decorator(*a, **k):
        def _wrap(fn):
            return fn
        return _wrap

    class _Tree:
        def command(self, *a, **k):
            return _identity_decorator()

        def sync(self, *a, **k):
            return []

    class _Bot:
        def __init__(self, *a, **k):
            self.tree = _Tree()
            self.latency = 0.0
            self.user = None
            self.guilds = []

        def event(self, fn):
            return fn

        def run(self, *a, **k):
            raise AssertionError("bot.run ne doit jamais etre appele a l'import")

    class _Intents:
        @staticmethod
        def all():
            return _Intents()

    class _Color:
        @staticmethod
        def blue():
            return None

        @staticmethod
        def gold():
            return None

        @staticmethod
        def green():
            return None

        @staticmethod
        def purple():
            return None

    class _Embed:
        def __init__(self, *a, **k):
            pass

        def add_field(self, *a, **k):
            return self

        def set_footer(self, *a, **k):
            return self

    discord_stub.Intents = _Intents
    discord_stub.Color = _Color
    discord_stub.Embed = _Embed
    discord_stub.Member = type("Member", (), {})
    discord_stub.Interaction = type("Interaction", (), {})
    discord_stub.Forbidden = type("Forbidden", (Exception,), {})
    discord_stub.LoginFailure = type("LoginFailure", (Exception,), {})

    # discord.app_commands
    app_commands_stub = types.ModuleType("discord.app_commands")
    app_commands_stub.describe = _identity_decorator
    app_commands_stub.autocomplete = _identity_decorator
    app_commands_stub.Choice = type("Choice", (), {"__init__": lambda self, **k: None})
    discord_stub.app_commands = app_commands_stub

    # discord.ext + discord.ext.commands
    ext_stub = types.ModuleType("discord.ext")
    commands_stub = types.ModuleType("discord.ext.commands")
    commands_stub.Bot = _Bot
    ext_stub.commands = commands_stub
    discord_stub.ext = ext_stub

    return {
        "keep_alive": keep_alive_stub,
        "dotenv": dotenv_stub,
        "discord": discord_stub,
        "discord.app_commands": app_commands_stub,
        "discord.ext": ext_stub,
        "discord.ext.commands": commands_stub,
    }


def load_bot_module():
    """Importe bot.py avec les stubs et le cwd a la racine du repo.

    Le cwd doit etre la racine du repo car charger_styles()/charger_roles()
    ouvrent 'styles.json' / 'role.json' en chemin RELATIF (comportement pinne).
    """
    stubs = _make_stub_modules()
    saved_modules = {}
    for name, mod in stubs.items():
        saved_modules[name] = sys.modules.get(name)
        sys.modules[name] = mod

    prev_cwd = os.getcwd()
    os.chdir(REPO_ROOT)
    try:
        spec = importlib.util.spec_from_file_location("renamioos_bot", BOT_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        os.chdir(prev_cwd)
        for name, prev in saved_modules.items():
            if prev is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = prev


import pytest


@pytest.fixture(scope="session")
def bot_module():
    return load_bot_module()

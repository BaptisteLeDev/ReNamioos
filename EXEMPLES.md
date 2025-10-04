# Exemples d'utilisation de ReNamioos

## 🎯 Commandes de base

### Test de connexion
```
/ping
```

### Voir tous les styles
```
/styles
```

### Convertir du texte
```
/convert cursive Bonjour Discord
/convert gothique Bienvenue
/convert cercles VIP Member
```

## 👤 Renommage de membres

### Renommer avec un style spécifique
```
/rename @Membre cursive
/rename @Membre gothique NouveauNom
/rename @Membre cercles
```

### Renommer avec un style aléatoire
```
/random @Membre
/random @Membre CustomName
```

## 🎭 Configuration Auto-Rename

### Exemple de role.json
```json
{
    "cursive": ["🛸・Éclats d'Aether", "VIP"],
    "gothique": ["Modérateur"],
    "cercles": ["Admin"],
    "gras": ["Membre Premium"]
}
```

### Comportement
1. Membre obtient le rôle "VIP" → Pseudo en cursive
2. Membre perd le rôle "VIP" → Pseudo par défaut

## 🔧 Tests

### Tester l'auto-rename
1. Assigner un rôle configuré dans `role.json`
2. Vérifier que le pseudo change automatiquement
3. Retirer le rôle
4. Vérifier que le pseudo revient à la normale

### Vérifier les logs
```
📌 UserName a reçu le rôle : VIP
🎯 Rôle trouvé ! Application du style 'cursive'
✅ UserName renommé en 𝓤𝓼𝓮𝓻𝓝𝓪𝓶𝓮 (style: cursive)

📌 UserName a perdu le rôle : VIP
🔄 Rôle stylisé retiré ! Remise du pseudo par défaut
✅ UserName a retrouvé son pseudo par défaut
```

## 💡 Astuces

### Permissions nécessaires
- ✅ Manage Nicknames (obligatoire)
- ✅ Send Messages
- ✅ Embed Links

### Limitations Discord
- Maximum 32 caractères pour les pseudos
- Ne peut pas renommer le propriétaire du serveur
- Le rôle du bot doit être au-dessus du membre

### Styles recommandés
- **cursive** : Élégant et lisible
- **cercles** : Original et visible
- **gothique** : Style médiéval
- **gras** : Emphase forte

---
name: add-knowledge
description: Analyse un fichier .txt de contenu brut (règles, lore, PDF copié) et l'intègre dans la base de knowledge du projet
allowed_tools: Read, Glob, Grep, Write, Edit, Bash, TodoWrite
---

Tu es chargé d'intégrer du nouveau contenu dans la base de knowledge du projet Terres d'Arran.

## Étape 1 — Trouver le fichier source

Cherche un fichier `.txt` récemment ajouté ou modifié dans le répertoire racine du projet (ou demande à l'utilisateur quel fichier utiliser si aucun n'est évident).

```bash
ls -lt *.txt 2>/dev/null | head -5
```

Si aucun fichier `.txt` n'est trouvé, demande à l'utilisateur de préciser le chemin du fichier source avant de continuer.

## Étape 2 — Lire le contexte existant

Avant d'analyser le contenu source, lis :
- `knowledge/README.md` — index des fichiers existants
- `knowledge/topics/00-index.md` — index court pour LLM

Cela te permettra de décider si le contenu doit :
- **enrichir** un fichier existant (ajouter des sections manquantes ou corriger des lacunes)
- **créer** un nouveau fichier topic

## Étape 3 — Analyser le contenu source

Lis le fichier `.txt` source en entier. Identifie :

1. **Le sujet principal** : règles de jeu, lore, équipement, voies, races, etc.
2. **Le format** : extrait PDF, notes manuscrites, texte structuré
3. **Les lacunes à signaler** : passages flous, chiffres à vérifier, références croisées manquantes — marque-les avec ⚠️ *à vérifier dans le PDF*

## Étape 4 — Décider de la destination

En te basant sur l'index existant :

| Type de contenu | Fichier cible |
|---|---|
| Règles de création de personnage | `topics/creation-personnage.md` |
| Combat, manœuvres, états | `topics/combat.md` |
| Magie, PM, sorts | `topics/magie.md` |
| Lore historique, ères, événements | `topics/monde-lore-chroniques.md` |
| Lore elfes / Semi-Elfes | `topics/monde-lore-peuples-elfes.md` |
| Lore nains / humains | `topics/monde-lore-peuples-nains-humains.md` |
| Lore autres peuples | `topics/monde-lore-peuples-autres.md` |
| Races jouables, modificateurs, voies culturelles | `topics/races.md` |
| Voies de profil | `topics/voies-de-profil.md` |
| Voies de prestige | `topics/voies-de-prestige.md` |
| Équipement, monnaie, objets | `topics/equipement.md` |
| Nouveau sujet sans fichier existant | Créer `topics/<nom-slug>.md` |

Si le contenu touche plusieurs sujets, répartis-le dans les fichiers appropriés.

## Étape 5 — Écrire le knowledge

### Structure d'un fichier existant (enrichissement)
- Lis d'abord le fichier cible en entier
- Ajoute les nouvelles sections sans dupliquer l'existant
- Respecte le style : titres `##`, listes `-`, tableaux Markdown
- Marque les passages non vérifiés : ⚠️ *à vérifier dans le PDF*

### Structure d'un nouveau fichier
```markdown
---
source: tda-livre-joueur
version: "0.1"
last_reviewed: <date du jour>
---

# <Titre du sujet>

<Contenu structuré en sections ##, listes, et tableaux>
```

## Étape 6 — Mettre à jour les index

### `knowledge/topics/00-index.md`
Ajoute ou mets à jour l'entrée correspondante dans la liste des sujets.

### `knowledge/README.md`
Ajoute ou mets à jour la ligne dans la table "Topic index".

## Étape 7 — Rapport final

Une fois terminé, affiche un résumé :

```
✓ Contenu intégré dans : <fichiers modifiés ou créés>
⚠ Points à vérifier manuellement : <liste des passages douteux>
```

**Important** : ne supprime jamais de contenu existant sans confirmation de l'utilisateur. En cas de conflit entre l'ancien et le nouveau contenu, garde les deux avec une note de clarification.

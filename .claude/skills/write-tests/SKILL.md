---
name: write-tests
description: Analyse un fichier ou une zone de code et génère les unit tests Vitest correspondants
allowed_tools: Read, Glob, Grep, Write, Edit, Bash
---

Tu dois écrire des tests unitaires Vitest pour le code fourni ou le fichier actif dans l'IDE.

## Stack de test

- Framework : **Vitest** (`describe`, `it`, `expect`, `beforeEach`)
- Fichiers test : placés à côté du source — `foo.ts` → `foo.test.ts`
- Lancer : `npm test -w client` ou `npm test -w server`
- Pas de `@testing-library`, pas de mocks réseau sauf si absolument nécessaire

## Processus

1. **Lis le fichier source** en entier. Identifie toutes les fonctions/computeds exportés.
2. **Classe chaque export** :
   - Fonction pure → test direct, aucun setup
   - Computed Vue (dépend de `character` ou autre ref globale) → `beforeEach` pour reset avec `createDefaultCharacter()`
   - Fonction avec effets de bord (localStorage, API, sessions Map) → setup/teardown minimal
3. **Pour chaque unité logique**, écris :
   - Le cas nominal (happy path)
   - Les cas limites (valeurs nulles, 0, min/max, tableaux vides)
   - Les cas d'erreur si la fonction peut échouer
4. **Utilise des données réelles** quand disponibles (IDs de voies, IDs d'armures) plutôt que des mocks — les tests restent honnêtes.
5. **Nomme les tests en français** (comme le reste du projet) avec le format : `'résultat attendu dans telle condition'`
6. **Evite les apostrophes typographiques** (`'`) dans les labels `it()` — utilise des guillemets doubles `"..."` si le label en contient.
7. Lance les tests après écriture et corrige jusqu'à ce qu'ils passent tous.

## Structure type

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { maFonction } from './monfichier'

describe('maFonction', () => {
  it('cas nominal', () => { ... })
  it('valeur limite basse', () => { ... })
  it('valeur limite haute', () => { ... })
})
```

## Règles

- Ne teste pas l'UI (templates Vue, événements DOM) — seulement la logique pure
- Ne mocke pas la DB ou le réseau sauf si le fichier en dépend directement
- Un `it()` = une assertion principale (les assertions supplémentaires sont ok si elles testent la même chose)
- Si un test révèle un bug ou une incohérence dans le code source, signale-le à l'utilisateur avant de corriger le test

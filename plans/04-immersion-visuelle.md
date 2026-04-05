# Plan 04 — Immersion Visuelle

Trois features pour rendre l'app plus vivante et immersive : fiche de perso réactive, dé 3D animé, et portraits génératifs IA.

---

## Feature A — Le Grimoire Vivant (fiche contextuelle)

### Concept

La fiche de personnage change visuellement selon l'état du perso : HP bas → teinte sanglante, PM épuisés → encre pâle, tour actif en combat → lueur dorée. Le joueur **ressent** l'état de son personnage sans lire un chiffre.

### Effets visuels

| Condition | Effet | Seuil |
|---|---|---|
| HP < 50% | Vignette rouge subtile sur la fiche, teinte rosée sur le fond | `hp / hpMax < 0.5` |
| HP < 25% | Vignette rouge intense + léger pulse (animation CSS) | `hp / hpMax < 0.25` |
| HP = 0 | Fiche en niveaux de gris, overlay "À terre" | `hp === 0` |
| PM = 0 | Les cartes de voies/sorts deviennent pâles (opacity réduite) | `pm === 0` |
| PM < 25% | Encre des sorts légèrement délavée | `pm / pmMax < 0.25` |
| Tour actif (combat) | Bordure dorée pulsante sur la fiche entière | `isActiveInCombat` |
| Critique récent | Flash doré bref (1-2s) | Après un nat 20 |
| Fumble récent | Tremblement bref (shake animation) | Après un nat 1 |

### Implémentation

#### CSS

Ajouter des classes conditionnelles sur le conteneur principal de `CharacterSheetView.vue` :

```css
.sheet--wounded       /* HP < 50% — vignette rouge via box-shadow inset */
.sheet--critical      /* HP < 25% — vignette + pulse animation */
.sheet--down          /* HP = 0 — grayscale filter */
.sheet--mana-low      /* PM < 25% — opacity sur les cartes de sorts */
.sheet--mana-empty    /* PM = 0 — opacity + teinte grise sur cartes de sorts */
.sheet--active-turn   /* Tour actif — bordure dorée pulsante */
.sheet--crit-flash    /* Critique récent — flash doré 1.5s */
.sheet--fumble-shake  /* Fumble récent — shake 0.5s */
```

Utiliser les CSS custom properties existantes (`--danger`, `--brand`) et en ajouter :

```css
--wounded-glow: rgba(201, 95, 86, 0.3);   /* basé sur la couleur HP */
--active-glow: rgba(200, 156, 58, 0.5);    /* basé sur la couleur PC/or */
--mana-fade: 0.4;                           /* opacity pour PM vide */
```

#### Composable `useSheetEffects`

Nouveau composable `client/src/composables/useSheetEffects.ts` :

- **Input** : `character` ref, `combatState` ref optionnel (tour actif, dernier jet)
- **Output** : `sheetClasses` computed qui retourne les classes CSS à appliquer
- Calcule les ratios HP/PM à partir des données du personnage
- Gère les effets temporaires (crit flash, fumble shake) avec des timers

#### Intégration

- `CharacterSheetView.vue` : ajouter `:class="sheetClasses"` sur le conteneur principal
- `VoiesCard.vue` / cartes de sorts : réagir à `.sheet--mana-low` / `.sheet--mana-empty` via CSS parent
- Les effets combat (tour actif, crit/fumble) nécessitent un lien avec le système de combat actif (plan 03)

### Prérequis

- Le tracking HP/PM courant doit être en place (actuellement seul le max est calculé, pas le courant — à vérifier)
- Pour les effets combat : le système de combat actif (plan 03) doit exposer l'état du tour

---

## Feature B — Le Dé Cosmique (dé 3D animé)

### Concept

Un d20 3D en CSS/JS qu'on peut lancer depuis n'importe où dans l'app. Il roule avec une animation physique, s'arrête sur le bon chiffre, et réagit aux résultats extrêmes : explosion dorée sur un 20, flammes sur un 1.

### Composants

#### `DiceTray.vue` — Le conteneur du dé

- **Position** : Bouton flottant en bas à droite (FAB), ouvre un overlay/drawer avec le dé
- **Interaction** : Tap/click pour lancer, ou swipe vers le haut (mobile)
- **Choix du dé** : d4, d6, d8, d10, d12, d20 (sélecteur compact, d20 par défaut)
- **Modificateur** : champ optionnel pour ajouter un bonus (+FOR, +ATK, etc.)
- **Résultat** : Affichage du total après l'animation

#### `Dice3D.vue` — Le dé lui-même

- **Rendu** : CSS 3D transforms (cube/icosaèdre simplifié) ou canvas 2D avec illusion 3D
- **Animation** : 
  - Lancer : rotation rapide aléatoire (1-1.5s)
  - Rebond : easing avec rebond (cubic-bezier ou spring)
  - Arrêt : face finale avec le résultat
- **Option réaliste** : Utiliser une lib légère comme `dice-box` (three.js) si le poids est acceptable, sinon CSS pure

#### Effets spéciaux

| Résultat | Effet |
|---|---|
| 20 naturel | Explosion de particules dorées + son "epic" + texte "CRITIQUE !" |
| 1 naturel | Flammes + tremblement + son "fail" + texte "FUMBLE !" |
| Résultat élevé (15+) | Léger éclat lumineux |
| Résultat bas (5-) | Teinte sombre momentanée |

Les particules peuvent être faites en CSS (`@keyframes` avec pseudo-éléments) ou avec un canvas overlay léger.

#### Sons (optionnel)

- Bruit de dé qui roule (court, 0.5s)
- Impact selon résultat
- Stockage : fichiers audio courts dans `client/public/sfx/`
- Respect du mute/volume utilisateur

### Intégration avec le système existant

- Utiliser `rollDie()` de `client/src/utils/dice.ts` pour le résultat réel
- Alimenter `useRollHistory` pour que le jet apparaisse dans l'historique
- Le dé cosmique est un **affichage** — il ne remplace pas les jets intégrés aux actions de combat
- Option : les jets de combat existants peuvent déclencher l'animation du dé cosmique en arrière-plan

### Structure fichiers

```
client/src/components/
├── dice/
│   ├── DiceTray.vue       # FAB + overlay contenant le dé
│   ├── Dice3D.vue         # Le dé animé (CSS 3D ou canvas)
│   └── DiceEffects.vue    # Particules, flammes, texte critique
```

---

## Feature C — Portraits Vivants (avatars génératifs IA)

### Concept

Générer des portraits fantasy pour les personnages joueurs et les monstres via une API d'image IA. Le joueur clique "Générer mon portrait" et obtient une illustration stylisée basée sur sa race, ses voies et son profil.

### UX Flow — Personnage joueur

1. Sur `IdentityCard.vue`, à côté du bouton upload existant, ajouter un bouton "Générer ✨"
2. Click → modal de prévisualisation avec :
   - Prompt auto-généré à partir des infos du perso (race, profil, voies, niveau)
   - Champ texte pour que le joueur ajoute des détails ("cicatrice sur l'oeil gauche", "cape rouge")
   - Bouton "Générer" → loading → image affichée
   - Boutons "Accepter" (sauvegarde comme portrait) / "Régénérer" / "Annuler"
3. Le portrait accepté remplace le portrait actuel (même système d'upload existant)

### UX Flow — Monstres (futur, dépend du plan 02/03)

- Dans l'éditeur de rencontre, chaque monstre sans image a un bouton "Générer portrait"
- Le prompt utilise le nom et la description du monstre
- Le portrait s'affiche dans la timeline de combat

### API & Prompt Engineering

#### Endpoint serveur

```
POST /api/images/generate
Body: { prompt: string, characterId?: string }
Response: { imageUrl: string } ou { imageBase64: string }
```

#### Construction du prompt

Le serveur construit le prompt à partir des données du personnage :

```
Portrait fantasy d'un(e) [race] [profil], niveau [N].
Voies : [liste des voies actives].
Style : illustration fantasy médiévale, portrait buste, fond neutre sombre,
        style peinture à l'huile, couleurs riches.
[Détails additionnels du joueur]
```

#### Provider d'images

Options (par ordre de recommandation) :

1. **Together AI** — API simple, modèle FLUX, ~0.01$/image, bonne qualité fantasy
2. **Stability AI** — SDXL, bonne qualité, pricing par crédit
3. **Gemini Imagen** — Si on reste dans l'écosystème Google (déjà utilisé pour le chat)

Configuration via variable d'env : `IMAGE_PROVIDER`, `IMAGE_API_KEY`.

#### Limites et coûts

- Rate limiting : max 3 générations par personnage par jour (éviter l'abus)
- Cache : sauvegarder l'image générée comme portrait normal (réutilise le système existant)
- Le prompt exact et le seed sont stockés pour pouvoir régénérer des variantes

### Structure fichiers

```
client/src/components/character-sheet/
└── PortraitGenerator.vue    # Modal de génération avec preview

server/src/
└── images/
    └── generate.ts          # Service de génération d'image IA
```

### DB

Pas de nouveau schéma nécessaire — le portrait généré est sauvegardé via le système d'upload existant (`portraitImageId`). On peut ajouter un champ optionnel pour stocker le prompt utilisé :

```sql
ALTER TABLE characters ADD COLUMN portrait_prompt text;
```

---

## Ordre d'implémentation suggéré

1. **Le Grimoire Vivant** (Feature A) — pas de dépendance externe, CSS pur, impact visuel immédiat
2. **Le Dé Cosmique** (Feature B) — standalone, fun instantané, utilise le code dice existant
3. **Portraits Vivants** (Feature C) — nécessite une API externe et du budget, plus complexe

---

## Statut

EN ATTENTE

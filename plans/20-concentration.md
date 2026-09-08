# 20 — Concentration des mages (lot E du plan 19)

## La règle (`knowledge/topics/magie.md:41-51`)

Quand un mystique lance un sort, il peut **se concentrer** : le sort coûte une
**action limitée** au lieu d'une action d'attaque, et il choisit **un** bonus :

| Mode | Effet |
|---|---|
| Économe | −2 PM (minimum 0) |
| Étendue | durée **ou** portée ×2 |
| Puissante | chaque dé monte d'une catégorie : d4 → d6 → d8 → d10 → d12 (d12 plafonne) |

Interdits :
- les **talents magiques** (Flamme, Projectile de force…) — jamais de concentration ;
- **Sous tension** (magie élémentaliste) — jamais de concentration ;
- les sorts des **voies de prestige** — pas de mode économe (les deux autres OK).

## État du code aujourd'hui

- `ActionsView.vue:442-490` `rollAction` : débite les PM au rang du sort, puis
  brûlure de magie (×2 pour les combattants). Tout est enfoui dans la vue,
  rien n'est paramétrable, rien n'est testé.
- Le type d'action est deviné par regex sur la description (`:67-72`).
- **Un sort sans jet d'attaque n'a pas de bouton** (`:980` — le bouton n'existe
  que si `attackType`). Peau d'écorce, Sommeil, Brumes, Armure de terre… ne
  débitent donc jamais de PM. Pré-existant, mais la concentration n'a aucun
  sens si on ne peut pas « lancer » ces sorts. On le règle dans ce lot.
- Les dés de DM des sorts ne sont pas lancés : ils sont dans la description
  (`"[2d6+Mod.INT] DM"`). Pas de jet de dégâts à faire évoluer, seulement le
  texte affiché.
- `dice.ts` n'a pas d'échelle de dés.

## Proposition

### 1. Logique pure — `client/src/utils/concentration.ts`

```ts
export type ConcentrationMode = 'aucune' | 'econome' | 'etendue' | 'puissante'

/** Coût en PM d'un sort de ce rang, selon le mode. */
export function concentratedPmCost(rank: number, mode: ConcentrationMode): number
// econome → max(0, rank − 2) ; sinon rank

/** "d6" → "d8", d12 reste d12, d20 intouché (c'est un dé de test, pas de DM). */
export function upgradeDie(sides: number): number

/** Monte tous les dés d4..d10 d'une notation ou d'un texte : "[2d6+Mod.INT]" → "[2d8+Mod.INT]". */
export function upgradeDiceInText(text: string): string

/** Un sort peut-il se concentrer, et avec quels modes ? */
export function allowedModes(action: { pmCost: number | null; name: string; voieFamily?: VoieFamily }): ConcentrationMode[]
// pmCost null (talent magique, non-sort) → []
// 'Sous tension' → []
// prestige → sans 'econome'
```

Tests `concentration.test.ts` :
- `concentratedPmCost(1,'econome') === 0`, `(4,'econome') === 2`, `(4,'puissante') === 4`
- `upgradeDie(4) === 6`, `(10) === 12`, `(12) === 12`, `(20) === 20`
- `upgradeDiceInText('[2d6+Mod.INT] DM') === '[2d8+Mod.INT] DM'`, `'2d20'` inchangé, `'1d12'` inchangé
- `allowedModes` : talent → `[]`, Sous tension → `[]`, prestige → sans économe, mystique → les 3

### 2. Débit des PM — `client/src/composables/useSpellCast.ts`

Sortir de `rollAction` le bloc PM + brûlure de magie :

```ts
export function useSpellCast(character, profileFamily) {
  /** Débite les PM (brûlure de magie si insuffisant). Retourne ce qui a été payé. */
  function payPm(cost: number): { pm: number; hpBurned: number }
  return { payPm }
}
```

Tests `useSpellCast.test.ts` : PM suffisants ; PM insuffisants ×1 (mystique) ;
×2 (combattant) ; coût 0 ne touche à rien ; PV ne descendent pas sous 0.

### 3. Vue — `ActionsView.vue`

**a. Un état par carte** : `concentration[key]: ConcentrationMode`, défaut
`'aucune'`. Après un lancer, la carte **revient à « aucune »** : c'est un choix
par incantation, pas un réglage permanent.

**b. Le sélecteur** : nouveau composant partagé `AppToggleGroup` (reka-ui
`ToggleGroup`, 40 px, icônes Lucide, un seul actif). Il n'existe pas dans le
catalogue et c'est un pattern qui reviendra (mode de jet, arme en main…).
À ajouter au catalogue CLAUDE.md et à `/component-library`.

Sur la carte, juste au-dessus du footer, 4 boutons icône :

| Mode | Icône Lucide | Titre |
|---|---|---|
| aucune | `Zap` | Sort normal |
| économe | `Coins` | Économe : −2 PM |
| étendue | `Expand` | Étendue : portée ou durée ×2 |
| puissante | `Flame` | Puissante : dés +1 |

Le sélecteur n'apparaît que si `allowedModes(action).length > 0`. Les modes
interdits (économe sur prestige) sont simplement absents.

**c. Ce qui change sur la carte quand un mode est choisi** :
- badge d'action : `attaque` → `limitée` ;
- badge PM : `PM:4` → `PM:2` (économe) ;
- puissante : la description s'affiche avec les dés montés (`[2d8+Mod.INT]`) ;
- étendue : une ligne courte sous la description « Portée ou durée doublée » ;
- une petite ligne de rappel « Concentration : économe » pour que le joueur
  sache pourquoi les badges ont bougé.

**d. Lancer un sort sans jet d'attaque** : bouton « Lancer le sort » (icône
`Sparkles`) sur toute carte avec `pmCost != null` et sans `attackType`. Il
paie les PM et écrit dans le log (`kind: 'action'`, sans dé). Plus de
« Aucun jet d'attaque » sans rien derrière.

**e. Le log** : le libellé porte le mode : `Foudre — concentration : puissante`.
Ça remonte tel quel chez le MJ via le flux de campagne.

### 4. Données à corriger au passage

Boule de feu est en `2d6` dans `voies.ts:342`, `4d6` dans
`voies-de-profil.md:200` (déjà noté au lot D). À corriger ici si D ne l'a pas
fait, sinon rien.

### 5. E2E — `e2e/specs/05-jets.spec.ts`

Orlane (Magicien, 14/20 PM dans le seed) reçoit dans le seed
`voie-de-la-magie-elementaliste` rang 4. Sur `/actions` :
1. carte Boule de feu → `data-testid="concentration-econome"` → badge PM
   passe de 4 à 2, badge action passe à « limitée » ;
2. « Lancer les dés » → la ressource PM (`data-testid="pm-current"`) passe
   de 14 à 12, le sélecteur est revenu sur « aucune » ;
3. `concentration-puissante` → la description contient `2d8` (ou `4d8` si la
   donnée est corrigée).

## Fichiers touchés

| Fichier | Quoi |
|---|---|
| `client/src/utils/concentration.ts` (+ test) | nouveau |
| `client/src/composables/useSpellCast.ts` (+ test) | nouveau, extrait de la vue |
| `client/src/components/ui/AppToggleGroup.vue` | nouveau composant partagé |
| `client/src/views/ComponentLibraryView.vue` | vitrine du composant |
| `client/src/views/ActionsView.vue` | sélecteur, badges, bouton « Lancer le sort », log |
| `client/src/data/voies.ts` | Boule de feu 4d6 si pas déjà fait |
| `server/src/dev/seed.ts` | Orlane : voie élémentaliste rang 4 |
| `e2e/specs/05-jets.spec.ts` | scénario ci-dessus |
| `CLAUDE.md` | `AppToggleGroup` au catalogue |

## Décisions prises (dis-moi si tu veux autre chose)

1. **Reset après le lancer** — le mode revient à « aucune » à chaque sort.
2. **d12 plafonne**, d20 jamais touché.
3. **Étendue** ne calcule rien : le joueur choisit portée ou durée à la table,
   l'app affiche juste le rappel.
4. **Les sorts sans jet reçoivent un bouton** — sinon économe est inutile sur
   la moitié des sorts.
5. Pas de vérification « action limitée déjà utilisée ce tour » : l'app ne
   suit pas l'économie d'actions, on ne commence pas ici.

## Vu au passage

- Les sorts des **voies de prestige** n'ont pas de `pmCost` du tout
  (`ActionsView.vue:155` ne marque que `family === 'mystiques'`). Ils sont
  donc gratuits dans l'app. Hors lot → ticket.
- La détection « sort » repose sur la famille de la voie, pas sur
  l'astérisque des règles. Un jour il faudra un flag `spell: true` par
  capacité dans `voies.ts`. Hors lot → ticket.

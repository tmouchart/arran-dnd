# 20 — Style de dé personnalisable

## But

Aujourd'hui un joueur choisit **une** couleur de dé parmi 8 pastilles, et il ne
voit le résultat qu'au jet suivant. On veut :

- fond **et** encre réglables,
- des **dégradés**, pas seulement des aplats,
- une **police** au choix pour les chiffres,
- des **presets** prêts à l'emploi,
- un **aperçu en temps réel** : le dé tourne dans les options et se met à jour à
  chaque changement,
- un **color picker** complet en tapant sur une couleur.

## L'existant, en une carte

| Où | Quoi |
|---|---|
| `server/src/db/schema.ts` | `users.diceColor` — `varchar(7)`, nullable |
| `server/src/campaigns/diceColors.ts` | palette de 8, `isDiceColor`, `defaultDiceColor(rang)`, `resolveDiceColor` |
| `server/src/campaigns/diceColorQuery.ts` | `effectiveDiceColor(userId, campaignId)` |
| `server/src/routes/auth.ts` | `GET /me`, `PATCH /me` renvoient la couleur effective |
| `server/src/routes/campaigns.ts:710` | le jet diffusé aux autres porte `diceColor` |
| `client/src/data/diceColors.ts` | copie de la palette + `inkFor()` (encre auto par luminance) |
| `client/src/utils/dice3d/atlas.ts` | `buildAtlas(labels, fitRatio, { face, ink })` — remplit chaque case du canvas |
| `client/src/components/dice3d/Dice3DOverlay.vue` | `meshFor(die, color)`, cache `sides:kind:color` |
| `client/src/views/OptionsView.vue` | la section « Couleur de dé » (8 pastilles) |

Une seule chaîne `color: string` circule de bout en bout. C'est elle qu'on
remplace.

## Modèle de données

Nouveau type partagé, **une copie serveur et une copie client** (comme la
palette actuelle — la règle « les deux doivent rester identiques » reste) :

```ts
export interface DiceStyle {
  bg:
    | { type: 'solid'; from: string }
    // `angle` en degrés, convention CSS : 0 = vers le haut, 180 = vers le bas
    | { type: 'gradient'; from: string; to: string; angle: number }
  /** null = encre automatique (inkFor sur la dominante) — le comportement actuel. */
  ink: string | null
  /** Slug de police pour les chiffres. null = celle du thème. */
  font: string | null
}
```

Choix assumés :

- **`ink: null` par défaut.** Un joueur qui ne touche à rien garde exactement le
  rendu d'aujourd'hui.
- **Deux arrêts de gradient max.** Trois stops, c'est un éditeur de gradient à
  construire pour un dé de 4 cm sur un téléphone. Non.
- **Pas de texture ni de métal.** Hors périmètre, à reparler plus tard.
- **Les polices sont une liste fermée**, pas une chaîne libre : on ne propose
  que celles déjà chargées par `index.html`, et le serveur ne valide qu'un slug.

### Migration

`server/src/db/migrations/1700000000XXX_user_dice_style.sql` :

```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "dice_style" jsonb;

UPDATE "user"
   SET "dice_style" = jsonb_build_object(
         'bg', jsonb_build_object('type', 'solid', 'from', "dice_color"),
         'ink', NULL)
 WHERE "dice_color" IS NOT NULL AND "dice_style" IS NULL;
```

On **garde** `dice_color` : c'est la source des styles convertis et le repli si
on doit revenir en arrière. On le laissera mourir dans une migration ultérieure,
une fois la feature en prod depuis quelques semaines.

`npm run db:migrate` juste après création (règle CLAUDE.md).

### Défauts par rang

`defaultDiceColor(rang)` devient `defaultDiceStyle(rang)` et renvoie un
`DiceStyle` solide, à partir de la même palette de 8. Rien ne change pour un
joueur qui n'a jamais rien réglé.

## Serveur

1. **`server/src/campaigns/diceStyle.ts`** (nouveau)
   - `parseDiceStyle(unknown): DiceStyle | null` — validation stricte : hex
     `#rrggbb`, `angle` entier 0–359, `type` dans la liste. Tout ce qui ne colle
     pas → `null` → 400.
   - `defaultDiceStyle(memberIndex)`, `resolveDiceStyle(stored, memberIndex)`.
   - `diceStyle.test.ts` : hex invalide, angle hors bornes, objet vide, gradient
     sans `to`, style stocké legacy (`{bg:{type:'solid'…}}`), rang > 8.
2. **`diceColorQuery.ts`** → `effectiveDiceStyle(userId, campaignId)`, même
   logique de rang (le MJ non-membre passe après tous les membres).
3. **`routes/auth.ts`** : `PATCH /me` accepte `diceStyle`, valide, stocke.
   `GET /me` et `PATCH /me` renvoient `diceStyle`.
   → on renvoie **aussi** `diceColor` (le `from` du fond) pendant une version,
   pour qu'un client pas encore rechargé continue de marcher.
4. **`routes/campaigns.ts:710`** : le payload du jet porte `diceStyle` en plus
   de `diceColor`.

## Client — rendu du dé

### `atlas.ts` : peindre le fond

`buildAtlas` prend un `DiceStyle` au lieu de `{ face, ink }`. Une seule fonction
change, `paintCell(ctx, cell, style)` :

- `solid` → `fillRect` (identique à aujourd'hui) ;
- `gradient` → `createLinearGradient` dont les deux points sont calculés depuis
  l'angle, **case par case**.

⚠️ **Point important, à valider visuellement** : le dégradé est appliqué *par
face*, pas sur le corps entier du dé. L'atlas est un damier de faces dépliées ;
un gradient étalé sur tout le canvas donnerait des sauts de teinte incohérents
d'une face à l'autre. Chaque face porte donc le même dégradé — ça se lit comme
un dé « bicolore » propre. Un vrai dégradé sur le volume demanderait des couleurs
par sommet ou un shader : hors périmètre, à rouvrir si le rendu déçoit.

L'encre : `style.ink ?? inkFor(dominante)`, où la dominante d'un gradient est la
moyenne des deux couleurs — sinon un fond clair→sombre reçoit une encre illisible
sur une moitié.

### `Dice3DOverlay.vue`

- `meshFor(die, style?)`, clé de cache `sides:kind:<hash du style>`
  (`JSON.stringify` suffit, les styles sont minuscules).
- Le champ `Show.color` (flash du critique, couleur de l'étiquette) devient la
  couleur dominante du style — un helper `dominantColor(style)` partagé.
- **Purge du cache** : un joueur qui bricole son style dans les options crée un
  atlas + une géométrie par variante essayée. On plafonne à ~12 entrées, LRU,
  `dispose()` sur l'évincée. Aujourd'hui il y avait 8 valeurs possibles, donc le
  problème n'existait pas.

### `useDice3D.ts` / `useCampaignRolls.ts`

`color: string` → `style: DiceStyle`. Repli si le serveur n'envoie que l'ancien
`diceColor` : on le convertit en style solide à la réception.

## Client — l'écran de réglage

### Un composant à part

`OptionsView.vue` fait déjà 875 lignes. Toute la feature part dans
`client/src/components/options/DiceStyleCard.vue`, et `OptionsView` ne garde
qu'une ligne d'appel.

### Structure

```
┌─────────────────────────────────┐
│         [ dé 3D qui tourne ]    │  ← aperçu temps réel
│                                 │
│  Presets                        │
│  ● ● ● ● ● ● ● ●   (scroll H)   │
│                                 │
│  Fond      [◧ dégradé]          │  ← toggle aplat / dégradé
│   ▮ #d64545   ▮ #7a1f1f   45°   │  ← 2e pastille + angle si dégradé
│  Encre     [auto]               │  ← toggle auto / manuel
│   ▮ #fdf3e6                     │
└─────────────────────────────────┘
```

- Presets : bande horizontale scrollable, chaque pastille peinte avec son propre
  dégradé en CSS. Taper dessus applique le style complet et sauvegarde.
- Le toggle « dégradé » et le toggle « encre auto » : `AppTabs` à deux entrées.
- L'angle : un `<input type="range">` 0–359 par pas de 15°, seulement en mode
  dégradé.
- Taper une pastille → ouvre le picker (ci-dessous).

### L'aperçu temps réel

Un vrai d20 three.js dans la carte, ~110 px, rotation lente et continue.

- Nouveau `client/src/components/dice3d/DicePreview.vue` : son propre renderer,
  sa propre scène, une seule mesh, `IntersectionObserver` pour ne tourner que
  visible et `onBeforeUnmount` pour tout libérer.
- Pour ne pas dupliquer le code de construction, on extrait de
  `Dice3DOverlay.vue` un `client/src/utils/dice3d/mesh.ts` avec
  `buildDieMesh(three, die, style)` (géométrie + atlas + liseré). L'overlay et
  l'aperçu l'appellent tous les deux. **Chacun garde son cache** — l'aperçu jette
  le sien à chaque changement, l'overlay garde le sien.
- Reconstruction **debounce 120 ms** : sinon un drag dans le picker rebâtit un
  canvas par frame.
- Si WebGL casse (`broken`), repli sur une simple pastille CSS ronde avec un
  « 20 » dedans. L'écran de réglage ne doit jamais planter.

### Le color picker

Un `AppBottomSheet` (mobile-first, c'est la règle du projet) contenant :

1. un `<input type="color">` plein largeur — le picker natif de l'OS, complet et
   gratuit, cohérent avec le choix déjà fait pour `AppSelect` ;
2. un `AppInput` hexadécimal, pour coller une valeur exacte ;
3. une rangée « couleurs de la palette » — les 8 tons historiques, un raccourci.

Le dé de l'aperçu se met à jour pendant qu'on manipule le picker (l'input natif
émet en continu). Validation à la fermeture de la feuille.

> Alternative écartée : un picker maison (canvas saturation/valeur + slider de
> teinte). Plus joli dans le thème, mais ~200 lignes et une gestion tactile à
> écrire. Si l'input natif déçoit sur Android, on rouvre.

### Sauvegarde

`PATCH /me { diceStyle }` **débouncé à 500 ms** après le dernier changement, plus
un flush immédiat à la fermeture du picker. Optimiste : l'UI ne montre jamais de
spinner, un échec affiche un toast et remet l'ancien style.

### Garde-fou lisibilité

Si l'encre choisie a un contraste < 3:1 avec la dominante du fond, on affiche
sous l'aperçu : « Les chiffres risquent d'être illisibles. » Un avertissement,
pas un blocage — c'est son dé.

## Presets

8 entrées, `client/src/data/dicePresets.ts` (client seulement — le serveur n'a
pas besoin de les connaître, il stocke le style résolu) :

| Nom | Fond | Encre |
|---|---|---|
| Rubis | `#d64545` uni | auto |
| Braise | `#f0a13a` → `#b02a1f`, 160° | `#2a1206` |
| Améthyste | `#a06fe8` → `#4a1f8a`, 150° | auto |
| Océan | `#4fc3d9` → `#123a7a`, 170° | auto |
| Poison | `#9be86f` → `#1c5c2a`, 155° | `#0d2410` |
| Or ancien | `#f3d489` → `#9a6b1c`, 160° | `#241a0d` |
| Onyx | `#4a4f57` → `#14171b`, 165° | `#e8e2d4` |
| Parchemin | `#fdf3e6` uni | `#241a0d` |

Les 8 pastilles historiques restent accessibles dans le picker : personne ne
perd sa couleur.

## La police des chiffres

`client/src/data/diceFonts.ts` liste sept polices, toutes déjà chargées par
`index.html` — on n'ajoute aucune requête de font :

| Slug | Nom affiché | Police |
|---|---|---|
| — | Celle du thème | `--title-font` (défaut) |
| `metamorphous` | Grimoire | Metamorphous |
| `uncial` | Onciale | Uncial Antiqua |
| `cinzel` | Gravé | Cinzel Decorative |
| `pirata` | Gothique | Pirata One |
| `cormorant` | Élégante | Cormorant Garamond |
| `lora` | Classique | Lora |
| `moderne` | Moderne | `system-ui` |

⚠️ **Piège** : une police que le thème courant n'affiche nulle part n'est pas
téléchargée. Peindre l'atlas sans l'attendre sort un dé en serif, et rien ne le
recalcule. `buildDieMesh` fait donc `await ensureDiceFont(style.font)` — un
`document.fonts.load()` — avant `buildAtlas`.

Un `AppSelect` natif dans la carte : c'est le même arbitrage que partout
ailleurs, le sélecteur de l'OS bat une liste maison sur téléphone.

## Tests

**Unitaires (Vitest)**
- `server/src/campaigns/diceStyle.test.ts` — validation, défauts par rang,
  résolution, conversion depuis un `dice_color` legacy.
- `client/src/data/diceStyle.test.ts` — `dominantColor`, `inkFor` sur un
  gradient, garde-fou de contraste.
- `client/src/utils/dice3d/atlas.test.ts` — l'atlas d'un gradient et celui d'un
  aplat diffèrent ; le fond d'un aplat n'a pas bougé (non-régression).

**E2E** — `e2e/specs/dice-style.spec.ts` : ouvrir les options, choisir un preset
dégradé, recharger, il est toujours là. Testids obligatoires :
`dice-preset-<slug>`, `dice-bg-from`, `dice-bg-to`, `dice-ink`,
`dice-picker-hex`.

## Découpage

| # | Lot | Vérification |
|---|---|---|
| 1 | Migration + `diceStyle.ts` serveur + routes | tests serveur verts, `GET /me` renvoie un `diceStyle` |
| 2 | `atlas.ts` gradient + `mesh.ts` extrait + overlay migré | un jet en dev sort le dé actuel, à l'identique |
| 3 | `DicePreview.vue` | un d20 tourne dans les options |
| 4 | `DiceStyleCard.vue` : presets, toggles, sauvegarde | un preset choisi ressort au jet suivant |
| 5 | Bottom sheet color picker | une couleur libre tient après reload |
| 6 | Cache LRU, garde-fou contraste, e2e | `npm run e2e` vert |

Les lots 1 et 2 sont indépendants et livrables sans rien casser : à la fin du 2,
l'app se comporte exactement comme avant.

## Ce qu'on ne fait pas

- Trois arrêts de gradient ou plus.
- Textures, motifs, effets métal/nacré.
- Un dégradé sur le volume du dé (voir la mise en garde plus haut).
- Un style de dé par personnage — c'est un réglage de joueur, pas de fiche.

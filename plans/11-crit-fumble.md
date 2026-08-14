# Plan 11 — Réussites et échecs critiques bien visibles

## L'idée

Un 20 doit se voir de loin. Un 1 aussi. Aujourd'hui les deux existent dans le
code mais se lisent à peine : un liseré de 2 px et un total coloré.

Trois endroits à traiter, dans cet ordre :

1. **Le dé 3D** — étoiles dorées sur un critique, éclat rouge sur un 1.
2. **Le log de campagne** (`RollLogPanel`) — étoile dorée / tête de mort rouge.
3. **L'historique local** (`RollHistoryPanel`) — les mêmes marques.

## D'abord : une seule règle, pas deux

La règle est écrite **deux fois** aujourd'hui, sur deux types différents :

| Où | Fonction | Type |
|---|---|---|
| `composables/useRollHistory.ts` | `rollHighlight()` | `RollEntry` (jets locaux) |
| `components/roll-log/RollLogPanel.vue` | `highlight()` | `RollEvent` (jets campagne) |

Même logique, copiée. Si on ajoute le dé 3D dessus, ça fera **trois** copies —
et le jour où la règle bouge, le dé pétillera sur un jet que le log affiche en
gris.

Première étape, avant tout effet : extraire la règle dans
`utils/rollOutcome.ts`, sur un type minimal `{ kind, die, sides, damage? }` que
les deux formes satisfont déjà. Les tests existants de `rollHighlight` migrent
tels quels.

## La règle, corrigée

L'ancienne règle disait « un jet libre ne critique jamais ». C'est une règle
d'affichage que rien ne justifie : quand on lance un d20 pour le plaisir, voir
des étoiles **est** le plaisir. Elle saute.

La nouvelle règle tient en une phrase : **seul le d20 compte, et le d12 quand il
remplace le d20.**

| Dé | Contexte | 20 / max | 1 |
|---|---|---|---|
| d20 | n'importe lequel, bac à sable compris | critique | échec |
| d12 | jet d'attaque (affaibli) | critique | échec |
| d12 | bac à sable, dégâts | rien | rien |
| d4/d6/d8/d10/d100 | n'importe lequel | rien | rien |

Un maximum sur un d6 n'est pas un exploit : il arrive une fois sur six.

En code, dans `utils/rollOutcome.ts` :

```ts
/** Le dé compte-t-il ? Le d20 toujours ; le d12 seulement quand il
 *  remplace le d20, donc jamais sur un jet libre. */
export function isGradedDie(sides: number, kind: RollKind): boolean {
  return sides === 20 || (sides === 12 && kind !== 'libre')
}
```

Un `damage.critical` / `damage.fumble` explicite continue de l'emporter.

Deux détails qui tombent bien :

- Dans le bac à sable, un lancer multiple (`3d20`) enregistre `die: 0`. Il ne
  déclenchera donc rien, ce qui est le bon comportement : une poignée de dés
  n'est pas un critique.
- Le d100 a `sides: 100`, il sort de lui-même.

## 1. Le dé 3D

L'effet se déclenche à l'atterrissage, au moment exact où le chiffre se révèle.
Il y a 1,1 s d'affichage avant le fondu : la place est là.

### Faire remonter l'information

`DieRoll` gagne un champ optionnel :

```ts
export interface DieRoll {
  sides: number
  value: number
  /** false pour les jets libres, qui ne critiquent jamais. */
  graded?: boolean
}
```

Le raccourci `dice()` prend un paramètre de plus, `graded = true`. Un seul site
d'appel change vraiment — le bac à sable passe `false`. La main faible du combat
à deux armes aussi, elle qui n'a jamais de critique.

L'overlay calcule alors, par dé : `graded && value === sides` → critique,
`graded && value === 1` → échec.

### Critique — les étoiles

- La face flashe : `emissive` doré, montée en 120 ms puis retour en 400 ms.
- Gerbe d'environ 40 étoiles depuis le dé, projetées vers l'extérieur avec un
  biais vers le haut, retombant en 900 ms.
- Un seul `THREE.Points`, mélange additif, texture d'étoile à 4 branches dessinée
  au canvas (même fabrique que l'atlas des chiffres). Un seul appel de rendu.

### Échec — le rouge

Pas des étoiles rouges : ça se lirait comme une variante du critique. On inverse
le mouvement.

- La face flashe rouge (`--danger`), plus sourdement et plus longtemps.
- Une onde circulaire rouge s'écarte du dé et s'efface en 600 ms — un simple
  anneau face caméra, pas de particules.
- Le dé s'enfonce de quelques pixels en se posant, au lieu du petit rebond
  habituel.

### Ce qui reste vrai

- Toujours aucun assombrissement de l'écran.
- Le tap continue de tout couper, effet compris.
- Rien de tout ça ne touche au résultat : c'est de la décoration par-dessus une
  face déjà décidée.

## 2. Et 3. Le log et l'historique

Même traitement dans les deux listes, pour qu'un jet ait la même tête partout.

- **20** : le total passe en doré, avec une `Star` (Lucide) collée devant.
- **1** : le total passe en rouge, avec une `Skull` (Lucide) devant. `Skull` est
  déjà utilisée par `AgonieModal`, on reste cohérent.
- Le fond de la ligne se teinte un peu plus qu'aujourd'hui, et le liseré gauche
  s'épaissit.

Au passage, ces lignes-là violent la règle des tokens : elles codent en dur
`#d4ac0d`, `#c95f56`, `#c8950a`, `#c9a227`. On les remplace par `--brand` et
`--danger` pendant qu'on y est — c'est exactement le code qu'on modifie.

## Découpage

1. **Extraire la règle** dans `utils/rollOutcome.ts`, brancher les deux
   consommateurs existants. → vérif : les tests de `rollHighlight` passent depuis
   leur nouveau fichier, aucun changement visuel.
2. **Log + historique** : étoile, tête de mort, tokens. → vérif : forcer un 20 et
   un 1 dans le log, les deux marques apparaissent ; les jets libres restent
   neutres.
3. **Le dé — critique** : flash doré + gerbe d'étoiles. → vérif : un 20 pétille,
   un 19 non, un 20 en jet libre non.
4. **Le dé — échec** : flash rouge + onde. → vérif : un 1 rougit, un 1 en jet
   libre non.
5. **Test unitaire** de la simulation des particules (position dans le temps,
   pure et déterministe) et de la règle par dé dans l'overlay.

## Une question ouverte

**Un 20 dans le bac à sable doit-il pétiller ?**

La règle actuelle dit non : un jet libre n'est pas un jet d'attaque, un 20 n'y
veut rien dire mécaniquement. Le plan suit cette règle.

Mais on peut trouver que c'est dommage — quand on lance un d20 pour le plaisir,
voir des étoiles est précisément le plaisir. Si tu préfères, les effets du dé 3D
peuvent ignorer `graded` et pétiller sur n'importe quel maximum, tout en laissant
le log neutre. À trancher avant l'étape 3.

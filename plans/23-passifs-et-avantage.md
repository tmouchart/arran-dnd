# 23 — Passifs de caractéristique et avantage aux dés

Remplace le **Lot D** de `plans/19-retours-session.md`, qui n'a jamais été
implémenté. Deux chantiers liés : les passifs qui montent une caractéristique,
et les capacités qui font lancer deux dés.

---

## 1. Le recensement

### 1.1 Passifs qui montent une caractéristique

**Voies de profil** — 8 capacités de rang 5, toutes `active: false` :

| Capacité | Voie (`id`) | `voies.ts` | Effet |
|---|---|---|---|
| Force héroïque | `voie-du-pugilat` | `:123` | +2 FOR, avantage FOR |
| Dextérité héroïque | `voie-de-lacrobatie` | `:149` | +2 DEX, avantage DEX |
| Constitution héroïque | `voie-de-la-bravoure` | `:39` | +2 CON, avantage CON |
| Intelligence héroïque | `voie-de-la-magie-elementaliste` | `:343` | +2 INT, avantage INT |
| Sagesse héroïque | `voie-des-arts-druidiques` | `:283` | +2 SAG, avantage SAG |
| Charisme héroïque | `voie-du-charme` | `:209` | +2 CHA, avantage CHA |
| Perception héroïque | `voie-de-la-chasse` | `:221` | **+2 SAG**, avantage SAG |
| Hyperconscience | `voie-de-la-divination` | `:295` | +2 SAG **et** +2 INT, avantage sur les deux |

Attention : « Perception héroïque » monte la SAG, pas une carac « Perception »
(`voies-de-profil.md:130`). C'est bien le même effet que Sagesse héroïque.

**Voies de peuple** — 20 capacités de rang 5 dans `peuples.ts` donnent
+2 / +2 (Parangon elfe bleu, Colosse, Maître artisan, Volonté héroïque…).
Même mécanique, **aucun avantage aux dés**. **Incluses dans ce lot** : il n'y a
que des lignes de données à taguer, la logique est déjà là.

Trois cas particuliers à taguer dans `peuples.ts` : Immortalité (`:27`, +2 CON),
Ténacité naine (`:53`, +2 SAG) — des capacités `active: true` dont seul le bonus
de carac est passif — et tous les « Parangon » (`:83` à `:281`).

Attention à ne pas confondre avec `racialAbilityMods.ts` : ceux-là sont les
atouts de race, appliqués **une fois** à la création dans la modale
d'initialisation. Ils n'ont rien à voir avec les capacités de voie.

### 1.2 Capacités qui font lancer deux d20

Quatre familles, à traiter différemment.

**A — Avantage permanent, automatique** (les 8 du tableau ci-dessus).
Sur tous les tests de la caractéristique. Rien à cliquer.

**B — Avantage ponctuel sur une action précise** — le joueur clique la carte,
l'avantage s'applique à ce jet-là. **Inclus dans ce lot.**

| Capacité | Voie (`id`), rang | `voies.ts` | Règle |
|---|---|---|---|
| Attaque parfaite (L) | `voie-de-la-maitrise-des-armes`, 4 | `:110` | 2d20 au contact, +1d6 DM |
| Flèche de mort (L) | `voie-de-larcherie`, 4 | `:172` | 2d20 en attaque, DM doublés |
| Charge (L) | `voie-du-combat-monte`, 4 | `:62` | 2d20 en attaque, +1d6 DM |

Note : « Attaque parfaite » est marquée `active: false` dans les données alors
que la règle la donne en action limitée (`voies-de-profil.md:66`). À corriger
dans le même lot.

**C — Relances manuelles. Hors périmètre, et par principe.** Une relance est un
choix du joueur : il voit son dé, il décide de dépenser sa ressource. Rien
là-dedans ne doit se déclencher tout seul, jamais — ni proposition automatique,
ni relance appliquée d'office parce que le jet est raté.

| Capacité | Fichier | Règle |
|---|---|---|
| Point de chance | déjà implémenté (`ActionsView.vue:554`) | relance ou +10 |
| Rune d'énergie | `voies.ts:~205` | relance 1 d20 / combat |
| Gri-gri | `voies.ts:569` | relance 1 d20 dans les 12 h |
| Duel mental | `voies.ts:501` | relance un dé d'attaque ou de DM |
| Exemplaire | `voies.ts:73` | fait relancer **un allié** |
| Flèche magique | `voies.ts:473` | relance un 1 au dé de DM |

Seul le point de chance est implémenté aujourd'hui, et il est déjà déclenché par
un bouton — ça reste comme ça. La seule chose qu'il gagne dans ce lot est
l'affichage : il **efface** l'ancien dé (`ActionsView.vue:561-565`) au lieu de
le barrer. Une fois le modèle en place, l'ancien dé devient un dé écarté et
reste visible. C'est de l'affichage, pas de l'automatisation.

Les cinq autres ne sont pas implémentées et ne le seront pas ici. Le jour où
elles le seront, ce sera un bouton par capacité, et elles retomberont sur le
même objet visuel.

**D — Désavantage** : Malédiction (`voies.ts:376`) impose 2d20 garde le pire à
sa cible, et annule un avantage existant. Hors périmètre v1 (c'est un état posé
sur un autre personnage, il n'y a pas de modèle d'états aujourd'hui).

**Le bestiaire** : Charge et Imparable donnent 2d20 à des dizaines de monstres
(`bestiaire.md`). Les attaques de monstre du MJ (`CombatView.vue:258`) sont
mono-dé. Hors périmètre v1, mais le modèle proposé les couvrira sans
retouche.

### 1.3 Qui est concerné en prod (relevé du 10 sept. 2026)

18 personnages, une seule campagne (« Arran »). Croisement des voies débloquées
avec les capacités ci-dessus :

| Perso | Joueur | Ce qui change |
|---|---|---|
| **Minizou** (niv. 5) | Thomas | Élémentaliste rang 5 → **Intelligence héroïque**. INT 16 → 18, mod +3 → +4, attaque magique +1. **Le seul vrai joueur impacté.** |
| test2 (niv. 6) | compte de test | Élémentaliste rang 5, caracs à 10. Sans enjeu. |
| Macalan Ontherock | marc_sch | Combat à deux armes rang 5 — sa capacité de rang 5 ne touche ni les caracs ni les dés. Aucun impact. |

Personne d'autre n'a de voie au rang 4 ou 5 parmi les voies porteuses. Les
suivants sont **à trois rangs** de leur passif : Grimm Brewhop (pugilat 3),
Hyl'Ogas (charme 3), Polo (arts druidiques 3), Thrazik (maîtrise des armes 3 et
archerie 3 — il débloquera Attaque parfaite **et** Flèche de mort au rang 4).

Aucune voie de peuple ni culturelle ne dépasse le rang 2 en prod : les
23 capacités de peuple ne changeront **rien** pour personne aujourd'hui. On les
code quand même — c'est la même ligne de données — mais elles ne portent aucun
risque de régression.

**Le point à vérifier avec le joueur** : Minizou a INT 16. Est-ce son score de
base, ou a-t-il déjà ajouté le +2 à la main ? Il n'y a pas d'historique de
révisions sur les personnages en prod (la table `revision` est vide), donc
impossible de trancher depuis la base. Si le +2 est déjà dedans, la mise en
service le compterait deux fois et il faudrait redescendre son score à 14. À
demander avant de déployer — c'est un seul joueur, une seule question.

---

## 2. Le modèle

Un seul concept traverse tout le code : **un jet peut avoir des dés écartés**.
Avantage, désavantage et relance en sont trois cas.

```ts
// utils/dice.ts
export interface KeptRoll {
  kept: number        // le dé qui compte
  dropped: number[]   // les dés lancés puis écartés
}
export function rollKeep(sides: number, count = 1, keep: 'high' | 'low' = 'high'): KeptRoll
```

Partout où un jet est stocké ou transmis, `die` reste **le dé gardé** (donc
crit / fumble / total ne changent pas de source) et un champ `dropped` optionnel
porte les écartés. Absent = comportement actuel, aucune régression.

### 2.1 Effets structurés sur les capacités

```ts
// data/voies.ts
export type AbilityKey = keyof CharacterAbilities

export type CapaciteEffect =
  /** +2 en INT — passif permanent */
  | { kind: 'ability'; ability: AbilityKey; bonus: number }
  /** 2d20 sur tous les tests de cette carac — passif permanent */
  | { kind: 'advantage'; on: AbilityKey }
  /** 2d20 sur le jet de cette action précise, quand on clique sa carte */
  | { kind: 'attackAdvantage' }

export interface Capacite {
  name: string
  description: string
  active?: boolean
  effects?: CapaciteEffect[]   // ← nouveau
}
```

Intelligence héroïque devient :

```ts
{
  name: 'Intelligence héroïque',
  description: "+2 en INT. Lance 2d20 à tous les tests d'INT et garde le meilleur.",
  active: false,
  effects: [
    { kind: 'ability', ability: 'intelligence', bonus: 2 },
    { kind: 'advantage', on: 'intelligence' },
  ],
}
```

`attackAdvantage` se pose sur les trois capacités de la famille B.
`voieActions` (`ActionsView.vue:217`) construit déjà chaque action en bouclant
sur la `Capacite` : il suffit d'y recopier le drapeau dans l'objet `Action`, et
`rollAction` le lit. Pas de liste de noms en dur dans la vue.

Conséquence : Attaque parfaite doit passer à `active: true`, sinon le filtre
`path.rank > ci && cap.active` (`:223`) continue de la cacher et elle n'a aucune
carte à cliquer.

On ne type **que** ce que le moteur sait appliquer. Les autres passifs
(Robustesse +3 PV, Armure naturelle +2 DEF, Intelligence du combat…) restent du
texte pur : ils viendront quand on en aura besoin, pas avant.

### 2.2 Le composable

`composables/usePathEffects.ts` — une fonction pure plus un computed.

```ts
export interface PathEffects {
  abilityBonus: Partial<Record<AbilityKey, number>>
  advantage: Set<AbilityKey>
  /** Qui donne quoi, pour l'infobulle de la fiche. */
  sources: { ability: AbilityKey; bonus: number; from: string }[]
}
export function pathEffects(paths: PathRow[]): PathEffects
```

Reprend la détection déjà écrite dans `PassifsCard.vue:16-32`
(`p.rank > index && cap.active === false`), en lisant `VOIES_BY_ID` **et**
`PEUPLE_VOIES_BY_ID`. Deux voies qui donnent +2 SAG cumulent à +4 : c'est la
règle, deux capacités distinctes s'additionnent.

### 2.3 Un seul point de branchement

C'est ici que le lot 0 paie. Après lui, les formules dérivées vivent en un seul
endroit (`utils/characterStats.ts`) et lisent les caracs par une seule
fonction :

```ts
export function effectiveAbilities(c: Character): CharacterAbilities
```

= scores de base + `pathEffects(c.paths).abilityBonus`. Toutes les formules
(PV, PM, DEF, initiative, PC, les trois bonus d'attaque) l'appellent au lieu de
lire `c.abilities` directement. **Une ligne à changer par formule, et le +2
arrive partout à la fois** — fiche du joueur, vue MJ, actions, combat.

Restent trois lectures directes hors des formules, dans `ActionsView.vue` :
`rollAbility:572`, `rollCompetence:614` et le mod de DM d'arme `:450`. Elles
passent aussi par `effectiveAbilities`.

`character.abilities` garde son rôle : le score de base, édité par les ± et
persisté. Le +2 n'est jamais écrit — sinon il serait recompté à chaque
chargement.

Effet de bord attendu et voulu : un perso avec Constitution héroïque voit ses
PV max monter (le watch `computedHp` pousse la nouvelle valeur au serveur).

---

## 3. La fiche de personnage

`AbilitiesCard.vue` affiche aujourd'hui `15 (+2)` : score puis modificateur.
**Décision : on affiche le score effectif**, avec une marque qui dit qu'un
passif y contribue, et le détail au tap.

```
   INT              SAG
┌─────────────┐  ┌─────────────┐
│ 17• (+3)   ▲│  │ 17• (+3)   ▲│
│            ▼│  │            ▼│
└─────────────┘  └─────────────┘
```

- `17` est le score effectif (15 de base + 2), dans une couleur spéciale
  (`--accent-strong`) quand un passif y contribue — le chiffre change de
  couleur, ce qui se voit d'un coup d'œil sur toute la grille.
- `•` est la marque cliquable. Au tap, une infobulle : « 15 de base +2
  Intelligence héroïque ». Elle vient de `pathEffects().sources`, donc elle
  nomme la capacité, pas juste le chiffre. Deux sources sur la même carac →
  deux lignes.
- Le modificateur `(+3)` est calculé sur le score effectif. C'est le correctif
  de fond : aujourd'hui un joueur qui tape 17 à la main voit le bon mod mais
  son score de base est corrompu en base.
- Une carac qui a l'avantage porte en plus une petite icône de dé (Lucide
  `Dices`), même infobulle.

**Levée de l'ambiguïté des ±** : ils éditent toujours le score **de base**.
Le chiffre affiché bouge quand même de 1 par clic (17 → 18), donc le geste
reste lisible ; l'infobulle montre la décomposition exacte. La marque `•` est
le signal qu'il ne faut pas « rattraper » le +2 à la main.

À ne pas oublier : `AbilityInitModal.vue` (la modale d'initialisation) édite
les scores de base — elle ne doit surtout pas repartir du score effectif,
sinon le +2 se grave dans la base.

`PassifsCard.vue` reste tel quel : les capacités s'y affichent déjà.

---

## 4. Les dés

### 4.1 Le lancer

Un helper unique remplace le patron `rollDie` + `revealAfterDice(dice(...))`
répété 8 fois dans `ActionsView.vue` (`:447`, `:532`, `:561`, `:575`, `:593`,
`:617`, plus `CombatView.vue:260` et `AgonieModal.vue:37`) :

```ts
const roll = rollKeep(sides, advantage ? 2 : 1)   // { kept, dropped }
revealAfterDice(diceWithDropped(sides, roll), () => { … })
```

`rollAbility` demande l'avantage à `pathEffects`. `rollCompetence` fait pareil
via `comp.ability`. Les actions de la famille B passent l'avantage en dur.

**Ce qui ne doit pas casser** : l'attaque magique ajoute le Mod. INT mais n'est
**pas** un test d'INT — pas d'avantage dessus. Même chose pour les manœuvres
et les attaques d'arme. La règle ne donne l'avantage qu'aux *tests de
caractéristique*.

### 4.2 L'animation 3D

`utils/dice3d/plan.ts` :

```ts
export interface DieRoll {
  sides: number
  value: number
  kind?: string
  dropped?: boolean   // ← nouveau
}
```

- `planDice` force `outcome: null` sur un dé écarté. **Important** : un 1 sur le
  dé jeté ne doit pas déclencher l'échec critique ni la fanfare, et un 20 écarté
  ne doit pas faire pétiller l'écran (`Dice3DOverlay.vue:527`).
- `Dice3DOverlay.vue` : le dé écarté roule normalement, puis à l'atterrissage
  passe à ~65 % d'échelle et se désature. Le dé gardé garde sa taille.
  L'animation de vol est déjà multi-dés (le combat à deux armes lance un d20 et
  un d12 ensemble, `ActionsView.vue:489`) — rien à inventer côté physique.
- L'étiquette du résultat (`show.result`, `:359`) est aujourd'hui une chaîne
  `"17 · 4"`. Elle devient une liste `{ value, dropped }[]` pour barrer le
  perdant en HTML (`:661`).

Cela vaut pour les trois contextes de rendu, qui partagent le même code :
mes dés, les dés distants (bande du haut) et le mode table.

### 4.3 Le transport — à quoi sert la colonne `dropped`

Un jet ne vit pas que sur le téléphone qui l'a lancé. Il part au serveur
(`postCampaignRoll`), est rangé dans la table `roll_event`, rediffusé en direct
aux autres joueurs par SSE, **et rechargé depuis la base** à chaque ouverture
ou reconnexion (`fetchCampaignRolls`). C'est ce qui fait rouler mon dé sur la
tablette au milieu de la table.

Or la ligne stockée ne contient aujourd'hui qu'un seul chiffre : `die`. Si je
lance 2d20 et garde 17, les autres ne reçoivent que 17. Deux conséquences :

- sur la tablette, un seul dé roule là où le lanceur en voit deux ;
- après un rafraîchissement, même mon propre historique a perdu le dé écarté.

D'où la colonne. **`rolls` = les dés qui comptent, `dropped` = ceux qui ont été
lancés puis jetés.**

On ne peut pas réutiliser la colonne `rolls` existante : elle veut dire « des
dés qui s'additionnent » (le bac à sable y range un 3d6, affiché
`3d6 = 4+2+5`). Y glisser un dé écarté afficherait un total faux dans les deux
panneaux de log.

- Migration `server/src/db/migrations/…_roll_event_dropped.sql` :
  `ALTER TABLE roll_event ADD COLUMN dropped jsonb;` puis `npm run db:migrate`
  tout de suite.
- `schema.ts:257`, `RollInput` / `RollEvent` (`api/campaigns.ts:185`),
  la route POST (`server/src/routes/campaigns.ts`).
- `remoteDiceFor` (`useCampaignRolls.ts:83`) ajoute les écartés avec
  `dropped: true`.

Le champ est facultatif partout : les jets déjà en base restent lisibles,
`dropped` vaut `null` et rien ne change pour eux.

### 4.4 L'affichage des chiffres

Le motif `(d20 = 14 +3)` est écrit **huit fois** dans le template
d'`ActionsView.vue` (`:794`, `:878`, `:978`, `:1012`, `:1028`, `:1121`,
`:1192`, plus le bloc agonie). Impossible d'y ajouter le dé barré sans le
sortir. Un composant :

```vue
<RollDetail :sides="r.attackSides" :die="r.attackDie"
            :dropped="r.attackDropped" :bonus="r.attackBonus" />
```
→ rend `(d20 = 17 4̶ +3)`, le dé écarté en `--muted` avec
`text-decoration: line-through`.

Les autres surfaces :

| Surface | Fichier | Ce qu'il faut |
|---|---|---|
| Log de campagne | `roll-log/RollLogPanel.vue:73` | `detail()` ajoute les écartés barrés |
| Historique local | `RollHistoryPanel.vue:103` | idem, ligne compacte |
| Fil du mode table | `useViewerFeed.ts:33` | ne montre que le total — on ajoute une petite marque « avantage », pas le détail |
| Bac à sable | `DiceSandbox.vue` | rien : ses dés multiples comptent tous |

---

## 5. Zéro duplication — le lot 0

Ce lot ne peut pas être « posé à côté » du code existant : les formules qu'il
doit modifier sont recopiées à la main un peu partout. Brancher le +2 sur du
code dupliqué, c'est le brancher une fois sur deux — et créer un écart entre
ce que voit le joueur et ce que voit le MJ.

Donc on dédouble **d'abord**, on branche ensuite. Inventaire mesuré :

| Duplication | Où | Combien | Traitement |
|---|---|---|---|
| Les 13 formules dérivées (PV, PM, DEF, init, PC, attaques) | `useCharacter.ts:185-322` **et** `CampaignCharacterView.vue:58-160` | 13 × 2 | Extraire en fonctions pures dans `utils/characterStats.ts`, prenant un `Character`. Les deux appelants les consomment. |
| `Math.floor((score - 10) / 2)` écrit à la main | 5 fichiers | **25** | `abilityModifier` de `utils/attackBonus.ts` partout. |
| `abilityModifier` redéfini localement | `useCharacter.ts:465`, `CampaignCharacterView.vue:53`, `useDualWield.test.ts:22` | 4 défs | Une seule, importée. |
| `signedNum` / `signed` / `bonusDisplay` | `ActionsView.vue:401,632`, `CombatView.vue:298`, `RollLogPanel.vue:69` | 4 | Un `utils/formatBonus.ts`. |
| Le patron `rollDie` + `revealAfterDice(dice(…))` | `ActionsView.vue` ×6, `CombatView.vue:260`, `AgonieModal.vue:37` | 8 | Un helper unique qui prend l'avantage en paramètre. |
| Le rendu `(d20 = 14 +3)` | template d'`ActionsView.vue` | **8** | Composant `RollDetail.vue`. |
| Les classes `roll-result--critical/--fumble` calculées inline | template d'`ActionsView.vue` | 6 | Portées par `RollDetail.vue`. |
| Le formatage d'une ligne de log | `RollLogPanel.vue:73`, `RollHistoryPanel.vue:103` | 2 | Une fonction partagée, deux mises en page. |
| Le parcours « capacités débloquées » | `PassifsCard.vue:16`, `ActionsView.vue:223` | 2 | `unlockedCapacites(paths)` dans `usePathEffects.ts`. |

Sans le premier point, la vue MJ d'une fiche de joueur afficherait des PV et des
bonus d'attaque différents de ceux du joueur dès qu'un passif est en jeu. C'est
un bug garanti, pas une hypothèse.

**Règle pour les implémenteurs** : aucun nouveau calcul de modificateur, de
formatage de bonus ou de rendu de jet ne doit être écrit une deuxième fois. Si
un besoin identique apparaît à deux endroits, il sort dans `utils/` avant d'être
utilisé.

Ce lot est un refactor à comportement constant : les tests existants
(`useCharacter.computed.test.ts`, `attackBonus.test.ts`) doivent passer sans
être modifiés. C'est le critère de fin.

---

## 6. Découpage d'implémentation

Trois vagues.

**Vague 0 — dédoublement, à comportement constant.** Un seul agent, parce que
tout se touche. `utils/characterStats.ts`, `utils/formatBonus.ts`,
`abilityModifier` unifié, `useCharacter.ts` et `CampaignCharacterView.vue`
ramenés aux fonctions pures. Fini quand : `npm test -w client` et
`npm run typecheck` passent **sans qu'aucun test ait été touché**.

**Vague 1 — les fondations (en parallèle)**

- `moteur` : `voies.ts` + `peuples.ts` (champ `effects`), `usePathEffects.ts`,
  branchement du bonus dans `characterStats.ts`.
  Fini quand : `usePathEffects.test.ts` est vert.
- `dés` : `rollKeep` dans `dice.ts`, `dropped` dans `plan.ts`, `outcome: null`
  sur les écartés. Fini quand : `dice.test.ts` et `dice3d.test.ts` sont verts.
- `serveur` : migration `dropped`, `schema.ts`, route POST, types
  `api/campaigns.ts`. Fini quand : `npm run db:migrate` est passé et
  `npm run typecheck` est propre.

**Vague 2 — les surfaces (en parallèle)**

- `fiche` : `AbilitiesCard.vue` (score effectif, marque, infobulle),
  `AbilityInitModal.vue` (garde le score de base).
- `jets` : `ActionsView.vue` (helper de lancer, avantage sur `rollAbility` /
  `rollCompetence`, actions de la famille B), composant `RollDetail.vue`.
- `3D` : `Dice3DOverlay.vue` (dé écarté estompé, étiquette barrée),
  `useCampaignRolls.ts`, `useViewerFeed.ts`.
- `logs` : `RollLogPanel.vue`, `RollHistoryPanel.vue`, `useRollHistory.ts`.
- `e2e` : seed + spec.

---

## 7. Tests

**Unitaires**

- `usePathEffects.test.ts` : élémentaliste rang 5 → +2 INT et avantage INT ;
  rang 4 → rien ; Hyperconscience → deux caracs ; Sagesse héroïque +
  Perception héroïque → +4 SAG.
- `useCharacter.computed.test.ts` : Intelligence héroïque avec INT 15 →
  l'attaque magique compte 17 ; Constitution héroïque → PV max +1 par niveau.
- `dice.test.ts` : `rollKeep(20, 2, 'high')` garde le max et écarte l'autre ;
  `'low'` fait l'inverse ; `count = 1` → `dropped` vide.
- `dice3d.test.ts` : un 20 sur un dé `dropped` ne produit **aucun** outcome ;
  un 1 écarté non plus.
- `rollOutcome.test.ts` : le crit se lit sur le dé gardé.

**E2E** (`e2e/specs/05-jets.spec.ts`)

Ajouter au bac à sable (`server/src/dev/seed.ts:64`) un perso élémentaliste
rang 5 — `nym` a déjà la voie au rang 4, il suffit de la monter, mais vérifier
que ça ne casse pas les specs qui s'appuient sur ses PM.

- `/actions`, clic sur INT → deux dés dans la zone de jet, un barré, le total
  utilise le plus grand.
- Le log de campagne affiche les deux valeurs.
- Un perso sans le passif → un seul dé (non-régression).

Poser les `data-testid` manquants sur la zone de jet de carac et sur la ligne
de log — aucun sélecteur CSS ni texte.

---

## 8. Décisions prises

1. **Périmètre des bonus de carac** : voies **et** peuples — 8 + ~23 capacités.
2. **Avantage ponctuel** (Attaque parfaite, Flèche de mort, Charge) : dans ce
   lot, avec la reclassification d'Attaque parfaite en action limitée.
3. **Affichage sur la fiche** : score effectif coloré + marque `•` avec le
   détail en infobulle ; les ± éditent la base.

Reste hors périmètre, assumé : la Malédiction (désavantage imposé), les 2d20
des monstres, et les passifs non numériques (Robustesse, Armure naturelle,
Intelligence du combat, Frappe chirurgicale).

---

## Vu au passage

- `plans/19-retours-session.md:324` signale « Boule de feu 2d6 dans `voies.ts`
  vs 4d6 dans la règle ». **C'est faux** : la donnée dit `4d6` depuis son
  premier commit (`d2582fd`), comme `voies-de-profil.md:200`. La note du plan 19
  est une erreur d'analyse, à supprimer.
- « Attaque parfaite » (`voies.ts:110`) est marquée `active: false` alors que la
  règle en fait une action limitée. Elle n'apparaît donc pas dans les actions
  de `/actions`. À corriger avec ce lot si la famille B est incluse.

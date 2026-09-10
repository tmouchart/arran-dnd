# 24 — Les états préjudiciables

## Le but

Le MJ pose un état sur n'importe qui (PJ ou monstre). L'état se voit à trois
endroits : sur le pion du champ de bataille, sur la ligne d'initiative, et sur
la fiche du personnage.

Aucun malus n'est appliqué automatiquement. Un état est un **rappel visuel** :
on le voit, on tape dessus, on lit sa règle. La seule exception est Affaibli,
qui bascule déjà les jets en d12 et garde cet effet.

Pas de durée, pas de compteur de tours. Le MJ met, le MJ enlève.

## Les 13 états

Les 8 de la section « États préjudiciables » de `knowledge/topics/combat.md`,
plus les 5 produits par les manœuvres du même fichier. Rien d'inventé.

| id | Nom | Effet (texte affiché) | Lucide | Emoji (pion) | Bloque le tour |
|---|---|---|---|---|---|
| `aveugle` | Aveuglé | -5 init, -5 attaque, -5 DEF, -10 attaque à distance | `EyeOff` | 🙈 | |
| `affaibli` | Affaibli | Tous les jets se font en d12 au lieu du d20 | — (🥀) | 🥀 | |
| `etourdi` | Étourdi | Aucune action possible, -5 DEF | `Sparkles` | 😵 | ✔ |
| `immobilise` | Immobilisé | Pas de déplacement, d12 aux tests | `Anchor` | ⚓ | |
| `paralyse` | Paralysé | Aucune action ; une attaque au contact touche automatiquement et inflige un critique | `Lock` | 🔒 | ✔ |
| `ralenti` | Ralenti | Une seule action par tour (attaque ou mouvement) | `Turtle` | 🐢 | |
| `renverse` | Renversé | -5 attaque et DEF ; une action de mouvement pour se relever | `PersonStanding` (pivoté 90°) | ⬇️ | |
| `surpris` | Surpris | Pas d'action ; -5 DEF au premier tour de combat | — (😲) | 😲 | ✔ |
| `desarme` | Désarmé | A lâché son arme ; une action de mouvement pour la ramasser | `Sword` | 🗡️ | |
| `bloque` | Bloqué | Ne peut pas se déplacer lors de son prochain tour | `Ban` | 🚫 | ✔ |
| `repousse` | Repoussé | A reculé de 1d6 m | `Wind` | 💨 | |
| `diversion` | Diversion | -5 à tous les tests de perception et en DEF jusqu'à son prochain tour | — (🎭) | 🎭 | |
| `menace` | Menacé | S'il attaque le personnage qui l'a menacé : celui-ci le frappe automatiquement, DM +1d6 | `Crosshair` | 🎯 | |

Trois états n'ont pas d'icône Lucide lisible (Affaibli, Surpris, Diversion) :
ils affichent leur emoji partout, y compris dans le DOM. Le catalogue porte les
deux champs, le composant prend le Lucide s'il existe, sinon l'emoji.

**Couleur** : ambre unique pour les 12, violet conservé pour Affaibli — c'est le
seul qui change vraiment une règle de jet, il mérite de rester distinct. Pas de
couleur par famille : avec 13 états sur des pastilles de 18 px, une légende à
trois couleurs n'est retenue par personne à la table. L'icône fait la
distinction, pas la teinte.

## Déjà fait (spike du 10/09/2026)

Le rendu des emoji sur le pion a été vérifié en amont, sur macOS : les 13
passent, aucun carré vide, le « +N » fonctionne. Sont **déjà dans l'arbre de
travail**, à ne pas réécrire :

- `client/src/data/etats.ts` — le catalogue complet + `sortEtats` / `visibleEtats`
  (c'est la zone B1, faite).
- `makeEtatsSprite` et le branchement sur le pion dans `BattleGrid3D.vue`
  (c'est l'essentiel de la zone D).

Sont **temporaires et à retirer** en zone D :

- la planche des 13 états au milieu du plateau (bloc `if (isDev)` dans `onMounted`) ;
- `fakeEtats` / `FAKE_COUNTS` dans `tokens.ts`, remplacés par le vrai `p.states`.

Reste à vérifier sur un Android : `client/vite.config.ts` n'expose pas le serveur
sur le réseau (`host: true` absent).

## Décision : Affaibli rejoint la liste

Aujourd'hui `affaibli` est une colonne booléenne sur `character`, avec son
composant `AffaibliPill.vue`. Le designer proposait de garder les deux systèmes
côte à côte. **On ne le fait pas** : Affaibli est l'un des 8 états officiels, en
garder une copie séparée recrée exactement la variance que le design system du
projet cherche à supprimer.

Donc : `character.affaibli` (booléen) devient `character.states` (liste d'ids),
et `affaibli` n'est plus qu'un id de cette liste. L'effet d12 se dérive :

```ts
const isAffaibli = computed(() => character.value.states.includes('affaibli'))
export const attackDieSides = computed(() => (isAffaibli.value ? 12 : 20))
```

C'est le seul endroit du plan qui touche à du code existant qui marche. La
migration recopie l'ancien booléen, `AffaibliPill.vue` disparaît.

## Décision : où vivent les états

- **PJ** : sur la fiche (`character.states`). Ça survit à la fin du combat, ça
  s'affiche sur la fiche hors combat, un poison de 1d6 heures a du sens. C'est
  exactement le traitement que `hpCurrent` reçoit déjà (`enrichParticipantHp`).
- **Monstres** : sur le participant de combat (`combat_participant.states`). Un
  monstre n'existe pas ailleurs.

Le serveur fusionne les deux au moment de sérialiser le combat. Le client ne
voit qu'un seul champ `states` sur chaque participant, il ignore d'où il vient.

## Qui pose quoi

- Le **MJ** pose et retire les états de tout le monde, depuis le combat.
- Le **joueur** garde la main sur ses propres états depuis sa fiche — c'est ce
  qu'il peut déjà faire avec Affaibli, on ne lui retire rien.
- Un joueur ne touche jamais aux états d'un autre, ni à ceux d'un monstre.

---

## Zone A — Serveur

**Fichiers** : `server/src/db/schema.ts`,
`server/src/db/migrations/1700000000043_etats.sql`,
`server/src/combats/etats.ts` *(nouveau)*, `server/src/combats/sseStore.ts`,
`server/src/combats/serialize.ts`, `server/src/routes/combats.ts`,
`server/src/campaigns/rest.ts`, `server/src/characters/updatable.ts`,
`server/src/dev/seed*.ts`.

### A1 — Migration

```sql
ALTER TABLE "character" ADD COLUMN "states" jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE "character" SET "states" = '["affaibli"]'::jsonb WHERE "affaibli" = true;
ALTER TABLE "character" DROP COLUMN "affaibli";
ALTER TABLE "combat_participant" ADD COLUMN "states" jsonb NOT NULL DEFAULT '[]'::jsonb;
```

→ vérif : `npm run db:migrate` passe, et une fiche qui était affaiblie a bien
`states = ["affaibli"]`.

### A2 — La liste des ids, côté serveur

`server/src/combats/etats.ts` : le tableau des 13 ids et un `isEtatId()`. Rien
d'autre — les libellés, icônes et textes de règle vivent côté client, le serveur
n'a besoin que de valider ce qu'on lui envoie.

### A3 — L'endpoint MJ

`PATCH /:id/combats/:cid/participants/:pid/states`, body `{ states: string[] }`.

Calqué ligne pour ligne sur le `PATCH .../participants/:pid` des PV
(`server/src/routes/combats.ts:276`), même structure de gardes :

- monstre → MJ seulement ;
- joueur → le MJ **ou** le joueur lui-même (l'endpoint PV est plus strict, ici
  le MJ doit pouvoir poser un état sur un PJ) ;
- ids inconnus rejetés en 400, doublons écrasés, liste vide autorisée ;
- joueur → écrit dans `character.states` en résolvant `campaignMembers.characterId` ;
- monstre → écrit dans `combat_participant.states` ;
- puis `broadcastCombatState`.

### A4 — La fusion et la sérialisation

`enrichParticipantStates` dans `sseStore.ts`, jumeau de `enrichParticipantHp` :
pour chaque participant joueur, remplacer `states` par celui de sa fiche. Même
découpage — une fonction pure `applyCharacterStates` exportée pour le test, une
fonction async qui va chercher en base.

`serialize.ts` : ajouter `states` au participant envoyé au client. Aucun secret
là-dedans, il part au MJ comme aux joueurs (même pour un monstre : voir qu'il
est renversé fait partie du jeu).

### A5 — Le repos et la whitelist

- `rest.ts` : `RestState.affaibli: boolean` devient `states: string[]`, et les
  deux repos rendent `states: []`. Adapter `rest.test.ts`.
- `updatable.ts` : `'affaibli'` → `'states'` dans `UPDATABLE_FIELDS`. Le
  commentaire du fichier prévient déjà qu'un champ oublié ici est jeté en
  silence — c'est le piège numéro un de cette zone.
- `routes/campaigns.ts` (~ligne 765) : la diffusion du repos porte `affaibli`,
  la remplacer par `states`.
- Le seed dev : donner un état ou deux au bac à sable, histoire d'avoir de quoi
  regarder sans cliquer.

→ vérif : `npm test -w server` vert, et un `PATCH .../states` en curl (JWT
fabriqué comme décrit dans CLAUDE.md) fait bien apparaître l'état dans le
`GET` du combat, côté MJ comme côté joueur.

---

## Zone B — Client, le socle

**Fichiers** : `client/src/data/etats.ts` *(nouveau)*,
`client/src/types/character.ts`, `client/src/composables/useCharacter.ts`,
`client/src/composables/useDualWield.ts`, `client/src/composables/useCombat.ts`,
`client/src/api/combats.ts`, `client/src/api/campaigns.ts`,
`client/src/api/characters.ts`.

Dépend de : rien. Peut démarrer en parallèle de la zone A.

### B1 — Le catalogue

`client/src/data/etats.ts` : la source unique.

```ts
export interface Etat {
  id: EtatId
  label: string
  /** La ligne de règle, affichée telle quelle dans l'infobulle. */
  effect: string
  icon?: FunctionalComponent  // Lucide, absent pour affaibli/surpris/diversion
  emoji: string               // toujours présent : le pion 3D n'a que ça
  /** Empêche d'agir : passe en tête quand il faut en couper. */
  blocking?: boolean
}
export const ETATS: Etat[] = [...]
export const ETAT_BY_ID: Record<EtatId, Etat>
```

Plus deux helpers purs, testables :

```ts
/** Trie (bloquants d'abord, puis ordre du catalogue) et dédoublonne. */
export function sortEtats(ids: string[]): Etat[]
/** Ce que le pion affiche : 3 pastilles max, et le reste compté. */
export function visibleEtats(ids: string[], max = 3): { etats: Etat[]; overflow: number }
```

### B2 — La fiche

- `types/character.ts` : `affaibli: boolean` → `states: EtatId[]`.
- `useCharacter.ts` : `attackDieSides` dérivé de `states`, idem
  `useDualWield.ts` ; sérialisation/désérialisation ; `applyServerRest` ;
  nouveau `applyServerStates(states)` sur le modèle d'`applyServerHp` (écrit
  sans réarmer l'autosave — sinon une fiche locale périmée réécrit tout par
  dessus, c'est le commentaire déjà en place ligne 303).
- `useCombat.ts` : au `combat-updated`, synchroniser mes propres états comme le
  HP l'est déjà (ligne 73).
- `api/combats.ts` : `states: string[]` sur `CombatParticipant`, et
  `setParticipantStates(campaignId, combatId, participantId, states)`.

→ vérif : `npm run -w client typecheck` (ou `vue-tsc`) passe, et
`npm test -w client` vert après adaptation des tests qui portent `affaibli`
(`useCharacter.test.ts`, `useDualWield.test.ts`, `rollOutcome.test.ts`,
`dice3d.test.ts`).

---

## Zone C — Client, l'UI de combat

**Fichiers** : `client/src/components/etats/EtatBadge.vue` *(nouveau)*,
`client/src/components/etats/EtatsRow.vue` *(nouveau)*,
`client/src/components/etats/EtatsSheet.vue` *(nouveau)*,
`client/src/views/CombatView.vue`,
`client/src/components/character-sheet/ResourcesCard.vue`,
`client/src/views/ActionsView.vue` (il monte `AffaibliPill` lui aussi, ~ligne 760),
suppression de `client/src/components/AffaibliPill.vue`,
`client/src/views/ComponentLibraryView.vue`.

Dépend de : B1 et B2.

### C1 — `EtatBadge.vue`

Une pastille : l'icône Lucide (ou l'emoji si pas d'icône), fond ambre, dans un
`AppTooltip` dont le contenu est `label` + `effect`. Lecture seule, aucun clic
qui modifie quoi que ce soit. Taille réglable par prop (`sm` pour la ligne,
normal pour la fiche).

### C2 — `EtatsRow.vue`

La rangée de pastilles pour un porteur donné. Si la liste est vide, **le
composant ne rend rien du tout** — pas de zone vide, pas de placeholder : une
zone toujours présente devient une zone que l'œil ignore, et le jour où un état
arrive personne ne le voit.

### C3 — `EtatsSheet.vue`, le geste du MJ

Un `AppBottomSheet` titré « États — <nom> », contenant une grille de 13 boutons
toggle indépendants (icône + libellé sous l'icône, 3 colonnes sur téléphone,
40 px minimum, actif = fond ambre, `aria-pressed`).

Le libellé texte est obligatoire ici, contrairement à la règle « boutons icône
seule » du projet : c'est un écran ouvert rarement et sous pression, 13
pictogrammes de même teinte sans mot sont illisibles en combat.

`AppToggleGroup` **ne convient pas** : il est mono-sélection, or un personnage
peut être Renversé *et* Désarmé. Ces toggles restent locaux au composant tant
qu'un deuxième écran n'en a pas besoin — pas d'`App*` prématuré.

Chaque tap appelle l'API tout de suite, pas de bouton Valider. Fermeture par le
geste natif de la sheet.

### C4 — La ligne d'initiative

La ligne compacte (`.card-summary`) est déjà pleine. On n'y met pas les
pastilles : juste **un indicateur ambre à côté de `.card-kind-dot`** — l'icône
seule s'il n'y a qu'un état, le nombre sinon. Rien si la liste est vide.

Le détail va dans la carte dépliée (`expandedId` existe déjà) : la vraie
`EtatsRow`, plus un `AppIconBtn` `FlaskConical` visible du MJ seul, qui ouvre
`EtatsSheet`. Les pastilles de la ligne compacte ne sont pas cliquables pour
toggler : la cible tactile serait trop petite.

### C5 — La fiche

`ResourcesCard.vue` : `AffaibliPill` dans `#titleActions` est remplacé par une
`EtatsRow` + un bouton qui ouvre `EtatsSheet` sur sa propre fiche. Le joueur
garde donc la main sur ses états, comme aujourd'hui avec Affaibli.

Ajouter `EtatBadge` et la grille de la sheet à `ComponentLibraryView.vue`.

→ vérif : dans Chrome, le MJ pose Renversé sur un PJ depuis la carte dépliée,
l'état apparaît sur la ligne et sur la fiche du joueur dans l'autre fenêtre,
sans rechargement.

---

## Zone D — Le pion 3D

**Fichiers** : `client/src/components/battle/tokens.ts`,
`client/src/components/battle/BattleGrid3D.vue`,
`client/src/components/battle/tokens.test.ts`.

Dépend de : B1.

- `buildTokens` : recopier `p.states` dans le `BattleToken`.
- `BattleGrid3D` : une fonction `makeEtatsSprite(ids)` sur le modèle exact de
  `makeHpBar` — un canvas, `ctx.fillText` des emoji, une `CanvasTexture`, un
  `Sprite`. Contenu : `visibleEtats(ids, 3)`, et un `+N` en dernière position
  s'il en reste.
- Empilement au-dessus du pion, de haut en bas : **nom → états → barre de PV**.
  Qui c'est, ce qui lui arrive, ce qu'il lui reste.
- Redessiner le sprite quand `states` change, le retirer quand la liste se vide.
- **Pas d'anneau de couleur** autour du pion : information binaire redondante
  avec les pastilles, et coûteuse à orienter face caméra.

`ViewerView.vue` et `BattleMapTab.vue` réutilisent tous les deux `buildTokens`
et `BattleGrid3D` : le mode table hérite de tout ça sans une ligne de plus.

⚠ **À tester sur un vrai téléphone Android**, pas seulement sur le desktop : les
emoji dessinés au `fillText` dépendent de la police système et peuvent tomber en
carré vide. Si un emoji casse, on le remplace dans le catalogue — c'est un seul
champ à changer.

→ vérif : `npm test -w client` (tokens.test.ts couvre le passage de `states`),
puis à l'œil sur téléphone : un pion à 4 états montre 3 pastilles et un « +1 ».

---

## Zone E — Tests

**Unitaires** (chacun à côté de sa source) :

- `data/etats.test.ts` : les 13 ids sont uniques ; chaque état a un emoji ;
  `sortEtats` remonte les bloquants et dédoublonne ; `visibleEtats` coupe à 3 et
  compte le reste correctement (0, 3, 4, 13).
- `combats/sseStore.test.ts` : `applyCharacterStates` remplace les états d'un PJ,
  laisse un monstre intact, ne casse pas sur un PJ sans fiche.
- `campaigns/rest.test.ts` : les deux repos vident `states`.
- `useCharacter` : `attackDieSides` vaut 12 avec `affaibli` dans la liste, 20
  sans — le test existant transposé.

**E2E** (`e2e/specs/`, bac à sable, `data-testid` obligatoire sur les boutons
icône) : le MJ ouvre un combat, déplie la ligne d'un PJ, ouvre la sheet, tape
Renversé ; l'état apparaît sur la ligne. Le joueur, dans son contexte, voit le
même état sur sa fiche.

---

## Ordre de marche

A et B en parallèle (ils ne partagent aucun fichier). Puis C et D en parallèle,
tous deux après B. E à la fin.

## Ce qu'on ne fait pas maintenant

- **Les malus automatiques.** Aveuglé ne retire pas -5 à l'attaque dans les
  jets. Ça touche au cœur du calcul, ça mérite son propre plan.
- **Les durées.** Pas de compteur de tours, pas d'expiration au changement de
  round.
- **Les états de fiction du bestiaire** (empoisonné, enflammé, apeuré,
  invisible, enragé, endormi, saignement, maudit). Ils apparaissent partout dans
  `bestiaire.md` mais ne sont définis nulle part comme état mécanique — il
  faudrait leur écrire une règle d'abord.
- **Le tap sur le pion 3D** pour poser un état. Le hit-testing d'un sprite de
  40 px au doigt est fragile ; on passe par la ligne d'initiative.

## Vu au passage

- `applyRest` remet `affaibli` à false sur un repos long comme sur un repos
  complet. Avec les 13 états, « une nuit de sommeil enlève Menacé » est
  inoffensif, mais si un jour on ajoute des poisons longs (1d6 heures) il faudra
  distinguer ce qu'un repos lève de ce qu'il ne lève pas. Ticket à ouvrir le
  jour où ça arrive, pas avant.

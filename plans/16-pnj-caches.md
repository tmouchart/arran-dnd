# 16 — PNJ cachés en combat (renforts, embuscades)

## Le besoin

En combat, le MJ veut préparer d'avance des monstres qui ne sont **pas encore là** :
renforts, second vague, monstre embusqué. Ils sont dans le combat côté MJ, mais :

- invisibles pour les joueurs,
- **hors de l'ordre d'initiative** tant qu'ils sont cachés.

Quand ils débarquent, le MJ clique sur l'œil → ils apparaissent d'un coup, à leur
bonne place dans l'initiative, pour tout le monde.

## Prérequis — FAIT

Le tour courant était stocké comme un **index de position** dans la liste triée
par initiative. Cette liste n'existe pas en base : elle est recalculée à chaque
requête. Ajouter, retirer ou révéler un participant décalait donc l'index et
changeait le tour courant tout seul.

Corrigé avant de commencer cette feature : `combat.current_participant_id`
remplace `current_turn_index` (migration `1700000000036`). Le tour est une donnée
stable ; l'ordre trié n'est plus qu'une vue, et `currentTurnIndex` est **dérivé**
à la sérialisation pour que le client ne change pas.

Tout l'ordre de tour vit dans `server/src/combats/turnOrder.ts` :
`turnOrder`, `isActive`, `firstActiveId`, `step`, `turnIndexOf` — testé dans
`turnOrder.test.ts`. C'est le seul endroit à toucher pour les PNJ cachés.

## Modèle de données

Migration `server/src/db/migrations/1700000000038_participant_hidden.sql` :

```sql
ALTER TABLE "combat_participant"
  ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false;
```

Puis `schema.ts` : `hidden: boolean('hidden').notNull().default(false)`.
Lancer `npm run db:migrate` tout de suite après création.

Règle : seul un `kind = 'monster'` peut être caché. Un joueur n'est jamais caché.

## Serveur

### 1. Un caché est hors de l'ordre

Dans `turnOrder.ts`, ajouter `hidden: boolean` à `Orderable` et une seule ligne
dans `isActive` :

```ts
export function isActive(p: Orderable): boolean {
  if (p.hidden) return false
  return p.kind === 'player' || (p.hpCurrent ?? 0) > 0
}
```

Et `turnOrder()` filtre les cachés avant de trier. C'est tout : `step`,
`firstActiveId` et `turnIndexOf` en héritent gratuitement, donc `next-turn`,
`prev-turn` et la sérialisation aussi. Aucun autre code serveur à modifier pour
l'ordre de tour.

Conséquence directe : comme le tour est un **id**, révéler un PNJ ne peut pas
déplacer le tour de quelqu'un d'autre. Il n'y a rien à « resynchroniser ».

### 2. GET / SSE — ce que voit qui

Les cachés sortent de `turnOrder()`, donc ils ne sont plus dans `participants`
du tout — ni pour le MJ, ni pour les joueurs. Il faut donc les renvoyer
**séparément**, au MJ uniquement :

```ts
reserve: isGm ? hiddenParticipants : []
```

Côté joueur : liste vide. Zéro fuite — ni nom, ni initiative, ni case grisée.

`sseStore.ts:108` et le `GET` dupliquent déjà le tri, le masquage des PV monstres
et `hpStatus`. Avec la réserve ça ferait une troisième chose à dupliquer :
extraire un `serializeCombat(combat, participants, isGm)` partagé **avant**
d'ajouter la feature.

### 3. Toggle visibilité — MJ seulement

`PATCH /:id/combats/:cid/participants/:pid/visibility  { hidden: boolean }`

Endpoint séparé du PATCH HP existant (celui-là est ouvert aux membres pour les
PV ; ici c'est `verifyGm`). Logique complète :

1. refuser si `participant.kind !== 'monster'` (400),
2. UPDATE `hidden`,
3. si on cache le participant dont c'est le tour → passer la main au suivant
   (même logique que le `DELETE` : `step(turnOrder(all), pid, 1)`),
4. `broadcastCombatState`.

`roundNumber` n'est pas touché. Un renfort avec une grosse initiative révélé au
milieu du round joue donc au round suivant — c'est la règle attendue.

### 4. Créer un renfort directement caché

`POST /monsters` accepte `hidden?: boolean` (défaut `false`) — c'est ce qui
permet au MJ de **préparer** le combat avec ses renforts avant l'action.

## Client

### API (`client/src/api/combats.ts`)

- `CombatParticipant` : ajouter `hidden?: boolean`.
- `addCombatMonster(...)` : le payload accepte déjà `Record<string, unknown>`, on
  passe `hidden`.
- Nouvelle fonction `setParticipantVisibility(campaignId, combatId, pid, hidden)`.

### `CombatView.vue`

1. **Liste d'initiative** : rien à changer. `participants` ne contient déjà plus
   les cachés (ils arrivent dans `reserve`), et `currentTurnIndex` indexe bien
   cette liste.
2. **Section « En réserve »** (MJ uniquement, sous la liste, repliée par défaut si
   vide → on ne l'affiche pas du tout s'il n'y a aucun caché) : les participants
   `hidden`, en carte **grisée + bordure pointillée**, sans numéro d'initiative en
   tête, avec un bouton `Eye` (Lucide) pour les faire entrer en jeu.
3. **Bouton `EyeOff`** sur chaque carte monstre visible (MJ) pour le remettre en
   réserve. Attention à la règle des 7 boutons : la carte a déjà `Trash2`, on reste
   à 2 icônes → OK.
4. **Ajout de monstre** (bottom sheet existant) : une ligne « Entrée en jeu » avec
   deux choix, `Maintenant` / `En réserve`. Implémenté avec `AppTabs`
   (`iconOnlyMobile`) ou deux `AppButton` — pas de switch maison.
5. **Toast** à la révélation : `showToast('Sarkan le Brûlé entre dans le combat !')`.
   Côté joueur, le SSE fait apparaître la carte : ajouter une animation CSS keyframe
   `reveal-in` (fade + slide) sur les cartes nouvellement présentes.

Aucun changement côté joueur au-delà de ça : il ne sait pas que la réserve existe.

## Tests (Vitest)

Dans `server/src/combats/turnOrder.test.ts`, qui couvre déjà l'ordre et `step` :

- `turnOrder` exclut les `hidden` de l'ordre.
- `isActive` : un caché est inactif même vivant et même joueur.
- `step` saute un caché placé entre deux actifs.
- révéler un PNJ de grosse initiative : `turnIndexOf` bouge, mais l'id du tour
  courant est inchangé (le test « le tour ne bouge plus quand la liste change »
  existe déjà, on ajoute la variante `hidden`).
- cacher le participant courant → `step` depuis son id trouve bien le suivant.

## Étapes & vérifications

1. `serializeCombat()` partagé entre `GET` et `sseStore` → vérif : `npm test -w server`
   vert, combat identique en GET et en SSE.
2. Migration `hidden` + `schema.ts` → vérif : `npm run db:migrate` passe.
3. `Orderable.hidden` + `isActive` + filtre dans `turnOrder` + tests → vérif :
   tests verts.
4. `reserve` dans la sérialisation → vérif : un `GET` en tant que joueur ne
   contient aucun caché, `reserve` vide.
5. Endpoint `visibility` → vérif : révéler un PNJ de haute initiative ne change
   pas le tour courant.
6. Client : section réserve, boutons œil, choix à l'ajout → vérif manuelle à deux
   onglets (MJ + joueur) : le joueur voit la carte apparaître en direct.
7. `playtester` sur le flow MJ.

## Hors scope

- Marquer des monstres comme cachés depuis un **modèle de rencontre**
  (`encounter_template`) au moment du `POST /combats`. À faire dans un second temps
  si le besoin se confirme.
- Position/carte 3D des PNJ cachés (voir POC `BattleGrid3D`).

# 25 — Ajouter un PJ en cours de combat

## Le besoin

Le MJ lance un combat avec les joueurs présents. Un retardataire arrive, ou un
joueur exclu au lancement doit finalement entrer dans la bagarre. Aujourd'hui
c'est impossible : il faut terminer le combat et le relancer.

Un bouton **+PJ** à côté du **+** (renfort monstre) dans la barre du bas, réservé
au MJ. Il ouvre une feuille listant les membres de la campagne absents du combat.
Un tap = le PJ entre, à sa place dans l'initiative, pour tout le monde en direct.

## Ce qui existe déjà

- Les PJ ne sont insérés qu'à la création (`POST /:id/combats`), depuis
  `campaign_member` moins `excludedUserIds`.
- `POST /:id/combats/:cid/monsters` fait déjà exactement ce travail pour un
  monstre : vérif MJ, combat actif, insert, `broadcastCombatState`. On le copie.
- **Le tour est stocké par id** (`combat.current_participant_id`), l'ordre trié
  n'est qu'une vue recalculée (`combats/turnOrder.ts`). Insérer un participant
  en cours de combat ne décale donc le tour de personne. Rien à toucher côté
  ordre de tour.
- Les PV et les états d'un PJ vivent sur sa fiche, pas sur le participant
  (`enrichParticipantHp` / `enrichParticipantStates`, clé = `userId`). Le
  participant joueur n'a donc que `name`, `initiative`, `def`, sa position.
- La contrainte `unique_campaign_member` garantit **un membre = un personnage**
  dans une campagne. Le choix se fait donc sur le membre, pas sur la fiche.

## Serveur

### 1. Factoriser l'insertion d'un PJ

Dans `server/src/routes/combats.ts`, la boucle de création fabrique déjà le
participant joueur. On extrait la partie commune pour que la création et l'ajout
ne divergent pas :

```ts
async function insertPlayerParticipant(combatId: number, member: { userId: number; characterId: number }, slot: number) {
  const [char] = await db.select().from(characters).where(eq(characters.id, member.characterId))
  if (!char) return false
  await db.insert(combatParticipants).values({
    combatId,
    kind: 'player',
    userId: member.userId,
    name: char.name,
    initiative: computeInitiative(char),
    hpMax: null,
    hpCurrent: null,
    def: char.defense,
    ...startingPosition('player', slot),
  })
  return true
}
```

`POST /:id/combats` s'en sert dans sa boucle (même comportement qu'avant).

### 2. `POST /:id/combats/:cid/players`

Corps : `{ userId: number }`. Calqué sur la route `monsters` :

1. `verifyGm` → 403 sinon.
2. `loadCombatInCampaign` → 404 sinon ; `status !== 'active'` → 400.
3. Le `userId` doit être membre de **cette** campagne et avoir un
   `characterId` → sinon 400 « Ce joueur n'a pas de personnage ».
4. Déjà présent (`kind = 'player'` et même `userId`, réserve comprise) → 409
   « Déjà dans le combat ». Le MJ peut taper deux fois, la feuille peut être
   périmée : la route tranche, pas le client.
5. `slot` = nombre de participants `kind = 'player'` déjà là → le pion se pose
   derrière les héros en place, sans superposition (`startingPosition`).
6. `broadcastCombatState(combatId, check.gmUserId)` → 201.

Pas de `broadcastCampaignEvent` : `/api/combats/active` se base sur
l'appartenance à la campagne, pas sur la participation. Le joueur ajouté avait
déjà le bandeau « combat en cours ».

**Pas de retrait de PJ.** `DELETE .../participants/:pid` refuse tout ce qui
n'est pas un monstre, et on le laisse ainsi — hors périmètre.

## Client

### 3. `api/combats.ts`

```ts
export function addCombatPlayer(campaignId: number, combatId: number, userId: number): Promise<void>
```

Et `useCombat.ts` : `addPlayer(userId)`, jumeau d'`addMonster`.

### 4. Qui peut-on ajouter — pur et testé

Nouveau `client/src/utils/combatRoster.ts` :

```ts
export function membresAbsents(members: CampaignMember[], participants: CombatParticipant[]): CampaignMember[]
```

Garde les membres qui ont un `characterId` et dont le `userId` n'est **pas**
déjà dans les participants. Test Vitest à côté (`combatRoster.test.ts`) :
membre déjà en combat écarté, membre sans fiche écarté, liste vide quand tout le
monde est là.

### 5. `CombatView.vue`

- Barre du bas, `footer-center`, à côté du `+` :
  `AppIconBtn` icône `UserPlus`, `title="Ajouter un PJ"`,
  `data-testid="add-player"`, `v-if="isGm"`. La barre MJ passe à 4 boutons —
  sous la limite de 7.
- `AppBottomSheet` « Ajouter un PJ ». Les membres sont chargés **à
  l'ouverture** (`fetchCampaign(campaignId)`), pas gardés en état : pas de
  charge inutile sur le SSE, et la liste est fraîche.
- Contenu : une ligne par membre absent (nom du personnage + pseudo), même
  style que `.bestiary-item`. Tap → `addPlayer(userId)` → toast
  « {nom} rejoint le combat ! » → fermeture.
- Liste vide → `AppEmptyState` « Tout le monde est déjà dans le combat ».
- Erreur serveur → `showToast` avec le message, la feuille reste ouverte.

Aucun nouveau composant `App*` : `AppBottomSheet` + `AppEmptyState` suffisent.

## Ce que ça donne dans l'initiative

Le PJ entre à sa place d'initiative. Si elle est **au-dessus** du tour courant,
il ne joue qu'au tour suivant — exactement comme un renfort monstre. C'est le
comportement voulu : on n'insère jamais un tour rétroactivement.

## Vérifications

1. `membresAbsents` → unit tests Vitest (`npm test -w client`).
2. Route serveur : MJ exclut `bracco` au lancement, l'ajoute en cours de combat,
   il apparaît dans la timeline du MJ **et** de `bracco` (SSE) → e2e à ajouter
   dans `e2e/specs/04-combat.spec.ts`, testid `add-player`.
3. Manuel (bac à sable) : ajouter deux PJ d'affilée → deux pions distincts sur
   la carte, pas de superposition.
4. Double ajout du même joueur → 409, toast, rien en double dans la timeline.

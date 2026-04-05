# Plan : Jouer une rencontre (combat actif)

## Context

Le MJ peut lancer un combat depuis la page campagne. Le combat est persisté en DB (historique). L'initiative des joueurs est calculée automatiquement depuis leur fiche. Les monstres viennent d'une rencontre pré-sauvée (ou combat vide). Une timeline verticale affiche l'ordre des tours. Le MJ et le joueur actif peuvent avancer au tour suivant. Tous les membres de la campagne voient le combat en temps réel via SSE.

### Principes UX
- **Temps réel** : chaque action (next-turn, HP, ajout monstre, finish) broadcast via SSE à tous les participants
- **1 clic** : les actions récurrentes du MJ (avancer le tour, ajuster HP d'un monstre) doivent être accessibles directement depuis la timeline, sans naviguer ailleurs
- **Navigation fluide** : un joueur peut facilement aller-retour entre le combat et sa fiche de personnage (bouton "Ma fiche" + bouton retour au combat)

---

## 1. Database — Nouvelles tables

**Fichier** : `server/src/db/schema.ts`

### Table `combats`
| Colonne | Type | Notes |
|---------|------|-------|
| id | serial PK | |
| campaignId | FK→campaigns | ON DELETE CASCADE |
| encounterId | FK→encounterTemplates | nullable (null = combat vide) |
| name | varchar(200) | NOT NULL |
| status | varchar(20) | 'active' / 'finished', default 'active' |
| currentTurnIndex | integer | default 0 — index dans l'ordre d'initiative |
| roundNumber | integer | default 1 |
| createdAt | timestamp | |
| finishedAt | timestamp | nullable |

### Table `combatParticipants`
| Colonne | Type | Notes |
|---------|------|-------|
| id | serial PK | |
| combatId | FK→combats | ON DELETE CASCADE |
| kind | varchar(10) | 'player' / 'monster' |
| userId | FK→users | nullable (null pour monstres) |
| name | text | NOT NULL — nom du perso/monstre |
| initiative | integer | NOT NULL |
| hpMax | integer | NOT NULL |
| hpCurrent | integer | NOT NULL |
| def | integer | NOT NULL, default 10 |
| nc | real | nullable |
| statFor | integer | nullable |
| statDex | integer | nullable |
| statCon | integer | nullable |
| statInt | integer | nullable |
| statSag | integer | nullable |
| statCha | integer | nullable |
| attacks | jsonb | nullable |
| abilities | jsonb | nullable |
| monsterDescription | text | nullable |

Table unifiée joueurs+monstres pour simplifier le tri par initiative.

**Migration** : `server/src/db/migrations/1700000000027_combats.sql`

---

## 2. Server — API Routes

**Fichier** : `server/src/routes/combats.ts` (nouveau)
**Montage** : dans `server/src/index.ts`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/:id/combats` | GM | Lancer un combat (body: encounterId?, excludedUserIds[]) |
| GET | `/:id/combats` | membre | Liste combats (actifs + historique) |
| GET | `/:id/combats/:cid` | membre | État du combat (participants triés par initiative) |
| POST | `/:id/combats/:cid/next-turn` | GM ou joueur actif | Avancer au tour suivant |
| POST | `/:id/combats/:cid/prev-turn` | GM | Revenir au tour précédent (correction d'erreur) |
| PATCH | `/:id/combats/:cid/participants/:pid` | voir ci-dessous | Modifier HP d'un participant |
| POST | `/:id/combats/:cid/monsters` | GM | Ajouter un monstre en cours de combat (renforts) |
| POST | `/:id/combats/:cid/finish` | GM | Terminer le combat |
| GET | `/:id/combats/:cid/events` | membre | SSE stream temps réel |

### Droits sur PATCH participants/:pid
- **Monstre** : seul le MJ peut modifier les HP
- **Joueur** : seul le joueur lui-même peut modifier ses propres HP (pas le MJ)

### Logique de création du combat (POST)
1. Récupérer les membres de la campagne (sauf `excludedUserIds`)
2. Pour chaque joueur : charger son personnage actif, calculer initiative = DEX - armorBonus + initiativeBonus, récupérer hpCurrent/hpMax
3. Si `encounterId` fourni : copier les monstres de la rencontre (avec leur initiative du template)
4. Insérer le combat + participants en DB
5. Trier par initiative DESC, stocker `currentTurnIndex = 0`
6. **Broadcaster via SSE**

### Logique de next-turn (POST)
1. Vérifier que le requester est GM OU le joueur dont c'est le tour
2. Incrémenter `currentTurnIndex`
3. Si dépasse la fin → revenir à 0, incrémenter `roundNumber`
4. Sauter les participants à 0 HP (monstres morts)
5. **Broadcaster via SSE**

### Logique de prev-turn (POST) — GM only
1. Décrémenter `currentTurnIndex`
2. Si passe en dessous de 0 → aller au dernier, décrémenter `roundNumber` (min 1)
3. Sauter les participants à 0 HP
4. **Broadcaster via SSE**

### Logique d'ajout monstre en cours (POST monsters)
1. Vérifier GM
2. Body : mêmes champs que encounterMonsters (nom, stats, etc.) — même UX que l'éditeur de rencontre
3. Insérer en DB dans combatParticipants avec kind='monster'
4. L'initiative du monstre détermine sa position dans l'ordre
5. **Broadcaster via SSE**

### SSE — Temps réel sur CHAQUE action
Suivre le même pattern que `sessions/store.ts` :
- Map<combatId, Set<SseClient>> en mémoire
- **Chaque mutation** (next-turn, prev-turn, HP change, ajout monstre, finish) **broadcast** le state complet
- État différent GM vs joueur :
  - GM voit : HP monstres (valeur exacte), stats, capacités
  - Joueurs voient : état qualitatif des monstres (Intact/Blessé/Mal en point/Agonisant), pas les HP

---

## 3. Client — API + Composable

### `client/src/api/combats.ts` (nouveau)
Interfaces :
- `CombatSummary` : { id, name, status, roundNumber, createdAt, finishedAt }
- `CombatState` : { id, name, status, roundNumber, currentTurnIndex, participants: CombatParticipant[], campaignId }
- `CombatParticipant` : { id, kind, userId?, name, initiative, hpMax, hpCurrent, def, nc?, stats?, attacks?, abilities?, monsterDescription?, hpStatus? }

`hpStatus` (joueurs voient ça pour les monstres) : 'intact' | 'blesse' | 'mal_en_point' | 'agonisant' | 'mort'

Fonctions :
- `fetchCombats(campaignId)`, `fetchCombat(campaignId, cid)`
- `createCombat(campaignId, { encounterId?, excludedUserIds[] })`
- `nextTurn(campaignId, cid)`, `prevTurn(campaignId, cid)`
- `updateParticipantHp(campaignId, cid, pid, { hpCurrent })`
- `addCombatMonster(campaignId, cid, monsterData)`
- `finishCombat(campaignId, cid)`

### `client/src/composables/useCombat.ts` (nouveau)
Pattern identique à `useSession.ts` :
- `combat` ref, `connecting`, `error`
- `connect(campaignId, combatId)` → EventSource SSE
- `disconnect()`
- `nextTurn()`, `prevTurn()`, `updateParticipantHp()`, `addMonster()`, `finishCombat()`
- `initiativeOrder` computed (trié par initiative DESC)
- `currentParticipant` computed (participants[currentTurnIndex])
- `isMyTurn` computed (currentParticipant.userId === user.id)
- `isGm` computed
- `myParticipant` computed (pour que le joueur accède à ses propres HP)

---

## 4. Client — Vues

### Modal de lancement (dans CampaignView)
- Bouton "Jouer une rencontre" dans l'onglet Rencontres ou en haut de la page campagne
- Modal avec :
  - Liste des joueurs de la campagne (tous cochés par défaut), toggle pour exclure
  - Select de rencontre parmi les rencontres pré-sauvées + option "Combat vide"
  - Bouton "Lancer le combat"
- Après création → naviguer vers `/campagnes/:id/combat/:cid`

### `CombatView.vue` (nouveau)
**Route** : `/campagnes/:id/combat/:cid`

Layout :
- Header avec nom du combat + **round actuel affiché** + bouton retour campagne
- **Bouton "Ma fiche"** (joueurs) : lien vers `/campagnes/:campaignId/personnage/:userId` pour consulter/modifier sa fiche rapidement. Bouton retour au combat depuis la fiche.

- **Timeline verticale** (ligne du temps) :
  - Ligne verticale avec des points pour chaque participant
  - Trié par initiative DESC
  - À droite de chaque point : nom, initiative, PV (joueurs) ou état qualitatif (monstres vus par joueurs)
  - Le participant actif est mis en valeur (couleur accent, surbrillance forte)
  - Distinction visuelle "a déjà joué ce round" (au-dessus du curseur) vs "n'a pas encore joué" (en dessous)
  - Joueurs : point vert. Monstres : point rouge
  - Monstres à 0 HP : grisés, barrés, sautés automatiquement
  - Click sur un joueur → fiche readonly
  - Click sur un monstre (MJ) → voir les capacités/attaques
  - **HP monstres ajustables en 1 clic** : boutons -/+ directement sur la ligne du monstre dans la timeline (MJ only)

- **Boutons de tour** :
  - "Suivant" : visible par le MJ et le joueur actif
  - "Précédent" : MJ only (pour corriger une erreur)

- **Panneau monstre** (MJ, quand c'est le tour d'un monstre) : affiche les capacités, attaques, stats du monstre actif

- **Ajout de monstre en combat** (MJ only) :
  - Bouton "+" qui ouvre le même UX que l'éditeur de rencontre (recherche bestiaire + custom)
  - Le monstre ajouté s'insère dans la timeline à sa position d'initiative

- **HP joueur** : le joueur peut modifier ses propres HP directement (boutons -/+ ou input)

- **Bouton "Terminer le combat"** (MJ only)

### Onglet "Combat" dans CampaignView
- Nouveau tab visible par tous (joueurs + MJ) quand un combat actif existe
- Affiche un lien vers le combat en cours

---

## 5. Router

**Fichier** : `client/src/router/index.ts`

Ajouter : `{ path: '/campagnes/:id/combat/:cid', name: 'combat', component: CombatView }`

---

## 6. Fichiers à créer/modifier

### Créer
- `server/src/db/migrations/1700000000027_combats.sql`
- `server/src/routes/combats.ts`
- `server/src/combats/sseStore.ts` — SSE client tracking pour combats
- `client/src/api/combats.ts`
- `client/src/composables/useCombat.ts`
- `client/src/views/CombatView.vue`

### Modifier
- `server/src/db/schema.ts` — tables combats + combatParticipants
- `server/src/index.ts` — monter les routes combats
- `client/src/views/CampaignView.vue` — modal de lancement + onglet Combat
- `client/src/router/index.ts` — route combat

### Réutiliser
- `server/src/sessions/store.ts` — pattern SSE (writeSse, broadcastToSession)
- `client/src/composables/useSession.ts` — pattern composable SSE
- `client/src/utils/monsterSession.ts` — formatMod(), filterCatalog()
- `client/src/data/armorsCatalog.ts` — ARMORS_BY_ID, SHIELDS_BY_ID pour calcul initiative joueur
- `client/src/data/monstersCatalog.ts` — pour l'ajout de monstres en combat

---

## Ordre d'implémentation

1. **DB** : schema + migration
2. **Server SSE store** : sseStore.ts pour combats
3. **Server routes** : combats.ts (création, next/prev-turn, HP, ajout monstre, finish, SSE)
4. **Client API** : combats.ts
5. **Client composable** : useCombat.ts
6. **CampaignView** : modal de lancement + onglet Combat
7. **CombatView** : timeline + boutons tour + panneau monstre + ajout monstre + HP joueur
8. **Router** : route

---

## Vérification

- Le MJ lance un combat avec une rencontre pré-sauvée → les monstres sont copiés
- Les initiatives joueurs sont calculées automatiquement
- La timeline affiche l'ordre correct (DESC) avec round visible
- Le bouton "Suivant" avance au bon participant — broadcast SSE
- Le joueur actif peut aussi cliquer "Suivant"
- Le bouton "Précédent" (MJ) revient en arrière — broadcast SSE
- Les monstres à 0 HP sont grisés et sautés
- Le MJ peut modifier les HP des monstres en 1 clic depuis la timeline — broadcast SSE
- Les joueurs peuvent modifier leurs propres HP — broadcast SSE
- Les joueurs voient l'état qualitatif des monstres (pas les HP exacts)
- Le MJ peut ajouter des monstres en cours de combat (renforts) — broadcast SSE
- Le MJ voit les capacités du monstre actif
- Un joueur peut naviguer facilement entre combat et sa fiche
- Le combat est persisté en DB (visible dans l'historique)
- Le SSE synchronise TOUTES les mutations en temps réel à tous les participants
- Le MJ peut terminer le combat — broadcast SSE

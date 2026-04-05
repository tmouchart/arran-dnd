# Plan : Jouer une rencontre (combat actif)

## Context

Le MJ peut lancer un combat depuis la page campagne. Le combat est persisté en DB (historique). L'initiative des joueurs est calculée automatiquement depuis leur fiche. Les monstres viennent d'une rencontre pré-sauvée (ou combat vide). Une timeline d'initiative affiche l'ordre des tours. Le MJ et le joueur actif peuvent avancer au tour suivant. Tous les membres de la campagne voient le combat en temps réel via SSE.

### Principes UX
- **Temps réel** : chaque action (next-turn, HP, ajout monstre, finish) broadcast via SSE à tous les participants
- **1 clic** : les actions récurrentes du MJ (avancer le tour, ajuster HP monstre) directement depuis la timeline, sans naviguer
- **Tout visible sans naviguer** : le joueur voit sur la même page la timeline, ses HP/stats, et ses actions de combat
- **Mobile-first** : footer sticky, cartes compressées, bottom sheets

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
| POST | `/:id/combats/:cid/prev-turn` | GM | Revenir au tour précédent |
| PATCH | `/:id/combats/:cid/participants/:pid` | voir ci-dessous | Modifier HP |
| POST | `/:id/combats/:cid/monsters` | GM | Ajouter un monstre (renforts) |
| POST | `/:id/combats/:cid/finish` | GM | Terminer le combat |
| GET | `/:id/combats/:cid/events` | membre | SSE stream temps réel |

### Droits sur PATCH participants/:pid
- **Monstre** : seul le MJ peut modifier les HP
- **Joueur** : seul le joueur lui-même peut modifier ses propres HP

### Logique de création du combat (POST)
1. Récupérer les membres de la campagne (sauf `excludedUserIds`)
2. Pour chaque joueur : charger son personnage actif, calculer initiative = DEX - armorBonus + initiativeBonus, récupérer hpCurrent/hpMax
3. Si `encounterId` fourni : copier les monstres de la rencontre (avec leur initiative du template)
4. Insérer le combat + participants en DB
5. Trier par initiative DESC, stocker `currentTurnIndex = 0`
6. **Broadcaster via SSE**

### Logique de next-turn / prev-turn
- next : incrémenter index, wrap à 0 + roundNumber++, sauter monstres à 0 HP — **broadcast SSE**
- prev : décrémenter index, wrap à fin + roundNumber-- (min 1), sauter morts — **broadcast SSE**

### Logique d'ajout monstre en cours (POST monsters)
- Même format que encounterMonsters (nom, stats complets)
- Même UX que l'éditeur de rencontre (recherche bestiaire + custom)
- S'insère dans l'ordre d'initiative — **broadcast SSE**

### SSE — Broadcast sur CHAQUE mutation
- Map<combatId, Set<SseClient>> en mémoire
- Chaque mutation broadcast le state complet
- État différent GM vs joueur :
  - GM voit : HP monstres (valeur exacte), stats, capacités, attaques
  - Joueurs voient : état qualitatif monstres via icônes (voir section UX)

---

## 3. Client — API + Composable

### `client/src/api/combats.ts` (nouveau)

Interfaces :
- `CombatSummary` : { id, name, status, roundNumber, createdAt, finishedAt }
- `CombatState` : { id, name, status, roundNumber, currentTurnIndex, participants: CombatParticipant[], campaignId }
- `CombatParticipant` : { id, kind, userId?, name, initiative, hpMax, hpCurrent, def, nc?, stats?, attacks?, abilities?, monsterDescription?, hpStatus? }

`hpStatus` (pour les joueurs, monstres uniquement) : 'intact' | 'blesse' | 'mal_en_point' | 'agonisant' | 'mort'

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
- `myParticipant` computed

---

## 4. Client — UX Design

### Architecture écran mobile (3 zones fixes)

```
┌─────────────────────────┐
│  HEADER (56px)          │
│  [←] Nom combat   R:3  │
├─────────────────────────┤
│                         │
│   ZONE PRINCIPALE       │  ← scrollable
│   Timeline (cartes)     │
│   + panneau joueur      │
│                         │
├─────────────────────────┤
│  FOOTER STICKY (72px)   │
│  [←Préc] [+]  [SUIVANT]│
└─────────────────────────┘
```

### Timeline = cartes empilées (pas de ligne verticale)

- **Carte active** (~90px) : expanded, couleur accent, actions inline visibles
- **Cartes non-actives** (~52px) : compressées, juste nom + état santé
- **`scrollIntoView`** automatique sur le participant actif à chaque changement de tour

```
┌─────────────────────────┐  ← active, expanded
│ ▶ THORIN       Init 18  │
│   ██████░░░ 24/30 PV    │
│   [-5] [-1]   [+1] [+5] │  ← HP inline (joueur: ses propres HP)
└─────────────────────────┘
┌─────────────────────────┐  ← compressé, a joué (semi-transparent + ✓)
│ ✓ Arya   Init 15  ♥    │
└─────────────────────────┘
┌─────────────────────────┐  ← compressé, monstre
│   Gobelin 1  Init 12 💔 │
└─────────────────────────┘
┌─────────────────────────┐  ← mort, grisé + barré
│ ✗ Gobelin 2  Init 9    │
└─────────────────────────┘
```

### HP monstres (MJ) — 1 clic depuis la timeline

Quand le MJ voit la timeline, les monstres ont des boutons -/+ directement sur leur carte :

```
┌─────────────────────────┐  ← monstre actif (MJ view)
│ ▶ Gobelin Chef  Init 12 │
│   ██░░░░░ 8/20 PV       │
│   [-5] [-1]   [+1] [+5] │  ← ajustement HP en 1 clic
└─────────────────────────┘
```

Les boutons -/+ sont visibles sur TOUS les monstres (pas seulement l'actif) pour le MJ, même en mode compressé.

### État qualitatif des monstres (vue joueur) — icônes

| État | % PV | Icône Lucide | Couleur |
|---|---|---|---|
| Intact | 76-100% | `Heart` | vert |
| Blessé | 51-75% | `Heart` | orange |
| Mal en point | 26-50% | `HeartCrack` | rouge |
| Agonisant | 1-25% | `HeartCrack` | rouge sombre |
| Mort | 0% | `Skull` | grisé |

### Distinction "a joué / n'a pas joué" ce round

- **A joué** : opacité réduite (0.5) + petite icône `CheckCheck` (12px) en coin
- **En attente** : apparence normale (opacité 1)
- **Actif** : fond accent, bordure colorée

### Footer sticky

**MJ :**
```
[←Préc]   [+Monstre]   [SUIVANT →]
 ghost      ghost        primary
```

**Joueur (pas son tour) :**
```
[Ma fiche]              [SUIVANT →]
 ghost                   disabled
```

**Joueur (son tour) :**
```
[Ma fiche]              [SUIVANT →]
 ghost                   primary
```

### Panneau joueur — Tout visible sans naviguer

En dessous de la timeline, le joueur voit un panneau fixe avec :
- **Ses HP** : barre + boutons -/+ pour modifier ses propres HP
- **Ses stats clés** : DEF, initiative, attaque contact/distance/magique
- **Ses actions de combat** : liste des actions disponibles (tirées de la page Actions existante `ActionsView`)

Ce panneau est toujours visible (pas besoin de naviguer vers "Ma fiche").

### Panneau monstre actif (MJ) — Bottom sheet

Tap sur un monstre → bottom sheet slide-up avec :
- Stats complètes, DEF, NC
- Liste des attaques (nom, bonus, dégâts)
- Liste des capacités (nom, description)
- Boutons HP -/+ rapides

### Ajout de monstre en combat — Bottom sheet

Bouton "+" → bottom sheet avec recherche bestiaire (même UX que l'éditeur de rencontre) :
- Recherche autocomplete dans MONSTERS_CATALOG
- Bouton "+" sur chaque résultat → ajoute instantanément
- Option "Custom" pour créer un monstre vierge
- **Broadcast SSE** à chaque ajout

### Tap sur carte joueur = expand inline

Tap sur un autre joueur → expand inline (nom complet, PV, stats). Pas de navigation directe pour éviter les taps accidentels. La navigation vers la fiche complète se fait via le bouton "Ma fiche" dans le footer.

---

## 5. Modal de lancement (dans CampaignView)

Bottom sheet (pas un vrai modal) :
- Liste des joueurs de la campagne (tous cochés par défaut), toggle pour exclure (grisé)
- Select de rencontre pré-sauvée + option "Combat vide"
- Bouton "Lancer le combat"
- Après création → naviguer vers `/campagnes/:id/combat/:cid`

### Onglet "Combat" dans CampaignView
- Nouveau tab visible par tous (joueurs + MJ) quand un combat actif existe
- Lien direct vers le combat en cours

---

## 6. Router

**Fichier** : `client/src/router/index.ts`

Ajouter : `{ path: '/campagnes/:id/combat/:cid', name: 'combat', component: CombatView }`

---

## 7. Fichiers à créer/modifier

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
- `client/src/views/CampaignView.vue` — bottom sheet lancement + onglet Combat
- `client/src/router/index.ts` — route combat

### Réutiliser
- `server/src/sessions/store.ts` — pattern SSE (writeSse, broadcastToSession)
- `client/src/composables/useSession.ts` — pattern composable SSE
- `client/src/utils/monsterSession.ts` — formatMod(), filterCatalog()
- `client/src/data/armorsCatalog.ts` — ARMORS_BY_ID, SHIELDS_BY_ID pour calcul initiative
- `client/src/data/monstersCatalog.ts` — pour ajout monstres en combat
- `client/src/views/ActionsView.vue` — référence pour les actions de combat du joueur

---

## Ordre d'implémentation

1. **DB** : schema + migration
2. **Server SSE store** : sseStore.ts pour combats
3. **Server routes** : combats.ts (création, next/prev-turn, HP, ajout monstre, finish, SSE)
4. **Client API** : combats.ts
5. **Client composable** : useCombat.ts
6. **CampaignView** : bottom sheet lancement + onglet Combat
7. **CombatView** : timeline cartes + footer sticky + panneau joueur + bottom sheet monstre
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
- Le MJ peut modifier les HP des monstres en 1 clic sur la timeline — broadcast SSE
- Les joueurs peuvent modifier leurs propres HP — broadcast SSE
- Les joueurs voient l'état qualitatif des monstres (icônes Heart/Skull)
- Le joueur voit ses stats et actions sans quitter la page combat
- Le MJ peut ajouter des monstres en cours de combat (renforts) — broadcast SSE
- Le MJ voit les capacités du monstre via bottom sheet
- Le combat est persisté en DB (visible dans l'historique)
- Le SSE synchronise TOUTES les mutations en temps réel
- Le MJ peut terminer le combat — broadcast SSE

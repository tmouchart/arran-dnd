# Plan 09 — Les jets sortent du combat : log au niveau campagne

## Contexte

Retour de Geoffrey (MJ) après la première soirée avec le log (plan 07) :

1. Les dés génériques (1d10, 1d20…) ne sont accessibles que dans le combat live → **on perd tous les jets hors combat**.
2. Le log lui-même est **« fouilli »**, et il n'existe que dans la page combat.
3. Sa proposition : une **barre horizontale de dés** dépliable via une flèche à côté des icônes, dispo partout ; et un **panneau latéral** pour le log, cachable en un clic, avec des **filtres « combat / PJ / PNJ / tout »**.

Objectif : le log de jets devient un objet de **campagne**, pas de combat. Le combat n'est plus qu'un tag sur les entrées.

## État des lieux

| Brique | Où | Portée actuelle |
|---|---|---|
| Table `combat_event` | `server/src/db/schema.ts:237` | `combat_id` **NOT NULL** → tout est lié à un combat |
| POST/GET rolls | `server/src/routes/combats.ts:473` / `:540` | `/:id/combats/:cid/rolls` |
| SSE | `server/src/combats/sseStore.ts` | `Map<combatId, clients>` — un flux **par combat** |
| Relais client | `useRollHistory.ts:80` | poste seulement si `activeCombat` est set |
| `useActiveCombat` | composable | connaît le combat, **pas** la campagne |
| `CombatLogPanel.vue` | composant | déjà commun MJ/joueur, aucune logique de rôle |
| `DiceSandbox.vue` | composant | utilisé dans `CombatView` et `JetsView` |
| `JetsView` (`/jets`) | vue | sandbox + historique **local** (localStorage) |

Le filtrage MJ/joueur vit côté serveur — on garde ce principe tel quel.

---

## 1. Database

Migration `server/src/db/migrations/17000000000XX_roll_events_campaign.sql` + `npm run db:migrate` dans la foulée.

```sql
ALTER TABLE combat_event RENAME TO roll_event;
ALTER TABLE roll_event ADD COLUMN campaign_id INTEGER REFERENCES campaign(id) ON DELETE CASCADE;
UPDATE roll_event e SET campaign_id = c.campaign_id FROM combat c WHERE c.id = e.combat_id;
ALTER TABLE roll_event ALTER COLUMN campaign_id SET NOT NULL;
ALTER TABLE roll_event ALTER COLUMN combat_id DROP NOT NULL;
ALTER TABLE roll_event ADD COLUMN actor_kind VARCHAR(10) NOT NULL DEFAULT 'player';
UPDATE roll_event SET actor_kind = 'monster' WHERE visibility = 'gm';
CREATE INDEX roll_event_campaign_idx ON roll_event (campaign_id, created_at DESC);
```

- `campaign_id` NOT NULL, `combat_id` nullable → **le combat devient un tag**.
- `actor_kind` (`player` | `monster`) : sert au filtre PJ/PNJ. Aujourd'hui déduit de `visibility`, mais les deux notions doivent être séparées (un jet de PNJ pourrait un jour être public).
- Renommage `combat_event` → `roll_event` : le nom ne veut plus rien dire. Une seule migration, ~5 fichiers touchés, c'est le bon moment.

Schema Drizzle : `combatEvents` → `rollEvents`, mêmes champs + les deux nouveaux.

## 2. Server

### Nouvelles routes — `server/src/routes/campaigns.ts`

**POST `/api/campaigns/:id/rolls`** (membre) — remplace `POST /:id/combats/:cid/rolls`.
- Body : le RollEntry (kind, label, context, die, sides, bonus, total, rolls?, damage?, asMonster?).
- `actorName` **imposé par le serveur** : nom du personnage du membre (`campaign_members.character_id` → `characters.name`), ou le nom du monstre si `asMonster` (MJ seulement, `visibility = 'gm'`, `actor_kind = 'monster'`).
- Le serveur résout lui-même le **combat actif** de la campagne et le stamp dans `combat_id` (NULL sinon). Le client n'a plus rien à savoir du combat.
- Broadcast SSE campagne.

**GET `/api/campaigns/:id/rolls?limit=200&filter=…`** (membre) — historique, filtré : les non-MJ ne reçoivent que `visibility = 'public'`. Le filtre UI (combat/PJ/PNJ) se fait côté client sur la liste déjà chargée — pas de round-trip.

**GET `/api/campaigns/:id/events`** (membre) — **nouveau flux SSE campagne**.
- Nouveau `server/src/campaigns/sseStore.ts`, copie de la mécanique existante : `Map<campaignId, Set<SseClient>>`, `broadcastCampaignRoll(campaignId, gmUserId, event)` qui saute les clients non-MJ sur `visibility === 'gm'`.
- Le flux SSE combat existant **ne bouge pas** (état du combat, initiative, HP). Pendant un combat le client aura donc 2 connexions SSE ouvertes. C'est le choix le moins invasif ; fusionner les deux flux serait un refactor à part.

### Routes supprimées
`POST/GET /:id/combats/:cid/rolls` disparaissent (remplacées). `broadcastCombatRoll` est retiré de `sseStore.ts` et le `CombatView` lit le log via le flux campagne.

**Sécurité inchangée** : anti-usurpation d'`actorName`, `visibility: 'gm'` réservé au MJ, filtrage serveur en SSE **et** en GET.

## 3. Client — plomberie

### `useActiveCampaign.ts` (nouveau) — remplace le rôle relais de `useActiveCombat`
- `GET /api/campaigns/mine` (existe déjà via `GET /api/campaigns`) → si l'utilisateur n'a **qu'une** campagne, c'est elle. Sinon, la dernière visitée (localStorage), sinon aucune.
- Set aussi quand on ouvre une `CampaignView` / une `CombatView`.
- `useActiveCombat` reste, mais uniquement pour la bannière « Combat en cours » — plus pour le relais des jets.

### `useRollHistory.addRoll()`
Une ligne change : le fire-and-forget devient `postCampaignRoll(activeCampaign.id, entry)` — **plus de condition sur un combat actif**. Tout jet, partout, part au log de la campagne. Échec réseau toujours silencieux (le localStorage reste la vérité locale).

### `useCampaignRolls.ts` (nouveau)
`rolls` ref + `connect(campaignId)` : `GET .../rolls` puis append sur les événements SSE `roll`. Même forme que `useCombat`. Un seul store partagé — la barre de log, `CombatView` et `/jets` lisent la même liste.

---

## 4. UX — propositions

### 4.1 Barre de dés dépliable

| | A — Tiroir sous la nav *(recommandé)* | B — FAB + bottom sheet | C — Dock bas permanent |
|---|---|---|---|
| Déclencheur | Chevron dans la top-nav, à côté des icônes | Bouton flottant dé, en bas à droite | Toujours visible |
| Ouverture | Bandeau pleine largeur qui glisse sous la nav | `AppBottomSheet` contenant `DiceSandbox` | — |
| Coût | 1 tap, aucun overlay, l'écran reste lisible | 1 tap mais masque l'écran | 0 tap, mange ~56px en permanence |
| Contre | Loin du pouce sur mobile | Cache le contenu, ferme après chaque jet | Vole de la place à une app déjà dense |

**Recommandation : A**, c'est exactement le modèle mental de Geoffrey. Détails :
- Nouveau `client/src/components/DiceBar.vue`, monté dans `App.vue` juste sous la `top-nav`. Il **réutilise `DiceSandbox`** tel quel — zéro duplication.
- Chevron `ChevronDown` / `ChevronUp` dans `.nav-links`, à côté des autres icônes (40px, `AppIconBtn`).
- État ouvert/fermé **persisté** en localStorage : le MJ le laisse ouvert toute la soirée, le joueur le referme.
- Le dernier résultat s'affiche **dans la barre** (gros total + détail mono), pas dans un bloc en dessous → la barre reste à ~2 lignes.
- Animation CSS keyframes sur l'ouverture uniquement (piège reka-ui / `Transition` documenté dans CLAUDE.md).
- Sur mobile la barre s'ancre en **bas** de l'écran (même composant, `position: sticky` inversée en `@media (max-width: 739px)`) pour rester sous le pouce. C'est le seul écart avec la proposition de Geoffrey, et il est purement CSS.
- `CombatView` perd ses deux `<DiceSandbox />` : la barre globale les remplace.

### 4.2 Panneau de log

| | A — Side panel off-canvas *(recommandé)* | B — Uniquement la page `/jets` | C — Bottom sheet |
|---|---|---|---|
| Déclencheur | Icône `ScrollText` + pastille non-lu dans la nav | Navigation normale | Idem A |
| Desktop | Colonne dockée à droite (400px), ne recouvre rien | Page pleine | Sheet, mal adapté au desktop |
| Mobile | Overlay 90% largeur qui glisse de la droite + backdrop | Page pleine | Occupe la moitié basse, on garde le contexte |
| Contre | Un peu de CSS d'off-canvas à écrire | On perd le « coup d'œil pendant l'action » | Se bat avec la barre de dés en bas |

**Recommandation : A**, et **`/jets` devient la vue "historique complet"** en réutilisant exactement le même composant. Une seule implémentation, deux points d'entrée.

Contenu du panneau :
- **En-tête** : titre « Jets », le nom de la campagne en muted, bouton `X`.
- **Filtres** : une rangée de chips segmentés — `Tout` · `Combat` · `PJ` · `PNJ`. Choix unique, défaut `Tout`, persisté. `PNJ` n'apparaît que si l'utilisateur a au moins une entrée `actor_kind = 'monster'` (donc de fait : le MJ seul, sans une ligne de `isGm` côté client). Sémantique : `Combat` = `combat_id != null`, `PJ` = `actor_kind = 'player'`, `PNJ` = `actor_kind = 'monster'`.
- **Séparateurs de combat** : une fine ligne « ⚔ Combat — Gobelins · round 3 » à chaque changement de `combat_id`. C'est ce qui répond directement au « c'est fouilli » : le log redevient lisible parce qu'il est segmenté.
- **Pastille non-lu** sur l'icône de nav quand un jet arrive panneau fermé (reset à l'ouverture). Pas de toast, pas d'ouverture auto.
- Plus récent **en haut**, toujours (on supprime le `newestFirst` conditionnel : un seul comportement, plus de surprise selon la taille d'écran).

### 4.3 Nettoyage de l'entrée de log (le « fouilli »)

`CombatLogPanel.vue` → renommé `RollLogPanel.vue`, et resserré :
- **Groupement** : jets consécutifs du même acteur → un seul bloc avec le nom en tête, les jets suivants en lignes nues. Un tour de combat = un bloc, plus 5 cartes qui répètent « Thorin ».
- Le suffixe texte « depuis Mes actions » devient une **icône muted** (`Swords` / `ScrollText` / `Dices` / `HeartCrack`) avec un `title`. C'est la ligne 1 qui déborde aujourd'hui.
- Heure en **relatif** (`à l'instant`, `2 min`), heure absolue en `title`.
- Crit / fumble : on garde le bandeau, mais réduit à un **liseré coloré à gauche + le total coloré**. Aujourd'hui ça fait passer l'entrée à 3 lignes et ça casse le rythme de la liste.
- Densité cible : **1 ligne** par jet dans un bloc groupé, 2 lignes pour le premier jet d'un acteur.

---

## Ordre d'implémentation

1. **DB** — migration + schema Drizzle → *verify* : `npm run db:migrate` passe, les anciennes lignes ont un `campaign_id`.
2. **Server** — `campaigns/sseStore.ts` + POST/GET rolls + SSE campagne ; suppression des routes combat → *verify* : test unitaire du filtrage gm/public sur le nouveau store + curl POST hors combat → ligne en DB avec `combat_id = NULL`.
3. **Client plomberie** — `useActiveCampaign`, `useCampaignRolls`, `addRoll` qui poste toujours → *verify* : jet depuis la fiche, aucun combat en cours → apparaît chez le MJ en live.
4. **DiceBar** — composant + chevron dans la nav + retrait des `DiceSandbox` de `CombatView` → *verify* : lancer un d20 depuis `/journal`, il arrive dans le log.
5. **RollLogPanel** — renommage, groupement, filtres, off-canvas, pastille ; `/jets` et `CombatView` branchés dessus → *verify* : 2 navigateurs (MJ + joueur), le joueur ne voit aucun jet PNJ, ni en live ni au refresh.

## Vérification finale

- Jet lancé **sans aucun combat** → visible par le MJ et les joueurs en temps réel, avec le bon contexte.
- Barre de dés accessible depuis **n'importe quelle page**, état ouvert/fermé conservé au changement de page.
- Panneau de log ouvrable/fermable en un clic, filtres `Tout/Combat/PJ/PNJ` corrects.
- Pendant un combat, les jets sont bien taggés combat et regroupés sous leur séparateur.
- Refresh → log rechargé depuis la DB, aucune fuite de jet PNJ vers un joueur.
- Un joueur ne peut ni poster `visibility: 'gm'` ni usurper `actorName` (test de route).

# Plan 07 — Log temps réel des jets en combat

## Context

Demande de Geoffrey (MJ, pour ce soir) : un log temps réel des combats — voir les jets des PJ les uns après les autres. « À gauche l'ordre, à droite le log. »

Règles de visibilité :
- **Jets des joueurs** : visibles par tout le monde.
- **Jets des monstres (faits par le MJ)** : visibles uniquement par le MJ.

Décisions (Thomas, 8/12) :
- **Tous** les jets d'un joueur pendant un combat actif remontent au log, peu importe la page d'où ils sont lancés (Mes actions, fiche, agonie, sandbox…).
- **Max de contexte** par entrée : qui, quelle action/arme, type de dé, détail du résultat (dé + bonus = total, dégâts).
- Temps réel via le SSE existant, obligatoire.
- **Un seul composant log**, commun MJ/joueurs. Aucune logique de rôle côté client : le filtrage des jets monstres se fait uniquement côté serveur (SSE + GET).

## État des lieux (déjà en place — on réutilise tout)

- **SSE par combat** : `server/src/combats/sseStore.ts` — `Map<combatId, Set<SseClient>>`, chaque client porte son `userId`, le broadcast filtre déjà GM vs joueur. Il suffit d'ajouter un nouveau type d'événement.
- **Jets structurés côté client** : `RollEntry` (`useRollHistory.ts`) — kind, label, die, sides, bonus, total, damage. Les jets sont lancés dans `ActionsView.vue`, `CombatView.vue`, `useDualWield.ts`, `AgonieModal.vue` — tous passent par `addRoll()`. **Mais tout est local (localStorage), rien ne part au serveur.**
- **CombatView** : timeline d'initiative déjà là (= la colonne « gauche » de Geoffrey).

Le travail = faire remonter les jets au serveur, les rebroadcaster filtrés, les afficher dans un panneau log.

---

## 1. Database

**Fichier** : `server/src/db/schema.ts` + migration `server/src/db/migrations/1700000000030_combat_events.sql` (puis `npm run db:migrate`).

### Table `combatEvents`
| Colonne | Type | Notes |
|---|---|---|
| id | serial PK | |
| combatId | FK→combats | ON DELETE CASCADE |
| userId | FK→users | qui a lancé (joueur, ou MJ pour un monstre) |
| actorName | text | nom du perso ou du monstre affiché dans le log |
| visibility | varchar(10) | `'public'` / `'gm'` |
| kind | varchar(20) | RollKind client (`weapon`, `action`, `ability`, `manoeuvre`, `competence`, `libre`) |
| label | text | ex. « Épée longue », « Jet de FOR », « Agonie » |
| context | varchar(30) | d'où vient le jet : `actions`, `combat`, `fiche`, `agonie`, `sandbox`… |
| die | integer | valeur du (premier) dé |
| sides | integer | 20, 12 (affaibli), ou autre (sandbox) |
| bonus | integer | |
| total | integer | |
| rolls | jsonb | nullable — dés individuels pour les jets multi-dés (`2d6+3`) |
| damage | jsonb | nullable — `{ total, critical, fumble }` |
| createdAt | timestamp | default now() |

Une entrée du log doit permettre d'afficher : **« Thorin — Épée longue (attaque) : d20 = 14 + 5 → 19 · dégâts 8 »**.

Persister en DB (pas seulement SSE) pour que le log survive à un refresh / une reconnexion, et pour l'historique du combat.

---

## 2. Server — `server/src/routes/combats.ts`

### POST `/:id/combats/:cid/rolls` (membre)
Body = le RollEntry (kind, label, die, sides, bonus, total, damage?, + `asMonster?: string` pour le MJ).
- Joueur : `visibility = 'public'`, `actorName` = nom de son perso (participant du combat, pas du body — anti-spoof).
- MJ avec `asMonster` : `visibility = 'gm'`, `actorName` = le nom du monstre. Seul le MJ peut poster en `gm`.
- Insert en DB puis **broadcast SSE** d'un nouvel événement `combat-roll` (l'événement seul, pas tout le state) — envoyé à tous les clients si `public`, seulement au client MJ si `gm`. Nouvelle fonction `broadcastCombatRoll(combatId, gmUserId, event)` dans `sseStore.ts`.

### GET `/:id/combats/:cid/rolls` (membre)
Liste des events du combat (ordre chrono, limite ~200). Filtre : les non-MJ ne reçoivent que `visibility = 'public'`. Chargé à l'ouverture de la vue combat (le SSE ne fait que le flux live).

**Tout le filtrage MJ/joueur vit ici et dans le broadcast SSE — le client ne connaît aucune règle de visibilité.**

### GET `/api/combats/active` (auth)
Nouvelle route (hors scope campagne) : renvoie le combat `active` le plus récent parmi les campagnes dont l'utilisateur est membre ou MJ (`{ campaignId, combatId } | null`). Sert au relais global des jets (voir client).

---

## 3. Client

### `client/src/api/combats.ts`
- `postCombatRoll(campaignId, cid, roll)` / `fetchCombatRolls(campaignId, cid)`.

### Relais des jets vers le serveur — TOUS les jets, depuis n'importe quelle page
Point clé : les jets sont lancés à plusieurs endroits, tous via `useRollHistory().addRoll()`. Décision : tout jet fait **pendant qu'un combat actif existe dans une campagne du joueur** est relayé, même hors de la page combat.

- Nouveau module `client/src/composables/useCombatRollRelay.ts` :
  - Ref global `activeCombat: { campaignId, combatId } | null`.
  - Au login / au montage de l'app (`App.vue` ou `useAuth`), un appel `GET /api/combats/active` (nouvelle route serveur : le combat actif le plus récent parmi les campagnes de l'utilisateur) initialise `activeCombat`. `useCombat` le met aussi à jour à la connexion/fin du combat.
  - Refresh léger : re-check quand l'app revient au premier plan (`visibilitychange`) — pas de polling.
- `addRoll()` (dans `useRollHistory.ts`) prend un paramètre `context` (`'actions' | 'fiche' | 'agonie' | 'sandbox' | 'combat'…`) fourni par chaque site d'appel (petite retouche des ~7 sites, juste un argument) : si `activeCombat` est set, fire-and-forget `postCombatRoll(...)` avec le RollEntry complet + context. Échec réseau silencieux (le jet local reste la vérité pour le joueur).

### Jets de monstres (MJ)
Dans le bottom sheet monstre de `CombatView` (stats + attaques déjà affichées) : bouton dé sur chaque attaque → `rollDie(20) + bonus`, posté avec `asMonster: monstre.name` → visible MJ uniquement. Minimal : un seul bouton « jet d'attaque » par ligne d'attaque.

### `useCombat.ts`
- `rolls` ref, alimenté par `fetchCombatRolls` au connect puis par les événements SSE `combat-roll` (append).

### UI — `CombatView.vue` + nouveau `client/src/components/combat/CombatLogPanel.vue`
Design mobile validé par l'agent UX (proposition tranchée) :

- **Desktop/tablette (≥ ~900px)** : 2 colonnes — timeline initiative à gauche, log à droite (exactement la demande de Geoffrey). Grid simple dans CombatView.
- **Mobile : le log est un 3ᵉ onglet « Jets » plein écran** dans la tab-bar existante de CombatView (pas de bottom sheet ni bandeau flottant — l'écran a déjà 2 couches d'overlay, un 3ᵉ calque masquerait la timeline). Icône `ScrollText`.
  - La tab-bar s'ouvre aussi au MJ (aujourd'hui `v-if="!isGm"` la cache) : MJ = Combat / Jets, joueur = Combat / Mes actions / Jets.
  - **Notification** : pastille 8px couleur accent sur l'onglet quand un jet arrive et que l'onglet n'est pas actif (`hasUnseenRoll`, reset au clic). Pas de toast, pas de bascule auto d'onglet.
  - **Ordre inversé sur mobile** (plus récent en haut) : le dernier jet toujours visible sans scroller. Desktop garde le flux type chat avec auto-scroll. Même composant, juste l'ordre qui change.
  - Entrée = 2 lignes fixes (~44-48px, même densité que les cartes timeline compactes) :
    - Ligne 1 : point coloré joueur/monstre (même langage que la timeline) + `Nom · Label · type` + suffixe muted « depuis Mes actions » si `context !== 'combat'` (tronqué en premier) + badge `EyeOff` si `visibility: 'gm'`.
    - Ligne 2 : `d20 = 14 +5 → 19 · dégâts 8` en police mono, heure à droite en petit.
  - **Crit/fumble** : bandeau plein-largeur au-dessus de l'entrée (réutiliser les styles `monster-roll-crit` / `--critical` / `--fumble` déjà dans CombatView) — seul cas où l'entrée passe à 3 lignes.
  - Empty/loading : `AppEmptyState`.
  - Footer sticky inchangé quel que soit l'onglet ; aucun bouton d'action dans l'onglet Jets (flux passif).
- **Un seul composant, identique pour tous** : il affiche bêtement la liste `rolls` reçue — le MJ voit plus d'entrées uniquement parce que le serveur lui en envoie plus. Pas de `isGm` dans le panel.
- Chaque entrée, avec tout le contexte : nom acteur, label + kind (« Épée longue · attaque »), contexte d'origine si hors combat (« depuis Mes actions »), `d20 = 14 + 5 → 19`, dégâts éventuels, badge crit/fumble (réutiliser `rollHighlight` de `useRollHistory.ts`), heure. Entrées `visibility: 'gm'` avec un badge `EyeOff` « MJ » (simple rendu d'un champ présent dans la donnée, pas une logique de rôle).
- Auto-scroll en bas à chaque nouvel event ; nouveaux jets avec une petite animation d'apparition.

---

## Ordre d'implémentation (scopé « ce soir »)

1. **DB** : table + migration → verify : `npm run db:migrate` passe.
2. **Server** : POST/GET rolls + `broadcastCombatRoll` → verify : test unitaire sseStore (filtrage gm/public) + curl.
3. **Client relais** : api + `useCombatRollRelay` (+ route `/api/combats/active`) + hook dans `addRoll` avec `context` → verify : jet depuis « Mes actions » sans page combat ouverte → ligne en DB avec le bon contexte.
4. **UI log** : `CombatLogPanel` + intégration 2 colonnes / bottom sheet → verify : 2 navigateurs (MJ + joueur), le joueur voit les jets PJ en live, pas ceux des monstres.
5. **Jets monstres MJ** : boutons dans le bottom sheet monstre → verify : jet monstre visible MJ, invisible joueur.

Si le temps manque : l'étape 5 est détachable (le MJ peut lancer ses dés physiques ce soir, le log PJ est l'essentiel de la demande).

## Vérification finale

- Joueur lance une attaque → apparaît instantanément (SSE) chez le MJ et les autres joueurs, avec acteur, action, dé, détail du total.
- Jet depuis « Mes actions » / fiche / agonie / sandbox pendant un combat actif → apparaît aussi dans le log avec son contexte d'origine.
- Refresh de la page → le log est rechargé depuis la DB.
- Jet monstre du MJ → visible MJ seulement (vérifier aussi le GET : pas de fuite en refetch).
- Un joueur ne peut pas poster `visibility: 'gm'` ni usurper `actorName` (test route).
- Crit/fumble mis en avant dans le log.

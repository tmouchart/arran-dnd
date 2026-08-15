# 14 — Repos partagé (feu de camp)

Idée #1 de `13-idees-game-design.md`. Le MJ appuie sur « Repos », tout le groupe voit
un feu de camp en plein écran, et chacun retrouve sa fiche rechargée.

---

## 1. Les règles du repos dans Arran (CO)

Extraits exacts de `knowledge/topics/`.

**`combat.md` (l. 238-245) — Points de récupération (PR)**
```
Chaque personnage possède 5 PR (Ogre : 6).
- se reposer environ 5 minutes : dépenser 1 PR pour regagner PV = [1 DV + Mod. de CON + niveau].
- PR comme fatigue : chaque épreuve éreintante consomme 1 PR.
- nuit de repos : après 6 à 8 heures de sommeil, regagne 1 PR (sans dépasser le maximum de base).
- le MJ peut refuser le gain en cas de stress/inconfort et demander un test de CON réussi (DD 10 ou 15).
```

**`magie.md` (l. 26-29) — Récupération des PM**
```
- Chaque nuit, après six à huit heures de sommeil ininterrompu dans de bonnes conditions,
  le personnage récupère tous les PM perdus.
- Le MJ peut ne rendre qu'une partie des PM (stress, inconfort, combat en pleine nuit, etc.)
  — en général la moitié ou rien.
```

**`creation-personnage.md` (l. 185 et 196)**
```
PC — récupération à chaque passage de niveau
PM — récupération : après une nuit complète de repos.
```

**`equipement.md` (l. 249-252)** — herbes médicinales : 2 PR au lieu d'1 ; baume de Lyz'rha : 3 PR ;
venin d'Arkelle et élixir d'Ozar : +1 PR immédiat hors repos.

**Cas particuliers** — Ogre : PR max 6 (`races.md:374`). Elfe blanc : moitié du repos suffit
(`races.md:85`). Vitalité débordante : 1d6 PV/heure de jour comme de nuit (`voies-de-profil.md:81`).

### Ce que les règles disent (et ne disent pas)

| Ressource | Repos court (5 min) | Nuit (6-8 h) |
|---|---|---|
| **PV** | `1 DV + Mod. CON + niveau`, **en payant 1 PR** | **rien d'automatique** |
| **PM** | rien | **tous** (MJ : moitié ou rien si conditions rudes) |
| **PR** | **-1** (c'est le coût) | **+1**, plafonné à 5 (Ogre 6) |
| **PC** | rien | rien — ils reviennent **au passage de niveau** |

⚠️ **Aucune règle CO ne rend les PV « au max ».** Le repos complet du §2 est donc une
**maison-règle assumée** — celle du MJ qui remet tout à neuf entre deux sessions.

---

## 2. Deux repos partagés, et un troisième qui reste individuel

**Le repos court n'est pas dans cette feature.** Dépenser 1 PR pour regagner des PV est
une **décision de joueur**, pas de MJ : un perso à pleine vie n'a aucune raison de brûler
un PR. Il reste où il est — le bouton « Repos » de `ActionsView.vue` (`confirmerRepos`),
qu'on ne touche pas.

Le MJ ne pilote que les deux repos qui s'appliquent à tout le monde, sans coût ni choix :

| | Durée fiction | PV | PM | PR | PC | Affaibli |
|---|---|---|---|---|---|---|
| 🌙 **Long** | une nuit | — | **max** | **+1** | — | levé |
| ✨ **Complet** | entre deux sessions | **max** | **max** | **max** | **max** | levé |

- **Long** — la règle stricte de la nuit. Pas de PV : c'est voulu, c'est ce qui donne du
  poids aux PR et aux soins.
- **Complet** — la maison-règle. Tout au max, PC compris. Le bouton « nouvelle session,
  on repart propre ».

Le MJ ne descend jamais un « MJ peut ne rendre que la moitié des PM » automatiquement :
s'il veut punir la nuit, il lance un **Long** et ajuste à la main. On n'ajoute pas
un 3e mode pour ça.

---

## 3. Architecture

Rien de neuf côté transport : la campagne a **déjà** un flux SSE
(`server/src/campaigns/sseStore.ts`, `useCampaignRolls.ts`). On s'y branche.

```
MJ tape "Repos" (long | complet)
  → POST /api/campaigns/:id/rest  { kind }
      serveur : recalcule chaque perso membre, UPDATE en base   ← source de vérité
      serveur : broadcast SSE  event: rest  { kind, deltas: [ {userId, hp, mp, pr} ] }
  → chaque client : feu de camp three.js (clic = skip)
  → puis modal « Ce qui a changé sur ta fiche »
```

Pourquoi le serveur applique et pas chaque client : un joueur hors ligne (app fermée,
écran verrouillé) doit quand même se réveiller rechargé. La base est mise à jour pour
tout le monde ; le SSE ne sert qu'à jouer l'animation et à rafraîchir les fiches ouvertes.

**Pas de nouvelle table.** L'état vit dans `characters`. Un log persistant du repos
n'apporte rien pour l'instant.

**Piège repéré — les PC.** `hpMax` et `mpMax` sont des colonnes, le serveur les lit
directement. `pcMax` **n'existe pas** : il est calculé côté client
(`computedPcMax` = `2 + Mod. CHA + 2 si aventurier`, via `inferProfileFamily(paths)`).
Plutôt que dupliquer l'inférence de famille sur le serveur, le **repos complet** laisse
`pcCurrent` au client : il reçoit l'event, pose `pcCurrent = computedPcMax` et
l'autosave normal l'écrit. Seul effet de bord : un joueur hors ligne récupère ses PC
au prochain lancement de l'app, pas avant. Acceptable pour une ressource qui ne sert
qu'en séance.

---

## 4. Fichiers

### Serveur

| Fichier | Changement |
|---|---|
| `server/src/campaigns/sseStore.ts` | extraire `broadcastCampaignEvent(campaignId, name, payload)` ; `broadcastCampaignRoll` devient un appel dessus (le filtre `visibility` reste dans le roll). |
| `server/src/campaigns/rest.ts` **(nouveau)** | `applyRest(character, kind)` **pur** → `{ hpCurrent, mpCurrent, prCurrent, affaibli }`. Toute la règle est là. |
| `server/src/campaigns/rest.test.ts` **(nouveau)** | long : PM au max, PR +1, PV intouchés, plafond PR à 5 déjà atteint, `affaibli` levé. complet : PV et PM au max, PR à 5. Perso à 0 PV. |
| `server/src/routes/campaigns.ts` | `POST /:id/rest` — **MJ uniquement** (`verifyMember` + `gmUserId`), valide `kind`, charge les persos des membres, applique, UPDATE, broadcast. |

### Client

| Fichier | Changement |
|---|---|
| `client/src/api/campaigns.ts` | `postRest(campaignId, kind)` + types `RestKind = 'long' \| 'complet'`, `RestEvent`. |
| `client/src/composables/useRest.ts` **(nouveau)** | état global : `restEvent` (déclencheur d'anim, à la manière de `diceRequest`), `myDelta`. Reçoit l'event SSE, garde le delta du joueur courant. Sur `complet`, pose aussi `pcCurrent = computedPcMax`. |
| `client/src/composables/useCampaignRolls.ts` | écouter `event: rest` en plus de `roll` → pousse dans `useRest`. |
| `client/src/utils/campfire/flame.ts` **(nouveau)** | sim **pure** : particules de flamme + braises (position, taille, opacité en fonction de `t`). Aucun import three. |
| `client/src/utils/campfire/flame.test.ts` **(nouveau)** | bornes, montée, extinction, déterminisme. |
| `client/src/components/campfire/CampfireOverlay.vue` **(nouveau)** | le rendu three.js. Monté une fois dans `App.vue`, à côté de `Dice3DOverlay`. |
| `client/src/components/campfire/RestSummaryModal.vue` **(nouveau)** | `AppModal` « Ce qui a changé » : PV 7 → 24, PM 0 → 12, PR 3 → 4. Une ressource inchangée ne s'affiche pas. |
| `client/src/composables/useCharacter.ts` | `applyServerRest(values)` sur le modèle exact de `applyServerHp` : applique **sans** déclencher l'autosave (sinon la fiche locale périmée réécrase le serveur). |
| `client/src/views/CampaignView.vue` | bouton MJ 🔥 (`Flame`, Lucide) dans les actions du header → `AppModal` de choix : Long / Complet, chacun avec sa ligne d'effet. |
| `client/src/App.vue` | monte `<CampfireOverlay />` + `<RestSummaryModal />`. |

---

## 5. Le feu de camp (three.js)

Même moule que `Dice3DOverlay.vue` — c'est le patron qui marche déjà :
`import('three')` dynamique au premier usage, renderer gardé, boucle rAF seulement
pendant l'animation, `broken = true` si pas de WebGL.

**Ce qui change par rapport aux dés** : ici on **assombrit** l'écran. Un voile CSS
(fondu 400 ms) sous le canvas, et le canvas capte les pointeurs (contrairement aux dés)
puisque tout est bloqué le temps de l'animation.

Scène, du plus simple au plus joli :

1. **Voile** — fondu à l'entrée, l'app disparaît doucement.
2. **Bûches** — 3 cylindres bas-poly croisés, `MeshStandardMaterial` sombre.
3. **Flamme** — un seul `Points` additif avec `buildSparkTexture()` (déjà écrit dans
   `utils/dice3d/atlas.ts`, on le réutilise tel quel), ~80 particules qui montent,
   rétrécissent et passent de `--brand` au rouge. Un seul draw call.
4. **Braises** — une dizaine de points lents qui s'échappent vers le haut et sortent
   du cadre.
5. **Lumière** — une `PointLight` chaude au cœur du feu, intensité qui **respire**
   (bruit lent) : c'est elle qui fait le « cozy », plus que les particules.
6. **Halo au sol** — un disque dégradé, additif, qui pulse avec la lumière.

Le feu **change avec le repos** — même scène, deux réglages, zéro code en plus :

| | Durée | Feu | Voile |
|---|---|---|---|
| Long | 4,5 s | feu franc, braises qui montent | nuit (0,72) |
| Complet | 6 s | grand feu, halo large, respiration lente | profond (0,82) |

**Clic n'importe où = skip** → fondu immédiat → modal.

Garde-fous, comme pour les dés :
- `prefers-reduced-motion` ou pas de WebGL → **pas d'animation**, on va direct à la modal.
- Le résultat est **déjà** en base avant l'animation : elle ne peut jamais mentir, et
  la couper ne perd rien.

---

## 6. Étapes et vérifications

1. **Règles pures** — `server/src/campaigns/rest.ts` + tests
   → vérif : `npm test -w server` vert sur long et complet.
2. **Route + broadcast** — `POST /:id/rest`, `broadcastCampaignEvent`
   → vérif : curl avec le JWT local (recette du CLAUDE.md) ; après un `long` la fiche en
   base a PM max et PR +1 et **PV inchangés** ; après un `complet` tout est au max ;
   un non-MJ prend un 403 ; un `kind` inconnu prend un 400.
3. **Réception client** — `useRest` + `applyServerRest`
   → vérif : deux onglets, deux comptes ; le joueur voit ses PV changer sans reload,
   et **aucun** PUT de fiche ne part de son navigateur (onglet Réseau) — sauf sur
   `complet`, où le seul PUT attendu porte les PC.
4. **Modal récap** — `RestSummaryModal`
   → vérif : les lignes affichent le bon avant → après ; rien pour une ressource
   inchangée (un perso à pleine vie ne voit pas de ligne PV après un `complet`).
5. **Feu de camp** — sim pure + tests, puis le rendu
   → vérif : `npm test -w client` ; à l'œil sur téléphone ; clic = skip ;
   `prefers-reduced-motion` saute l'animation.
6. **Bouton MJ** — `CampaignView`
   → vérif : visible pour le MJ seul, ≤ 7 boutons dans la barre.

---

## 7. Hors scope (volontairement)

- **Repos court** : reste individuel, dans `ActionsView.vue`. C'est un choix de joueur
  (payer 1 PR), pas une action de MJ.
- **Capacités limitées** (idée #2) : le compteur n'existe pas encore. Le repos les
  rechargera quand il existera — c'est un autre chantier.
- Tests de CON du MJ, herbes médicinales, Baume de Lyz'rha.
- Ligne « repos » dans le journal / le log de jets.

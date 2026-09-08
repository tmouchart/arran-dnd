# 19 — Retours de la dernière session

Neuf retours de jeu, triés après enquête dans le code. Chaque item est
classé **bug** (le code contredit sa propre intention ou les règles) ou
**feature** (rien n'existe, rien ne casse).

Règle du chantier : **chaque bug est reproduit par un test unitaire ET un
test e2e qui échouent avant le fix**, et passent après. Les features ont
aussi leurs tests, mais on ne demande pas de « reproduction » (il n'y a
rien à reproduire).

Implémentation déléguée à des agents Opus 5, un lot par agent, sur des
fichiers disjoints autant que possible.

---

## Synthèse

| # | Retour | Verdict | Lot |
|---|---|---|---|
| 2 | Le MJ ne voit aucun jet | **Bug** (2 causes) | A |
| 1 | Manque les jets de dés du MJ | Bug (silence) + feature (jet secret) | A |
| 6 | Croissance : taper 3 donne 6 | **Bug** | B |
| 8 | PV bloqués à 24/31 | **Bug** (double source de vérité) | B |
| 5 | Bonus custom sur les PV | Feature | B |
| 7 | Flamboyante + Escrime | Feature (rien n'est calculé) + 1 bug annexe | C |
| 9 | Passifs (+2 INT, 2d20) | Feature (aucun moteur d'effets) | D |
| 4 | Concentration des mages | Feature (règle écrite, jamais codée) | E |
| 3 | Ajouter un PJ en combat en cours | Feature | F |

---

## Lot A — Les dés et le MJ

### A1. « Le MJ voit aucun jet » — BUG, deux causes qui se cumulent

**Cause 1 : pas de campagne active → pas de flux.**
`App.vue:56-61` n'ouvre le flux SSE que si `user.activeCampaignId` est
renseigné. Or ce champ n'est écrit que par : création de campagne
(`campaigns.ts:71`), `join` (interdit au MJ, `:158-161`) et `leave`
(`:219`, recalculé depuis les membres, où le MJ n'est jamais). Aucune UI
ne permet de le (ré)activer. Cas concrets : MJ qui a rejoint une autre
campagne comme joueur, campagne supprimée (`DELETE /:id` ne nettoie pas
la colonne, pas de FK), compte antérieur à la feature.
Et tout est silencieux : pas de `onerror` sur l'EventSource
(`useCampaignRolls.ts:127`), `syncHistory` et `postCampaignRoll` avalent
les erreurs.

**Cause 2 : le flux se coupe après 25 min et ne revient pas.**
`useCampaignRolls.ts:18` `IDLE_MS = 25 min`. Le timer n'est réarmé que
par un event reçu ou par `wake()`. `wake()` n'est appelé que quand *je*
lance un dé, quand j'ouvre le panneau, ou au `visibilitychange`. Le MJ
est exactement celui qui ne lance pas de dés et laisse l'écran allumé :
25 min de calme et il perd tous les jets jusqu'à la fin de la soirée.
`closeStream()` ne remet pas `connectedCampaignId` à null, donc rien ne
signale la coupure.

Pourquoi le e2e actuel passe : le seed force `activeCampaignId` du MJ
(`server/src/dev/seed.ts:108-111`) et le test dure 10 secondes.

**Confirmé en prod (2026-09-08)** : le MJ « Rhada » (user 15, MJ de la
campagne 2) a `active_campaign_id = NULL`. Il n'a **aucun** jet
personnel en base, jamais. Ses jets de monstres en combat sont bien
passés (108 événements le 3 septembre) parce que `CombatView` prend
l'id de campagne dans l'URL (`CombatView.vue:51,280`), pas dans
`activeCampaignId`. C'est la cause 1, dès le début de soirée. La cause 2
(timeout 25 min) reste vraie mais n'a pas eu l'occasion de jouer.
Réparation immédiate possible : `UPDATE "user" SET active_campaign_id = 2
WHERE id = 15` (à faire avec l'accord de Thomas).

**Fix :**
- Le MJ d'une campagne ouverte (`/campagnes/:id`, `/combat`) devient
  membre « actif » de cette campagne : visiter `CampaignView` /
  `CombatView` pose `activeCampaignId` (c'est ce que prévoyait
  `plans/09-log-jets-campagne.md:83-86`, jamais écrit). Le MJ garde la
  priorité sur sa propre campagne.
- `DELETE /campagnes/:id` remet à null les `activeCampaignId` qui
  pointaient dessus.
- Le flux se réveille tout seul : `onerror` → reconnexion avec backoff ;
  après une coupure idle, tout event *sortant* ou toute interaction de
  page (`pointerdown`, `keydown`, throttlé) appelle `wake()`. `IDLE_MS`
  surchargeable (`import.meta.env.VITE_ROLLS_IDLE_MS`) pour le e2e.
- `closeStream()` remet l'état à « déconnecté ».

**Tests :**
- Unit `useCampaignRolls.test.ts` : stub `EventSource` + fake timers.
  (a) après `IDLE_MS` le flux est fermé, (b) `wake()` le rouvre et rejoue
  `syncHistory`, (c) `onerror` reconnecte. Le (a)+(b) sans le fix montre
  que rien ne rouvre.
- Unit `useRollHistory.test.ts` : `activeCampaignId = null` →
  `postCampaignRoll` jamais appelé (caractérisation du silence).
- Unit serveur `campaigns` : supprimer une campagne remet à null les
  `activeCampaignId` orphelins.
- E2E `05-jets.spec.ts` :
  1. MJ avec `activeCampaignId = null` (nouvelle fixture, ou reset via
     script avant le test) ouvre `/campagnes/:id` → un jet joueur arrive
     dans son log. Échoue aujourd'hui.
  2. `VITE_ROLLS_IDLE_MS=2000` sur le build e2e : MJ ouvre la page,
     attend 3 s sans rien faire, joueur lance → le jet arrive. Échoue
     aujourd'hui.

### A2. « Manque les jets de dés du MJ » — bug de silence + feature

**Ce qui existe :** la barre de dés est globale (`App.vue:138`), le MJ
peut cliquer. Le serveur le loggue bien comme « MJ »
(`campaigns.ts:678`). Mais si `activeCampaignId` est vide, le jet reste
local, sans message (`useRollHistory.ts:75-77`). Même racine que A1,
même fix.

**Ce qui manque :** un jet **secret** hors combat. Aujourd'hui
`visibility: 'gm'` n'existe que via `asMonster` en combat
(`campaigns.ts:668-681`, `CombatView.vue:279-294`).

**Fix :** dans `DiceSandbox`, quand l'utilisateur est MJ de la campagne
active, un toggle « œil » (Lucide `EyeOff`) : jet secret → `visibility:
'gm'`. Cosmétique : le nom local « Nouveau héros » (`DiceSandbox.vue:51`)
devient « MJ » quand pas de fiche.

**Tests :**
- Unit `sseStore.test.ts` : un jet `visibility: 'gm'` sans `asMonster`
  n'est diffusé qu'au MJ (déjà couvert en partie, étendre).
- E2E `05-jets.spec.ts` : MJ lance un d20 public → visible dans le log
  de bracco. MJ lance un d20 secret → visible chez le MJ, absent chez
  bracco.

---

## Lot B — Les PV

### B1. « Croissance : taper 3 donne 6 » — BUG

`HpGrowthModal.vue:94-102` : `<input type="number">` non contrôlé,
`@input` → `setRoll()` qui clampe **à chaque frappe** sur `[1, dieMax]`.
Le champ contient déjà `6` (défaut = `dieMax` pour un d6). Taper `3`
sans avoir tout sélectionné donne `63` → clampé à `6`. Et comme la valeur
du modèle ne change pas (6 → 6), Vue ne repatche pas le DOM : le champ
affiche `63` alors que le modèle dit 6.
Même bug dans `LevelUpModal.vue:58-68` (taper `12` dans un d10 fige à 10
dès le `1`).

**Fix :** clamper sur `@change` (blur/entrée), pas sur `@input`. Passer
par `AppInput` (règle du repo, jamais de `<input>` nu) avec `v-model`
local et normalisation à la sortie. Forcer la resynchro DOM quand le
clamp retombe sur la valeur précédente. Extraire `clampHpRoll(value,
dieMax)` dans `client/src/utils/hpRoll.ts`.

**Tests :**
- Unit `hpRoll.test.ts` : `clampHpRoll(63, 6) === 6`, `clampHpRoll(0, 6)
  === 1`, `clampHpRoll(3, 6) === 3`.
- Unit composant (`@vue/test-utils`) `HpGrowthModal.test.ts` : taper
  `63` puis `3` (simulant la frappe) sans `change` → aucune émission qui
  écrase ; `change` avec `3` → émission `[..., 3, ...]`. Échoue
  aujourd'hui.
- E2E `02-fiche.spec.ts` : ouvrir Croissance (`data-testid="hp-growth-
  open"` à poser sur le chip `ResourcesCard.vue:76-83`), `fill('3')` sur
  `hp-growth-input-2`, blur, vérifier `hp-max` = attendu, reload, tient.

### B2. « PV bloqués à 24/31 » — DEUX BUGS, confirmés en prod

**Preuve en base (Minizou, id 5)** : niveau 5, CON 13, mystique (d6),
`hp_level_gains = [5, 5, 4]` → **3 jets pour 4 niveaux gagnés**,
`hp_max = 31`, `hp_current = 24`. Et ce n'est pas isolé : **les 6
personnages de niveau 5 de la campagne ont tous 3 jets au lieu de 4**
(le passage au niveau 5 a eu lieu après le 11 août). Les fiches de
niveau 6 et 7 sont antérieures et complètes.

**Bug 1 — le serveur jette les jets de croissance.** Le correctif
sécurité du 11 août (`4ec1137`, anti mass-assignment) a introduit la
liste blanche `UPDATABLE_FIELDS` (`characters.ts:166-172`). Elle a oublié
`hpLevelGains`. Le client l'envoie bien (`useCharacter.ts:112`), le
serveur le filtre en silence. Toutes les montées de niveau depuis le 11
août ont perdu leur jet de PV.

**Bug 2 — au chargement, l'ordre des watchers rabat les PV courants.**
`applyLoaded` charge 3 jets pour un niveau 5. Deux watchers se
déclenchent dans le même flush, dans l'ordre de déclaration :
1. `watch(computedHp)` (`useCharacter.ts:313`) calcule avec 3 jets :
   7 + (14 + 3) = **24**, pose `hpMax = 24` et **clampe `hpCurrent` à 24**.
2. `watch(level)` (`:319-335`) constate qu'il manque un jet, pousse le dé
   max (6) → `computedHp` = **31** → `hpMax = 31`, mais `hpCurrent` reste
   à 24.
Résultat : « 24/31 » à chaque rechargement. Le `+` remonte bien à 25,
le PATCH passe (clamp serveur sur `hp_max = 31`), mais le prochain
chargement de la page re-clampe à 24. Le joueur a l'impression que « ça
ne monte pas ».

**Fix :**
- `hpLevelGains` dans `UPDATABLE_FIELDS` et dans `UpdatableBody`.
- Ne plus clamper `hpCurrent` dans le watcher de `computedHp` au
  chargement : d'abord redimensionner `hpLevelGains` (dans `toCharacter`
  ou `applyLoaded`, pas dans un watcher), puis calculer. Le clamp ne
  s'applique qu'à un vrai changement de formule (CON, niveau, jet édité).
- Une seule formule partagée `computeHpMax(...)` (client + vue MJ +
  serveur), le serveur recalcule `hp_max` à chaque PUT au lieu de faire
  confiance au miroir envoyé par le client. Prépare B3 (`hpBonus`).
- **Réparation des données prod : faite le 2026-09-08.** Dé max de la
  famille ajouté en 4e jet sur les 6 fiches, `hp_max` recalculé, et
  `active_campaign_id = 2` posé sur Rhada. Les joueurs pourront corriger
  leur vrai jet via Croissance une fois B1 livré.

**Tests :**
- Unit serveur `characters.test.ts` : PUT avec `hpLevelGains: [5,5,4,3]`
  → la colonne est écrite. **Échoue aujourd'hui.**
- Unit `useCharacter.test.ts` : fiche chargée `level: 5, hpLevelGains:
  [5,5,4], hpCurrent: 30, con: 13`, mystique → après chargement
  `hpCurrent === 30` et `computedHp === 31`. **Échoue aujourd'hui (24).**
- Unit `computeHpMax.test.ts` : familles, CON négative, croissance
  vide, bonus, plancher 1.
- E2E `02-fiche.spec.ts` : seed d'une fiche niveau 5 avec 3 jets et
  `hp_current = 30` (option de `seedDev`) ; ouvrir la fiche → `hp-current`
  affiche 30, pas 24. Puis monter d'un niveau, saisir le jet, reload →
  le jet est toujours là. **Échoue aujourd'hui.**

### B3. Bonus custom sur les PV — feature

Le patron existe pour DEF, attaque contact/distance/magique, initiative :
colonne + `UPDATABLE_FIELDS` (`characters.ts:166-170`) + types + mapping
`useCharacter.ts:66-69/109-112/148-151` + formule + chip éditable
(`CombatCard.vue:204-206`). Rien pour PV, PM, PC max, ni caracs.

**Fix :** `hp_bonus` (migration + `npm run db:migrate`), entre dans
`computeHpMax` (donc B2 d'abord), chip « Bonus » dans `ResourcesCard`
après « Croissance ». `mp_bonus` sur le même modèle si validé (question
ouverte). Les caracs sont hors périmètre ici : le lot D (passifs) les
couvre.

**Tests :**
- Unit `useCharacter.computed.test.ts` : « ajoute le hpBonus divers »,
  « hpBonus négatif ne descend pas sous 1 ».
- E2E `02-fiche.spec.ts` : saisir `hp-bonus`, attendre le PUT, reload,
  `hp-max` a bougé.

---

## Lot C — Attaque flamboyante + Escrime

**Règles** (`voies-de-profil.md:121` et `:141`) : Escrime rang 1
*remplace* le score contact par le score distance (DEX) avec une arme de
duel ou dague. Charme rang 3 *ajoute* le Mod. CHA en attaque et DM, « en
plus du Mod. de FOR ou de DEX ». Le cumul est donc **légitime** :
`d20 + niveau + max(contact, distance-finesse) + Mod.CHA`. Aucune clause
anti-cumul dans le knowledge pour ce couple.

**Code** : Attaque flamboyante est un simple texte (`voies.ts:207`)
transformé en action `contact` par regex (`ActionsView.vue:139-161`).
Son jet = `computedAttackContact` = FOR seulement (`useCharacter.ts:
277-284`). **Ni CHA ni finesse ne sont appliqués.** Le joueur a
probablement compensé via le champ libre `attackContactBonus`, qui
s'applique alors à *toutes* ses attaques → impression de cumul faux.

**Bug annexe réel** : `rollDualWieldAction()` (`useDualWield.ts:112-129`)
utilise `attackContact` en dur pour les deux mains au lieu de
`weaponAttackBonus(weapon)` → la finesse Escrime est perdue en combat à
deux armes, alors qu'Ambidextrie (Escrime rang 4) est justement le cas.

**Fix :**
- Un calcul unique du bonus d'attaque d'une action : `voieAttackBonus
  (action, character)` dans `client/src/utils/attackBonus.ts`, qui
  applique la finesse (si voie Escrime ≥ 1 et arme éligible ou action
  de contact) et le Mod. CHA pour Attaque flamboyante.
- `rollDualWieldAction` passe par `weaponAttackBonus`.
- La carte Flamboyante produit aussi un jet de DM avec `+Mod.CHA` (les
  actions de voie n'en produisent aucun aujourd'hui, à limiter à ce cas).

**Tests :**
- Unit `attackBonus.test.ts` : charme 3 + escrime 1 + DEX 16 / FOR 10 /
  CHA 14 → bonus attendu ; charme 3 sans escrime → FOR + CHA ; escrime
  seule → DEX.
- Unit `useDualWield.test.ts` : `rollDualWieldAction` avec finesse →
  les deux mains utilisent le bonus DEX. Échoue aujourd'hui (le bug
  annexe).
- E2E `05-jets.spec.ts` : perso seed avec charme 3 + escrime 1 (ajouter
  une fiche au bac à sable ou modifier `nym`), ouvrir `/actions`, le
  badge de la carte Flamboyante affiche `d20 +X` attendu, le jet part
  avec ce bonus dans le log.

---

## Lot D — Passifs de voie (moteur d'effets)

**Règle** (`voies-de-profil.md:201`) : Intelligence héroïque, rang 5
élémentaliste : **+2 INT** et **2d20 garde le meilleur** sur les tests
d'INT. Patron répété 7 fois (FOR, DEX, CON, INT, SAG, CHA, Perception —
`voies.ts:39/123/149/209/221/283/343`). Autres passifs numériques :
Robustesse +3 PV (`voies.ts:34`), Armure naturelle +2 DEF (`:35`),
Intelligence du combat (Mod. INT en init et DEF, `voies-de-profil.md:
142`), Frappe chirurgicale (crit sur 20 − Mod.INT, `:107`).

**Code** : aucun moteur d'effets. `useSheetEffects.ts` est du CSS (nom
trompeur). `PassifsCard.vue:16-32` affiche du texte. Seul « typage » :
`active: true/false` sur `Capacite` (`voies.ts:3-7`). Les mods raciaux
sont appliqués une fois à la création (`racialAbilityMods.ts`). Le jet
de carac est mono-dé (`ActionsView.vue:505-522`), `ActionRollResult` ne
peut pas porter deux dés, `dice.ts` n'a pas de keep-highest.

**Fix (deux chantiers) :**
1. **Effets structurés** : champ optionnel `effects` sur `Capacite`
   (`{ ability: 'int', bonus: 2 }`, `{ advantage: 'int' }`, `{ hp: 3 }`,
   `{ def: 2 }`…). Composable `usePathEffects(character)` → `effective
   Abilities`, `hpBonusFromPaths`, `defBonusFromPaths`, `advantageOn`.
   Branchés dans `useCharacter` (`:231-236` CON→PV, `:246-252` init,
   `:256` CHA→PC, `:281/:293/:306` attaques) et `rollAbility`.
   Périmètre v1 : les 7 « héroïques » + Robustesse + Armure naturelle.
   Le reste (Intelligence du combat, Frappe chirurgicale) en v2 si
   validé. La fiche affiche score de base et bonus séparés (le +2 ne
   doit pas être tapé à la main, sinon il est compté deux fois).
2. **Avantage** : `rollWithAdvantage(sides)` dans `dice.ts` → `{ dice:
   [a, b], kept }`. `ActionRollResult` gagne `dice: number[]`. Impacts :
   `rollOutcome.ts` (crit/fumble sur le dé gardé), `useRollHistory`,
   `useDice3D` (deux dés roulent), `RollLogPanel` (affiche « 17 / ~~4~~ »).

**Tests :**
- Unit `usePathEffects.test.ts` : élémentaliste rang 5 → INT +2,
  avantage INT ; rang 4 → rien ; deux voies héroïques → cumul sur deux
  caracs différentes.
- Unit `useCharacter.computed.test.ts` : élémentaliste rang 5 avec INT
  15 → attaque magique compte INT 17.
- Unit `dice.test.ts` : `rollWithAdvantage` garde le max ; `rollOutcome`
  sur le dé gardé.
- E2E `05-jets.spec.ts` : perso seed élémentaliste rang 5, clic INT sur
  `/actions` → deux dés dans `.ability-roll-zone` (poser des testids),
  log MJ montre les deux valeurs.

**Vu au passage** : Boule de feu `2d6` dans `voies.ts:342` vs `4d6` dans
`voies-de-profil.md:200`. À corriger dans le même lot (données).

---

## Lot E — Concentration

**Règle** complète dans `magie.md:41-51` : le sort passe en action
**limitée**, et au choix : **économe** (−2 PM, min 0), **étendue** (durée
ou portée ×2), **puissante** (dés +1 catégorie d4→d6→d8→d10→d12). Interdit
sur les talents magiques (`magie.md:68-71`) et sur Sous tension
(`voies-de-profil.md:198`).

**Code** : zéro. Coût PM figé au rang (`ActionsView.vue:155`), débit +
brûlure de magie (`:450-463`) sans paramètre, type d'action inféré par
regex (`:67-72`), pas de jet de DM sur les actions de voie, pas d'échelle
de dés dans `dice.ts`.

**Fix :**
- `utils/spellCost.ts` : `concentratedPmCost(rank, mode)`,
  `upgradeDice('4d6') === '4d8'`.
- Extraire le débit PM + brûlure de `ActionsView` vers `useSpellCast`
  (testable, aujourd'hui enfoui dans la vue).
- UI : sur la carte d'un sort mystique, un sélecteur 4 états (aucune /
  économe / étendue / puissante), icônes Lucide, masqué sur les talents
  et Sous tension. Le badge d'action passe « attaque » → « limitée » ;
  l'étiquette de coût et le dé de DM se mettent à jour.
- Le log de jet mentionne le mode (« Foudre — concentration : puissante »).

**Tests :**
- Unit `spellCost.test.ts` : `concentratedPmCost(1, 'econome') === 0`,
  `(4, 'econome') === 2`, `upgradeDice('2d4+1') === '2d6+1'`, d12 reste
  d12 (à confirmer).
- Unit `useSpellCast.test.ts` : brûlure de magie ×2 combattant / ×1
  autre, avec et sans concentration.
- E2E `04-combat.spec.ts` ou `05-jets` : perso mystique, rang 4, mode
  économe → PM passent de N à N−2 (testid sur la ressource PM).

---

## Lot F — Ajouter un PJ à un combat en cours

**Code** : les PJ sont choisis **une seule fois** au lancement
(`combats.ts:91-127`, sheet `CampaignView.vue:348-363`). Trois routes de
roster, toutes verrouillées `kind === 'monster'` (`combats.ts:395-441`,
`:459-461`, `:494-496`). Un joueur arrivé en retard est spectateur
(`useCombat.ts:161-167`, `myParticipant = null`). Le MJ doit terminer et
relancer.

Le gros est déjà là : tour stocké par id (`currentParticipantId`),
`turnOrder()` recalculé à chaque lecture (`plans/16-pnj-caches.md:
16-27`), `computeInitiative()` exporté (`combats.ts:22-27`),
`startingPosition('player', n)` (`placement.ts`).

**Fix :**
- Serveur `POST /:id/combats/:cid/players { userId, initiative? }` :
  MJ, combat actif, membre avec `characterId`, refus doublon (409) +
  index unique `(combat_id, user_id) WHERE user_id IS NOT NULL`
  (migration), init via `computeInitiative()` sauf override, position
  = nombre de PJ présents, `hpMax/hpCurrent: null`, broadcast.
- Client : `addCombatPlayer`, `useCombat().addPlayer`, un onglet
  « Joueur » dans la sheet « Ajouter un renfort » (`CombatView.vue:
  663-680`) listant les membres pas encore dans le combat (charger la
  campagne à l'ouverture de la sheet).
- Comportement : si l'init du nouveau est supérieure à celle du
  participant courant, il joue au round suivant. Le tour courant ne
  bouge pas.

**Tests :**
- Unit `turnOrder.test.ts` : insertion init supérieure → courant
  inchangé ; inférieure → joue ce round ; égale → après l'existant ;
  `step()` ne saute pas le nouveau.
- Unit `combats` : `computeInitiative` (armure lourde + bouclier + bonus
  négatif) — exporté, jamais testé.
- Unit `placement.test.ts` : Nème PJ ne se superpose pas.
- E2E `04-combat.spec.ts` : MJ lance en excluant bracco ; bracco ouvre
  le combat → spectateur ; MJ l'ajoute ; sans reload bracco a son
  panneau, et `active-participant` n'a pas changé.

---

## Ordre et parallélisme

```
A (dés MJ)          ─┐
B1 (croissance)      ├─ en parallèle, fichiers disjoints
C (flamboyante)      │
F (PJ en combat)    ─┘
B2 → B3 (PV)         séquentiel entre eux, parallèle au reste
D (passifs)          après B2 (touche computeHpMax) et C (touche attackBonus)
E (concentration)    après D si l'avantage touche ActionRollResult ; sinon parallèle
```

Chaque agent : une branche, tests rouges d'abord (commit « test: … »),
puis fix (commit « fix/feat: … »), `npm test` + `npm run e2e` verts,
puis `/commit-push`. Les migrations sont lancées immédiatement.

---

## Questions ouvertes (avant de lancer)

1. **A** — Pour « le MJ ne voit rien » : ça arrivait dès le début de la
   soirée, ou après un moment ? (dès le début = cause 1, après = cause 2).
   Et le MJ avait-il rejoint une autre campagne comme joueur ?
2. **A2** — Le jet secret du MJ, tu le veux ? Ou juste que ses jets
   publics marchent ?
3. **B2** — Quel perso était à 24/31 ? Pour vérifier `hp_max` en base
   avant de coder.
4. **B3** — Bonus custom : PV seulement, ou aussi PM et PC max ?
5. **C** — Le joueur avait-il tapé quelque chose dans le « Bonus » de
   l'attaque de contact ? Ça expliquerait le cumul vu en séance.
6. **D** — Périmètre v1 des passifs : les 7 « héroïques » + Robustesse +
   Armure naturelle, ou tout de suite tous les passifs numériques ?
7. **E** — Le sélecteur de concentration sur chaque carte de sort, ça te
   va ? Et d12 plafonne bien (pas de d20) ?
8. **F** — L'initiative du PJ ajouté : calculée automatiquement, ou le
   MJ la saisit ?

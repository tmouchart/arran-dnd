# 21 — Mode viewer : la tablette au milieu de la table

Idée de Geoffrey (07/09/2026), validée par Nicolas : **la tablette est la télé,
les téléphones sont les télécommandes.** Posée au centre de la table, elle
montre ce que tout le monde doit voir en même temps : le champ de bataille, les
dés qui roulent, l'ordre du tour, et un fil « qui fait quoi ». Personne ne la
touche pendant le jeu. À terme : chromecast sur la TV, jeu dans le fauteuil.

Ce plan décrit ce qu'on affiche, ce qu'on cache exprès, et ce qu'il faut
changer côté serveur pour que la tablette voie **le même combat que les
joueurs** sans jamais trahir le secret du MJ.

**État (08/09/2026) : implémenté, étapes 1 à 4.** Route `/table`, bouton `Tv`
dans la barre du bas. Vérifié dans Chrome en 1280×800 : carte, dés sur la carte,
fil d'actions, jet caché masqué même avec le compte du MJ, bascule automatique
combat ↔ veille. Reste à valider en vraie séance sur la tablette.

---

## 1. Ce qui existe déjà (et qu'on réutilise tel quel)

Presque tout le contenu du viewer est déjà en place. Le viewer, c'est une
**nouvelle mise en page** de briques existantes, pas une nouvelle mécanique.

| Brique | Où | Ce qu'elle fait déjà |
|---|---|---|
| Champ de bataille 3D | `BattleGrid3D.vue` + `BattleMapTab.vue` | Pions héros/monstres avec jauge PV, décor, temps réel via le SSE du combat (`useCombat`). Les positions des monstres sont envoyées aux joueurs (pas un secret). |
| Dés 3D distants | `Dice3DOverlay.vue` + `useDice3D.ts` | Le dé d'un autre joueur roule en petit dans une bande en haut, 4 emplacements, nom du perso, couleur du lanceur, étincelles sur critique. Plan 18. |
| Flux des jets | `useCampaignRolls.ts` + `GET /campaigns/:id/events` | SSE par campagne. Chaque jet porte `actorName`, `label` (nom de l'attaque / du sort / de la carac), `kind`, `die`, `sides`, `bonus`, `total`, `damage`. |
| État du combat | `useCombat.ts` + `GET /campaigns/:id/combats/:cid/events` | SSE par combat : participants triés par initiative, tour actif, round. Pour un non-MJ, `serializeCombat` masque les PV des monstres en `hpStatus` qualitatif. |
| Secret du MJ | `sseStore.broadcastCampaignRoll` | Un jet `visibility: gm` ne sort du serveur que vers le MJ ; les autres reçoivent au mieux un `critical` sans chiffre. |
| Campagne active | `user.activeCampaignId` | L'app connecte le flux des jets dessus au login. |
| Combat actif | `useActiveCombat.ts` + `GET /combats/active` | Resynchronisé au login et au retour au premier plan. |

## 2. Ce qui manque (les vrais trous)

Quatre trous, dont deux côté serveur. Tout le reste est de la mise en page.

### 2.1 La tablette est connectée avec le compte de quelqu'un

Il n'y a pas de compte « tablette ». Le plus simple à la table : Geoffrey se
logue sur la tablette avec **son** compte de MJ. Problème : le serveur lui
envoie alors **tout** — PV exacts des monstres, jets de monstres cachés,
réserve de PNJ. La tablette au milieu de la table trahirait le MJ.

Filtrer côté client ne suffit pas (les données arrivent quand même, et un
oubli dans un composant suffit à fuiter). **Il faut que le serveur traite la
tablette comme un joueur.**

→ Un paramètre `?as=viewer` sur les 4 lectures concernées. Le serveur force
alors `isGm = false` pour cette connexion :

| Route | Aujourd'hui | Avec `as=viewer` |
|---|---|---|
| `GET /campaigns/:id/events` (SSE jets) | le client MJ reçoit les jets `gm` | traité comme non-MJ : jets `gm` remplacés par le `critical` sans chiffre |
| `GET /campaigns/:id/rolls` (historique) | le MJ voit tout | filtre `visibility = 'public'` |
| `GET /campaigns/:id/combats/:cid/events` (SSE combat) | `serializeCombat(..., isGm)` | `serializeCombat(..., false)` : monstres masqués, réserve vide |
| `GET /campaigns/:id/combats/:cid` | idem | idem |

Le client SSE (`SseClient`) gagne un booléen `viewer`. Une ligne dans
`broadcastCampaignRoll` et une dans le broadcast du combat.

Ça marche aussi si un joueur se logue sur la tablette : il ne voit pas plus que
d'habitude. Et le MJ garde son PC intact.

### 2.2 La tablette n'apprend pas qu'un combat commence

Le flux de campagne ne porte que `roll`, `rest`, `critical`. Un combat créé ou
terminé n'est **pas** annoncé. Aujourd'hui l'app s'en aperçoit au retour au
premier plan (`visibilitychange`), ce qui n'arrive jamais sur une tablette
qu'on ne touche pas.

→ Nouvel évènement `combat` sur le flux de campagne, émis à la création, à la
fin, et à la suppression d'un combat : `{ combatId, status }`. Le viewer
bascule carte ↔ idle tout seul. Les téléphones en profiteront aussi : le
bandeau « combat en cours » apparaîtra sans rafraîchir.

### 2.3 Les flux se coupent après 25 min sans activité

`useCampaignRolls` et `useCombat` relâchent leur SSE après 25 min sans
évènement, pour laisser la machine Fly s'endormir. Une phase de roleplay sans
un seul jet, et la tablette est morte sans le dire. Le réveil (`wake()`) ne
part que sur un geste ou un retour au premier plan.

→ En mode viewer : **pas de coupure** tant que le mode est actif. Le viewer
est par définition une séance en cours, la machine ne doit pas dormir. On
passe un flag `keepAlive` aux deux composables, et on reconnecte au `onerror`
d'EventSource (il le fait déjà tout seul, on s'assure juste de ne pas fermer
nous-mêmes).

### 2.4 Les dés « à moi » n'ont pas de sens

`useCampaignRolls` ignore les jets dont `userId === user.id` pour le dé 3D
(ils ont déjà roulé en grand sur mon écran). Sur la tablette loguée avec le
compte de Geoffrey, **ses** jets de MJ publics ne rouleraient jamais.

→ En mode viewer, **tous** les jets sont traités comme distants, y compris les
miens. Aucun dé « à moi », aucun total révélé en grand.

### 2.5 L'écran s'éteint

Une tablette qu'on ne touche pas se met en veille après 1-2 min.

→ `navigator.wakeLock.request('screen')` à l'entrée du mode, re-demandé au
retour au premier plan (le lock tombe quand l'onglet est caché). Repli
silencieux si l'API manque (Safari < 16.4) : on l'écrit dans l'aide du mode.

---

## 3. Ce qu'on affiche, et ce qu'on cache exprès

### PV : joueurs en clair, monstres qualitatifs

Décision de Thomas (08/09/2026) : **on montre les PV exacts des joueurs.**
La tablette affiche pour chaque joueur `PV actuels / PV max` avec une jauge,
comme sur la carte aujourd'hui. Les monstres restent qualitatifs (intact /
blessé / mal en point / agonisant / mort), c'est déjà ce que le serveur envoie
à un non-MJ. Rien à changer côté serveur, rien à changer dans `buildTokens`.

### Le fil d'actions : « D20 · Minizou : Boule de feu ! 17 »

Chaque jet public devient une ligne :

```
[d20]  Minizou · Boule de feu !          17
[d20]  Bracco · Épée longue              CRITIQUE  24  → 14 dégâts
[d6]   Nym · Soin                                8
[?]    Ogre · un jet secret…            (critique !)
```

- Nom du perso en couleur du lanceur (`diceColor`, déjà sur le flux).
- `label` du jet tel quel (c'est déjà le nom du sort / de l'arme / de la carac).
- Total à droite. Dégâts en suffixe s'il y en a.
- Critique / échec : ligne surlignée, même code que le log existant.
- Jet caché du MJ (`critical` sans chiffre) : une ligne « un jet secret… » avec
  l'issue seulement. La table frissonne, personne n'apprend le chiffre.

La ligne **entre après que le dé s'est posé**, pas avant : sinon on lit le
résultat avant de voir le dé, et le dé ne sert plus à rien.

---

## 4. Mise en page tablette (paysage, 10-11", lue à 1 m)

Décision de Thomas (08/09/2026) : **pas de bande de dés**. Les dés tombent
**sur le champ de bataille**, comme à une vraie table où on lance ses dés sur
la carte. Ça libère toute la hauteur pour la carte.

```
┌────────────────────────────────────────────────────┬───────────────────────────┐
│ ⚔ Round 3                        Tour : ▶ Minizou  │ INITIATIVE                │
│                                                    │ ▶ Minizou  18 ████░ 24/30 │
│                                                    │   Ogre     15 mal en point│
│            CHAMP DE BATAILLE 3D                    │   Bracco   14 ██░░░  9/22 │
│                                                    │   Nym      12 █████ 18/18 │
│                 ┌────┐                             │   Gobelin  11 blessé      │
│                 │ 17 │  ← le dé roule et se pose   │   Gobelin  11 ✝ mort      │
│                 └────┘    par-dessus la carte      │   Orlane    6 █░░░░  2/20 │
│                 Minizou                            ├───────────────────────────┤
│                                                    │ ACTIONS                   │
│                                        ┌────┐      │ ◆ Minizou · Boule de feu  │
│                                        │ 3  │      │                        17 │
│                                        └────┘      │   → 14 dégâts             │
│                                        Bracco      │ ✗ Bracco · Épée longue  3 │
│                                                    │ ◆ Nym · Soin            8 │
│                                                    │ ? Ogre · jet secret crit! │
└────────────────────────────────────────────────────┴───────────────────────────┘
```

- **Deux colonnes, c'est tout.** Carte à gauche (~66 %), colonne droite
  (~34 %) : initiative en haut (fixe), fil d'actions en dessous (seule zone
  qui défile). Round et tour actif en surimpression discrète sur le coin haut
  de la carte.
- **Les dés** : l'overlay 3D existant couvre la zone de la carte. Chaque jet
  arrive d'un bord, roule, se pose **à un endroit aléatoire de la carte**
  (pas d'emplacements fixes), nom du lanceur sous le dé, couleur du lanceur.
  Taille : ~70 % du dé perso. Posé 4-5 s puis fondu. Jusqu'à 4-5 jets en
  même temps ; au-delà, on efface le plus vieux posé. Pas de tap pour
  effacer. Étincelles / onde de choc conservées, agrandies.
- **Les participants** : chevron doré sur le tour actif. Joueur : initiative,
  jauge, `PV / max`. Monstre : initiative, état en mots (`hpStatus`). Le mort
  reste dans la liste, grisé.
- **Le fil** : 6 à 8 lignes visibles, la nouvelle entre par le haut, la plus
  vieille sort en fondu. Critique doré, échec `--danger`, dégâts en
  sous-ligne. Jet caché du MJ : « jet secret » + l'issue seule. La ligne
  n'apparaît qu'une fois le dé posé.
- **Hors combat (veille)** : pas de carte ni d'initiative. Nom de la campagne
  en grand au centre, fil d'actions en dessous. Les dés tombent sur cet écran
  de veille, même règle.
- **Lisibilité** : facteur d'échelle local (~1,7×) via une variable CSS sur la
  page : noms ≥ 24 px, lignes du fil ≥ 22 px, chiffre du dé ≥ 48 px.
- **TV castée (16:9)** : même grille, les proportions tiennent.

## 5. Entrée / sortie du mode

- **Route** : `/table` (nom `viewer`). Une URL qu'on peut mettre en favori sur
  la tablette et ouvrir directement. Pas un flag global qui change l'app
  entière : une page plein écran, sans barre du haut ni du bas.
- **Y aller** : un bouton dans la barre du bas, icône Lucide `Tv`, titre
  « Mode table ». Ça fait 4 boutons de séance (dés, historique, dés des
  autres, table) + dev + options : on reste sous 7.
- **En sortir** : la page est sans chrome. Un tap n'importe où fait apparaître
  2 s un bouton « Quitter » en haut à droite (Lucide `X`), et la touche Échap
  sort aussi. Rien d'autre ne réagit au tap. Le « tap pour effacer les dés »
  est désactivé : les dés s'effacent tout seuls.
- **Toggleable par n'importe qui** : oui, c'est une page, tout membre de la
  campagne peut l'ouvrir. Ce que le membre voit ne dépend pas de qui il est,
  grâce à `as=viewer`.
- Pas de plein écran automatique (retiré le 08/09 : trop intrusif sur PC).
  Sur la tablette, on ajoute la page à l'écran d'accueil ou on utilise le
  plein écran du navigateur.

---

## 6. Plan d'implémentation

Chaque étape est livrable seule et testable.

### Étape 1 — Serveur : la tablette est un joueur (`as=viewer`)
- `SseClient.viewer: boolean`, lu depuis `req.query.as === 'viewer'` sur les
  deux SSE et les deux GET.
- `broadcastCampaignRoll` : `hidden && (client.userId !== gmUserId || client.viewer)`.
- Broadcast combat : `serializeCombat(…, isGm && !client.viewer)`.
- Historique des jets : filtre `public` si viewer.
- → vérif : tests unitaires sur `sseStore` (un client MJ viewer ne reçoit pas
  le jet `gm`, reçoit le `critical`) et sur `serializeCombat` (déjà couvert,
  on ne teste que le branchement).

### Étape 2 — Serveur : évènement `combat` sur le flux de campagne
- `broadcastCampaignEvent(campaignId, 'combat', { combatId, status })` à
  create / finish / delete dans `routes/combats.ts`.
- Client : `useCampaignRolls` écoute `combat` et appelle
  `refreshActiveCombat()`. Le bandeau des téléphones en profite.
- → vérif : e2e existant du combat + un test que le bandeau apparaît chez un
  joueur sans reload.

### Étape 3 — Client : les composables savent tenir une séance
- `connect(campaignId, { viewer: true })` sur `useCampaignRolls` et
  `useCombat` : ajoute `?as=viewer`, pas d'idle timer, traite tous les jets
  comme distants.
- Composable `useWakeLock()` (nouveau, 30 lignes) : request à l'entrée,
  re-request au `visibilitychange`, release à la sortie.
- Composable `useViewerFeed()` : transforme les `RollEvent` + `critical` en
  lignes du fil, plafonné à N lignes, chaque ligne « prête » quand le dé est
  posé (on attend le `settled` de l'overlay ou un délai fixe égal à la durée
  d'animation distante si les dés 3D sont coupés).
- → vérif : tests unitaires sur `useViewerFeed` (format de ligne, plafond,
  jet secret, critique) et sur la fonction pure de mapping.

### Étape 4 — Client : la page `/table`
- `ViewerView.vue` : plein écran, sans `AppPageLayout` (exception assumée,
  comme `LoginView` : pas de barre, pas de largeur max). Grille CSS 2 zones
  (carte | colonne droite), zone dés en overlay.
- Sous-composants : `ViewerInitiative.vue` (liste), `ViewerFeed.vue` (fil),
  `ViewerIdle.vue` (hors combat). La carte réutilise `BattleGrid3D` en lecture
  seule (prop `readonly` : pas de déplacement, caméra auto-recentrée à chaque
  changement de tour).
- Overlay des dés : `Dice3DOverlay` reçoit une prop `layout: 'viewer'` :
  zone d'atterrissage = la carte, position de chute aléatoire (plus
  d'emplacements), taille ~70 %, pause 4-5 s, pas de tap-pour-effacer.
- Bouton `Tv` dans la barre du bas + bouton « Quitter » + Échap + plein écran.
- → vérif : playtester sur une fenêtre 1280×800, séance simulée avec le bac à
  sable (un MJ sur une fenêtre normale, la tablette sur une fenêtre privée
  loguée MJ : elle ne doit **jamais** afficher un PV de monstre ni un jet
  caché).

### Étape 5 — Finitions
- `prefers-reduced-motion` / dés 3D coupés : le fil suffit, pas de bande vide.
- Chromecast : rien à faire côté code, c'est un onglet Chrome casté. On note
  juste dans l'aide que la TV veut du 16:9 et que le layout s'adapte (la
  grille CSS suffit).

---

## 7. Hors périmètre (volontairement)

- Compte « tablette » dédié : inutile avec `as=viewer`.
- Pilotage de la tablette depuis le PC du MJ (changer la caméra, pointer un
  pion) : idée pour plus tard, c'est un autre canal.
- Sons sur la tablette : elle a déjà le son du critique partagé. On verra si
  ça double avec les téléphones.

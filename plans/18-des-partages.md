# 18 — Les dés de tout le monde roulent sur l'écran de chacun

Idée de Thomas (07/09/2026) : le moment critique partagé (plan 15) marche bien,
alors on va plus loin. **Quand quelqu'un lance un dé, tout le monde le voit
rouler**, dans la couleur du lanceur, avec le nom de son personnage. Plusieurs
joueurs qui lancent en même temps = chaotique mais fun.

---

## Ce que je vois à l'écran

### Mon propre jet (inchangé, sauf la couleur)

Mon dé 3D arrive d'un bord, roule, se pose au centre, montre sa face. Exactement
comme aujourd'hui. Seule nouveauté : **il est dans ma couleur** au lieu du doré.

### Le jet d'un autre joueur

**Le même dé 3D, avec la même animation complète** : il entre par un bord de
l'écran au hasard, tourne sur lui-même, décrit sa cloche, freine, rebondit et se
pose sur la face tirée. C'est le moteur existant, pas une image.

Ce qui change par rapport à mon dé :

| | Mon dé | Le dé d'un autre |
|---|---|---|
| Taille | 100 % | **40 %** (~45 px contre ~110 px) |
| Arrivée | au centre | **dans une bande en haut de l'écran**, sous la barre du haut |
| Couleur | la mienne | **la sienne** |
| Nom | aucun | **nom du personnage** sous le dé, avec une pastille de sa couleur |
| Durée du vol | 780-1040 ms | **~550-700 ms** (un peu plus vif, c'est un aperçu) |
| Pause une fois posé | 1100 ms | **900 ms** |
| Fondu | 400 ms | 300 ms |
| Ce qu'on lit | la face, puis le total dans la page | **la face seulement**, jamais total ni bonus |
| Critique / échec | étincelles + flash / onde rouge | **les mêmes étincelles et onde**, à sa taille |

Le nom du perso reste affiché pendant tout le vol, il n'attend pas que le dé se
pose : c'est le premier repère quand trois dés déboulent en même temps.

### Plusieurs dés en même temps

- **4 emplacements** côte à côte dans la bande du haut, remplis dans l'ordre
  d'arrivée. Chaque dé roule indépendamment, avec sa propre trajectoire.
- Un 5e jet pendant que les 4 sont occupés prend la place du plus ancien **déjà
  posé**. On ne coupe jamais un dé encore en vol.
- Un joueur qui lance 3d6 au bac à sable : ses 3 dés roulent dans **son**
  emplacement, serrés (échelle réduite, comme aujourd'hui pour mon propre jet
  multi-dés). Plafond : 5 dés par emplacement, au-delà on n'anime que les 5
  premiers (le log a le total).
- Mon dé et les dés des autres cohabitent sans se gêner : eux en haut, moi au
  centre.

### Le tap pour effacer

Aujourd'hui un tap pendant que mon dé est là le pose et l'efface. Même règle :
**un tap efface tout**, mes dés et ceux des autres. On ne va pas viser un petit
dé de 45 px pour le fermer.

### Ce qui reste caché

Les jets de monstres du MJ (`visibility: gm`) ne sortent pas du serveur : pas de
dé distant, seulement le flash « critique » déjà en place. Le secret du MJ tient.

### Quand rien ne bouge

Dés 3D coupés dans les réglages, ou `prefers-reduced-motion` : ni mon dé ni
ceux des autres ne s'animent. Le log de jets reçoit déjà l'évènement, c'est là
que ça apparaît. Rien de plus.

---

## Le toggle « dés des autres »

- **Où** : barre du bas, **juste à droite des deux boutons existants** (lancer
  les dés, historique). Trois boutons de séance groupés, on reste loin des 7.
- **Icône** : Lucide `Users`. Pas `Eye`/`EyeOff`, qui évoque un contenu privé.
  Ici c'est « je vois les autres jouer ».
- **État** : même rendu que les deux voisins (`nav-link--on` quand actif).
  **ON par défaut.** Pas de pastille : il n'y a rien à rattraper.
- **Titre** : « Dés des autres joueurs » / « Dés des autres masqués ».
- **Stockage** : localStorage `arran-dice-remote`, même repli fail-safe que
  `arran-dice-3d`.
- OFF ne coupe que l'affichage. Mes jets partent toujours aux autres, et le
  flash critique partagé continue de jouer.

---

## La couleur

### Attribution

- Chaque joueur a **une** couleur, valable dans toutes ses campagnes.
- **Par défaut** : la couleur de son rang d'entrée dans la campagne active
  (1er membre = rubis, 2e = safran…). Distinctes tant qu'ils sont 8 ou moins,
  sans rien régler. Le MJ non membre passe après tous les membres.
- **Modifiable** dans Options, carte « Apparence », sous le style artistique :
  une rangée de **8 pastilles rondes** (36 px), la mienne entourée d'un anneau
  `--accent`. Un tap = sauvegardé. Pas de color picker natif : couleurs
  garanties lisibles, et ça reste dans le ton grimoire.
- Deux joueurs peuvent choisir la même couleur. On ne les en empêche pas : le
  nom du perso est là pour ça.

### Palette (8)

| Nom | Hex | Chiffres |
|---|---|---|
| Rubis | `#d64545` | clairs |
| Safran | `#e08a35` | sombres |
| Émeraude | `#2f8f5c` | clairs |
| Saphir | `#3d7bd9` | clairs |
| Améthyste | `#7c52c9` | clairs |
| Fuchsia | `#c93f82` | clairs |
| Turquoise | `#1f9490` | clairs |
| Ardoise | `#64707d` | clairs |

La couleur des chiffres est calculée par luminance (fond clair → encre sombre),
pas une table à la main. Testable en unitaire.

### Rendu 3D

Pas de teinte par multiplication du matériau (ça salirait le doré). **Un atlas de
texture par couleur**, généré par le `buildAtlas()` existant avec `face`/`ink` en
paramètres. Mis en cache par `sides:kind:couleur` : un petit canvas par couleur
réellement vue, jamais plus de 8.

---

## Plomberie

### Serveur

- Migration `1700000000040_user_dice_color.sql` : `user.dice_color varchar(7)`,
  nullable. NULL = défaut.
- `campaigns/diceColors.ts` : palette + `resolveDiceColor(chosen, memberIndex)`.
  Pur, testé. `campaigns/diceColorQuery.ts` : la requête (couleur choisie + rang
  dans la campagne).
- `GET /me` renvoie `diceColor` **effectif** dans la campagne active.
  `PATCH /me` accepte `diceColor` (`#rrggbb` ou null), validé.
- `POST /campaigns/:id/rolls` : le serveur résout la couleur du lanceur et
  l'ajoute au payload SSE (`diceColor`). **Pas stockée** dans `roll_event` : elle
  ne sert qu'à l'animation en direct.
- La palette est dupliquée côté client (`data/diceColors.ts`) : 8 chaînes, pas
  de code partagé entre les deux workspaces. Commentaire croisé des deux côtés.

### Client

- `useDice3D.ts` :
  - `playDiceRoll` lit ma couleur dans `user.diceColor` → aucun des 8 sites
    d'appel ne change.
  - Nouveau `playRemoteDiceRoll({ actorName, color, rolls })`, canal
    `remoteDiceRequest` distinct de `diceRequest`.
  - `remoteDiceEnabled` + `setRemoteDiceEnabled` (localStorage).
- `Dice3DOverlay.vue` : aujourd'hui **une** animation à la fois. Devient une
  liste de « shows » (le mien + jusqu'à 4 distants), chacun avec ses dés, ses
  trajectoires, son horloge, ses effets et son minuteur de fondu. Une seule
  scène, un seul renderer, une seule boucle `requestAnimationFrame` qui tourne
  tant qu'un show est vivant. C'est le gros morceau.
  - Les labels (nom + pastille) sont en HTML dans un overlay `position: fixed;
    inset: 0; pointer-events: none` (cas admis), placés d'après la projection
    de la position 3D de l'emplacement.
- `plan.ts` : `remoteSlotLayout(slot, count)` à côté de `landingLayout`. Testé.
- `atlas.ts` : `buildAtlas(labels, fitRatio, { face, ink })`. `inkFor(hex)`
  testé.
- `useCampaignRolls.ts`, listener `roll` : si `userId !== moi` et toggle ON →
  `playRemoteDiceRoll`. Les dés à animer : `rolls[]` s'il y en a (bac à sable),
  sinon `[{ sides, value: die, kind }]`.
- `App.vue` : le bouton `Users`, `data-testid="nav-remote-dice"`.
- `OptionsView.vue` : les 8 pastilles. `api/auth.ts` : `diceColor` dans
  `AuthUser` et `updateMe`.
- `ComponentLibraryView.vue` : un bouton « Dé distant bidon » qui lance
  `playRemoteDiceRoll` avec un nom et une couleur au hasard, pour itérer sur
  l'animation sans second navigateur.

---

## Étapes et vérifications

1. Serveur : migration, palette, `GET/PATCH /me`, `diceColor` dans le broadcast
   → `npm test -w server`, `npm run db:migrate`.
2. `atlas.ts` couleur paramétrée + `inkFor`, `plan.ts` emplacements → tests.
3. `useDice3D` : couleur du joueur, `playRemoteDiceRoll`, toggle.
4. `Dice3DOverlay` multi-shows + labels → bouton kitchen sink : 4 dés distants
   qui roulent en même temps que le mien, sans saccade.
5. `useCampaignRolls` branché → deux fenêtres (normale + privée, bac à sable) :
   `bracco` lance, `nym` voit le dé rouler en haut, en rubis, avec « Bracco ».
6. Toggle barre du bas + pastilles Options → e2e : le bouton bascule et persiste.
7. `playtester` sur mobile.

## Questions ouvertes

1. **Mon propre dé dans ma couleur** : c'est ce que je comprends de « son dé est
   de sa couleur ». Le designer UX proposait de garder le doré pour soi. Je
   pars sur la couleur partout, plus cohérent avec le sélecteur.
2. **Une seule couleur par joueur, toutes campagnes** plutôt qu'une par
   campagne. Plus simple, et un joueur s'identifie à « sa » couleur.

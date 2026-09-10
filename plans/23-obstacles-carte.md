# 23 — Des murs tracés au doigt sur le champ de bataille

Idée de Thomas (09/09/2026) : **le MJ appuie sur « mur », trace avec son doigt,
lâche — le mur apparaît.** Pas de placement case par case, pas de bibliothèque
de tuiles à faire défiler. Un geste, un mur.

C'est ce qu'on fait à la vraie table avec un feutre sur une plaque effaçable, et
c'est exactement pour ça que ça doit rester aussi direct.

**État (10/09/2026) : fait et vérifié dans l'app.** Migration passée, 657 tests
au vert. Vérifié dans Chrome sur le bac à sable : un arc tracé à la souris donne
un mur courbe sans trou, il survit au F5, le tap l'efface (toast), annuler le
remet, et il apparaît en mode table. Les quatre matériaux se distinguent d'un
coup d'œil sur la carte. Reste à essayer au doigt sur un vrai téléphone.

---

## 1. Le périmètre, et ce qu'on laisse dehors exprès

| On fait | On ne fait pas (pour l'instant) |
|---|---|
| Un mur tracé au doigt, courbe ou droit | Le mur bloque le déplacement |
| Le MJ trace, tout le monde voit (SSE) | Le mur bloque la ligne de vue |
| Le MJ efface un mur en le touchant | Rochers, tonneaux, portes, arbres |
| Le MJ annule son dernier geste | Éditer un mur déjà posé |
| Quatre matériaux au choix | Refaire (redo) |
| Les murs survivent au rechargement | |

**Le mur est du décor.** On le voit, on se débrouille comme à la vraie table.
Ajouter le blocage demanderait un calcul d'intersection côté client **et** côté
serveur (sinon on triche), pour un bénéfice qu'on ne connaît pas encore. On
verra à l'usage si ça manque.

---

## 2. Le geste

Aujourd'hui dans `BattleGrid3D.vue` : 1 doigt déplace la carte, 2 doigts zooment,
un tap sélectionne ou pose un pion.

On ajoute **un mode**, actif seulement pour le MJ :

| Mode | 1 doigt | 2 doigts | Tap |
|---|---|---|---|
| Normal (défaut) | déplace la carte | zoom | sélectionne / pose un pion |
| Mur | **trace le mur** | zoom | touche un mur = l'efface |

Le bouton `BrickWall` (Lucide) dans la toolbar de `BattleMapTab.vue`, en
`variant="primary"` quand le mode est actif — même traitement que le bouton
grille juste à côté.

Le bouton **Annuler** (`Undo2`) n'apparaît **que pendant le mode mur**. Hors de
ce mode il n'a rien à annuler, et il mangerait une place dans la barre. On tient
donc à 5 boutons au repos, 6 en mode mur : sous la limite de 7 dans les deux
cas.

Le mode reste actif entre deux murs : le MJ en trace souvent plusieurs d'affilée
(une pièce, un couloir). Il en ressort en retouchant le bouton.

### 2.1 De quoi le mur est fait

Sous la barre, en mode mur, une rangée de **pastilles** : pierre, brique, bois,
haie. Elles montrent la **vraie texture**, pas une icône — ce que le MJ choisit
est exactement ce qu'il verra sur la carte. C'est la « mini image du mur 3D »
demandée au départ, et c'est gratuit : le même carreau peint sert à la pastille
et à la texture 3D.

Le choix est retenu entre deux tracés : on monte une pièce en pierre d'un coup,
puis on passe au bois pour la palissade.

Les matériaux vivent dans `wallMaterials.ts`. En ajouter un = une entrée dans la
liste, rien d'autre. Le serveur ne connaît pas la liste — il valide la forme de
l'id (`/^[a-z-]{1,40}$/`), comme il le fait déjà pour `environment`. La dupliquer
côté serveur, ce serait se garantir d'oublier de la mettre à jour ; un id inconnu
retombe sur la pierre à l'affichage.

### 2.2 Pendant le tracé

À chaque `pointermove`, on projette le doigt sur le plan du sol (`THREE.Plane`
à `y = 0`, pas le mesh — comme ça le tracé continue même hors de la grille, et
on ramène dans les bornes après).

On garde le point **seulement s'il est à plus de 0,3 case du précédent**. C'est
le rééchantillonnage : un doigt lent crache 60 points quasi superposés, et ce
sont eux qui font trembler le mur.

Le mur se construit **en direct sous le doigt**, avec sa vraie géométrie et sa
vraie texture — pas un aperçu en pointillés. Le mur pousse au fur et à mesure.
C'est ça le « PAF » : au lâcher il ne se passe rien de visible, le mur est déjà
là. Il ne fait que se sauvegarder.

### 2.3 Au lâcher

1. On lisse (moyenne glissante sur 3 points) — enlève la tremblote résiduelle
   sans casser la courbe.
2. Moins de 2 points ? On jette : c'était un tap, pas un tracé.
3. On envoie au serveur. En cas de refus, le mur disparaît et un toast le dit.

---

## 3. La géométrie d'un mur

Un mur = une suite de points. Entre deux points consécutifs, **une boîte
orientée** le long du segment.

```
les points du tracé          les boîtes posées entre eux
    ·                              ▄▄
   ·                             ▄▄
  ·                            ▄▄
  ·                            █
  ·                            █
```

Avec un point tous les 0,3 case, une courbe de doigt donne assez de boîtes pour
avoir l'air ronde.

**Le seul détail qui compte :** au virage, deux boîtes se rencontrent et
laissent un trou en V sur le bord extérieur. Sa taille dépend de l'angle —
négligeable sur une courbe douce, visible sur un angle vif. On le bouche en
allongeant chaque boîte d'une demi-épaisseur à chaque bout : les boîtes se
chevauchent, le trou disparaît, à n'importe quel angle. Une ligne de code.

Dimensions :

| | Valeur | Pourquoi |
|---|---|---|
| Épaisseur | 0,28 case | Assez épais pour lire comme un mur, assez fin pour ne pas manger la grille |
| Hauteur | 1 case | À hauteur d'homme (les pions font 0,85 et 1,05). On avait essayé 0,6 pour ne jamais masquer un pion : ça ne se lisait pas comme un mur, ça faisait bordure de trottoir. Un pion juste derrière est masqué jusqu'aux épaules, mais son étiquette et sa jauge de PV flottent plus haut — on sait toujours qui est là. |

Toutes les boîtes d'un mur sont fusionnées en une seule géométrie
(`BufferGeometryUtils.mergeGeometries`) → un seul mesh, un seul draw call, même
pour un mur de 40 segments.

Texture pierre peinte au canvas, dans le style de `environments.ts` : aucun
fichier à télécharger, et ça reste cohérent avec le reste de la scène. Des
blocs en rangs décalés sur un mortier sombre, chaque bloc avec sa teinte, une
arête claire en haut, une ombre en bas et du grain — un aplat gris uniforme
faisait carrelage, et trop sombre il disparaissait dans les décors de nuit.

---

## 4. Les données

### 4.1 Forme

```ts
export interface BattleWall {
  /** Généré côté client, sert à l'effacer. */
  id: string
  /** Le tracé, en cases. Centre de la grille = (0, 0). */
  points: { x: number; z: number }[]
}
```

### 4.2 Stockage

Colonne `jsonb` sur `combat`, pas une table :

```ts
// server/src/db/schema.ts, dans combats
/** Murs tracés sur le champ de bataille (voir plan 23). */
obstacles: jsonb('obstacles').notNull().default('[]'),
```

Une table `combat_obstacle` n'apporterait rien : on ne requête jamais un mur
tout seul, on lit et on écrit toujours la liste entière avec le combat. Le
`jsonb` suit le combat, y compris son `ON DELETE CASCADE`.

Migration à créer sous `server/src/db/migrations/`, puis `npm run db:migrate`
tout de suite.

### 4.3 Route

`PUT /:id/combats/:cid/obstacles` — MJ seul, calquée sur le PATCH
`/environment` (`server/src/routes/combats.ts:376`).

On envoie **la liste complète**, pas un delta. Seul le MJ écrit, la liste est
petite, et ça rend la route idempotente — pas de conflit possible entre deux
onglets du MJ.

Validation serveur (le client peut mentir) :
- 40 murs maximum, 200 points par mur maximum
- chaque coordonnée finie, ramenée dans `[-half, half]`

Puis `broadcastCombatState(combatId, check.gmUserId)` — le SSE existant fait
tout le reste.

### 4.4 Diffusion

`serializeCombat` recopie `obstacles` tel quel : **ce n'est pas un secret.** Un
mur est visible à la table, tout le monde le voit. Le mode table (`/table`) et
la vue joueur l'affichent sans une ligne de plus, ils rendent déjà le même
`CombatState`.

---

## 5. Effacer

En mode mur, un tap sur un mur l'efface. Toast « Mur effacé. »

Pas de confirmation : un mur se retrace en un geste, et une modale à chaque fois
tuerait le rythme. Pas de gomme séparée non plus — un bouton de plus pour ce
qu'un tap fait déjà.

Techniquement : les meshes de murs portent `userData.wallId`. Le test se fait
dans `finishDrawing`, pas dans `handleTap` : hors du mode mur, un tap ne doit
jamais atteindre un mur, sinon un mur posé devant un pion volerait sa sélection.

---

## 6. Annuler

Le bouton `Undo2` annule **le dernier geste de mur**, pas seulement le dernier
mur posé. Deux gestes existent, et les deux s'annulent :

| Geste | Annuler le remet comment |
|---|---|
| Un mur tracé | On l'enlève |
| Un mur effacé | On le remet |

Sans ça, effacer serait irréversible et le tap-pour-effacer deviendrait
dangereux. C'est ce qui permet de garder l'effacement sans confirmation (§5) :
les deux décisions se tiennent.

### 6.1 Comment

Une pile en mémoire côté MJ, dans `BattleMapTab.vue` :

```ts
type WallAction = { type: 'add' | 'erase'; wall: BattleWall }
```

Annuler = dépiler, inverser l'action sur la liste locale, envoyer la liste
complète au serveur. La route est déjà idempotente et prend la liste entière
(§4.3), donc il n'y a **rien à ajouter côté serveur** : annuler n'est qu'un PUT
de plus.

Bouton `disabled` quand la pile est vide — `AppIconBtn` a déjà la prop.

### 6.2 Ce qu'on ne fait pas, et pourquoi

- **Pas de redo.** Personne ne l'a demandé, et ça double la machinerie d'état
  pour un geste qui se refait en une seconde au doigt.
- **La pile vit en mémoire, pas en base.** Un F5 la vide. Une pile d'annulation
  partagée entre les onglets du MJ et rejouable après rechargement, c'est un
  autre chantier — et le besoin réel, c'est « je viens de rater mon tracé »,
  qui arrive dans les trois secondes.
- **Elle n'annule que TES gestes.** Elle est locale au MJ, et le MJ est le seul
  à écrire. Pas de cas tordu à gérer.

---

## 7. Les fichiers

| Fichier | Ce qu'on y fait |
|---|---|
| `client/src/components/battle/walls.ts` | **Nouveau.** Logique pure : rééchantillonner, lisser, construire les segments (position, angle, longueur). |
| `client/src/components/battle/wallMaterials.ts` | **Nouveau.** Les matériaux et leur peinture au canvas. |
| `client/src/components/battle/WallPalette.vue` | **Nouveau.** La rangée de pastilles. |
| `client/src/components/battle/walls.test.ts` | **Nouveau.** Voir §7. |
| `client/src/components/battle/BattleGrid3D.vue` | Mode tracé, aperçu vivant, meshes des murs, tap pour effacer. |
| `client/src/components/battle/BattleMapTab.vue` | Les boutons `BrickWall` et `Undo2` (MJ seul), la pile d'annulation, l'appel au serveur. |
| `client/src/api/combats.ts` | `obstacles` dans `CombatState`, `setCombatObstacles()`. |
| `client/src/composables/useCombat.ts` | `setObstacles()`. |
| `server/src/db/schema.ts` + migration | La colonne `obstacles`. |
| `server/src/routes/combats.ts` | Le `PUT /obstacles`. |
| `server/src/combats/serialize.ts` | Recopier `obstacles`. |

La géométrie (Three.js) reste dans `BattleGrid3D.vue`. Les maths du tracé
partent dans `walls.ts` : c'est du calcul pur, donc c'est testable, et c'est là
que sont les vrais pièges.

---

## 8. Les tests

Sur `walls.ts`, en Vitest, à côté du source :

| Ce qu'on vérifie | Pourquoi ça compte |
|---|---|
| Rééchantillonnage : 60 points collés → une poignée espacés d'au moins 0,3 | C'est ce qui enlève la tremblote |
| Une ligne droite reste droite après lissage | Le lissage ne doit pas courber ce qui est droit |
| Un tracé d'un seul point ne produit aucun segment | Le tap accidentel ne crée pas de mur |
| Chaque segment : bon centre, bon angle, longueur = distance + épaisseur | L'allongement, c'est lui qui bouche les virages |
| Un demi-tour (180°) ne casse rien | Le cas tordu que le MJ fera forcément |
| Les points hors grille sont ramenés dans les bornes | Le doigt qui déborde de l'écran |

La pile d'annulation est de la logique pure elle aussi : `applyUndo(walls,
action)` part dans `walls.ts` et se teste sans monter de composant.

| Ce qu'on vérifie |
|---|
| Annuler un ajout enlève le bon mur, pas un autre |
| Annuler un effacement remet le mur **avec le même id** |
| Annuler deux fois remonte deux gestes, dans le bon ordre |
| Pile vide : rien ne casse |

---

## 9. Ordre de marche

1. `walls.ts` + ses tests → vérif : `npm test -w client` passe au vert.
2. Colonne `obstacles` + migration → vérif : `npm run db:migrate`, la colonne
   existe et vaut `[]`.
3. Route `PUT /obstacles` + `serializeCombat` → vérif : un PUT avec le cookie
   MJ, un GET renvoie les murs ; un PUT avec un compte joueur renvoie 403.
4. Rendu des murs dans `BattleGrid3D` (murs déjà en base, sans tracé) → vérif :
   un mur écrit à la main en base s'affiche sur la carte.
5. Le mode tracé + le bouton → vérif : tracer une courbe, elle apparaît sous le
   doigt, elle survit à un F5, elle apparaît sur `/table`.
6. Tap pour effacer → vérif : le mur disparaît des deux écrans.
7. Annuler → vérif : après un tracé, annuler l'enlève ; après un effacement,
   annuler le remet ; le bouton est grisé quand il n'y a plus rien à annuler.

---

## 10. À surveiller après la première séance

- **L'occlusion des pions.** Le mur fait 1 case de haut : un pion juste derrière
  est masqué jusqu'aux épaules. Ça n'a gêné personne sur le bac à sable, mais un
  couloir de murs pourrait cacher une mêlée entière. Le décor a déjà un
  `cullNear` dans `BattleGrid3D` — un mur au milieu de la grille ne peut pas
  simplement disparaître, il faudrait le rendre translucide.
- **Le blocage du déplacement.** Si le MJ passe son temps à dire « non, tu ne
  peux pas passer là », c'est le signal que ça vaut le coup.
- **Les autres obstacles.** Un rocher, un tonneau, une porte. Mais seulement si
  le manque se fait sentir à la table, pas avant.

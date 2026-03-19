---
source: tda-livre-joueur
version: "0.2"
last_reviewed: 2026-03-19
---

# Combat et système de jeu (CO — Terres d’Arran)

Ce fichier décrit le système de résolution et le déroulé de combat présents sur les pages 42–166 (chapitres 4–6).

## 1) Actions : MJ décide ou test

Quand un joueur décrit une action, le MJ :
- décide lui-même du résultat quand l’issue est évidente ;
- sinon demande un test.

## 2) Résolution d’un test

Un test se résout ainsi :
d20 + Mod. de la caractéristique concernée >= difficulté.

Le MJ peut appliquer des bonus/malus selon la situation, et certaines capacités peuvent ajouter un bonus au résultat.

### Tableau des difficultés

- Facile : 5
- Moyenne : 10
- Difficile : 15
- Très difficile : 20
- Pratiquement impossible : 25
- Incroyable : 30

### Réussite critique

Une réussite critique s’obtient par un **20 naturel** sur le d20 (sans modificateur).

En cas d’action générique, la réussite critique donne aussi un avantage supplémentaire (au choix du joueur).

En combat : les dommages (DM) d’une attaque en réussite critique sont **doublés** (bonus fixes inclus).
Le joueur peut proposer un effet d’avantage alternatif au lieu de doubler les DM (désarmer, faire reculer, aveugler 1d6 tours, faire chuter, etc.), avec validation du MJ au cas par cas.

### Échec critique

Pour beaucoup de tests : un **1 naturel** (souvent d20, parfois d12) = échec critique.
L’action échoue automatiquement, même si le total final avec bonus indiquerait une réussite.
Le MJ improvise alors un effet supplémentaire désagréable (facultatif, selon la situation).

## 3) Tests en opposition

En opposition, chacun lance un test. Le plus grand résultat l’emporte.

Si un participant obtient une réussite critique et pas l’autre, il remporte l’opposition quel que soit le résultat numérique de l’adversaire.

## 4) Série de tests

Parfois, la réussite demande plusieurs tests consécutifs.
Le MJ peut utiliser des niveaux de réussite (2 réussites = réussite simple, 3 = réussite “forte”, etc.) et des paliers d’échec (p. ex. perte de PV ou accident dramatique).

## 5) Test en coopération

Chaque participant qui aide effectue un test de difficulté 10 avec la même caractéristique que l’action principale.
En cas de réussite : le bonus au partenaire est de +2 (+4 si la réussite est critique).

## 6) Points de chance : PC, prendre 10 / prendre 20

Les points de chance permettent d’ajouter +10 à un jet de d20 après avoir pris connaissance du résultat.
Récupération : à chaque passage de niveau.

Rappel (formule) : PC = 2 + Mod. de CHA.
Bonus : la famille des aventuriers bénéficie d’un bonus supplémentaire de +2 à cette formule.

### Prendre 10 ou 20 (simule du temps passé)

Pour une action qui prend normalement 1 tour (10 secondes) :
- prendre 10 : en échange de 2d6 minutes, le joueur obtient l’équivalent d’un “10” sur le d20 ;
- prendre 20 : parfois possible en 2d6 heures, équivalent d’un “20” sur le d20.

Cela ne remplace pas une action dont la difficulté est trop élevée.

## 7) Le combat

### Tour de combat

Le tour de combat est une unité de temps de **10 secondes**.

### Types d’actions au tour

À son tour, un personnage peut :
- 1 action limitée ;
- OU 1 action de mouvement + 1 action d’attaque ;
- OU 2 actions de mouvement.

Actions distinguées :
- action de mouvement (M) : environ 20 m, se relever, ramasser une arme, boire une potion, dégainer ;
- action d’attaque (A) : attaque normale au choix ;
- action gratuite : en plus des actions normales, si une capacité permet d’en faire une attaque ou un déplacement.

### Surprise / embuscade

Pour surprendre un groupe :
1. Les assaillants doivent s’être dissimulés.
2. Les membres du groupe surpris font un test de SAG de difficulté [10 + Mod. de DEX du plus faible des assaillants].
3. Les créatures avec bonus de discrétion ajoutent ce bonus à la difficulté.

Ceux qui ratent sont surpris lors du premier tour.
Le MJ peut modifier la difficulté selon distance et environnement.

### Initiative

Au début de chaque tour de combat :
- le plus haut score d’initiative agit en premier ;
- ensuite, dans l’ordre décroissant ;
- en cas d’égalité : avantage aux PJ sur les PNJ ;
- en cas d’égalité entre PJ : départage selon le score de SAG.

Réduire son initiative pour agir plus tard est autorisé ; la nouvelle valeur reste valable pour le reste du combat.

### Résolution des attaques en combat

Quand vous tentez d’attaquer :
- type d’attaque : contact / distance / magique ;
- difficulté du test d’attaque = DEF de l’adversaire.

Si d20 + bonus >= DEF : attaque réussie et inflige des dommages.
Sinon : attaque échoue.

Exemples de malus :
- tir à distance en pénombre : -5 ;
- tirer sur une cible engagée au corps-à-corps : malus -2 (si cible du côté du tireur, sinon plus pénalisé).

### Options si la DEF est très élevée

Quand un adversaire a une DEF “haute”, le MJ peut utiliser :
- attaque assurée (L) : +5 au test d’attaque, mais DM divisés par 2 (arrondi à l’inférieur) ; pas de critique ;
- soutenir (L) : donne un bonus de +5 à un allié qui cible le même adversaire au contact.

### États préjudiciables

Un état préjudiciable impose des pénalités :
- Aveuglé : -5 initiative, -5 attaque, -5 DEF ; -10 attaque à distance
- Affaibli : utiliser d12 au lieu de d20 pour les tests
- Étourdi : aucune action possible, -5 DEF
- Immobilisé : pas de déplacement, utiliser d12 au lieu de d20 pour les tests
- Paralysé : aucune action ; une attaque au contact touche automatiquement et inflige un critique
- Ralenti : une seule action par tour (attaque ou mouvement)
- Renversé : -5 attaque et DEF ; nécessite une action de mouvement pour se relever
- Surpris : pas d’action ; -5 DEF au premier tour de combat

Règle d12 / bascule :
Si une capacité remplace d20 par d12, vous ne lancez plus d20. Obtenir 12 au d12 n’est pas une réussite automatique : cela permet seulement de “reprendre” la règle normale de réussite/critique (avec conservation du meilleur résultat).

### Modificateurs d’attaque (exemples)

- À couvert : malus -2 à -5 ( -5 si un allié masque la cible, -2 autrement).
- Défense simple (A) : sacrifier une attaque pour gagner +2 en DEF jusqu’au prochain tour.
- Défense totale (L) : ne faire que se défendre ; +4 en DEF jusqu’au prochain tour.

Autres exemples :
- pluie forte : -2 aux tests physiques (attaques incluses)
- arme non maîtrisée : -3 au test d’attaque
- bouclier non maîtrisé : -3 initiative, -3 attaque, et malus -3 à tous les tests de FOR et DEX
- noir total : voir “Aveuglé” ; attaques magiques nécessitant de voir une cible sont impossibles

Effets répétés :
si une capacité limitée est répétée sur une même cible durant un même combat, le MJ peut imposer un malus cumulatif de -5 en attaque par réutilisation.

### Portée et armes en mêlée

- Portée longue : armes de tir/lancer jusqu’au double de la portée, mais -5 au score d’attaque ; sorts/pouvoirs d’attaque testables suivent aussi.
- Arme de trait/jet en mêlée : impossible lorsqu’on est directement au contact.
- Une arme de tir peut être utilisée en mêlée mais avec -3 au test d’attaque.

### Résolution des dommages (DM)

Quand une attaque réussit :
1. lancer le dé de dommages de l’arme ou du sort,
2. ajouter un modificateur de dommages selon le type :
FOR au contact, INT ou SAG pour la magie,
3. soustraire aux PV de la cible.

En réussite critique : les DM sont doublés.

Combat à mains nues :
- sans capacité dédiée, dommages non létaux = 1d4 + Mod. de FOR,
- ce sont des DM temporaires.

### DM temporaires (non létaux)

Vous pouvez choisir d’infliger des DM temporaires (assommer plutôt que tuer).
Dans ce cas :
- tests d’attaque : malus -2 sauf si arme adaptée (mains nues, gourdin, etc.),
- les DM temporaires sont calculés puis “stockés” à part (ils ne remplacent pas les PV),
- si les DM temporaires dépassent les PV restants : la cible est assommée.

Récupération :
une créature récupère 1 point de DM temporaire par minute.

DM temporaires et critique :
si une attaque devait infliger des DM temporaires mais est un échec critique, la cible encaisse des DM létaux doublés comme un critique.

### Inconscience et mort

- Une créature ou PNJ à 0 PV meurt immédiatement sans possibilité de sauvetage.
Le MJ peut appliquer la règle PJ à un PNJ important.
- Un PJ à 0 PV tombe au sol, inconscient, et ne peut plus agir.
S’il n’est pas soigné (ou aidé médicalement) dans l’heure qui suit : il meurt définitivement.
Un test d’INT difficulté 10 suffit pour simuler l’aide médicale (selon la marge du livre).

Règle :
un personnage ne peut pas descendre sous 0 PV (sauf capacité spéciale), mais le délai avant mort peut être raccourci ou allongé selon la vraisemblance (incendie, poison, etc.).

### Points de récupération (PR) pendant un combat / repos

Chaque personnage possède 5 PR (Ogre : 6).

- se reposer environ 5 minutes : dépenser 1 PR pour regagner PV = [1 DV + Mod. de CON + niveau].
- PR comme fatigue : chaque épreuve éreintante consomme 1 PR.
- nuit de repos : après 6 à 8 heures de sommeil, regagne 1 PR (sans dépasser le maximum de base).
- le MJ peut refuser le gain en cas de stress/inconfort et demander un test de CON réussi (difficulté 10 ou 15).

### Règles de poursuite (résumé)

Vitesse “simple” :
la plupart des créatures humaines parcourent 20 m par action de mouvement.

À chaque tour :
déterminez la distance initiale.
Les créatures utilisent leurs actions en mouvement ; si une créature utilise une autre action, elle perd automatiquement 20 m.

Tests :
pour chaque tour, chaque créature fait un test de DEX, modifié par la DEF si l’armure s’applique.
Un protagoniste dépasse d’au moins 10 points l’adversaire : il gagne une action supplémentaire (mouvement ou attaque) pour rattraper/distancer.
Si l’écart est inférieur à 10 : la distance diminue/augmente d’autant en mètres.

Fin de poursuite :
en pratique, elle s’arrête si les protagonistes se perdent de vue (distance limite à fixer par le MJ selon le terrain).

Après environ une dizaine de tours, le MJ peut remplacer les tests DEX par des tests de CON (poursuite d’endurance).

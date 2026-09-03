# Passe game-design — idées de next features

Brainstorm, pas un plan d'implémentation. Base : fiche perso, jets 3D, campagnes,
rencontres, combat actif temps réel, journal + codex + mentions, notes, dessin,
chat IA, TTS.

---

## Les trous (ce qui manque et qui fait mal)

### 1. Le repos n'existe pas
On a PV, PM, PC (2 + mod CHA), PR (5). Mais rien pour la **nuit de repos** ni pour
les capacités "limitée" (1×/combat, 1×/jour). Chacun compte dans sa tête, et les
joueurs oublient qu'ils ont encore un pouvoir dispo.

**Feature** : bouton "Repos" MJ, à l'échelle de la campagne. Le MJ tape "on dort" →
tout le groupe voit un feu de camp, PM/PC/PR/capacités limitées se rechargent, et
chacun lance son dé de vie. Une pression = tout le monde synchro.
C'est le plus rentable de la liste.

### 2. Les capacités limitées ne sont pas trackées
Une voie CO est pleine de "1 fois par combat". Les voies sont là, le compteur non.

**Feature** : case à cocher sur chaque rang limité, reset au repos / en fin de combat.
Petit à coder, énorme en confort.

### 3. Les états préjudiciables se résument à `affaibli`
CO en a une pile : immobilisé, aveuglé, étourdi, à terre, ralenti.

**Feature** : pastilles d'état cliquables sur les cartes du combat actif, avec durée
en rounds qui décrémente automatiquement au tour du perso. Le MJ arrête de tenir la
compta.

### 4. Les manœuvres n'ont pas de bouton
Désarmer, renverser, aveugler, repousser… c'est dans `knowledge/topics/combat.md`
mais nulle part dans l'UI. Personne ne les utilise parce que personne ne s'en souvient.

**Feature** : bouton "Manœuvre" à côté d'Attaque → liste les 8 → lance le test
d'attaque puis le test opposé → applique l'état.
Ça change la façon dont le groupe joue.

### 5. Les monstres n'ont pas d'attaques jouables
Bestiaire + combat actif existent, mais le MJ relance ses dés à la main.

**Feature** : tap sur le monstre actif → ses attaques listées → jet dans le log commun.

---

## Les idées qui font WAW

### 6. Le Dé du Destin
Une fois par session, la campagne dispose d'**un seul** dé partagé. N'importe quel
joueur peut le brûler pour relancer un jet raté — un seul, et tout le monde le voit
se consumer en direct (écran plein, son, tremblement).
Crée une négociation entre joueurs ("non, garde-le") = du roleplay pur.
Zéro règle nouvelle, 100 % de tension.

### 7. Le journal qui s'écrit tout seul
On a déjà le log de jets, le combat, le codex, les mentions. Fin de séance → l'IA lit
tout et pond une **chronique** écrite comme une page du livre d'Arran :
« Au troisième jour, la compagnie affronta trois gobelins près du pont ; Théos tomba,
relevé par la grâce de… ». Insérée dans le journal, éditable.
Les joueurs relisent leur propre légende. Le meilleur ratio effet / donnée déjà
disponible.

### 8. Le moment critique partagé
Les étoiles sur le 20 et l'onde rouge sur le 1 existent déjà. Pousser le curseur :
sur un 20, **le téléphone de tous les joueurs de la campagne vibre et flashe**.
Sur un 1, c'est un cri collectif dans la vraie pièce.
Le meilleur multijoueur est celui qu'on entend autour de la table.

### 9. Les portraits qui réagissent
La génération d'images existe. Faire 3 variantes par perso : sain / blessé / à terre.
Le portrait bascule selon les PV. Silencieux, permanent : à chaque regard sur la
fiche on *sent* l'état du perso.

### 10. Le MJ dans la poche
Un bouton, un écran : « quelque chose se passe ». L'IA connaît la campagne (codex,
journal, niveau du groupe, avancement) et propose 3 événements crédibles dans les
Terres d'Arran. Le MJ tape sur un, ça devient une note.
Le trou de mémoire du MJ à 23 h, réglé.

### 11. Voix des PNJ
Le TTS existe. Assigner une voix par PNJ du codex : le MJ tape la réplique, elle sort
avec la voix du personnage. Le nain a une voix de nain.
C'est bête et c'est dévastateur.

---

## Spécifique Terres d'Arran / CO

### 12. Brûlure de magie
Présente dans `magie.md`, absente de l'app. Un mystique à 0 PM peut continuer en
brûlant ses PV — un des choix les plus dramatiques du système.

**Feature** : à 0 PM, le bouton du sort ne se grise pas, il devient **rouge**. Lancer
quand même coûte du sang. La rendre visible la rend jouable.

### 13. La mort et l'agonie
`AgonieModal` existe. Le compléter : compteur de rounds public en combat, jet de
survie, et les autres joueurs qui voient le décompte.
Le stress collectif est la mécanique.

### 14. Les voies de prestige comme un but
Les joueurs montent des rangs sans jamais voir où ça mène.

**Feature** : arbre de progression montrant les 5 rangs à venir de chaque voie, les
prestiges déblocables et ce qui manque. Le joueur voit sa légende future, pas juste
sa case actuelle.

### 15. Cartes de compétences plutôt que texte
CO se joue au d20 + carac + rang. Chaque test devrait être un tap depuis un catalogue
de compétences, pas un calcul mental. `utils/attackBonus.ts` existe — l'étendre à
tous les tests.

---

## Si on n'en garde que 4

1. **Le repos partagé** (#1 + #2) — répare le vrai trou, se sent dès la 1re séance.
2. **Les manœuvres jouables** (#4) — débloque une moitié du système inutilisée.
3. **La chronique auto** (#7) — le « waw », et toute la donnée est déjà là.
4. **Le Dé du Destin** (#6) — petit à coder, gros à table.

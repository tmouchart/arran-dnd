# 27 — Isilwen : le combat en cours en tête

**Statut** : livré
**Problème** : en plein combat, Isilwen ne sait ni le round, ni à qui c'est le tour, ni qui est blessé. Elle ne peut pas conseiller au moment où on lui pose le plus de questions.
**Décision** : le combat actif de la campagne est rendu en texte dans le prompt, après la section campagne, avec le **même masquage MJ/joueur que l'écran de combat**. Plus les derniers jets du combat.

---

## 1. Ce qui existe déjà

- Un combat actif = `combats.status = 'active'` sur la campagne active (`schema.ts:207`).
- `serializeCombat(combat, participants, isGm)` (`server/src/combats/serialize.ts:60`) est **le seul endroit** qui décide ce qu'un utilisateur a le droit de voir : ordre d'initiative, tour courant, monstres masqués pour les joueurs (PV → `intact / blesse / mal_en_point / agonisant / mort`, stats et attaques à `null`), réserve du MJ vide pour un joueur. On le réutilise tel quel : Isilwen ne peut pas voir plus que l'écran.
- `enrichParticipantHp` / `enrichParticipantStates` (`sseStore.ts:31`, `:85`) : les PV et états des PJ vivent sur leur fiche, pas sur le combat.
- `rollEvents` (`schema.ts:263`) : chaque jet, avec `combatId`, `visibility` (`gm` pour les jets de monstres), `label`, `total`, `damage`.
- La DEF d'un monstre n'est affichée qu'au MJ dans l'écran de combat (`CombatView.vue:552`). Même règle ici.

---

## 2. Cible

### Composition du contexte

```
┌─ ZONE CACHÉE (inchangée) ───────────────────────────────┐
│ préambule + règles + index des monstres                  │
└──────────────────────────────────────────────────────────┘
  1. fiche du personnage actif
  2. section campagne (plan 26)
  3. ## Combat en cours : <nom>            ← nouveau, seulement s'il y en a un
  4. previousCharacter
  5. historique
```

Le combat change à chaque tour, donc il va **après** le journal (qui change moins), pour garder le préfixe stable le plus longtemps possible.

### Rendu — vue joueur

```
## Combat en cours : Embuscade au gué
Round 3. C'est le tour de : Nym.
Tu es Bracco (PV 12/34, DEF 16, états : renversé).

Ordre d'initiative :
1. Gobelin archer (monstre) — blessé
2. Nym (joueur) — PV 20/20, DEF 14  ← tour en cours
3. Bracco (joueur) — PV 12/34, DEF 16, états : renversé
4. Chef gobelin (monstre) — intact, états : étourdi
5. Gobelin (monstre) — mort

Derniers jets du combat :
- Nym : Attaque épée → 17 (dégâts 6)
- Bracco : Attaque hache → 4 (fumble)
- Gobelin archer : Attaque arc → 15 (dégâts 5)
```

Pour un monstre vu par un joueur : **nom, kind, état qualitatif, états préjudiciables**. Rien d'autre. Pas de DEF, pas de PV chiffrés. Un jet `visibility = 'gm'` n'apparaît pas.

### Rendu — vue MJ

Même structure, plus pour chaque monstre : `PV 8/15, DEF 13, NC 1, init 10, FOR +2 DEX +1 …`, attaques (`nom +bonus, dégâts`), capacités (nom : description), et une sous-section `Réserve (cachés aux joueurs)`. Tous les jets, y compris `gm`.

### Jets

Les **20 derniers** jets du combat (`rollEvents.combatId = combat.id`), ordre chronologique, filtre `visibility = 'public'` si pas MJ. Format : `- Acteur : label → total` + `(dégâts N)` si `damage`, `(critique)` / `(fumble)` si flag.

### Prompt

Nouvelle section 🗡️ dans `SYSTEM_PREAMBLE`, juste après 📜 :
- S'il y a une section « Combat en cours », l'utiliser pour tout conseil tactique : à qui c'est le tour, qui est en danger, quelle action est possible avec les règles de combat ci-dessus.
- Pour un joueur : ce qui est dans la section est ce qu'il voit à l'écran, tu peux le dire. Rien de plus sur les monstres (la règle 🐉 reste).
- Pour le MJ : tu as tout, aide-le à faire jouer les monstres (attaques, capacités).
- Pas de combat dans le contexte = pas de combat en cours, ne l'invente pas.

### Pas d'outil

Tout est en contexte. Pas d'action possible (attaquer, passer le tour) : Isilwen conseille, elle ne joue pas. Hors périmètre.

---

## 3. Découpage

### Zone A — serveur
**Fichiers** : `server/src/chat/combatContext.ts` (nouveau), `server/src/index.ts`

1. `combatContext.ts` : fonction **pure** `buildCombatSection(serialized, rolls, activeUserId): string` qui prend la sortie de `serializeCombat` (déjà masquée), la liste des jets (déjà filtrée) et l'id de l'utilisateur (pour la ligne « Tu es … »). Elle détecte le MJ par `serialized.isGm`. Libellés d'états lisibles (`mal_en_point` → « mal en point », `renverse` → « renversé »). Pas de dépendance à la base.
2. `index.ts` : `fetchCombatContext(campaignId, userId, isGm)` → combat actif le plus récent, participants, `enrichParticipantHp` + `enrichParticipantStates`, `serializeCombat`, jets (20 derniers, filtre visibilité). Retourne `null` s'il n'y a pas de combat actif.
3. Insérer `${combatSection}` entre `campaignSection` et `previousSection`. Log `[chat] section combat : N caracteres` (0 si aucun).
4. Section 🗡️ dans le préambule.

**Vérif** : `npx tsc --noEmit -p server` passe. Avec le bac à sable et un « Combat bidon » lancé, un message dans le chat logue une section combat > 0 caractères. Sans combat : 0.

### Zone B — tests
**Fichiers** : `server/src/chat/combatContext.test.ts`

1. Vue joueur : un monstre n'a ni PV chiffrés ni DEF, seulement l'état qualitatif ; la réserve n'apparaît pas.
2. Vue MJ : PV, DEF, attaques et réserve présents.
3. La ligne « C'est le tour de » pointe le bon participant (via `currentTurnIndex`).
4. « Tu es X » présent pour un joueur, absent pour le MJ sans perso dans le combat.
5. Jets : dégâts, critique et fumble formatés.

**Vérif** : `npm test -w server` passe.

---

## 4. Ordre d'exécution

A puis B (B a besoin de la signature de A). Validation en Chrome avec le bac à sable : `npm run seed-dev`, incarner `mj-dev`, lancer un combat bidon, poser « à qui c'est le tour et qui est en danger ? » côté MJ puis côté `bracco`.

---

## 5. Questions ouvertes

1. ~~Les jets~~ : **20**, décidé le 11/09.
2. ~~MJ en mode viewer~~ : **vue MJ complète**, décidé le 11/09. Le chat n'a pas de notion de viewer.

---

## 6. Hors périmètre

- Agir sur le combat depuis le chat (passer le tour, appliquer des dégâts).
- La carte (positions, obstacles) : sans dessin, une liste de coordonnées n'aide pas le modèle. À revoir si on veut des conseils de placement.

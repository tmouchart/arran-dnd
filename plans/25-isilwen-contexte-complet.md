# 25 — Isilwen : toute la knowledge en contexte

**Statut** : à implémenter
**Problème** : Isilwen répond imprécisément aux questions de règles, ne consulte pas ses documents de façon proactive.
**Décision** : supprimer la recherche de documents. Tout mettre en contexte sauf le bestiaire, exploiter le cache de préfixe, passer sur `gemini-3.8-flash`.

---

## 1. Diagnostic

Cinq causes, toutes vérifiées dans le code.

### a) La réflexion est coupée
`server/src/index.ts:630` → `thinkingConfig: { thinkingBudget: 0 }`
`server/src/index.ts:980` → `output_config: { effort: "low" }`

Elle doit choisir un document puis retrouver une règle dans 50 000 tokens, sans droit de réfléchir.

### b) Elle répond avant d'avoir lu
Le texte du tour 1 est streamé en direct (`index.ts:641`) même quand ce tour se termine par un appel d'outil. Le joueur voit une réponse improvisée, puis une seconde après lecture.

Pire : ce texte est jeté. `index.ts:941` ne réinjecte que le `functionCall`, jamais le raisonnement qui l'a précédé.

### c) Un seul document par question
- Gemini : `allParts.find(p => p.functionCall)` (`index.ts:651`) ne prend que le **premier** appel. Les appels parallèles sont perdus en silence.
- Anthropic : un seul aller-retour codé en dur (`index.ts:1009-1085`), pas de boucle, et **un seul outil** disponible (`knowledge/tools.ts:26`). Pas de journal, pas de compagnons, pas d'édition de fiche.

### d) Les documents sont des blocs indigestes
`loadTopic()` fait un `cat` du fichier entier.

| Fichier | tokens |
|---|---|
| bestiaire.md | 65 281 |
| voies-de-profil.md | 14 107 |
| races.md | 9 377 |
| voies-de-prestige.md | 8 525 |
| tout le reste (10 fichiers) | 22 659 |
| **total** | **123 949** |

### e) L'index a un trou
`knowledge/topics/00-index.md` ne mentionne pas `bestiaire`, alors que l'outil le propose. Il désigne aussi les sujets par nom de fichier (`combat.md`) quand l'outil attend `combat`.

### f) Le prompt parle d'images, pas de règles
`index.ts:202` — sur ~2 500 tokens de préambule : 4 lignes sur la rigueur des règles, une trentaine sur les images, portraits, journal et compagnons, avec cinq « RÈGLE ABSOLUE » toutes sur `generate_image` / `get_character`.

---

## 2. Mesures

Toutes faites sur `gemini-3.8-flash` avec la clé du projet.

### Le cache implicite fonctionne
Trois appels identiques, 124k tokens en contexte :
```
appel 1 -> prompt 119944   cache aucun      2.43s
appel 2 -> prompt 119944   cache 114652     1.20s
appel 3 -> prompt 119944   cache 114652     2.26s
```
96 % du prompt caché dès le 2e appel. Automatique, rien à configurer.

### La latence ne dépend pas de la taille
| Contexte | latence (cache chaud) |
|---|---|
| 22k tokens | 1,03 s |
| 124k tokens | 1,20 s |

### L'ordre décide de tout
Simulation d'un combat où le personnage perd des PV entre chaque message :
```
=== ORDRE ACTUEL (fiche au milieu, index.ts:578) ===
  msg 1 (PV 34) : cache     0 |  0% économisé
  msg 2 (PV 34) : cache 53212 | 94% économisé
  msg 3 (PV 28) : cache     0 |  0% économisé
  msg 4 (PV 21) : cache     0 |  0% économisé

=== ORDRE PROPOSÉ (fiche à la fin) ===
  msg 1 à 4                   : cache 53212 | 94% économisé
```
Le cache est un cache de **préfixe**. Avec la fiche du perso au milieu, chaque perte de PV le fait tomber à zéro — c'est-à-dire pendant le combat, au moment où on pose le plus de questions de règles.

### Le bestiaire est un catalogue régulier
```
214 fiches, toutes en "## Nom du monstre"
0 autre niveau de titre
~900 octets / ~250 tokens par fiche
la liste des 214 noms = 1 511 tokens
```

### Validation sur les deux questions types
Socle monté comme proposé, `thinkingLevel: "low"` :

**Q — « si je fais un coup critique, les dégâts bonus sont doublés aussi ? »**
> Oui, les bonus fixes sont doublés. […] Attention : certains dés additionnels issus de capacités précises (comme l'Attaque sournoise) ne sont pas multipliés.

Sources : `combat.md:39` + `voies-de-profil.md:106`. **Deux documents croisés** — impossible avec l'ancien système.

**Q — « dis-moi mon sort de niveau 4 de la voie du mysticisme »**
> Sanctuaire\* — Coût 4 PM — test de SAG difficulté 15 — durée [5 + Mod. SAG] tours, soit 9 tours avec ta Sagesse actuelle.

Sources : `voies-de-profil.md:214` + coût déduit de `magie.md:22` + durée calculée depuis la fiche. **Trois sources combinées et appliquées au personnage.**

### Blocage sur la migration Gemini 3
Aller-retour d'outil sans `thoughtSignature` :
```
400 INVALID_ARGUMENT
"Function call is missing a thought_signature in functionCall parts."
```
Le code reconstruit `contents` à la main (`index.ts:928-951`) en ne gardant que `{ name, args }`. Changer `GEMINI_MODEL` sans corriger ça casse tous les outils.

Note : `thinkingBudget: 0` n'existe plus sur les flash Gemini 3. C'est `thinkingLevel` désormais. Le champ actuel est accepté mais ignoré.

---

## 3. Cible

### Composition du contexte

```
┌─ ZONE CACHÉE (~56 000 tokens, jamais modifiée) ─────────┐
│ 1. préambule système (réécrit)                           │
│ 2. les 13 topics SAUF bestiaire.md                       │
│ 3. liste des 214 noms de monstres                        │
└──────────────────────────────────────────────────────────┘
  4. fiche du personnage actif        ← change souvent
  5. compagnons de campagne
  6. previousCharacter
  7. historique de conversation
```

**Règle absolue** : rien de variable au-dessus de la ligne. Un octet qui change invalide tout ce qui suit.

### Outils

`load_knowledge` **disparaît**. Remplacé par :

```
get_monstre(nom)  →  la fiche, ~250 tokens
```

Elle voit les 214 noms en permanence, choisit, appelle, reçoit 250 tokens précis au lieu de 65 000.

Pourquoi pas un `grep` : une recherche lexicale sur une question sémantique (« le truc qui vole et crache du feu ») échoue en silence, et le modèle ne sait pas s'il a mal cherché ou si la chose n'existe pas. Ici la structure est connue, donc on lit un index au lieu de chercher.

Les autres outils (`edit_character`, `get_journal`, `get_page`, `generate_image`, `get_character`) sont conservés tels quels.

### Modèle
`gemini-3.8-flash` + `thinkingLevel: "low"`. Disponible et testé sur la clé du projet.

### Sécurité MJ
`get_monstre` réservé au MJ, **vérifié côté serveur**, pas par le prompt. Critère : `campaigns.gmUserId === userId` sur la campagne active (`server/src/db/schema.ts:148`). Pour un joueur, l'outil n'est pas exposé au modèle du tout.

---

## 4. Découpage

### Zone A — serveur : contexte et cache
**Fichiers** : `server/src/index.ts`, `server/src/knowledge/loadKnowledge.ts`

1. `loadAllKnowledge()` : concatène les 13 topics sauf `bestiaire.md`, en mémoire au démarrage (pas de lecture disque par requête).
2. `loadMonsterNames()` : parse les `## ` de `bestiaire.md` au démarrage → liste en mémoire.
3. `loadMonster(nom)` : extrait une section `## Nom` jusqu'au `## ` suivant. Insensible à la casse et aux accents. Retourne `null` si inconnu.
4. Réécrire la construction de `system` (`index.ts:578`) dans l'ordre cible. Le bloc statique est calculé **une fois** au démarrage, pas par requête.
5. `thinkingLevel: "low"` côté Gemini, `effort: "medium"` côté Anthropic.
6. `GEMINI_MODEL=gemini-3.8-flash` dans `server/.env` et le défaut de `index.ts:175`.

**Vérif** : `logTokens` montre `cachedContentTokenCount > 50000` sur le 2e message d'une conversation, **et** sur le 3e après une perte de PV.

### Zone B — serveur : outils
**Fichiers** : `server/src/knowledge/tools.ts`, `server/src/index.ts`

1. Supprimer `load_knowledge` des deux définitions d'outils et les branches correspondantes (`index.ts:664-681` et `1004-1085`).
2. Ajouter `get_monstre(nom)`, exposé **uniquement si l'utilisateur est MJ** de la campagne active.
3. Bufferiser le texte du tour 1 : ne l'émettre que si aucun appel d'outil n'est détecté.
4. Réinjecter dans `contents` le texte **et** le `thoughtSignature` de chaque part, pas seulement `{ name, args }`. Corrige la perte de contexte et débloque Gemini 3.
5. Boucler sur **tous** les `functionCall` d'un tour, plus seulement le premier.
6. Donner à Anthropic la même boucle et la même palette d'outils que Gemini.

**Vérif** : un tool call réussit sans 400. Une question sur un monstre en tant que joueur n'expose pas l'outil. Plus jamais deux réponses successives à l'écran.

### Zone C — prompt et knowledge
**Fichiers** : `server/src/index.ts` (`SYSTEM_PREAMBLE`), `knowledge/topics/00-index.md`

1. Réécrire le préambule : rigueur des règles en tête, plomberie image en fin. Ajouter : *ne jamais donner un chiffre qui ne figure pas dans les règles ci-dessus*.
2. Retirer toute mention de `load_knowledge`.
3. `00-index.md` : ajouter le bestiaire, aligner les noms sur ceux des outils. Cet index reste utile comme table des matières du bloc statique.

**Vérif** : les deux questions types de la section 2 donnent les mêmes réponses justes.

### Zone D — tests
**Fichiers** : `server/src/knowledge/*.test.ts`, `e2e/specs/`

1. Unit tests sur `loadMonster` : nom exact, casse différente, accents, nom inconnu, dernière fiche du fichier (pas de `## ` suivant).
2. Unit test sur l'ordre du bloc statique : deux fiches de perso différentes produisent le **même préfixe**.
3. Il n'existe aucun spec e2e pour le chat. En ajouter un minimal : poser une question de règles, vérifier qu'une réponse arrive.

**Vérif** : `npm test -w server` et `npm run e2e` passent.

---

## 5. Ordre d'exécution

A → B en séquence (B dépend de la structure de contexte posée par A).
C et D en parallèle de B.

---

## 6. Plan B

Si les réponses restent imprécises à 56k, redescendre au socle de 22 659 tokens (combat, magie, création, équipement, monde, lore) et remettre `races`, `voies-de-profil` et `voies-de-prestige` derrière un outil de lecture par section — ce sont des catalogues réguliers, même mécanisme que le bestiaire.

Démarrer au socle complet. Réduire si besoin, jamais l'inverse.

---

## 7. Hors périmètre — à ticketer

- **La source du livre est gitignorée.** `.scratch/tda_01_p42_166.txt` (289 Ko, pages 42–166) est la vraie référence des règles de base, et `.gitignore:26` l'exclut. À déplacer dans `knowledge/sources/` et versionner.
- **`.scratch/livre-joueur.txt` est vide** (0 octet) alors que les topics portent `source: tda-livre-joueur`. Trompeur, à supprimer.
- **`bestiaire.md` n'a aucun frontmatter** — ni source, ni version, pour 65 000 tokens. Généré depuis `knowledge/bestiaire/*.png` au commit `cbf045c`.
- **Le modèle TTS est un preview ancien** — `gemini-2.5-flash-preview-tts` (`server/src/routes/tts.ts:41`).
- **Double source de vérité sur le modèle** — `server/src/ai/client.ts` définit ses propres clients et constantes, dupliqués dans `index.ts:175-199`.
- **`StreamDonePayload` ment** — le client déclare `bundle: string` (`client/src/api/chat.ts:23`), le serveur envoie `{ model, usage, topic }`.

# Plan 06 — Dés (d12 + sandbox), PDV, refonte des notes avec mentions

Vague issue des retours joueurs du 8/10/2026 (Geoffrey, Nicolas, Romain, Jonathan).

## État des lieux (investigation faite)

- **Moteur de dés** : `client/src/utils/dice.ts` est déjà générique (`rollDie(sides)`, `rollDiceNotation`). Le d20 n'est hardcodé qu'aux points d'appel (7 sites dans `ActionsView.vue`, `useDualWield.ts`, `AgonieModal.vue`, `CombatView.vue`). L'écran `/jets` (`JetsView.vue`) est quasi vide — emplacement naturel du dice sandbox.
- **PDV fiche ↔ combat** : déjà fait (commit `d694816`). `character.hp_current` est la source de vérité ; lecture enrichie via `enrichParticipantHp` (`server/src/combats/sseStore.ts`), écriture redirigée dans `PATCH participants`, re-broadcast SSE dans les deux sens. Reste de la dette (voir phase 2).
- **Notes** : 3 silos globaux (notes perso = 1 blob texte sur `user.notes_perso` ; `journal_compagnie` singleton ; `journal_pages`). Texte brut, pas de markdown, pas de mentions, pas de scoping campagne. `markdown-it` + `dompurify` déjà installés (utilisés dans ChatView). `GET /api/campaigns/:id` renvoie déjà `members[]` avec `characterName` → prêt pour l'autocomplétion.

---

## Phase 1 — Dés : d12 sur les jets + dice sandbox

### 1a. Jet en d12 (affliction / attaques spéciales)

Deux besoins distincts dans la conversation :
- **Geoffrey** : statut global (affamé/fatigué) → *tous* les jets passent en d12. « Une variable générale, facilement actionable. »
- **Nicolas** : certaines attaques se font au d12 pour plus de dégâts → choix ponctuel par jet.

Implémentation :
1. Ajouter un booléen « Affaibli » sur le personnage (persisté sur `character`). UI décidée : une **pill cliquable avec emoji** (ex. 🥀 Affaibli), état « active » quand le perso est affaibli — même langage visuel que les `AppBadge` actives. Placée à **deux endroits** : le panel PV & Ressources (`ResourcesCard.vue`) et la page « Mes actions » (`ActionsView.vue`). Quand elle est active, tous les `rollDie(20)` passent en `rollDie(12)`.
   → verify : toggle actif → jet d'arme affiche « d12 = X » ; toggle off → d20.
2. Centraliser : remplacer les `rollDie(20)` d'ActionsView/useDualWield/AgonieModal par un helper `rollAttackDie()` qui lit le toggle. Attention à la main faible déjà en d12 (`useDualWield.ts:120`).
3. Option par attaque (cas Nicolas) : bouton secondaire « d12 » sur la ligne d'arme (comme l'attaque à 2 armes qui est une case à part — suggestion Geoffrey). À valider avec les règles exactes du skill avant de coder.
4. Historique : ajouter `sides` à `RollEntry` (`useRollHistory.ts`), migrer l'affichage `RollHistoryPanel.vue` (`d20=` en dur, crit/fumble sur `die === 20` / `=== 1` → basé sur `sides`).
   → verify : un jet d12 apparaît « d12 = X » dans l'historique, crit détecté sur 12.

### 1b. Dice sandbox (`/jets`)

`JetsView.vue` devient le sandbox : lancer n'importe quel dé sans contexte d'attaque.

1. Étendre `parseDiceNotation` pour supporter `XdY+Z` (`2d6+3`). Tests unitaires (`dice.test.ts`).
2. UI mobile-first dans `JetsView.vue` :
   - Rangée de gros boutons dés : d4, d6, d8, d10, d12, d20, d100 (tap = 1 lancer immédiat).
   - Stepper « nombre de dés » + champ modificateur (ex. 3 × d6 + 2).
   - Résultat en gros, détail des dés individuels dessous, animation courte.
3. Chaque lancer alimente `useRollHistory` (nouveau kind `'libre'`).
   → verify : `npm test -w client` vert ; lancer 2d6+3 affiche les 2 dés + total ; visible dans l'historique.

Estimation : phase la plus rapide, tout le socle existe.

## Phase 2 — PDV : nettoyage de la dette (le lien est déjà fait)

À dire aux joueurs : c'est fixé depuis `d694816`. Reste à assainir :

1. Supprimer le système `sessions` legacy in-memory (2ᵉ copie des PV) : `server/src/sessions/store.ts`, `routes/sessions.ts`, `SessionListView.vue`, `SessionView.vue`, `useSession.ts`, routes `/sessions` du router, appels `syncParticipantHpFromCharacter` dans `characters.ts`. Plus accessible depuis la nav → suppression sûre. **Confirmer avec Thomas avant.**
2. `combat_participant.hp_current/hp_max` : snapshot mort pour les joueurs (écrasé en lecture, jamais mis à jour). Les rendre null pour `kind='player'` à la création + migration.
3. Cache localStorage `arran-hp-current` (`useCharacter.ts:23`) : clé globale non scopée par personnage → scoper `arran-hp-current:<characterId>` ou supprimer.
4. (Optionnel) PATCH ciblé PV au lieu du PUT full-object debounce 800 ms — réduit le risque d'écrasement concurrent MJ/joueur.
   → verify : combat en cours, MJ baisse les PV pendant que le joueur édite sa fiche → pas d'écrasement ; tests serveur verts.

## Phase 3 — Refonte notes : fiches, mentions @, privé/partagé

Design complet de l'agent UX sauvegardé dans `.claude/agent-memory/ux-designer/journal_redesign.md`. Résumé des décisions :

- **3 onglets** : Journal de bord (inchangé, lock live) / Notes (fusion pages partagées + notes perso multiples) / Fiches (personnage · lieu · autre).
- **Notes perso = liste de notes** (plus un blob unique). Chaque note a un id → « Publier » (privé → partagé) devient un changement de visibilité, pas un copier-coller. Undo toast ~6 s, pas de dialog. Répond au besoin de Nicolas.
- **Mentions @** : autocomplétion. Sources = membres de la campagne (déjà dispo via `GET /api/campaigns/:id → members[]`) + fiches créées. Mobile : barre de suggestions ancrée au-dessus du clavier ; aucun résultat → « Créer la fiche “X” » en bottom sheet (nom pré-rempli, type en 3 boutons, description optionnelle).
- **Fiche mentionnée** : bottom sheet (mobile) / popover (desktop), avec « Voir toutes les mentions » → répond au « journal de mentions » de Jonathan (digest par fiche, v1 ; flux « tout ce qui parle de moi », v2).
- **Formatting** : markdown léger tapé (gras, italique, titres, listes, @mention) — pas de barre de boutons. `markdown-it` + `dompurify` déjà là.
- **Note → fiche** : une note peut être convertie en fiche codex (action « Convertir en fiche » dans le menu de la note). Flow : bottom sheet de création de fiche pré-rempli (titre de la note → nom, contenu → description, type à choisir). La note d'origine est supprimée après conversion (avec undo toast), sauf si l'utilisateur décoche « supprimer la note ». Cas d'usage : on griffonne sur un PNJ en session, on formalise après.
- **Dessins** : les pages `type: 'drawing'` (strokes JSON, `DrawingCanvas.vue`) doivent survivre à la refonte. Elles restent des notes partagées avec `type: 'drawing'` dans l'onglet Notes (icône `Brush`, vignette si possible). Pas de mentions dans un dessin. Bonus naturel : pouvoir attacher un dessin à une fiche lieu (la map du lieu) — à faire si pas cher, sinon backlog.

### Découpage technique

1. **DB + API fiches** : table `codex_entry` (`id, campaignId, type: 'personnage'|'lieu'|'autre', name, description, createdByUserId, timestamps`). CRUD `/api/campaigns/:id/codex`. Migration → `npm run db:migrate`.
2. **DB notes** : table `note` (`id, ownerUserId, campaignId?, title, type: 'text'|'drawing', content, visibility: 'private'|'shared', timestamps`). Migrer `journal_pages` vers `note` partagées (y compris les dessins : le champ `content` porte les strokes JSON, comme aujourd'hui), ou garder `journal_pages` et n'ajouter que les notes privées — **à trancher à l'implémentation** (le plus simple d'abord). Migration du blob `user.notes_perso` → une note privée « Anciennes notes ».
3. **Composant `AppBottomSheet`** (nouveau primitive UI, validé par le design).
4. **Éditeur avec mentions** : textarea + détection `@` + barre de suggestions ; insertion au format `@[Nom](codex:id)` ou similaire ; rendu markdown-it avec plugin mention → lien cliquable ouvrant le bottom sheet.
5. **Onglet Fiches** + écran mentions par fiche (recherche `content LIKE`/index simple, petit volume).
6. **Rendu markdown** des notes et du journal (dompurify).
   → verify par étape : tests unitaires sur le parsing des mentions ; puis agent `playtester` sur le flux complet (créer note privée → mentionner → créer fiche à la volée → publier).

C'est la grosse phase. Ordre interne : fiches (1) → notes multiples + publier (2, 3) → mentions (4) → digest (5).

## Phase 4 — Idées bonus (backlog, non planifiées)

Issues du brainstorm + retours joueurs, à discuter :

- **Effets temporaires par tour** (« marques ») : le skill de Romain (DM sur chaque attaque sanglante pendant X tours) montre le besoin — statuts avec compteur de tours sur les participants du combat, icône qui décrémente à chaque tour. Bon candidat pour la vague suivante.
- **Initiative** : Geoffrey dit que les inits sont « souvent fuckées » — il faut d'abord lui demander des cas concrets pour diagnostiquer le calcul avant de refondre. Idée wild-card : révélation de l'ordre carte par carte au début du combat (validation collective de l'ordre).
- **Juice des jets** : animation de dé qui roule, effet crit/fumble (tremblement, désaturation). Peu coûteux dans le sandbox d'abord.
- **Moment 0 PV** : freeze/désaturation d'une seconde quand un perso tombe — petit, fort émotionnellement.
- **Historique des jets partagé** (serveur) : aujourd'hui localStorage only — le MJ ne voit pas les jets des joueurs. À considérer avec le sandbox.

## Ordre proposé

| # | Chantier | Taille | Dépendances |
|---|---|---|---|
| 1 | Dés : d12 + sandbox (phase 1) | S | — |
| 2 | Nettoyage PDV (phase 2) | S/M | confirmation suppression legacy |
| 3 | Fiches + notes + mentions (phase 3) | L | AppBottomSheet |
| 4 | Backlog phase 4 | — | discussions |

## Questions ouvertes pour Thomas

1. ~~Le toggle d12 « Affaibli » : sur la fiche, sur ActionsView, ou les deux ?~~ **Décidé** : pill cliquable + emoji, dans PV & Ressources et dans Mes actions.
2. Règle exacte de l'attaque au d12 de Nicolas (skill précis ?) pour l'option par-arme.
3. OK pour supprimer le système sessions legacy ?
4. Notes : on migre `journal_pages` dans la nouvelle table `note` ou on ajoute juste les notes privées à côté ?

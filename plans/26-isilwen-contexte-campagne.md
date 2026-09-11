# 26 — Isilwen : le contexte de campagne en tête

**Statut** : livré
**Décisions prises** : modèle image passé sur `gemini-3.1-flash-image` (GA) ; notes privées du joueur en contexte.
**Problème** : Isilwen connaît les compagnons, mais le journal de bord n'est lu qu'à la demande et tronqué à 8 000 caractères, le Codex (PNJ, lieux) lui est invisible, et le joueur ne voit pas dans quelle campagne il parle.
**Décision** : journal + Codex directement en contexte, après la fiche du personnage. Nom de campagne toujours présent. Bulle campagne dans le composer.

---

## 1. Diagnostic (audit du 11/09/2026)

| Donnée | Aujourd'hui | Où |
|---|---|---|
| Nom de campagne | présent **seulement s'il y a ≥ 2 membres** | `buildPartySection`, `index.ts:565` |
| Compagnons | résumé en contexte + `get_character` à la demande | `index.ts:565`, `index.ts:795` |
| Journal de bord | outil `get_journal`, **tronqué à 8 000 caractères** | `index.ts:680` |
| Pages partagées | titres via `get_journal`, contenu via `get_page` | `index.ts:667`, `index.ts:701` |
| Codex (Fiches) | **aucun accès** | — |
| Images déjà générées (page Images, ou plus haut dans le même chat) | **aucun accès** : le client n'envoie que `{ role, content }` texte | `ChatView.vue:173`, `api/chat.ts` |

Le journal de bord et les pages partagées ne sont pas liés à une campagne en base (`journal_compagnie` est un singleton `id = 1`, `journal_pages` n'a pas de `campaign_id`). Ce plan **ne corrige pas ça** — c'est un chantier de migration à part (voir § 6).

---

## 2. Cible

### Composition du contexte

```
┌─ ZONE CACHÉE (inchangée) ───────────────────────────────┐
│ préambule + règles + index des monstres                  │
└──────────────────────────────────────────────────────────┘
  1. fiche du personnage actif
  2. ## Campagne : <nom>                     ← toujours, même seul
     - compagnons (résumé, comme aujourd'hui)
  3. ## Codex de la campagne                 ← nouveau
     - une ligne par fiche : type, nom, description
  4. ## Journal de bord                      ← nouveau, entier
  5. ## Pages partagées                      ← titres seulement (id + titre)
  6. ## Tes notes privées                    ← nouveau, notes texte du joueur (pas les dessins)
  7. previousCharacter
  8. historique
```

Tout est dans la zone variable : aucun impact sur le cache de préfixe des règles.

### Outils

- `get_journal` **disparaît** : son contenu est en contexte.
- `get_page(id)` **reste** : les pages partagées peuvent être longues (dessins, textes), on les lit à la demande.
- Les autres outils ne bougent pas.

### Garde-fou taille

Pas de troncature à 8 000. Si journal + codex + notes dépassent **60 000 caractères** (~15k tokens), on coupe dans cet ordre : d'abord les notes privées (les plus anciennes en premier), puis le début du journal (le récent est en bas). Chaque coupe laisse une ligne `[…N caractères omis]`.

### Prompt

Réécrire les sections 📜 et 👥 du `SYSTEM_PREAMBLE` :
- Le journal et le Codex sont **ci-dessous**, plus besoin de les demander.
- Répondre aux questions d'aventure directement depuis le journal, citer la session ou l'entrée du Codex.
- `get_page` pour lire une page partagée dont le titre est pertinent.

### Bulle campagne (client)

Dans le composer de `ChatView.vue`, à côté de la bulle perso `⚔️ Nom` : une bulle `🏕️ Nom de campagne`. Le client a `user.activeCampaignId` via `/api/auth/me` ; il appelle `fetchCampaign(id)` au montage pour le nom. Pas de bulle si pas de campagne active.

---

## 3. Découpage

### Zone A — serveur : contexte
**Fichiers** : `server/src/index.ts`

1. `fetchPartyContext` retourne aussi `campaignId` et `codex: { type, name, description }[]` (une requête sur `codex_entries`).
2. Nouvelle fonction `fetchJournalContext(userId)` : journal de bord entier + liste `{ id, title }` des pages partagées + notes privées de type `text` du joueur (`notes.ownerUserId = userId`, titre + contenu). Réutilise la logique de `get_journal` (auteur de la dernière modif compris).
3. `buildCampaignSection(party, activeCharId, codex, journal)` remplace `buildPartySection`. Le titre `## Campagne : <nom>` est écrit même sans compagnon.
4. Garde-fou 60 000 caractères sur journal + codex + notes (ordre de coupe : notes, puis début du journal).
5. Supprimer `get_journal` de `runTool` et de `tools.ts` (les deux définitions, Gemini et Anthropic).
6. Réécrire les sections 📜 et 👥 du préambule.

**Vérif** : un `console.log` de la taille de la section campagne au premier message. Poser « qu'est-ce qui s'est passé à la dernière session ? » → réponse depuis le journal **sans** appel d'outil visible. Poser « c'est qui <PNJ du Codex> ? » → réponse depuis le Codex.

### Zone B — client : bulle campagne
**Fichiers** : `client/src/views/ChatView.vue`

1. Au montage, si `user.activeCampaignId`, `fetchCampaign(id)` → `campaignName`.
2. Bulle `🏕️ {{ campaignName }}` dans `.composer-left`, même style que `.character-chip` (factoriser la classe en `.composer-chip`).
3. `data-testid="chat-campaign-chip"`.

**Vérif** : en Chrome, avec `bracco` (bac à sable) la bulle « Bac à sable » apparaît. Avec un compte sans campagne, rien.

### Zone C — tests
**Fichiers** : `server/src/*.test.ts`

1. Unit test sur le garde-fou : journal de 100 000 caractères → la section garde la **fin**, et la ligne d'omission est présente. Avec notes + journal trop gros → les notes sautent avant le journal.
2. Unit test : `buildCampaignSection` sans compagnon contient quand même `## Campagne : <nom>`.

**Vérif** : `npm test -w server` passe.

---

## 4. Ordre d'exécution

A, B et C en parallèle (indépendants).

---

## 5. Questions ouvertes

1. ~~Notes privées~~ : **oui**, décidé le 11/09 (notes texte seulement, pas les dessins).
2. Le MJ parle à Isilwen sans personnage actif : la section campagne doit quand même être là. C'est le cas avec la cible ci-dessus (elle ne dépend pas de `character`). À confirmer que le MJ a bien `activeCampaignId` renseigné (`campaigns.ts:72` : oui à la création).

---

## 6. Hors périmètre — à ticketer

- **Journal et pages partagées non scopés par campagne** en base. Migration à prévoir : `campaign_id` sur `journal_compagnie` (fin du singleton) et `journal_pages`, backfill sur la campagne la plus ancienne, filtres dans `routes/journal.ts`.
- **Isilwen ne voit pas les images déjà générées** (page Images, ni celles plus haut dans le même chat) : le client n'envoie que du texte. Pour « refais la même scène mais de nuit », il faudrait renvoyer les `image` ids dans l'historique et les recharger côté serveur en `inlineData`.
- **Le perso envoyé au chat est le perso actif client**, pas `campaign_members.character_id`. Divergent si on change de perso actif après avoir rejoint.
- **Le combat en cours** est invisible pour Isilwen (round, PV des participants).

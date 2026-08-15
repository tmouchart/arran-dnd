# 12 — Historique & versions (anti-perte de contenu)

> **État : implémenté** (2026-08-15). Lots 0 à 3 livrés.
> Deux corrections de conception sont apparues à l'implémentation, décrites
> plus bas : la restauration cible l'`id` de révision (pas le n° de version), et
> une restauration n'est jamais absorbée par le regroupement.

## Pourquoi

Session du 2026-08-14 : Jonathan écrit un long pavé dans le journal de bord.
Romain arrive sur la page, ~50 % du texte disparaît.

Cause réelle (voir « Diagnostic » plus bas) : **le flux SSE du journal n'a pas de
heartbeat**, le proxy Fly le coupe après ~60 s, la fermeture du flux libère le
verrou côté serveur, et les sauvegardes suivantes sont rejetées en 423 puis
**jetées en silence**.

Deux chantiers, indépendants mais complémentaires :

- **Lot 0** — arrêter l'hémorragie (sync temps réel).
- **Lots 1-3** — filet de sécurité : versionner tout contenu éditable, avec un
  bouton « Historique » qui permet de revenir en arrière.

Le `version` du Lot 1 sert **deux** buts : détecter les conflits (409) *et*
alimenter l'historique. Une seule mécanique règle les deux problèmes.

---

## Diagnostic (état des lieux au 2026-08-15)

| # | Trou | Fichier | Gravité |
|---|---|---|---|
| 1 | Flux SSE journal **sans heartbeat** → coupé par Fly à ~60 s | `server/src/routes/journal.ts:103-123`, `:240-262` | 🔴 |
| 2 | Fermeture du flux → `releaseLock()` → verrou perdu en silence | `journal.ts:121`, `:260` | 🔴 |
| 3 | Le SSE journal ne renvoie **pas le contenu** à la (re)connexion | `journal.ts:113-117` | 🔴 |
| 4 | PUT = tout le texte, aucun n° de version → dernier écrit gagne | `journal.ts:70-84`, `notes.ts:38-55`, `codex.ts:73-103` | 🔴 |
| 5 | 423 / erreur réseau → texte jeté, pas de retry, pas d'alerte | `client/src/views/JournalView.vue:77-79` | 🔴 |
| 6 | Le log de jets ne rattrape pas l'historique au reconnect auto | `client/src/composables/useCampaignRolls.ts:56-68` | 🟠 |
| 7 | Boucle combat → fiche : le SSE combat déclenche un PUT de la fiche **entière** | `client/src/composables/useCombat.ts:94-96` → `useCharacter.ts:391` | 🟠 |
| 8 | On peut taper dans le journal sans avoir le verrou (jamais sauvé) | `JournalView.vue:201` vs `:84` | 🟡 |
| 9 | Coupure inactivité 25 min silencieuse sur le log de jets | `useCampaignRolls.ts:41` | 🟡 |
| 10 | Verrous en mémoire + `min_machines_running = 0` → tout saute au réveil | `server/src/journal/locks.ts:18`, `fly.toml` | 🟡 |
| 11 | Pages dessin : aucun verrou, et le chargement déclenche une sauvegarde | `journal.ts:186`, `JournalPageView.vue:88-90` | 🟡 |

Référence : les flux **combats** et **campagnes** font tout ça correctement —
heartbeat 25 s (`combats.ts:496-499`, `campaigns.ts:760`) et état initial envoyé
à la connexion (`combats.ts:502`). Le journal a simplement été écrit à part et a
raté les deux.

---

## Périmètre du versioning

Tout ce qui est du **contenu éditable de journal**. Les fiches de perso jouables
(`character`) sont **hors périmètre** — leur bruit de combat (PV/PM à chaque
tour) rendrait l'historique illisible.

| Entité | Table | Type | Verrou ? | SSE ? |
|---|---|---|---|---|
| Journal de bord | `journal_compagnie` (id=1) | texte | oui | oui |
| Pages publiques | `journal_pages` | texte + dessin | texte oui, dessin non | oui |
| Notes privées | `note` | texte + dessin | non | non |
| Fiches du codex | `codex_entry` | texte (nom/type/description) | non | non |

---

## Lot 0 — Urgence sync (déployable seul, avant la prochaine session)

| # | Action | Vérif |
|---|---|---|
| 0.1 | Heartbeat 25 s sur `/compagnie/events` et `/pages/:id/events` (copier `campaigns.ts:760`) | Laisser un onglet ouvert 5 min en prod, taper → sauvegarde OK (aujourd'hui : 423) |
| 0.2 | Retirer `releaseLock()` du `req.on('close')` du journal ; le TTL 60 s suffit | Couper le réseau 10 s, revenir → toujours éditeur |
| 0.3 | Envoyer le contenu courant + `version` à la connexion SSE | Mettre l'onglet en veille, écrire depuis un 2ᵉ appareil, réveiller → le texte est à jour |
| 0.4 | Renouveler le verrou toutes les 20 s tant que l'onglet est actif (`document.visibilityState`) | Rester 3 min sans taper, puis taper → toujours éditeur |
| 0.5 | Sur échec de sauvegarde : garder le texte, réessayer, afficher une alerte rouge | Simuler un 423 → le texte reste, l'alerte s'affiche, la reprise sauvegarde |
| 0.6 | Zone de texte en lecture seule tant qu'on n'a pas le verrou (trou #8) | Ouvrir une page en spectateur → impossible de taper dans le vide |
| 0.7 | Refetch de l'historique des jets sur `onopen` du flux (trou #6) | Couper le réseau, faire un jet ailleurs, reconnecter → le jet apparaît |
| 0.8 | Découpler les PV du combat de la fiche : `PATCH /hp` ciblé au lieu du watcher profond (trou #7) | Le MJ change mes PV → un seul PATCH dans l'onglet réseau, pas de PUT de fiche |

Tests unitaires : logique de retry/backoff de sauvegarde → `saveQueue.test.ts`.

---

## Lot 1 — Le moteur de versions (serveur)

### 1.1 Schéma

Migration `1700000000035_revisions.sql`.

Une colonne `version` sur les 4 tables — sert au 409 **et** numérote l'historique :

```sql
ALTER TABLE journal_compagnie ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE journal_pages     ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE note              ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE codex_entry       ADD COLUMN version integer NOT NULL DEFAULT 1;
```

Une seule table d'historique pour tout le monde :

```sql
CREATE TABLE revision (
  id             serial PRIMARY KEY,
  entity_type    varchar(30) NOT NULL,   -- journal_compagnie | journal_page | note | codex_entry
  entity_id      integer     NOT NULL,
  version        integer     NOT NULL,
  snapshot       jsonb       NOT NULL,   -- état complet des champs versionnés
  author_user_id integer REFERENCES "user"(id) ON DELETE SET NULL,
  author_name    text        NOT NULL DEFAULT '',  -- dénormalisé : le nom au moment T survit
  kind           varchar(10) NOT NULL DEFAULT 'edit',  -- edit | restore
  size_delta     integer     NOT NULL DEFAULT 0,   -- caractères gagnés/perdus, pour l'UI
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX revision_entity_version ON revision (entity_type, entity_id, version);
CREATE INDEX revision_entity_recent ON revision (entity_type, entity_id, created_at DESC);
```

`author_name` est dénormalisé exprès : l'historique doit rester lisible même si
le joueur change de perso ou quitte la campagne.

### 1.2 Module partagé `server/src/revisions/`

Routes fines, logique dans le service (règle CLAUDE.md).

- `registry.ts` — une entrée par type d'entité :
  ```ts
  { table, versionedFields, contentField, canRead(userId, row), canWrite(userId, row) }
  ```
  Droits :
  - `journal_compagnie`, `journal_page` : tout utilisateur authentifié (lecture + restauration).
  - `note` : propriétaire uniquement.
  - `codex_entry` : membre de la campagne (aligné sur `verifyMember` existant).
- `service.ts` — `saveWithRevision()`, `listRevisions()`, `restoreRevision()`.
- `coalesce.ts` — **fonctions pures, testées** (voir 1.4).

### 1.3 Écriture versionnée

Chaque PUT passe désormais par `saveWithRevision()` :

1. Lire la ligne. Si `body.expectedVersion` est fourni et ≠ `row.version` →
   **409** avec `{ currentVersion, content }`. Le client recharge ou propose une
   fusion — il n'écrase plus jamais à l'aveugle.
2. Si le contenu est identique → ne rien faire (évite le PUT parasite du trou #11).
3. `UPDATE … SET content = …, version = version + 1`.
4. Écrire l'entrée d'historique selon la règle de regroupement (1.4).
5. Purger (1.5).
6. Diffuser en SSE là où il y en a un.

### 1.4 Regroupement — le point délicat

La sauvegarde auto part toutes les 800 ms. Une entrée par sauvegarde = des
milliers de lignes et un historique illisible.

**Règle de fusion** — si la dernière entrée est du **même auteur** et a **moins
de 3 minutes**, on **remplace son snapshot** au lieu d'en créer une nouvelle.
Une heure d'écriture continue ≈ 20 entrées, lisibles.

**Garde-fou anti-Ctrl+A** — la fusion est **interdite** si le nouveau contenu est
une amputation massive :

```
longueur_nouvelle < 50 % de longueur_précédente  ET  perte > 200 caractères
→ forcer une nouvelle entrée
```

Sans ça, un Ctrl+A + Suppr dans la fenêtre de 3 min écraserait justement le
snapshot qu'on veut récupérer. Avec ça, l'état d'avant la catastrophe est
**toujours** conservé comme entrée à part — c'est exactement le cas d'usage
demandé.

Ces deux règles sont des fonctions pures → `coalesce.test.ts` :
`shouldCoalesce()`, `isMassDeletion()`.

### 1.5 Purge

- Texte : garder les **50** dernières entrées par entité.
- Dessin : garder les **20** dernières (le contenu est lourd).
- Ignorer (avec un log) tout snapshot > 1 Mo, pour ne pas faire exploser la base.

Purge exécutée à l'insertion, pas de tâche planifiée.

### 1.6 Restauration

`POST /api/revisions/:type/:id/restore/:version`

- Vérifier le droit d'écriture, et **le verrou** s'il y en a un (423 si quelqu'un
  d'autre édite — sinon la restauration recrée le bug qu'on corrige).
- Réécrire le contenu via le chemin de sauvegarde normal → cela crée une
  **nouvelle** entrée `kind = 'restore'`.
- Diffuser en SSE.

**Une restauration ne supprime jamais rien.** Annuler une annulation est donc
possible, ce qui rend le bouton sans danger — c'est ce qui justifie d'ouvrir la
restauration à tout le monde sur le journal partagé.

### 1.7 Routes

Un seul fichier `server/src/routes/revisions.ts` pour les 4 surfaces :

| Méthode | Route |
|---|---|
| `GET` | `/api/revisions/:type/:id` — liste (métadonnées seules, pas les snapshots) |
| `GET` | `/api/revisions/:type/:id/:version` — un snapshot complet (aperçu) |
| `POST` | `/api/revisions/:type/:id/restore/:version` |

La liste ne renvoie pas les snapshots : sinon ouvrir l'historique d'un dessin
télécharge 20 Mo sur un téléphone.

---

## Lot 2 — L'UI Historique

⚠️ Passer par l'agent `ux-designer` avant d'implémenter (règle CLAUDE.md).

Direction proposée, à valider par lui :

- Bouton icône `History` (Lucide) dans la barre de la page / le `.card-head`.
  **Vérifier la règle des 7 boutons max par barre** sur `JournalView` et
  `JournalPageView` — si c'est plein, l'icône descend dans la barre du bas.
- Clic → `AppBottomSheet` « Historique ». Une ligne par version :
  - nom de l'auteur + date relative (« Jonathan, il y a 12 min ») ;
  - variation de taille (`+340` / `−1 240 caractères`) — une grosse perte en
    rouge saute aux yeux, c'est le repère visuel pour retrouver le Ctrl+A ;
  - badge `AppBadge` sur les entrées `restore`.
- Clic sur une ligne → aperçu en lecture seule (texte rendu, ou dessin dessiné
  sur un canvas non interactif).
- Bouton « Restaurer cette version » → `AppModal` de confirmation, avec le
  rappel « la version actuelle reste dans l'historique ».
- Composable partagé `client/src/composables/useRevisions.ts` — un seul, utilisé
  par les 4 écrans.

Aucun composant `App*` nouveau n'est nécessaire a priori. Si un « élément de
liste d'historique » se répète, en faire un `AppHistoryItem` et l'ajouter à
`ComponentLibraryView.vue`.

---

## Lot 3 — Déploiement surface par surface

Ordre choisi pour valider le moteur sur le cas le plus simple avant le plus
risqué :

| Ordre | Surface | Particularité |
|---|---|---|
| 3.1 | `note` (texte) | Privé, pas de verrou, pas de SSE → le plus simple, sert de banc d'essai |
| 3.2 | `codex_entry` | Ajoute le champ `name`/`type` au snapshot + droits de campagne |
| 3.3 | `journal_compagnie` | Ajoute le verrou + le SSE ; **dépend du Lot 0** |
| 3.4 | `journal_pages` (texte) | Idem, mais entité multiple |
| 3.5 | Dessins (`note` + `journal_pages`) | Purge à 20, aperçu canvas, plafond 1 Mo |

Vérif à chaque étape : écrire → recharger → l'historique liste les entrées avec
le bon auteur ; Ctrl+A + Suppr → sauvegarde → l'historique montre une entrée
distincte avec la grosse perte ; restaurer → contenu revenu **et** nouvelle
entrée `restore` créée.

---

## Tests unitaires (obligatoires — CLAUDE.md)

| Fichier | Couvre |
|---|---|
| `server/src/revisions/coalesce.test.ts` | `shouldCoalesce` (même auteur / autre auteur / hors fenêtre), `isMassDeletion` (seuils 50 % et 200 car., contenu vide, contenu court) |
| `server/src/revisions/prune.test.ts` | Purge 50 / 20, jamais en dessous d'une entrée, plafond 1 Mo |
| `server/src/revisions/service.test.ts` | 409 si version périmée, pas d'écriture si contenu identique, `restore` crée bien une nouvelle version |
| `client/src/composables/saveQueue.test.ts` | Retry après 423, aucune perte de texte en cours |

---

## Corrections apparues à l'implémentation

Deux défauts que les tests ont attrapés avant la mise en production.

**1. La restauration ne peut pas cibler un numéro de version.**
Le regroupement met à jour une révision existante *et son numéro de version*.
Un numéro affiché dans la liste peut donc être réécrit pendant que l'utilisateur
lit l'historique — la restauration tombait alors sur un 404. L'API cible
désormais l'**`id` de la révision**, qui est immuable :
`POST /api/revisions/:type/:id/restore/:revisionId`.

**2. Une restauration se faisait absorber par le regroupement.**
La règle « ne jamais fusionner avec une révision `restore` » ne couvrait que la
révision *précédente*, pas celle qu'on écrit. Résultat : restaurer juste après
une édition écrasait cette édition au lieu de créer un point de repère. La règle
vaut maintenant dans les deux sens (`coalesce.ts`, testé).

## Écart avec le plan initial

- **Dessins : pas de `expectedVersion`.** Plusieurs personnes dessinent en même
  temps et les traits fusionnent déjà par id ; envoyer une version produirait
  des 409 en rafale. Les dessins restent en dernier-écrit-gagne + fusion, avec
  l'historique comme filet. Les pages texte, elles, envoient bien la version.
- **`ux-designer` non consulté** : la maquette validée dans la conversation
  (feuille du bas, liste auteur + date + delta, aperçu, confirmation) a été
  implémentée telle quelle. À repasser si l'usage révèle des frictions.
- Le test `service.test.ts` est un test d'intégration sur la base locale (il
  crée et supprime sa propre note) plutôt qu'un test avec doublures.

## Points ouverts

- **Taille réelle des dessins** : à mesurer sur la base de prod avant de figer la
  purge à 20. Si un dessin pèse déjà des centaines de Ko, passer à un stockage
  par différence de traits plutôt qu'en snapshot complet.
- **Verrous en mémoire** (trou #10) : non traité ici. Les déplacer en base
  supprimerait la perte au réveil de la machine Fly. À planifier séparément.

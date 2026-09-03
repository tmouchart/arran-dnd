# 17 — Tests end-to-end (Playwright)

## But

Vérifier que les parcours **vraiment importants** marchent, de bout en bout :
vrai navigateur → vrai serveur Express → vraie base Postgres.

Au début : sur la machine de dev, une seule commande, en headless.
Plus tard : sur le CI.

## Choix techniques (et pourquoi)

| Choix | Décision | Pourquoi |
|---|---|---|
| Outil | **Playwright** | Headless par défaut, attentes automatiques (pas de `sleep`), trace + vidéo en cas d'échec, multi-contexte (MJ + joueur en même temps). |
| Emplacement | `e2e/` à la racine (nouveau workspace npm) | Ce n'est ni du client ni du serveur : ça teste les deux ensemble. Évite de polluer les `vitest` existants. |
| Base de données | Base séparée `arrandnd_e2e` | Les tests effacent des données. On ne touche jamais à la base de dev. |
| Données de départ | On réutilise `seedDev()` | Il existe déjà, il est idempotent, il crée MJ + 4 joueurs variés. Zéro fixture à réinventer. |
| Serveur sous test | Build de prod (`npm run build` + `npm start`) | Un seul process qui sert l'API **et** le client statique → une seule URL, pas de proxy Vite, plus proche de la prod. |
| Connexion | Vrai formulaire de login (`/login`) une fois, puis réutilisation du cookie | On teste le vrai chemin d'auth. Le cookie est stocké dans un `storageState` par rôle → les autres tests démarrent déjà connectés. |
| IA / TTS | Bloqués au niveau réseau (`page.route`) | Les appels Gemini sont lents, coûteux et non déterministes. Aucun happy path critique n'en dépend. |

Note : `DEV_TOOLS=1` sera actif pour la base e2e, mais **on ne s'en sert pas
pour se connecter**. On garde `/api/dev/switch-user` uniquement comme secours
si un test a besoin d'une 3e identité au milieu d'un scénario.

## Les parcours à couvrir (happy paths)

Ordre = priorité. On s'arrête quand la valeur/coût devient mauvaise.

**Lot 1 — le socle (sans ça, l'app est morte)**
1. **Connexion** — je me connecte avec `bracco`/`dev`, j'arrive sur ma fiche.
   *Vérifie :* nom du perso affiché, cookie posé, refresh = toujours connecté.
2. **Fiche de personnage** — je change mes PV (+/-), je recharge la page, la
   valeur a tenu. Idem pour un champ texte (notes).
3. **Navigation** — les 5 routes principales s'ouvrent sans erreur console
   (fiche, inventaire, jets, journal, campagne).

**Lot 2 — le cœur du jeu**
4. **Combat** — le MJ lance un combat depuis une rencontre, l'ordre
   d'initiative s'affiche, il passe au tour suivant, le joueur voit le même
   round de son côté. *(Deux contextes navigateur en parallèle.)*
5. **Jet de dés** — un joueur lance un jet, le résultat apparaît dans le log
   de campagne côté MJ.
6. **Journal** — je crée une page, j'écris, je sors, je reviens : le texte est
   là. (Régression déjà corrigée en `6b61138`, elle mérite un filet.)

**Lot 3 — le reste**
7. **Codex / PNJ** — le MJ crée une entrée, le joueur la voit (ou pas, si
   cachée).
8. **Inventaire** — j'ajoute un objet, il apparaît, je le supprime.
9. **Multi-joueurs sur la même fiche** — deux onglets, deux modifs, personne
   n'écrase l'autre (régression `00f468b`).

## Structure des fichiers

```
e2e/
├── package.json              # workspace "e2e"
├── playwright.config.ts      # baseURL, reporter, retries, webServer
├── global-setup.ts           # migrate + seed sur arrandnd_e2e, puis login des rôles
├── fixtures/
│   ├── auth.ts               # storageState par rôle : mj, bracco, nym
│   └── stubs.ts              # blocage des appels IA/TTS
└── specs/
    ├── 01-login.spec.ts
    ├── 02-fiche.spec.ts
    ├── 03-navigation.spec.ts
    ├── 04-combat.spec.ts
    ├── 05-jets.spec.ts
    └── 06-journal.spec.ts
```

## Comment on cible les éléments

Règle : **`data-testid` sur les éléments qu'on teste**, pas de sélecteurs CSS
ni de texte fragile. On en ajoute au fur et à mesure, uniquement là où c'est
nécessaire. Sur les boutons icônes (majoritaires ici), `getByRole` ne suffit
souvent pas → le testid est obligatoire.

## Commandes

```bash
npm run e2e            # headless, tout
npm run e2e:ui         # mode interactif Playwright (debug, sans rebuild)
npm run e2e:db         # juste (re)créer + migrer + seeder la base e2e
```

`npm run e2e` fait tout seul : build → créer/migrer/seeder la base e2e →
démarrer le serveur → lancer les tests → couper le serveur. Une commande, rien
à préparer.

Le prep de la base est une étape à part (`e2e:db`) et **pas** un `globalSetup`
Playwright : Playwright démarre le `webServer` avant le `globalSetup`, donc le
serveur planterait sur une base inexistante.

## État — Lots 1 et 2 livrés

Fait (7 tests, ~18 s en local) :
- Infra : workspace `e2e/`, base `arrandnd_e2e`, serveur de prod sur le port 3567,
  connexion réelle par rôle sauvegardée en `storageState`.
- Lot 1 : connexion + session persistante, PV qui survivent au reload, 5 routes
  sans erreur console.
- Lot 2 : combat MJ ↔ joueur synchronisé (SSE), jet de dé qui remonte dans le
  log du MJ, journal de bord qui garde son texte.

Chaque test du lot 1 et du lot 2 a été vérifié **en cassant volontairement le
code** (persistance de la fiche, réception SSE du combat) : le test échoue bien.

Le lot 3 reste à faire.

## Étapes d'implémentation

1. **Installer Playwright** (`e2e/` + config + script racine) → *vérif :* un
   test bidon qui ouvre `/login` passe en headless.
2. **Base e2e isolée** (`DATABASE_URL` dédiée dans `e2e/.env.e2e`, migrate +
   seed dans `global-setup`) → *vérif :* la base de dev n'a pas bougé après un
   run complet.
3. **Fixture d'auth** (login réel → `storageState` par rôle) → *vérif :* un
   test démarre directement sur `/personnage` sans repasser par le login.
4. **Lot 1** (3 specs) → *vérif :* les 3 passent, et cassent si on retire
   volontairement la persistance des PV.
5. **Lot 2** (3 specs, dont le combat à deux navigateurs) → *vérif :* le test
   combat échoue si on casse la synchro de round.
6. **Lot 3** si le rapport valeur/entretien reste bon.
7. **CI** (plus tard) : GitHub Actions + service Postgres + `npx playwright
   install --with-deps chromium`. Le reste de la commande est identique.

## Ce qu'on ne teste PAS en e2e

- Les calculs de règles (init, dégâts, modificateurs) → déjà des unit tests
  Vitest, bien plus rapides.
- Le rendu visuel / le pixel-perfect → pas de tests de screenshot pour l'instant.
- Les réponses de l'IA → non déterministes.
- Les chemins d'erreur (mauvais mot de passe, 404…) → l'objectif ici, ce sont
  les happy paths.

## Risques connus

- **Flakiness** : uniquement des attentes Playwright (`expect(...).toBeVisible()`),
  jamais de `waitForTimeout`. `retries: 1` en local, `2` sur CI.
- **Tests qui se marchent dessus** : chaque spec bosse sur son propre
  personnage/campagne quand elle écrit. Sinon, `fullyParallel: false`.
- **Windows** : le `webServer` de Playwright gère le kill du process ; pas de
  script shell maison.

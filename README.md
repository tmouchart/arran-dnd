# Terres d’Arran — assistant web

Application web pour jouer à **Les Terres d’Arran**, jeu de rôle sur table français utilisant le moteur **Chroniques Oubliées**, dans l’univers des bandes dessinées *Elfes*, *Nains*, *Orcs & Gobelins*, *Mages*, etc.

L’objectif est de réduire la paperasse (calculs, consultation des règles, suivi de personnage) pour que joueurs et meneurs passent plus de temps à la table.

---

## Fonctionnalités

- **Assistant Q&R** — pose des questions sur les règles : le serveur injecte une base de connaissances en Markdown (`knowledge/`) et appelle un modèle de langage (Gemini ou Anthropic selon la configuration).
- **Fiche personnage** — caractéristiques, compétences, PV/PM, attaques, voies, stockée localement dans le navigateur (`localStorage`).
- **Interface** — en français, pensée mobile d’abord, style fantasy léger (Vue 3 + Vite).

---

## Stack

| Partie | Technologie |
|--------|-------------|
| Client | Vue 3, Vite, TypeScript, Lucide |
| API | Node.js, Express |
| IA | Google Gemini (défaut) ou Anthropic Claude (`AI_PROVIDER`) |
| Données de règles | Markdown statique dans `knowledge/` (pas d’extraction PDF automatisée dans le dépôt) |

---

## Prérequis

- **Node.js** 20 ou plus récent  
- Une clé API pour le fournisseur choisi : **Gemini** (par défaut) ou **Anthropic** (voir ci‑dessous)

---

## Démarrage rapide

```bash
cp server/.env.example server/.env
```

Éditer `server/.env` :

- Par défaut, le projet utilise **Gemini** : renseigner `GEMINI_API_KEY`.  
- Pour utiliser **Claude** : `AI_PROVIDER=anthropic` et `ANTHROPIC_API_KEY`.

Puis :

```bash
npm install
npm run dev
```

- **API** : [http://localhost:3001](http://localhost:3001) — santé : `GET /api/health`  
- **Interface** : [http://localhost:5173](http://localhost:5173)

Les scripts racine (`npm run build`, `npm start`, migrations PostgreSQL si vous les utilisez) s’appuient sur les workspaces `client` et `server`.

---

## Structure du dépôt

| Dossier | Rôle |
|---------|------|
| `knowledge/` | Règles et références rédigées à la main (Markdown) — base injectée dans les prompts |
| `server/` | API Node, chargement de `knowledge/`, appels aux modèles |
| `client/` | Interface utilisateur (chat + outils personnage) |

Pour la cartographie détaillée, la phase courante et les conventions (langue UI, intégrité des règles), voir **[AGENTS.md](AGENTS.md)**. Plan produit : **[docs/PLAN.md](docs/PLAN.md)**. Perspectives : **[ROADMAP.md](ROADMAP.md)**.

---

## Règles et droits d’auteur

Les mécaniques officielles doivent rester alignées sur le *Livre du joueur Terres d’Arran* ; le PDF n’est pas inclus dans ce dépôt (œuvre protégée). Le dossier `knowledge/` sert de **référence privée** pour une table : attention à ce que vous publiez si le dépôt est public.

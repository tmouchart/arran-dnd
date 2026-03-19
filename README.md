# Terres d’Arran — assistant web

Assistant pour le JdR **Les Terres d’Arran** (moteur Chroniques Oubliées) : Q&A via Claude à partir de `knowledge/`, et fiche personnage locale dans le navigateur.

Voir [AGENTS.md](AGENTS.md) pour la cartographie du dépôt et [docs/PLAN.md](docs/PLAN.md) pour le plan produit.

## Prérequis

- Node.js 20+
- Clé API Anthropic (`ANTHROPIC_API_KEY`)

## Démarrage

```bash
cp server/.env.example server/.env
# Éditer server/.env — renseigner ANTHROPIC_API_KEY

npm install
npm run dev
```

- API : <http://localhost:3001> (`GET /api/health`)
- Interface : <http://localhost:5173>

## Structure

- `knowledge/` — règles curated (Markdown) injectées dans le prompt système
- `server/` — API Node (Express + SDK Anthropic)
- `client/` — Vue 3 + Vite + TypeScript

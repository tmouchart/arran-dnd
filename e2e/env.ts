/**
 * Config des tests e2e. Base et port dédiés : on ne touche jamais à la base
 * de dev ni au serveur qui tourne dans le terminal de l'utilisateur.
 */
export const E2E_PORT = Number(process.env.E2E_PORT) || 3567

export const E2E_DB_NAME = 'arrandnd_e2e'

/** Même utilisateur Postgres que le dev, autre base. */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgres://arran:arran_dev@localhost:5432/${E2E_DB_NAME}`

export const BASE_URL = `http://localhost:${E2E_PORT}`

/** Mot de passe commun à tous les comptes du bac à sable (voir server/src/dev/seed.ts). */
export const SEED_PASSWORD = 'dev'

/**
 * Load `server/.env` explicitly so the API and scripts use the same DB as `npm run db:migrate`,
 * regardless of the process cwd (monorepo root vs `server/`).
 * `override: true` ensures this file wins over a DATABASE_URL already set in the shell.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(here, '../.env'), override: true })

/**
 * Load `server/.env` explicitly so the API and scripts use the same DB as `npm run db:migrate`,
 * regardless of the process cwd (monorepo root vs `server/`).
 * `override: false` keeps platform-injected DATABASE_URL (Railway, etc.); local missing vars are still filled from the file.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// Never override existing process.env (Railway/Heroku DATABASE_URL, etc.). Local dev still gets vars from server/.env when unset in the shell.
config({ path: resolve(here, '../.env'), override: false })

/**
 * Idempotent: adds `character.mystic_talent` if missing.
 * Use when Drizzle recorded migration 0003 but the ALTER did not apply (e.g. DB restored from backup, wrong DB migrated first).
 * Run: npm run db:repair -w server
 */
import '../loadEnv.js'
import { getDatabaseUrl } from '../db/databaseUrl.js'
import { ensureMysticTalentColumn } from '../db/ensureMysticTalentColumn.js'

const url = getDatabaseUrl()
if (!url) {
  console.error('DATABASE_URL or POSTGRES_URL is missing (check server/.env or platform env).')
  process.exit(1)
}

await ensureMysticTalentColumn(url)
console.log('OK: column "character.mystic_talent" is present (added if it was missing).')

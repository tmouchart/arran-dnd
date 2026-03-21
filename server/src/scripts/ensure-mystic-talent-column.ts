/**
 * Idempotent: adds `character.mystic_talent` if missing.
 * Use when Drizzle recorded migration 0003 but the ALTER did not apply (e.g. DB restored from backup, wrong DB migrated first).
 * Run: npm run db:repair -w server
 */
import '../loadEnv.js'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is missing (check server/.env).')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })
try {
  await sql.unsafe(
    'ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "mystic_talent" text',
  )
  console.log('OK: column "character.mystic_talent" is present (added if it was missing).')
} finally {
  await sql.end()
}

/**
 * Verifies that `mystic_talent` exists on `character` for the DB in server/.env.
 * Run: npm run db:check -w server
 */
import '../loadEnv.js'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is missing (check server/.env).')
  process.exit(1)
}

try {
  const masked = url.replace(/:[^:@/]+@/, ':****@')
  console.log('Using:', masked)

  const sql = postgres(url, { max: 1 })
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'character'
      AND column_name = 'mystic_talent'
  `
  await sql.end()

  if (rows.length > 0) {
    console.log('OK: column "character.mystic_talent" exists.')
    process.exit(0)
  }
  console.error(
    'MISSING: column "mystic_talent" not found. Run: npm run db:migrate -w server',
  )
  process.exit(1)
} catch (e) {
  console.error(e)
  process.exit(1)
}

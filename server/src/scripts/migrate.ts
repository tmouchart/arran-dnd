import '../loadEnv.js'
import { getDatabaseUrl } from '../db/databaseUrl.js'
import { runMigrations } from '../db/runMigrations.js'

const url = getDatabaseUrl()
if (!url) {
  console.error('DATABASE_URL or POSTGRES_URL is required (check server/.env or platform env).')
  process.exit(1)
}
await runMigrations(url)
process.exit(0)

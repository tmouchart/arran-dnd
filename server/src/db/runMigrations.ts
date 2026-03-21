import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, 'migrations')

/**
 * Applies pending SQL migrations (same journal as `npm run db:migrate` / migrate.ts).
 * Uses a short-lived connection so it does not share the long-lived pool in `db/index.ts`.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)
  try {
    console.log('[migrate] Running migrations…')
    await migrate(db, { migrationsFolder })
    console.log('[migrate] Done.')
  } finally {
    await client.end()
  }
}

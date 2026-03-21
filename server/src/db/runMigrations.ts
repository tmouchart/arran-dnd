import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { ensureMysticTalentColumn } from './ensureMysticTalentColumn.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, 'migrations')

/**
 * Applies pending SQL migrations (same journal as `npm run db:migrate` / migrate.ts).
 * Then ensures `mystic_talent` exists (repairs journal/DB drift).
 * Uses a short-lived connection so it does not share the long-lived pool in `db/index.ts`.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  if (!existsSync(migrationsFolder)) {
    throw new Error(
      `[migrate] Migrations folder missing: ${migrationsFolder} (run server build with copy-migrations)`,
    )
  }
  console.log(`[migrate] Folder: ${migrationsFolder}`)

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)
  try {
    console.log('[migrate] Running Drizzle migrations…')
    await migrate(db, { migrationsFolder })
    console.log('[migrate] Drizzle migrations applied.')
  } finally {
    await client.end()
  }

  console.log('[migrate] Ensuring mystic_talent column…')
  await ensureMysticTalentColumn(databaseUrl)
  console.log('[migrate] Done.')
}

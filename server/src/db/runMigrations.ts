import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, 'migrations')

/**
 * Applies pending SQL migrations from `migrations/*.sql` (lexicographic order).
 * Tracks applied files in `public.__applied_migrations`.
 * Uses a short-lived connection so it does not share the long-lived pool in `db/index.ts`.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  if (!existsSync(migrationsFolder)) {
    throw new Error(
      `[migrate] Migrations folder missing: ${migrationsFolder} (run server build with copy-migrations)`,
    )
  }
  console.log(`[migrate] Folder: ${migrationsFolder}`)

  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    await client`
      CREATE TABLE IF NOT EXISTS public.__applied_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `

    const files = readdirSync(migrationsFolder)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const appliedRows = await client<{ name: string }[]>`
      SELECT name FROM public.__applied_migrations
    `
    const applied = new Set(appliedRows.map((r) => r.name))

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] Skip (already applied): ${file}`)
        continue
      }
      console.log(`[migrate] Applying ${file}…`)
      const sqlText = readFileSync(join(migrationsFolder, file), 'utf8')
      try {
        await client`BEGIN`
        await client.unsafe(sqlText)
        await client`
          INSERT INTO public.__applied_migrations (name) VALUES (${file})
        `
        await client`COMMIT`
      } catch (err) {
        await client`ROLLBACK`
        throw err
      }
      console.log(`[migrate] Applied ${file}`)
    }

    console.log('[migrate] Migrations finished.')
  } finally {
    await client.end()
  }
}

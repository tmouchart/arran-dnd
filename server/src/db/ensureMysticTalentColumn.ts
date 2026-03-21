import postgres from 'postgres'

/**
 * Idempotent repair: ensures `character.mystic_talent` exists even if the Drizzle
 * journal says migration 0003 ran but the column is missing (restore drift, failed ALTER, etc.).
 */
export async function ensureMysticTalentColumn(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 })
  try {
    await sql.unsafe(
      'ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "mystic_talent" text',
    )
  } finally {
    await sql.end()
  }
}

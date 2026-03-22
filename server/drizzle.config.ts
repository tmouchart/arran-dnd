import { config } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

// Always load `server/.env` so `npm run db:migrate` from repo root hits the same DB as the API.
const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '.env'), override: false })

export default defineConfig({
  schema: './src/db/schema.ts',
  // Diff output only; copy SQL into `src/db/migrations` via `npm run create-migration -- <name>`.
  out: './src/db/drizzle-kit',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})

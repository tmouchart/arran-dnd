import { config } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

// Always load `server/.env` so `npm run db:migrate` from repo root hits the same DB as the API.
const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '.env'), override: true })

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})

import '../loadEnv.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, '../db/migrations')

const client = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(client)

console.log('[migrate] Running migrations…')
await migrate(db, { migrationsFolder })
console.log('[migrate] Done.')

await client.end()
process.exit(0)

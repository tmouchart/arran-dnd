import '../loadEnv.js'
import { runMigrations } from '../db/runMigrations.js'

await runMigrations(process.env.DATABASE_URL!)
process.exit(0)

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getDatabaseUrl } from './databaseUrl.js'
import * as schema from './schema.js'

const client = postgres(getDatabaseUrl()!, {
  max: 10,
  connect_timeout: 10, // échouer vite plutôt que pendre 15s+ quand la DB rame
  idle_timeout: 20,
})
export const db = drizzle(client, { schema })

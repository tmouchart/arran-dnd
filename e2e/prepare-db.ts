import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_DB_NAME } from './env'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Crée la base e2e si elle n'existe pas. Postgres n'a pas de CREATE DATABASE IF NOT EXISTS. */
async function ensureDatabase() {
  const adminUrl = E2E_DATABASE_URL.replace(new RegExp(`/${E2E_DB_NAME}$`), '/postgres')
  const sql = postgres(adminUrl, { max: 1 })
  try {
    await sql.unsafe(`CREATE DATABASE "${E2E_DB_NAME}"`)
    console.log(`[e2e] base ${E2E_DB_NAME} créée`)
  } catch (err) {
    // 42P01 n'existe pas ici ; 42P04 = la base existe déjà, c'est le cas normal.
    if ((err as { code?: string }).code !== '42P04') throw err
  } finally {
    await sql.end()
  }
}

function run(script: string, env: Record<string, string>) {
  const res = spawnSync('npm', ['run', script, '-w', 'server'], {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, ...env },
  })
  if (res.status !== 0) throw new Error(`[e2e] "npm run ${script}" a échoué`)
}

// Lancé par `npm run e2e`, AVANT Playwright : le serveur sous test démarre
// dès le lancement de Playwright, il lui faut déjà une base migrée.
await ensureDatabase()
run('db:migrate', {})
// Le seed du bac à sable exige DEV_TOOLS=1 — uniquement pour ce process,
// jamais pour le serveur sous test.
run('seed-dev', { DEV_TOOLS: '1', NODE_ENV: 'development' })

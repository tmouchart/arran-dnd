// Lit ~/prod.env (DATABASE_URL Fly), passe par le tunnel local 5433,
// exécute des requêtes en LECTURE SEULE et n'affiche jamais l'URL.
const fs = require('fs')
const os = require('os')
const path = require('path')
const postgres = require(path.join(process.cwd(), 'node_modules/postgres'))

const raw = fs.readFileSync(path.join(os.homedir(), 'prod.env'), 'utf8').trim()
const m = raw.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@[^/]+\/([^?\s]+)/)
if (!m) { console.error('URL non reconnue (longueur ' + raw.length + ')'); process.exit(1) }
const [, user, pass, db] = m

const sql = postgres({ host: 'localhost', port: 5433, user, password: pass, database: db, ssl: false, max: 1,
  connection: { default_transaction_read_only: 'on' } })

const queries = process.argv.slice(2)
;(async () => {
  try {
    for (const q of queries) {
      console.log('--- ' + q)
      const rows = await sql.unsafe(q)
      console.table(rows)
    }
  } catch (e) {
    console.error('ERREUR:', e.message)
  } finally {
    await sql.end()
  }
})()

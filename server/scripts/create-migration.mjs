import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')
const migrationsDir = path.join(serverRoot, 'src/db/migrations')

const rawName = process.argv.slice(2).join('_').trim()
if (!rawName) {
  console.error('Usage: npm run create-migration -- <name>')
  process.exit(1)
}

const slug = rawName
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9_]/g, '')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '')

if (!slug) {
  console.error('Invalid migration name: use letters, digits, and underscores.')
  process.exit(1)
}

const filename = `${Date.now()}_${slug}.sql`
const filepath = path.join(migrationsDir, filename)

if (fs.existsSync(filepath)) {
  console.error(`File already exists: ${filepath}`)
  process.exit(1)
}

const body = `-- Migration: ${slug}\n\n`

fs.mkdirSync(migrationsDir, { recursive: true })
fs.writeFileSync(filepath, body, 'utf8')
console.log(`Created ${path.relative(serverRoot, filepath)}`)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')
const src = path.join(serverRoot, 'src/db/migrations')
const dest = path.join(serverRoot, 'dist/db/migrations')

fs.cpSync(src, dest, { recursive: true })

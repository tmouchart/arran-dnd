// Lance `npm run dev` et écrit tout (stdout + stderr) dans dev.log,
// tout en gardant l'affichage normal dans le terminal.
// Le fichier est remis à zéro à chaque démarrage.
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logFile = createWriteStream(join(root, 'dev.log'), { flags: 'w' })

// Codes couleur ANSI — lisibles dans le terminal, illisibles dans un fichier.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')

// Une seule chaîne : avec shell:true sur Windows, un tableau d'args perd les guillemets.
const child = spawn(
  'npx concurrently -n api,web "npm run dev -w server" "npm run dev -w client"',
  { cwd: root, shell: true }
)

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    process.stdout.write(chunk)
    logFile.write(chunk.toString().replace(ANSI, ''))
  })
}

child.on('exit', (code) => {
  logFile.end()
  process.exit(code ?? 0)
})

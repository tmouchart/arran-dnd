import '../loadEnv.js'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

const [username, password] = process.argv.slice(2)

if (!username || !password) {
  console.error('Usage: npm run create-user -- <username> <password>')
  process.exit(1)
}

const passwordHash = await bcrypt.hash(password, 12)

try {
  const [user] = await db.insert(users).values({ username, passwordHash }).returning({ id: users.id })
  console.log(`✓ Utilisateur créé : ${username} (id=${user.id})`)
} catch (err: unknown) {
  if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
    console.error(`✗ Le nom d'utilisateur "${username}" existe déjà.`)
    process.exit(1)
  }
  throw err
}

process.exit(0)

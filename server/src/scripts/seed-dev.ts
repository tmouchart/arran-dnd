import '../loadEnv.js'
import { devToolsEnabled } from '../dev/enabled.js'
import { seedDev, SEED_CAMPAIGN_NAME, SEED_GM, SEED_PASSWORD, SEED_PLAYERS } from '../dev/seed.js'

if (!devToolsEnabled()) {
  console.error('✗ Outils de dev désactivés. Mets DEV_TOOLS=1 dans server/.env (et pas en prod).')
  process.exit(1)
}

const { campaignId } = await seedDev()

console.log(`\n✓ Campagne « ${SEED_CAMPAIGN_NAME} » recréée (id=${campaignId})`)
console.log(`  MJ      : ${SEED_GM}`)
console.log(`  Joueurs : ${SEED_PLAYERS.map((p) => p.username).join(', ')}`)
console.log(`  Mot de passe pour tous : ${SEED_PASSWORD}\n`)

process.exit(0)

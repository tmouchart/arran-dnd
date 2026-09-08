import { asc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { campaignMembers, users } from '../db/schema.js'
import { resolveDiceStyle, type DiceStyle } from './diceStyle.js'

/**
 * Le style de dé effectif d'un utilisateur dans une campagne : celui qu'il a
 * choisi, sinon celui de son rang d'entrée. Le MJ qui n'est pas membre passe
 * après tous les membres, pour ne pas partager la couleur du premier.
 */
export async function effectiveDiceStyle(userId: number, campaignId: number | null): Promise<DiceStyle> {
  const [user] = await db
    .select({ diceStyle: users.diceStyle, diceColor: users.diceColor })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  let index = 0
  if (campaignId != null) {
    const members = await db
      .select({ userId: campaignMembers.userId })
      .from(campaignMembers)
      .where(eq(campaignMembers.campaignId, campaignId))
      .orderBy(asc(campaignMembers.joinedAt), asc(campaignMembers.id))
    const found = members.findIndex((m) => m.userId === userId)
    index = found === -1 ? members.length : found
  }

  // Repli sur l'ancienne colonne : un compte dont le style n'a pas été converti
  // (créé entre la migration et le déploiement) garde sa couleur.
  const stored = user?.diceStyle ?? (user?.diceColor ? { bg: { type: 'solid', from: user.diceColor } } : null)
  return resolveDiceStyle(stored, index)
}

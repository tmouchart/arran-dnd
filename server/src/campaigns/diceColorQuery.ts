import { asc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { campaignMembers, users } from '../db/schema.js'
import { resolveDiceColor } from './diceColors.js'

/**
 * La couleur de dé effective d'un utilisateur dans une campagne : celle qu'il
 * a choisie, sinon celle de son rang d'entrée. Le MJ qui n'est pas membre
 * passe après tous les membres, pour ne pas partager la couleur du premier.
 */
export async function effectiveDiceColor(userId: number, campaignId: number | null): Promise<string> {
  const [user] = await db
    .select({ diceColor: users.diceColor })
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

  return resolveDiceColor(user?.diceColor, index)
}

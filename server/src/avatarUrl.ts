import { sql } from 'drizzle-orm'
import { users } from './db/schema.js'

/**
 * À sélectionner à la place de `users.avatarUrl` quand on ne fait qu'appeler
 * `toAvatarLink` : évite de lire des centaines de kB depuis la base pour ne
 * regarder que le préfixe (`data:` fait justement 5 caractères).
 */
export const avatarKind = sql<string | null>`left(${users.avatarUrl}, 5)`

/**
 * `users.avatar_url` stocke l'image entière en data URL (plusieurs centaines de
 * kB). L'inliner dans du JSON alourdit chaque réponse ; on renvoie plutôt un
 * lien vers `/api/users/:id/avatar`, que le navigateur cache et revalide seul.
 * Une URL classique (http…) est laissée telle quelle : elle est déjà légère.
 */
export function toAvatarLink(userId: number, avatarUrl: string | null): string | null {
  if (!avatarUrl) return null
  return avatarUrl.startsWith('data:') ? `/api/users/${userId}/avatar` : avatarUrl
}

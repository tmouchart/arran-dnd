import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.auth')

/** Comptes du bac à sable (server/src/dev/seed.ts). */
export const ROLES = ['mj-dev', 'bracco', 'nym'] as const
export type Role = (typeof ROLES)[number]

/** Fichier de cookies d'un rôle, produit par auth.setup.ts. */
export function stateFor(role: Role) {
  return join(AUTH_DIR, `${role}.json`)
}

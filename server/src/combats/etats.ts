/**
 * Les ids des états préjudiciables — la seule chose dont le serveur a besoin.
 *
 * Les libellés, les icônes et le texte de règle vivent dans
 * `client/src/data/etats.ts` : ici on ne fait que valider ce qu'on nous envoie.
 * Les deux listes doivent rester dans le même ordre.
 */
export const ETAT_IDS = [
  'aveugle', 'affaibli', 'etourdi', 'immobilise', 'paralyse', 'ralenti',
  'renverse', 'surpris', 'desarme', 'bloque', 'repousse', 'diversion', 'menace',
] as const

export type EtatId = (typeof ETAT_IDS)[number]

export function isEtatId(value: unknown): value is EtatId {
  return typeof value === 'string' && (ETAT_IDS as readonly string[]).includes(value)
}

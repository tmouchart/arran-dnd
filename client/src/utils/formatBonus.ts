/** Formate un bonus signé : 3 → "+3", -1 → "-1", 0 → "+0". */
export function signedNum(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

/** Comme `signedNum`, mais un bonus absent s'affiche en tiret. */
export function bonusDisplay(bonus: number | null): string {
  if (bonus === null) return '—'
  return signedNum(bonus)
}

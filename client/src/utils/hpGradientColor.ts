/**
 * Return an inline RGB color string based on current/max HP ratio.
 * red #c95f56 → orange #e67e22 → green #3a8a4a
 */
export function hpGradientColor(current: number, max: number): string {
  if (max <= 0) return '#c95f56'
  const ratio = Math.max(0, Math.min(1, current / max))
  if (ratio > 0.5) {
    const t = (ratio - 0.5) * 2
    const r = Math.round(0xe6 + t * (0x3a - 0xe6))
    const g = Math.round(0x7e + t * (0x8a - 0x7e))
    const b = Math.round(0x22 + t * (0x4a - 0x22))
    return `rgb(${r},${g},${b})`
  } else {
    const t = ratio * 2
    const r = Math.round(0xc9 + t * (0xe6 - 0xc9))
    const g = Math.round(0x5f + t * (0x7e - 0x5f))
    const b = Math.round(0x56 + t * (0x22 - 0x56))
    return `rgb(${r},${g},${b})`
  }
}

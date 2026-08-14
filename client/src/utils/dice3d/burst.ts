/**
 * Les effets qui accompagnent un 20 ou un 1.
 *
 * Tout est en nombres nus, sans three.js : c'est de la trajectoire, ça se teste
 * sans moteur de rendu. L'overlay ne fait que recopier ces positions.
 *
 * Un critique projette une gerbe d'étincelles vers le haut. Un échec fait
 * l'inverse — une onde qui s'écarte au sol — parce que des étincelles rouges se
 * liraient comme une variante du critique, pas comme son contraire.
 */

/** Une étincelle de la gerbe d'un critique. */
export interface Spark {
  vx: number
  vy: number
  vz: number
}

/** Ce qui retient les étincelles vers le bas. */
const GRAVITY = 3.2

export function createSparks(count: number, random: () => number = Math.random): Spark[] {
  return Array.from({ length: count }, () => {
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    const speed = 0.9 + random() * 1.4
    return {
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      // Biais vers le haut : une gerbe monte avant de retomber
      vy: Math.abs(Math.cos(phi)) * speed * 1.1 + 0.4,
      vz: Math.sin(phi) * Math.sin(theta) * speed * 0.6,
    }
  })
}

/** Position d'une étincelle à l'instant `t` (0 → 1), relative au dé. */
export function sampleSpark(spark: Spark, t: number): { x: number; y: number; z: number } {
  const clamped = Math.min(1, Math.max(0, t))
  return {
    x: spark.vx * clamped,
    y: spark.vy * clamped - 0.5 * GRAVITY * clamped * clamped,
    z: spark.vz * clamped,
  }
}

/** Opacité de la gerbe : franche au départ, éteinte à l'arrivée. */
export function burstOpacity(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return Math.max(0, 1 - clamped * clamped)
}

/** L'onde d'un échec : un anneau qui s'écarte du dé et s'efface. */
export function shockwave(t: number): { scale: number; opacity: number } {
  const clamped = Math.min(1, Math.max(0, t))
  const eased = 1 - (1 - clamped) ** 3
  return {
    scale: 0.4 + eased * 2.2,
    opacity: Math.max(0, 0.9 * (1 - clamped)),
  }
}

/**
 * Éclat de la face au moment de l'impact : montée brutale, retour lent.
 * Sert d'intensité d'émission sur le matériau du dé.
 */
export function flashIntensity(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  const peak = 0.14
  if (clamped < peak) return clamped / peak
  return Math.max(0, 1 - (clamped - peak) / (1 - peak))
}

import * as THREE from 'three'

/**
 * La trajectoire d'un lancer.
 *
 * Le résultat est déjà connu quand on arrive ici : l'animation ne décide de
 * rien, elle amène le dé sur `target`. Tout ce qui est tiré au sort ci-dessous
 * est purement cosmétique — c'est ce qui fait que deux 5 d'affilée ne donnent
 * jamais la même animation.
 */
export interface RollMotion {
  /** Durée en millisecondes. */
  duration: number
  from: THREE.Vector3
  to: THREE.Vector3
  spinAxis: THREE.Vector3
  /** Angle total parcouru, en radians. Décroît jusqu'à 0 à l'arrivée. */
  spinAngle: number
  /** Orientation finale : la face du résultat vers la caméra. */
  target: THREE.Quaternion
  /** Hauteur de la cloche décrite par le dé en arrivant. */
  arc: number
}

export interface MotionSample {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: number
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
/** Décroissance plus brutale : le dé freine sec en se posant. */
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4

/** L'orientation qui présente une face à la caméra (l'axe +Z). */
export function faceTargetQuaternion(normal: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    normal.clone().normalize(),
    new THREE.Vector3(0, 0, 1),
  )
}

/**
 * État du dé à l'instant `t` (0 → 1).
 *
 * La rotation est écrite `spin(t) × target` avec un spin qui tombe à zéro :
 * à t = 1 le spin vaut l'identité, donc on atterrit **exactement** sur la face
 * voulue, sans jamais avoir à corriger.
 */
export function sampleMotion(motion: RollMotion, t: number): MotionSample {
  const clamped = Math.min(1, Math.max(0, t))

  const travel = easeOutCubic(clamped)
  const position = motion.from.clone().lerp(motion.to, travel)
  position.y += motion.arc * Math.sin(Math.PI * clamped) * (1 - clamped)

  const spin = new THREE.Quaternion().setFromAxisAngle(
    motion.spinAxis,
    motion.spinAngle * (1 - easeOutQuart(clamped)),
  )
  const quaternion = spin.multiply(motion.target)

  return { position, quaternion, scale: landingScale(clamped) }
}

/** Petit rebond d'impact sur la toute fin de la course. */
function landingScale(t: number): number {
  const start = 0.82
  if (t < start) return 1
  return 1 + 0.1 * Math.sin(((t - start) / (1 - start)) * Math.PI)
}

export interface MotionOptions {
  /** Demi-largeur et demi-hauteur visibles à la profondeur du dé. */
  halfWidth: number
  halfHeight: number
  /** Position finale du dé (plusieurs dés s'alignent). */
  landing: THREE.Vector3
  target: THREE.Quaternion
  /** Injectable pour rendre les tests déterministes. */
  random?: () => number
}

/** Tire un lancer : bord de départ, axe, nombre de tours, durée. */
export function createMotion({
  halfWidth,
  halfHeight,
  landing,
  target,
  random = Math.random,
}: MotionOptions): RollMotion {
  const edge = Math.floor(random() * 4)
  const margin = 1.8
  const from = new THREE.Vector3()

  // Le dé entre par un bord au hasard, à une hauteur/abscisse au hasard
  if (edge === 0) from.set(-halfWidth - margin, (random() * 2 - 1) * halfHeight, 0)
  else if (edge === 1) from.set(halfWidth + margin, (random() * 2 - 1) * halfHeight, 0)
  else if (edge === 2) from.set((random() * 2 - 1) * halfWidth, halfHeight + margin, 0)
  else from.set((random() * 2 - 1) * halfWidth, -halfHeight - margin, 0)

  const spinAxis = new THREE.Vector3(
    random() * 2 - 1,
    random() * 2 - 1,
    random() * 2 - 1,
  ).normalize()

  return {
    duration: 780 + random() * 260,
    from,
    to: landing.clone(),
    spinAxis,
    // Entre 2 et 4 tours, plus un reste : le reste garantit que l'orientation
    // de départ n'est pas déjà celle d'arrivée.
    spinAngle: Math.PI * 2 * (2 + random() * 2) + random() * Math.PI,
    target,
    arc: (random() * 0.6 + 0.4) * (edge >= 2 ? 0.6 : 1.4),
  }
}

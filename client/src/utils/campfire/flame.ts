/**
 * Le feu de camp du repos partagé.
 *
 * Comme pour les dés, tout est en nombres nus, sans three.js : une flamme est
 * une trajectoire et une couleur, ça se teste sans moteur de rendu. L'overlay
 * ne fait que recopier ces valeurs dans un buffer.
 *
 * Une flamme n'est pas une explosion : chaque particule vit en boucle. Elle
 * naît dans les braises, monte en se resserrant, s'éteint, et repart. Le feu
 * peut donc brûler aussi longtemps qu'on veut sans jamais se rejouer.
 */

/** Une langue de feu. Les vitesses sont en unités de scène par seconde. */
export interface FlameParticle {
  /** Décalage de départ dans le cycle (0 → 1) : sinon tout le feu clignote ensemble. */
  phase: number
  /** Durée d'une montée complète, en secondes. */
  life: number
  /** Position de naissance dans le lit de braises. */
  x: number
  z: number
  /** Vitesse de montée. */
  vy: number
  /** Amplitude et vitesse du serpentement latéral. */
  sway: number
  swaySpeed: number
  /** Taille de départ. */
  size: number
}

/** Ce que l'overlay a besoin de savoir pour poser une particule. */
export interface FlameSample {
  x: number
  y: number
  z: number
  size: number
  /** 0 = cœur du feu (jaune), 1 = pointe froide (rouge sombre). */
  heat: number
  opacity: number
}

/** Rayon du lit de braises. Les particules naissent dedans. */
const BED_RADIUS = 0.42

export function createFlame(count: number, random: () => number = Math.random): FlameParticle[] {
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2
    // sqrt : sans ça les particules s'entassent au centre du disque
    const radius = Math.sqrt(random()) * BED_RADIUS
    return {
      phase: random(),
      life: 0.85 + random() * 0.75,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      vy: 1.15 + random() * 0.85,
      sway: 0.12 + random() * 0.22,
      swaySpeed: 1.6 + random() * 2.4,
      size: 0.34 + random() * 0.3,
    }
  })
}

/**
 * État d'une particule à l'instant `time` (secondes depuis le début du feu).
 *
 * `age` boucle sur `life`, d'où un feu qui brûle en continu. La particule
 * rétrécit en montant et refroidit : c'est ce qui donne la forme de flamme,
 * large et jaune en bas, fine et rouge en haut.
 */
export function sampleFlame(particle: FlameParticle, time: number): FlameSample {
  const age = ((time / particle.life + particle.phase) % 1 + 1) % 1
  const height = age * particle.vy

  // Le feu se resserre en montant, mais garde toujours un peu de largeur
  const pinch = 1 - age * 0.72
  const drift = Math.sin((time + particle.phase * 10) * particle.swaySpeed) * particle.sway * age

  return {
    x: particle.x * pinch + drift,
    y: height,
    z: particle.z * pinch,
    size: particle.size * (1 - age * 0.62),
    heat: age,
    // Apparition franche dans les braises, extinction douce vers le haut
    opacity: Math.min(1, age * 6) * (1 - age) ** 0.85,
  }
}

/** Une braise qui s'échappe du feu et monte jusqu'à sortir du cadre. */
export interface Ember {
  phase: number
  life: number
  x: number
  z: number
  vy: number
  sway: number
  swaySpeed: number
  size: number
}

export function createEmbers(count: number, random: () => number = Math.random): Ember[] {
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * BED_RADIUS * 1.4
    return {
      phase: random(),
      life: 3.2 + random() * 2.6,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      vy: 2.6 + random() * 2.2,
      sway: 0.35 + random() * 0.55,
      swaySpeed: 0.5 + random() * 0.9,
      size: 0.06 + random() * 0.08,
    }
  })
}

export function sampleEmber(ember: Ember, time: number): FlameSample {
  const age = ((time / ember.life + ember.phase) % 1 + 1) % 1
  const drift = Math.sin((time + ember.phase * 7) * ember.swaySpeed) * ember.sway * age

  return {
    x: ember.x + drift,
    y: 0.35 + age * ember.vy,
    z: ember.z + drift * 0.5,
    size: ember.size,
    heat: 1,
    // Les braises meurent avant de sortir du cadre : pas de disparition sèche
    opacity: Math.min(1, age * 5) * (1 - age) ** 1.4,
  }
}

/**
 * Respiration de la lumière du feu.
 *
 * Trois sinusoïdes incommensurables : ça ne se répète jamais à l'œil, et c'est
 * ce battement irrégulier qui fait qu'un feu paraît vivant plutôt que pulsé.
 * Rendu entre 0,72 et 1,28 environ, à multiplier par l'intensité de base.
 */
export function firePulse(time: number): number {
  return (
    1 +
    Math.sin(time * 3.1) * 0.14 +
    Math.sin(time * 7.3 + 1.7) * 0.08 +
    Math.sin(time * 13.7 + 0.4) * 0.05
  )
}

/**
 * Montée et extinction du feu sur toute la scène (0 → 1 → 0).
 *
 * `t` va de 0 à 1 sur la durée totale. Le feu prend vite, tient, puis s'éteint
 * un peu plus lentement qu'il ne s'est allumé.
 */
export function fireEnvelope(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  const ignite = 0.16
  const fade = 0.82
  if (clamped < ignite) return clamped / ignite
  if (clamped > fade) return Math.max(0, 1 - (clamped - fade) / (1 - fade))
  return 1
}

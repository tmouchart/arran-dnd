import type { DiceStyle } from './diceStyle'

/**
 * Les styles de dé prêts à l'emploi. Le serveur ne les connaît pas : il stocke
 * le style résolu, pas le nom du preset.
 *
 * L'angle suit la convention CSS : 160° descend et penche légèrement, ce qui
 * pose la teinte claire en haut de chaque face.
 */
export interface DicePreset {
  slug: string
  label: string
  style: DiceStyle
}

export const DICE_PRESETS: DicePreset[] = [
  { slug: 'rubis', label: 'Rubis', style: { bg: { type: 'solid', from: '#d64545' }, ink: null, font: null } },
  { slug: 'braise', label: 'Braise', style: { bg: { type: 'gradient', from: '#f0a13a', to: '#b02a1f', angle: 160 }, ink: '#2a1206', font: null } },
  { slug: 'amethyste', label: 'Améthyste', style: { bg: { type: 'gradient', from: '#a06fe8', to: '#4a1f8a', angle: 150 }, ink: null, font: null } },
  { slug: 'ocean', label: 'Océan', style: { bg: { type: 'gradient', from: '#4fc3d9', to: '#123a7a', angle: 170 }, ink: null, font: null } },
  { slug: 'poison', label: 'Poison', style: { bg: { type: 'gradient', from: '#9be86f', to: '#1c5c2a', angle: 155 }, ink: '#0d2410', font: null } },
  { slug: 'or-ancien', label: 'Or ancien', style: { bg: { type: 'gradient', from: '#f3d489', to: '#9a6b1c', angle: 160 }, ink: '#241a0d', font: null } },
  { slug: 'onyx', label: 'Onyx', style: { bg: { type: 'gradient', from: '#4a4f57', to: '#14171b', angle: 165 }, ink: '#e8e2d4', font: null } },
  { slug: 'parchemin', label: 'Parchemin', style: { bg: { type: 'solid', from: '#fdf3e6' }, ink: '#241a0d', font: null } },
]

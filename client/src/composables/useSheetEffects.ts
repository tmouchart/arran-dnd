import { computed, ref, type Ref } from 'vue'
import type { Character } from '../types/character'

export function useSheetEffects(
  character: Ref<Character>,
  computedHp: Ref<number>,
  computedMp: Ref<number>,
  loading: Ref<boolean>,
) {
  const rollEffect = ref<'nat20' | 'nat1' | null>(null)
  let rollTimer: ReturnType<typeof setTimeout> | null = null

  const hpRatio = computed(() => {
    if (loading.value) return 1
    const max = computedHp.value
    return max > 0 ? character.value.hpCurrent / max : 1
  })

  const mpRatio = computed(() => {
    if (loading.value) return 1
    const max = computedMp.value
    return max > 0 ? character.value.mpCurrent / max : 1
  })

  const sheetClasses = computed(() => ({
    'gv-hp-warn': hpRatio.value > 0 && hpRatio.value < 0.5,
    'gv-hp-critical': hpRatio.value > 0 && hpRatio.value <= 0.25,
    'gv-hp-dead': hpRatio.value === 0 && !loading.value,
    'gv-mp-low': mpRatio.value > 0 && mpRatio.value < 0.25,
    'gv-mp-drained': mpRatio.value === 0 && !loading.value,
    'gv-roll-nat20': rollEffect.value === 'nat20',
    'gv-roll-nat1': rollEffect.value === 'nat1',
  }))

  function triggerRoll(type: 'nat20' | 'nat1') {
    if (rollTimer) clearTimeout(rollTimer)
    rollEffect.value = type
    rollTimer = setTimeout(() => {
      rollEffect.value = null
      rollTimer = null
    }, type === 'nat20' ? 1400 : 600)
  }

  return { sheetClasses, hpRatio, mpRatio, triggerRoll }
}

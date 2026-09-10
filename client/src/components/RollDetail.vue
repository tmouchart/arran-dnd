<script lang="ts">
/**
 * Les classes de couleur d'une carte de résultat, écrites une seule fois.
 *
 * Le critique et l'échec critique se lisent sur le **dé gardé** : un 1 écarté
 * par un avantage ne doit pas peindre la carte en rouge.
 *
 * `graded` à false pour les jets qui ne critiquent jamais (le d12 de la main
 * faible), qui gardent tout de même leur échec critique.
 */
export function rollResultClass(
  roll: { attackDie: number; attackSides: number },
  graded = true,
): Record<string, boolean> {
  return {
    'roll-result--fumble': roll.attackDie === 1,
    'roll-result--critical': graded && roll.attackDie === roll.attackSides,
  }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { rollDetailParts } from '../utils/rollDetail'
import { signedNum } from '../utils/formatBonus'

/**
 * Le détail chiffré d'un jet : `(d20 = 17 4 +3)`, le 4 barré parce qu'il a été
 * lancé puis écarté (avantage, relance d'un point de chance).
 */
const props = defineProps<{
  sides: number
  die: number
  bonus: number
  /** Les dés lancés puis jetés. Absent = un seul dé, affichage d'avant. */
  dropped?: number[] | null
}>()

const parts = computed(() =>
  rollDetailParts({ die: props.die, sides: props.sides, bonus: props.bonus, dropped: props.dropped }),
)

// Les espaces sont dans les chaînes : Vue mange les blancs entre deux balises.
const head = computed(() => `(${parts.value.label} = ${parts.value.kept.join('+')}`)
const tail = computed(() => ` ${signedNum(parts.value.bonus)})`)
</script>

<template>
  <span class="roll-result__detail" data-testid="roll-detail"
    >{{ head
    }}<span
      v-for="(d, i) in parts.dropped"
      :key="i"
      class="roll-detail__dropped"
      data-testid="roll-dropped"
      >{{ ' ' + d }}</span
    >{{ tail }}</span
  >
</template>

<style scoped>
.roll-result__detail {
  font-size: 0.75rem;
  color: var(--muted);
  font-family: var(--mono-font, monospace);
}

/* Le dé écarté reste lisible mais barré : on voit ce qu'on a évité. */
.roll-detail__dropped {
  color: var(--muted);
  text-decoration: line-through;
}
</style>

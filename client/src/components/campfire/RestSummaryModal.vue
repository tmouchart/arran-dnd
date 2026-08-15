<script setup lang="ts">
import { computed } from 'vue'
import { Heart, Sparkles, HeartPulse, Moon, Sunrise } from 'lucide-vue-next'
import AppModal from '../ui/AppModal.vue'
import AppButton from '../ui/AppButton.vue'
import { restSummary, closeRestSummary } from '../../composables/useRest'
import type { RestChange } from '../../api/campaigns'

/**
 * Ce qui a changé sur MA fiche pendant le repos.
 *
 * Une ressource qui n'a pas bougé ne s'affiche pas : un personnage à pleine
 * vie n'a pas besoin qu'on lui dise que ses PV n'ont pas changé.
 */

const open = computed({
  get: () => restSummary.value !== null,
  set: (value: boolean) => { if (!value) closeRestSummary() },
})

const lines = computed(() => {
  const delta = restSummary.value?.delta
  if (!delta) return []
  const rows: { key: string; label: string; icon: typeof Heart; change: RestChange }[] = []
  if (delta.hp) rows.push({ key: 'hp', label: 'Points de vie', icon: Heart, change: delta.hp })
  if (delta.mp) rows.push({ key: 'mp', label: 'Points de magie', icon: Sparkles, change: delta.mp })
  if (delta.pr) rows.push({ key: 'pr', label: 'Points de récupération', icon: HeartPulse, change: delta.pr })
  return rows
})

const title = computed(() =>
  restSummary.value?.kind === 'complet' ? 'Repos complet' : 'La nuit passe',
)

const subtitle = computed(() =>
  restSummary.value?.kind === 'complet'
    ? 'Le groupe repart à neuf.'
    : 'Six heures de sommeil, le feu se meurt.',
)
</script>

<template>
  <AppModal v-model="open" :title="title" description="Ce que le repos a changé sur ta fiche.">
    <div class="rest">
      <p class="rest-lead">
        <component :is="restSummary?.kind === 'complet' ? Sunrise : Moon" :size="16" />
        {{ subtitle }}
      </p>

      <ul v-if="lines.length" class="rest-list">
        <li v-for="line in lines" :key="line.key" class="rest-row">
          <component :is="line.icon" :size="17" class="rest-icon" />
          <span class="rest-label">{{ line.label }}</span>
          <span class="rest-change">
            <span class="rest-before">{{ line.change.before }}</span>
            <span class="rest-arrow">→</span>
            <span class="rest-after">{{ line.change.after }}</span>
          </span>
        </li>
      </ul>

      <p v-else class="rest-nothing">
        Rien à récupérer — tu étais déjà au meilleur de ta forme.
      </p>
    </div>

    <template #footer>
      <AppButton variant="primary" @click="closeRestSummary">Repartir</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.rest {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.rest-lead {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
}

.rest-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.rest-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.rest-icon {
  flex-shrink: 0;
  color: var(--accent-strong);
}

.rest-label {
  flex: 1;
  font-size: 0.9rem;
}

.rest-change {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  font-family: var(--title-font);
  font-weight: 700;
}

.rest-before {
  color: var(--muted);
}

.rest-arrow {
  color: var(--muted);
  font-size: 0.85rem;
}

.rest-after {
  font-size: 1.15rem;
  color: var(--brand-strong);
}

.rest-nothing {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>

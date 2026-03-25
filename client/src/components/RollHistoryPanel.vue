<script setup lang="ts">
import { computed, ref } from 'vue'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-vue-next'
import AppCard from './ui/AppCard.vue'
import AppIconBtn from './ui/AppIconBtn.vue'
import { useRollHistory, type RollKind } from '../composables/useRollHistory'

const props = withDefaults(defineProps<{ alwaysOpen?: boolean }>(), { alwaysOpen: false })

const { history, clearHistory } = useRollHistory()

function confirmClear() {
  if (confirm(`Effacer les ${history.value.length} jets enregistrés ?`)) {
    clearHistory()
  }
}

const open = ref(false)
const isOpen = computed(() => props.alwaysOpen || open.value)

const KIND_LABELS: Record<RollKind, string> = {
  weapon: 'Arme',
  action: 'Action',
  ability: 'Carac.',
  manoeuvre: 'Manoeuvre',
  competence: 'Compétence',
}

const critCount = computed(() => history.value.filter((e) => e.damage?.critical).length)
const fumbleCount = computed(() => history.value.filter((e) => e.damage?.fumble || e.die === 1).length)
const d20Avg = computed(() => {
  if (!history.value.length) return null
  const sum = history.value.reduce((s, e) => s + e.die, 0)
  return (sum / history.value.length).toFixed(1)
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function entryClass(entry: { die: number; damage?: { critical: boolean; fumble: boolean } }): string {
  if (entry.damage?.critical || entry.die === 20) return 'entry--critical'
  if (entry.damage?.fumble || entry.die === 1) return 'entry--fumble'
  return ''
}
</script>

<template>
  <AppCard>
    <div class="panel-head" @click="!alwaysOpen && (open = !open)">
      <h2>Historique des jets ({{ history.length }})</h2>
      <div class="panel-head-right">
        <AppIconBtn
          v-if="history.length"
          variant="ghost"
          :size="32"
          title="Effacer l'historique"
          @click.stop="confirmClear"
        >
          <Trash2 :size="15" />
        </AppIconBtn>
        <template v-if="!alwaysOpen">
          <ChevronUp v-if="open" :size="18" class="chevron" />
          <ChevronDown v-else :size="18" class="chevron" />
        </template>
      </div>
    </div>

    <template v-if="isOpen">
      <div v-if="history.length" class="stats-row">
        <span class="stat"><span class="stat-label">Moyenne d20</span> <strong>{{ d20Avg }}</strong></span>
        <span class="stat stat--crit"><span class="stat-label">Critiques</span> <strong>{{ critCount }}</strong></span>
        <span class="stat stat--fumble"><span class="stat-label">Fumbles</span> <strong>{{ fumbleCount }}</strong></span>
      </div>

      <p v-if="!history.length" class="muted">Aucun jet enregistré.</p>

      <ul v-else class="entry-list">
        <li
          v-for="entry in history"
          :key="entry.id"
          class="entry"
          :class="entryClass(entry)"
        >
          <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
          <span class="entry-kind">{{ KIND_LABELS[entry.kind] }}</span>
          <span class="entry-label">{{ entry.label }}</span>
          <span class="entry-die">d20={{ entry.die }}</span>
          <span class="entry-total">→ <strong>{{ entry.total }}</strong></span>
          <span v-if="entry.damage" class="entry-dmg">
            <template v-if="entry.damage.fumble">Échec critique</template>
            <template v-else-if="entry.damage.critical">Réussite critique · {{ entry.damage.total * 2 }} dmg</template>
            <template v-else>{{ entry.damage.total }} dmg</template>
          </span>
        </li>
      </ul>
    </template>
  </AppCard>
</template>

<style scoped>
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.panel-head h2 { margin: 0; }
.panel-head-right { display: flex; align-items: center; gap: 0.2rem; }
.chevron { opacity: 0.6; }

.stats-row {
  display: flex;
  gap: 1rem;
  margin: 0.6rem 0;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.82rem;
}
.stat-label { font-size: 0.72rem; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.04em; }
.stat--crit strong { color: #c9a227; }
.stat--fumble strong { color: var(--danger, #e05252); }

.entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  max-height: 28rem;
  overflow-y: auto;
}

.entry {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  padding: 0.22rem 0.4rem;
  border-radius: 0.5rem;
  flex-wrap: wrap;
}

.entry--critical { background: color-mix(in srgb, #c9a227 12%, transparent); }
.entry--fumble   { background: color-mix(in srgb, var(--danger, #e05252) 12%, transparent); }

.entry-time   { color: var(--muted); font-size: 0.72rem; flex-shrink: 0; }
.entry-kind   { background: var(--surface-2); padding: 0.05rem 0.35rem; border-radius: 0.4rem; font-size: 0.72rem; flex-shrink: 0; }
.entry-label  { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry-die    { color: var(--muted); font-size: 0.75rem; flex-shrink: 0; }
.entry-total  { flex-shrink: 0; }
.entry-dmg    { font-size: 0.75rem; opacity: 0.8; flex-shrink: 0; }

.muted { color: var(--muted); font-size: 0.9rem; margin: 0.6rem 0 0; }
</style>

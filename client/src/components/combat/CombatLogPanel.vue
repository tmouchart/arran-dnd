<script setup lang="ts">
import { computed } from 'vue'
import { EyeOff } from 'lucide-vue-next'
import AppEmptyState from '../ui/AppEmptyState.vue'
import type { CombatRollEvent } from '../../api/combats'

// Composant unique MJ/joueurs : il affiche la liste reçue telle quelle.
// Le MJ voit plus d'entrées uniquement parce que le serveur lui en envoie plus.
const props = defineProps<{
  rolls: CombatRollEvent[]
  /** Mobile : plus récent en haut. Desktop : flux chronologique type chat. */
  newestFirst?: boolean
}>()

const ordered = computed(() =>
  props.newestFirst ? [...props.rolls].reverse() : props.rolls,
)

const KIND_LABELS: Record<string, string> = {
  weapon: 'attaque',
  action: 'action',
  ability: 'capacité',
  manoeuvre: 'manœuvre',
  competence: 'compétence',
  libre: 'jet libre',
}

const CONTEXT_LABELS: Record<string, string> = {
  actions: 'depuis Mes actions',
  fiche: 'depuis la fiche',
  agonie: 'jet d’agonie',
  sandbox: 'depuis les dés libres',
}

function highlight(r: CombatRollEvent): 'critical' | 'fumble' | null {
  if (r.kind === 'libre') return null
  if (r.damage?.critical || r.die === r.sides) return 'critical'
  if (r.damage?.fumble || r.die === 1) return 'fumble'
  return null
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

function detail(r: CombatRollEvent): string {
  if (r.rolls && r.rolls.length > 1) {
    const base = `${r.rolls.length}d${r.sides} = ${r.rolls.join('+')}`
    return r.bonus !== 0 ? `${base} ${signed(r.bonus)}` : base
  }
  return r.bonus !== 0
    ? `d${r.sides} = ${r.die} ${signed(r.bonus)}`
    : `d${r.sides} = ${r.die}`
}

function time(r: CombatRollEvent): string {
  return new Date(r.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="log-panel">
    <AppEmptyState v-if="rolls.length === 0" variant="empty">
      Aucun jet pour l'instant — les dés parlent, l'histoire commence.
    </AppEmptyState>
    <div
      v-for="r in ordered"
      :key="r.id"
      class="log-entry"
      :class="{
        'log-entry--critical': highlight(r) === 'critical',
        'log-entry--fumble': highlight(r) === 'fumble',
      }"
    >
      <div v-if="highlight(r) === 'critical'" class="log-banner log-banner--critical">
        💥 Critique !
      </div>
      <div v-else-if="highlight(r) === 'fumble'" class="log-banner log-banner--fumble">
        💀 Échec critique
      </div>
      <div class="log-row">
        <div class="log-main">
          <div class="log-line1">
            <span class="log-dot" :class="r.visibility === 'gm' ? 'monster' : 'player'" />
            <span class="log-actor">{{ r.actorName }}</span>
            <span class="log-sep">·</span>
            <span class="log-label">{{ r.label }}</span>
            <span v-if="KIND_LABELS[r.kind]" class="log-kind">· {{ KIND_LABELS[r.kind] }}</span>
            <span v-if="CONTEXT_LABELS[r.context]" class="log-context">· {{ CONTEXT_LABELS[r.context] }}</span>
            <span v-if="r.visibility === 'gm'" class="log-gm-badge" title="Visible par le MJ uniquement">
              <EyeOff :size="12" /> MJ
            </span>
          </div>
          <div class="log-line2">
            <span class="log-detail">
              {{ detail(r) }}<template v-if="r.damage"> · dégâts {{ r.damage.total }}</template>
            </span>
            <span class="log-time">{{ time(r) }}</span>
          </div>
        </div>
        <div class="log-total">{{ r.total }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.log-entry {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.9rem;
  padding: 0.5rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.log-entry--critical {
  background: color-mix(in srgb, #d4ac0d 10%, var(--surface));
  border-color: #d4ac0d;
}
.log-entry--fumble {
  background: color-mix(in srgb, #c95f56 10%, var(--surface));
  border-color: #c95f56;
}

.log-banner {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.log-banner--critical {
  color: #c8950a;
}
.log-banner--fumble {
  color: #c95f56;
}

.log-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.log-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.log-total {
  flex-shrink: 0;
  font-size: 1.6rem;
  font-weight: 800;
  font-family: var(--title-font);
  line-height: 1;
  color: var(--accent-strong);
  min-width: 2.4rem;
  text-align: right;
}

.log-entry--critical .log-total {
  color: #c8950a;
}
.log-entry--fumble .log-total {
  color: #c95f56;
}

.log-line1 {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  flex-wrap: wrap;
}

.log-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.log-dot.player {
  background: #27ae60;
}
.log-dot.monster {
  background: #c0392b;
}

.log-actor {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text);
}

.log-sep,
.log-kind {
  font-size: 0.8rem;
  color: var(--muted);
}

.log-label {
  font-size: 0.85rem;
  color: var(--text);
}

.log-context {
  font-size: 0.75rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-gm-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
  margin-left: auto;
  flex-shrink: 0;
}

.log-line2 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.log-detail {
  font-family: var(--mono-font, monospace);
  font-size: 0.8rem;
  color: var(--text);
}

.log-time {
  font-size: 0.68rem;
  color: var(--muted);
  flex-shrink: 0;
}
</style>

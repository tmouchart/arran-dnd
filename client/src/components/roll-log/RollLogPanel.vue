<script setup lang="ts">
import { computed } from 'vue'
import { EyeOff, Swords, ScrollText, Dices, HeartCrack, Zap } from 'lucide-vue-next'
import AppEmptyState from '../ui/AppEmptyState.vue'
import type { RollEvent } from '../../api/campaigns'

// Composant unique MJ/joueurs : il affiche la liste reçue telle quelle.
// Le MJ voit plus d'entrées uniquement parce que le serveur lui en envoie plus.
const props = defineProps<{ rolls: RollEvent[] }>()

const KIND_LABELS: Record<string, string> = {
  weapon: 'attaque',
  action: 'action',
  ability: 'capacité',
  manoeuvre: 'manœuvre',
  competence: 'compétence',
  libre: 'jet libre',
}

// Le contexte était un suffixe texte qui faisait déborder la ligne : icône + title.
const CONTEXT_ICONS: Record<string, { icon: typeof Swords; label: string }> = {
  actions: { icon: Zap, label: 'depuis Mes actions' },
  fiche: { icon: ScrollText, label: 'depuis la fiche' },
  agonie: { icon: HeartCrack, label: "jet d'agonie" },
  sandbox: { icon: Dices, label: 'dés libres' },
  combat: { icon: Swords, label: 'en combat' },
}

interface Group {
  key: string
  /** Séparateur de combat affiché au-dessus du groupe, si le combat change. */
  combatBreak: boolean
  actorName: string
  actorKind: string
  visibility: string
  entries: RollEvent[]
}

/**
 * Plus récent en haut, et jets consécutifs d'un même acteur regroupés :
 * un tour de combat devient un bloc au lieu de cinq cartes qui répètent le nom.
 */
const groups = computed<Group[]>(() => {
  const out: Group[] = []
  const ordered = [...props.rolls].reverse()
  let prevCombatId: number | null | undefined
  for (const r of ordered) {
    const last = out[out.length - 1]
    const sameBlock =
      last && last.actorName === r.actorName && last.entries[0].combatId === r.combatId
    if (sameBlock) {
      last.entries.push(r)
      continue
    }
    out.push({
      key: `g${r.id}`,
      combatBreak: prevCombatId !== undefined && prevCombatId !== r.combatId,
      actorName: r.actorName,
      actorKind: r.actorKind,
      visibility: r.visibility,
      entries: [r],
    })
    prevCombatId = r.combatId
  }
  return out
})

function highlight(r: RollEvent): 'critical' | 'fumble' | null {
  if (r.kind === 'libre') return null
  if (r.damage?.critical || r.die === r.sides) return 'critical'
  if (r.damage?.fumble || r.die === 1) return 'fumble'
  return null
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

function detail(r: RollEvent): string {
  if (r.rolls && r.rolls.length > 1) {
    const base = `${r.rolls.length}d${r.sides} = ${r.rolls.join('+')}`
    return r.bonus !== 0 ? `${base} ${signed(r.bonus)}` : base
  }
  return r.bonus !== 0
    ? `d${r.sides} = ${r.die} ${signed(r.bonus)}`
    : `d${r.sides} = ${r.die}`
}

function relativeTime(r: RollEvent): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(r.createdAt).getTime()) / 1000))
  if (secs < 60) return "à l'instant"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min`
  return `${Math.round(mins / 60)} h`
}

function absoluteTime(r: RollEvent): string {
  return new Date(r.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="log-panel">
    <AppEmptyState v-if="rolls.length === 0" variant="empty">
      Aucun jet pour l'instant — les dés parlent, l'histoire commence.
    </AppEmptyState>

    <template v-for="g in groups" :key="g.key">
      <div v-if="g.combatBreak" class="log-break">
        <Swords v-if="g.entries[0].combatId" :size="12" />
        <span>{{ g.entries[0].combatId ? 'Combat' : 'Hors combat' }}</span>
      </div>

      <div class="log-group">
        <div class="log-actor-line">
          <span class="log-dot" :class="g.actorKind" />
          <span class="log-actor">{{ g.actorName }}</span>
          <span v-if="g.visibility === 'gm'" class="log-gm-badge" title="Visible par le MJ uniquement">
            <EyeOff :size="12" /> MJ
          </span>
          <span class="log-time" :title="absoluteTime(g.entries[g.entries.length - 1])">
            {{ relativeTime(g.entries[g.entries.length - 1]) }}
          </span>
        </div>

        <div
          v-for="r in g.entries"
          :key="r.id"
          class="log-entry"
          :class="{
            'log-entry--critical': highlight(r) === 'critical',
            'log-entry--fumble': highlight(r) === 'fumble',
          }"
        >
          <div class="log-body">
            <div class="log-label-line">
              <span class="log-label">{{ r.label }}</span>
              <span v-if="KIND_LABELS[r.kind]" class="log-kind">· {{ KIND_LABELS[r.kind] }}</span>
              <span
                v-if="CONTEXT_ICONS[r.context]"
                class="log-context-icon"
                :title="CONTEXT_ICONS[r.context].label"
              >
                <component :is="CONTEXT_ICONS[r.context].icon" :size="12" />
              </span>
            </div>
            <div class="log-detail">
              {{ detail(r) }}<template v-if="r.damage"> · dégâts {{ r.damage.total }}</template>
            </div>
          </div>
          <div class="log-total">{{ r.total }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* Séparateur de combat — c'est lui qui rend le flux lisible */
.log-break {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: var(--space-sm) 0 0.1rem;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.log-break::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.log-group {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 0.35rem var(--space-md) 0.4rem;
}

.log-actor-line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-gm-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0 0.35rem;
  flex-shrink: 0;
}

.log-time {
  margin-left: auto;
  font-size: 0.66rem;
  color: var(--muted);
  flex-shrink: 0;
}

/* Une ligne par jet : label à gauche, total à droite */
.log-entry {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 0.18rem 0 0.18rem 0.55rem;
  border-left: 2px solid transparent;
}

/* Crit/fumble : liseré + total coloré, sans casser le rythme de la liste */
.log-entry--critical {
  border-left-color: #d4ac0d;
}
.log-entry--fumble {
  border-left-color: #c95f56;
}

.log-body {
  flex: 1;
  min-width: 0;
}

.log-label-line {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

.log-label {
  font-size: 0.82rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-kind,
.log-context-icon {
  color: var(--muted);
  flex-shrink: 0;
}

.log-context-icon {
  display: inline-flex;
}

.log-kind {
  font-size: 0.75rem;
}

.log-detail {
  font-family: var(--mono-font, monospace);
  font-size: 0.74rem;
  color: var(--muted);
}

.log-total {
  flex-shrink: 0;
  font-family: var(--title-font);
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1;
  color: var(--accent-strong);
  min-width: 2.1rem;
  text-align: right;
}

.log-entry--critical .log-total {
  color: #c8950a;
}
.log-entry--fumble .log-total {
  color: #c95f56;
}
</style>

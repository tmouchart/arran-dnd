<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Swords, Users, DoorOpen, Plus, X, Shield } from 'lucide-vue-next'
import { useSession } from '../composables/useSession'

const route = useRoute()
const router = useRouter()
const sessionId = route.params.id as string

const {
  session,
  connecting,
  error,
  isGm,
  initiativeOrder,
  connect,
  leave,
  addMonster,
  updateMonster,
  removeMonster,
  setInitiative,
} = useSession()

onMounted(() => {
  connect(sessionId)
})

const activeTab = ref<'combat' | 'participants'>('combat')

// Initiative joueur
const myInitiative = ref<number | null>(null)
async function handleSetInitiative() {
  if (myInitiative.value == null) return
  await setInitiative(myInitiative.value)
}

// Ajout de monstre (MJ)
const monsterName = ref('')
const monsterHpMax = ref<number | null>(null)
const monsterInitiative = ref<number | null>(null)
const monsterError = ref<string | null>(null)
async function handleAddMonster() {
  monsterError.value = null
  if (!monsterName.value.trim() || !monsterHpMax.value) return
  try {
    await addMonster(
      monsterName.value.trim(),
      monsterHpMax.value,
      monsterInitiative.value ?? undefined,
    )
    monsterName.value = ''
    monsterHpMax.value = null
    monsterInitiative.value = null
  } catch (e) {
    monsterError.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleMonsterHp(monsterId: string, event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(val)) return
  await updateMonster(monsterId, { hpCurrent: val })
}

async function handleMonsterInitiative(monsterId: string, event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(val)) return
  await updateMonster(monsterId, { initiative: val })
}

async function handleLeave() {
  await leave()
  router.push('/sessions')
}
</script>

<template>
  <div class="session-page">

    <!-- Header ---------------------------------------------------------------->
    <header class="session-header">
      <div class="session-header-left">
        <h1 class="session-title">{{ session?.name ?? '…' }}</h1>
        <span v-if="isGm" class="badge badge-gm">MJ</span>
      </div>
      <button class="btn ghost icon-btn" title="Quitter la session" @click="handleLeave">
        <DoorOpen :size="18" />
      </button>
    </header>

    <!-- Connecting / error ----------------------------------------------------->
    <div v-if="connecting" class="state-msg">Connexion…</div>
    <div v-else-if="error" class="state-msg state-error">{{ error }}</div>

    <!-- Tabs ------------------------------------------------------------------>
    <nav v-if="session" class="tab-bar">
      <button
        :class="['tab-btn', { active: activeTab === 'combat' }]"
        title="Combat"
        @click="activeTab = 'combat'"
      >
        <Swords :size="18" />
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'participants' }]"
        title="Participants"
        @click="activeTab = 'participants'"
      >
        <Users :size="18" />
      </button>
    </nav>

    <!-- ── Combat tab ─────────────────────────────────────────────────────── -->
    <div v-if="session && activeTab === 'combat'" class="tab-content">

      <!-- Ordre d'initiative -->
      <section class="initiative-track">
        <div
          v-for="entry in initiativeOrder"
          :key="(entry.kind === 'player' ? 'p' : 'm') + (entry.kind === 'player' ? entry.data.userId : entry.data.id)"
          class="initiative-row"
          :class="entry.kind === 'monster' ? 'is-monster' : 'is-player'"
        >
          <span class="init-badge">
            {{ entry.data.initiative ?? '?' }}
          </span>
          <span class="entity-name">
            {{ entry.kind === 'player' ? entry.data.characterName : entry.data.name }}
          </span>
          <span v-if="entry.kind === 'player'" class="hp-chip">
            <Shield :size="12" />
            {{ entry.data.hpCurrent }}/{{ entry.data.hpMax }}
          </span>
          <div
            v-else-if="isGm && entry.data.hpCurrent != null"
            class="monster-hp-controls"
          >
            <button class="hp-btn" @click="updateMonster(entry.data.id, { hpCurrent: entry.data.hpCurrent - 5 })">-5</button>
            <button class="hp-btn" @click="updateMonster(entry.data.id, { hpCurrent: entry.data.hpCurrent - 1 })">-1</button>
            <span class="hp-chip hp-chip-monster">
              <Shield :size="12" />
              {{ entry.data.hpCurrent }}/{{ entry.data.hpMax }}
            </span>
            <button class="hp-btn" @click="updateMonster(entry.data.id, { hpCurrent: entry.data.hpCurrent + 1 })">+1</button>
            <button class="hp-btn" @click="updateMonster(entry.data.id, { hpCurrent: entry.data.hpCurrent + 5 })">+5</button>
          </div>
        </div>

        <div v-if="initiativeOrder.length === 0" class="empty-state">
          Aucun combattant pour l'instant.
        </div>
      </section>

      <!-- Joueur : set son initiative -->
      <section v-if="!isGm" class="own-initiative">
        <label class="field-label">Mon initiative</label>
        <div class="own-initiative-row">
          <input
            v-model.number="myInitiative"
            type="number"
            class="text-input number-input"
            placeholder="—"
            min="-10"
            max="100"
          />
          <button class="btn primary" @click="handleSetInitiative">OK</button>
        </div>
      </section>

      <!-- MJ : gestion des monstres -->
      <section v-if="isGm" class="monster-section">
        <h3 class="section-title">Monstres</h3>

        <!-- Liste monstres existants -->
        <div v-if="session.monsters.length" class="monster-list">
          <div v-for="m in session.monsters" :key="m.id" class="monster-row">
            <span class="monster-name">{{ m.name }}</span>
            <div class="monster-controls">
              <input
                type="number"
                class="text-input number-input"
                :value="m.hpCurrent"
                :max="m.hpMax"
                min="0"
                title="PV actuels"
                @change="(e) => handleMonsterHp(m.id, e)"
              />
              <span class="hp-max-label">/ {{ m.hpMax }}</span>
              <input
                type="number"
                class="text-input number-input init-input"
                :value="m.initiative"
                placeholder="Init"
                title="Initiative"
                @change="(e) => handleMonsterInitiative(m.id, e)"
              />
              <button
                class="btn ghost icon-btn btn-danger"
                title="Retirer"
                @click="removeMonster(m.id)"
              >
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>

        <!-- Formulaire ajout monstre -->
        <form class="add-monster-form" @submit.prevent="handleAddMonster">
          <input
            v-model="monsterName"
            class="text-input"
            placeholder="Nom du monstre"
            required
          />
          <input
            v-model.number="monsterHpMax"
            type="number"
            class="text-input number-input"
            placeholder="PV max"
            min="1"
            required
          />
          <input
            v-model.number="monsterInitiative"
            type="number"
            class="text-input number-input init-input"
            placeholder="Init"
          />
          <button type="submit" class="btn primary icon-btn" title="Ajouter">
            <Plus :size="16" />
          </button>
        </form>
        <p v-if="monsterError" class="form-error">{{ monsterError }}</p>
      </section>
    </div>

    <!-- ── Participants tab ───────────────────────────────────────────────── -->
    <div v-if="session && activeTab === 'participants'" class="tab-content">
      <div class="participant-list">
        <div
          v-for="p in session.participants"
          :key="p.userId"
          class="participant-card"
        >
          <div class="participant-info">
            <span class="participant-char">{{ p.characterName }}</span>
            <span class="participant-user">{{ p.username }}</span>
          </div>
          <div class="participant-right">
            <span v-if="p.userId === session.gmUserId" class="badge badge-gm">MJ</span>
            <span class="hp-chip">
              <Shield :size="12" />
              {{ p.hpCurrent }}/{{ p.hpMax }}
            </span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.session-page {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Header ── */
.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.session-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.session-title {
  font-family: var(--title-font);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--brand-strong);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15em 0.5em;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-gm {
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid var(--accent);
}

/* ── State messages ── */
.state-msg {
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
  padding: 1rem;
}

.state-error {
  color: var(--danger, #e05252);
}

/* ── Tabs ── */
.tab-bar {
  display: flex;
  gap: 0.35rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.tab-btn {
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 160ms ease, color 160ms ease, background-color 160ms ease;
}

.tab-btn:hover {
  color: var(--accent-strong);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.tab-btn.active {
  color: var(--accent-strong);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent-soft) 72%, var(--surface));
}

/* ── Tab content ── */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Initiative track ── */
.initiative-track {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.initiative-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.85rem;
  border-radius: 1rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.initiative-row.is-monster {
  border-color: color-mix(in srgb, var(--border) 60%, var(--accent));
}

.init-badge {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1.5px solid var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.entity-name {
  flex: 1;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hp-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  flex-shrink: 0;
}

.hp-chip-monster {
  color: var(--accent-strong);
}

.monster-hp-controls {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-shrink: 0;
}

.hp-btn {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15em 0.4em;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  line-height: 1.4;
  transition: border-color 120ms ease, background-color 120ms ease;
  white-space: nowrap;
}

.hp-btn:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

/* ── Own initiative ── */
.own-initiative {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.own-initiative-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Monster section ── */
.section-title {
  font-family: var(--title-font);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.monster-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.monster-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.monster-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.85rem;
}

.monster-name {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monster-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.hp-max-label {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}

.add-monster-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.add-monster-form .text-input:first-child {
  flex: 1;
  min-width: 120px;
}

.number-input {
  width: 4.5rem;
  text-align: center;
}

.init-input {
  width: 4rem;
}

.btn-danger {
  color: var(--danger, #e05252);
}

.btn-danger:hover {
  border-color: var(--danger, #e05252);
  background: color-mix(in srgb, var(--danger, #e05252) 12%, transparent);
}

/* ── Participants ── */
.participant-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.participant-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
}

.participant-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.participant-char {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text);
}

.participant-user {
  font-size: 0.78rem;
  color: var(--muted);
}

.participant-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  color: var(--muted);
  padding: 1.5rem 1rem;
  font-size: 0.9rem;
}

.form-error {
  color: var(--danger, #e05252);
  font-size: 0.85rem;
  margin: 0;
}
</style>

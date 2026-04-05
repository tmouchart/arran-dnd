<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Copy, Trash2, Plus, Search } from 'lucide-vue-next'
import {
  fetchEncounter,
  updateEncounter,
  addEncounterMonster,
  duplicateEncounterMonster,
  updateEncounterMonster,
  deleteEncounterMonster,
  type EncounterDetail,
  type EncounterMonster,
} from '../api/campaigns'
import { MONSTERS_CATALOG, type Monster } from '../data/monstersCatalog'
import { filterCatalog, formatMod } from '../utils/monsterSession'
import AppPageLayout from '../components/ui/AppPageLayout.vue'
import AppPageHead from '../components/ui/AppPageHead.vue'
import AppIconBtn from '../components/ui/AppIconBtn.vue'
import AppInput from '../components/ui/AppInput.vue'
import AppEmptyState from '../components/ui/AppEmptyState.vue'
import AppCard from '../components/ui/AppCard.vue'

const route = useRoute()
const router = useRouter()

const campaignId = Number(route.params.id)
const encounterId = Number(route.params.eid)

const encounter = ref<EncounterDetail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// Name editing with debounce
const nameValue = ref('')
let nameTimer: ReturnType<typeof setTimeout> | null = null

watch(nameValue, (val) => {
  if (nameTimer) clearTimeout(nameTimer)
  nameTimer = setTimeout(() => {
    if (encounter.value && val.trim() && val !== encounter.value.name) {
      updateEncounter(campaignId, encounterId, { name: val.trim() })
      encounter.value.name = val.trim()
    }
  }, 800)
})

// Description editing with debounce
const descValue = ref('')
let descTimer: ReturnType<typeof setTimeout> | null = null

watch(descValue, (val) => {
  if (descTimer) clearTimeout(descTimer)
  descTimer = setTimeout(() => {
    if (encounter.value) {
      updateEncounter(campaignId, encounterId, { description: val.trim() || undefined })
      encounter.value.description = val.trim() || null
    }
  }, 800)
})

// Bestiary search
const searchQuery = ref('')
const showBestiary = ref(false)
const filteredMonsters = computed(() => filterCatalog(searchQuery.value, MONSTERS_CATALOG))

// Editing a monster
const editingMonsterId = ref<number | null>(null)

onMounted(load)

async function load() {
  loading.value = true
  error.value = null
  try {
    encounter.value = await fetchEncounter(campaignId, encounterId)
    nameValue.value = encounter.value.name
    descValue.value = encounter.value.description ?? ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  } finally {
    loading.value = false
  }
}

function catalogToMonsterData(m: Monster): Omit<EncounterMonster, 'id' | 'encounterId'> {
  return {
    name: m.name,
    nc: m.nc,
    size: m.size,
    def: m.def,
    pv: m.pv,
    init: m.init,
    rd: m.rd ?? null,
    statFor: m.stats.for,
    statDex: m.stats.dex,
    statCon: m.stats.con,
    statInt: m.stats.int,
    statSag: m.stats.sag,
    statCha: m.stats.cha,
    attacks: m.attacks,
    abilities: m.abilities,
    description: m.description ?? null,
  }
}

async function handleAddFromCatalog(m: Monster) {
  if (!encounter.value) return
  try {
    const created = await addEncounterMonster(campaignId, encounterId, catalogToMonsterData(m))
    encounter.value.monsters.push(created)
    searchQuery.value = ''
    showBestiary.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleAddCustom() {
  if (!encounter.value) return
  try {
    const created = await addEncounterMonster(campaignId, encounterId, {
      name: 'Nouveau monstre',
      nc: 0, size: 'moyenne', def: 10, pv: 10, init: 10, rd: null,
      statFor: 0, statDex: 0, statCon: 0, statInt: 0, statSag: 0, statCha: 0,
      attacks: [], abilities: [], description: null,
    })
    encounter.value.monsters.push(created)
    editingMonsterId.value = created.id
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleDuplicate(mid: number) {
  if (!encounter.value) return
  try {
    const updatedMonsters = await duplicateEncounterMonster(campaignId, encounterId, mid)
    encounter.value.monsters = updatedMonsters
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

async function handleDeleteMonster(mid: number) {
  if (!encounter.value) return
  try {
    await deleteEncounterMonster(campaignId, encounterId, mid)
    encounter.value.monsters = encounter.value.monsters.filter((m) => m.id !== mid)
    if (editingMonsterId.value === mid) editingMonsterId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  }
}

// Save monster field changes with debounce
const monsterTimers = new Map<number, ReturnType<typeof setTimeout>>()

function saveMonsterField(monster: EncounterMonster, field: string, value: unknown) {
  ;(monster as unknown as Record<string, unknown>)[field] = value

  const existing = monsterTimers.get(monster.id)
  if (existing) clearTimeout(existing)

  monsterTimers.set(
    monster.id,
    setTimeout(async () => {
      monsterTimers.delete(monster.id)
      try {
        await updateEncounterMonster(campaignId, encounterId, monster.id, { [field]: value })
      } catch {
        /* silent */
      }
    }, 600),
  )
}

function goBack() {
  router.push(`/campagnes/${campaignId}`)
}
</script>

<template>
  <AppPageLayout>
    <template #top-bar>
      <AppPageHead>
        <template #actions>
          <AppIconBtn title="Retour" @click="goBack">
            <ArrowLeft :size="18" />
          </AppIconBtn>
        </template>
        {{ encounter?.name ?? 'Rencontre' }}
      </AppPageHead>
    </template>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else-if="encounter">
      <!-- Name & description -->
      <AppCard title="Infos">
        <div class="info-fields">
          <div class="field-row">
            <label class="field-label">Nom</label>
            <AppInput v-model="nameValue" placeholder="Nom de la rencontre" />
          </div>
          <div class="field-row">
            <label class="field-label">Description</label>
            <textarea v-model="descValue" class="input" placeholder="Description (optionnel)" rows="2" />
          </div>
        </div>
      </AppCard>

      <!-- Monsters -->
      <div class="monsters-header">
        <h2 class="section-title">Ennemis ({{ encounter.monsters.length }})</h2>
        <div class="monsters-actions">
          <AppIconBtn title="Depuis le bestiaire" @click="showBestiary = !showBestiary">
            <Search :size="18" />
          </AppIconBtn>
          <AppIconBtn variant="primary" title="Ennemi custom" @click="handleAddCustom">
            <Plus :size="18" />
          </AppIconBtn>
        </div>
      </div>

      <!-- Bestiary search -->
      <div v-if="showBestiary" class="bestiary-search">
        <AppInput
          v-model="searchQuery"
          placeholder="Rechercher un monstre…"
          :autofocus="true"
        />
        <div class="bestiary-results">
          <div
            v-for="m in filteredMonsters"
            :key="m.name"
            class="bestiary-item"
            @click="handleAddFromCatalog(m)"
          >
            <span class="bestiary-name">{{ m.name }}</span>
            <span class="bestiary-meta">NC {{ m.nc }} · {{ m.pv }} PV · DEF {{ m.def }}</span>
          </div>
          <p v-if="filteredMonsters.length === 0" class="bestiary-empty">Aucun résultat</p>
        </div>
      </div>

      <!-- Monster list -->
      <AppEmptyState v-if="encounter.monsters.length === 0 && !showBestiary">
        Aucun ennemi. Ajoute-en depuis le bestiaire ou crée-en un !
      </AppEmptyState>

      <div v-else class="monster-list">
        <div v-for="m in encounter.monsters" :key="m.id" class="monster-card">
          <!-- Summary row -->
          <div class="monster-summary" @click="editingMonsterId = editingMonsterId === m.id ? null : m.id">
            <div class="monster-main-info">
              <span class="monster-name">{{ m.name }}</span>
              <span class="monster-stats-brief">
                NC {{ m.nc }} · {{ m.pv }} PV · DEF {{ m.def }} · Init {{ m.init }}
              </span>
            </div>
            <div class="monster-actions">
              <AppIconBtn title="Dupliquer" @click.stop="handleDuplicate(m.id)">
                <Copy :size="16" />
              </AppIconBtn>
              <AppIconBtn variant="danger" title="Supprimer" @click.stop="handleDeleteMonster(m.id)">
                <Trash2 :size="16" />
              </AppIconBtn>
            </div>
          </div>

          <!-- Expanded edit form -->
          <div v-if="editingMonsterId === m.id" class="monster-edit">
            <div class="edit-grid">
              <div class="edit-field">
                <label>Nom</label>
                <AppInput :model-value="m.name" @update:model-value="saveMonsterField(m, 'name', $event)" />
              </div>
              <div class="edit-field">
                <label>NC</label>
                <AppInput type="number" :model-value="m.nc" :step="0.5" :min="0" @update:model-value="saveMonsterField(m, 'nc', $event)" />
              </div>
              <div class="edit-field">
                <label>PV</label>
                <AppInput type="number" :model-value="m.pv" :min="1" @update:model-value="saveMonsterField(m, 'pv', $event)" />
              </div>
              <div class="edit-field">
                <label>DEF</label>
                <AppInput type="number" :model-value="m.def" @update:model-value="saveMonsterField(m, 'def', $event)" />
              </div>
              <div class="edit-field">
                <label>Init</label>
                <AppInput type="number" :model-value="m.init" @update:model-value="saveMonsterField(m, 'init', $event)" />
              </div>
              <div class="edit-field">
                <label>Taille</label>
                <AppInput :model-value="m.size" @update:model-value="saveMonsterField(m, 'size', $event)" />
              </div>
              <div class="edit-field">
                <label>RD</label>
                <AppInput :model-value="m.rd ?? ''" @update:model-value="saveMonsterField(m, 'rd', $event || null)" />
              </div>
            </div>

            <div class="stats-row">
              <div v-for="stat in ['For', 'Dex', 'Con', 'Int', 'Sag', 'Cha']" :key="stat" class="stat-cell">
                <label>{{ stat }}</label>
                <AppInput
                  type="number"
                  text-align="center"
                  :model-value="(m as Record<string, unknown>)[`stat${stat}`] as number"
                  @update:model-value="saveMonsterField(m, `stat${stat}`, $event)"
                />
                <span class="stat-mod">{{ formatMod((m as Record<string, unknown>)[`stat${stat}`] as number) }}</span>
              </div>
            </div>

            <!-- Attacks -->
            <div class="sub-section">
              <h3>Attaques ({{ m.attacks.length }})</h3>
              <div v-for="(atk, i) in m.attacks" :key="i" class="attack-row">
                <span class="atk-name">{{ atk.name }}</span>
                <span class="atk-detail">{{ formatMod(atk.bonus) }} · {{ atk.damage }}{{ atk.range ? ` · ${atk.range}m` : '' }}</span>
              </div>
              <p v-if="m.attacks.length === 0" class="sub-empty">Aucune attaque</p>
            </div>

            <!-- Abilities -->
            <div class="sub-section">
              <h3>Capacités ({{ m.abilities.length }})</h3>
              <div v-for="(ab, i) in m.abilities" :key="i" class="ability-row">
                <span class="ability-name">{{ ab.name }}</span>
                <span class="ability-desc">{{ ab.description }}</span>
              </div>
              <p v-if="m.abilities.length === 0" class="sub-empty">Aucune capacité</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AppPageLayout>
</template>

<style scoped>
.info-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.monsters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.monsters-actions {
  display: flex;
  gap: 0.35rem;
}

/* Bestiary search */
.bestiary-search {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1rem;
}

.bestiary-results {
  max-height: 250px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.bestiary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.6rem;
  border-radius: 0.6rem;
  cursor: pointer;
  transition: background 120ms ease;
}

.bestiary-item:hover {
  background: var(--accent-soft);
}

.bestiary-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.bestiary-meta {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
}

.bestiary-empty {
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted);
  padding: 0.5rem;
  margin: 0;
}

/* Monster list */
.monster-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.monster-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  overflow: hidden;
  transition: border-color 160ms ease;
}

.monster-card:hover {
  border-color: var(--accent);
}

.monster-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  cursor: pointer;
  gap: 0.5rem;
}

.monster-main-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.monster-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.monster-stats-brief {
  font-size: 0.78rem;
  color: var(--muted);
}

.monster-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

/* Expanded edit form */
.monster-edit {
  padding: 0 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-top: 1px solid var(--border);
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.edit-field label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
}

.edit-field:first-child {
  grid-column: 1 / -1;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.4rem;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.stat-cell label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
}

.stat-mod {
  font-size: 0.72rem;
  color: var(--muted);
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sub-section h3 {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.attack-row {
  display: flex;
  justify-content: space-between;
  padding: 0.3rem 0.5rem;
  background: var(--surface);
  border-radius: 0.5rem;
  font-size: 0.82rem;
}

.atk-name {
  font-weight: 600;
  color: var(--text);
}

.atk-detail {
  color: var(--muted);
}

.ability-row {
  padding: 0.3rem 0.5rem;
  background: var(--surface);
  border-radius: 0.5rem;
  font-size: 0.82rem;
}

.ability-name {
  font-weight: 600;
  color: var(--text);
}

.ability-desc {
  display: block;
  color: var(--muted);
  font-size: 0.78rem;
  margin-top: 0.1rem;
}

.sub-empty {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0;
  padding: 0.2rem 0.5rem;
}

.form-error {
  color: var(--danger, #e05252);
  font-size: 0.85rem;
  margin: 0;
}
</style>

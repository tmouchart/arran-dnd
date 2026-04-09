<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Copy, Trash2, Plus, Search, X, ChevronUp, ChevronDown } from 'lucide-vue-next'
import {
  fetchEncounter,
  updateEncounter,
  addEncounterMonster,
  duplicateEncounterMonster,
  updateEncounterMonster,
  deleteEncounterMonster,
  type EncounterDetail,
  type EncounterMonster,
  type EncounterMonsterAttack,
  type EncounterMonsterAbility,
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
const monsterTimers = new Map<string, ReturnType<typeof setTimeout>>()

function debounceSaveMonsterField(monster: EncounterMonster, field: string, value: unknown) {
  const key = `${monster.id}:${field}`
  const existing = monsterTimers.get(key)
  if (existing) clearTimeout(existing)

  monsterTimers.set(
    key,
    setTimeout(async () => {
      monsterTimers.delete(key)
      try {
        await updateEncounterMonster(campaignId, encounterId, monster.id, { [field]: value })
      } catch {
        /* silent */
      }
    }, 600),
  )
}

function saveMonsterField(monster: EncounterMonster, field: string, value: unknown) {
  ;(monster as unknown as Record<string, unknown>)[field] = value
  debounceSaveMonsterField(monster, field, value)
}

async function addAttack(monster: EncounterMonster) {
  const newAttack: EncounterMonsterAttack = { name: 'Attaque', bonus: 0, damage: '1d6' }
  const attacks = [...monster.attacks, newAttack]
  monster.attacks = attacks
  await updateEncounterMonster(campaignId, encounterId, monster.id, { attacks })
}

function updateAttack(monster: EncounterMonster, index: number, field: keyof EncounterMonsterAttack, value: string | number) {
  monster.attacks = monster.attacks.map((a, i) => i === index ? { ...a, [field]: value } : a)
  debounceSaveMonsterField(monster, 'attacks', monster.attacks)
}

async function removeAttack(monster: EncounterMonster, index: number) {
  const attacks = monster.attacks.filter((_, i) => i !== index)
  monster.attacks = attacks
  await updateEncounterMonster(campaignId, encounterId, monster.id, { attacks })
}

async function addAbility(monster: EncounterMonster) {
  const newAbility: EncounterMonsterAbility = { name: 'Capacité', description: '' }
  const abilities = [...monster.abilities, newAbility]
  monster.abilities = abilities
  await updateEncounterMonster(campaignId, encounterId, monster.id, { abilities })
}

function updateAbility(monster: EncounterMonster, index: number, field: keyof EncounterMonsterAbility, value: string) {
  monster.abilities = monster.abilities.map((a, i) => i === index ? { ...a, [field]: value } : a)
  debounceSaveMonsterField(monster, 'abilities', monster.abilities)
}

async function removeAbility(monster: EncounterMonster, index: number) {
  const abilities = monster.abilities.filter((_, i) => i !== index)
  monster.abilities = abilities
  await updateEncounterMonster(campaignId, encounterId, monster.id, { abilities })
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
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
                <AppInput :model-value="m.rd ?? '0'" @update:model-value="saveMonsterField(m, 'rd', $event || null)" />
              </div>
            </div>

            <div class="stats-row">
              <div v-for="stat in ['For', 'Dex', 'Con', 'Int', 'Sag', 'Cha']" :key="stat" class="stat-cell">
                <span class="stat-label">{{ stat }}</span>
                <div class="stat-box">
                  <div class="stat-score-mod">
                    <input
                      type="number"
                      class="stat-val-input"
                      :value="(m as Record<string, unknown>)[`stat${stat}`]"
                      @change="saveMonsterField(m, `stat${stat}`, Number(($event.target as HTMLInputElement).value))"
                    />
                    <span class="stat-mod">{{ formatMod((m as Record<string, unknown>)[`stat${stat}`] as number) }}</span>
                  </div>
                  <div class="stat-btns">
                    <button type="button" class="stat-btn" @click="saveMonsterField(m, `stat${stat}`, ((m as Record<string, unknown>)[`stat${stat}`] as number) + 1)">
                      <ChevronUp :size="12" :stroke-width="2.5" />
                    </button>
                    <button type="button" class="stat-btn" @click="saveMonsterField(m, `stat${stat}`, ((m as Record<string, unknown>)[`stat${stat}`] as number) - 1)">
                      <ChevronDown :size="12" :stroke-width="2.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Attacks -->
            <div class="sub-section">
              <div class="sub-section-head">
                <h3>Attaques ({{ m.attacks.length }})</h3>
                <AppIconBtn :size="28" variant="primary" title="Ajouter une attaque" @click="addAttack(m)">
                  <Plus :size="14" />
                </AppIconBtn>
              </div>
              <div v-for="(atk, i) in m.attacks" :key="i" class="attack-edit-row">
                <AppInput :model-value="atk.name" placeholder="Nom" @update:model-value="updateAttack(m, i, 'name', $event as string)" />
                <AppInput type="number" :model-value="atk.bonus" placeholder="Bonus" text-align="center" @update:model-value="updateAttack(m, i, 'bonus', $event as number)" />
                <AppInput :model-value="atk.damage" placeholder="Dégâts" @update:model-value="updateAttack(m, i, 'damage', $event as string)" />
                <AppIconBtn :size="28" variant="danger" title="Supprimer" @click="removeAttack(m, i)">
                  <X :size="13" />
                </AppIconBtn>
              </div>
              <p v-if="m.attacks.length === 0" class="sub-empty">Aucune attaque</p>
            </div>

            <!-- Abilities -->
            <div class="sub-section">
              <div class="sub-section-head">
                <h3>Capacités ({{ m.abilities.length }})</h3>
                <AppIconBtn :size="28" variant="primary" title="Ajouter une capacité" @click="addAbility(m)">
                  <Plus :size="14" />
                </AppIconBtn>
              </div>
              <div v-for="(ab, i) in m.abilities" :key="i" class="ability-edit-row">
                <div class="ability-edit-fields">
                  <AppInput :model-value="ab.name" placeholder="Nom" @update:model-value="updateAbility(m, i, 'name', $event as string)" />
                  <textarea
                    ref="abilityDescRefs"
                    class="input ability-desc"
                    :value="ab.description"
                    placeholder="Description"
                    rows="1"
                    @input="autoResize($event); updateAbility(m, i, 'description', ($event.target as HTMLTextAreaElement).value)"
                    @vue:mounted="({ el }: any) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }"
                  />
                </div>
                <AppIconBtn :size="28" variant="danger" title="Supprimer" @click="removeAbility(m, i)">
                  <X :size="13" />
                </AppIconBtn>
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
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.6rem;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  flex: 1 1 0;
  min-width: 0;
}

.stat-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-transform: uppercase;
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.3rem 0.3rem 0.3rem 0.4rem;
  width: 100%;
  box-sizing: border-box;
}

.stat-score-mod {
  display: flex;
  align-items: baseline;
  gap: 0.15rem;
  min-width: 0;
  overflow: hidden;
}

.stat-val-input {
  width: 2.2ch;
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  line-height: 1;
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
  -moz-appearance: textfield;
}

.stat-val-input::-webkit-inner-spin-button,
.stat-val-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

.stat-mod {
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.stat-btns {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-left: auto;
}

.stat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
  transition: background 100ms ease, color 100ms ease;
}

.stat-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sub-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-section h3 {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.attack-edit-row {
  display: grid;
  grid-template-columns: 1fr 60px 80px 28px;
  gap: 0.3rem;
  align-items: center;
}

.ability-edit-row {
  display: flex;
  gap: 0.3rem;
  align-items: flex-start;
}

.ability-edit-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ability-desc {
  resize: none;
  overflow: hidden;
  min-height: 2.2rem;
  line-height: 1.4;
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

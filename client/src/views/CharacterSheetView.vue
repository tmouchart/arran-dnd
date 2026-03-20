<script setup lang="ts">
import { computed } from 'vue'
import { useCharacter } from '../composables/useCharacter'
const { character, reset, abilityModifier } = useCharacter()

const abilityList = computed(() => [
  { key: 'strength' as const, label: 'FOR' },
  { key: 'dexterity' as const, label: 'DEX' },
  { key: 'constitution' as const, label: 'CON' },
  { key: 'intelligence' as const, label: 'INT' },
  { key: 'wisdom' as const, label: 'SAG' },
  { key: 'charisma' as const, label: 'CHA' },
])

function addSkill() {
  character.value.skills.push({ name: '', rank: 0 })
}

function removeSkill(i: number) {
  character.value.skills.splice(i, 1)
}

function addAttack() {
  character.value.attacks.push({
    name: '',
    attackBonus: '',
    damage: '',
  })
}

function removeAttack(i: number) {
  character.value.attacks.splice(i, 1)
}

function addPath() {
  character.value.paths.push({ name: '', rank: 1 })
}

function removePath(i: number) {
  character.value.paths.splice(i, 1)
}

const hpPct = computed(() => {
  const max = character.value.hpMax || 1
  return Math.min(100, Math.round((character.value.hpCurrent / max) * 100))
})

const mpPct = computed(() => {
  const max = character.value.mpMax || 1
  if (character.value.mpMax <= 0) return 0
  return Math.min(100, Math.round((character.value.mpCurrent / max) * 100))
})
</script>

<template>
  <div class="page sheet-page">
    <header class="page-head">
      <h1>Fiche personnage</h1>
      <p class="lede">
        Données enregistrées localement dans ce navigateur. À adapter aux règles exactes
        de ta table.
      </p>
    </header>

    <section class="card identity">
      <h2>Identité</h2>
      <div class="grid-2">
        <label class="field">
          <span>Nom</span>
          <input v-model="character.name" type="text" class="input" />
        </label>
        <label class="field">
          <span>Niveau</span>
          <input
            v-model.number="character.level"
            type="number"
            min="1"
            class="input narrow"
          />
        </label>
        <label class="field">
          <span>Profil</span>
          <input v-model="character.profile" type="text" class="input" />
        </label>
        <label class="field">
          <span>Peuple</span>
          <input v-model="character.people" type="text" class="input" />
        </label>
      </div>
    </section>

    <section class="card resources">
      <h2>PV &amp; ressources</h2>
      <div class="bars">
        <div class="bar-block">
          <div class="bar-label">
            <span>Points de vie</span>
            <span class="nums"
              >{{ character.hpCurrent }} / {{ character.hpMax }}</span
            >
          </div>
          <div class="bar-track">
            <div class="bar-fill hp" :style="{ width: hpPct + '%' }" />
          </div>
          <div class="inline-edit">
            <label>
              Courants
              <input
                v-model.number="character.hpCurrent"
                type="number"
                min="0"
                class="input narrow"
              />
            </label>
            <label>
              Maximum
              <input
                v-model.number="character.hpMax"
                type="number"
                min="1"
                class="input narrow"
              />
            </label>
          </div>
        </div>
        <div class="bar-block">
          <div class="bar-label">
            <span>Points de mana</span>
            <span class="nums"
              >{{ character.mpCurrent }} / {{ character.mpMax }}</span
            >
          </div>
          <div class="bar-track">
            <div
              class="bar-fill mp"
              :style="{ width: character.mpMax > 0 ? mpPct + '%' : '0%' }"
            />
          </div>
          <div class="inline-edit">
            <label>
              Courants
              <input
                v-model.number="character.mpCurrent"
                type="number"
                min="0"
                class="input narrow"
              />
            </label>
            <label>
              Maximum
              <input
                v-model.number="character.mpMax"
                type="number"
                min="0"
                class="input narrow"
              />
            </label>
          </div>
        </div>
      </div>
      <div class="grid-2 tight">
        <label class="field">
          <span>Défense</span>
          <input
            v-model.number="character.defense"
            type="number"
            class="input narrow"
          />
        </label>
        <label class="field">
          <span>Initiative (bonus)</span>
          <input
            v-model.number="character.initiativeBonus"
            type="number"
            class="input narrow"
          />
        </label>
      </div>
    </section>

    <section class="card">
      <h2>Caractéristiques</h2>
      <div class="abilities">
        <div v-for="a in abilityList" :key="a.key" class="ability">
          <span class="abil-label">{{ a.label }}</span>
          <input
            v-model.number="character.abilities[a.key]"
            type="number"
            class="input score"
          />
          <span class="mod"
            >{{ abilityModifier(character.abilities[a.key]) >= 0 ? '+' : ''
            }}{{ abilityModifier(character.abilities[a.key]) }}</span
          >
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Compétences</h2>
        <button type="button" class="btn ghost small" @click="addSkill">
          + Ajouter
        </button>
      </div>
      <ul v-if="character.skills.length" class="rows">
        <li v-for="(s, i) in character.skills" :key="i" class="row">
          <input
            v-model="s.name"
            type="text"
            class="input grow"
            placeholder="Nom"
          />
          <input
            v-model.number="s.rank"
            type="number"
            min="0"
            class="input rank"
          />
          <button
            type="button"
            class="btn ghost small"
            title="Supprimer"
            @click="removeSkill(i)"
          >
            ×
          </button>
        </li>
      </ul>
      <p v-else class="muted">Aucune compétence — ajoute les tiennes.</p>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Attaques</h2>
        <button type="button" class="btn ghost small" @click="addAttack">
          + Ajouter
        </button>
      </div>
      <ul v-if="character.attacks.length" class="attack-list">
        <li v-for="(atk, i) in character.attacks" :key="i" class="attack-card">
          <input
            v-model="atk.name"
            type="text"
            class="input"
            placeholder="Arme ou sort"
          />
          <div class="grid-2 tight">
            <label class="field">
              <span>Attaque</span>
              <input
                v-model="atk.attackBonus"
                type="text"
                class="input"
                placeholder="+5"
              />
            </label>
            <label class="field">
              <span>Dégâts</span>
              <input
                v-model="atk.damage"
                type="text"
                class="input"
                placeholder="1d8+3"
              />
            </label>
          </div>
          <input
            v-model="atk.notes"
            type="text"
            class="input"
            placeholder="Notes (portée, spécial…)"
          />
          <button
            type="button"
            class="btn ghost small"
            @click="removeAttack(i)"
          >
            Retirer
          </button>
        </li>
      </ul>
      <p v-else class="muted">Ajoute tes attaques ou sorts offensifs.</p>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Voies</h2>
        <button type="button" class="btn ghost small" @click="addPath">
          + Ajouter
        </button>
      </div>
      <ul v-if="character.paths.length" class="rows">
        <li v-for="(p, i) in character.paths" :key="i" class="row path-row">
          <input
            v-model="p.name"
            type="text"
            class="input grow"
            placeholder="Nom de la voie"
          />
          <input
            v-model.number="p.rank"
            type="number"
            min="1"
            class="input rank"
            title="Rang"
          />
          <input
            v-model="p.notes"
            type="text"
            class="input grow"
            placeholder="Capacités notables"
          />
          <button
            type="button"
            class="btn ghost small"
            @click="removePath(i)"
          >
            ×
          </button>
        </li>
      </ul>
      <p v-else class="muted">Ajoute les voies et leur rang.</p>
    </section>

    <div class="footer-actions">
      <button type="button" class="btn danger ghost" @click="reset">
        Réinitialiser la fiche
      </button>
    </div>
  </div>
</template>

<style scoped>
.sheet-page {
  max-width: 40rem;
  margin: 0 auto;
}

.page-head {
  margin-bottom: 0.9rem;
}

.page-head h1 {
  margin: 0 0 0.4rem;
  font-size: clamp(1.35rem, 4.5vw, 1.95rem);
  font-family: var(--title-font);
  color: var(--brand-strong);
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 0.97rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 0.95rem 0.95rem;
  margin-bottom: 0.85rem;
  box-shadow: var(--shadow-card);
}

.card h2 {
  font-size: 1.02rem;
  margin: 0 0 0.8rem;
  font-weight: 600;
  font-family: var(--title-font);
  color: var(--accent-strong);
  letter-spacing: 0.01em;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  gap: 0.6rem;
}

.card-head h2 {
  margin: 0;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

@media (min-width: 520px) {
  .grid-2 {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 0.95rem;
  }
}

.grid-2.tight {
  margin-top: 0.7rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  font-size: 0.83rem;
  color: var(--muted);
}

.input {
  min-height: 42px;
  padding: 0.5rem 0.64rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
}

.input.narrow {
  max-width: 6rem;
}

.input.grow {
  flex: 1;
  min-width: 0;
}

.input.rank {
  width: 3.5rem;
  text-align: center;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.87rem;
  margin-bottom: 0.35rem;
  gap: 0.45rem;
}

.nums {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.bar-track {
  height: 12px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
  border: 1px solid var(--border);
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease;
}

.bar-fill.hp {
  background: linear-gradient(90deg, #8d3c3c, #c95f56);
}

.bar-fill.mp {
  background: linear-gradient(90deg, #425f8f, #678fc2);
}

.inline-edit {
  display: flex;
  gap: 0.65rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.inline-edit label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--muted);
}

.abilities {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.35rem, 1fr));
  gap: 0.52rem;
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.52rem;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.abil-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.input.score {
  width: 3.25rem;
  text-align: center;
  font-size: 1.1rem;
}

.mod {
  font-size: 0.9rem;
  color: var(--accent-strong);
  font-weight: 600;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.row {
  display: flex;
  gap: 0.46rem;
  align-items: center;
  flex-wrap: wrap;
}

.path-row {
  flex-wrap: wrap;
}

.attack-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.attack-card {
  padding: 0.68rem;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  background: var(--surface-2);
}

.muted {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

.footer-actions {
  margin: 1.15rem 0 1.6rem;
}

.btn.small {
  min-height: 38px;
  padding: 0.3rem 0.58rem;
  font-size: 0.82rem;
}

@media (min-width: 760px) {
  .card {
    padding: 1.1rem 1.2rem;
    margin-bottom: 1rem;
  }
}
</style>

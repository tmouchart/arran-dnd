<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchCharacters, activateCharacter, deleteCharacter, createCharacter, type ServerCharacter } from '../api/characters'

const router = useRouter()
const characters = ref<ServerCharacter[]>([])
const loading = ref(false)
const activating = ref<number | null>(null)
const deleting = ref<number | null>(null)
const creating = ref(false)

async function load() {
  loading.value = true
  try {
    characters.value = await fetchCharacters()
  } finally {
    loading.value = false
  }
}

async function handleActivate(c: ServerCharacter) {
  if (c.isActive) return
  activating.value = c.id
  try {
    await activateCharacter(c.id)
    characters.value = characters.value.map((ch) => ({
      ...ch,
      isActive: ch.id === c.id,
    }))
  } finally {
    activating.value = null
  }
}

function openSheet(c: ServerCharacter) {
  router.push({ path: '/personnage', query: { id: c.id } })
}

async function handleDelete(c: ServerCharacter) {
  deleting.value = c.id
  try {
    await deleteCharacter(c.id)
    characters.value = characters.value.filter((ch) => ch.id !== c.id)
  } finally {
    deleting.value = null
  }
}

async function handleCreate() {
  creating.value = true
  try {
    const created = await createCharacter({})
    router.push({ path: '/personnage', query: { id: created.id } })
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page list-page">
    <header class="page-head">
      <h1>Personnages</h1>
      <button type="button" class="btn ghost small" :disabled="creating" @click="handleCreate">
        {{ creating ? '…' : '+ Créer' }}
      </button>
    </header>

    <div v-if="loading" class="loading-msg">Chargement…</div>

    <ul v-else class="char-list">
      <li
        v-for="c in characters"
        :key="c.id"
        class="char-row"
        :class="{ active: c.isActive }"
      >
        <label class="active-check" :title="c.isActive ? 'Personnage actif' : 'Définir comme actif'">
          <input
            type="checkbox"
            :checked="c.isActive"
            :disabled="activating !== null"
            @change="handleActivate(c)"
          />
          <span class="check-mark" :class="{ checked: c.isActive }">✓</span>
        </label>

        <button type="button" class="char-name" @click="openSheet(c)">
          <span class="name-row">
            <span class="name">{{ c.name }}</span>
            <span v-if="c.isActive" class="chip-active">Actif</span>
          </span>
          <span class="meta">{{ c.profile || 'Sans profil' }} · Niv. {{ c.level }}</span>
        </button>

        <button
          type="button"
          class="btn-delete"
          title="Supprimer"
          :disabled="deleting === c.id"
          @click="handleDelete(c)"
        >🗑️</button>
      </li>
    </ul>

    <p v-if="!loading && characters.length === 0" class="muted">Aucun personnage.</p>
  </div>
</template>

<style scoped>
.list-page {
  max-width: 32rem;
  margin: 0 auto;
}

.page-head {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.page-head h1 {
  margin: 0;
  font-size: clamp(1.35rem, 4.5vw, 1.95rem);
  font-family: var(--title-font);
  color: var(--brand-strong);
}

.loading-msg {
  color: var(--muted);
  font-size: 0.95rem;
  padding: 2rem 0;
  text-align: center;
}

.char-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.char-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.95rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  transition: border-color 160ms ease;
}

.char-row.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface));
}

.active-check {
  display: flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.active-check input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.check-mark {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: transparent;
  transition: all 160ms ease;
}

.check-mark.checked {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.char-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
  color: inherit;
}

.char-name:hover .name {
  color: var(--accent-strong);
}

.name {
  font-weight: 600;
  font-size: 1rem;
  transition: color 160ms ease;
}

.meta {
  font-size: 0.8rem;
  color: var(--muted);
}

.name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip-active {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #1a7a3c22;
  color: #1a7a3c;
  border: 1px solid #1a7a3c55;
  letter-spacing: 0.04em;
}

[data-theme='dark'] .chip-active {
  background: #1db95422;
  color: #4ade80;
  border-color: #4ade8055;
}

.btn-delete {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.3rem;
  border-radius: 8px;
  line-height: 1;
  opacity: 0.5;
  transition: opacity 160ms ease, background 160ms ease;
}

.btn-delete:hover:not(:disabled) {
  opacity: 1;
  background: #ff000018;
}

.btn-delete:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.muted {
  color: var(--muted);
  font-size: 0.9rem;
}
</style>

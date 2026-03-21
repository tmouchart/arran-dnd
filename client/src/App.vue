<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { computed, ref } from 'vue'
import { user, logout } from './composables/useAuth'

const router = useRouter()

async function handleLogout() {
  await logout()
  router.push('/login')
}

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'arran-theme'
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const initialTheme = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? (prefersDark ? 'dark' : 'light')
const theme = ref<Theme>(initialTheme)

function applyTheme(nextTheme: Theme): void {
  theme.value = nextTheme
  document.documentElement.dataset.theme = nextTheme
  localStorage.setItem(STORAGE_KEY, nextTheme)
}

function toggleTheme(): void {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

applyTheme(initialTheme)

const themeAriaLabel = computed(() =>
  theme.value === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre',
)
const themeIcon = computed(() => (theme.value === 'dark' ? '☀️' : '🌙'))
</script>

<template>
  <div class="app-shell">
    <header class="top-nav">
      <RouterLink to="/" class="brand">Terres d’Arran</RouterLink>
      <div class="top-nav-actions">
        <nav class="nav-links">
          <RouterLink to="/" class="nav-link">Assistant</RouterLink>
          <RouterLink to="/personnage" class="nav-link">Personnage</RouterLink>
        </nav>
        <span v-if="user" class="nav-username">{{ user.username }}</span>
        <button
          v-if="user"
          type="button"
          class="btn ghost logout-btn"
          title="Se déconnecter"
          @click="handleLogout"
        >
          Déconnexion
        </button>
        <button
          type="button"
          class="btn ghost theme-switch"
          :aria-label="themeAriaLabel"
          :title="themeAriaLabel"
          @click="toggleTheme"
        >
          <span aria-hidden="true">{{ themeIcon }}</span>
        </button>
      </div>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.8rem 0.95rem 0.9rem;
  border-bottom: 1px solid var(--border-strong);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, white), var(--surface));
  box-shadow: var(--shadow-soft);
}

.brand {
  font-family: var(--title-font);
  font-weight: 700;
  font-size: clamp(1.08rem, 2.7vw, 1.32rem);
  color: var(--brand-strong);
  text-decoration: none;
  letter-spacing: 0.03em;
}

.nav-links {
  display: flex;
  gap: 0.45rem;
  width: 100%;
  overflow-x: auto;
  padding-bottom: 0.15rem;
}

.top-nav-actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: 100%;
}

.nav-username {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.logout-btn {
  font-size: 0.82rem;
  padding: 0.35rem 0.7rem;
  min-height: 32px;
}

.theme-switch {
  align-self: flex-end;
  width: 40px;
  height: 40px;
  min-height: 40px;
  padding: 0;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-link {
  padding: 0.5rem 0.88rem;
  border-radius: 999px;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.93rem;
  font-weight: 600;
  border: 1px solid var(--border);
  white-space: nowrap;
  background: var(--surface-2);
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background-color 160ms ease;
}

.nav-link:hover {
  color: var(--accent-strong);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.nav-link.router-link-active {
  color: var(--accent-strong);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent-soft) 72%, var(--surface));
}

.main {
  flex: 1;
  padding: 1rem 0.78rem 1.5rem;
}

@media (min-width: 740px) {
  .top-nav {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding-inline: 1.35rem;
  }

  .nav-links {
    width: auto;
    overflow: visible;
    justify-content: flex-end;
  }

  .top-nav-actions {
    width: auto;
    flex-direction: row;
    align-items: center;
    gap: 0.7rem;
  }

  .main {
    padding: 1.25rem 1rem 2rem;
  }
}
</style>

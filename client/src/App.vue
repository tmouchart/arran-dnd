<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from "vue-router";
import { computed, ref } from "vue";
import { LogOut, Users } from "lucide-vue-next";
import { user, logout } from "./composables/useAuth";
import AppIconBtn from "./components/ui/AppIconBtn.vue";

const router = useRouter();

async function handleLogout() {
  await logout();
  router.push("/login");
}

type Theme = "light" | "dark";

const STORAGE_KEY = "arran-theme";
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme =
  (localStorage.getItem(STORAGE_KEY) as Theme | null) ??
  (prefersDark ? "dark" : "light");
const theme = ref<Theme>(initialTheme);

function applyTheme(nextTheme: Theme): void {
  theme.value = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(STORAGE_KEY, nextTheme);
}

function toggleTheme(): void {
  applyTheme(theme.value === "dark" ? "light" : "dark");
}

applyTheme(initialTheme);

const themeAriaLabel = computed(() =>
  theme.value === "dark" ? "Passer en mode clair" : "Passer en mode sombre",
);
const themeIcon = computed(() => (theme.value === "dark" ? "☀️" : "🌙"));
</script>

<template>
  <div class="app-shell">
    <header class="top-nav">
      <RouterLink to="/personnage" class="brand">Terres d’Arran</RouterLink>
      <div class="top-nav-actions">
        <nav class="nav-links">
          <RouterLink to="/personnage" class="nav-link" title="Personnage">⚔️</RouterLink>
          <RouterLink to="/actions" class="nav-link" title="Mes actions">⚡</RouterLink>
          <RouterLink to="/chat" class="nav-link" title="Isilwen">🔮</RouterLink>
          <RouterLink to="/sessions" class="nav-link" title="Sessions de jeu">
            <Users :size="18" />
          </RouterLink>
        </nav>
        <span v-if="user" class="nav-username">{{ user.username }}</span>
        <div class="nav-controls">
          <AppIconBtn
            v-if="user"
            title="Se déconnecter"
            @click="handleLogout"
          >
            <LogOut :size="18" />
          </AppIconBtn>
          <AppIconBtn
            :aria-label="themeAriaLabel"
            :title="themeAriaLabel"
            @click="toggleTheme"
          >
            <span aria-hidden="true">{{ themeIcon }}</span>
          </AppIconBtn>
        </div>
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
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border-strong);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 92%, white),
    var(--surface)
  );
  box-shadow: var(--shadow-soft);
}

.brand {
  font-family: var(--title-font);
  font-weight: 700;
  font-size: clamp(1.08rem, 2.7vw, 1.32rem);
  color: var(--brand-strong);
  text-decoration: none;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

@media (max-width: 739px) {
  .brand {
    display: none;
  }
}

.nav-links {
  display: flex;
  gap: 0.35rem;
}

.top-nav-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.35rem;
}

.nav-username {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

@media (max-width: 739px) {
  .nav-username {
    display: none;
  }
}

.nav-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
}

@media (max-width: 739px) {
  .top-nav-actions {
    flex: 1;
  }

  .nav-controls {
    margin-left: auto;
  }
}


.nav-link {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  color: var(--muted);
  text-decoration: none;
  font-size: 1.15rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
    padding-inline: 1.35rem;
  }

  .top-nav-actions {
    gap: 0.7rem;
  }

  .main {
    padding: 1.25rem 1rem 2rem;
  }
}
</style>

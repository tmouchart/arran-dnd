<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { UserCircle, Loader2, ScrollText, Swords, Backpack, BookOpenText, Map, Palette } from "lucide-vue-next";
import CrystalBall from "./components/icons/CrystalBall.vue";
import AppToast from "./components/ui/AppToast.vue";
import { user, authReady } from "./composables/useAuth";
import { useActiveCombat, refreshActiveCombat } from "./composables/useActiveCombat";

const isDev = import.meta.env.DEV;
const route = useRoute();
const { activeCombat } = useActiveCombat();

// Resync le combat actif (relais des jets vers le log de combat) : au login
// et à chaque retour de l'app au premier plan. Pas de polling.
watch(user, (u) => { if (u) refreshActiveCombat(); }, { immediate: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && user.value) refreshActiveCombat();
});
const showCombatBanner = computed(() =>
  activeCombat.value && !route.path.includes('/combat/'),
);

// Apply saved theme + style on boot
type Theme = "light" | "dark";
const STORAGE_KEY = "arran-theme";
const STYLE_KEY = "arran-style";
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const savedTheme =
  (localStorage.getItem(STORAGE_KEY) as Theme | null) ??
  (prefersDark ? "dark" : "light");
document.documentElement.dataset.theme = savedTheme;

const savedStyle = localStorage.getItem(STYLE_KEY) ?? "";
if (savedStyle) {
  document.documentElement.dataset.style = savedStyle;
}
</script>

<template>
  <div v-if="!authReady" class="boot-screen">
    <Loader2 :size="36" class="boot-spinner" />
    <p class="boot-text">Chargement en cours</p>
  </div>
  <div v-else class="app-shell">
    <header class="top-nav">
      <RouterLink to="/personnage" class="brand">Terres d'Arran</RouterLink>
      <div class="top-nav-actions">
        <nav class="nav-links">
          <RouterLink to="/personnage" class="nav-link" title="Personnage"
            ><ScrollText :size="20"
          /></RouterLink>
          <RouterLink to="/actions" class="nav-link" title="Mes actions"
            ><Swords :size="20"
          /></RouterLink>
          <RouterLink to="/inventaire" class="nav-link" title="Inventaire"
            ><Backpack :size="20"
          /></RouterLink>
          <RouterLink to="/chat" class="nav-link" title="Isilwen"
            ><CrystalBall :size="20"
          /></RouterLink>
          <RouterLink to="/journal" class="nav-link" title="Journal"
            ><BookOpenText :size="20"
          /></RouterLink>
          <RouterLink to="/campagnes" class="nav-link" title="Campagnes"
            ><Map :size="20"
          /></RouterLink>
          <RouterLink
            v-if="isDev"
            to="/component-library"
            class="nav-link nav-link--dev"
            title="Bibliothèque de composants (dev)"
            ><Palette :size="20"
          /></RouterLink>
        </nav>
        <RouterLink v-if="user" to="/options" class="nav-user" title="Options">
          <div class="nav-avatar">
            <img
              v-if="user.avatarUrl"
              :src="user.avatarUrl"
              alt="Avatar"
              class="nav-avatar-img"
            />
            <UserCircle v-else :size="22" />
          </div>
          <span class="nav-username">{{ user.username }}</span>
        </RouterLink>
      </div>
    </header>
    <RouterLink v-if="showCombatBanner" :to="activeCombat!.url" class="combat-banner">
      <Swords :size="16" class="banner-icon" />
      <span class="banner-text">Combat en cours</span>
      <span class="banner-action">Retour &rarr;</span>
    </RouterLink>
    <main class="main">
      <RouterView />
    </main>
    <AppToast />
  </div>
</template>

<style scoped>
.boot-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: var(--surface);
  color: var(--muted);
}

.boot-spinner {
  animation: spin 1s linear infinite;
}

/* Combat banner */
.combat-banner {
  flex-shrink: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 1rem;
  background: var(--accent);
  color: white;
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.banner-icon { flex-shrink: 0; }
.banner-text { flex: 1; }

.banner-action {
  font-size: 0.78rem;
  opacity: 0.85;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.boot-text {
  font-family: var(--title-font);
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}

.app-shell {
  --nav-height: 3.6rem;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (min-width: 740px) {
  .app-shell {
    --nav-height: 3.85rem;
  }
}

.top-nav {
  flex-shrink: 0;
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
  gap: 0.5rem;
}

/* ── User pill ──────────────────────────────────────────────────────────── */
.nav-user {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  text-decoration: none;
  padding: 0.22rem 0.6rem 0.22rem 0.28rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-2);
  transition:
    border-color 160ms ease,
    background 160ms ease;
  color: inherit;
  max-width: 160px;
}

.nav-user:hover,
.nav-user.router-link-active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.nav-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--muted);
}

.nav-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nav-username {
  font-family: var(--title-font);
  font-size: 0.97rem;
  font-weight: 700;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 739px) {
  .nav-username {
    display: none;
  }

  .nav-user {
    padding: 0.22rem;
    border-radius: 50%;
    max-width: none;
  }

  .top-nav-actions {
    flex: 1;
    justify-content: space-between;
  }
}

.nav-link {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
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

/* Dev-only entry: tinted so it never gets mistaken for a real feature */
.nav-link--dev {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 45%, transparent);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
}

@media (min-width: 740px) {
  .top-nav {
    padding-inline: 1.35rem;
  }

  .top-nav-actions {
    gap: 0.7rem;
  }

}
</style>

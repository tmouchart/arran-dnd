<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { UserCircle, Loader2, ScrollText, Swords, Backpack, BookOpenText, Map, Palette, Dices, History } from "lucide-vue-next";
import CrystalBall from "./components/icons/CrystalBall.vue";
import AppToast from "./components/ui/AppToast.vue";
import DiceBar from "./components/DiceBar.vue";
import RollLogDrawer from "./components/roll-log/RollLogDrawer.vue";
import { user, authReady } from "./composables/useAuth";
import { useActiveCombat, refreshActiveCombat } from "./composables/useActiveCombat";
import { useDiceBar } from "./composables/useDiceBar";
import { useCampaignRolls } from "./composables/useCampaignRolls";

const isDev = import.meta.env.DEV;
const route = useRoute();
const { activeCombat } = useActiveCombat();
const { diceBarOpen, toggleDiceBar } = useDiceBar();
const {
  unread,
  panelOpen,
  togglePanel,
  connect: connectRolls,
  disconnect: disconnectRolls,
  wake: wakeRolls,
} = useCampaignRolls();

// La barre du bas (dés + log + profil) est en flux mais recouvre le tiroir de
// log : on publie sa hauteur réelle pour que le tiroir s'arrête juste au-dessus.
const bottomDockRef = ref<HTMLElement | null>(null);
const observer = new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty(
    "--bottom-bars",
    `${entry.target.getBoundingClientRect().height}px`,
  );
});
watch(bottomDockRef, (el, prev) => {
  if (prev) observer.unobserve(prev);
  if (el) observer.observe(el);
});
onBeforeUnmount(() => observer.disconnect());

// Resync le combat actif (bannière « Combat en cours ») et branche le log de
// jets sur la campagne active : au login et au retour au premier plan.
watch(user, (u) => {
  if (!u) { disconnectRolls(); return; }
  refreshActiveCombat();
  if (u.activeCampaignId) connectRolls(u.activeCampaignId);
  else disconnectRolls();
}, { immediate: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && user.value) {
    refreshActiveCombat();
    wakeRolls();
  }
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
  <div v-else class="app-shell" :class="{ 'shell-docked': panelOpen }">
    <header class="top-nav">
      <RouterLink to="/personnage" class="brand">Terres d'Arran</RouterLink>
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
    </header>
    <RouterLink v-if="showCombatBanner" :to="activeCombat!.url" class="combat-banner">
      <Swords :size="16" class="banner-icon" />
      <span class="banner-text">Combat en cours</span>
      <span class="banner-action">Retour &rarr;</span>
    </RouterLink>
    <main class="main">
      <RouterView />
    </main>
    <div ref="bottomDockRef" class="bottom-dock">
      <DiceBar />
      <nav class="bottom-nav">
        <div class="bottom-nav-tools">
          <button
            type="button"
            class="nav-link"
            :class="{ 'nav-link--on': diceBarOpen }"
            :title="diceBarOpen ? 'Ranger les dés' : 'Lancer des dés'"
            @click="toggleDiceBar()"
          >
            <Dices :size="20" />
          </button>
          <button
            type="button"
            class="nav-link"
            :class="{ 'nav-link--on': panelOpen }"
            title="Historique des jets"
            @click="togglePanel()"
          >
            <History :size="20" />
            <span v-if="unread > 0 && !panelOpen" class="nav-badge" />
          </button>
        </div>
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
      </nav>
    </div>
    <RollLogDrawer />
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
  /* Réservé par les vues qui posent une barre fixe en bas (footer de combat).
     Sans ça la barre de dés, dernier élément du flux, passerait dessous. */
  padding-bottom: var(--bottom-dock, 0px);
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

/* 7 icônes tiennent tout juste sur un téléphone. Filet de sécurité : on scrolle
   plutôt que de rétrécir les boutons (tous les contrôles restent à 40px). */
@media (max-width: 739px) {
  .nav-links {
    overflow-x: auto;
    scrollbar-width: none;
  }

  .nav-links::-webkit-scrollbar {
    display: none;
  }
}

/* Le tiroir de log est docké sur desktop : il ne recouvre pas le contenu */
@media (min-width: 900px) {
  .shell-docked {
    padding-right: 400px;
  }
}

/* ── Barre du bas ───────────────────────────────────────────────────────── */
/* Outils de séance (dés, log, profil), sous le pouce. Passe au-dessus du
   tiroir de log : on doit pouvoir lancer un dé en lisant l'historique. */
.bottom-dock {
  flex-shrink: 0;
  z-index: 21;
}

.bottom-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  padding-bottom: max(0.55rem, env(safe-area-inset-bottom));
  border-top: 1px solid var(--border-strong);
  background: linear-gradient(
    0deg,
    color-mix(in srgb, var(--surface) 92%, white),
    var(--surface)
  );
}

.bottom-nav-tools {
  display: flex;
  gap: 0.35rem;
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
  flex-shrink: 0;
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

/* Les deux outils de séance sont des <button>, pas des liens */
button.nav-link {
  position: relative;
  padding: 0;
  cursor: pointer;
  font: inherit;
  flex-shrink: 0;
}

/* Pastille « jets non lus » : elle doit se poser sur le coin de l'icône, aucun
   flux ne peut le faire — cas légitime de position: absolute. */
.nav-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-strong);
}

.nav-link--on,
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
  .top-nav,
  .bottom-nav {
    padding-inline: 1.35rem;
  }
}
</style>

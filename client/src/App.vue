<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="top-nav">
      <RouterLink to="/" class="brand">Terres d’Arran</RouterLink>
      <nav class="nav-links">
        <RouterLink to="/" class="nav-link">Assistant</RouterLink>
        <RouterLink to="/personnage" class="nav-link">Personnage</RouterLink>
      </nav>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.brand {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--accent);
  text-decoration: none;
  letter-spacing: 0.02em;
}

.nav-links {
  display: flex;
  gap: 0.25rem;
}

.nav-link {
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.9rem;
}

.nav-link:hover {
  color: var(--text);
  background: var(--surface-2);
}

.nav-link.router-link-active {
  color: var(--text);
  background: var(--surface-2);
}

.main {
  flex: 1;
  padding: 1.25rem 1rem 2rem;
}
</style>

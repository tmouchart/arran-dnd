<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { login } from "../composables/useAuth";

const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

onMounted(() => {
  const pre = route.query.username;
  if (typeof pre === "string" && pre) username.value = pre;
});

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await login(username.value.trim(), password.value);
    router.push("/");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Erreur de connexion";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <h1 class="login-title">Terres d'Arran</h1>
      <p class="login-subtitle">Connecte-toi pour accéder à ta fiche</p>

      <form class="login-form" @submit.prevent="submit">
        <label class="field-label" for="username">Identifiant</label>
        <input
          id="username"
          v-model="username"
          type="text"
          class="field-input"
          autocomplete="username"
          required
        />

        <label class="field-label" for="password">Mot de passe</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="field-input"
          autocomplete="current-password"
          required
        />

        <p v-if="error" class="login-error">{{ error }}</p>

        <button type="submit" class="btn primary login-btn" :disabled="loading">
          {{ loading ? "Connexion…" : "Se connecter" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem 1rem;
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 2rem 1.75rem;
  box-shadow: var(--shadow-card);
}

.login-title {
  font-family: var(--title-font);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--brand-strong);
  margin: 0 0 0.25rem;
}

.login-subtitle {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0 0 1.5rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  margin-top: 0.6rem;
}

.field-input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.95rem;
  transition: border-color 140ms;
}

.field-input:focus {
  outline: none;
  border-color: var(--accent);
}

.login-error {
  color: var(--danger);
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}

.login-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.65rem;
  font-size: 0.95rem;
}
</style>

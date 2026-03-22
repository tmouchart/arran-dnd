<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { login } from "../composables/useAuth";
import { register as apiRegister } from "../api/auth";
import { user } from "../composables/useAuth";

const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const passwordConfirm = ref("");
const error = ref("");
const loading = ref(false);
const mode = ref<"login" | "register">("login");

function firstQueryString(q: unknown): string | undefined {
  if (q == null) return undefined;
  if (Array.isArray(q)) {
    const x = q[0];
    return typeof x === "string" && x ? x : undefined;
  }
  return typeof q === "string" && q ? q : undefined;
}

function applyQueryCredentials() {
  const u = firstQueryString(route.query.username);
  const p = firstQueryString(route.query.password);
  if (u) username.value = u;
  if (p) password.value = p;
  if (u || p) {
    const { username: _u, password: _p, ...rest } = route.query;
    router.replace({ path: route.path, query: rest });
  }
}

watch(() => route.query, applyQueryCredentials, { deep: true, immediate: true });

function switchMode(m: "login" | "register") {
  mode.value = m;
  error.value = "";
  password.value = "";
  passwordConfirm.value = "";
}

async function submit() {
  error.value = "";

  if (mode.value === "register") {
    if (password.value !== passwordConfirm.value) {
      error.value = "Les mots de passe ne correspondent pas";
      return;
    }
    loading.value = true;
    try {
      const u = await apiRegister(username.value.trim(), password.value);
      user.value = u;
      router.push("/");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Erreur lors de la création du compte";
    } finally {
      loading.value = false;
    }
    return;
  }

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

      <div class="mode-tabs">
        <button
          class="mode-tab"
          :class="{ active: mode === 'login' }"
          type="button"
          @click="switchMode('login')"
        >Se connecter</button>
        <button
          class="mode-tab"
          :class="{ active: mode === 'register' }"
          type="button"
          @click="switchMode('register')"
        >Créer un compte</button>
      </div>

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
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          required
        />

        <template v-if="mode === 'register'">
          <label class="field-label" for="password-confirm">Confirmer le mot de passe</label>
          <input
            id="password-confirm"
            v-model="passwordConfirm"
            type="password"
            class="field-input"
            autocomplete="new-password"
            required
          />
        </template>

        <p v-if="error" class="login-error">{{ error }}</p>

        <button type="submit" class="btn primary login-btn" :disabled="loading">
          <template v-if="loading">{{ mode === 'register' ? 'Création…' : 'Connexion…' }}</template>
          <template v-else>{{ mode === 'register' ? 'Créer mon compte' : 'Se connecter' }}</template>
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
  margin: 0 0 1.25rem;
}

.mode-tabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.mode-tab {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  transition: background 140ms, color 140ms;
}

.mode-tab.active {
  background: var(--accent);
  color: #fff;
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

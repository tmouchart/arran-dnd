<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { login } from "../composables/useAuth";
import { register as apiRegister } from "../api/auth";
import { user } from "../composables/useAuth";
import AppInput from "../components/ui/AppInput.vue";
import AppButton from "../components/ui/AppButton.vue";

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

watch(() => route.query, applyQueryCredentials, { deep: true, immediate: true })

watch(
  () => route.query.error,
  (val) => {
    if (val === 'google_failed') error.value = 'La connexion Google a échoué. Réessaie.'
    else if (val === 'google_cancelled') error.value = 'Connexion Google annulée.'
    if (val) {
      const { error: _e, ...rest } = route.query
      router.replace({ path: route.path, query: rest })
    }
  },
  { immediate: true },
)

function loginWithGoogle() {
  window.location.href = '/api/auth/google'
};

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
        <AppInput
          id="username"
          v-model="username"
          autocomplete="username"
          :required="true"
        />

        <label class="field-label" for="password">Mot de passe</label>
        <AppInput
          id="password"
          v-model="password"
          type="password"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          :required="true"
        />

        <template v-if="mode === 'register'">
          <label class="field-label" for="password-confirm">Confirmer le mot de passe</label>
          <AppInput
            id="password-confirm"
            v-model="passwordConfirm"
            type="password"
            autocomplete="new-password"
            :required="true"
          />
        </template>

        <p v-if="error" class="login-error">{{ error }}</p>

        <AppButton type="submit" variant="primary" block :disabled="loading" class="login-btn">
          <template v-if="loading">{{ mode === 'register' ? 'Création…' : 'Connexion…' }}</template>
          <template v-else>{{ mode === 'register' ? 'Créer mon compte' : 'Se connecter' }}</template>
        </AppButton>
      </form>
      <div class="oauth-divider"><span>ou</span></div>

      <button type="button" class="btn google-btn" @click="loginWithGoogle">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Se connecter avec Google
      </button>
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


.login-error {
  color: var(--danger);
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}

:global(:root[data-theme='dark']) .login-btn.btn.primary {
  background: linear-gradient(180deg, #7d6240, #5c4830);
  color: #f2e8dc;
  border-color: color-mix(in srgb, #4a3825 75%, black);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.38);
}

.login-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.65rem;
  font-size: 0.95rem;
}

.oauth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.25rem 0 1rem;
  color: var(--muted);
  font-size: 0.8rem;
}
.oauth-divider::before,
.oauth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.google-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms, border-color 140ms;
}
.google-btn:hover {
  background: var(--surface);
  border-color: var(--accent);
}
</style>

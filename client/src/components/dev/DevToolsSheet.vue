<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Crown, UserCircle, Swords, Sprout } from "lucide-vue-next";
import AppBottomSheet from "../ui/AppBottomSheet.vue";
import AppButton from "../ui/AppButton.vue";
import AppEmptyState from "../ui/AppEmptyState.vue";
import { user } from "../../composables/useAuth";
import { showToast } from "../../composables/useToast";
import * as api from "../../api/dev";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const router = useRouter();
const users = ref<api.DevUser[]>([]);
const presets = ref<api.DevPreset[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    [users.value, presets.value] = await Promise.all([
      api.fetchDevUsers(),
      api.fetchDevPresets(),
    ]);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(() => props.modelValue, (open) => { if (open) load(); });

async function handleSwitch(u: api.DevUser) {
  if (u.id === user.value?.id) return;
  busy.value = true;
  try {
    await api.switchUser(u.id);
    // Reload complet : c'est le seul moyen sûr de repartir d'un état propre
    // (flux SSE, campagne active, fiche en cache) après un changement d'identité.
    window.location.reload();
  } catch (e) {
    showToast((e as Error).message);
    busy.value = false;
  }
}

async function handleSeed() {
  busy.value = true;
  try {
    await api.seedDev();
    showToast("Bac à sable recréé");
    await load();
  } catch (e) {
    showToast((e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function handlePreset(preset: api.DevPreset) {
  const campaignId = user.value?.activeCampaignId;
  if (!campaignId) {
    showToast("Aucune campagne active — choisis-en une d'abord");
    return;
  }
  busy.value = true;
  try {
    const { combatId } = await api.createDevCombat(campaignId, preset.id);
    emit("update:modelValue", false);
    await router.push(`/campagnes/${campaignId}/combat/${combatId}`);
  } catch (e) {
    showToast((e as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppBottomSheet
    :model-value="modelValue"
    title="Outils de dev"
    description="Changer d'identité et créer des combats de test."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>
    <AppEmptyState v-else-if="error" variant="error">{{ error }}</AppEmptyState>

    <template v-else>
      <h3 class="dev-heading">Incarner</h3>
      <div class="dev-users">
        <button
          v-for="u in users"
          :key="u.id"
          type="button"
          class="dev-user"
          :class="{ 'dev-user--on': u.id === user?.id }"
          :disabled="busy"
          @click="handleSwitch(u)"
        >
          <Crown v-if="u.gmOf" :size="16" class="dev-user-icon" />
          <UserCircle v-else :size="16" class="dev-user-icon" />
          <span class="dev-user-name">{{ u.username }}</span>
          <span v-if="u.gmOf" class="dev-user-tag">MJ · {{ u.gmOf }}</span>
        </button>
      </div>

      <h3 class="dev-heading">Combat bidon</h3>
      <p class="dev-note">Dans la campagne active. Le MJ voit tout, un joueur ne voit que sa part.</p>
      <div class="dev-presets">
        <button
          v-for="p in presets"
          :key="p.id"
          type="button"
          class="dev-preset"
          :disabled="busy"
          @click="handlePreset(p)"
        >
          <Swords :size="15" class="dev-preset-icon" />
          <span class="dev-preset-body">
            <span class="dev-preset-label">{{ p.label }}</span>
            <span class="dev-preset-hint">{{ p.hint }}</span>
          </span>
        </button>
      </div>
    </template>

    <template #footer>
      <AppButton variant="ghost" :disabled="busy" @click="handleSeed">
        <Sprout :size="15" /> Recréer le bac à sable
      </AppButton>
    </template>
  </AppBottomSheet>
</template>

<style scoped>
.dev-heading {
  font-family: var(--title-font);
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: var(--space-md) 0 var(--space-sm);
}

.dev-heading:first-child { margin-top: 0; }

.dev-note {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 var(--space-sm);
}

.dev-users {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.dev-user {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: 40px;
  padding: 0 var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-size: 0.88rem;
  cursor: pointer;
}

.dev-user:disabled { opacity: 0.5; cursor: default; }

.dev-user--on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
  cursor: default;
}

.dev-user-icon { flex-shrink: 0; }
.dev-user-name { font-weight: 700; }

.dev-user-tag {
  font-size: 0.74rem;
  color: var(--muted);
}

.dev-presets {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.dev-preset {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  min-height: 40px;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dev-preset:disabled { opacity: 0.5; cursor: default; }
.dev-preset:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); }

.dev-preset-icon { flex-shrink: 0; color: var(--muted); }

.dev-preset-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dev-preset-label { font-weight: 700; font-size: 0.9rem; }
.dev-preset-hint { font-size: 0.76rem; color: var(--muted); }
</style>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Pencil, PencilOff, TrendingUp, Upload, Trash2 } from "lucide-vue-next";
import AppCard from "../ui/AppCard.vue";
import AppInput from "../ui/AppInput.vue";
import AppIconBtn from "../ui/AppIconBtn.vue";
import LevelUpModal from "./LevelUpModal.vue";
import { PEUPLES, PEUPLES_BY_ID, PEUPLE_VOIES_BY_ID } from "../../data/peuples";
import { FAMILY_LABELS, VOIES_BY_ID } from "../../data/voies";
import { MYSTIC_TALENTS } from "../../data/mysticTalents";
import { inferProfileFamily } from "../../utils/inferProfileFamily";
import {
  getProfilesForPeuple,
  findProfileByName,
  FAMILY_LABELS as PROFILE_FAMILY_LABELS,
  type ProfileEntry,
} from "../../data/profilesCatalog";
import type { Character } from "../../types/character";

const props = defineProps<{ character: Character }>();

const histoireVisible = ref(false);
const showLevelUp = ref(false);

// ── Portrait ──────────────────────────────────────────────────────────────────
const portraitInput = ref<HTMLInputElement | null>(null);
const portraitUploading = ref(false);

const portraitUrl = computed(() =>
  props.character.portraitImageId ? `/api/images/${props.character.portraitImageId}` : null
);

function triggerPortraitPick() {
  portraitInput.value?.click();
}

async function handlePortraitChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !file.type.startsWith("image/")) return;
  portraitUploading.value = true;
  try {
    const reader = new FileReader();
    const base64: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch(`/api/characters/${props.character.id}/portrait`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: base64, mimeType: file.type }),
    });
    if (res.ok) {
      const { portraitImageId } = await res.json();
      props.character.portraitImageId = portraitImageId;
    }
  } catch {
    // ignore
  }
  portraitUploading.value = false;
  if (portraitInput.value) portraitInput.value.value = "";
}

async function removePortrait() {
  await fetch(`/api/characters/${props.character.id}/portrait`, {
    method: "DELETE",
    credentials: "include",
  });
  props.character.portraitImageId = null;
}

const inferredProfileFamily = computed(() =>
  inferProfileFamily(props.character.paths),
);

watch(inferredProfileFamily, (fam) => {
  if (fam !== "mystiques") props.character.mysticTalent = "";
});

const availableCultures = computed(() => {
  const peuple = PEUPLES_BY_ID[props.character.people];
  return peuple ? peuple.voiesCulturelles : [];
});

const selectedCultureId = computed(() =>
  props.character.paths.find((p) => p.kind === "culturelle")?.id ?? "",
);

function applyPeupleUserChange(newPeople: string) {
  const c = props.character;
  if (newPeople === c.people) return;
  c.people = newPeople;
  c.profile = "";
  c.paths = c.paths.filter((p) => p.kind !== "peuple" && p.kind !== "culturelle");
  const peuple = PEUPLES_BY_ID[newPeople];
  if (peuple) {
    c.paths.unshift(
      ...peuple.voiesDePeuple.map((v) => ({ id: v.id, name: v.name, rank: 0, kind: "peuple" as const })),
    );
  }
}

function selectCulture(id: string) {
  const c = props.character;
  c.paths = c.paths.filter((p) => p.kind !== "culturelle");
  if (!id) return;
  const voie = PEUPLE_VOIES_BY_ID[id];
  if (!voie) return;
  const lastPeupleIdx = c.paths.reduce((last, p, i) => (p.kind === "peuple" ? i : last), -1);
  c.paths.splice(lastPeupleIdx + 1, 0, {
    id: voie.id,
    name: voie.name,
    rank: 0,
    kind: "culturelle" as const,
  });
}

// ── Profile select & auto-apply ───────────────────────────────────────────────

const profileGroups = computed(() => {
  const profiles = getProfilesForPeuple(props.character.people);
  if (!profiles.length) return [];
  const families = ["combattants", "aventuriers", "mystiques"] as const;
  return families
    .map((fam) => ({
      family: fam,
      label: PROFILE_FAMILY_LABELS[fam],
      profiles: profiles.filter((p) => p.family === fam),
    }))
    .filter((g) => g.profiles.length > 0);
});

const profileSelectValue = computed(() => props.character.profile);

/** Remove profile-applied voies (those without kind, added by previous profile). */
function clearProfileVoies() {
  props.character.paths = props.character.paths.filter((p) => p.kind !== undefined);
}

function applyProfile(entry: ProfileEntry) {
  const c = props.character;

  // 1. Remove previously applied profile voies (kind === undefined = profile/manual voies)
  clearProfileVoies();

  // 2. Add voies from the profile (skip already-present ones)
  const existingIds = new Set(c.paths.map((p) => p.id).filter(Boolean));
  for (const voieId of entry.voieIds) {
    if (existingIds.has(voieId)) continue;
    const voieData = VOIES_BY_ID[voieId];
    if (!voieData) continue;
    c.paths.push({ id: voieData.id, name: voieData.name, rank: 0 });
  }

  // 3. Apply martial formations (union — don't remove existing ones)
  for (const fid of entry.martialFormations) {
    if (!c.martialFormations.includes(fid)) {
      c.martialFormations.push(fid);
    }
  }
}

function onProfileSelect(value: string) {
  props.character.profile = value;
  if (!value) return;
  const entry = findProfileByName(value);
  if (entry) applyProfile(entry);
}
</script>

<template>
  <AppCard title="Identité" class="identity">
    <input ref="portraitInput" type="file" accept="image/*" hidden @change="handlePortraitChange" />
    <div class="identity-top">
      <div class="identity-top-fields">
        <label class="field field-name">
          <span>Nom</span>
          <AppInput v-model="character.name" />
        </label>
        <div class="field field-level">
          <span>Niveau</span>
          <div class="level-row">
            <AppInput v-model="character.level" type="number" :min="1" class="narrow" />
            <button type="button" class="levelup-btn" title="Monter en niveau" @click="showLevelUp = true">
              <TrendingUp :size="15" />
            </button>
          </div>
        </div>
      </div>
      <div class="portrait-wrapper">
        <div class="portrait" :class="{ 'portrait--empty': !portraitUrl }" @click="triggerPortraitPick">
          <img v-if="portraitUrl" :src="portraitUrl" alt="Portrait" class="portrait-img" />
          <Upload v-else :size="20" class="portrait-placeholder" />
          <div v-if="portraitUploading" class="portrait-loading">…</div>
        </div>
        <button v-if="portraitUrl" type="button" class="portrait-remove-btn" title="Supprimer" @click="removePortrait">
          <Trash2 :size="11" />
        </button>
      </div>
    </div>
    <div class="grid-2">
      <div class="field">
        <span>Peuple</span>
        <select
          class="input select"
          :value="character.people"
          @change="applyPeupleUserChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">— Choisir —</option>
          <option v-for="p in PEUPLES" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div v-if="availableCultures.length" class="field">
        <span>Voie culturelle</span>
        <select
          :value="selectedCultureId"
          class="input select"
          @change="selectCulture(($event.target as HTMLSelectElement).value)"
        >
          <option value="">— Choisir —</option>
          <option v-for="c in availableCultures" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <!-- Profil : liste déroulante groupée par famille si le peuple est choisi -->
      <div class="field">
        <span>Profil</span>
        <template v-if="profileGroups.length">
          <select
            class="input select"
            :value="profileSelectValue"
            @change="onProfileSelect(($event.target as HTMLSelectElement).value)"
          >
            <option value="">— Choisir —</option>
            <optgroup v-for="g in profileGroups" :key="g.family" :label="g.label">
              <option v-for="p in g.profiles" :key="p.id" :value="p.name">{{ p.name }}</option>
            </optgroup>
          </select>
          <p v-if="character.profile" class="profile-hint">
            ✓ Voies et formations pré-sélectionnées
          </p>
        </template>
        <template v-else>
          <AppInput v-model="character.profile" placeholder="Saisir un profil" />
        </template>
      </div>

      <div class="field">
        <span>Famille du profil</span>
        <div class="field-readonly input" :class="'family-' + inferredProfileFamily">
          {{ FAMILY_LABELS[inferredProfileFamily] }}
        </div>
      </div>
      <div v-if="inferredProfileFamily === 'mystiques'" class="field span-2">
        <span>Talent magique</span>
        <select v-model="character.mysticTalent" class="input select">
          <option value="">— Choisir —</option>
          <option v-for="t in MYSTIC_TALENTS" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>

      <!-- Histoire avec toggle affiché/caché -->
      <div class="field span-2 histoire-block">
        <div class="histoire-field-head">
          <span>Histoire</span>
          <button
            type="button"
            class="histoire-expand-btn"
            :aria-expanded="histoireVisible"
            :aria-label="histoireVisible ? 'Cacher l\'histoire' : 'Afficher l\'histoire'"
            :title="histoireVisible ? 'Cacher' : 'Afficher'"
            @click="histoireVisible = !histoireVisible"
          >
            <PencilOff v-if="histoireVisible" :size="16" :stroke-width="2" />
            <Pencil v-else :size="16" :stroke-width="2" />
          </button>
        </div>
        <textarea
          v-if="histoireVisible"
          v-model="character.histoire"
          class="input input-textarea"
          :rows="8"
          placeholder="L'histoire de ton personnage…"
        />
        <p v-else class="histoire-hidden-hint">
          {{ character.histoire ? character.histoire.slice(0, 60) + (character.histoire.length > 60 ? '…' : '') : 'Aucune histoire renseignée.' }}
        </p>
      </div>
    </div>
  </AppCard>

  <LevelUpModal
    v-model:show="showLevelUp"
    :character="character"
    @confirm="() => {}"
  />
</template>

<style scoped>
.identity-top {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
}

.identity-top-fields {
  flex: 1;
  display: flex;
  gap: 0.65rem;
  min-width: 0;
}

.field-name {
  flex: 1;
  min-width: 0;
}

.field-level {
  flex-shrink: 0;
}

.portrait-wrapper {
  position: relative;
  flex-shrink: 0;
}

.portrait {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  border: 2px solid var(--border);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  transition: border-color 150ms;
}

.portrait:hover {
  border-color: var(--accent);
}

.portrait--empty {
  border-style: dashed;
}

.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portrait-placeholder {
  color: var(--muted);
  opacity: 0.5;
}

.portrait-loading {
  position: absolute;
  font-size: 0.8rem;
  color: var(--muted);
}

.portrait-remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--danger);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 120ms, border-color 120ms;
}

.portrait-remove-btn:hover {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

@media (min-width: 520px) {
  .grid-2 {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 0.95rem;
  }
  .grid-2 .span-2 {
    grid-column: 1 / -1;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  font-size: 0.83rem;
  color: var(--muted);
}

.field > span:first-child {
  font-weight: 600;
}

.field-readonly.input {
  display: flex;
  align-items: center;
  font-weight: 600;
  cursor: default;
}

.narrow {
  max-width: 6rem;
}

.level-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.levelup-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-strong);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, transform 100ms ease;
}

.levelup-btn:hover {
  background: var(--accent);
  color: #fff;
  transform: translateY(-1px);
}

.levelup-btn:active {
  transform: translateY(0);
}

.input.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
  cursor: pointer;
}

.profile-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--accent-strong);
  font-style: italic;
}

.field.histoire-block {
  gap: 0.4rem;
}

.histoire-field-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.histoire-field-head > span {
  font-size: 0.83rem;
  color: var(--muted);
  font-weight: 600;
}

.histoire-expand-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.histoire-expand-btn:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-strong);
}

.histoire-hidden-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
  font-style: italic;
  padding: 0.3rem 0;
}

.input-textarea {
  width: 100%;
  min-height: 5.5rem;
  line-height: 1.45;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
  font-size: inherit;
}

.family-combattants { background: color-mix(in srgb, var(--brand) 16%, transparent); color: var(--brand-strong); }
.family-aventuriers { background: color-mix(in srgb, #3a8a4a 14%, transparent); color: #2a6a38; }
.family-mystiques { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent-strong); }
.family-prestige { background: color-mix(in srgb, #8a6a20 14%, transparent); color: #5c4510; }

:root[data-theme="dark"] .family-aventuriers { color: #7bcf8a; }
:root[data-theme="dark"] .family-prestige { color: #d4a843; }
</style>

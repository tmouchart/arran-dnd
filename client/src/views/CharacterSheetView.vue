<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { CirclePlus, CircleMinus, ChevronsDownUp } from "lucide-vue-next";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import {
  VOIES,
  VOIES_BY_ID,
  FAMILY_LABELS,
  FAMILY_ORDER,
  type Voie,
} from "../data/voies";
import {
  PEUPLES,
  PEUPLES_BY_ID,
  PEUPLE_VOIES_BY_ID,
  type PeupleVoie,
} from "../data/peuples";
import type { PathRow, WeaponRow } from "../types/character";
import { MYSTIC_TALENTS } from "../data/mysticTalents";
import { inferProfileFamily } from "../utils/inferProfileFamily";
import type { MartialWeaponCategoryId } from "../data/martialWeaponCategories";
import {
  MARTIAL_WEAPON_CATEGORIES,
  MARTIAL_FORMATION_SELECTABLE_IDS,
  MARTIAL_WEAPON_CATEGORY_BY_ID,
} from "../data/martialWeaponCategories";
import { WEAPONS_CATALOG } from "../data/weaponsCatalog";

const { character, loading, loadError, saveStatus, abilityModifier } =
  useCharacter();
const route = useRoute();

const id = route.query.id ? Number(route.query.id) : undefined;
loadCharacter(id);

function retryLoadSheet() {
  loadCharacter(id);
}

/** Toggle textarea row count (default 3 lines; expanded for long backstory). */
const histoireExpanded = ref(false);

// ── Ability list ──────────────────────────────────────────────────────────
const abilityList = computed(() => [
  { key: "strength" as const, label: "FOR" },
  { key: "dexterity" as const, label: "DEX" },
  { key: "constitution" as const, label: "CON" },
  { key: "intelligence" as const, label: "INT" },
  { key: "wisdom" as const, label: "SAG" },
  { key: "charisma" as const, label: "CHA" },
]);

// ── Voies — points ────────────────────────────────────────────────────────
const totalPoints = computed(() => character.value.level * 2);

function rankCost(rank: number): number {
  // cumulative cost to reach rank r: r≤2 costs 1pt each, r 3-5 cost 2pts each
  return rank <= 2 ? rank : 2 + (rank - 2) * 2;
}

const spentPoints = computed(() =>
  character.value.paths.reduce((sum, p) => sum + rankCost(p.rank), 0),
);

const remainingPoints = computed(() => totalPoints.value - spentPoints.value);

function incrementCost(currentRank: number): number {
  return currentRank < 2 ? 1 : 2;
}

function canIncrease(p: PathRow): boolean {
  return p.rank < 5 && remainingPoints.value >= incrementCost(p.rank);
}

function increaseRank(p: PathRow) {
  if (canIncrease(p)) p.rank++;
}

function decreaseRank(p: PathRow) {
  if (p.rank > 0) p.rank--;
}

function removePath(i: number) {
  character.value.paths.splice(i, 1);
}

// ── Voies — expand/collapse ───────────────────────────────────────────────
const expandedSet = ref<Set<number>>(new Set());

function toggleExpand(i: number) {
  const next = new Set(expandedSet.value);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  expandedSet.value = next;
}

// ── Voie picker ───────────────────────────────────────────────────────────
const showPicker = ref(false);

const inferredProfileFamily = computed(() =>
  inferProfileFamily(character.value.paths),
);

watch(inferredProfileFamily, (fam) => {
  if (fam !== "mystiques") character.value.mysticTalent = "";
});

const pickerByFamily = computed(() =>
  FAMILY_ORDER.map((family) => ({
    family,
    label: FAMILY_LABELS[family],
    voies: VOIES.filter(
      (v) =>
        v.family === family &&
        !character.value.paths.find((p) => p.id === v.id),
    ),
  })).filter((g) => g.voies.length > 0),
);

function addPath(voie: Voie) {
  character.value.paths.push({ id: voie.id, name: voie.name, rank: 0 });
  showPicker.value = false;
}

// ── Formations martiales & armes ─────────────────────────────────────────
const catalogPick = ref("");

const weaponsCatalogSorted = computed(() =>
  [...WEAPONS_CATALOG].sort((a, b) => a.name.localeCompare(b.name, "fr")),
);

function toggleMartialFormation(id: MartialWeaponCategoryId) {
  if (id === "paysan") return;
  const a = character.value.martialFormations;
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1);
  else a.push(id);
}

function hasMartialFormation(id: MartialWeaponCategoryId): boolean {
  return character.value.martialFormations.includes(id);
}

function weaponRowFromCatalog(
  entry: (typeof WEAPONS_CATALOG)[number],
): WeaponRow {
  return {
    id: crypto.randomUUID(),
    name: entry.name,
    attackType: entry.attackType,
    damageDice: entry.damageDice,
    damageAbility: entry.damageAbility,
    martialFamily: entry.martialFamily,
    rangeMeters: entry.rangeMeters,
    catalogId: entry.id,
    notes: entry.notes,
  };
}

function onCatalogWeaponChange() {
  const id = catalogPick.value;
  if (!id) return;
  const entry = WEAPONS_CATALOG.find((w) => w.id === id);
  if (!entry) return;
  character.value.weapons.push(weaponRowFromCatalog(entry));
  catalogPick.value = "";
}

function addCustomWeapon() {
  character.value.weapons.push({
    id: crypto.randomUUID(),
    name: "",
    attackType: "contact",
    damageDice: "1d6",
    damageAbility: "strength",
    martialFamily: "guerre",
    rangeMeters: null,
  });
}

function removeWeapon(i: number) {
  character.value.weapons.splice(i, 1);
}

function setDamageAbilityFromSelect(w: WeaponRow, v: string) {
  if (v === "") w.damageAbility = null;
  else if (v === "strength" || v === "dexterity") w.damageAbility = v;
}

function damageAbilitySelectValue(w: WeaponRow): string {
  return w.damageAbility ?? "";
}

// ── Voie display helper ───────────────────────────────────────────────────
const ALL_VOIES_BY_ID = { ...VOIES_BY_ID, ...PEUPLE_VOIES_BY_ID } as Record<
  string,
  Voie | PeupleVoie
>;

function voieData(p: PathRow): Voie | PeupleVoie | null {
  return p.id ? (ALL_VOIES_BY_ID[p.id] ?? null) : null;
}

/** Unlocked passive capacities (`active: false`) on the sheet, for quick reference. */
const passiveAbilities = computed(() => {
  const out: {
    key: string;
    pathName: string;
    name: string;
    description: string;
  }[] = [];
  character.value.paths.forEach((p, pi) => {
    const vd = voieData(p);
    if (!vd || p.rank <= 0) return;
    vd.capacites.forEach((cap, ci) => {
      if (p.rank > ci && cap.active === false) {
        out.push({
          key: `${p.id ?? `p${pi}`}-${ci}`,
          pathName: p.name,
          name: cap.name,
          description: cap.description,
        });
      }
    });
  });
  return out;
});

// ── Peuple & voie culturelle ──────────────────────────────────────────────
const availableCultures = computed(() => {
  const peuple = PEUPLES_BY_ID[character.value.people];
  return peuple ? peuple.voiesCulturelles : [];
});

/** Id de la voie culturelle actuellement choisie (dérivé des paths). */
const selectedCultureId = computed(() => {
  return character.value.paths.find((p) => p.kind === "culturelle")?.id ?? "";
});

/**
 * Réagit au choix du peuple dans l’UI uniquement (pas à l’hydratation depuis l’API).
 * Un `watch` sur `people` effaçait voie culturelle + rangs au reload ("" → peuple sauvegardé).
 */
function applyPeupleUserChange(newPeople: string) {
  const oldPeople = character.value.people;
  if (newPeople === oldPeople) return;
  character.value.people = newPeople;
  // Retire les anciennes voies de peuple et culturelle
  character.value.paths = character.value.paths.filter(
    (p) => p.kind !== "peuple" && p.kind !== "culturelle",
  );
  const peuple = PEUPLES_BY_ID[newPeople];
  if (peuple) {
    const toAdd = peuple.voiesDePeuple.map((v) => ({
      id: v.id,
      name: v.name,
      rank: 0,
      kind: "peuple" as const,
    }));
    character.value.paths.unshift(...toAdd);
  }
}

function selectCulture(id: string) {
  // Retire l'ancienne voie culturelle
  character.value.paths = character.value.paths.filter(
    (p) => p.kind !== "culturelle",
  );
  if (!id) return;
  const voie = PEUPLE_VOIES_BY_ID[id];
  if (!voie) return;
  // Insère après la/les voies de peuple
  const lastPeupleIdx = character.value.paths.reduce(
    (last, p, i) => (p.kind === "peuple" ? i : last),
    -1,
  );
  character.value.paths.splice(lastPeupleIdx + 1, 0, {
    id: voie.id,
    name: voie.name,
    rank: 0,
    kind: "culturelle" as const,
  });
}
</script>

<template>
  <div class="page sheet-page">
    <header class="page-head">
      <div class="page-head-row">
        <h1>Fiche personnage</h1>
        <RouterLink to="/personnages" class="btn ghost small"
          >← Liste</RouterLink
        >
      </div>

      <p v-if="saveStatus === 'error'" class="save-status error">
        Erreur de sauvegarde
      </p>
    </header>

    <div v-if="loading" class="loading-msg">Chargement…</div>

    <div v-else-if="loadError" class="load-error sheet-load-error">
      <p>{{ loadError }}</p>
      <button type="button" class="btn ghost small" @click="retryLoadSheet">
        Réessayer
      </button>
    </div>

    <template v-else>
      <!-- Identité -->
      <section class="card identity">
        <h2>Identité</h2>
        <div class="grid-2">
          <label class="field">
            <span>Nom</span>
            <input v-model="character.name" type="text" class="input" />
          </label>
          <label class="field">
            <span>Niveau</span>
            <input
              v-model.number="character.level"
              type="number"
              min="1"
              class="input narrow"
            />
          </label>
          <label class="field">
            <span>Profil</span>
            <input v-model="character.profile" type="text" class="input" />
          </label>
          <div class="field">
            <span>Peuple</span>
            <select
              class="input select"
              :value="character.people"
              @change="
                applyPeupleUserChange(
                  ($event.target as HTMLSelectElement).value,
                )
              "
            >
              <option value="">— Choisir —</option>
              <option v-for="p in PEUPLES" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>
          <div class="field">
            <span>Famille du profil</span>
            <div
              class="field-readonly input"
              :class="'family-' + inferredProfileFamily"
            >
              {{ FAMILY_LABELS[inferredProfileFamily] }}
            </div>
          </div>
          <div
            v-if="inferredProfileFamily === 'mystiques'"
            class="field span-2"
          >
            <span>Talent magique</span>
            <select v-model="character.mysticTalent" class="input select">
              <option value="">— Choisir —</option>
              <option v-for="t in MYSTIC_TALENTS" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </div>
          <div v-if="availableCultures.length" class="field span-2">
            <span>Voie culturelle</span>
            <select
              :value="selectedCultureId"
              class="input select"
              @change="
                selectCulture(($event.target as HTMLSelectElement).value)
              "
            >
              <option value="">— Choisir —</option>
              <option v-for="c in availableCultures" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>
          <div class="field span-2 histoire-block">
            <div class="histoire-field-head">
              <span>Histoire</span>
              <button
                type="button"
                class="histoire-expand-btn"
                :aria-expanded="histoireExpanded"
                :aria-label="
                  histoireExpanded
                    ? 'Réduire le champ histoire'
                    : 'Agrandir le champ histoire'
                "
                @click="histoireExpanded = !histoireExpanded"
              >
                <ChevronsDownUp :size="18" :stroke-width="2" />
              </button>
            </div>
            <textarea
              v-model="character.histoire"
              class="input input-textarea"
              :rows="histoireExpanded ? 12 : 3"
            />
          </div>
        </div>
      </section>

      <!-- PV & Ressources -->
      <section class="card resources">
        <h2>PV &amp; ressources</h2>
        <div class="bars">
          <div class="bar-block">
            <div class="bar-label">
              <span>Points de vie</span>
              <div class="stat-stepper">
                <button
                  type="button"
                  class="stepper-btn"
                  @click="character.hpMax = Math.max(1, character.hpMax - 1)"
                >
                  <CircleMinus :size="18" />
                </button>
                <span class="nums">{{ character.hpMax }}</span>
                <button
                  type="button"
                  class="stepper-btn"
                  @click="character.hpMax++"
                >
                  <CirclePlus :size="18" />
                </button>
              </div>
            </div>
            <div class="bar-track">
              <div class="bar-fill hp" style="width: 100%" />
            </div>
          </div>
          <div class="bar-block">
            <div class="bar-label">
              <span>Points de mana</span>
              <div class="stat-stepper">
                <button
                  type="button"
                  class="stepper-btn"
                  @click="character.mpMax = Math.max(0, character.mpMax - 1)"
                >
                  <CircleMinus :size="18" />
                </button>
                <span class="nums">{{ character.mpMax }}</span>
                <button
                  type="button"
                  class="stepper-btn"
                  @click="character.mpMax++"
                >
                  <CirclePlus :size="18" />
                </button>
              </div>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill mp"
                :style="{ width: character.mpMax > 0 ? '100%' : '0%' }"
              />
            </div>
          </div>
        </div>
        <div class="grid-2 tight">
          <label class="field">
            <span>Défense</span>
            <input
              v-model.number="character.defense"
              type="number"
              class="input narrow"
            />
          </label>
          <div class="field">
            <span>Initiative</span>
            <div class="initiative-row">
              <div
                class="initiative-readonly"
                title="Score de base = DEX (Terres d’Arran). Armure et capacités peuvent le modifier en combat."
              >
                {{ character.abilities.dexterity }}
              </div>
              <span class="field-hint">= DEX</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Caractéristiques -->
      <section class="card">
        <h2>Caractéristiques</h2>
        <div class="abilities">
          <div v-for="a in abilityList" :key="a.key" class="ability">
            <span class="abil-label">{{ a.label }}</span>
            <input
              v-model.number="character.abilities[a.key]"
              type="number"
              class="input score"
            />
            <span class="mod">
              {{ abilityModifier(character.abilities[a.key]) >= 0 ? "+" : ""
              }}{{ abilityModifier(character.abilities[a.key]) }}
            </span>
          </div>
        </div>
      </section>

      <!-- Voies -->
      <section class="card voies-section">
        <div class="card-head">
          <div class="voies-title-block">
            <h2>Voies</h2>
            <span class="pts-badge" :class="{ depleted: remainingPoints <= 0 }">
              {{ spentPoints }} / {{ totalPoints }} pts
            </span>
          </div>
          <button
            type="button"
            class="btn ghost small"
            @click="showPicker = true"
          >
            + Ajouter
          </button>
        </div>

        <ul v-if="character.paths.length" class="voie-list">
          <li v-for="(p, i) in character.paths" :key="i" class="voie-card">
            <!-- Header row -->
            <div class="voie-header" @click="toggleExpand(i)">
              <div class="voie-name-block">
                <span class="voie-name">{{ p.name }}</span>
                <span v-if="p.kind === 'peuple'" class="voie-kind-badge peuple"
                  >Peuple</span
                >
                <span
                  v-else-if="p.kind === 'culturelle'"
                  class="voie-kind-badge culturelle"
                  >Culture</span
                >
              </div>
              <div class="voie-rank-controls">
                <span class="voie-dots">
                  <span
                    v-for="dot in 5"
                    :key="dot"
                    class="dot"
                    :class="{ filled: p.rank >= dot }"
                  />
                </span>
                <div class="voie-controls" @click.stop>
                  <button
                    type="button"
                    class="rank-btn"
                    :disabled="p.rank <= 0"
                    @click="decreaseRank(p)"
                    title="Réduire le rang"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    class="rank-btn"
                    :disabled="!canIncrease(p)"
                    @click="increaseRank(p)"
                    title="Augmenter le rang"
                  >
                    +
                  </button>
                  <button
                    v-if="!p.kind"
                    type="button"
                    class="remove-btn"
                    @click="removePath(i)"
                    title="Retirer cette voie"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <!-- Expanded capacités -->
            <ul v-if="expandedSet.has(i)" class="capacite-list">
              <template v-if="voieData(p)">
                <li
                  v-for="(cap, ci) in voieData(p)!.capacites"
                  :key="ci"
                  class="capacite"
                  :class="{ unlocked: p.rank > ci, locked: p.rank <= ci }"
                >
                  <span class="cap-rank">{{ ci + 1 }}</span>
                  <span class="cap-body">
                    <span class="cap-name">{{ cap.name }}</span>
                    <span class="cap-desc">{{ cap.description }}</span>
                  </span>
                </li>
              </template>
              <template v-else>
                <li class="capacite muted-cap">
                  Capacités non disponibles pour cette voie.
                </li>
              </template>
            </ul>
          </li>
        </ul>
        <p v-else class="muted">Choisis tes voies en cliquant sur "Ajouter".</p>
      </section>

      <!-- Passifs (capacités débloquées avec active: false) -->
      <section v-if="passiveAbilities.length" class="card passifs-section">
        <div class="card-head">
          <h2>Passifs</h2>
        </div>
        <ul class="passif-list">
          <li
            v-for="passif in passiveAbilities"
            :key="passif.key"
            class="passif-card"
          >
            <div class="passif-top">
              <span class="passif-name">{{ passif.name }}</span>
              <span class="passif-path-tag">{{ passif.pathName }}</span>
            </div>
            <p class="passif-desc">{{ passif.description }}</p>
          </li>
        </ul>
      </section>

      <!-- Formations martiales -->
      <section class="card">
        <div class="card-head">
          <h2>Formations martiales</h2>
        </div>
        <ul class="formation-list">
          <li class="formation-row">
            <label class="formation-label">
              <input type="checkbox" checked disabled class="formation-cb" />
              <span>{{ MARTIAL_WEAPON_CATEGORY_BY_ID.paysan }}</span>
            </label>
            <span class="formation-note">Toujours actif</span>
          </li>
          <li
            v-for="fid in MARTIAL_FORMATION_SELECTABLE_IDS"
            :key="fid"
            class="formation-row"
          >
            <label class="formation-label">
              <input
                type="checkbox"
                class="formation-cb"
                :checked="hasMartialFormation(fid)"
                @change="toggleMartialFormation(fid)"
              />
              <span>{{ MARTIAL_WEAPON_CATEGORY_BY_ID[fid] }}</span>
            </label>
          </li>
        </ul>
      </section>

      <!-- Armes (livre + perso) -->
      <section class="card">
        <div class="card-head">
          <h2>Armes</h2>
          <div class="card-head-actions">
            <select
              v-model="catalogPick"
              class="input select weapon-catalog-select"
              @change="onCatalogWeaponChange"
            >
              <option value="">Ajouter depuis le livre</option>
              <option
                v-for="w in weaponsCatalogSorted"
                :key="w.id"
                :value="w.id"
              >
                {{ w.name }}
              </option>
            </select>
            <button
              type="button"
              class="btn ghost small"
              @click="addCustomWeapon"
            >
              + Perso
            </button>
          </div>
        </div>
        <ul v-if="character.weapons.length" class="weapon-sheet-list">
          <li
            v-for="(w, wi) in character.weapons"
            :key="w.id"
            class="weapon-sheet-card"
          >
            <input
              v-model="w.name"
              type="text"
              class="input"
              placeholder="Nom de l’arme"
            />
            <div class="grid-2 tight">
              <label class="field">
                <span>Type</span>
                <select v-model="w.attackType" class="input select">
                  <option value="contact">Contact</option>
                  <option value="distance">Distance</option>
                </select>
              </label>
              <label class="field">
                <span>Catégorie martiale</span>
                <select v-model="w.martialFamily" class="input select">
                  <option
                    v-for="c in MARTIAL_WEAPON_CATEGORIES"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.label }}
                  </option>
                </select>
              </label>
            </div>
            <div class="grid-2 tight">
              <label class="field">
                <span>Dés de dégâts</span>
                <input
                  v-model="w.damageDice"
                  type="text"
                  class="input"
                  placeholder="1d8"
                />
              </label>
              <label class="field">
                <span>Mod. dégâts</span>
                <select
                  class="input select"
                  :value="damageAbilitySelectValue(w)"
                  @change="
                    setDamageAbilityFromSelect(
                      w,
                      ($event.target as HTMLSelectElement).value,
                    )
                  "
                >
                  <option value="">Aucun (—)</option>
                  <option value="strength">FOR</option>
                  <option value="dexterity">DEX</option>
                </select>
              </label>
            </div>
            <div class="grid-2 tight">
              <label class="field">
                <span>Portée (m)</span>
                <input
                  :value="w.rangeMeters ?? ''"
                  type="number"
                  min="0"
                  step="1"
                  class="input"
                  placeholder="—"
                  @input="
                    w.rangeMeters =
                      ($event.target as HTMLInputElement).value === ''
                        ? null
                        : Number(($event.target as HTMLInputElement).value)
                  "
                />
              </label>
              <label class="field">
                <span>Notes</span>
                <input
                  v-model="w.notes"
                  type="text"
                  class="input"
                  placeholder="Optionnel"
                />
              </label>
            </div>
            <button
              type="button"
              class="btn ghost small"
              @click="removeWeapon(wi)"
            >
              Retirer
            </button>
          </li>
        </ul>
        <p v-else class="muted">Aucune arme listée.</p>
      </section>
    </template>
  </div>

  <!-- Voie picker overlay -->
  <Teleport to="body">
    <div
      v-if="showPicker"
      class="picker-overlay"
      @click.self="showPicker = false"
    >
      <div class="picker-panel">
        <div class="picker-head">
          <h3>Choisir une voie</h3>
          <button
            type="button"
            class="btn ghost small"
            @click="showPicker = false"
          >
            ✕
          </button>
        </div>
        <div class="picker-body">
          <div
            v-for="group in pickerByFamily"
            :key="group.family"
            class="picker-group"
          >
            <h4 class="picker-family" :class="'family-' + group.family">
              {{ group.label }}
            </h4>
            <ul class="picker-voies">
              <li
                v-for="v in group.voies"
                :key="v.id"
                class="picker-voie"
                @click="addPath(v)"
              >
                {{ v.name }}
              </li>
            </ul>
          </div>
          <p v-if="pickerByFamily.length === 0" class="muted picker-empty">
            Toutes les voies sont déjà ajoutées.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-page {
  max-width: 40rem;
  margin: 0 auto;
}

.page-head {
  margin-bottom: 0.9rem;
}

.page-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.4rem;
}

.page-head h1 {
  margin: 0;
  font-size: clamp(1.35rem, 4.5vw, 1.95rem);
  font-family: var(--title-font);
  color: var(--brand-strong);
}

.loading-msg {
  color: var(--muted);
  font-size: 0.95rem;
  padding: 2rem 0;
  text-align: center;
}

.sheet-load-error {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
  background: color-mix(in srgb, var(--danger) 8%, var(--surface));
  color: var(--text);
  font-size: 0.92rem;
  line-height: 1.45;
}

.sheet-load-error p {
  margin: 0 0 0.75rem;
}

.save-status {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
}
.save-status.saving {
  color: var(--muted);
}
.save-status.error {
  color: var(--danger);
}

/* ── Cards ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 0.95rem;
  margin-bottom: 0.85rem;
  box-shadow: var(--shadow-card);
}

.card h2 {
  font-size: 1.02rem;
  margin: 0 0 0.8rem;
  font-weight: 600;
  font-family: var(--title-font);
  color: var(--accent-strong);
  letter-spacing: 0.01em;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  gap: 0.6rem;
}

.card-head h2 {
  margin: 0;
}

/* ── Grid ── */
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

.grid-2.tight {
  margin-top: 0.7rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  font-size: 0.83rem;
  color: var(--muted);
}

/* ── Inputs ── */
.input {
  min-height: 42px;
  padding: 0.5rem 0.64rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: inherit;
}

.field-readonly.input {
  display: flex;
  align-items: center;
  font-weight: 600;
  cursor: default;
}

.input.narrow {
  max-width: 6rem;
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
}

.histoire-expand-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
}

.histoire-expand-btn:hover {
  background: var(--surface-1);
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

.initiative-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: nowrap;
}

.initiative-readonly {
  display: flex;
  align-items: center;
  min-height: 42px;
  max-width: 6rem;
  padding: 0.5rem 0.64rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: default;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--muted);
}

.input.score {
  width: 3.5rem;
  text-align: center;
  font-size: 1.1rem;
}

/* ── Bars ── */
.bars {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.87rem;
  margin-bottom: 0.35rem;
  gap: 0.45rem;
}

.nums {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.bar-track {
  height: 12px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
  border: 1px solid var(--border);
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease;
}

.bar-fill.hp {
  background: linear-gradient(90deg, #8d3c3c, #c95f56);
}
.bar-fill.mp {
  background: linear-gradient(90deg, #425f8f, #678fc2);
}

.stat-stepper {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.stepper-btn:hover {
  color: var(--accent-strong);
}

/* ── Abilities ── */
.abilities {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
  gap: 0.75rem;
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
}

.abil-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.mod {
  font-size: 0.9rem;
  color: var(--accent-strong);
  font-weight: 600;
}

/* ── Voies section ── */
.voies-title-block {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.pts-badge {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}

.pts-badge.depleted {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
}

.voie-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.voie-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
  overflow: hidden;
}

/* Header row */
.voie-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem 0.75rem;
  padding: 0.62rem 0.75rem;
  cursor: pointer;
  user-select: none;
  transition: background 120ms ease;
}

.voie-header:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, transparent);
}

.voie-name-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  flex: 1 1 auto;
  min-width: 0;
}

.voie-rank-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem 0.55rem;
  flex: 0 1 auto;
  min-width: 0;
}

.voie-name {
  font-family: var(--title-font);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--brand-strong);
  min-width: 0;
  overflow-wrap: anywhere;
}

.voie-dots {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  background: transparent;
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.dot.filled {
  background: var(--brand);
  border-color: var(--brand-strong);
}

/* Rank +/− controls */
.voie-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex: 0 0 auto;
}

@media (max-width: 699px) {
  .voie-name-block {
    flex: 1 1 100%;
  }

  .voie-rank-controls {
    flex: 1 1 100%;
    justify-content: flex-end;
  }
}

@media (min-width: 700px) {
  .voie-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.rank-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 120ms ease,
    border-color 120ms ease;
  padding: 0;
  line-height: 1;
}

.rank-btn:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.rank-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.remove-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 120ms ease,
    color 120ms ease;
  padding: 0;
  line-height: 1;
}

.remove-btn:hover {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

/* Capacités list */
.capacite-list {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0.75rem 0.62rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border-top: 1px solid var(--border);
}

.capacite {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.28rem 0;
  transition: opacity 150ms ease;
}

.capacite.locked {
  opacity: 0.52;
}

.cap-rank {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  min-width: 1rem;
  text-align: center;
  flex-shrink: 0;
  padding-top: 0.12rem;
}

.cap-body {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.cap-name {
  font-size: 0.9rem;
  color: var(--text);
  line-height: 1.3;
}

.cap-desc {
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.45;
}

.capacite.unlocked .cap-rank {
  color: var(--brand);
}

.capacite.unlocked .cap-name {
  font-weight: 600;
}

.capacite.unlocked .cap-desc {
  color: var(--text);
}

.muted-cap {
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
}

/* ── Passifs (récap des capacités passives débloquées) ── */
.passifs-section {
  margin-top: 0;
}

.passif-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.passif-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
  padding: 0.62rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.passif-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.passif-name {
  font-family: var(--title-font);
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}

.passif-path-tag {
  flex-shrink: 0;
  max-width: 48%;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: right;
  line-height: 1.25;
  padding: 0.2rem 0.45rem;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid var(--border);
}

.passif-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.45;
}

/* ── Formations & armes ── */
.small-hint {
  font-size: 0.82rem;
  margin: 0 0 0.75rem;
  line-height: 1.35;
}

.formation-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.formation-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.formation-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.92rem;
}

.formation-cb {
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--brand);
}

.formation-note {
  font-size: 0.78rem;
  color: var(--muted);
}

.card-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  justify-content: flex-end;
}

.weapon-catalog-select {
  min-width: 11rem;
  max-width: 100%;
}

.weapon-sheet-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.weapon-sheet-card {
  padding: 0.68rem;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  background: var(--surface-2);
}

/* ── Select ── */
.input.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  padding-right: 2rem;
  cursor: pointer;
}

/* ── Voie kind badges ── */
.voie-kind-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.voie-kind-badge.peuple {
  background: color-mix(in srgb, var(--brand) 18%, transparent);
  color: var(--brand-strong);
  border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
}

.voie-kind-badge.culturelle {
  background: color-mix(in srgb, #3a8a4a 14%, transparent);
  color: #2a6a38;
  border: 1px solid color-mix(in srgb, #3a8a4a 30%, transparent);
}

:root[data-theme="dark"] .voie-kind-badge.culturelle {
  color: #7bcf8a;
}

/* ── Misc ── */
.muted {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

.btn.small {
  min-height: 38px;
  padding: 0.3rem 0.58rem;
  font-size: 0.82rem;
}

@media (min-width: 760px) {
  .card {
    padding: 1.1rem 1.2rem;
    margin-bottom: 1rem;
  }
}

/* ── Voie Picker overlay ── */
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

@media (min-width: 540px) {
  .picker-overlay {
    align-items: center;
    padding: 1.5rem;
  }
}

.picker-panel {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 82svh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

@media (min-width: 540px) {
  .picker-panel {
    border-radius: 20px;
    max-height: 80vh;
    box-shadow: var(--shadow-card);
  }
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.1rem 0.7rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.picker-head h3 {
  margin: 0;
  font-family: var(--title-font);
  font-size: 1.1rem;
  color: var(--brand-strong);
}

.picker-body {
  overflow-y: auto;
  padding: 0.7rem 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.picker-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.picker-family {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0 0 0.35rem;
  padding: 0.22rem 0.6rem;
  border-radius: 6px;
  display: inline-block;
}

.family-combattants {
  background: color-mix(in srgb, var(--brand) 16%, transparent);
  color: var(--brand-strong);
}
.family-aventuriers {
  background: color-mix(in srgb, #3a8a4a 14%, transparent);
  color: #2a6a38;
}
.family-mystiques {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent-strong);
}
.family-prestige {
  background: color-mix(in srgb, #8a6a20 14%, transparent);
  color: #5c4510;
}

:root[data-theme="dark"] .family-aventuriers {
  color: #7bcf8a;
}
:root[data-theme="dark"] .family-prestige {
  color: #d4a843;
}

.picker-voies {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.picker-voie {
  padding: 0.58rem 0.6rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.93rem;
  color: var(--text);
  transition: background 100ms ease;
}

.picker-voie:hover {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.picker-empty {
  text-align: center;
  padding: 1rem 0;
}
</style>

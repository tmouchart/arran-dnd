<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  X,
  Heart,
  HeartCrack,
  Skull,
  Zap,
  CheckCheck,
  LayoutList,
} from "lucide-vue-next";
import { useCombat } from "../composables/useCombat";
import { user } from "../composables/useAuth";
import { MONSTERS_CATALOG, type Monster } from "../data/monstersCatalog";
import { filterCatalog, formatMod } from "../utils/monsterSession";
import AppPageLayout from "../components/ui/AppPageLayout.vue";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppIconBtn from "../components/ui/AppIconBtn.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppInput from "../components/ui/AppInput.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import ActionsView from "./ActionsView.vue";
import type { CombatParticipant } from "../api/combats";

const route = useRoute();
const router = useRouter();

const campaignId = Number(route.params.id);
const combatId = Number(route.params.cid);

const {
  combat,
  connecting,
  error,
  isGm,
  isMyTurn,
  myParticipant,
  connect,
  disconnect,
  nextTurn,
  prevTurn,
  updateHp,
  addMonster,
  finish,
} = useCombat();

// Tab: timeline vs actions
type CombatTab = "timeline" | "actions";
const activeTab = ref<CombatTab>("timeline");

// Expanded card (click to toggle)
const expandedId = ref<number | null>(null);

// Add monster bottom sheet
const showAddMonster = ref(false);
const monsterSearchQuery = ref("");
const filteredMonsters = computed(() =>
  filterCatalog(monsterSearchQuery.value, MONSTERS_CATALOG),
);

// Finish confirmation
const showFinishConfirm = ref(false);

onMounted(() => connect(campaignId, combatId));
onUnmounted(() => disconnect());

// Scroll to active participant on turn change
const timelineRef = ref<HTMLElement | null>(null);
watch(
  () => combat.value?.currentTurnIndex,
  async () => {
    await nextTick();
    const active = timelineRef.value?.querySelector(".participant-card.active");
    active?.scrollIntoView({ behavior: "smooth", block: "center" });
  },
);

function hasPlayed(index: number): boolean {
  if (!combat.value) return false;
  return index < combat.value.currentTurnIndex;
}

function hpStatusIcon(status: string | undefined) {
  if (!status) return { icon: Heart, color: "#27ae60" };
  switch (status) {
    case "intact":
      return { icon: Heart, color: "#27ae60" };
    case "blesse":
      return { icon: Heart, color: "#e67e22" };
    case "mal_en_point":
      return { icon: HeartCrack, color: "#c0392b" };
    case "agonisant":
      return { icon: HeartCrack, color: "#7b241c" };
    case "mort":
      return { icon: Skull, color: "#999" };
    default:
      return { icon: Heart, color: "#27ae60" };
  }
}

function adjustHp(p: CombatParticipant, delta: number) {
  if (p.hpCurrent == null || p.hpMax == null) return;
  const newHp = Math.max(0, Math.min(p.hpCurrent + delta, p.hpMax));
  updateHp(p.id, newHp);
}

function canAdjustHp(p: CombatParticipant): boolean {
  if (p.kind === "monster") return isGm.value;
  return p.userId === user.value?.id;
}

async function handleAddFromCatalog(m: Monster) {
  await addMonster({
    name: m.name,
    init: m.init,
    pv: m.pv,
    def: m.def,
    nc: m.nc,
    statFor: m.stats.for,
    statDex: m.stats.dex,
    statCon: m.stats.con,
    statInt: m.stats.int,
    statSag: m.stats.sag,
    statCha: m.stats.cha,
    attacks: m.attacks,
    abilities: m.abilities,
    description: m.description ?? null,
  });
  monsterSearchQuery.value = "";
  showAddMonster.value = false;
}

async function handleAddCustomMonster() {
  await addMonster({
    name: "Nouveau monstre",
    init: 0,
    pv: 10,
    def: 10,
  });
  showAddMonster.value = false;
}

async function handleFinish() {
  await finish();
  showFinishConfirm.value = false;
}

function goBack() {
  router.push(`/campagnes/${campaignId}`);
}
</script>

<template>
  <AppPageLayout mode="full" width="wide" class="combat-page">
    <template #top-bar>
      <div class="combat-content-header">
        <AppPageHead>
          <template #actions>
            <AppIconBtn title="Retour" @click="goBack">
              <ArrowLeft :size="18" />
            </AppIconBtn>
          </template>
          {{ combat?.name ?? "Combat" }}
        </AppPageHead>
      </div>
    </template>

    <div class="combat-content">

      <AppEmptyState v-if="connecting" variant="loading"
        >Connexion…</AppEmptyState
      >
      <AppEmptyState v-else-if="error" variant="error">{{
        error
      }}</AppEmptyState>

      <template v-else-if="combat">
        <!-- Tabs: Timeline / Actions -->
        <nav v-if="!isGm" class="tab-bar">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'timeline' }"
            @click="activeTab = 'timeline'"
          >
            <LayoutList :size="16" />
            <span class="tab-label">Combat</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'actions' }"
            @click="activeTab = 'actions'"
          >
            <Zap :size="16" />
            <span class="tab-label">Mes actions</span>
          </button>
        </nav>

        <!-- Tab: Actions (player only) -->
        <div v-if="activeTab === 'actions' && !isGm" class="actions-tab">
          <ActionsView :embedded="true" />
        </div>

        <!-- Tab: Timeline (scrollable center zone) -->
        <div
          v-show="activeTab === 'timeline'"
          ref="timelineRef"
          class="timeline"
        >
          <div
            v-for="(p, idx) in combat.participants"
            :key="p.id"
            class="participant-card"
            :class="{
              active:
                idx === combat.currentTurnIndex && combat.status === 'active',
              played: hasPlayed(idx) && combat.status === 'active',
              monster: p.kind === 'monster',
              dead:
                (p.kind === 'monster' &&
                  p.hpCurrent !== null &&
                  p.hpCurrent <= 0) ||
                p.hpStatus === 'mort',
              expanded: expandedId === p.id,
            }"
            @click="expandedId = expandedId === p.id ? null : p.id"
          >
            <!-- Summary row -->
            <div class="card-summary">
              <div class="card-left">
                <CheckCheck
                  v-if="hasPlayed(idx) && combat.status === 'active'"
                  :size="12"
                  class="played-icon"
                />
                <span class="card-kind-dot" :class="p.kind" />
                <span class="card-name">{{ p.name }}</span>
              </div>
              <div class="card-right">
                <span v-if="isGm || p.kind === 'player'" class="card-init">{{
                  p.initiative
                }}</span>
                <!-- Inline HP controls (GM monsters) -->
                <template v-if="canAdjustHp(p) && p.hpCurrent !== null && p.hpMax !== null">
                  <div class="card-hp-inline" @click.stop>
                    <button class="hp-btn-sm" @click="adjustHp(p, -1)"><Minus :size="12" /></button>
                    <span class="card-hp">{{ p.hpCurrent }}/{{ p.hpMax }}</span>
                    <button class="hp-btn-sm" @click="adjustHp(p, 1)"><Plus :size="12" /></button>
                  </div>
                </template>
                <!-- HP display (read-only) -->
                <template v-else-if="p.hpCurrent !== null && p.hpMax !== null">
                  <span class="card-hp">{{ p.hpCurrent }}/{{ p.hpMax }}</span>
                </template>
                <template v-else-if="p.hpStatus">
                  <component
                    :is="hpStatusIcon(p.hpStatus).icon"
                    :size="16"
                    :style="{ color: hpStatusIcon(p.hpStatus).color }"
                  />
                </template>
              </div>
            </div>

            <!-- Expanded: HP buttons -->
            <div
              v-if="
                expandedId === p.id && canAdjustHp(p) && p.hpCurrent !== null
              "
              class="card-hp-controls"
              @click.stop
            >
              <button class="hp-btn" @click="adjustHp(p, -5)">-5</button>
              <button class="hp-btn" @click="adjustHp(p, -1)">-1</button>
              <span class="hp-display">{{ p.hpCurrent }} / {{ p.hpMax }}</span>
              <button class="hp-btn" @click="adjustHp(p, 1)">+1</button>
              <button class="hp-btn" @click="adjustHp(p, 5)">+5</button>
            </div>

            <!-- Expanded: Monster details (GM only) -->
            <div
              v-if="
                expandedId === p.id && p.kind === 'monster' && isGm && p.attacks
              "
              class="card-monster-details"
              @click.stop
            >
              <div class="detail-row">
                <span class="detail-label">DEF</span> {{ p.def }}
                <span class="detail-sep">·</span>
                <span class="detail-label">NC</span> {{ p.nc }}
              </div>
              <div
                v-if="p.attacks && (p.attacks as unknown[]).length > 0"
                class="detail-section"
              >
                <span class="detail-heading">Attaques</span>
                <div
                  v-for="(atk, i) in p.attacks as {
                    name: string;
                    bonus: number;
                    damage: string;
                    range?: number;
                  }[]"
                  :key="i"
                  class="detail-atk"
                >
                  {{ atk.name }} {{ formatMod(atk.bonus) }} · {{ atk.damage
                  }}{{ atk.range ? ` · ${atk.range}m` : "" }}
                </div>
              </div>
              <div
                v-if="p.abilities && (p.abilities as unknown[]).length > 0"
                class="detail-section"
              >
                <span class="detail-heading">Capacités</span>
                <div
                  v-for="(ab, i) in p.abilities as {
                    name: string;
                    description: string;
                  }[]"
                  :key="i"
                  class="detail-ability"
                >
                  <strong>{{ ab.name }}</strong> — {{ ab.description }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- My stats panel (player only, timeline tab) -->
        <div
          v-if="
            activeTab === 'timeline' &&
            myParticipant &&
            myParticipant.hpCurrent !== null
          "
          class="my-stats-panel"
        >
          <div class="my-stats-header">
            <span class="my-stats-name">{{ myParticipant.name }}</span>
            <AppButton
              size="small"
              variant="ghost"
              @click="activeTab = 'actions'"
            >
              <Zap :size="14" />
              Mes actions
            </AppButton>
          </div>
          <div class="my-stats-row">
            <div class="my-stat">
              <span class="stat-label">PV</span>
              {{ myParticipant.hpCurrent }}/{{ myParticipant.hpMax }}
            </div>
            <div class="my-stat">
              <span class="stat-label">DEF</span> {{ myParticipant.def }}
            </div>
            <div class="my-stat">
              <span class="stat-label">Init</span>
              {{ myParticipant.initiative }}
            </div>
          </div>
          <div class="my-hp-controls">
            <button class="hp-btn" @click="adjustHp(myParticipant, -5)">
              -5
            </button>
            <button class="hp-btn" @click="adjustHp(myParticipant, -1)">
              -1
            </button>
            <span class="hp-display"
              >{{ myParticipant.hpCurrent }} / {{ myParticipant.hpMax }}</span
            >
            <button class="hp-btn" @click="adjustHp(myParticipant, 1)">
              +1
            </button>
            <button class="hp-btn" @click="adjustHp(myParticipant, 5)">
              +5
            </button>
          </div>
        </div>
      </template>
    </div>

    <template #bottom-bar>
    <div v-if="combat && combat.status === 'active'" class="combat-footer">
      <div class="footer-left">
        <AppIconBtn v-if="isGm" title="Précédent" @click="prevTurn">
          <ChevronLeft :size="18" />
        </AppIconBtn>
        <AppButton
          v-if="!isGm"
          size="small"
          variant="ghost"
          @click="activeTab = activeTab === 'timeline' ? 'actions' : 'timeline'"
        >
          <Zap v-if="activeTab === 'timeline'" :size="14" />
          <LayoutList v-else :size="14" />
          {{ activeTab === "timeline" ? "Actions" : "Combat" }}
        </AppButton>
      </div>
      <div class="footer-center">
        <AppIconBtn
          v-if="isGm"
          title="Ajouter un monstre"
          @click="showAddMonster = true"
        >
          <Plus :size="18" />
        </AppIconBtn>
        <AppButton
          v-if="isGm"
          size="small"
          variant="danger"
          @click="showFinishConfirm = true"
        >
          Terminer
        </AppButton>
      </div>
      <AppButton
        variant="primary"
        size="small"
        class="next-btn"
        :disabled="!isGm && !isMyTurn"
        @click="nextTurn"
      >
        Suivant
        <ChevronRight :size="14" />
      </AppButton>
    </div>
    </template>

    <!-- Bottom sheet: Add monster -->
    <Teleport to="body">
      <div
        v-if="showAddMonster"
        class="sheet-overlay"
        @click.self="showAddMonster = false"
      >
        <div class="sheet-panel">
          <div class="sheet-header">
            <h2 class="sheet-title">Ajouter un renfort</h2>
            <AppIconBtn @click="showAddMonster = false"
              ><X :size="18"
            /></AppIconBtn>
          </div>
          <AppInput
            v-model="monsterSearchQuery"
            placeholder="Rechercher un monstre…"
            :autofocus="true"
          />
          <div class="bestiary-results">
            <div
              v-for="m in filteredMonsters"
              :key="m.name"
              class="bestiary-item"
              @click="handleAddFromCatalog(m)"
            >
              <span class="bestiary-name">{{ m.name }}</span>
              <span class="bestiary-meta"
                >NC {{ m.nc }} · {{ m.pv }} PV · DEF {{ m.def }}</span
              >
            </div>
          </div>
          <AppButton variant="ghost" block @click="handleAddCustomMonster">
            <Plus :size="16" />
            Monstre custom
          </AppButton>
        </div>
      </div>
    </Teleport>

    <!-- Finish confirmation -->
    <Teleport to="body">
      <div
        v-if="showFinishConfirm"
        class="sheet-overlay"
        @click.self="showFinishConfirm = false"
      >
        <div class="modal-box">
          <p>Terminer ce combat ?</p>
          <div class="modal-actions">
            <AppButton variant="ghost" @click="showFinishConfirm = false"
              >Annuler</AppButton
            >
            <AppButton variant="danger" @click="handleFinish"
              >Terminer</AppButton
            >
          </div>
        </div>
      </div>
    </Teleport>
  </AppPageLayout>
</template>

<style scoped>
/* Tab bar */
.tab-bar {
  display: flex;
  gap: 0.35rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.3rem;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.42rem 0.5rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  transition:
    background 150ms ease,
    color 150ms ease;
}

.tab-btn:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, transparent);
  color: var(--accent-strong);
}

.tab-btn.active {
  background: var(--surface);
  color: var(--accent-strong);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.tab-label {
  white-space: nowrap;
}

.actions-tab {
  min-height: 200px;
}

.combat-page {
  /* Override AppPageLayout padding — combat handles its own */
  padding: 0 !important;
}

.combat-content-header {
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
  padding: 1rem 0.78rem 0;
}

.combat-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
  padding: 0 0.78rem;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.participant-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.9rem;
  overflow: hidden;
  transition:
    border-color 150ms ease,
    opacity 150ms ease;
  flex-shrink: 0;
  cursor: pointer;
}

.participant-card.active {
  border-color: var(--accent);
  border-width: 2px;
  background: var(--accent-soft);
}

.participant-card.played {
  opacity: 0.5;
}

.participant-card.dead {
  opacity: 0.35;
  text-decoration: line-through;
}

.card-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.8rem;
  min-height: 48px;
}

.card-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.played-icon {
  color: var(--muted);
  flex-shrink: 0;
}

.card-kind-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-kind-dot.player {
  background: #27ae60;
}
.card-kind-dot.monster {
  background: #c0392b;
}

.card-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.card-init {
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 600;
}

.card-hp {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
}

.card-hp-inline {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.hp-btn-sm {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.hp-btn-sm:active {
  background: var(--accent-soft);
}

/* Expanded HP controls */
.card-hp-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem 0.6rem;
  border-top: 1px solid var(--border);
}

.hp-btn {
  width: 36px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface);
  color: var(--text);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hp-btn:active {
  background: var(--accent-soft);
}

.hp-display {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  min-width: 60px;
  text-align: center;
}

/* Monster details expanded */
.card-monster-details {
  padding: 0.4rem 0.8rem 0.6rem;
  border-top: 1px solid var(--border);
  font-size: 0.78rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.detail-row {
  color: var(--muted);
}
.detail-label {
  font-weight: 700;
  color: var(--text);
}
.detail-sep {
  margin: 0 0.2rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border);
}
.detail-heading {
  font-weight: 700;
  color: var(--text);
  font-size: 0.75rem;
  text-transform: uppercase;
}
.detail-atk {
  color: var(--muted);
  padding-bottom: 0.25rem;
  border-bottom: 1px dashed color-mix(in srgb, var(--border) 50%, transparent);
}
.detail-atk:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.detail-ability {
  color: var(--muted);
  line-height: 1.3;
  padding-bottom: 0.35rem;
  border-bottom: 1px dashed color-mix(in srgb, var(--border) 50%, transparent);
}
.detail-ability:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

/* My stats panel — fixed at bottom, above footer */
.my-stats-panel {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.my-stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.my-stats-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text);
}

.my-stats-row {
  display: flex;
  gap: 1rem;
}

.my-stat {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}

.stat-label {
  font-size: 0.72rem;
  color: var(--muted);
  text-transform: uppercase;
  margin-right: 0.2rem;
}

.my-hp-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

/* Footer — full width, content centered */
.combat-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  background: var(--surface-2);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  gap: 0.5rem;
  width: 100%;
}

.next-btn {
  white-space: nowrap;
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

.footer-center {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

/* Bottom sheet */
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.sheet-panel {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.4rem 1.4rem 0 0;
  padding: 1.2rem;
  width: 100%;
  max-width: 500px;
  max-height: 70vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.bestiary-results {
  max-height: 40vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.bestiary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.6rem;
  border-radius: 0.6rem;
  cursor: pointer;
  transition: background 120ms ease;
}

.bestiary-item:hover {
  background: var(--accent-soft);
}

.bestiary-name {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--text);
}
.bestiary-meta {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
}

/* Modal */
.modal-box {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 1.2rem;
  padding: 1.5rem;
  max-width: 360px;
  width: 90%;
  text-align: center;
  margin: auto;
}

.modal-box p {
  margin: 0 0 1.2rem;
  font-size: 0.95rem;
  color: var(--text);
}
.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}
</style>

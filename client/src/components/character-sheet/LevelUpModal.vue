<script setup lang="ts">
import { ref, computed } from "vue";
import { Dices, TrendingUp, Star, Shield, Swords, Wand2, Heart } from "lucide-vue-next";
import AppModal from "../ui/AppModal.vue";
import AppButton from "../ui/AppButton.vue";
import type { Character } from "../../types/character";
import { inferProfileFamily } from "../../utils/inferProfileFamily";
import {
  FAMILY_DIE_MAX,
  computedAttackContact,
  computedAttackDistance,
  computedAttackMagique,
} from "../../composables/useCharacter";

const props = defineProps<{
  show: boolean;
  character: Character;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  confirm: [];
}>();

// Step: "confirm" | "recap"
const step = ref<"confirm" | "recap">("confirm");

const nextLevel = computed(() => props.character.level + 1);
const family = computed(() => inferProfileFamily(props.character.paths));
const dieMax = computed(() => FAMILY_DIE_MAX[family.value]);
const conMod = computed(() => Math.floor((props.character.abilities.constitution - 10) / 2));

// HP gain: rolled die + conMod (null = not yet rolled)
const hpRoll = ref<number | null>(null);
const hpGain = computed(() => (hpRoll.value ?? 0) + conMod.value);

// Attack bonuses at current level (before level up)
const atkContactBefore = computed(() => computedAttackContact.value);
const atkDistanceBefore = computed(() => computedAttackDistance.value);
const atkMagiqueBefore = computed(() => computedAttackMagique.value);
// After = before + 1 (level adds +1 to all)
const atkContactAfter = computed(() => atkContactBefore.value + 1);
const atkDistanceAfter = computed(() => atkDistanceBefore.value + 1);
const atkMagiqueAfter = computed(() => atkMagiqueBefore.value + 1);

// PC max
const pcMaxBefore = computed(() => {
  const chaMod = Math.floor((props.character.abilities.charisma - 10) / 2);
  return 2 + chaMod + (family.value === "aventuriers" ? 2 : 0);
});

// Points de rang: 2 par niveau
const pointsDeRang = 2;

function rollHp() {
  hpRoll.value = Math.ceil(Math.random() * dieMax.value);
}

function onHpInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (raw === "") {
    hpRoll.value = null;
    return;
  }
  const val = parseInt(raw);
  if (!isNaN(val)) {
    hpRoll.value = Math.max(1, Math.min(dieMax.value, val));
  }
}

function openRecap() {
  hpRoll.value = null;
  step.value = "recap";
}

function accept() {
  // Apply level up to character
  const c = props.character;
  // 1. Increment level
  c.level += 1;
  // 2. Add HP gain roll (hpLevelGains already auto-resized by watcher in useCharacter,
  //    but we set the last entry to our rolled value)
  const needed = c.level - 1;
  while (c.hpLevelGains.length < needed) {
    c.hpLevelGains.push(dieMax.value);
  }
  c.hpLevelGains[needed - 1] = hpRoll.value!;
  // 3. Restore PC to new max
  const newPcMax = 2 + Math.floor((c.abilities.charisma - 10) / 2) + (family.value === "aventuriers" ? 2 : 0);
  c.pcCurrent = newPcMax;

  emit("confirm");
  close();
}

function close() {
  step.value = "confirm";
  emit("update:show", false);
}

const conSign = computed(() => (conMod.value >= 0 ? "+" : ""));
</script>

<template>
  <AppModal
    :model-value="show"
    :title="step === 'recap' ? '↑ Montée en niveau' : undefined"
    @update:model-value="close"
  >

        <!-- ── ÉTAPE 1 : Confirmation ── -->
        <template v-if="step === 'confirm'">
          <div class="confirm-body">
            <div class="confirm-badge">
              <TrendingUp :size="28" />
            </div>
            <p class="confirm-label">Montée en niveau</p>
            <p class="confirm-question">
              Voulez-vous passer au niveau <strong>{{ nextLevel }}</strong>&nbsp;?
            </p>
            <div class="confirm-actions">
              <AppButton variant="primary" @click="openRecap">Oui</AppButton>
              <AppButton @click="close">Non</AppButton>
            </div>
          </div>
        </template>

        <!-- ── ÉTAPE 2 : Récap des gains ── -->
        <template v-else>
          <div class="recap-body">

            <!-- PV max -->
            <div class="gain-row">
              <div class="gain-icon hp-icon"><Heart :size="16" /></div>
              <div class="gain-info">
                <span class="gain-label">Points de vie max</span>
                <span class="gain-value">
                  <template v-if="hpRoll != null">+{{ hpGain }}</template>
                  <template v-else>—</template>
                  <span class="hp-detail">
                    (1d{{ dieMax }} =
                    <input
                      type="number"
                      class="hp-roll-input"
                      :min="1"
                      :max="dieMax"
                      :value="hpRoll ?? ''"
                      :placeholder="`1–${dieMax}`"
                      @input="onHpInput($event)"
                    />
                    <button class="inline-dice-btn" @click="rollHp" :title="`Lancer le dé (1–${dieMax})`">
                      <Dices :size="14" />
                    </button>
                    {{ conSign }}{{ conMod }} CON)
                  </span>
                </span>
              </div>
            </div>

            <!-- Attaque contact -->
            <div class="gain-row">
              <div class="gain-icon atk-icon"><Swords :size="16" /></div>
              <div class="gain-info">
                <span class="gain-label">Attaque contact</span>
                <span class="gain-value arrow-gain">
                  {{ atkContactBefore >= 0 ? '+' : '' }}{{ atkContactBefore }}
                  <span class="arrow">→</span>
                  <strong>{{ atkContactAfter >= 0 ? '+' : '' }}{{ atkContactAfter }}</strong>
                </span>
              </div>
            </div>

            <!-- Attaque distance -->
            <div class="gain-row">
              <div class="gain-icon atk-icon"><Swords :size="16" style="transform:rotate(45deg)" /></div>
              <div class="gain-info">
                <span class="gain-label">Attaque distance</span>
                <span class="gain-value arrow-gain">
                  {{ atkDistanceBefore >= 0 ? '+' : '' }}{{ atkDistanceBefore }}
                  <span class="arrow">→</span>
                  <strong>{{ atkDistanceAfter >= 0 ? '+' : '' }}{{ atkDistanceAfter }}</strong>
                </span>
              </div>
            </div>

            <!-- Attaque magique -->
            <div class="gain-row">
              <div class="gain-icon magic-icon"><Wand2 :size="16" /></div>
              <div class="gain-info">
                <span class="gain-label">Attaque magique</span>
                <span class="gain-value arrow-gain">
                  {{ atkMagiqueBefore >= 0 ? '+' : '' }}{{ atkMagiqueBefore }}
                  <span class="arrow">→</span>
                  <strong>{{ atkMagiqueAfter >= 0 ? '+' : '' }}{{ atkMagiqueAfter }}</strong>
                </span>
              </div>
            </div>

            <!-- Points de chance -->
            <div class="gain-row">
              <div class="gain-icon pc-icon"><Star :size="16" /></div>
              <div class="gain-info">
                <span class="gain-label">Points de chance</span>
                <span class="gain-value">Remis à {{ pcMaxBefore }} PC</span>
              </div>
            </div>

            <!-- Points de rang -->
            <div class="gain-row">
              <div class="gain-icon rang-icon"><Shield :size="16" /></div>
              <div class="gain-info">
                <span class="gain-label">Points de rang</span>
                <span class="gain-value">{{ pointsDeRang }} points de rang à distribuer</span>
              </div>
            </div>

          </div>
        </template>

    <template v-if="step === 'recap'" #footer>
      <AppButton variant="primary" block :disabled="hpRoll == null" @click="accept">
        ✦ Accepter la montée en niveau ✦
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
/* ── Confirmation step ── */
.confirm-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: var(--space-md) 0;
  text-align: center;
}

.confirm-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent-strong);
}

.confirm-label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.confirm-question {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text);
  font-style: italic;
}

.confirm-question strong {
  color: var(--accent-strong);
  font-style: normal;
  font-size: 1.25rem;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* ── Recap step ── */
.recap-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.gain-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-md);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.gain-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.hp-icon    { background: color-mix(in srgb, #c95f56 15%, transparent); color: #c95f56; }
.atk-icon   { background: color-mix(in srgb, var(--brand) 15%, transparent); color: var(--brand-strong); }
.magic-icon { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent-strong); }
.pc-icon    { background: color-mix(in srgb, #d4a843 15%, transparent); color: #b8880f; }
.rang-icon  { background: color-mix(in srgb, #3a8a4a 15%, transparent); color: #2a6a38; }

:root[data-theme="dark"] .pc-icon  { color: #d4a843; }
:root[data-theme="dark"] .rang-icon { color: #7bcf8a; }

.gain-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.gain-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.gain-value {
  font-size: 0.82rem;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.arrow-gain strong {
  color: var(--accent-strong);
}

.arrow {
  color: var(--muted);
  font-size: 0.75rem;
}

.hp-detail {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.hp-roll-input {
  width: 2.8rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text);
  padding: 0.15rem 0.2rem;
}

.hp-roll-input:focus {
  outline: 2px solid var(--accent);
  border-color: var(--accent);
}

/* Hide number spinners */
.hp-roll-input::-webkit-inner-spin-button,
.hp-roll-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.hp-roll-input { -moz-appearance: textfield; }

.inline-dice-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent-strong);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: var(--radius-xs);
  transition: background 0.12s, color 0.12s;
}

.inline-dice-btn:hover {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}
</style>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Wand2, ChevronUp, ChevronDown, Dices } from "lucide-vue-next";
import AppCard from "../ui/AppCard.vue";
import AppIconBtn from "../ui/AppIconBtn.vue";
import AppTooltip from "../ui/AppTooltip.vue";
import AbilityInitModal from "./AbilityInitModal.vue";
import type { Character, CharacterAbilities } from "../../types/character";
import { effectiveAbilities } from "../../utils/characterStats";
import { pathEffects } from "../../composables/usePathEffects";

const props = defineProps<{
  character: Character;
  abilityModifier: (score: number) => number;
}>();

const showInitModal = ref(false);

function applyAbilities(abilities: CharacterAbilities) {
  // La modale rend des scores de BASE : on les écrit tels quels.
  // Le bonus de voie n'est jamais persisté, il est recalculé à l'affichage.
  Object.assign(props.character.abilities, abilities);
}

const abilityList = [
  { key: "strength" as const, label: "FOR" },
  { key: "dexterity" as const, label: "DEX" },
  { key: "constitution" as const, label: "CON" },
  { key: "intelligence" as const, label: "INT" },
  { key: "wisdom" as const, label: "SAG" },
  { key: "charisma" as const, label: "CHA" },
];

const effects = computed(() => pathEffects(props.character.paths));

const rows = computed(() => {
  const effective = effectiveAbilities(props.character);
  return abilityList.map((a) => {
    const base = props.character.abilities[a.key];
    const score = effective[a.key];
    const mod = props.abilityModifier(score);
    return {
      ...a,
      base,
      score,
      mod,
      modLabel: (mod >= 0 ? "+" : "") + mod,
      sources: effects.value.sources.filter((s) => s.ability === a.key),
      advantage: effects.value.advantage.has(a.key),
    };
  });
});
</script>

<template>
  <AbilityInitModal
    v-model:show="showInitModal"
    :character="character"
    @confirm="applyAbilities"
  />

  <AppCard title="Caractéristiques">
    <template #titleActions>
      <AppIconBtn title="Initialiser les caractéristiques" @click="showInitModal = true">
        <Wand2 :size="16" />
      </AppIconBtn>
    </template>
    <div class="abilities">
      <div v-for="a in rows" :key="a.key" class="ability">
        <span class="abil-label">{{ a.label }}</span>
        <div class="ability-row">
          <div class="score-mod">
            <span
              class="score-val"
              :class="{ boosted: a.sources.length > 0 }"
              :data-testid="`ability-score-${a.key}`"
            >{{ a.score }}</span>

            <AppTooltip
              v-if="a.sources.length > 0 || a.advantage"
              :label="`Détail de ${a.label}`"
            >
              <template #trigger>
                <span
                  v-if="a.sources.length > 0"
                  class="mark-dot"
                  :data-testid="`ability-bonus-mark-${a.key}`"
                >•</span>
                <Dices
                  v-if="a.advantage"
                  class="mark-dice"
                  :size="11"
                  :data-testid="`ability-advantage-${a.key}`"
                />
              </template>

              <div class="tip-head">{{ a.label }}</div>
              <div class="tip-line">{{ a.base }} de base</div>
              <div v-for="(s, i) in a.sources" :key="i" class="tip-line">
                <span class="tip-bonus">+{{ s.bonus }}</span> {{ s.from }}
              </div>
              <div v-if="a.advantage" class="tip-line tip-adv">
                <Dices :size="12" /> Avantage : 2d20, on garde le meilleur.
              </div>
              <div class="tip-foot">Les flèches modifient le score de base.</div>
            </AppTooltip>

            <span class="mod" :class="a.mod > 0 ? 'mod-pos' : a.mod < 0 ? 'mod-neg' : 'mod-zero'">
              ({{ a.modLabel }})
            </span>
          </div>
          <div class="ab-btns">
            <button type="button" class="ab-btn" @click="character.abilities[a.key]++">
              <ChevronUp :size="12" :stroke-width="2.5" />
            </button>
            <button type="button" class="ab-btn" :disabled="character.abilities[a.key] <= 1" @click="character.abilities[a.key]--">
              <ChevronDown :size="12" :stroke-width="2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppCard>
</template>


<style scoped>
.abilities {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem 0.75rem;
}

@media (min-width: 520px) {
  .abilities {
    grid-template-columns: repeat(6, 1fr);
  }
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.abil-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.ability-row {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.3rem 0.25rem 0.3rem 0.35rem;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.score-mod {
  display: flex;
  align-items: baseline;
  gap: 0.1rem;
  min-width: 0;
  overflow: hidden;
}

.score-val {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  line-height: 1;
}

/* Un passif de voie contribue à ce score : il change de couleur, ça se repère
   d'un coup d'oeil sur toute la grille. */
.score-val.boosted {
  color: var(--accent-strong);
}

.mark-dot {
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
}

.mark-dice {
  align-self: center;
  flex-shrink: 0;
}

.mod {
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.mod-pos { color: var(--accent-strong); }
.mod-neg { color: var(--danger); }
.mod-zero { color: var(--muted); }

/* ── Contenu de l'infobulle ─────────────────────────────────────────────── */

.tip-head {
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-size: 0.7rem;
  margin-bottom: var(--space-xs);
}

.tip-line {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.tip-bonus {
  font-weight: 700;
  color: var(--accent-strong);
}

.tip-adv {
  color: var(--accent-strong);
  margin-top: var(--space-xs);
}

.tip-foot {
  margin-top: var(--space-xs);
  padding-top: var(--space-xs);
  border-top: 1px solid var(--border);
  font-size: 0.7rem;
  color: var(--muted);
}

.ab-btns {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-left: auto;
}

.ab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: background 100ms ease, color 100ms ease;
}

.ab-btn:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.ab-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>

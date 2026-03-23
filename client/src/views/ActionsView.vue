<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Swords, ChevronDown, ChevronUp, CirclePlus, CircleMinus, Scroll } from "lucide-vue-next";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppBadge from "../components/ui/AppBadge.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import PassifsCard from "../components/character-sheet/PassifsCard.vue";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import { VOIES_BY_ID, type VoieFamily } from "../data/voies";
import { PEUPLE_VOIES_BY_ID } from "../data/peuples";
import { MYSTIC_TALENTS_BY_ID, isMysticTalentId } from "../data/mysticTalents";
import { inferProfileFamily } from "../utils/inferProfileFamily";
import {
  formatWeaponDamage,
  isMartialWeaponProficient,
} from "../utils/attackBonus";
import { MARTIAL_WEAPON_CATEGORY_BY_ID } from "../data/martialWeaponCategories";

const { character, loading, loadError, computedAttackContact, computedAttackDistance, computedAttackMagique, computedHp, computedMp, abilityModifier } = useCharacter();

onMounted(() => {
  if (!character.value.id) loadCharacter();
});

function retryLoad() {
  loadCharacter();
}

const profileFamily = computed(() => inferProfileFamily(character.value.paths));

// ── Types ────────────────────────────────────────────────────────────────────

type ActionType = "limitée" | "attaque" | "gratuite" | "info";
type AttackType = "contact" | "distance" | "magique" | null;

interface Action {
  name: string;
  description: string;
  actionType: ActionType;
  attackType: AttackType;
  source: string;
  voieFamily?: VoieFamily;
  /** CO: PM = rang du sort. Only set for voies mystiques (talents magiques = pas de PM). */
  pmCost: number | null;
}

// ── Inférence depuis la description ──────────────────────────────────────────

function inferActionType(desc: string): ActionType {
  if (/action gratuite/i.test(desc)) return "gratuite";
  if (/action limitée/i.test(desc)) return "limitée";
  // Default: action d'attaque (CO). Descriptions rarely spell it out when it is the usual case.
  return "attaque";
}

function inferAttackType(desc: string): AttackType {
  if (/attaque magique|test d.attaque magique/i.test(desc)) return "magique";
  if (
    /au contact|à mains nues|attaque de contact|attaque au contact/i.test(desc)
  )
    return "contact";
  if (/portée \d|à distance|attaque à distance/i.test(desc)) return "distance";
  return null;
}

// ── Bonus d'attaque ──────────────────────────────────────────────────────────

function computeBonus(attackType: AttackType): number | null {
  if (attackType === 'contact') return computedAttackContact.value;
  if (attackType === 'distance') return computedAttackDistance.value;
  if (attackType === 'magique') return computedAttackMagique.value;
  return null;
}

// ── Autres règles de base (les attaques normales passent par les armes sur la fiche) ──

const BASE_RULE_ACTIONS: Action[] = [
  {
    name: "Attaque assurée",
    description:
      "+5 en attaque, mais les dégâts sont divisés par 2. Aucun critique possible.",
    actionType: "limitée",
    attackType: "contact",
    source: "Règles de base",
    pmCost: null,
  },
  {
    name: "Soutien",
    description:
      "Donne +5 en attaque à un allié qui cible le même adversaire à portée de contact.",
    actionType: "limitée",
    attackType: null,
    source: "Règles de base",
    pmCost: null,
  },
];

const baseRuleActionsList = computed<Action[]>(() => {
  const pourCePerso =
    profileFamily.value === "combattants"
      ? "Pour ce personnage (famille combattants) : 1 PM = 2 PV."
      : "Pour ce personnage : 1 PM = 1 PV.";
  const description = [
    "Quand un PJ n’a pas assez de PM pour lancer un sort, il peut sacrifier des PV",
    pourCePerso,
  ].join("\n\n");
  return [
    ...BASE_RULE_ACTIONS,
    {
      name: "Brûlure de magie",
      description,
      actionType: "info" as const,
      attackType: null,
      source: "Magie (règle)",
      pmCost: null,
    },
  ];
});

// ── Actions des voies débloquées ─────────────────────────────────────────────

const voieActions = computed<Action[]>(() => {
  const result: Action[] = [];
  for (const path of character.value.paths) {
    const voie = VOIES_BY_ID[path.id ?? ""];
    if (!voie) continue;
    voie.capacites.forEach((cap, ci) => {
      if (path.rank > ci && cap.active) {
        const spellRank = ci + 1;
        result.push({
          name: cap.name,
          description: cap.description,
          actionType: inferActionType(cap.description),
          attackType: inferAttackType(cap.description),
          source: voie.name,
          voieFamily: voie.family,
          pmCost: voie.family === "mystiques" ? spellRank : null,
        });
      }
    });
  }
  return result;
});

const mysticTalentActions = computed<Action[]>(() => {
  const id = character.value.mysticTalent;
  if (profileFamily.value !== "mystiques" || !id || !isMysticTalentId(id))
    return [];
  const t = MYSTIC_TALENTS_BY_ID[id];
  return [
    {
      name: t.name,
      description: t.description,
      actionType: t.actionType as ActionType,
      attackType: t.attackType as AttackType,
      source: "Talent magique",
      voieFamily: "mystiques" as VoieFamily,
      pmCost: null,
    },
  ];
});

const actionsAfterWeapons = computed<Action[]>(() => [
  ...mysticTalentActions.value,
  ...voieActions.value,
]);

const hasPassifs = computed(() => {
  const allVoies = { ...VOIES_BY_ID, ...PEUPLE_VOIES_BY_ID } as Record<string, { capacites: { active?: boolean }[] }>;
  return character.value.paths.some((p) => {
    const vd = p.id ? allVoies[p.id] : null;
    if (!vd || p.rank <= 0) return false;
    return vd.capacites.some((cap, ci) => p.rank > ci && cap.active === false);
  });
});

const weaponBubbles = computed(() => {
  const c = character.value;
  return c.weapons.map((w) => {
    const base = w.attackType === 'contact' ? computedAttackContact.value : computedAttackDistance.value;
    const incompetent = !isMartialWeaponProficient(w, c.martialFormations);
    const total = incompetent ? base - 3 : base;
    return {
      w,
      hitDisplay: `d20 ${total >= 0 ? "+" : ""}${total} (vs DEF de la cible)`,
      damageDisplay: formatWeaponDamage(
        w.damageDice,
        w.damageAbility,
        c.abilities,
      ),
      rangeDisplay: w.rangeMeters != null ? `${w.rangeMeters} m` : null,
      incompetent,
    };
  });
});

// ── Combat header ─────────────────────────────────────────────────────────────

const ABILITY_LABELS: { key: keyof typeof character.value.abilities; label: string }[] = [
  { key: "strength",     label: "FOR" },
  { key: "dexterity",    label: "DEX" },
  { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" },
  { key: "wisdom",       label: "SAG" },
  { key: "charisma",     label: "CHA" },
];

function modDisplay(score: number): string {
  const m = abilityModifier(score);
  return m >= 0 ? `+${m}` : String(m);
}

// ── Manoeuvres ────────────────────────────────────────────────────────────────

const manoeuversOpen = ref(false);
const diversOpen = ref(false);

interface Manoeuvre {
  name: string;
  sizePenalty: boolean;
  testOppose: string;
  effet: string;
  critique: string;
}

const MANOEUVRES: Manoeuvre[] = [
  {
    name: "Aveugler",
    sizePenalty: false,
    testOppose: "DEX vs CON",
    effet: "Pendant un tour complet, la cible a -5 en attaque, en DEF et aux DM.",
    critique: "La cible est aveuglée 1d6 tours et subit des DM normaux en plus.",
  },
  {
    name: "Bloquer",
    sizePenalty: true,
    testOppose: "FOR vs FOR",
    effet: "La cible ne peut pas se déplacer lors de son prochain tour.",
    critique: "La cible subit en plus l'effet de Tenir à distance.",
  },
  {
    name: "Désarmer",
    sizePenalty: false,
    testOppose: "FOR ou DEX vs FOR",
    effet: "La cible laisse tomber son arme. Il lui faut une action de mouvement pour la ramasser.",
    critique: "L'attaquant s'empare de l'arme.",
  },
  {
    name: "Faire diversion",
    sizePenalty: false,
    testOppose: "CHA vs INT",
    effet: "Jusqu'au prochain tour de la cible : -5 à tous ses tests de perception et en DEF.",
    critique: "Le malus passe à -10.",
  },
  {
    name: "Menacer",
    sizePenalty: false,
    testOppose: "CHA vs SAG",
    effet: "Si la cible attaque le PJ lors de son prochain tour, elle subit une attaque au contact automatiquement réussie infligeant +1d6 DM.",
    critique: "Si la cible attaque : DM doublés (+2d6).",
  },
  {
    name: "Renverser",
    sizePenalty: true,
    testOppose: "FOR vs FOR",
    effet: "La cible tombe : -5 en DEF. Il lui faut une action de mouvement pour se relever.",
    critique: "L'attaque inflige en plus des DM normaux.",
  },
  {
    name: "Repousser",
    sizePenalty: true,
    testOppose: "FOR vs FOR",
    effet: "La cible recule de 1d6 mètres.",
    critique: "Si le recul est d'au moins 3 m, la cible est aussi renversée.",
  },
  {
    name: "Tenir à distance",
    sizePenalty: false,
    testOppose: "DEX vs DEX",
    effet: "La cible ne peut pas attaquer le personnage lors de son prochain tour.",
    critique: "La cible subit en plus l'effet de Bloquer.",
  },
];

// ── Labels & couleurs ────────────────────────────────────────────────────────

function actionTypeLabel(t: ActionType): string {
  if (t === "limitée") return "Limitée";
  if (t === "attaque") return "Attaque";
  if (t === "gratuite") return "Gratuite";
  return "Info";
}

function attackTypeLabel(t: AttackType): string {
  if (t === "contact") return "Contact";
  if (t === "distance") return "Distance";
  if (t === "magique") return "Magie";
  return "";
}

function bonusDisplay(bonus: number | null): string {
  if (bonus === null) return "—";
  return bonus >= 0 ? `+${bonus}` : String(bonus);
}

function familyClass(family?: VoieFamily): string {
  if (family === "combattants") return "family-combattants";
  if (family === "aventuriers") return "family-aventuriers";
  if (family === "mystiques") return "family-mystiques";
  if (family === "prestige") return "family-prestige";
  return "family-base";
}
</script>

<template>
  <div class="actions-page">
    <AppPageHead>
      <Swords :size="22" />
      Mes actions
      <template #actions>
        <RouterLink to="/personnage" class="btn ghost small">← Fiche</RouterLink>
      </template>
    </AppPageHead>

    <div v-if="character.id" class="combat-header">
      <!-- PV / PM -->
      <div class="ch-resources">
        <div class="ch-resource ch-resource--hp">
          <span class="ch-res-label">PV</span>
          <div class="ch-stepper">
            <button type="button" class="ch-btn" @click="character.hpCurrent = Math.max(0, character.hpCurrent - 1)"><CircleMinus :size="17" /></button>
            <span class="ch-res-value">{{ character.hpCurrent }}<span class="ch-res-max"> / {{ computedHp }}</span></span>
            <button type="button" class="ch-btn" @click="character.hpCurrent = Math.min(computedHp, character.hpCurrent + 1)"><CirclePlus :size="17" /></button>
          </div>
        </div>
        <div class="ch-resource ch-resource--mp">
          <span class="ch-res-label">PM</span>
          <div class="ch-stepper">
            <button type="button" class="ch-btn" @click="character.mpCurrent = Math.max(0, character.mpCurrent - 1)"><CircleMinus :size="17" /></button>
            <span class="ch-res-value">{{ character.mpCurrent }}<span class="ch-res-max"> / {{ computedMp }}</span></span>
            <button type="button" class="ch-btn" @click="character.mpCurrent = Math.min(computedMp, character.mpCurrent + 1)"><CirclePlus :size="17" /></button>
          </div>
        </div>
      </div>
      <!-- Caractéristiques -->
      <div class="ch-abilities">
        <div v-for="ab in ABILITY_LABELS" :key="ab.key" class="ch-ability">
          <span class="ch-ab-label">{{ ab.label }}</span>
          <span class="ch-ab-mod" :class="abilityModifier(character.abilities[ab.key]) > 0 ? 'mod-pos' : abilityModifier(character.abilities[ab.key]) < 0 ? 'mod-neg' : 'mod-zero'">
            {{ modDisplay(character.abilities[ab.key]) }}
          </span>
          <span class="ch-ab-score">{{ character.abilities[ab.key] }}</span>
        </div>
      </div>
    </div>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="loadError" variant="error">
      <p>{{ loadError }}</p>
      <template #actions>
        <button type="button" class="btn ghost small" @click="retryLoad">Réessayer</button>
      </template>
    </AppEmptyState>

    <AppEmptyState v-else-if="!character.id">
      Aucun personnage actif.
    </AppEmptyState>

    <div v-else class="actions-list">
      <div
        v-for="item in weaponBubbles"
        :key="'weapon-' + item.w.id"
        class="action-bubble family-base weapon-action"
      >
        <div class="action-header">
          <span class="action-name">{{ item.w.name || "Arme" }}</span>
          <AppBadge variant="attaque">Attaque</AppBadge>
        </div>

        <div class="action-meta">
          <span class="attack-type-badge">
            {{ attackTypeLabel(item.w.attackType) }}
          </span>
          <span class="attack-roll weapon-hit-line">{{ item.hitDisplay }}</span>
        </div>

        <p v-if="item.incompetent" class="weapon-incompetent-hint">
          Malus d’incompétence (−3) inclus (formation martiale manquante).
        </p>

        <p class="weapon-stat-line">
          <strong>Dégâts :</strong> {{ item.damageDisplay }}
        </p>
        <p v-if="item.rangeDisplay" class="weapon-stat-line">
          <strong>Portée :</strong> {{ item.rangeDisplay }}
        </p>
        <p v-if="item.w.notes" class="action-description">{{ item.w.notes }}</p>

        <div class="action-source">
          Arme · {{ MARTIAL_WEAPON_CATEGORY_BY_ID[item.w.martialFamily] }}
        </div>
      </div>

      <div
        v-for="action in actionsAfterWeapons"
        :key="action.source + '-' + action.name"
        class="action-bubble"
        :class="[
          familyClass(action.voieFamily),
          { 'action-bubble--info': action.actionType === 'info' },
        ]"
      >
        <div class="action-header">
          <span class="action-name">{{ action.name }}</span>
          <AppBadge :variant="action.actionType">{{ actionTypeLabel(action.actionType) }}</AppBadge>
          <AppBadge v-if="action.pmCost != null" variant="pm">PM:{{ action.pmCost }}</AppBadge>
        </div>

        <div v-if="action.actionType !== 'info'" class="action-meta">
          <span v-if="action.attackType" class="attack-type-badge">
            {{ attackTypeLabel(action.attackType) }}
          </span>
          <span class="attack-roll">
            <template v-if="action.attackType">
              d20 {{ bonusDisplay(computeBonus(action.attackType)) }}
            </template>
            <template v-else>
              <span class="no-roll">Aucun jet d'attaque</span>
            </template>
          </span>
        </div>

        <p class="action-description">{{ action.description }}</p>

        <div class="action-source">{{ action.source }}</div>
      </div>

      <!-- Divers collapsibles -->
      <div
        class="action-bubble divers-group"
        :class="{ 'divers-group--open': diversOpen }"
        @click.self="diversOpen = !diversOpen"
      >
        <div class="action-header divers-header" @click="diversOpen = !diversOpen">
          <Scroll :size="15" class="divers-icon" />
          <span class="action-name">Divers</span>
          <span class="divers-count">{{ baseRuleActionsList.length }}</span>
          <ChevronUp v-if="diversOpen" :size="16" class="divers-chevron" />
          <ChevronDown v-else :size="16" class="divers-chevron" />
        </div>
        <p v-if="!diversOpen" class="action-description divers-hint">
          Attaque assurée, soutien, brulure de magie...
        </p>
        <template v-if="diversOpen">
          <div class="divers-list">
            <div
              v-for="action in baseRuleActionsList"
              :key="action.source + '-' + action.name"
              class="action-bubble divers-bubble"
              :class="{ 'action-bubble--info': action.actionType === 'info' }"
              @click.stop
            >
              <div class="action-header">
                <span class="action-name">{{ action.name }}</span>
                <AppBadge :variant="action.actionType">{{ actionTypeLabel(action.actionType) }}</AppBadge>
              </div>
              <div v-if="action.actionType !== 'info'" class="action-meta">
                <span v-if="action.attackType" class="attack-type-badge">
                  {{ attackTypeLabel(action.attackType) }}
                </span>
                <span class="attack-roll">
                  <template v-if="action.attackType">
                    d20 {{ bonusDisplay(computeBonus(action.attackType)) }}
                  </template>
                  <template v-else>
                    <span class="no-roll">Aucun jet d'attaque</span>
                  </template>
                </span>
              </div>
              <p class="action-description">{{ action.description }}</p>
              <div class="action-source">{{ action.source }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- Manoeuvres collapsibles -->
      <div
        class="action-bubble manoeuvres-group"
        :class="{ 'manoeuvres-group--open': manoeuversOpen }"
        @click.self="manoeuversOpen = !manoeuversOpen"
      >
        <div class="action-header manoeuvres-header" @click="manoeuversOpen = !manoeuversOpen">
          <span class="action-name">Manoeuvres</span>
          <span class="manoeuvres-count">{{ MANOEUVRES.length }}</span>
          <ChevronUp v-if="manoeuversOpen" :size="16" class="manoeuvres-chevron" />
          <ChevronDown v-else :size="16" class="manoeuvres-chevron" />
        </div>
        <p v-if="!manoeuversOpen" class="action-description manoeuvres-hint">
          Désarmement, renversement, aveuglement... Toutes les manoeuvres accessibles à tous les personnages.
        </p>
        <template v-if="manoeuversOpen">
          <p class="action-description manoeuvres-rule">
            <strong>Déroulement :</strong> 1) Réussir un test d'attaque (contact). 2) Test opposé indiqué ci-dessous. 3) En cas de réussite, appliquer l'effet. Un échec avec un écart &ge; 10 retourne la manoeuvre contre le PJ.
          </p>
          <div class="manoeuvres-list">
            <div
              v-for="m in MANOEUVRES"
              :key="m.name"
              class="action-bubble manoeuvre-bubble"
              @click.stop
            >
              <div class="action-header">
                <span class="action-name">
                  {{ m.name }}<span v-if="m.sizePenalty" class="size-penalty-mark" title="Pénalité de taille : -5 par catégorie de taille si plus petit que la cible">*</span>
                </span>
                <span class="attack-type-badge">Contact</span>
                <span class="attack-roll">d20 {{ bonusDisplay(computedAttackContact) }}</span>
              </div>
              <div class="manoeuvre-body">
                <p class="manoeuvre-line"><strong>Effet :</strong> {{ m.effet }}</p>
                <p class="manoeuvre-line"><strong>Test opposé :</strong> {{ m.testOppose }}</p>
                <p class="manoeuvre-line manoeuvre-crit"><strong>Critique :</strong> {{ m.critique }}</p>
              </div>
              <div class="action-source">Manoeuvre</div>
            </div>
          </div>
          <p v-if="MANOEUVRES.some(m => m.sizePenalty)" class="action-description manoeuvres-footnote">
            * Pénalité de taille : -5 au test d'attaque par catégorie de taille d'écart si l'attaquant est plus petit que sa cible.
          </p>
        </template>
      </div>

      <template v-if="hasPassifs">
        <div class="passifs-divider" />
        <PassifsCard :character="character" class="passifs-in-actions" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.actions-page {
  max-width: 680px;
  margin: 0 auto;
}

.actions-page :deep(a.btn) {
  text-decoration: none;
}

/* ── Combat header ──────────────────────────────────────────────────────── */

.combat-header {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 0.9rem;
  padding: 0.75rem 1rem;
  border-radius: 1.2rem;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
}

.ch-resources {
  display: flex;
  gap: 0.75rem;
}

.ch-resource {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.75rem;
  border: 1.5px solid var(--border);
}

.ch-resource--hp {
  border-color: color-mix(in srgb, #c95f56 40%, var(--border));
  background: color-mix(in srgb, #c95f56 8%, var(--surface-2));
}

.ch-resource--mp {
  border-color: color-mix(in srgb, #678fc2 40%, var(--border));
  background: color-mix(in srgb, #678fc2 8%, var(--surface-2));
}

.ch-res-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  min-width: 1.6rem;
}

.ch-stepper {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.ch-btn {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.ch-btn:hover { color: var(--accent-strong); }

.ch-res-value {
  font-size: 1.2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  min-width: 0;
  text-align: center;
  line-height: 1.1;
  white-space: nowrap;
}

.ch-res-max {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--muted);
}

.ch-abilities {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.35rem;
}

.ch-ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0.2rem;
  border-radius: 0.65rem;
  border: 1px solid var(--border);
  background: var(--surface);
}

.ch-ab-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.ch-ab-mod {
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.ch-ab-score {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.mod-pos { color: #3a8a4a; }
:root[data-theme="dark"] .mod-pos { color: #7bcf8a; }
.mod-neg { color: #c95f56; }
.mod-zero { color: var(--muted); }

/* ── Liste ──────────────────────────────────────────────────────────────── */

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* ── Bulle ──────────────────────────────────────────────────────────────── */

.action-bubble {
  border-radius: 1.2rem;
  border: 1.5px solid var(--border);
  padding: 1rem 1.1rem 0.85rem;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.action-bubble:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-soft);
}

.action-bubble--info {
  border-style: dashed;
}

.action-bubble--info:hover {
  border-color: color-mix(in srgb, var(--muted) 45%, var(--border));
}

/* Teintes par famille */
.family-combattants {
  border-color: color-mix(in srgb, #c0392b 35%, var(--border));
  background: color-mix(in srgb, #c0392b 5%, var(--surface-2));
}
.family-aventuriers {
  border-color: color-mix(in srgb, #27ae60 35%, var(--border));
  background: color-mix(in srgb, #27ae60 5%, var(--surface-2));
}
.family-mystiques {
  border-color: color-mix(in srgb, #8e44ad 35%, var(--border));
  background: color-mix(in srgb, #8e44ad 5%, var(--surface-2));
}
.family-prestige {
  border-color: color-mix(in srgb, #d4ac0d 40%, var(--border));
  background: color-mix(in srgb, #d4ac0d 5%, var(--surface-2));
}

/* ── En-tête ────────────────────────────────────────────────────────────── */

.action-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
  flex: 1;
  min-width: 0;
}


/* ── Méta (type attaque + jet) ──────────────────────────────────────────── */

.action-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.attack-type-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.15em 0.55em;
  border-radius: 999px;
}

.attack-roll {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--accent-strong);
  font-family: var(--mono-font, monospace);
}

.no-roll {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--muted);
  font-family: inherit;
}

/* ── Description ────────────────────────────────────────────────────────── */

.action-description {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.45;
  margin: 0;
  white-space: pre-line;
}

/* ── Source ─────────────────────────────────────────────────────────────── */

.action-source {
  font-size: 0.72rem;
  font-style: italic;
  color: var(--muted);
  margin-top: 0.1rem;
}

.weapon-action .weapon-hit-line {
  font-size: 0.88rem;
  line-height: 1.35;
}

.weapon-stat-line {
  font-size: 0.88rem;
  margin: 0;
  color: var(--text);
}

.weapon-incompetent-hint {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0;
  font-style: italic;
}

/* ── Passifs en bas ─────────────────────────────────────────────────────── */

.passifs-divider {
  border-top: 1px solid var(--border);
  margin-top: 0.25rem;
}

.passifs-in-actions {
  margin-top: 0;
}

.passifs-in-actions :deep(.card-head h2) {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.passifs-in-actions :deep(.passif-name) {
  font-size: 0.88rem;
}

.passifs-in-actions :deep(.passif-desc) {
  font-size: 0.78rem;
}

.passifs-in-actions :deep(.passif-path-tag) {
  font-size: 0.65rem;
}

/* ── Manoeuvres group ───────────────────────────────────────────────────── */

.manoeuvres-group {
  cursor: pointer;
  border-color: color-mix(in srgb, #e67e22 35%, var(--border));
  background: color-mix(in srgb, #e67e22 5%, var(--surface-2));
}

.manoeuvres-group--open {
  cursor: default;
}

.manoeuvres-header {
  cursor: pointer;
  user-select: none;
}

.manoeuvres-count {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.1em 0.55em;
  border-radius: 999px;
}

.manoeuvres-chevron {
  color: var(--muted);
  flex-shrink: 0;
}

.manoeuvres-hint {
  font-style: italic;
}

.manoeuvres-rule {
  font-size: 0.8rem;
  background: color-mix(in srgb, #e67e22 8%, var(--surface));
  border-radius: 0.6rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid color-mix(in srgb, #e67e22 20%, var(--border));
}

.manoeuvres-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.manoeuvre-bubble {
  background: var(--surface);
  border-color: color-mix(in srgb, #e67e22 20%, var(--border));
  cursor: default;
  padding: 0.75rem 0.9rem 0.65rem;
}

.manoeuvre-bubble:hover {
  border-color: color-mix(in srgb, #e67e22 50%, var(--border));
}

.manoeuvre-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.manoeuvre-line {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.4;
}

.manoeuvre-crit {
  color: color-mix(in srgb, #e67e22 80%, var(--text));
}

.size-penalty-mark {
  color: #e67e22;
  font-weight: 900;
  margin-left: 0.05em;
}

.manoeuvres-footnote {
  font-size: 0.75rem;
  font-style: italic;
  margin-top: 0.1rem;
  color: color-mix(in srgb, var(--muted) 80%, #e67e22);
}

/* ── Divers group ───────────────────────────────────────────────────────── */

.divers-group {
  cursor: pointer;
  border-color: color-mix(in srgb, #7f8c8d 35%, var(--border));
  background: color-mix(in srgb, #7f8c8d 5%, var(--surface-2));
}

.divers-group--open {
  cursor: default;
}

.divers-header {
  cursor: pointer;
  user-select: none;
}

.divers-icon {
  color: var(--muted);
  flex-shrink: 0;
}

.divers-count {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.1em 0.55em;
  border-radius: 999px;
}

.divers-chevron {
  color: var(--muted);
  flex-shrink: 0;
}

.divers-hint {
  font-style: italic;
}

.divers-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.divers-bubble {
  background: var(--surface);
  border-color: color-mix(in srgb, #7f8c8d 20%, var(--border));
  cursor: default;
  padding: 0.75rem 0.9rem 0.65rem;
}

.divers-bubble:hover {
  border-color: color-mix(in srgb, #7f8c8d 50%, var(--border));
}

/* ── Desktop : 2 colonnes ───────────────────────────────────────────────── */

@media (min-width: 600px) {
  .actions-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
    align-items: start;
  }

  .passifs-divider,
  .passifs-in-actions,
  .manoeuvres-group,
  .divers-group {
    grid-column: 1 / -1;
  }

  .manoeuvres-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
}
</style>

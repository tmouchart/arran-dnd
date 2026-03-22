<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Swords } from "lucide-vue-next";
import { useCharacter, loadCharacter } from "../composables/useCharacter";
import { VOIES_BY_ID, type VoieFamily } from "../data/voies";
import { MYSTIC_TALENTS_BY_ID, isMysticTalentId } from "../data/mysticTalents";
import { inferProfileFamily } from "../utils/inferProfileFamily";
import {
  attackRollBonus,
  weaponAttackBonusWithProficiency,
  formatWeaponDamage,
  isMartialWeaponProficient,
} from "../utils/attackBonus";
import { MARTIAL_WEAPON_CATEGORY_BY_ID } from "../data/martialWeaponCategories";

const { character, loading, loadError } = useCharacter();

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
  if (!attackType) return null;
  return attackRollBonus(
    attackType,
    character.value.level,
    character.value.abilities,
    profileFamily.value,
  );
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

const weaponBubbles = computed(() => {
  const fam = profileFamily.value;
  const c = character.value;
  return c.weapons.map((w) => {
    const total = weaponAttackBonusWithProficiency(w, c, fam);
    const incompetent = !isMartialWeaponProficient(w, c.martialFormations);
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
    <h1 class="page-title">
      <Swords :size="22" />
      Mes actions
    </h1>

    <div v-if="loading" class="loading-state">Chargement…</div>

    <div v-else-if="loadError" class="empty-state load-error-block">
      <p>{{ loadError }}</p>
      <button type="button" class="btn-retry" @click="retryLoad">
        Réessayer
      </button>
    </div>

    <div v-else-if="!character.id" class="empty-state">
      Aucun personnage actif.
    </div>

    <div v-else class="actions-list">
      <div
        v-for="item in weaponBubbles"
        :key="'weapon-' + item.w.id"
        class="action-bubble family-base weapon-action"
      >
        <div class="action-header">
          <span class="action-name">{{ item.w.name || "Arme" }}</span>
          <span class="badge badge-attaque">Attaque</span>
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
          <span class="badge" :class="`badge-${action.actionType}`">
            {{ actionTypeLabel(action.actionType) }}
          </span>
          <span v-if="action.pmCost != null" class="badge badge-pm"
            >PM:{{ action.pmCost }}</span
          >
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

      <div
        v-for="action in baseRuleActionsList"
        :key="action.source + '-' + action.name"
        class="action-bubble"
        :class="[
          familyClass(action.voieFamily),
          { 'action-bubble--info': action.actionType === 'info' },
        ]"
      >
        <div class="action-header">
          <span class="action-name">{{ action.name }}</span>
          <span class="badge" :class="`badge-${action.actionType}`">
            {{ actionTypeLabel(action.actionType) }}
          </span>
          <span v-if="action.pmCost != null" class="badge badge-pm"
            >PM:{{ action.pmCost }}</span
          >
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
  </div>
</template>

<style scoped>
.actions-page {
  max-width: 680px;
  margin: 0 auto;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--title-font);
  font-size: clamp(1.3rem, 4vw, 1.7rem);
  color: var(--brand-strong);
  margin-bottom: 1.25rem;
}

.loading-state,
.empty-state {
  text-align: center;
  color: var(--muted);
  padding: 3rem 1rem;
  font-size: 1rem;
}

.load-error-block {
  text-align: left;
  max-width: 520px;
  margin: 0 auto;
  padding: 1.25rem 1.1rem;
  border-radius: 1rem;
  border: 1px solid
    color-mix(in srgb, var(--danger, #c0392b) 45%, var(--border));
  background: color-mix(in srgb, var(--danger, #c0392b) 8%, var(--surface-2));
  color: var(--text);
}

.load-error-block p {
  margin: 0 0 0.85rem;
  line-height: 1.45;
  font-size: 0.92rem;
}

.btn-retry {
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  color: var(--brand-strong);
}

.btn-retry:hover {
  filter: brightness(1.05);
}

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

/* ── Badges type d'action ───────────────────────────────────────────────── */

.badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.18em 0.65em;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-limitée {
  background: color-mix(in srgb, #8e44ad 18%, transparent);
  color: #8e44ad;
  border: 1px solid color-mix(in srgb, #8e44ad 35%, transparent);
}

.badge-attaque {
  background: color-mix(in srgb, #e67e22 18%, transparent);
  color: #e67e22;
  border: 1px solid color-mix(in srgb, #e67e22 35%, transparent);
}

.badge-gratuite {
  background: color-mix(in srgb, #27ae60 18%, transparent);
  color: #27ae60;
  border: 1px solid color-mix(in srgb, #27ae60 35%, transparent);
}

.badge-info {
  background: color-mix(in srgb, var(--muted) 14%, transparent);
  color: var(--muted);
  border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
  text-transform: none;
  letter-spacing: 0.02em;
}

.badge-pm {
  background: color-mix(in srgb, #2980b9 20%, transparent);
  color: #2471a3;
  border: 1px solid color-mix(in srgb, #2980b9 38%, transparent);
  text-transform: none;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
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

/* ── Desktop : 2 colonnes ───────────────────────────────────────────────── */

@media (min-width: 600px) {
  .actions-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
    align-items: start;
  }
}
</style>

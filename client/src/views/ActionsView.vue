<script setup lang="ts">
import { computed, onMounted, ref, reactive, watch } from "vue";
import { Swords, ChevronDown, ChevronUp, CirclePlus, CircleMinus, Scroll, Dices, Sparkles, RefreshCw, Bandage, Shield } from "lucide-vue-next";
import AppPageHead from "../components/ui/AppPageHead.vue";
import AppBadge from "../components/ui/AppBadge.vue";
import AppEmptyState from "../components/ui/AppEmptyState.vue";
import AppButton from "../components/ui/AppButton.vue";
import PassifsCard from "../components/character-sheet/PassifsCard.vue";
import { useCharacter, loadCharacter, PR_MAX } from "../composables/useCharacter";
import { VOIES_BY_ID, type VoieFamily } from "../data/voies";
import { PEUPLE_VOIES_BY_ID } from "../data/peuples";
import { MYSTIC_TALENTS_BY_ID, isMysticTalentId } from "../data/mysticTalents";
import { inferProfileFamily } from "../utils/inferProfileFamily";
import {
  formatWeaponDamage,
  isMartialWeaponProficient,
} from "../utils/attackBonus";
import { rollDie, rollDiceNotation } from "../utils/dice";
import { MARTIAL_WEAPON_CATEGORY_BY_ID } from "../data/martialWeaponCategories";
import { useRollHistory } from "../composables/useRollHistory";
import { useDualWield, type SingleHandRoll } from "../composables/useDualWield";
import AgonieModal from "../components/AgonieModal.vue";

const { character, loading, loadError, computedAttackContact, computedAttackDistance, computedAttackMagique, computedHp, computedMp, computedDef, computedInitiative, computedPcMax, computedHpDv, computedHpConMod, abilityModifier } = useCharacter();
const { addRoll } = useRollHistory();
const {
  dualWieldRoll, dualWieldError,
  hasDualWieldVoie,
  isFinesseWeapon, weaponAttackBonus, setHandRole, rollDualWieldAction,
} = useDualWield(character, computedAttackContact, computedAttackDistance, abilityModifier);

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
    const finesse = isFinesseWeapon(w);
    const baseBonus = weaponAttackBonus(w);
    const incompetent = !isMartialWeaponProficient(w, c.martialFormations);
    const total = incompetent ? baseBonus - 3 : baseBonus;
    return {
      w,
      hitDisplay: `d20 ${total >= 0 ? "+" : ""}${total} (vs DEF)`,
      damageDisplay: formatWeaponDamage(
        w.damageDice,
        w.damageAbility,
        c.abilities,
      ),
      rangeDisplay: w.rangeMeters != null ? `${w.rangeMeters} m` : null,
      incompetent,
      isFinesseWeapon: finesse,
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

const competencesOpen = ref(false);
const manoeuversOpen = ref(false);
const defensiveOpen = ref(false);
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

// ── Lancers de dés ────────────────────────────────────────────────────────────

interface WeaponRollResult {
  attackDie: number;
  attackBonus: number;
  attackTotal: number;
  damageDice: string;
  damageRolls: number[];
  damageModifier: number;
  damageTotal: number;
  luckUsed: boolean;
}

interface ActionRollResult {
  attackDie: number;
  attackBonus: number;
  attackTotal: number;
  luckUsed: boolean;
}

const weaponRolls = reactive<Record<string, WeaponRollResult>>({});
const actionRolls = reactive<Record<string, ActionRollResult>>({});
const abilityRolls = reactive<Record<string, ActionRollResult>>({});
const lastRolledAbilityKey = ref<string | null>(null);
const manoeuverRolls = reactive<Record<string, ActionRollResult>>({});

function rollWeapon(item: (typeof weaponBubbles.value)[number]) {
  const effectiveBonus = weaponAttackBonus(item.w);
  const incompetentPenalty = item.incompetent ? -3 : 0;
  const attackBonus = effectiveBonus + incompetentPenalty;
  const attackDie = rollDie(20);
  const attackTotal = attackDie + attackBonus;

  const damageAbilityMod = item.w.damageAbility
    ? abilityModifier(character.value.abilities[item.w.damageAbility])
    : 0;
  const dmg = rollDiceNotation(item.w.damageDice, damageAbilityMod);

  weaponRolls[item.w.id] = {
    attackDie,
    attackBonus,
    attackTotal,
    damageDice: item.w.damageDice,
    damageRolls: dmg.rolls,
    damageModifier: damageAbilityMod,
    damageTotal: dmg.total,
    luckUsed: false,
  };
  addRoll({
    characterName: character.value.name,
    kind: 'weapon',
    label: item.w.name || 'Arme',
    die: attackDie,
    bonus: attackBonus,
    total: attackTotal,
    damage: { total: dmg.total, critical: attackDie === 20, fumble: attackDie === 1 },
  });
}

function rollDualWield() {
  const result = rollDualWieldAction();
  if (!result) return;

  const c = character.value;
  addRoll({
    characterName: c.name,
    kind: 'weapon',
    label: `${result.mainHand.weaponName} (main directrice)`,
    die: result.mainHand.attackDie,
    bonus: result.mainHand.attackBonus,
    total: result.mainHand.attackTotal,
    damage: { total: result.mainHand.damageTotal, critical: result.mainHand.attackDie === 20, fumble: result.mainHand.attackDie === 1 },
  });
  addRoll({
    characterName: c.name,
    kind: 'weapon',
    label: `${result.offHand.weaponName} (main faible)`,
    die: result.offHand.attackDie,
    bonus: result.offHand.attackBonus,
    total: result.offHand.attackTotal,
    damage: { total: result.offHand.damageTotal, critical: false, fumble: result.offHand.attackDie === 1 },
  });
}

function rollAction(action: Action) {
  if (action.name === 'Combat à deux armes') {
    return rollDualWield();
  }

  const bonus = computeBonus(action.attackType);
  if (bonus === null) return;

  // Déduire le coût en PM (brûlure de magie si insuffisant)
  if (action.pmCost != null && action.pmCost > 0) {
    const c = character.value;
    const available = c.mpCurrent;
    if (available >= action.pmCost) {
      c.mpCurrent = available - action.pmCost;
    } else {
      const deficit = action.pmCost - available;
      c.mpCurrent = 0;
      // Combattants : 1 PM manquant = 2 PV perdus ; autres : 1 PM = 1 PV
      const pvCost = profileFamily.value === 'combattants' ? deficit * 2 : deficit;
      c.hpCurrent = Math.max(0, c.hpCurrent - pvCost);
    }
  }

  const attackDie = rollDie(20);
  const key = action.source + '-' + action.name;
  actionRolls[key] = {
    attackDie,
    attackBonus: bonus,
    attackTotal: attackDie + bonus,
    luckUsed: false,
  };
  addRoll({
    characterName: character.value.name,
    kind: 'action',
    label: action.name,
    die: attackDie,
    bonus,
    total: attackDie + bonus,
  });
}

function spendLuck(roll: WeaponRollResult | ActionRollResult | SingleHandRoll, mode: 'reroll' | 'add10'): void {
  if (character.value.pcCurrent <= 0 || roll.luckUsed) return;
  if (mode === 'reroll') {
    roll.attackDie = rollDie(20);
    roll.attackTotal = roll.attackDie + roll.attackBonus;
  } else {
    roll.attackTotal += 10;
  }
  roll.luckUsed = true;
  character.value.pcCurrent = Math.max(0, character.value.pcCurrent - 1);
}

function rollAbility(key: string) {
  const score = character.value.abilities[key as keyof typeof character.value.abilities];
  const mod = abilityModifier(score);
  const die = rollDie(20);
  abilityRolls[key] = { attackDie: die, attackBonus: mod, attackTotal: die + mod, luckUsed: false };
  lastRolledAbilityKey.value = key;
  addRoll({
    characterName: character.value.name,
    kind: 'ability',
    label: ABILITY_LABELS.find((a) => a.key === key)?.label ?? key,
    die,
    bonus: mod,
    total: die + mod,
  });
}

function rollManoeuvre(name: string) {
  const die = rollDie(20);
  const bonus = computedAttackContact.value;
  manoeuverRolls[name] = { attackDie: die, attackBonus: bonus, attackTotal: die + bonus, luckUsed: false };
  addRoll({
    characterName: character.value.name,
    kind: 'manoeuvre',
    label: name,
    die,
    bonus,
    total: die + bonus,
  });
}

const competenceRolls = reactive<Record<string, ActionRollResult>>({});

function rollCompetence(id: string) {
  const comp = character.value.competences.find((c) => c.id === id);
  if (!comp) return;
  const abilityBonus = comp.ability ? abilityModifier(character.value.abilities[comp.ability]) : 0;
  const bonus = abilityBonus + comp.bonus;
  const die = rollDie(20);
  competenceRolls[id] = { attackDie: die, attackBonus: bonus, attackTotal: die + bonus, luckUsed: false };
  addRoll({
    characterName: character.value.name,
    kind: 'competence',
    label: comp.name || 'Compétence',
    die,
    bonus,
    total: die + bonus,
  });
}

function signedNum(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

const showAgonie = ref(false)
const isStabilised = ref(false)

watch(
  () => character.value.hpCurrent,
  (hp) => {
    if (loading.value) return
    if (hp === 0 && !isStabilised.value) {
      showAgonie.value = true
    }
    if (hp > 0) {
      isStabilised.value = false
      showAgonie.value = false
    }
  },
  { immediate: true },
)

function onStabilise() {
  showAgonie.value = false
  isStabilised.value = true
}

function onDeath() {
  showAgonie.value = false
}

// ── Repos (PR) ────────────────────────────────────────────────────────────────
const showReposConfirm = ref(false)

interface ReposRollResult {
  roll: number
  conMod: number
  level: number
  total: number
  hpBefore: number
  hpAfter: number
}
const reposResult = ref<ReposRollResult | null>(null)

function confirmerRepos() {
  const c = character.value
  if (c.prCurrent <= 0) return
  const dv = computedHpDv.value
  const conMod = computedHpConMod.value
  const roll = rollDie(dv)
  const gain = Math.max(1, roll + conMod + c.level)
  const hpBefore = c.hpCurrent
  c.prCurrent -= 1
  c.hpCurrent = Math.min(computedHp.value, c.hpCurrent + gain)
  reposResult.value = { roll, conMod, level: c.level, total: gain, hpBefore, hpAfter: c.hpCurrent }
  showReposConfirm.value = false
}

function gainPr() {
  if (character.value.prCurrent < PR_MAX) character.value.prCurrent += 1
}

function losePr() {
  if (character.value.prCurrent > 0) character.value.prCurrent -= 1
}
</script>

<template>
  <div class="actions-page">
    <AgonieModal
      v-if="showAgonie"
      :character-name="character.name"
      @stabilise="onStabilise"
      @death="onDeath"
      @close="showAgonie = false"
    />

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
      <!-- Init / DEF / PC / PR -->
      <div class="ch-secondary">
        <div class="ch-sec-chip">
          <span class="ch-sec-label">INIT</span>
          <span class="ch-sec-value">{{ computedInitiative }}</span>
        </div>
        <div class="ch-sec-chip">
          <span class="ch-sec-label">DEF</span>
          <span class="ch-sec-value">{{ computedDef }}</span>
        </div>
        <div class="ch-sec-chip">
          <span class="ch-sec-label">PC</span>
          <span class="ch-sec-value">{{ character.pcCurrent }}<span class="ch-sec-max">/{{ computedPcMax }}</span></span>
        </div>
        <button type="button" class="ch-sec-chip ch-sec-chip--pr" @click="showReposConfirm = true; reposResult = null">
          <span class="ch-sec-label">PR</span>
          <span class="ch-sec-value-row">
            <span class="ch-sec-value">{{ character.prCurrent }}<span class="ch-sec-max">/5</span></span>
            <Bandage :size="15" class="pr-bandage-icon" />
          </span>
        </button>
      </div>
      <!-- Caractéristiques -->
      <div class="ch-abilities">
        <div
          v-for="ab in ABILITY_LABELS"
          :key="ab.key"
          class="ch-ability"
          role="button"
          @click="rollAbility(ab.key)"
        >
          <span class="ch-ab-label">{{ ab.label }}</span>
          <span class="ch-ab-mod" :class="abilityModifier(character.abilities[ab.key]) > 0 ? 'mod-pos' : abilityModifier(character.abilities[ab.key]) < 0 ? 'mod-neg' : 'mod-zero'">{{ modDisplay(character.abilities[ab.key]) }}</span>
          <span class="ch-ab-score">{{ character.abilities[ab.key] }}</span>
        </div>
      </div>
      <div v-if="lastRolledAbilityKey && abilityRolls[lastRolledAbilityKey]" class="ability-roll-zone">
        <div
          class="roll-result"
          :class="{
            'roll-result--fumble': abilityRolls[lastRolledAbilityKey].attackDie === 1,
            'roll-result--critical': abilityRolls[lastRolledAbilityKey].attackDie === 20,
          }"
        >
          <span class="roll-result__attack">
            Test {{ ABILITY_LABELS.find(a => a.key === lastRolledAbilityKey)?.label }} :
            <strong>{{ abilityRolls[lastRolledAbilityKey].attackTotal }}</strong>
            <span class="roll-result__detail">(dé {{ abilityRolls[lastRolledAbilityKey].attackDie }} {{ signedNum(abilityRolls[lastRolledAbilityKey].attackBonus) }})</span>
          </span>
          <span v-if="abilityRolls[lastRolledAbilityKey].attackDie === 1" class="roll-result__crit-label">Échec critique</span>
          <span v-else-if="abilityRolls[lastRolledAbilityKey].attackDie === 20" class="roll-result__crit-label">Réussite critique</span>
        </div>
        <div v-if="!abilityRolls[lastRolledAbilityKey].luckUsed && character.pcCurrent > 0" class="luck-box">
          <span class="luck-box__title"><Sparkles :size="13" /> Utiliser la chance <span class="luck-box__pc">{{ character.pcCurrent }} PC</span></span>
          <div class="luck-box__actions">
            <button type="button" class="luck-btn" @click.stop="spendLuck(abilityRolls[lastRolledAbilityKey!], 'reroll')">
              <RefreshCw :size="13" /> Relancer le d20
            </button>
            <button type="button" class="luck-btn" @click.stop="spendLuck(abilityRolls[lastRolledAbilityKey!], 'add10')">
              +10 au résultat
            </button>
          </div>
        </div>
      </div>
    </div>

    <AppEmptyState v-if="loading" variant="loading">Chargement…</AppEmptyState>

    <AppEmptyState v-else-if="loadError" variant="error">
      <p>{{ loadError }}</p>
      <template #actions>
        <AppButton size="small" @click="retryLoad">Réessayer</AppButton>
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

        <div v-if="hasDualWieldVoie && item.w.attackType === 'contact'" class="hand-role-selector">
          <button
            v-for="role in ([null, 'main', 'offhand'] as const)"
            :key="role ?? 'none'"
            type="button"
            :class="['hand-role-btn', { active: item.w.handRole === role || (!item.w.handRole && role === null) }]"
            @click="setHandRole(item.w, role)"
          >
            {{ role === null ? '—' : role === 'main' ? 'Main directrice' : 'Main faible' }}
          </button>
        </div>

        <template v-if="weaponRolls[item.w.id]">
          <div
            class="roll-result"
            :class="{
              'roll-result--fumble': weaponRolls[item.w.id].attackDie === 1,
              'roll-result--critical': weaponRolls[item.w.id].attackDie === 20,
            }"
          >
            <span class="roll-result__attack">
              Attaque : <strong>{{ weaponRolls[item.w.id].attackTotal }}</strong>
              <span class="roll-result__detail">(dé {{ weaponRolls[item.w.id].attackDie }} {{ signedNum(weaponRolls[item.w.id].attackBonus) }})</span>
            </span>
            <span v-if="weaponRolls[item.w.id].attackDie === 1" class="roll-result__crit-label">
              Échec critique
            </span>
            <template v-else-if="weaponRolls[item.w.id].attackDie === 20">
              <span class="roll-result__crit-label">Réussite critique</span>
              <span class="roll-result__damage">
                Dégâts : <strong>{{ weaponRolls[item.w.id].damageTotal * 2 }}</strong>
                <span class="roll-result__detail">({{ weaponRolls[item.w.id].damageRolls.join('+') }}{{ weaponRolls[item.w.id].damageModifier !== 0 ? ' ' + signedNum(weaponRolls[item.w.id].damageModifier) : '' }} × 2)</span>
              </span>
            </template>
            <span v-else class="roll-result__damage">
              Dégâts : <strong>{{ weaponRolls[item.w.id].damageTotal }}</strong>
              <span class="roll-result__detail">({{ weaponRolls[item.w.id].damageRolls.join('+') }}{{ weaponRolls[item.w.id].damageModifier !== 0 ? ' ' + signedNum(weaponRolls[item.w.id].damageModifier) : '' }})</span>
            </span>
          </div>
          <div v-if="!weaponRolls[item.w.id].luckUsed && character.pcCurrent > 0" class="luck-box">
            <span class="luck-box__title"><Sparkles :size="13" /> Utiliser la chance <span class="luck-box__pc">{{ character.pcCurrent }} PC</span></span>
            <div class="luck-box__actions">
              <button type="button" class="luck-btn" @click="spendLuck(weaponRolls[item.w.id], 'reroll')">
                <RefreshCw :size="13" /> Relancer le d20
              </button>
              <button type="button" class="luck-btn" @click="spendLuck(weaponRolls[item.w.id], 'add10')">
                +10 au résultat
              </button>
            </div>
          </div>
        </template>

        <div class="action-footer">
          <div class="action-source">
            Arme · {{ MARTIAL_WEAPON_CATEGORY_BY_ID[item.w.martialFamily] }}
          </div>
          <button type="button" class="roll-btn" @click="rollWeapon(item)">
            <Dices :size="15" />
            Lancer les dés
          </button>
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

        <!-- Résultat spécial : Combat à deux armes -->
        <template v-if="action.name === 'Combat à deux armes'">
          <p v-if="dualWieldError" class="weapon-incompetent-hint">
            Désignez une main directrice et une main faible dans la liste des armes.
          </p>
          <template v-if="dualWieldRoll">
            <!-- Main directrice (d20) -->
            <div
              class="roll-result"
              :class="{
                'roll-result--fumble': dualWieldRoll.mainHand.attackDie === 1,
                'roll-result--critical': dualWieldRoll.mainHand.attackDie === 20,
              }"
            >
              <span class="roll-result__hand-label">Main directrice · {{ dualWieldRoll.mainHand.weaponName }}</span>
              <span class="roll-result__attack">
                Attaque : <strong>{{ dualWieldRoll.mainHand.attackTotal }}</strong>
                <span class="roll-result__detail">(d20 {{ signedNum(dualWieldRoll.mainHand.attackBonus) }})</span>
              </span>
              <span v-if="dualWieldRoll.mainHand.attackDie === 1" class="roll-result__crit-label">Échec critique</span>
              <template v-else-if="dualWieldRoll.mainHand.attackDie === 20">
                <span class="roll-result__crit-label">Réussite critique</span>
                <span class="roll-result__damage">
                  Dégâts : <strong>{{ dualWieldRoll.mainHand.damageTotal * 2 }}</strong>
                  <span class="roll-result__detail">({{ dualWieldRoll.mainHand.damageRolls.join('+') }}{{ dualWieldRoll.mainHand.damageModifier !== 0 ? ' ' + signedNum(dualWieldRoll.mainHand.damageModifier) : '' }} × 2)</span>
                </span>
              </template>
              <span v-else class="roll-result__damage">
                Dégâts : <strong>{{ dualWieldRoll.mainHand.damageTotal }}</strong>
                <span class="roll-result__detail">({{ dualWieldRoll.mainHand.damageRolls.join('+') }}{{ dualWieldRoll.mainHand.damageModifier !== 0 ? ' ' + signedNum(dualWieldRoll.mainHand.damageModifier) : '' }})</span>
              </span>
            </div>
            <div v-if="!dualWieldRoll.mainHand.luckUsed && character.pcCurrent > 0" class="luck-box">
              <span class="luck-box__title"><Sparkles :size="13" /> Utiliser la chance <span class="luck-box__pc">{{ character.pcCurrent }} PC</span></span>
              <div class="luck-box__actions">
                <button type="button" class="luck-btn" @click="spendLuck(dualWieldRoll.mainHand, 'reroll')">
                  <RefreshCw :size="13" /> Relancer le d20
                </button>
                <button type="button" class="luck-btn" @click="spendLuck(dualWieldRoll.mainHand, 'add10')">
                  +10 au résultat
                </button>
              </div>
            </div>
            <!-- Main faible (d12) -->
            <div
              class="roll-result roll-result--offhand"
              :class="{ 'roll-result--fumble': dualWieldRoll.offHand.attackDie === 1 }"
            >
              <span class="roll-result__hand-label">Main faible · {{ dualWieldRoll.offHand.weaponName }}</span>
              <span class="roll-result__attack">
                Attaque : <strong>{{ dualWieldRoll.offHand.attackTotal }}</strong>
                <span class="roll-result__detail">(d12 {{ signedNum(dualWieldRoll.offHand.attackBonus) }})</span>
              </span>
              <span v-if="dualWieldRoll.offHand.attackDie === 1" class="roll-result__crit-label">Échec critique</span>
              <span v-else class="roll-result__damage">
                Dégâts : <strong>{{ dualWieldRoll.offHand.damageTotal }}</strong>
                <span class="roll-result__detail">({{ dualWieldRoll.offHand.damageRolls.join('+') }}{{ dualWieldRoll.offHand.damageModifier !== 0 ? ' ' + signedNum(dualWieldRoll.offHand.damageModifier) : '' }})</span>
              </span>
            </div>
          </template>
        </template>

        <!-- Résultat standard pour toutes les autres actions -->
        <template v-else-if="actionRolls[action.source + '-' + action.name]">
          <div class="roll-result">
            <span class="roll-result__attack">
              Attaque : <strong>{{ actionRolls[action.source + '-' + action.name].attackTotal }}</strong>
              <span class="roll-result__detail">(dé {{ actionRolls[action.source + '-' + action.name].attackDie }} {{ signedNum(actionRolls[action.source + '-' + action.name].attackBonus) }})</span>
            </span>
          </div>
          <div v-if="!actionRolls[action.source + '-' + action.name].luckUsed && character.pcCurrent > 0" class="luck-box">
            <span class="luck-box__title"><Sparkles :size="13" /> Utiliser la chance <span class="luck-box__pc">{{ character.pcCurrent }} PC</span></span>
            <div class="luck-box__actions">
              <button type="button" class="luck-btn" @click="spendLuck(actionRolls[action.source + '-' + action.name], 'reroll')">
                <RefreshCw :size="13" /> Relancer le d20
              </button>
              <button type="button" class="luck-btn" @click="spendLuck(actionRolls[action.source + '-' + action.name], 'add10')">
                +10 au résultat
              </button>
            </div>
          </div>
        </template>

        <div class="action-footer">
          <div class="action-source">{{ action.source }}</div>
          <button
            v-if="action.attackType || action.name === 'Combat à deux armes'"
            type="button"
            class="roll-btn"
            @click="rollAction(action)"
          >
            <Dices :size="15" />
            Lancer les dés
          </button>
        </div>
      </div>

      <!-- Compétences collapsibles -->
      <div
        v-if="character.competences && character.competences.length"
        class="action-bubble competences-group"
        :class="{ 'competences-group--open': competencesOpen }"
        @click.self="competencesOpen = !competencesOpen"
      >
        <div class="action-header competences-header" @click="competencesOpen = !competencesOpen">
          <span class="action-name">Compétences</span>
          <span class="competences-count">{{ character.competences.length }}</span>
          <ChevronUp v-if="competencesOpen" :size="16" class="competences-chevron" />
          <ChevronDown v-else :size="16" class="competences-chevron" />
        </div>
        <p v-if="!competencesOpen" class="action-description competences-hint">
          {{ character.competences.map(c => c.name || 'Compétence').join(', ') }}
        </p>
        <template v-if="competencesOpen">
          <div class="competences-list">
            <div
              v-for="comp in character.competences"
              :key="'comp-' + comp.id"
              class="action-bubble competence-bubble"
              @click.stop
            >
              <div class="action-header">
                <span class="action-name">{{ comp.name || 'Compétence' }}</span>
                <span class="attack-roll">
                  d20
                  <template v-if="comp.ability">
                    {{ signedNum(abilityModifier(character.abilities[comp.ability])) }} ({{ { strength: 'FOR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'SAG', charisma: 'CHA' }[comp.ability] }})
                  </template>
                  <template v-if="comp.bonus !== 0">{{ signedNum(comp.bonus) }} bonus</template>
                </span>
              </div>

              <template v-if="competenceRolls[comp.id]">
                <div
                  class="roll-result"
                  :class="{
                    'roll-result--fumble': competenceRolls[comp.id].attackDie === 1,
                    'roll-result--critical': competenceRolls[comp.id].attackDie === 20,
                  }"
                >
                  <span class="roll-result__attack">
                    Test : <strong>{{ competenceRolls[comp.id].attackTotal }}</strong>
                    <span class="roll-result__detail">(dé {{ competenceRolls[comp.id].attackDie }} {{ signedNum(competenceRolls[comp.id].attackBonus) }})</span>
                  </span>
                  <span v-if="competenceRolls[comp.id].attackDie === 1" class="roll-result__crit-label">Échec critique</span>
                  <span v-else-if="competenceRolls[comp.id].attackDie === 20" class="roll-result__crit-label">Réussite critique</span>
                </div>
                <div v-if="!competenceRolls[comp.id].luckUsed && character.pcCurrent > 0" class="luck-box">
                  <span class="luck-box__title"><Sparkles :size="13" /> Utiliser la chance <span class="luck-box__pc">{{ character.pcCurrent }} PC</span></span>
                  <div class="luck-box__actions">
                    <button type="button" class="luck-btn" @click="spendLuck(competenceRolls[comp.id], 'reroll')">
                      <RefreshCw :size="13" /> Relancer le d20
                    </button>
                    <button type="button" class="luck-btn" @click="spendLuck(competenceRolls[comp.id], 'add10')">
                      +10 au résultat
                    </button>
                  </div>
                </div>
              </template>

              <div class="action-footer">
                <div class="action-source">Compétence personnalisée</div>
                <button type="button" class="roll-btn" @click="rollCompetence(comp.id)">
                  <Dices :size="15" /> Lancer les dés
                </button>
              </div>
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
              <template v-if="manoeuverRolls[m.name]">
                <div class="roll-result">
                  <span class="roll-result__attack">
                    Attaque : <strong>{{ manoeuverRolls[m.name].attackTotal }}</strong>
                    <span class="roll-result__detail">(dé {{ manoeuverRolls[m.name].attackDie }} {{ signedNum(manoeuverRolls[m.name].attackBonus) }})</span>
                  </span>
                </div>
                <div v-if="!manoeuverRolls[m.name].luckUsed && character.pcCurrent > 0" class="luck-box">
                  <span class="luck-box__title"><Sparkles :size="13" /> Utiliser la chance <span class="luck-box__pc">{{ character.pcCurrent }} PC</span></span>
                  <div class="luck-box__actions">
                    <button type="button" class="luck-btn" @click="spendLuck(manoeuverRolls[m.name], 'reroll')">
                      <RefreshCw :size="13" /> Relancer le d20
                    </button>
                    <button type="button" class="luck-btn" @click="spendLuck(manoeuverRolls[m.name], 'add10')">
                      +10 au résultat
                    </button>
                  </div>
                </div>
              </template>
              <div class="action-footer">
                <div class="action-source">Manoeuvre</div>
                <button type="button" class="roll-btn" @click="rollManoeuvre(m.name)">
                  <Dices :size="15" /> Lancer les dés
                </button>
              </div>
            </div>
          </div>
          <p v-if="MANOEUVRES.some(m => m.sizePenalty)" class="action-description manoeuvres-footnote">
            * Pénalité de taille : -5 au test d'attaque par catégorie de taille d'écart si l'attaquant est plus petit que sa cible.
          </p>
        </template>
      </div>

      <!-- Actions défensives collapsibles -->
      <div
        class="action-bubble defensive-group"
        :class="{ 'defensive-group--open': defensiveOpen }"
        @click.self="defensiveOpen = !defensiveOpen"
      >
        <div class="action-header defensive-header" @click="defensiveOpen = !defensiveOpen">
          <Shield :size="15" class="defensive-icon" />
          <span class="action-name">Actions défensives</span>
          <span class="defensive-count">2</span>
          <ChevronUp v-if="defensiveOpen" :size="16" class="defensive-chevron" />
          <ChevronDown v-else :size="16" class="defensive-chevron" />
        </div>
        <p v-if="!defensiveOpen" class="action-description defensive-hint">
          Défense simple, défense totale.
        </p>
        <template v-if="defensiveOpen">
          <div class="defensive-list">
            <div class="action-bubble defensive-bubble" @click.stop>
              <div class="action-header">
                <span class="action-name">Défense simple</span>
                <AppBadge variant="attaque">Attaque</AppBadge>
              </div>
              <p class="action-description">Sacrifier une attaque pour gagner +2 en DEF jusqu'au prochain tour.</p>
              <div class="defensive-def-bonus">DEF {{ computedDef }} → {{ computedDef + 2 }}</div>
            </div>
            <div class="action-bubble defensive-bubble" @click.stop>
              <div class="action-header">
                <span class="action-name">Défense totale</span>
                <AppBadge variant="limitée">Limitée</AppBadge>
              </div>
              <p class="action-description">Ne faire que se défendre ; +4 en DEF jusqu'au prochain tour.</p>
              <div class="defensive-def-bonus">DEF {{ computedDef }} → {{ computedDef + 4 }}</div>
            </div>
          </div>
        </template>
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

      <template v-if="hasPassifs">
        <div class="passifs-divider" />
        <PassifsCard :character="character" class="passifs-in-actions" />
      </template>
    </div>

    <!-- Modal PR -->
    <Teleport to="body">
      <div v-if="showReposConfirm" class="modal-backdrop" @click.self="showReposConfirm = false">
        <div class="modal-box">
          <p class="modal-question">Points de récupération</p>

          <!-- PR dots -->
          <div class="pr-dots-modal">
            <div
              v-for="i in PR_MAX"
              :key="i"
              class="pr-dot-modal"
              :class="{ used: i > character.prCurrent }"
            />
          </div>
          <p class="pr-count-label">{{ character.prCurrent }} / {{ PR_MAX }}</p>

          <!-- Rest button -->
          <button
            class="btn-modal btn-modal--primary btn-modal--rest"
            :disabled="character.prCurrent <= 0"
            @click="confirmerRepos"
          >
            <Bandage :size="16" />
            Se reposer
          </button>
          <p class="modal-hint">Dépense 1 PR — regagne 1d{{ computedHpDv }} + Mod. CON + Niv.</p>

          <!-- +/- PR manual -->
          <div class="pr-manual-row">
            <button class="btn-modal btn-modal--round" :disabled="character.prCurrent <= 0" @click="losePr">
              <CircleMinus :size="20" />
            </button>
            <span class="pr-manual-label">Ajuster les PR</span>
            <button class="btn-modal btn-modal--round" :disabled="character.prCurrent >= PR_MAX" @click="gainPr">
              <CirclePlus :size="20" />
            </button>
          </div>

          <div class="modal-actions">
            <button class="btn-modal btn-modal--ghost" @click="showReposConfirm = false">Fermer</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Résultat repos -->
    <Teleport to="body">
      <div v-if="reposResult" class="modal-backdrop" @click.self="reposResult = null">
        <div class="modal-box">
          <p class="modal-question">Repos — soin</p>
          <p class="modal-heal">
            +{{ reposResult!.total }} PV
            <span class="modal-detail">({{ reposResult!.roll }} {{ reposResult!.conMod >= 0 ? '+' : '' }}{{ reposResult!.conMod }} CON + {{ reposResult!.level }} niv.)</span>
          </p>
          <p class="modal-hp-change">{{ reposResult!.hpBefore }} → <strong>{{ reposResult!.hpAfter }}</strong> PV</p>
          <div class="modal-actions">
            <button class="btn-modal btn-modal--primary" @click="reposResult = null">OK</button>
          </div>
        </div>
      </div>
    </Teleport>

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

.ch-secondary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.35rem;
}

.ch-sec-chip {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.65rem;
  border: 1px solid var(--border);
  background: var(--surface);
}

.ch-sec-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.ch-sec-value {
  font-size: 0.95rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.ch-sec-value-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.pr-bandage-icon {
  color: #3a8a4a;
  flex-shrink: 0;
}
:root[data-theme="dark"] .pr-bandage-icon { color: #7bcf8a; }

.ch-sec-max {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--muted);
}

.ch-sec-chip--pr {
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  transition: background 120ms, border-color 120ms;
  text-align: center;
  font: inherit;
}
.ch-sec-chip--pr:hover {
  border-color: #3a8a4a;
  background: color-mix(in srgb, #3a8a4a 10%, var(--surface));
}

/* ── Modals repos ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-box {
  background: var(--surface);
  border: 1.5px solid var(--border-strong);
  border-radius: 16px;
  padding: 1.5rem 1.5rem 1.25rem;
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
}

.modal-question {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  font-style: italic;
}

.modal-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.modal-heal {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: #3a8a4a;
}
:root[data-theme="dark"] .modal-heal { color: #7bcf8a; }

.modal-detail {
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--muted);
  display: block;
}

.modal-hp-change {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
}
.modal-hp-change strong { color: var(--text); }

.modal-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.4rem;
}

.btn-modal {
  padding: 0.5rem 1.4rem;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-modal--primary {
  background: var(--accent);
  color: #fff;
}
.btn-modal--primary:hover { background: var(--accent-strong); }
.btn-modal--ghost {
  background: var(--surface-2);
  color: var(--muted);
  border: 1px solid var(--border);
}
.btn-modal--ghost:hover { color: var(--text); }

.btn-modal--rest {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  justify-content: center;
}
.btn-modal--rest:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-modal--round {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, border-color 0.15s;
}
.btn-modal--round:hover:not(:disabled) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-2));
}
.btn-modal--round:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pr-dots-modal {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.pr-dot-modal {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2.5px solid var(--accent, #7c5cbf);
  background: color-mix(in srgb, var(--accent, #7c5cbf) 35%, var(--surface-2));
  transition: background 0.2s, border-color 0.2s, opacity 0.2s;
}

.pr-dot-modal.used {
  background: var(--surface-2);
  border-color: var(--border);
  opacity: 0.4;
}

.pr-count-label {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
  font-weight: 600;
}

.pr-manual-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
  width: 100%;
  justify-content: center;
}

.pr-manual-label {
  font-size: 0.82rem;
  color: var(--muted);
  font-weight: 500;
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
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.ch-ab-score {
  font-size: 0.65rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  line-height: 1;
}

.mod-pos { color: #3a8a4a; }
:root[data-theme="dark"] .mod-pos { color: #7bcf8a; }
.mod-neg { color: #c95f56; }
.mod-zero { color: var(--muted); }

.ch-ability {
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ch-ability:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}


/* ── Zone résultat sous la grille de carac ──────────────────────────────── */

.ability-roll-zone {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.15rem;
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

/* ── Compétences group ──────────────────────────────────────────────────── */

.competences-group {
  cursor: pointer;
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--accent) 5%, var(--surface-2));
}

.competences-group--open {
  cursor: default;
}

.competences-header {
  cursor: pointer;
  user-select: none;
}

.competences-count {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  margin-left: auto;
}

.competences-chevron { opacity: 0.6; }
.competences-hint { font-style: italic; color: var(--muted); font-size: 0.85rem; margin: 0.4rem 0 0; }

.competences-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.6rem;
}

.competence-bubble {
  background: var(--surface);
  cursor: default;
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

/* ── Defensive group ────────────────────────────────────────────────────── */

.defensive-group {
  cursor: pointer;
  border-color: color-mix(in srgb, #3498db 35%, var(--border));
  background: color-mix(in srgb, #3498db 5%, var(--surface-2));
}

.defensive-group--open {
  cursor: default;
}

.defensive-header {
  cursor: pointer;
  user-select: none;
}

.defensive-icon {
  color: #3498db;
  flex-shrink: 0;
}

.defensive-count {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.1em 0.55em;
  border-radius: 999px;
}

.defensive-chevron {
  color: var(--muted);
  flex-shrink: 0;
}

.defensive-hint {
  font-style: italic;
}

.defensive-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.defensive-bubble {
  background: var(--surface);
  border-color: color-mix(in srgb, #3498db 20%, var(--border));
  cursor: default;
  padding: 0.75rem 0.9rem 0.65rem;
}

.defensive-bubble:hover {
  border-color: color-mix(in srgb, #3498db 50%, var(--border));
}

.defensive-def-bonus {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #3498db;
  background: color-mix(in srgb, #3498db 10%, var(--surface));
  border: 1px solid color-mix(in srgb, #3498db 25%, var(--border));
  border-radius: 0.5rem;
  padding: 0.25rem 0.6rem;
  margin-top: 0.2rem;
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
  .competences-group,
  .manoeuvres-group,
  .defensive-group,
  .divers-group {
    grid-column: 1 / -1;
  }

  .manoeuvres-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
}

/* ── Footer (source + bouton jet) ───────────────────────────────────────── */

.action-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.1rem;
  flex-wrap: wrap;
}

/* ── Bouton "Lancer le jet" ─────────────────────────────────────────────── */

.roll-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3em 0.75em;
  border-radius: 999px;
  border: 1.5px solid var(--accent);
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.roll-btn:hover {
  background: var(--accent);
  color: #fff;
}

/* ── Résultat du jet ────────────────────────────────────────────────────── */

.roll-result {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  font-size: 0.85rem;
}

.roll-result__attack,
.roll-result__damage {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  color: var(--text);
}

.roll-result__attack strong,
.roll-result__damage strong {
  font-size: 1.1rem;
  color: var(--accent-strong);
}

.roll-result__detail {
  font-size: 0.75rem;
  color: var(--muted);
  font-family: var(--mono-font, monospace);
}

/* ── Fumble (1) ─────────────────────────────────────────────────────────── */

.roll-result--fumble {
  background: color-mix(in srgb, #c95f56 10%, var(--surface));
  border-color: #c95f56;
}

.roll-result--fumble .roll-result__attack,
.roll-result--fumble .roll-result__attack strong {
  color: #c95f56;
}

/* ── Critique (20) ──────────────────────────────────────────────────────── */

.roll-result--critical {
  background: color-mix(in srgb, #d4ac0d 10%, var(--surface));
  border-color: #d4ac0d;
}

.roll-result--critical .roll-result__attack,
.roll-result--critical .roll-result__attack strong {
  color: #c8950a;
}

/* ── Label critique / fumble ────────────────────────────────────────────── */

.roll-result__crit-label {
  width: 100%;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.roll-result--fumble .roll-result__crit-label {
  color: #c95f56;
}

.roll-result--critical .roll-result__crit-label {
  color: #c8950a;
}

/* ── Combat à deux armes : sélecteur de rôle ───────────────────────────── */

.hand-role-selector {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.hand-role-btn {
  flex: 1;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 0.72rem;
  cursor: pointer;
  background: transparent;
  color: var(--muted);
}

.hand-role-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

/* ── Main faible (offhand) ──────────────────────────────────────────────── */

.roll-result--offhand {
  border-style: dashed;
  opacity: 0.92;
}

.roll-result__hand-label {
  width: 100%;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

/* ── Box "Utiliser la chance" ───────────────────────────────────────────── */

.luck-box {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.7rem;
  background: color-mix(in srgb, #d4ac0d 10%, var(--surface));
  border: 1.5px solid color-mix(in srgb, #d4ac0d 45%, var(--border));
}

.luck-box__title {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: color-mix(in srgb, #d4ac0d 80%, var(--text));
}

.luck-box__pc {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.1em 0.5em;
  border-radius: 999px;
}

.luck-box__actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.luck-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3em 0.7em;
  border-radius: 999px;
  border: 1.5px solid color-mix(in srgb, #d4ac0d 60%, var(--border));
  background: transparent;
  color: color-mix(in srgb, #d4ac0d 80%, var(--text));
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.luck-btn:hover {
  background: color-mix(in srgb, #d4ac0d 20%, var(--surface));
  border-color: #d4ac0d;
}
</style>

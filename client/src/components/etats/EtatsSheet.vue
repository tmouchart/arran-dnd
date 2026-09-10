<script setup lang="ts">
import { ref, watch } from 'vue'
import AppBottomSheet from '../ui/AppBottomSheet.vue'
import { ETATS, sortEtats, type EtatId } from '../../data/etats'
import { showToast } from '../../composables/useToast'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** Le porteur des etats — affiche dans le titre. */
  name: string
  states: readonly string[]
  /**
   * L'ecriture cote serveur. Absente sur sa propre fiche : la sauvegarde auto
   * de la fiche se charge d'ecrire `character.states`.
   */
  apply?: (states: EtatId[]) => Promise<void>
}>()

const emit = defineEmits<{ (e: 'update:states', states: EtatId[]): void }>()

const local = ref<EtatId[]>(sortEtats(props.states).map((e) => e.id))

watch(
  () => props.states,
  (v) => { local.value = sortEtats(v).map((e) => e.id) },
)

// Chaque tap ecrit tout de suite : pas de bouton Valider. On affiche le
// resultat sans attendre, et on revient en arriere si le serveur refuse.
async function toggle(id: EtatId) {
  const before = local.value
  const next = before.includes(id) ? before.filter((x) => x !== id) : [...before, id]
  local.value = next
  emit('update:states', next)
  if (!props.apply) return
  try {
    await props.apply(next)
  } catch {
    local.value = before
    emit('update:states', before)
    showToast("L'état n'a pas pu être enregistré.")
  }
}
</script>

<template>
  <!-- Le libelle texte sous l'icone deroge a la regle « boutons icone seule »
       du projet : cet ecran s'ouvre rarement et sous pression en combat, 13
       pictogrammes de meme teinte sans mot y sont illisibles.
       AppToggleGroup ne convient pas : il est mono-selection, or on peut etre
       Renverse *et* Desarme. Ces toggles restent donc locaux au composant. -->
  <AppBottomSheet v-model="open" :title="`États — ${name}`">
    <div class="etats-grid">
      <button
        v-for="e in ETATS"
        :key="e.id"
        type="button"
        class="etat-toggle"
        :class="[`etat-toggle--${e.id}`, { active: local.includes(e.id) }]"
        :data-testid="`etat-toggle-${e.id}`"
        :aria-pressed="local.includes(e.id)"
        :title="e.effect"
        @click="toggle(e.id)"
      >
        <component :is="e.icon" v-if="e.icon" :size="18" class="etat-toggle-icon" />
        <span v-else class="etat-toggle-emoji">{{ e.emoji }}</span>
        <span class="etat-toggle-label">{{ e.label }}</span>
      </button>
    </div>
  </AppBottomSheet>
</template>

<style scoped>
.etats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-xs);
}

@media (min-width: 480px) {
  .etats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.etat-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-height: 56px;
  padding: var(--space-xs);
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.1;
  text-align: center;
  cursor: pointer;
  color: var(--muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-style: solid;
  border-radius: var(--radius-md);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.etat-toggle:hover {
  border-color: color-mix(in srgb, var(--etat) 45%, transparent);
  color: var(--etat);
}

.etat-toggle.active {
  background: color-mix(in srgb, var(--etat) 18%, transparent);
  border-color: color-mix(in srgb, var(--etat) 45%, transparent);
  color: var(--etat);
}

/* Affaibli reste violet : c'est le seul etat qui change une regle de jet. */
.etat-toggle--affaibli {
  --etat: var(--etat-affaibli);
}

.etat-toggle--renverse .etat-toggle-icon {
  transform: rotate(90deg);
}

.etat-toggle-emoji {
  font-size: 1.05rem;
  line-height: 1;
}

.etat-toggle-label {
  overflow-wrap: anywhere;
}
</style>

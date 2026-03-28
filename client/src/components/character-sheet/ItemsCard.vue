<script setup lang="ts">
import { ref, nextTick } from "vue";
import AppCard from "../ui/AppCard.vue";
import AppInput from "../ui/AppInput.vue";
import AppIconBtn from "../ui/AppIconBtn.vue";
import { Plus, Trash2, Pencil } from "lucide-vue-next";
import type { Character } from "../../types/character";

const props = defineProps<{ character: Character }>();

const editingField = ref<string | null>(null);

const isMobile = () => window.matchMedia("(max-width: 600px)").matches;

function startEdit(itemId: string, field: "name" | "desc") {
  if (isMobile() && field === "name") {
    // On mobile, clicking name opens the whole item (name + desc)
    editingField.value = `${itemId}-item`;
  } else {
    editingField.value = `${itemId}-${field}`;
  }
  nextTick(() => {
    const focusField = isMobile() && field === "name" ? "name" : field;
    const el = document.querySelector(
      `[data-edit-id="${itemId}-${focusField}"]`
    ) as HTMLElement | null;
    el?.focus();
    // Auto-resize textareas on open
    document.querySelectorAll<HTMLTextAreaElement>(
      `textarea[data-edit-id="${itemId}-desc"]`
    ).forEach((ta) => {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
  });
}

let blurTimeout: ReturnType<typeof setTimeout> | null = null;

function stopEdit() {
  // Delay so that focusing the next input in the same item cancels the close
  blurTimeout = setTimeout(() => {
    editingField.value = null;
  }, 100);
}

function cancelStopEdit() {
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }
}

function isEditing(itemId: string, field: "name" | "desc") {
  if (editingField.value === `${itemId}-item`) return true;
  return editingField.value === `${itemId}-${field}`;
}

function onDescInput(item: Character["items"][number], e: Event) {
  const el = e.target as HTMLTextAreaElement;
  item.description = el.value;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function addItem() {
  const id = crypto.randomUUID();
  props.character.items.push({
    id,
    name: "",
    description: "",
    quantity: 1,
  });
  startEdit(id, "name");
}

function removeItem(i: number) {
  props.character.items.splice(i, 1);
}
</script>

<template>
  <AppCard>
    <div class="card-head">
      <h2>Objets</h2>
      <AppIconBtn variant="ghost" title="Ajouter un objet" @click="addItem">
        <Plus :size="18" />
      </AppIconBtn>
    </div>

    <ul v-if="character.items.length" class="item-list">
      <li v-for="(item, i) in character.items" :key="item.id" class="item-row">
        <div class="item-text">
          <div class="item-main-line">
            <span
              v-if="!isEditing(item.id, 'name')"
              class="item-label item-label--name"
              :class="{ 'item-label--empty': !item.name }"
              @click="startEdit(item.id, 'name')"
            >{{ item.name || 'Nouvel objet' }}</span>
            <AppInput
              v-if="isEditing(item.id, 'name')"
              v-model="item.name"
              placeholder="Nom"
              class="item-name"
              :data-edit-id="`${item.id}-name`"
              @focus="cancelStopEdit"
              @blur="stopEdit"
              @keydown.enter="stopEdit"
            />
            <span
              v-if="!isEditing(item.id, 'desc') && item.description"
              class="item-label item-label--desc hide-mobile"
              @click="startEdit(item.id, 'desc')"
            >{{ item.description }}</span>
            <button
              v-if="!isEditing(item.id, 'desc') && !item.description"
              class="edit-desc-btn hide-mobile"
              title="Ajouter une description"
              @click="startEdit(item.id, 'desc')"
            ><Pencil :size="13" /></button>
            <textarea
              v-if="isEditing(item.id, 'desc')"
              :value="item.description"
              @input="onDescInput(item, $event)"
              placeholder="Description"
              class="item-desc hide-mobile"
              :data-edit-id="`${item.id}-desc`"
              rows="1"
              @focus="cancelStopEdit"
              @blur="stopEdit"
            />
          </div>
          <!-- Description on second line on mobile -->
          <div v-if="isEditing(item.id, 'desc') || item.description" class="item-desc-line show-mobile">
            <span
              v-if="!isEditing(item.id, 'desc')"
              class="item-label item-label--desc"
              @click="startEdit(item.id, 'desc')"
            >{{ item.description }}</span>
            <textarea
              v-if="isEditing(item.id, 'desc')"
              :value="item.description"
              @input="onDescInput(item, $event)"
              placeholder="Description"
              class="item-desc"
              :data-edit-id="`${item.id}-desc`"
              rows="1"
              @focus="cancelStopEdit"
              @blur="stopEdit"
            />
          </div>
        </div>
        <AppInput v-model="item.quantity" type="number" :min="1" class="item-qty" text-align="center" />
        <AppIconBtn variant="ghost" :size="32" title="Supprimer" @click="removeItem(i)">
          <Trash2 :size="15" />
        </AppIconBtn>
      </li>
    </ul>
    <p v-else class="muted">Aucun objet dans l'inventaire.</p>
  </AppCard>
</template>

<style scoped>
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.9rem;
}
.card-head h2 { margin: 0; }

.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.item-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.item-main-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.item-label {
  cursor: pointer;
  border-radius: 6px;
  padding: 0.15rem 0.3rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-label:hover {
  background: var(--surface-2);
}
.item-label--empty {
  color: var(--muted);
  font-style: italic;
}
.item-label--name {
  font-weight: 600;
  flex-shrink: 0;
}
.item-label--desc {
  color: var(--muted);
  font-size: 0.85rem;
  flex: 1;
  min-width: 0;
  white-space: normal;
  overflow: visible;
}

.edit-desc-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.item-main-line:hover .edit-desc-btn {
  opacity: 1;
}
.edit-desc-btn:hover {
  color: var(--text);
  background: var(--surface-2);
}

.item-name { flex: 1; min-width: 0; }
.item-desc {
  flex: 2;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  box-shadow: none;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  font-size: 0.85rem;
  color: var(--muted);
  padding: 0.15rem 0.3rem;
  line-height: 1.4;
}
.item-qty  { width: 3.5rem; flex-shrink: 0; }

.item-desc-line {
  padding-left: 0.3rem;
}
.item-desc-line .item-label--desc {
  font-size: 0.82rem;
}

/* Responsive: hide/show description line */
.hide-mobile { display: flex; }
.show-mobile { display: none; }

@media (max-width: 600px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex; }
}

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; }
</style>

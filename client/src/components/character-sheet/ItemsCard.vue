<script setup lang="ts">
import AppCard from "../ui/AppCard.vue";
import AppIconBtn from "../ui/AppIconBtn.vue";
import { Plus, Trash2 } from "lucide-vue-next";
import type { Character } from "../../types/character";

const props = defineProps<{ character: Character }>();

function addItem() {
  props.character.items.push({
    id: crypto.randomUUID(),
    name: "",
    description: "",
    quantity: 1,
  });
}

function removeItem(i: number) {
  props.character.items.splice(i, 1);
}
</script>

<template>
  <AppCard>
    <div class="card-head">
      <h2>Inventaire</h2>
      <AppIconBtn variant="ghost" title="Ajouter un objet" @click="addItem">
        <Plus :size="18" />
      </AppIconBtn>
    </div>

    <div class="money-row">
      <label class="money-field">
        <span class="money-label gold">po</span>
        <input v-model.number="character.goldCoins" type="number" min="0" class="input money-input" />
      </label>
      <label class="money-field">
        <span class="money-label silver">pa</span>
        <input v-model.number="character.silverCoins" type="number" min="0" class="input money-input" />
      </label>
      <label class="money-field">
        <span class="money-label copper">pc</span>
        <input v-model.number="character.copperCoins" type="number" min="0" class="input money-input" />
      </label>
    </div>

    <ul v-if="character.items.length" class="item-list">
      <li v-for="(item, i) in character.items" :key="item.id" class="item-row">
        <input v-model="item.name" type="text" class="input item-name" placeholder="Nom" />
        <input v-model="item.description" type="text" class="input item-desc" placeholder="Description" />
        <input v-model.number="item.quantity" type="number" min="1" class="input item-qty" />
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

.money-row {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.money-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex: 1;
}

.money-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.money-label.gold   { color: #c9a227; }
.money-label.silver { color: #9aa0a6; }
.money-label.copper { color: #b56c2a; }

.money-input {
  text-align: center;
  font-weight: 600;
  padding: 0.38rem 0.3rem;
}

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

.item-name { flex: 1; min-width: 0; }
.item-desc { flex: 2; min-width: 0; font-size: 0.85rem; }
.item-qty  { width: 3.5rem; text-align: center; flex-shrink: 0; }

.muted { color: var(--muted); font-size: 0.9rem; margin: 0; }
</style>

import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import CharacterSheetView from '../views/CharacterSheetView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'chat', component: ChatView },
    {
      path: '/personnage',
      name: 'character',
      component: CharacterSheetView,
    },
  ],
})

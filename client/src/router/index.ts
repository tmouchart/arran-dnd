import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import CharacterSheetView from '../views/CharacterSheetView.vue'
import CharacterListView from '../views/CharacterListView.vue'
import ActionsView from '../views/ActionsView.vue'
import LoginView from '../views/LoginView.vue'
import SessionListView from '../views/SessionListView.vue'
import SessionView from '../views/SessionView.vue'
import { authReady, user, initAuth } from '../composables/useAuth'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'chat', component: ChatView },
    { path: '/personnages', name: 'characters', component: CharacterListView },
    { path: '/personnage', name: 'character', component: CharacterSheetView },
    { path: '/actions', name: 'actions', component: ActionsView },
    { path: '/sessions', name: 'sessions', component: SessionListView },
    { path: '/sessions/:id', name: 'session', component: SessionView },
  ],
})

router.beforeEach(async (to) => {
  if (!authReady.value) await initAuth()
  if (to.meta.public) return true
  if (!user.value) return { name: 'login' }
  return true
})

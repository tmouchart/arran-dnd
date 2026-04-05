import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import CharacterSheetView from '../views/CharacterSheetView.vue'
import CharacterListView from '../views/CharacterListView.vue'
import ActionsView from '../views/ActionsView.vue'
import LoginView from '../views/LoginView.vue'
import SessionListView from '../views/SessionListView.vue'
import SessionView from '../views/SessionView.vue'
import JetsView from '../views/JetsView.vue'
import InventaireView from '../views/InventaireView.vue'
import OptionsView from '../views/OptionsView.vue'
import JournalView from '../views/JournalView.vue'
import JournalPageView from '../views/JournalPageView.vue'
import CampaignListView from '../views/CampaignListView.vue'
import CampaignView from '../views/CampaignView.vue'
import CampaignCharacterView from '../views/CampaignCharacterView.vue'
import EncounterEditView from '../views/EncounterEditView.vue'
import CombatView from '../views/CombatView.vue'
import { authReady, user, initAuth } from '../composables/useAuth'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', redirect: '/personnage' },
    { path: '/chat', name: 'chat', component: ChatView },
    { path: '/personnages', name: 'characters', component: CharacterListView },
    { path: '/personnage', name: 'character', component: CharacterSheetView },
    { path: '/actions', name: 'actions', component: ActionsView },
    { path: '/inventaire', name: 'inventaire', component: InventaireView },
    { path: '/jets', name: 'jets', component: JetsView },
    { path: '/journal', name: 'journal', component: JournalView },
    { path: '/journal/:id', name: 'journal-page', component: JournalPageView },
    { path: '/campagnes', name: 'campaigns', component: CampaignListView },
    { path: '/campagnes/:id', name: 'campaign', component: CampaignView },
    { path: '/campagnes/:campaignId/personnage/:userId', name: 'campaign-character', component: CampaignCharacterView },
    { path: '/campagnes/:id/rencontres/:eid', name: 'encounter-edit', component: EncounterEditView },
    { path: '/campagnes/:id/combat/:cid', name: 'combat', component: CombatView },
    { path: '/sessions', name: 'sessions', component: SessionListView },
    { path: '/sessions/:id', name: 'session', component: SessionView },
    { path: '/options', name: 'options', component: OptionsView },
  ],
})

router.beforeEach(async (to) => {
  if (!authReady.value) await initAuth()
  if (to.meta.public) return true
  if (!user.value) return { name: 'login' }
  return true
})

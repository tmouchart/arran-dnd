import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import CharacterSheetView from '../views/CharacterSheetView.vue'
import CharacterListView from '../views/CharacterListView.vue'
import ActionsView from '../views/ActionsView.vue'
import LoginView from '../views/LoginView.vue'
import JetsView from '../views/JetsView.vue'
import InventaireView from '../views/InventaireView.vue'
import OptionsView from '../views/OptionsView.vue'
import JournalView from '../views/JournalView.vue'
import JournalPageView from '../views/JournalPageView.vue'
import NoteEditView from '../views/NoteEditView.vue'
import NoteDrawingView from '../views/NoteDrawingView.vue'
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
    { path: '/journal/note/:id', name: 'journal-note', component: NoteEditView },
    { path: '/journal/dessin/:id', name: 'journal-dessin', component: NoteDrawingView },
    { path: '/journal/:id', name: 'journal-page', component: JournalPageView },
    { path: '/campagnes', name: 'campaigns', component: CampaignListView },
    { path: '/campagnes/:id', name: 'campaign', component: CampaignView },
    { path: '/campagnes/:campaignId/personnage/:userId', name: 'campaign-character', component: CampaignCharacterView },
    { path: '/campagnes/:id/rencontres/:eid', name: 'encounter-edit', component: EncounterEditView },
    { path: '/campagnes/:id/combat/:cid', name: 'combat', component: CombatView },
    { path: '/options', name: 'options', component: OptionsView },
    // Kitchen sink du design system — dev uniquement, absent du build de prod
    ...(import.meta.env.DEV
      ? [{ path: '/component-library', name: 'component-library', component: () => import('../views/ComponentLibraryView.vue') }]
      : []),
  ],
})

router.beforeEach(async (to) => {
  if (!authReady.value) await initAuth()
  if (to.meta.public) return true
  if (!user.value) return { name: 'login' }
  return true
})

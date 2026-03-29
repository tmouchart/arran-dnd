import { createApp } from 'vue'
import './style.css'
import './themes/grimoire.css'
import './themes/vitrail.css'
import './themes/carte-du-monde.css'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')

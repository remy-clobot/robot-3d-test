import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueKonva from 'vue-konva'
import { Quasar } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(VueKonva)
app.use(Quasar, { plugins: {} })
app.mount('#app')

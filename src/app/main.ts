import { createApp } from 'vue';
import { createHead } from '@vueuse/head';
import App from './App.vue';
import '../styles/tailwind.css';

import { i18n } from './i18n';

const app = createApp(App);

app.use(createHead());
app.use(i18n);

app.mount('#app');

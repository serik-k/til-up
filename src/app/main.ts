import { createApp } from 'vue';
import { createHead } from '@vueuse/head';
import App from './App.vue';
import '../styles/tailwind.css';

const app = createApp(App);

app.use(createHead());
app.mount('#app');

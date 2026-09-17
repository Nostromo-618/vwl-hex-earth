import { createApp } from 'vue';
import { VanduoVue } from '@vanduo-oss/vd3';
import '@vanduo-oss/vd3/css';
import './styles/app.css';
import App from './App.vue';

createApp(App).use(VanduoVue, {}).mount('#app');

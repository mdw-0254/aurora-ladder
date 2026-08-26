import { createApp } from 'vue';
import App from './App.vue';
import '@fontsource-variable/space-grotesk';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles/main.css';

window.addEventListener('error', (e) => {
  console.error('[renderer-error]', e.message, '\n', e.error && e.error.stack);
});

createApp(App).mount('#app');

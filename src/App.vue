<template>
  <div :data-theme="store.settings.theme || 'dark'" class="app-root">
    <div class="app-bg"></div>
    <div class="app-shell">
      <TitleBar />
      <div class="app-body">
        <Sidebar />
        <main class="app-main">
          <Transition name="page" mode="out-in">
            <component :is="currentPage" :key="store.activePage" />
          </Transition>
        </main>
      </div>
    </div>
    <ToastHost />
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { store, initApp } from './store';
import TitleBar from './components/TitleBar.vue';
import Sidebar from './components/Sidebar.vue';
import ToastHost from './components/widgets/ToastHost.vue';
import Dashboard from './pages/Dashboard.vue';
import Servers from './pages/Servers.vue';
import Connections from './pages/Connections.vue';
import Logs from './pages/Logs.vue';
import Settings from './pages/Settings.vue';
import About from './pages/About.vue';

const pages = {
  dashboard: Dashboard,
  servers: Servers,
  connections: Connections,
  logs: Logs,
  settings: Settings,
  about: About
};

const currentPage = computed(() => pages[store.activePage] || Dashboard);

// 将主题同步到 <html>（:root[data-theme='light'] 才能真正生效）
function applyTheme(t) {
  const theme = t === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}
watch(() => store.settings.theme, (t) => applyTheme(t), { immediate: true });

onMounted(() => {
  initApp();
});
</script>

<style scoped>
.app-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}
.app-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  z-index: 1;
}
.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.app-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 24px 26px 28px;
}
</style>

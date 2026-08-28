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
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="updating" class="update-overlay">
          <div class="update-box">
            <template v-if="updating.phase === 'download'">
              <div class="update-icon">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <div class="update-title">正在下载更新 {{ updating.percent || 0 }}%</div>
              <div class="update-bar"><div class="update-fill" :style="{ width: (updating.percent || 0) + '%' }"></div></div>
              <div class="update-sub">下载完成后将自动重启，请稍候</div>
            </template>
            <template v-else-if="updating.phase === 'apply'">
              <div class="update-icon spin">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <div class="update-title">更新已完成，正在重启…</div>
            </template>
            <template v-else-if="updating.phase === 'error'">
              <div class="update-icon">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none"><path d="M12 3l9 16H3l9-16zm0 6v4m0 3h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <div class="update-title">更新失败</div>
              <div class="update-sub">{{ updating.message }}</div>
              <button class="update-close" @click="updating = null">关闭</button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
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

// 更新进度浮层（下载 / 重启 / 失败）
const updating = ref(null);

// 将主题同步到 <html>（:root[data-theme='light'] 才能真正生效）
function applyTheme(t) {
  const theme = t === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}
watch(() => store.settings.theme, (t) => applyTheme(t), { immediate: true });

onMounted(() => {
  initApp();
  if (window.aurora && window.aurora.onUpdateProgress) {
    window.aurora.onUpdateProgress((p) => { updating.value = p; });
  }
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

/* 更新进度浮层 */
.update-overlay {
  position: fixed; inset: 0; z-index: 1200;
  display: flex; align-items: center; justify-content: center;
  background: rgba(3, 6, 12, 0.62);
  backdrop-filter: blur(5px);
}
.update-box {
  width: 340px; padding: 28px 30px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  border-radius: 18px;
  background: var(--panel-solid);
  border: 1px solid var(--panel-border-2);
  box-shadow: var(--shadow-2);
}
.update-icon {
  width: 58px; height: 58px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--accent-1);
  background: var(--accent-grad-soft);
  margin-bottom: 14px;
}
.update-icon.spin svg { animation: up-spin 1s linear infinite; }
@keyframes up-spin { to { transform: rotate(360deg); } }
.update-title { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
.update-sub { font-size: 12px; color: var(--text-2); line-height: 1.6; word-break: break-all; max-width: 100%; }
.update-bar {
  width: 100%; height: 8px; border-radius: 999px; overflow: hidden;
  background: var(--panel-border);
  margin-bottom: 10px;
}
.update-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
  transition: width 0.2s ease;
}
.update-close {
  margin-top: 14px;
  padding: 6px 18px;
  border-radius: 999px;
  font-size: 12.5px; font-weight: 600;
  color: var(--text-1);
  background: var(--panel);
  border: 1px solid var(--panel-border-2);
  cursor: pointer;
  transition: border-color 0.18s, color 0.18s;
}
.update-close:hover { border-color: var(--accent-1); color: var(--accent-1); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.22s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

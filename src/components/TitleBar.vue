<template>
  <header class="titlebar">
    <!-- 品牌区 · 与侧栏同宽（logo + 名称 + 徽章 + 版本 整合为一块） -->
    <div class="tb-left drag">
      <div class="logo">
        <svg viewBox="0 0 32 32" width="21" height="21" fill="none">
          <defs>
            <linearGradient id="aurora-shell" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style="stop-color: var(--logo-glow-1)" />
              <stop offset="100%" style="stop-color: var(--logo-glow-2)" />
            </linearGradient>
            <linearGradient id="aurora-core" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style="stop-color: var(--logo-glow-1)" />
              <stop offset="100%" style="stop-color: var(--logo-glow-2)" />
            </linearGradient>
          </defs>
          <path d="M16 2 L28 8 V16 C28 23 22.5 28.5 16 30 C9.5 28.5 4 23 4 16 V8 Z" fill="url(#aurora-shell)" opacity="0.16" />
          <path d="M6 10 L16 5 L26 10 V15.5 C26 21.5 21.8 26.2 16 27.8 C10.2 26.2 6 21.5 6 15.5 Z" fill="url(#aurora-shell)" opacity="0.32" />
          <path d="M10 12.5 L16 9.5 L22 12.5 V16 C22 19.8 19.4 23.2 16 24.4 C12.6 23.2 10 19.8 10 16 Z" style="fill: var(--logo-core)" />
          <path d="M13 14 L16 12.4 L19 14 V16.6 C19 18.4 17.7 20.2 16 20.9 C14.3 20.2 13 18.4 13 16.6 Z" fill="url(#aurora-core)" />
          <circle cx="16" cy="16.4" r="1.6" style="fill: var(--logo-dot)" />
        </svg>
      </div>
      <span class="tb-title">Aurora</span>
      <span class="tb-badge">极速</span>
      <span class="tb-version mono">v{{ store.version }}</span>
    </div>

    <!-- 主内容区 · 左侧天气日期（与下方卡片对齐） / 右侧连接状态 -->
    <div class="tb-main drag">
      <div class="tb-weather">
        <span class="wdate">{{ dateStr }}</span>
        <span class="wsep"></span>
        <span class="wico" v-if="weather" v-html="iconHtml"></span>
        <span class="wtemp mono" v-if="weather && weather.ok">{{ weather.temp }}°</span>
        <span class="wmeta" v-if="weather">{{ weather.city }} · {{ weather.text }}</span>
        <span class="wmeta" v-else>天气加载中…</span>
      </div>
      <div class="tb-status" :class="statusClass">
        <span class="tb-status-dot"></span>
        <span class="tb-status-text">{{ statusText }}</span>
      </div>
    </div>

    <div class="tb-right">
      <button class="wc" title="最小化" @click="api.windowControl('minimize')">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
      <button class="wc" title="最大化/还原" @click="api.windowControl('maximize')">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
      </button>
      <button class="wc wc-close" title="关闭" @click="api.windowControl('close')">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { store, loadWeather } from '../store';
import { weatherIcon } from '../utils/weatherIcons';

const api = window.aurora;

const weather = computed(() => store.weather);
const iconHtml = computed(() => weatherIcon(weather.value && weather.value.icon));
const dateStr = computed(() => {
  const d = new Date();
  const w = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${w[d.getDay()]}`;
});

/* 连接状态（安全通道信息已并入此状态，与标题栏整合） */
const statusText = computed(() => {
  const s = store.state.state;
  if (s === 'connecting') return '正在建立安全通道…';
  if (s === 'disconnecting') return '正在断开…';
  if (s === 'connected') return '安全连接 · 已加密';
  return '当前未连接';
});
const statusClass = computed(() => {
  const s = store.state.state;
  if (s === 'connected') return 'on';
  if (s === 'connecting' || s === 'disconnecting') return 'busy';
  return 'off';
});

onMounted(() => {
  loadWeather();
});
</script>

<style scoped>
.titlebar {
  height: 48px;
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 6px 0 0;
  border-bottom: 1px solid var(--panel-border);
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-2) 72%, transparent), color-mix(in srgb, var(--bg) 60%, transparent));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  flex: none;
}
.drag { -webkit-app-region: drag; }

/* 品牌区 · 与侧栏同宽，内容左缘与侧栏卡片对齐 */
.tb-left {
  flex: none;
  width: 224px;               /* 与 Sidebar 等宽 */
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;            /* 与侧栏内边距一致 */
  min-width: 0;
}
.logo { display: flex; align-items: center; flex: none; }
.logo svg { filter: drop-shadow(0 2px 8px var(--logo-shadow)); }
.tb-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
  background: var(--tb-title-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.tb-badge {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 1.6px;
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 2px 10px rgba(108, 92, 246, 0.4);
  flex: none;
}
.tb-version {
  font-size: 10.5px;
  color: var(--text-3);
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  white-space: nowrap;
}

/* 主内容区 · 与主内容同宽，天气左缘与下方卡片对齐，状态靠右 */
.tb-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 26px;            /* 与 app-main 左内边距一致 → 与卡片对齐 */
  align-self: stretch;
}
.tb-weather {
  display: flex;
  align-items: center;
  gap: 11px;
  line-height: 1;
  white-space: nowrap;
}
.wdate {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: 0.5px;
}
.wsep { width: 1px; height: 15px; background: var(--panel-border-2); }
.wico { display: flex; color: #fbbf24; line-height: 0; filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.35)); }
.wico :deep(svg) { display: block; width: 21px; height: 21px; }
.wtemp { font-size: 20px; font-weight: 700; color: var(--text-1); letter-spacing: 0.3px; }
.wmeta { font-size: 13px; color: var(--text-2); }

/* 连接状态 · 无外边框 */
.tb-status {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
  letter-spacing: 0.2px;
}
.tb-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.tb-status.on .tb-status-dot { background: var(--success); box-shadow: 0 0 10px var(--success); }
.tb-status.busy .tb-status-dot { background: var(--warn); box-shadow: 0 0 10px var(--warn); animation: tb-pulse 1s infinite; }
.tb-status.off .tb-status-dot { background: var(--text-3); box-shadow: 0 0 8px var(--text-3); }
@keyframes tb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

.tb-right { flex: none; display: flex; justify-content: flex-end; -webkit-app-region: no-drag; }
.wc {
  width: 44px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.wc:hover { background: rgba(148, 163, 184, 0.12); color: var(--text-1); }
.wc-close:hover { background: #e81123; color: #fff; }
</style>

<style>
/* 浅色主题 · 标题栏央视红金 */
:root[data-theme='light'] .titlebar {
  background: linear-gradient(180deg, rgba(237, 233, 225, 0.88), rgba(245, 242, 236, 0.72));
}
:root[data-theme='light'] .tb-badge { box-shadow: 0 2px 10px rgba(200, 16, 46, 0.35); }
:root[data-theme='light'] .tb-version { background: rgba(255, 255, 255, 0.6); border-color: var(--panel-border-2); }
:root[data-theme='light'] .titlebar::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, #c8102e 0%, #c9a227 50%, #c8102e 100%);
  pointer-events: none;
}
</style>

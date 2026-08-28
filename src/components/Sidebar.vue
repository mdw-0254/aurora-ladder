<template>
  <aside class="sidebar">
    <!-- 信号速率 -->
    <div class="sb-signal">
      <div class="signal-head">
        <span class="signal-label">实时速率</span>
        <span class="badge" :class="connected ? 'badge-green' : 'badge-gray'">
          <span class="dot" :class="connected ? 'dot-green' : 'dot-red'"></span>
          {{ connected ? '已连接' : '未连接' }}
        </span>
      </div>
      <div class="signal-body">
        <div class="signal-row down">
          <span class="signal-arrow down">
            <svg viewBox="0 0 16 16" width="12" height="12" style="color:var(--accent-1)"><path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="signal-cap">下载</span>
          <span class="signal-num mono">{{ fmtSpeed(state.downSpeed) }}</span>
        </div>
        <div class="signal-row up">
          <span class="signal-arrow up">
            <svg viewBox="0 0 16 16" width="12" height="12" style="color:var(--accent-2)"><path d="M8 4v8M4 8l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="signal-cap">上传</span>
          <span class="signal-num mono">{{ fmtSpeed(state.upSpeed) }}</span>
        </div>
      </div>
    </div>

    <!-- 导航 -->
    <nav class="sb-nav">
      <button
        v-for="item in navs"
        :key="item.id"
        class="nav-item"
        :class="{ active: store.activePage === item.id }"
        @click="navigate(item.id)"
      >
        <span class="nav-bar"></span>
        <svg class="nav-ico" viewBox="0 0 24 24" width="19" height="19" fill="none">
          <path :d="item.icon" :stroke="store.activePage === item.id ? 'url(#navGrad)' : 'currentColor'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.id === 'about' && showUpdateDot" class="nav-reddot" title="发现新版本"></span>
      </button>
      <svg width="0" height="0" style="position:absolute"><defs>
        <linearGradient id="navGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style="stop-color: var(--accent-1)" /><stop offset="100%" style="stop-color: var(--accent-2)" />
        </linearGradient>
      </defs></svg>
    </nav>

    <!-- 底部状态 -->
    <div class="sb-foot">
      <div class="sb-status">
        <span class="dot" :class="state.state === 'connected' ? 'dot-green' : state.state === 'connecting' ? 'dot-amber' : 'dot-red'"></span>
        <span class="sb-status-text">{{ coreStatusText }}</span>
      </div>
      <div class="sb-meta mono">{{ fmtDuration(state.runtime) }} · 端口 {{ state.port }}</div>
      <button class="sb-connect" :class="state.state === 'connected' ? 'on' : ''" @click="toggle">
        <span v-if="state.state === 'connecting'" class="spin-svg">
          <svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
        </span>
        <span v-else-if="state.state === 'connected'">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </span>
        <span v-else>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="sb-connect-label">
          {{ state.state === 'connected' ? '断开连接' : state.state === 'connecting' || state.state === 'disconnecting' ? '处理中…' : '一键连接' }}
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { store, navigate, connect, disconnect, isUpdateVisible } from '../store';
import { formatSpeed, formatDuration } from '../utils/format';

const state = computed(() => store.state);
const connected = computed(() => store.state.state === 'connected');
// 有新版且未关闭时，「关于」导航显示小红点
const showUpdateDot = computed(() => isUpdateVisible());

const navs = [
  { id: 'dashboard', label: '总览', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6' },
  { id: 'servers', label: '服务器', icon: 'M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { id: 'connections', label: '连接', icon: 'M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7zm0 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2z' },
  { id: 'logs', label: '日志', icon: 'M4 6h16M4 12h10M4 18h16' },
  { id: 'settings', label: '设置', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.5-3a7.5 7.5 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-1.7-1L15 3.6h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.06-.33.1-.66.1-1z' },
  { id: 'about', label: '关于', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-12v4m0 4h.01' }
];

const coreStatusText = computed(() => {
  const s = store.state;
  if (s.state === 'connected') return '核心运行中 · 已连接';
  if (s.state === 'connecting') return '核心运行中 · 连接中';
  return '核心运行中 · 空闲';
});

function fmtSpeed(v) {
  return formatSpeed(v);
}

function fmtDuration(s) {
  return formatDuration(s);
}

async function toggle() {
  if (store.state.state === 'connected') await disconnect();
  else await connect();
}
</script>

<style scoped>
.sidebar {
  width: 224px;
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 16px 14px 14px;
  border-right: 1px solid var(--panel-border);
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-2) 66%, transparent), color-mix(in srgb, var(--bg) 58%, transparent));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  min-height: 0;
}

/* 信号速率卡片 */
.sb-signal {
  padding: 13px 14px;
  margin-bottom: 16px;
  border-radius: var(--radius);
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.05), rgba(139, 92, 246, 0.04)), var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
  position: relative;
  overflow: hidden;
}
.sb-signal::before {
  content: '';
  position: absolute;
  top: 0; left: 14px; right: 14px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.5), transparent);
}
.signal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; }
.signal-label { font-size: 11px; font-weight: 600; color: var(--text-3); letter-spacing: 1.6px; text-transform: uppercase; }
.signal-body { display: flex; flex-direction: column; gap: 7px; }
.signal-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.signal-arrow {
  width: 24px; height: 24px;
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(34, 211, 238, 0.1);
  flex: none;
}
.signal-arrow.up { background: rgba(139, 92, 246, 0.12); }
.signal-cap { font-size: 11px; color: var(--text-3); font-weight: 600; letter-spacing: 0.4px; }
.signal-num {
  margin-left: auto;
  font-size: 17px; font-weight: 800;
  letter-spacing: 0.2px; white-space: nowrap;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.signal-row.down .signal-num {
  color: #67e8f9;
  text-shadow: 0 0 14px rgba(34, 211, 238, 0.45);
}
.signal-row.up .signal-num {
  color: #c4b5fd;
  text-shadow: 0 0 14px rgba(139, 92, 246, 0.45);
}

/* 导航 */
.sb-nav { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border: 1px solid transparent;
  background: transparent; cursor: pointer;
  color: var(--text-2); font-family: inherit; font-size: 13.5px; font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all 0.18s; position: relative;
}
.nav-item:hover { background: var(--panel); color: var(--text-1); border-color: var(--panel-border); }
.nav-item:active { transform: scale(0.98); }
.nav-bar {
  position: absolute; left: -14px; top: 9px; bottom: 9px;
  width: 3px; border-radius: 3px;
  background: var(--accent-grad);
  box-shadow: 0 0 10px rgba(108, 92, 246, 0.7);
  opacity: 0; transform: scaleY(0.4);
  transition: opacity 0.2s, transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.nav-item.active {
  color: var(--text-1);
  background: var(--accent-grad-soft);
  border-color: rgba(124, 108, 240, 0.3);
  font-weight: 600;
}
.nav-item.active .nav-bar { opacity: 1; transform: scaleY(1); }
.nav-ico { flex: none; transition: transform 0.2s; }
.nav-item:hover .nav-ico { transform: translateX(1px); }
.nav-item.active .nav-ico { filter: drop-shadow(0 0 6px rgba(108, 92, 246, 0.7)); }
.nav-reddot {
  position: absolute;
  top: 9px; right: 11px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #f43f5e;
  box-shadow: 0 0 8px rgba(244, 63, 94, 0.85);
  animation: reddot-blink 1.6s ease-in-out infinite;
}
@keyframes reddot-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

/* 底部 */
.sb-foot {
  border-top: 1px solid var(--panel-border);
  padding-top: 13px;
  display: flex; flex-direction: column; gap: 9px;
}
.sb-status { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-2); font-weight: 600; }
.sb-meta { font-size: 12px; color: var(--text-2); padding-left: 15px; letter-spacing: 0.3px; }
.sb-connect {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 4px; padding: 12px;
  border-radius: var(--radius-sm);
  border: none; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 13px;
  color: #fff; background: var(--accent-grad);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 8px 22px rgba(108, 92, 246, 0.4);
  transition: all 0.2s;
  position: relative; overflow: hidden;
}
.sb-connect:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255,255,255,0.25) inset, 0 12px 30px rgba(108, 92, 246, 0.55); }
.sb-connect:active { transform: scale(0.98); }
.sb-connect.on {
  background: linear-gradient(135deg, #f43f5e, #fb7185);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 8px 22px rgba(244, 63, 94, 0.4);
}
.spin-svg { animation: spin-slow 1s linear infinite; display: flex; }
</style>

<style>
/* 浅色主题 · 侧栏央视红金覆盖 */
:root[data-theme='light'] .sb-signal {
  background: linear-gradient(180deg, rgba(200, 16, 46, 0.04), rgba(201, 162, 39, 0.035)), var(--panel);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.85) inset;
}
:root[data-theme='light'] .sb-signal::before { background: linear-gradient(90deg, transparent, rgba(200, 16, 46, 0.45), rgba(201, 162, 39, 0.45), transparent); }
:root[data-theme='light'] .signal-arrow { background: rgba(200, 16, 46, 0.1); }
:root[data-theme='light'] .signal-arrow.up { background: rgba(201, 162, 39, 0.14); }
:root[data-theme='light'] .signal-row.down .signal-num { color: #c8102e; text-shadow: 0 0 10px rgba(200, 16, 46, 0.22); }
:root[data-theme='light'] .signal-row.up .signal-num { color: #9a7b1c; text-shadow: 0 0 10px rgba(201, 162, 39, 0.22); }
:root[data-theme='light'] .nav-item.active { border-color: rgba(200, 16, 46, 0.32); }
:root[data-theme='light'] .nav-item.active .nav-ico { filter: drop-shadow(0 0 6px rgba(200, 16, 46, 0.55)); }
:root[data-theme='light'] .sb-connect { box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset, 0 8px 22px rgba(200, 16, 46, 0.32); }
:root[data-theme='light'] .sb-connect:hover { box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset, 0 12px 30px rgba(200, 16, 46, 0.45); }
:root[data-theme='light'] .sb-connect.on { background: linear-gradient(135deg, #b71c1c, #c8102e); box-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) inset, 0 8px 22px rgba(183, 28, 28, 0.35); }
</style>

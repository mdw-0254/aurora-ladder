<template>
  <div class="dash">
    <!-- 顶部 · 状态 + 雷达 + 连接控制 -->
    <div class="hero panel">
      <!-- 科幻角标 -->
      <span class="hero-corner tl"></span>
      <span class="hero-corner tr"></span>
      <span class="hero-corner bl"></span>
      <span class="hero-corner br"></span>
      <!-- 入场流光扫掠 -->
      <span class="hero-sweep"></span>

      <!-- 左：节点信息 + 控制统计 整合成一块 -->
      <div class="hero-left">
        <div class="hero-server">
          <span class="cc sm">{{ serverCode }}</span>
          <div class="hs-info">
            <div class="rc-name">{{ serverName }}</div>
            <div class="rc-ip mono">出口 IP · {{ store.state.externalIp }}</div>
          </div>
        </div>

        <button class="btn hero-btn" :class="connected ? 'btn-danger' : 'btn-primary'" @click="toggleConnect" :disabled="connecting || disconnecting">
          <span v-if="connecting || disconnecting" class="spin-svg">
            <svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
          </span>
          <span v-else-if="connected">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
          </span>
          <span v-else>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          {{ connected ? '断开连接' : '立即连接' }}
        </button>
      </div>

      <!-- 中：指标（独立于按钮，垂直居中） -->
      <div class="hero-meta">
            <div class="hm-row">
              <div class="hm-line">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <span class="hm-label">运行</span>
                <span class="hm-value mono">{{ fmtDuration(state.runtime) }}</span>
              </div>
              <span class="hm-dot"></span>
              <div class="hm-line">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M12 13v-2m0 0l-1.5-1.5M12 11l1.5-1.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="hm-label">延迟</span>
                <span class="hm-value mono" :style="currentPing >= 0 ? { color: pingColor(currentPing) } : {}">{{ currentPing >= 0 ? currentPing + ' ms' : '--' }}</span>
              </div>
            </div>
            <div class="hm-line flow">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span class="hm-label">流量</span>
              <span class="hm-value mono">{{ fmtBytes(state.todayDown + state.todayUp) }}</span>
            </div>
          </div>

      <!-- 右：雷达动效 -->
      <div class="hero-radar">
        <RadarGlobe :connected="connected" :connecting="connecting" :size="138" />
      </div>
    </div>

    <!-- 速率与统计 -->
    <div class="dash-grid">
      <div class="panel chart-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">实时吞吐</div>
            <div class="panel-sub">最近 60 秒速率曲线</div>
          </div>
          <div class="legend">
            <span class="lg"><i class="lg-dot" style="background:var(--accent-1)"></i>下载</span>
            <span class="lg"><i class="lg-dot" style="background:var(--accent-2)"></i>上传</span>
          </div>
        </div>
        <div class="chart-body">
          <SpeedChart :history="store.state.history || []" :live="connected" />
        </div>
        <div class="chart-now">
          <div class="cn-item">
            <svg viewBox="0 0 16 16" width="13" height="13" style="color:var(--accent-1)"><path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="cn-label">下载</span>
            <span class="cn-num mono">{{ fmtSpeed(state.downSpeed) }}</span>
          </div>
          <div class="cn-divider"></div>
          <div class="cn-item">
            <svg viewBox="0 0 16 16" width="13" height="13" style="color:var(--accent-2)"><path d="M8 4v8M4 8l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="cn-label">上传</span>
            <span class="cn-num mono">{{ fmtSpeed(state.upSpeed) }}</span>
          </div>
        </div>
      </div>

      <div class="panel stats-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">连接统计</div>
            <div class="panel-sub">本次会话数据</div>
          </div>
        </div>
        <div class="bento">
          <div class="bento-cell">
            <div class="b-ico" style="--c:var(--accent-1)">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="b-num mono">{{ fmtBytes(state.totalDown) }}</div>
            <div class="b-cap">已下载</div>
          </div>
          <div class="bento-cell">
            <div class="b-ico" style="--c:var(--accent-2)">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M21 7l-6 6-4-4-8 8M15 7h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="b-num mono">{{ fmtBytes(state.totalUp) }}</div>
            <div class="b-cap">已上传</div>
          </div>
          <div class="bento-cell">
            <div class="b-ico" style="--c:var(--success)">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <div class="b-num mono">{{ fmtDuration(state.runtime) }}</div>
            <div class="b-cap">运行时长</div>
          </div>
          <div class="bento-cell">
            <div class="b-ico" style="--c:var(--warn)">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M12 13v-2m0 0l-1.5-1.5M12 11l1.5-1.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="b-num mono">{{ currentPing >= 0 ? currentPing + ' ms' : '--' }}</div>
            <div class="b-cap">当前延迟</div>
          </div>
        </div>
        <div class="today-line">
          <span class="today-label">今日流量</span>
          <span class="today-val mono">{{ fmtBytes(state.todayDown) }} ↓ · {{ fmtBytes(state.todayUp) }} ↑</span>
        </div>
      </div>
    </div>

    <!-- 推荐节点 -->
    <div class="panel rec-panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">推荐节点</div>
          <div class="panel-sub">延迟最低的前 4 个节点</div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="navigate('servers')">查看全部
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="rec-list" v-if="recServers.length">
        <button
          v-for="s in recServers"
          :key="s.id"
          class="rec-item"
          :class="{ sel: s.id === store.state.server?.id || s.selected }"
          @click="pickServer(s.id)"
        >
          <span class="rec-top">
            <span class="cc sm">{{ s.code }}</span>
            <span class="rec-ping mono" :style="{ color: pingColor(s.ping) }">{{ s.ping >= 0 ? s.ping + ' ms' : '--' }}</span>
          </span>
          <span class="rec-name">{{ s.name }}</span>
          <span class="rec-meta">{{ s.speed }}<span v-if="s.selected" class="badge badge-green rec-cur">当前</span></span>
        </button>
      </div>
      <div v-else class="rec-empty">暂无节点，请先在「服务器」页导入订阅</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { store, connect, disconnect, navigate, selectServer, testLatency } from '../store';
import { formatBytes, formatSpeed, formatDuration, pingColor } from '../utils/format';
import SpeedChart from '../components/widgets/SpeedChart.vue';
import RadarGlobe from '../components/widgets/RadarGlobe.vue';
import { toast } from '../utils/toast';

const state = computed(() => store.state);
const connected = computed(() => store.state.state === 'connected');
const connecting = computed(() => store.state.state === 'connecting');
const disconnecting = computed(() => store.state.state === 'disconnecting');
const currentPing = computed(() => {
  const id = store.state.server?.id;
  return id ? (store.pings[id] ?? -1) : -1;
});

const serverCode = computed(() => store.state.server?.code || '--');
const serverName = computed(() => store.state.server?.name || '未选择节点');

const recServers = computed(() => {
  const pingVal = (s) => {
    const p = store.pings[s.id];
    return p >= 0 ? p : Number.MAX_SAFE_INTEGER;
  };
  const arr = [...store.servers].sort((a, b) => pingVal(a) - pingVal(b));
  return arr.slice(0, 4).map((s) => ({ ...s, ping: store.pings[s.id] ?? -1 }));
});

function fmtBytes(b) { return formatBytes(b); }
function fmtSpeed(v) { return formatSpeed(v); }
function fmtDuration(s) { return formatDuration(s); }

async function toggleConnect() {
  if (connected.value) {
    await disconnect();
    toast('已断开连接', 'info');
  } else {
    try {
      await connect();
      if (store.state.state === 'connected') {
        toast(`已连接到 ${store.state.server?.name}`, 'success');
        await testLatency();
      } else {
        toast('连接失败，请重试', 'error');
      }
    } catch (e) {
      toast(e.message || '连接失败，请重试', 'error');
    }
  }
}

async function pickServer(id) {
  await selectServer(id);
  if (connected.value) {
    await connect();
  }
  await testLatency();
  toast('已切换节点', 'success');
}

onMounted(async () => {
  await testLatency();
});
</script>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 16px; max-width: 1080px; margin: 0 auto; }

/* 顶部 · 状态 + 雷达 + 连接控制 */
.hero {
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 12px 24px;
  min-height: 162px;
  position: relative; overflow: hidden;
  animation: hero-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.hero::before {
  content: '';
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(520px 260px at 50% 0%, rgba(108, 92, 246, 0.1), transparent 66%),
    radial-gradient(380px 240px at 88% 12%, rgba(34, 211, 238, 0.08), transparent 60%);
}

/* 科幻角标 */
.hero-corner {
  position: absolute; width: 14px; height: 14px; pointer-events: none; z-index: 2;
  border-color: var(--accent-1); border-style: solid; border-width: 0;
  opacity: 0; animation: corner-in 0.4s ease-out 0.3s both;
}
.hero-corner.tl { top: 7px; left: 7px; border-top-width: 2px; border-left-width: 2px; border-top-left-radius: 5px; }
.hero-corner.tr { top: 7px; right: 7px; border-top-width: 2px; border-right-width: 2px; border-top-right-radius: 5px; }
.hero-corner.bl { bottom: 7px; left: 7px; border-bottom-width: 2px; border-left-width: 2px; border-bottom-left-radius: 5px; }
.hero-corner.br { bottom: 7px; right: 7px; border-bottom-width: 2px; border-right-width: 2px; border-bottom-right-radius: 5px; }

/* 入场流光扫掠 */
.hero-sweep {
  position: absolute; top: 0; left: -60%; width: 45%; height: 100%;
  pointer-events: none; z-index: 3; overflow: hidden;
  background: linear-gradient(105deg, transparent 30%, rgba(34, 211, 238, 0.07) 45%, rgba(139, 92, 246, 0.06) 55%, transparent 70%);
  animation: sweep 1.6s ease-out 0.2s both;
}

@keyframes hero-in {
  0% { opacity: 0; transform: translateY(8px) scale(0.99); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes corner-in { 0% { opacity: 0; transform: scale(0.3); } 100% { opacity: 0.7; transform: scale(1); } }
@keyframes sweep { 0% { left: -60%; } 100% { left: 160%; } }

@keyframes spin-slow { to { transform: rotate(360deg); } }
.spin-svg { animation: spin-slow 1s linear infinite; display: flex; }

/* 左：节点信息 + 控制统计 整合块 */
.hero-left {
  flex: 0 0 240px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  z-index: 1;
  animation: slide-in-l 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
}

.hero-server { display: flex; align-items: center; gap: 10px; min-width: 0; }
.hs-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rc-name { font-size: 15px; font-weight: 700; letter-spacing: -0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-ip { font-size: 11.5px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }

.hero-radar { flex: none; position: relative; z-index: 1; animation: radar-pop 0.7s cubic-bezier(0.22, 1.4, 0.36, 1) 0.14s both; }

.hero-btn { width: 100%; padding: 9px 16px; font-size: 13px; }
.hero-meta {
  flex: 0 0 auto;
  width: 240px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008));
  padding: 7px 14px;
  position: relative; overflow: hidden;
}
.hero-meta::before {
  content: '';
  position: absolute; top: 0; left: 14px; right: 14px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.4), transparent);
}
.hm-row { display: flex; align-items: center; gap: 12px; }
.hm-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--panel-border-2); flex: none; }
.hm-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.hm-line.flow { padding-top: 5px; border-top: 1px dashed var(--panel-border); }
.hm-line svg { color: var(--text-2); flex: none; }
.hm-label { font-size: 10.5px; color: var(--text-2); font-weight: 600; letter-spacing: 0.3px; flex: none; }
.hm-value { margin-left: auto; min-width: 42px; text-align: right; font-size: 13px; font-weight: 700; color: var(--text-1); letter-spacing: 0.2px; font-variant-numeric: tabular-nums; }

@keyframes slide-in-l {
  0% { opacity: 0; transform: translateX(-16px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes slide-in-r {
  0% { opacity: 0; transform: translateX(16px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes radar-pop {
  0% { opacity: 0; transform: scale(0.45); filter: brightness(2.8) saturate(1.6); }
  50% { opacity: 1; transform: scale(1.1); filter: brightness(1.3) saturate(1.2); }
  100% { opacity: 1; transform: scale(1); filter: brightness(1) saturate(1); }
}

/* 网格 */
.dash-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 20px; align-items: stretch; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; padding: 15px 20px 0; }
.panel-title { font-size: 15px; font-weight: 700; letter-spacing: -0.1px; }
.panel-sub { font-size: 11.5px; color: var(--text-2); margin-top: 3px; }
.legend { display: flex; gap: 14px; font-size: 12px; color: var(--text-2); }
.lg { display: flex; align-items: center; gap: 6px; }
.lg-dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }

.chart-panel { min-height: 262px; display: flex; flex-direction: column; }
.chart-body { flex: 1; padding: 12px 16px 4px; min-height: 150px; }
.chart-now { display: flex; align-items: center; gap: 20px; padding: 10px 20px 16px; border-top: 1px dashed var(--panel-border); margin-top: auto; }
.cn-item { display: flex; align-items: center; gap: 8px; }
.cn-label { font-size: 12px; color: var(--text-2); }
.cn-num { font-size: 17px; font-weight: 700; letter-spacing: 0.2px; }
.cn-divider { width: 1px; height: 22px; background: var(--panel-border); }

/* 无空隙 bento 统计 */
.stats-panel { min-height: 262px; display: flex; flex-direction: column; }
.bento {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: 1fr;
  grid-auto-flow: dense;
  margin: 14px 20px 0;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  overflow: hidden;
}
.bento-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 16px 18px;
  position: relative;
  transition: background 0.18s;
}
.bento-cell:hover { background: var(--panel); }
.bento-cell:nth-child(1) { border-right: 1px solid var(--panel-border); border-bottom: 1px solid var(--panel-border); }
.bento-cell:nth-child(2) { border-bottom: 1px solid var(--panel-border); }
.bento-cell:nth-child(3) { border-right: 1px solid var(--panel-border); }
.b-ico {
  width: 30px; height: 30px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c) 14%, transparent);
  color: var(--c);
  margin-bottom: 6px;
}
.b-num { font-size: 17px; font-weight: 700; letter-spacing: -0.2px; }
.b-cap { font-size: 11px; color: var(--text-2); }
.today-line { margin-top: auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-top: 1px dashed var(--panel-border); }
.today-label { font-size: 12px; color: var(--text-2); font-weight: 600; }
.today-val { font-size: 12.5px; font-weight: 600; }

/* 推荐节点 */
.rec-panel { padding-bottom: 16px; }
.rec-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 14px 20px; }
.rec-item {
  display: flex; flex-direction: column; gap: 6px;
  padding: 16px;
  border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, rgba(148, 163, 184, 0.11), rgba(148, 163, 184, 0.045));
  cursor: pointer; text-align: left;
  transition: all 0.2s; position: relative; overflow: hidden;
}
.rec-item:hover {
  transform: translateY(-2px);
  border-color: var(--panel-border-2);
  box-shadow: var(--shadow-1);
}
.rec-item.sel {
  border-color: rgba(139, 92, 246, 0.62);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.22), rgba(124, 108, 240, 0.32));
  box-shadow: inset 0 0 26px rgba(108, 92, 246, 0.16), 0 0 18px rgba(124, 108, 240, 0.16);
}
.rec-item.sel .rec-name,
.rec-item.sel .rec-ping,
.rec-item.sel .rec-meta { text-shadow: 0 1px 3px rgba(0, 0, 0, 0.42); }
.rec-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.rec-ping { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
.rec-name { font-weight: 700; font-size: 14px; letter-spacing: -0.1px; color: #c6d2e4; }
.rec-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-2); }
.rec-cur { margin-left: 6px; }
.rec-empty { padding: 30px 20px; text-align: center; color: var(--text-3); font-size: 13px; }

@media (max-width: 900px) {
  .hero { padding: 14px 16px 16px; gap: 16px; flex-direction: column; }
  .hero-left { align-items: center; }
  .dash-grid { grid-template-columns: 1fr; }
  .rec-list { grid-template-columns: repeat(2, 1fr); }
}
</style>

<style>
/* 浅色主题 · 总览页央视红金覆盖 */
:root[data-theme='light'] .hero::before {
  background:
    radial-gradient(520px 260px at 50% 0%, rgba(200, 16, 46, 0.07), transparent 66%),
    radial-gradient(380px 240px at 88% 12%, rgba(201, 162, 39, 0.06), transparent 60%);
}
:root[data-theme='light'] .hero-sweep {
  background: linear-gradient(105deg, transparent 30%, rgba(200, 16, 46, 0.06) 45%, rgba(201, 162, 39, 0.05) 55%, transparent 70%);
}
:root[data-theme='light'] .hero-meta {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.4));
  border-color: var(--panel-border);
}
:root[data-theme='light'] .hero-meta::before { background: linear-gradient(90deg, transparent, rgba(200, 16, 46, 0.4), rgba(201, 162, 39, 0.4), transparent); }
:root[data-theme='light'] .rec-item { border-color: var(--panel-border); background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.62)); }
:root[data-theme='light'] .rec-name { color: var(--text-1); }
:root[data-theme='light'] .rec-item.sel { border-color: rgba(200, 16, 46, 0.4); }
:root[data-theme='light'] .hm-line svg { color: var(--text-2); }
:root[data-theme='light'] .hm-label { color: var(--text-2); }
</style>

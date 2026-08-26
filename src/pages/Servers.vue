<template>
  <div class="servers">
    <div class="page-head">
      <div>
        <div class="section-title">服务器 <span class="st-en">Nodes</span></div>
        <div class="section-sub">共 {{ filtered.length }} 个节点 · 点击卡片即可连接</div>
      </div>
      <div class="head-actions">
        <button class="btn" :disabled="testing" @click="runTest">
          <span v-if="testing" class="spin-svg">
            <svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
          </span>
          <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          {{ testing ? '测速中…' : '测速' }}
        </button>
        <button class="btn btn-primary" @click="openImport">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 5v14m0 0l-5-5m5 5l5-5M5 3h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          导入订阅
        </button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="panel filter-bar">
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input v-model="keyword" class="search-input" placeholder="搜索国家 / 城市 / 节点名称…" />
      </div>
      <div class="regions">
        <button v-for="r in regions" :key="r.id" class="chip" :class="{ on: region === r.id }" @click="region = r.id">
          {{ r.label }}
        </button>
      </div>
    </div>

    <!-- 列表（按导入批次分组） -->
    <div class="server-list">
      <div v-for="g in groups" :key="g.batchId" class="batch">
        <div class="batch-head">
          <div class="batch-title">
            <span class="batch-name">{{ g.name }}</span>
            <span class="batch-time">{{ timeLabel(g.importedAt) }}</span>
            <span class="batch-count">{{ g.nodes.length }} 个节点</span>
          </div>
          <button class="batch-rm" @click="askRemoveBatch(g)" title="删除整批订阅节点">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m4 0l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            删除本批
          </button>
        </div>
        <div v-for="s in g.nodes" :key="s.id" class="panel srv" :class="{ sel: isSelected(s), busy: connectingId === s.id }" @click="pick(s)">
          <span v-if="s.subscribed" class="srv-rm" @click.stop="removeNode(s)" title="移除该订阅节点">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </span>
          <span class="cc">{{ s.code }}</span>
          <div class="srv-main">
            <div class="srv-name-row">
              <span class="srv-name">{{ s.name }}</span>
              <span class="badge" :class="protoBadge(s.protocol)">{{ s.protocol }}</span>
              <span v-if="s.subscribed" class="badge badge-purple">订阅</span>
              <span v-if="s.subscribed && !s.hasConfig" class="badge badge-amber" title="该节点是旧版本导入的，缺少加密配置，请点击右上角「导入订阅」重新导入">需重新导入</span>
              <span v-if="isSelected(s)" class="badge" :class="connected ? 'badge-green' : 'badge-gray'">
                <span class="dot" :class="connected ? 'dot-green' : 'dot-gray'"></span>{{ connected ? '已连接' : '已选择' }}
              </span>
            </div>
            <div class="srv-meta">
              <span class="srv-city">{{ s.city }} · {{ s.regionName }}</span>
              <span class="srv-desc">{{ s.desc }}</span>
            </div>
            <div class="srv-bar">
              <div class="bar-track"><div class="bar-fill" :style="{ width: barWidth(s.ping) + '%', background: pingColor(s.ping) }"></div></div>
            </div>
          </div>
          <div class="srv-ping">
            <div class="ping-num mono" :style="{ color: pingColor(s.ping) }">{{ s.ping }}<span class="ping-unit">ms</span></div>
            <div class="ping-label">{{ pingLabel(s.ping) }}</div>
          </div>
          <div class="srv-speed">
            <div class="spd-num">{{ s.speed }}</div>
            <div class="spd-label">带宽</div>
          </div>
        </div>
      </div>
      <div v-if="!filtered.length" class="empty panel">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" style="margin-bottom:8px;opacity:.5"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <div>{{ list.length ? '没有找到匹配的节点' : '还没有订阅节点，请点击右上角「导入订阅」添加' }}</div>
      </div>
    </div>

    <!-- 删除整批确认弹窗 -->
    <div v-if="showBatchConfirm" class="modal-mask" @click.self="closeBatchConfirm">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title">删除整批节点</div>
          <button class="modal-close" @click="closeBatchConfirm">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-tip">
            确定要删除「<b>{{ batchTarget?.name }}</b>」的 <b>{{ batchTarget?.nodes?.length }}</b> 个订阅节点吗？删除后不可恢复。
          </p>
          <div class="sub-actions">
            <button class="btn" @click="closeBatchConfirm">取消</button>
            <button class="btn btn-danger" @click="confirmRemoveBatch">确认删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 导入订阅弹窗 -->
    <div v-if="showImport" class="modal-mask" @click.self="closeImport">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title">导入订阅</div>
          <button class="modal-close" @click="closeImport">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-tip">粘贴订阅链接，支持 vmess / vless / ss / ssr / trojan / hysteria2 / tuic / wireguard / Clash 订阅</p>
          <textarea v-model="subUrl" class="sub-input" rows="3" placeholder="https://example.com/subscribe?token=xxx" spellcheck="false"></textarea>
          <div class="sub-actions">
            <button class="btn" @click="closeImport">取消</button>
            <button class="btn btn-primary" :disabled="importing || !subUrl.trim()" @click="doImport">
              <span v-if="importing" class="spin-svg">
                <svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
              </span>
              {{ importing ? '导入中…' : '开始导入' }}
            </button>
          </div>
          <div v-if="importMsg" class="modal-msg" :class="importOk ? 'msg-ok' : 'msg-err'">{{ importMsg }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { store, selectServer, testLatency, connect, importSubscription, removeSubscription, removeBatch } from '../store';
import { pingColor, pingLabel } from '../utils/format';
import { toast } from '../utils/toast';

const keyword = ref('');
const region = ref('all');
const testing = ref(false);
const connecting = ref(false);
const connectingId = ref(null);
const showImport = ref(false);
const subUrl = ref('');
const importing = ref(false);
const importMsg = ref('');
const importOk = ref(false);
const showBatchConfirm = ref(false);
const batchTarget = ref(null);

const regions = [
  { id: 'all', label: '全部' },
  { id: 'asia', label: '亚洲' },
  { id: 'americas', label: '美洲' },
  { id: 'europe', label: '欧洲' },
  { id: 'oceania', label: '大洋洲' },
  { id: 'mideast', label: '中东' }
];

const REGION_NAMES = {
  asia: '亚洲', americas: '美洲', europe: '欧洲', oceania: '大洋洲', mideast: '中东'
};

const connected = computed(() => store.state.state === 'connected');

const list = computed(() =>
  store.servers.map((s) => ({
    ...s,
    ping: store.pings[s.id] ?? s.base,
    regionName: REGION_NAMES[s.region] || s.region
  }))
);

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return list.value.filter((s) => {
    if (region.value !== 'all' && s.region !== region.value) return false;
    if (!kw) return true;
    return (s.name + s.city + s.country + s.protocol).toLowerCase().includes(kw);
  });
});

// 按导入批次分组，批次按导入时间倒序（同时间按批次序号倒序）
const groups = computed(() => {
  const map = new Map();
  for (const s of filtered.value) {
    const id = s.batchId || 'legacy';
    const name = s.batchName || '历史导入';
    const t = s.importedAt || 0;
    if (!map.has(id)) map.set(id, { batchId: id, name, importedAt: t, nodes: [] });
    map.get(id).nodes.push(s);
  }
  const seq = (name) => {
    const m = /批次\s*(\d+)/.exec(name || '');
    return m ? parseInt(m[1], 10) : -1;
  };
  return [...map.values()].sort((a, b) => {
    if (a.importedAt !== b.importedAt) return b.importedAt - a.importedAt;
    return seq(b.name) - seq(a.name);
  });
});

function timeLabel(t) {
  if (!t) return '较早导入';
  const d = new Date(t);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isSelected(s) {
  // 仅当前选中的节点高亮；切换时其他节点立即取消高亮
  return !!s.selected;
}

function protoBadge(p) {
  return { VLESS: 'badge-blue', VMess: 'badge-gray', Trojan: 'badge-amber', SS: 'badge-gray' }[p] || 'badge-gray';
}

function barWidth(ping) {
  return Math.max(12, Math.min(100, 100 - (ping - 20) * 0.5));
}

async function pick(s) {
  if (connecting.value) return;
  connecting.value = true;
  connectingId.value = s.id;
  const FILL_MS = 1500; // 与 srv-fill 动画时长一致
  const t0 = Date.now();
  try {
    await selectServer(s.id);
    await connect();
    // 等过渡动画从左铺到最右边后，再弹出连接成功提示
    const elapsed = Date.now() - t0;
    if (elapsed < FILL_MS) await sleep(FILL_MS - elapsed);
    toast(`已连接 ${s.name}`, 'success');
    // 延迟测速放后台，不阻塞连接完成反馈
    testLatency().then((p) => { store.pings = p; }).catch(() => {});
  } catch (e) {
    toast('连接失败：' + (e.message || String(e)), 'error');
  } finally {
    connecting.value = false;
    connectingId.value = null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTest() {
  if (testing.value) return;
  testing.value = true;
  const p = await testLatency();
  store.pings = p;
  testing.value = false;
  toast('延迟测试完成', 'success');
}

function openImport() {
  showImport.value = true;
  subUrl.value = '';
  importMsg.value = '';
  importOk.value = false;
}

function closeImport() {
  if (importing.value) return;
  showImport.value = false;
}

async function doImport() {
  const url = subUrl.value.trim();
  if (!url || importing.value) return;
  importing.value = true;
  importMsg.value = '';
  try {
    const r = await importSubscription(url);
    importOk.value = true;
    importMsg.value = r.count > 0
      ? `导入成功（批次「${r.batch ? r.batch.name : '—'}」），新增 ${r.count} 个节点，当前共 ${r.total} 个订阅节点`
      : `导入成功，无新增节点（可能已全部存在），当前共 ${r.total} 个订阅节点`;
    toast(`订阅导入成功（${r.count} 个节点）`, 'success');
    // 导入成功后自动关闭弹框（约 0.5s 后），延迟测试放到后台进行，不阻塞关闭
    setTimeout(() => closeImport(), 500);
    testLatency().then((p) => { store.pings = p; }).catch(() => {});
  } catch (e) {
    importOk.value = false;
    importMsg.value = '导入失败：' + (e.message || String(e));
    toast('订阅导入失败', 'error');
  } finally {
    importing.value = false;
  }
}

async function removeNode(s) {
  try {
    await removeSubscription(s.id);
    if (store.state.server?.id === s.id) {
      await selectServer(store.servers[0]?.id);
    }
    toast(`已移除订阅节点 ${s.name}`, 'success');
  } catch (e) {
    toast('移除失败：' + (e.message || String(e)), 'error');
  }
}

function askRemoveBatch(g) {
  batchTarget.value = g;
  showBatchConfirm.value = true;
}

function closeBatchConfirm() {
  showBatchConfirm.value = false;
  batchTarget.value = null;
}

async function confirmRemoveBatch() {
  const g = batchTarget.value;
  if (!g) return;
  try {
    await removeBatch(g.batchId);
    if (store.state.server && g.nodes.some((n) => n.id === store.state.server.id)) {
      const first = store.servers[0];
      if (first) await selectServer(first.id);
    }
    toast(`已删除整批节点（${g.name}，${g.nodes.length} 个）`, 'success');
  } catch (e) {
    toast('删除失败：' + (e.message || String(e)), 'error');
  } finally {
    closeBatchConfirm();
  }
}
</script>

<style scoped>
.servers { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.head-actions { display: flex; gap: 10px; }
.spin-svg { animation: spin-slow 1s linear infinite; display: flex; }

.filter-bar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; flex-wrap: wrap; }
.search-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 220px; color: var(--text-3); }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text-1); font-family: inherit; font-size: 13.5px;
}
.regions { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  padding: 6px 13px; border-radius: 999px; border: 1px solid var(--panel-border);
  background: var(--panel); color: var(--text-2); font-size: 12.5px; cursor: pointer;
  font-family: inherit; font-weight: 600; transition: all 0.18s;
}
.chip:hover { color: var(--text-1); border-color: var(--panel-border-2); }
.chip.on { color: #fff; background: var(--accent-grad); border-color: transparent; box-shadow: 0 4px 14px rgba(108, 92, 246, 0.35); }

.server-list { display: flex; flex-direction: column; gap: 14px; }
.batch { display: flex; flex-direction: column; gap: 8px; }
.batch-head { display: flex; align-items: center; justify-content: space-between; padding: 2px 6px 0; }
.batch-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.batch-name { font-size: 13px; font-weight: 700; color: var(--text-1); white-space: nowrap; }
.batch-time { font-size: 12px; color: var(--text-3); white-space: nowrap; }
.batch-count {
  font-size: 11.5px; color: var(--text-3); background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.07); padding: 2px 9px; border-radius: 999px; white-space: nowrap;
}
.batch-rm {
  display: flex; align-items: center; gap: 5px; flex: none;
  padding: 5px 10px; border-radius: 8px; border: 1px solid var(--panel-border);
  background: transparent; color: var(--text-3); font-size: 12px; cursor: pointer;
  font-family: inherit; font-weight: 600; transition: all 0.15s;
}
.batch-rm:hover { color: #f87171; border-color: rgba(248, 113, 113, 0.5); background: rgba(248, 113, 113, 0.1); }
.btn-danger {
  background: rgba(248, 113, 113, 0.14); color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.4);
}
.btn-danger:hover { background: rgba(248, 113, 113, 0.24); color: #fca5a5; }
.srv { position: relative; display: flex; align-items: center; gap: 16px; padding: 14px 18px; transition: all 0.2s; cursor: pointer; overflow: hidden; }
.srv:hover { transform: translateX(2px); border-color: var(--panel-border-2); }
.srv.sel {
  border-color: rgba(139, 92, 246, 0.8);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(139, 92, 246, 0.28));
  box-shadow: inset 3px 0 0 #7c6cf0, 0 0 24px rgba(124, 108, 240, 0.3), inset 0 0 30px rgba(108, 92, 246, 0.12);
}
.srv.sel .srv-name { color: #fff; }
.srv.sel .cc { background: var(--accent-grad); color: #fff; border-color: transparent; }
.srv.busy { opacity: 0.75; pointer-events: none; }
/* 连接等待 · 从左到右由淡到浓的单向过渡填充 */
.srv.busy::after {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0; right: 0;
  border-radius: inherit; pointer-events: none;
  transform-origin: left center;
  background: linear-gradient(90deg,
    rgba(34, 211, 238, 0.04) 0%, rgba(34, 211, 238, 0.14) 40%, rgba(124, 108, 240, 0.28) 78%, rgba(139, 92, 246, 0.42) 100%);
  animation: srv-fill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes srv-fill {
  0% { transform: scaleX(0); opacity: 0.5; }
  100% { transform: scaleX(1); opacity: 1; }
}
.srv-main { flex: 1; min-width: 0; }
.srv-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.srv-name { font-size: 15px; font-weight: 700; }
.srv-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-3); margin-top: 4px; flex-wrap: wrap; }
.srv-desc { color: var(--text-3); }
.srv-bar { margin-top: 8px; max-width: 260px; }
.bar-track { height: 4px; border-radius: 4px; background: rgba(255,255,255,0.07); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.25, 0.8, 0.25, 1); box-shadow: 0 0 8px currentColor; }
.srv-ping { flex: none; width: 86px; text-align: center; }
.ping-num { font-size: 19px; font-weight: 800; }
.ping-unit { font-size: 11px; font-weight: 600; margin-left: 2px; }
.ping-label { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.srv-speed { flex: none; width: 82px; text-align: center; }
.spd-num { font-size: 13px; font-weight: 700; }
.spd-label { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.dot-gray { background: var(--text-3); }
/* 悬停移除按钮（仅订阅节点，默认隐藏） */
.srv-rm {
  position: absolute; top: 8px; right: 8px; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 7px;
  color: var(--text-3); background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer; opacity: 0; transition: all 0.15s;
}
.srv:hover .srv-rm { opacity: 1; }
.srv-rm:hover { color: #fff; background: rgba(248, 113, 113, 0.25); border-color: rgba(248, 113, 113, 0.55); }
.badge-purple {
  background: rgba(139, 92, 246, 0.16); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.35);
}

.empty { padding: 50px; text-align: center; color: var(--text-3); display: flex; flex-direction: column; align-items: center; }

/* 导入订阅弹窗 */
.modal-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(5, 8, 16, 0.62); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  animation: fade-in 0.18s ease;
}
.modal {
  width: 520px; max-width: calc(100vw - 48px);
  background: var(--panel-2, #131a2a); border: 1px solid var(--panel-border-2, rgba(255,255,255,0.1));
  border-radius: 14px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden; animation: pop-in 0.2s cubic-bezier(0.25, 0.9, 0.4, 1.1);
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px; border-bottom: 1px solid var(--panel-border, rgba(255,255,255,0.08));
}
.modal-title { font-size: 15px; font-weight: 700; }
.modal-close {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-3); cursor: pointer; transition: all 0.15s;
}
.modal-close:hover { background: rgba(255,255,255,0.08); color: var(--text-1); }
.modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.modal-tip { font-size: 12.5px; color: var(--text-3); line-height: 1.6; margin: 0; }
.sub-input {
  width: 100%; padding: 11px 13px; resize: vertical; box-sizing: border-box;
  background: rgba(0, 0, 0, 0.25); border: 1px solid var(--panel-border-2, rgba(255,255,255,0.12));
  border-radius: 10px; color: var(--text-1); font-family: inherit; font-size: 13px;
  outline: none; transition: border-color 0.15s;
}
.sub-input:focus { border-color: rgba(124, 108, 240, 0.6); }
.sub-actions { display: flex; justify-content: flex-end; gap: 10px; }
.modal-msg { font-size: 13px; padding: 10px 12px; border-radius: 9px; line-height: 1.5; }
.msg-ok { color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.25); }
.msg-err { color: #f87171; background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.25); }

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop-in { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: none; } }

@media (max-width: 860px) {
  .srv-speed { display: none; }
}
</style>

<style>
/* 浅色主题 · 服务器页覆盖 */
:root[data-theme='light'] .srv.sel {
  border-color: rgba(200, 16, 46, 0.55);
  background: linear-gradient(135deg, rgba(200, 16, 46, 0.07), rgba(201, 162, 39, 0.1));
  box-shadow: inset 3px 0 0 #c8102e, 0 0 18px rgba(200, 16, 46, 0.14), inset 0 0 22px rgba(200, 16, 46, 0.05);
}
:root[data-theme='light'] .srv.sel .srv-name { color: var(--text-1); }
:root[data-theme='light'] .srv.sel .cc { background: var(--accent-grad); color: #fff; border-color: transparent; }
:root[data-theme='light'] .srv.busy::after {
  background: linear-gradient(90deg,
    rgba(200, 16, 46, 0.06) 0%, rgba(200, 16, 46, 0.15) 40%, rgba(201, 162, 39, 0.24) 78%, rgba(201, 162, 39, 0.32) 100%);
}
:root[data-theme='light'] .batch-count { background: rgba(15, 23, 42, 0.05); border: 1px solid rgba(15, 23, 42, 0.1); }
:root[data-theme='light'] .bar-track { background: rgba(15, 23, 42, 0.08); }
:root[data-theme='light'] .srv-rm { background: rgba(15, 23, 42, 0.06); border: 1px solid rgba(15, 23, 42, 0.08); }
:root[data-theme='light'] .srv-rm:hover { color: #fff; background: rgba(225, 29, 72, 0.25); border-color: rgba(225, 29, 72, 0.5); }
:root[data-theme='light'] .badge-purple { background: rgba(201, 162, 39, 0.14); color: #8a6d1f; border-color: rgba(201, 162, 39, 0.32); }

:root[data-theme='light'] .modal { background: var(--panel-solid); border-color: var(--panel-border-2); box-shadow: var(--shadow-2); }
:root[data-theme='light'] .modal-head { border-bottom-color: var(--panel-border); }
:root[data-theme='light'] .modal-close:hover { background: rgba(15, 23, 42, 0.06); color: var(--text-1); }
:root[data-theme='light'] .sub-input { background: rgba(120, 92, 40, 0.05); border-color: var(--panel-border-2); }
:root[data-theme='light'] .sub-input:focus { border-color: rgba(200, 16, 46, 0.6); }
:root[data-theme='light'] .chip.on { box-shadow: 0 4px 14px rgba(200, 16, 46, 0.3); }
:root[data-theme='light'] .msg-ok { color: #047857; background: rgba(5, 150, 105, 0.1); border-color: rgba(5, 150, 105, 0.24); }
:root[data-theme='light'] .msg-err { color: #be123c; background: rgba(225, 29, 72, 0.08); border-color: rgba(225, 29, 72, 0.22); }
</style>

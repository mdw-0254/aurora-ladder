import { reactive } from 'vue';

const api = window.aurora;

export const store = reactive({
  state: {
    state: 'disconnected',
    server: null,
    runtime: 0,
    upSpeed: 0,
    downSpeed: 0,
    totalUp: 0,
    totalDown: 0,
    todayUp: 0,
    todayDown: 0,
    externalIp: '--',
    port: 7891,
    systemProxy: false,
    proxyMode: 'rule',
    coreStatus: 'running'
  },
  servers: [],
  connections: [],
  logs: [],
  settings: {},
  pings: {},
  version: '1.0.0',
  platform: { platform: 'win32', arch: 'x64' },
  weather: null,
  activePage: 'dashboard',
  updateInfo: null,
  updateDismissed: null,
  busy: false
});

export async function initApp() {
  const step = async (name, fn) => {
    try {
      const v = await fn();
      return v;
    } catch (e) {
      console.error('[init] FAILED:', name, e);
      return null;
    }
  };

  const [state, servers, settings, version, platform, logs, connections, pings] = await Promise.all([
    step('getState', () => api.getState()),
    step('getServers', () => api.getServers()),
    step('getSettings', () => api.getSettings()),
    step('getVersion', () => api.getVersion()),
    step('getPlatform', () => api.getPlatform()),
    step('getLogs', () => api.getLogs()),
    step('getConnections', () => api.getConnections()),
    step('testLatency', () => api.testLatency())
  ]);
  if (state) Object.assign(store.state, state);
  if (servers) store.servers = servers;
  if (settings) store.settings = settings;
  if (version) store.version = version;
  if (platform) store.platform = platform;
  if (logs) store.logs = logs;
  if (connections) store.connections = connections;
  if (pings) store.pings = pings;

  api.onStateUpdate((s) => Object.assign(store.state, s));
  api.onLogAppend((log) => {
    store.logs.push(log);
    if (store.logs.length > 500) store.logs.splice(0, store.logs.length - 500);
  });
  api.onConnectionsUpdate((list) => (store.connections = list));
  api.onUpdateAvailable((info) => {
    store.updateInfo = info;
    // 若出现比上次关闭的版本更新的版本，自动重新提醒
    if (info && store.updateDismissed && info.latest !== store.updateDismissed) store.updateDismissed = null;
  });
}

// 更新提醒是否可见（未被手动关闭）：侧栏/关于页小红点 + 右上角常驻气泡共用
export function isUpdateVisible() {
  return !!(store.updateInfo && store.updateDismissed !== store.updateInfo.latest);
}

// 手动关闭更新提醒（本次会话内不再显示该版本）
export function dismissUpdate() {
  if (store.updateInfo) store.updateDismissed = store.updateInfo.latest;
}

export async function connect() {
  if (store.busy) return;
  store.busy = true;
  try {
    const r = await api.connect();
    if (r && r.__error) throw new Error(r.__error);
    if (r) Object.assign(store.state, r);
    return r;
  } finally {
    store.busy = false;
  }
}

export async function disconnect() {
  if (store.busy) return;
  store.busy = true;
  try {
    const s = await api.disconnect();
    Object.assign(store.state, s);
  } finally {
    store.busy = false;
  }
}

export async function selectServer(id) {
  const list = await api.selectServer(id);
  store.servers = list;
}

export async function setSetting(key, value) {
  const s = await api.setSetting(key, value);
  store.settings = s;
}

export async function testLatency() {
  const p = await api.testLatency();
  store.pings = p;
  return p;
}

export async function importSubscription(url) {
  const r = await api.importSubscription(url);
  if (!r.ok) throw new Error(r.error || '导入失败');
  if (r.servers) store.servers = r.servers;
  return r;
}

export async function removeSubscription(id) {
  const r = await api.removeSubscription(id);
  if (r.servers) store.servers = r.servers;
  return r;
}

export async function removeBatch(batchId) {
  const r = await api.removeBatch(batchId);
  if (r.servers) store.servers = r.servers;
  return r;
}

export async function loadWeather() {
  try {
    const w = await api.getWeather();
    store.weather = w;
    return w;
  } catch (e) {
    store.weather = { city: '--', temp: '--', text: '天气获取失败', icon: 'off', ok: false };
    return store.weather;
  }
}

export function navigate(page) {
  store.activePage = page;
}

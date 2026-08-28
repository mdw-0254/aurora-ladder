const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, spawn } = require('child_process');
const SettingsStore = require('./settings-store');
const CoreEngine = require('./core');
const ForwardProxy = require('./proxy-server');
const systemProxy = require('./system-proxy');
const subscription = require('./subscription');
const weatherService = require('./weather');
const { getAllServers, addSubscription, removeSubscription, removeBatch, getBatches } = require('./servers');

// 更新检查：基于 GitHub Releases 检查新版本（发布 Release 时把安装包作为附件上传）
const UPDATE_OWNER = 'mdw-0254';
const UPDATE_REPO = 'aurora-ladder';
// 未配置（仍是占位符）时不启用更新检查
const UPDATE_CONFIGURED =
  UPDATE_OWNER && UPDATE_OWNER.indexOf('你的') === -1 &&
  UPDATE_REPO && UPDATE_REPO.indexOf('你的') === -1;

// GitHub 下载加速镜像（国内网络直连 github.com 下载常被限制，按顺序自动回退；最后兜底直连）
const GH_MIRRORS = [
  'https://ghfast.top/',
  'https://gh.ddlc.top/',
  'https://gh-proxy.com/'
];

// Gitee 镜像仓库（内网/公司网络下优先从 Gitee 下载安装包，访问更稳定）
// Gitee 附件直链与 GitHub Release 下载 URL 同构：/releases/download/{tag}/{fileName}
const GITEE_OWNER = 'mdw521';

// 更新状态：下载完成（便携版）后记录待自动应用的信息；程序退出时用它替换旧 exe 并启动新版
let pendingUpdate = null;
let updateSpawned = false;
// 把 GitHub Release 下载地址转换成对应 Gitee 直链；不是 GitHub 下载地址时返回 null
function toGiteeDownloadUrl(u) {
  const m = /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/([^/?]+)\/([^/?]+)$/i.exec(String(u || ''));
  if (!m) return null;
  return `https://gitee.com/${GITEE_OWNER}/${UPDATE_REPO}/releases/download/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}`;
}
// 把 Gitee 直链转换回对应 GitHub Release 下载地址（作为 Gitee 不可用时的兜底）；不是 Gitee 直链时返回 null
function toGitHubDownloadUrl(u) {
  const m = /^https:\/\/gitee\.com\/[^/]+\/[^/]+\/releases\/download\/([^/?]+)\/([^/?]+)$/i.exec(String(u || ''));
  if (!m) return null;
  return `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/download/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}`;
}
// 展开下载候选源：优先 Gitee 直链 → GitHub 加速镜像 → GitHub 直连兜底；非 release 链接原样返回
function expandDownloadSources(url) {
  const sources = [];
  let gitee = null, github = null;
  if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\//i.test(String(url || ''))) {
    github = url; gitee = toGiteeDownloadUrl(url);
  } else if (/^https:\/\/gitee\.com\/[^/]+\/[^/]+\/releases\/download\//i.test(String(url || ''))) {
    gitee = url; github = toGitHubDownloadUrl(url);
  }
  if (gitee) sources.push(gitee);                 // ① 优先 Gitee
  if (github) {                                   // ② GitHub 镜像 + 直连兜底
    GH_MIRRORS.forEach((m) => sources.push(m + github));
    sources.push(github);
  }
  if (!gitee && !github) sources.push(url);       // ③ 非 release 链接原样
  return sources;
}

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  main();
}

function main() {
  let win = null;
  let tray = null;
  let quitting = false;

  const settings = new SettingsStore();
  const core = new CoreEngine(settings);
  const proxy = new ForwardProxy((up, down) => core.addRealTraffic(up, down));
  proxy.onConnections = (list) => core.setConnections(list);

  // ---------- 窗口 ----------
  function createWindow() {
    const icon = getAppIcon();
    win = new BrowserWindow({
      width: 1022,
      height: 600,
      minWidth: 960,
      minHeight: 560,
      frame: false,
      show: false,
      backgroundColor: '#0a0e17',
      icon,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    win.loadFile(path.join(__dirname, '../dist/index.html'));

    win.once('ready-to-show', () => win.show());

    // 兜底：页面加载完成后确保窗口显示
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (win && !win.isDestroyed() && !win.isVisible()) win.show();
      }, 200);
    });

    win.on('close', (e) => {
      // 关闭时最小化到托盘
      if (!quitting && settings.get('closeToTray')) {
        e.preventDefault();
        win.hide();
      }
    });

    win.on('closed', () => { win = null; });
  }

  function getAppIcon(connected) {
    const file = connected ? 'icon-connected.png' : 'icon.png';
    const p = path.join(__dirname, '..', 'build', file);
    try {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    } catch (e) {}
    return nativeImage.createEmpty();
  }

  // 连接状态变化时切换托盘小图标（已连接为绿色变体）
  function setTrayIcon(connected) {
    if (!tray) return;
    const icon = getAppIcon(connected);
    if (!icon.isEmpty()) tray.setImage(icon.resize({ width: 16, height: 16 }));
  }

  // 连接状态变化时同步切换主窗口任务栏图标（尽力同步，Windows 可能缓存）
  function setWindowIcon(connected) {
    if (!win || win.isDestroyed()) return;
    const icon = getAppIcon(connected);
    if (!icon.isEmpty()) win.setIcon(icon);
  }

  // 统一同步托盘 + 任务栏图标
  function syncIcons(connected) {
    setTrayIcon(connected);
    setWindowIcon(connected);
  }

  // ---------- 托盘 ----------
  function createTray() {
    const icon = getAppIcon(core.state === 'connected');
    if (icon.isEmpty()) return;
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('Aurora');
    rebuildTrayMenu();
    tray.on('click', () => {
      if (win) {
        win.isVisible() ? win.hide() : win.show();
      }
    });
  }

  function rebuildTrayMenu() {
    if (!tray) return;
    const connected = core.state === 'connected';
    syncIcons(connected);
    const menu = Menu.buildFromTemplate([
      { label: 'Aurora', enabled: false },
      { type: 'separator' },
      {
        label: connected ? '断开连接' : '连接',
        click: () => { connected ? core.disconnect() : core.connect(); }
      },
      { label: '显示主界面', click: () => { if (win) { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: '退出', click: () => { quitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
  }

  // ---------- 系统代理管理（连接时开启、断开时关闭） ----------
  async function setSystemProxy(on) {
    try {
      if (on) {
        await systemProxy.enable(settings.get('port'));
        core.info('系统代理已开启（127.0.0.1:' + settings.get('port') + '）');
      } else {
        await systemProxy.disable();
      }
    } catch (e) {
      core.warn('系统代理设置失败：' + (e.message || e));
    }
  }

  // 探测节点服务器 TCP 可达性
  function testNodeReach(conn, timeout = 8000) {
    return new Promise((resolve) => {
      const net = require('net');
      const s = net.connect(conn.port, conn.host, () => { s.destroy(); resolve(true); });
      s.setTimeout(timeout, () => { s.destroy(); resolve(false); });
      s.on('error', () => resolve(false));
    });
  }

  // 通过本地代理隧道检测真实出口 IP（同时验证整条链路）
  function checkExternalIp() {
    const port = settings.get('port');
    const http = require('http');
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'GET',
        path: 'http://api.ipify.org/',
        headers: { Host: 'api.ipify.org', 'User-Agent': 'Aurora/1.0', Connection: 'close' },
        timeout: 12000
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          const ip = body.trim();
          if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
            core.setExternalIp(ip);
            core.info('出口 IP：' + ip + '  （隧道已连通，可以正常上网）');
          } else {
            core.setExternalIp('--');
            core.warn('出口 IP 检测异常：' + (ip.slice(0, 40) || '无响应'));
          }
        });
      }
    );
    req.on('timeout', () => { try { req.destroy(new Error('timeout')); } catch (e) {} });
    req.on('error', (e) => core.warn('出口 IP 检测失败：' + e.message + '，请确认节点可用'));
    req.end();
  }

  // 渲染进程只展示公开字段，凭据（conn.password 等）不下发到前端
  const sanitizeServers = (list) =>
    list.map((s) => {
      const { conn, ...rest } = s;
      return { ...rest, hasConfig: !!(conn && conn.password) };
    });

  // ---------- 连接 / 断开（IPC 与托盘共用） ----------
  async function doConnect() {
    const all = getAllServers(settings);
    if (!all.length) throw new Error('暂无节点，请先在服务器页导入订阅');
    const id = settings.get('selectedServerId');
    const node = all.find(s => s.id === id) || all[0];
    const conn = node && node.conn;
    if (!conn || conn.protocol !== 'SS') {
      throw new Error(`该节点暂不支持直连（${conn ? conn.protocol + ' 协议' : '缺少配置'}）。当前版本支持 SS 节点，请在服务器页重新导入订阅`);
    }
    if (!conn.method || !conn.password) {
      throw new Error('节点缺少加密配置（旧版本导入）。请在服务器页重新导入订阅后再连接');
    }
    const reach = await testNodeReach(conn);
    if (!reach) throw new Error('无法连接节点服务器（超时），请更换节点或检查网络后重试');
    await proxy.start(settings.get('port'));
    proxy.setNode(node);
    await core.connect();
    await setSystemProxy(true);
    rebuildTrayMenu();
    checkExternalIp();
    return core.snapshot();
  }

  async function doDisconnect() {
    await core.disconnect();
    await setSystemProxy(false);
    proxy.stop();
    rebuildTrayMenu();
    return core.snapshot();
  }

  // ---------- IPC ----------
  function broadcast(channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }

  core.emit = (channel, payload) => {
    broadcast(channel, payload);
    // 任何连接状态变化都同步切换托盘 + 任务栏小图标
    if (channel === 'stateUpdate' && payload && payload.state) {
      syncIcons(payload.state === 'connected');
    }
  };

  ipcMain.handle('app:getState', () => core.snapshot());
  ipcMain.handle('app:connect', async () => {
    try {
      return await doConnect();
    } catch (e) {
      console.error('[app:connect] failed:', e);
      core.error('连接失败：' + (e.message || String(e)));
      return { __error: e.message || String(e) };
    }
  });
  ipcMain.handle('app:disconnect', async () => {
    try {
      return await doDisconnect();
    } catch (e) {
      return { __error: e.message || String(e) };
    }
  });
  ipcMain.handle('app:getServers', () => {
    return sanitizeServers(getAllServers(settings).map(s => ({ ...s, selected: s.id === settings.get('selectedServerId') })));
  });
  ipcMain.handle('app:selectServer', (e, id) => {
    settings.set('selectedServerId', id);
    return sanitizeServers(getAllServers(settings).map(s => ({ ...s, selected: s.id === id })));
  });
  // 订阅导入：抓取订阅链接 → 解析节点 → 转内部服务器格式 → 持久化（每次导入算作一批）
  ipcMain.handle('app:importSubscription', async (e, url) => {
    try {
      const nodes = await subscription.importSubscription(String(url).trim());
      if (!nodes.length) throw new Error('订阅内容解析不到可用节点');
      const servers = nodes.map(n => subscription.toServer(n));
      const res = addSubscription(settings, servers);
      const total = getAllServers(settings).length;
      core.info(`订阅导入成功：新增 ${res.freshCount} 个节点（批次「${res.batch.name}」，共 ${total} 个订阅节点）`);
      return { ok: true, count: res.freshCount, total, batch: res.freshCount ? res.batch : null, servers: sanitizeServers(getAllServers(settings)) };
    } catch (err) {
      console.error('[importSubscription] failed:', err);
      core.error('订阅导入失败：' + (err.message || String(err)));
      return { ok: false, error: err.message || String(err) };
    }
  });
  // 移除订阅节点
  ipcMain.handle('app:removeSubscription', (e, id) => {
    const next = removeSubscription(settings, String(id));
    core.info('已移除订阅节点，剩余 ' + next.length + ' 个');
    return { ok: true, total: next.length, servers: sanitizeServers(getAllServers(settings)) };
  });
  // 删除整批订阅节点
  ipcMain.handle('app:removeBatch', (e, batchId) => {
    const next = removeBatch(settings, String(batchId));
    core.info('已删除整批订阅节点，剩余 ' + next.length + ' 个');
    return { ok: true, total: next.length, servers: sanitizeServers(getAllServers(settings)) };
  });
  // 订阅批次列表由 getServers 数据中的批次信息渲染，无需单独 IPC
  ipcMain.handle('app:testLatency', () => core.testLatency());
  ipcMain.handle('app:getConnections', () => core.connections);
  ipcMain.handle('app:getLogs', () => core.logs.slice(-300));
  ipcMain.handle('app:getSettings', () => settings.get());
  ipcMain.handle('app:setSetting', (e, key, value) => {
    settings.set(key, value);
    if (key === 'launchOnBoot') {
      app.setLoginItemSettings({ openAtLogin: !!value });
    }
    if (key === 'systemProxy' && core.state === 'connected') {
      setSystemProxy(!!value);
    }
    return settings.get();
  });
  ipcMain.handle('app:getWeather', (e, force) => weatherService.getWeather(!!force));
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => ({ platform: process.platform, arch: process.arch }));
  ipcMain.handle('app:windowControl', (e, action) => {
    if (!win) return;
    if (action === 'minimize') win.minimize();
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (action === 'close') win.close();
    else if (action === 'hide') win.hide();
  });
  ipcMain.handle('app:openExternal', (e, url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });
  // 手动检查更新（供「关于」页调用，返回结果对象由渲染层提示）
  ipcMain.handle('app:checkUpdate', async () => {
    if (!UPDATE_CONFIGURED) return { error: '尚未配置更新仓库（main.js 中的 UPDATE_OWNER / UPDATE_REPO）' };
    return checkUpdate();
  });
  // 一键下载新版：下载完整安装包 → 界面引导用户手动替换（不做自动退出/替换/重启）
  ipcMain.handle('app:updateApp', async (e, payload) => {
    const url = (payload && payload.downloadUrl) || '';
    if (!/^https?:\/\//.test(String(url))) return { error: '无效的下载地址' };
    return applyUpdate(String(url), (payload && payload.size) || 0);
  });
  // 强制退出并应用已下载的更新：先置 quitting=true（绕过「关闭到托盘」拦截），
  // 并在退出前立即启动自动更新进程；若当前没有待装更新则仅退出。
  ipcMain.handle('app:quitForUpdate', () => {
    quitting = true;
    if (pendingUpdate && pendingUpdate.oldExe && pendingUpdate.newFile && !updateSpawned) {
      updateSpawned = true;
      try { spawnAutoUpdate(pendingUpdate.oldExe, pendingUpdate.newFile); } catch (e) {}
    }
    app.quit();
    return true;
  });
  // 在系统文件管理器中定位已下载的新安装包（供「打开所在文件夹」按钮使用）
  ipcMain.handle('app:showItemInFolder', (e, p) => {
    if (!p || typeof p !== 'string') return false;
    try { shell.showItemInFolder(p); return true; } catch (err) { return false; }
  });

  // ---------- 版本检查 ----------
  // 简单语义化版本比较：a > b 时返回 true（支持 1.0.1、1.0.1-beta 等三段式）
  function isNewer(a, b) {
    const pa = String(a || '').trim().split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b || '').trim().split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return true;
      if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return false;
  }

  // 检查更新：优先查询 Gitee（国内快、不受 GitHub 限制）；Gitee 不可用时回退 GitHub
  // 返回 { hasUpdate, latest, current, downloadUrl, size, notice } 或 { error }
  async function checkUpdate() {
    const current = app.getVersion();
    const baseGitee = `https://gitee.com/api/v5/repos/${GITEE_OWNER}/${UPDATE_REPO}`;
    const baseGh = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}`;
    const ghHeaders = { 'User-Agent': 'Aurora', Accept: 'application/vnd.github+json' };
    const getJson = async (base, p, headers) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(base + p, { headers: headers || { 'User-Agent': 'Aurora' }, signal: ctrl.signal });
        if (res.status === 404) return null; // 无版本 / 仅预发布
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        if (e.name === 'AbortError') throw new Error('检查超时，请检查网络');
        throw new Error('网络异常，请检查网络后重试');
      } finally {
        clearTimeout(timer);
      }
    };

    // 来源① 优先 Gitee：latest release → 附件列表 → 构造 Gitee 直链下载
    try {
      const rel = await getJson(baseGitee, '/releases/latest');
      if (rel && rel.tag_name) {
        const tag = String(rel.tag_name || '').replace(/^v/i, '');
        let exeName = '', exeSize = 0;
        try {
          const afs = await getJson(baseGitee, `/releases/${rel.id}/attach_files`) || [];
          const exe = afs.find((a) => /\.exe$/i.test(a && a.name) && a.name);
          if (exe) { exeName = exe.name; exeSize = exe.size || 0; }
        } catch (e) { /* 附件接口失败则按无附件处理 */ }
        if (!exeName) {
          return { hasUpdate: false, latest: current, current, notice: `检测到新版 v${tag}，但暂无可下载的安装包` };
        }
        const dl = `https://gitee.com/${GITEE_OWNER}/${UPDATE_REPO}/releases/download/${encodeURIComponent(rel.tag_name)}/${encodeURIComponent(exeName)}`;
        return {
          hasUpdate: isNewer(tag, current), latest: tag, current,
          downloadUrl: dl, size: exeSize || 0, htmlUrl: rel.html_url || baseGitee, source: 'gitee'
        };
      }
    } catch (e) { /* Gitee 不可用则回退 GitHub */ }

    // 来源② 回退 GitHub：优先取最新稳定版；若仅存在预发布（/latest 返回 404）则回退取版本列表最新一个
    try {
      let data = await getJson(baseGh, '/releases/latest', ghHeaders);
      if (!data) {
        const list = await getJson(baseGh, '/releases?per_page=5', ghHeaders);
        data = (list || []).find((r) => !r.draft) || null;
      }
      if (!data) return { hasUpdate: false, latest: current, current };
      const latest = String(data.tag_name || '').replace(/^v/i, '');
      const exe = (data.assets || []).find((a) => /\.exe$/i.test(a && a.name));
      if (!exe || !exe.browser_download_url) {
        // 有新版本但尚未上传安装包：不提示可更新，避免下载到无效内容
        return { hasUpdate: false, latest: current, current, notice: `检测到新版 v${latest}，但暂无可下载的安装包` };
      }
      return {
        hasUpdate: isNewer(latest, current), latest, current,
        downloadUrl: exe.browser_download_url, size: exe.size || 0, htmlUrl: data.html_url || baseGh, source: 'github'
      };
    } catch (e) {
      return { error: (e && e.message) || String(e) };
    }
  }

  // 从 URL 下载安装包到本地文件（多源镜像回退 + 完整性校验 + 进度回调），返回下载文件路径
  async function downloadFile(url, destPath, onProgress, expectedSize) {
    // 候选下载源：优先 Gitee 直链 → GitHub 加速镜像 → GitHub 直连兜底；其他链接直接下载
    const sources = expandDownloadSources(url);
    let lastErr = null;
    for (const src of sources) {
      try {
        return await downloadStream(src, destPath, onProgress, expectedSize);
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error('网络无法连接更新服务器，请检查网络后重试' + (lastErr ? '（' + lastErr.message + '）' : ''));
  }

  // 从单个源流式下载到本地文件（失败时抛错交由外层回退下一个源）
  async function downloadStream(url, destPath, onProgress, expectedSize) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Aurora' } });
    if (!res.ok || !res.body) throw new Error('下载失败：HTTP ' + res.status);
    const total = parseInt(res.headers.get('content-length') || '0', 10);
    let received = 0;
    const file = fs.createWriteStream(destPath);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (onProgress && total) onProgress(Math.min(100, Math.round((received / total) * 100)));
      if (!file.write(value)) await new Promise((r) => file.once('drain', r));
    }
    await new Promise((resolve, reject) => file.end((err) => (err ? reject(err) : resolve())));
    // 完整性校验：已知预期大小且不一致时判为失败，触发回退
    if (expectedSize > 0 && received !== expectedSize) {
      throw new Error('下载文件不完整（' + received + '/' + expectedSize + '）');
    }
    return destPath;
  }

  // ---------- 更新诊断日志 ----------
  // 把更新替换/重启的每一步（以及 PowerShell 子进程的执行结果）写入 <安装包目录>/update.log
  // 便于定位「下载完成但未重启」类问题：被杀软拦截 / 中文路径 / 退出时序等都能看到
  function updateLogPath(portableExe) {
    if (!portableExe) return path.join(app.getPath('userData'), 'update.log');
    const prefer = path.join(path.dirname(portableExe), 'update.log');
    try {
      fs.writeFileSync(prefer, '', { flag: 'a' });
      return prefer;
    } catch (e) {
      return path.join(app.getPath('userData'), 'update.log');
    }
  }
  function logUpdate(portableExe, msg) {
    try {
      const p = updateLogPath(portableExe);
      fs.appendFileSync(p, '[' + new Date().toLocaleString() + '] ' + msg + '\n', 'utf8');
    } catch (e) { /* 日志失败不阻断主流程 */ }
  }

  // 一键下载新版：仅把完整安装包下载到「程序同目录」，完成后在界面给出清晰的手动替换指引
  // 说明：不做后台退出/替换/重启（公司安全软件普遍会拦截「覆盖 exe + 自启」行为，历史上 PowerShell/cmd 方案均因此失效），
  //       改为「下载完成 → 用户退出程序 → 双击新包运行（或用它覆盖旧文件）」的稳妥方式，下载不会白费
  function applyUpdate(downloadUrl, expectedSize) {
    const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
    // 便携版下载到程序同目录（方便用户直接找到并替换）；非便携版下载到系统「下载」目录
    const dir = portableExe ? path.dirname(portableExe) : app.getPath('downloads');
    let fileName = '';
    try { fileName = decodeURIComponent(path.basename(new URL(downloadUrl).pathname)); } catch (e) {}
    if (!fileName || !/\.exe$/i.test(fileName)) fileName = 'Aurora-' + app.getVersion() + '-portable.exe';
    const newFile = path.join(dir, fileName);
    // 下载期间用隐藏后缀，避免下载到一半被误双击；完成后改名为正式 exe
    const tmp = newFile + '.download';
    logUpdate(portableExe, 'start download. newFile=' + newFile + ' tmp=' + tmp + ' expectedSize=' + expectedSize);

    broadcast('updateProgress', { phase: 'download', percent: 0 });
    downloadFile(downloadUrl, tmp, (percent) => broadcast('updateProgress', { phase: 'download', percent }), expectedSize)
      .then(() => {
        // 下载完整 → 改名为正式安装包
        let final = newFile;
        try {
          if (fs.existsSync(newFile)) fs.unlinkSync(newFile);
          fs.renameSync(tmp, newFile);
        } catch (e) {
          try { fs.copyFileSync(tmp, newFile); fs.unlinkSync(tmp); } catch (_) { final = tmp; }
        }
        logUpdate(portableExe, 'download done -> ' + final);
        // 便携版：记录待自动应用（退出程序时覆盖旧 exe 并启动新版）；非便携版仍走手动指引
        const auto = !!portableExe && !!final && final.toLowerCase() !== String(portableExe).toLowerCase();
        pendingUpdate = auto ? { oldExe: portableExe, newFile: final, fileName } : null;
        updateSpawned = false;
        broadcast('updateProgress', { phase: 'ready', path: final, oldExe: portableExe || '', fileName, auto });
        return { ok: true, downloaded: true, path: final, auto };
      })
      .catch((err) => {
        logUpdate(portableExe, 'download failed: ' + ((err && err.message) || String(err)));
        try { fs.unlinkSync(tmp); } catch (e) {}
        broadcast('updateProgress', { phase: 'error', message: (err && err.message) || String(err) });
        return { ok: false, error: (err && err.message) || String(err) };
      });
    return { ok: true };
  }

  // 生成并启动「分离式」PowerShell 自动更新进程：等旧程序退出后 → 直接启动新版 exe 文件。
  // 刻意【不去覆盖旧 exe】：公司安全软件普遍拦截「覆盖 exe + 绕过原文件自启」，改为让新版以独立文件运行，
  // 只做「等待旧进程结束 + 启动新版」，把易被拦截的写文件动作降到最低。
  // 通过 detached + 环境变量传参（而非把路径拼进命令行），规避中文路径与编码问题；
  // 该进程不随主进程退出而终止，因而能等主程序完全关闭后再启动新版。
  function spawnAutoUpdate(oldExe, newExe) {
    const log = updateLogPath(oldExe);
    const script = [
      '$ErrorActionPreference = "SilentlyContinue"',
      '$old = $env:AURORA_OLD',
      '$new = $env:AURORA_NEW',
      '$log = $env:AURORA_UPLOG',
      'Add-Content -LiteralPath $log -Value ("[auto] script started") -Encoding UTF8',
      '$oldName = [IO.Path]::GetFileNameWithoutExtension($old)',
      'for ($i = 0; $i -lt 600; $i++) {',                       // 最多等约 5 分钟旧进程退出，避免单实例锁冲突
      '  $p = Get-Process -Name $oldName -ErrorAction SilentlyContinue',
      '  if (-not $p) { break }',
      '  Start-Sleep -Milliseconds 500',
      '}',
      'Start-Sleep -Milliseconds 1200',
      'try {',
      '  if (Test-Path -LiteralPath $new) {',
      '    Start-Process -FilePath $new',
      '    Add-Content -LiteralPath $log -Value ("[auto] launched new: " + $new) -Encoding UTF8',
      '  } else {',
      '    Add-Content -LiteralPath $log -Value ("[auto] new missing: " + $new) -Encoding UTF8',
      '  }',
      '} catch {',
      '  Add-Content -LiteralPath $log -Value ("[auto] failed: " + $_.Exception.Message) -Encoding UTF8',
      '}'
    ].join('\r\n');
    const b64 = Buffer.from(script, 'utf16le').toString('base64');
    try {
      const cp = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64], {
        detached: true, stdio: 'ignore', windowsHide: true,
        env: Object.assign({}, process.env, { AURORA_OLD: oldExe, AURORA_NEW: newExe, AURORA_UPLOG: log })
      });
      cp.unref();
      logUpdate(oldExe, 'spawned auto-update. pid=' + cp.pid);
      return true;
    } catch (e) {
      logUpdate(oldExe, 'spawn auto-update failed: ' + ((e && e.message) || String(e)));
      return false;
    }
  }

  // 后台检查更新：发现新版本时通知渲染进程（右上角常驻气泡 + 侧栏/关于页小红点）
  // 不弹任何系统托盘气泡 / 对话框，提醒全部在 App 界面内柔和呈现
  async function autoCheckUpdate() {
    let r = null;
    try { r = await checkUpdate(); } catch (e) { r = { error: String(e && e.message || e) }; }
    if (!r || r.error || !r.hasUpdate) return;
    // 通知渲染进程显示提醒；若用户已手动关闭当前版本提醒，渲染进程会保持隐藏
    broadcast('updateAvailable', { latest: r.latest, current: r.current, downloadUrl: r.downloadUrl, size: r.size || 0 });
  }

  // ---------- 生命周期 ----------
  app.on('second-instance', () => {
    if (win) {
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.aurora.app');
    app.setLoginItemSettings({ openAtLogin: settings.get('launchOnBoot') });
    createWindow();
    createTray();
    core.info('Aurora 已启动  v' + app.getVersion());
    core.info('本地代理端口 ' + settings.get('port') + '，等待连接');

    if (settings.get('autoConnect')) {
      setTimeout(() => core.connect(), 800);
    }

    // 更新检查：启动后 5 秒检查一次 + 运行期间每 4 小时周期检查，有新版则以托盘气泡提醒
    if (UPDATE_CONFIGURED) {
      setTimeout(() => { autoCheckUpdate().catch(() => {}); }, 5000);
      setInterval(() => { autoCheckUpdate().catch(() => {}); }, 4 * 60 * 60 * 1000);
    }

    // 冒烟测试钩子：AURORA_SMOKE=1 时自动连接→观察→断开→退出
    if (process.env.AURORA_SMOKE === '1') {
      const smokeFile = process.env.AURORA_SMOKE_FILE;
      const out = (msg) => {
        console.log(msg);
        if (smokeFile) {
          try { require('fs').appendFileSync(smokeFile, msg + '\n'); } catch (e) {}
        }
      };
      setTimeout(async () => {
        const fs = require('fs');
        const capture = async (name) => {
          try {
            const img = await win.webContents.capturePage();
            fs.writeFileSync(smokeFile.replace(/\.log$/, '') + '-' + name + '.png', img.toPNG());
            out('[smoke] captured ' + name);
          } catch (e) {
            out('[smoke] capture failed ' + name + ': ' + e.message);
          }
        };
        const prevNodes = settings.get('subscribedNodes') || [];
        try {
          // 先启动本地 SS 测试环境（本地 SS 服务器 + 目标服务器），用于真实链路验证
          const { startEnvironment } = require('./ss-test-server');
          const env = await startEnvironment();
          const http = require('http');
          const { toServer } = require('./subscription');
          const subServer = http.createServer((req, res) => {
            res.setHeader('content-type', 'text/plain; charset=utf-8');
            // 本地 SS 节点（真实可用）+ 两个展示用节点
            const ssUri = 'ss://' + Buffer.from(env.method + ':' + env.password).toString('base64') + '@127.0.0.1:' + env.ssPort + '#本地测试节点';
            res.end([
              ssUri,
              'vmess://' + Buffer.from(JSON.stringify({ v: '2', ps: '🇭🇰 香港 01 - 专线', add: '103.14.25.71', port: '443', net: 'ws', tls: 'tls' })).toString('base64'),
              'vless://abc@45.76.112.8:443?type=ws&security=tls#🇯🇵 东京%20VIP'
            ].join('\n'));
          });
          await new Promise((r) => subServer.listen(18992, '127.0.0.1', r));
          const nodes = await subscription.importSubscription('http://127.0.0.1:18992/sub');
          out('[smoke] subscription nodes parsed: ' + nodes.length);
          const srv = nodes.map((n) => toServer(n));
          const added = addSubscription(settings, srv);
          out('[smoke] subscription added: ' + added.freshCount + ' total servers=' + getAllServers(settings).length + ' batches=' + getBatches(settings).length);

          // 选择本地 SS 节点并建立真实代理链路（优先本地测试节点，避免命中用户真实节点）
          const ssServer = getAllServers(settings).find((s) => s.conn && s.conn.protocol === 'SS' && s.conn.host === '127.0.0.1')
            || getAllServers(settings).find((s) => s.conn && s.conn.protocol === 'SS');
          if (!ssServer) throw new Error('未找到 SS 测试节点');
          settings.set('selectedServerId', ssServer.id);
          await proxy.start(settings.get('port'));
          proxy.setNode(ssServer);
          await core.connect();
          out('[smoke] connected state=' + core.state + ' server=' + (core.server && core.server.name));
          // 通过本地代理发起真实 HTTP 请求（走 SS 加密隧道 → 本地 SS 服务器 → 本地目标）
          const realBody = await new Promise((resolve, reject) => {
            const http2 = require('http');
            const req = http2.request({
              host: '127.0.0.1', port: settings.get('port'),
              method: 'GET', path: 'http://127.0.0.1:' + env.originPort + '/smoke',
              headers: { Host: '127.0.0.1:' + env.originPort, Connection: 'close' }
            }, (res) => {
              let b = '';
              res.on('data', (c) => b += c);
              res.on('end', () => resolve(b));
            });
            req.on('error', reject);
            req.setTimeout(8000, () => reject(new Error('真实代理请求超时')));
            req.end();
          });
          out('[smoke] real tunnel response: ' + realBody.slice(0, 60));
          if (realBody.includes('PONG-/smoke')) out('[smoke] REAL TUNNEL OK');
          else out('[smoke] REAL TUNNEL FAILED');
          // 连续真实流量（不同大小分批发出），验证实时曲线有数据
          for (let k = 0; k < 10; k++) {
            const size = 48 * 1024 * (1 + (k % 4));
            out('[smoke] burst ' + k + ' start size=' + size);
            await new Promise((resolve) => {
              let done = false;
              const finish = (tag) => { if (!done) { done = true; clearTimeout(hard); out('[smoke] burst ' + k + ' ' + tag); resolve(); } };
              const hard = setTimeout(() => finish('hard-timeout'), 5000);
              const br = http.request({
                host: '127.0.0.1', port: settings.get('port'),
                method: 'GET', path: 'http://127.0.0.1:' + env.originPort + '/burst?size=' + size,
                headers: { Host: '127.0.0.1:' + env.originPort, Connection: 'close' }
              }, (res) => { res.resume(); res.on('end', () => finish('end')); });
              br.on('error', () => finish('error'));
              br.setTimeout(4000, () => { try { br.destroy(); } catch (e) {} finish('timeout'); });
              br.end();
            });
            await new Promise((r) => setTimeout(r, 300));
          }
          await new Promise((r) => setTimeout(r, 800));
          await capture('before');
          await new Promise((r) => setTimeout(r, 1200));
          await capture('connected');
          try {
            const dom = await win.webContents.executeJavaScript(`(() => {
            const q = (s) => (document.querySelector(s) || {}).textContent || '';
            return 'radar=' + (!!document.querySelector('.radar'))
              + ' rings=' + document.querySelectorAll('.radar .ring').length
              + ' sweeps=' + document.querySelectorAll('.radar .sweep-main').length + document.querySelectorAll('.radar .sweep-sub').length
              + ' blips=' + document.querySelectorAll('.radar .blip').length
              + ' stars=' + document.querySelectorAll('.radar .dust-i').length
              + ' sats=' + document.querySelectorAll('.radar .sat').length
              + ' tbWx=' + (!!document.querySelector('.tb-weather'))
              + ' date=[' + q('.wdate') + ']'
              + ' wx=[' + q('.tb-weather') + ']'
              + ' oldNodePill=' + (!!document.querySelector('.tb-pill'))
              + ' pill=[' + q('.status-pill') + ']'
              + ' node=[' + q('.rc-name') + ']'
              + ' | sbNums=[' + ([...document.querySelectorAll('.signal-num')].map(n => n.textContent.trim()).join('|')) + ']'
              + ' sbTrunc=' + ([...document.querySelectorAll('.signal-num')].some(n => /…|\\.\\.\\./.test(n.textContent)));
          })()`);
            out('[smoke] top DOM: ' + dom);
          } catch (e) {
            out('[smoke] top DOM failed: ' + e.message);
          }
          try {
            const info = await win.webContents.executeJavaScript(`(() => {
              const main = document.querySelector('.app-main');
              const rec = document.querySelector('.rec-panel');
              if (!rec) return 'NO_REC_PANEL';
              const r = rec.getBoundingClientRect();
              main.scrollTo({ top: main.scrollTop + r.top - 12, behavior: 'instant' });
              return 'top=' + r.top + ' mainH=' + main.clientHeight;
            })()`);
            out('[smoke] scroll info: ' + info);
            await new Promise((r) => setTimeout(r, 400));
            await capture('recommended');
          } catch (e) {
            out('[smoke] scroll capture skipped: ' + e.message);
          }
          // 服务器页
          try {
            const navLog = await win.webContents.executeJavaScript(`(() => {
              const b = [...document.querySelectorAll('.nav-item')].find(x => x.querySelector('.nav-label') && x.querySelector('.nav-label').textContent.trim() === '服务器');
              if (b) {
                b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                return 'clicked:' + b.className;
              }
              return 'NOT_FOUND';
            })()`);
            out('[smoke] servers nav: ' + navLog);
            await new Promise((r) => setTimeout(r, 900));
            const activeLog = await win.webContents.executeJavaScript(`(() => {
              const a = document.querySelector('.nav-item.active .nav-label');
              return a ? a.textContent.trim() : 'NONE';
            })()`);
            out('[smoke] active page: ' + activeLog);
            await capture('servers');
          } catch (e) {
            out('[smoke] servers capture failed: ' + e.message);
          }
          // 订阅导入 UI 冒烟测试（节点已在上方导入，此处验证弹窗交互 + 去重）
          try {
            const uiLog = await win.webContents.executeJavaScript(`(async () => {
              const click = (sel) => { const el = document.querySelector(sel); if (!el) return 'NO:' + sel; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return 'ok'; };
              const openRes = click('.head-actions .btn-primary');
              await new Promise(r => setTimeout(r, 350));
              const ta = document.querySelector('.sub-input');
              if (!ta) return 'NO_TEXTAREA';
              const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              setter.call(ta, 'http://127.0.0.1:18992/sub');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              await new Promise(r => setTimeout(r, 200));
              const doRes = click('.modal .btn-primary');
              await new Promise(r => setTimeout(r, 1600));
              // 导入成功后弹框应自动关闭（modalVisible=false）
              const modalVisible = !!document.querySelector('.modal');
              const subBadges = document.querySelectorAll('.server-list .badge-purple').length;
              return 'open=' + openRes + ' do=' + doRes + ' modalClosed=' + !modalVisible + ' subBadges=' + subBadges;
            })()`);
            out('[smoke] subscription UI: ' + uiLog);
            await new Promise((r) => setTimeout(r, 300));
            await capture('subscription');
          } catch (e) {
            out('[smoke] subscription UI failed: ' + e.message);
          }
          // 批次分组 + 整批删除冒烟测试
          try {
            const batchLog = await win.webContents.executeJavaScript(`(async () => {
              const heads = [...document.querySelectorAll('.batch-head')];
              const names = heads.map(h => ((h.querySelector('.batch-name') || {}).textContent || '')).join(',');
              const rmBtns = document.querySelectorAll('.batch-rm').length;
              const first = await window.aurora.getServers();
              const batchId = first[0] && first[0].batchId;
              if (!batchId) return 'batchCount=' + heads.length + ' names=' + names + ' rmBtns=' + rmBtns + ' NO_BATCH_ID';
              const before = first.length;
              const r = await window.aurora.removeBatch(batchId);
              return 'batchCount=' + heads.length + ' names=' + names + ' rmBtns=' + rmBtns + ' removeBatch=' + before + '->' + r.servers.length;
            })()`);
            out('[smoke] batch UI: ' + batchLog);
          } catch (e) {
            out('[smoke] batch UI failed: ' + e.message);
          }
          // 关于页（作者 + 打赏）
          try {
            const navLog2 = await win.webContents.executeJavaScript(`(() => {
              const b = [...document.querySelectorAll('.nav-item')].find(x => x.querySelector('.nav-label') && x.querySelector('.nav-label').textContent.trim() === '关于');
              if (b) {
                b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                return 'clicked:' + b.className;
              }
              return 'NOT_FOUND';
            })()`);
            out('[smoke] about nav: ' + navLog2);
            await new Promise((r) => setTimeout(r, 900));
            const activeLog2 = await win.webContents.executeJavaScript(`(() => {
              const a = document.querySelector('.nav-item.active .nav-label');
              return a ? a.textContent.trim() : 'NONE';
            })()`);
            out('[smoke] about active: ' + activeLog2);
            await win.webContents.executeJavaScript(`(() => {
              const main = document.querySelector('.app-main');
              const qr = document.querySelector('.about-donate');
              if (main && qr) {
                main.scrollTo({ top: Math.max(0, main.scrollTop + qr.getBoundingClientRect().top - 150), behavior: 'instant' });
                return 'ok';
              }
              return 'no-qr';
            })()`);
            await new Promise((r) => setTimeout(r, 600));
            await capture('about');
          } catch (e) {
            out('[smoke] about capture failed: ' + e.message);
          }
          out('[smoke] downSpeed=' + core.downSpeed.toFixed(1) + ' upSpeed=' + core.upSpeed.toFixed(1) + ' connections=' + core.connections.length + ' logs=' + core.logs.length);
          const s = core.snapshot();
          out('[smoke] todayDown=' + Math.round(s.todayDown) + ' history=' + s.history.length);
          await core.disconnect();
          proxy.stop();
          out('[smoke] disconnected state=' + core.state);
        } catch (e) {
          out('[smoke] FAILED ' + (e && e.message));
        } finally {
          settings.set('subscribedNodes', prevNodes);
          quitting = true;
          app.quit();
        }
      }, 1200);
    }
  });

  app.on('before-quit', () => {
    quitting = true;
    // 若已下载便携版更新包，则在退出瞬间启动自动更新进程（等待本进程结束后覆盖 exe 并打开新版本）
    if (pendingUpdate && pendingUpdate.oldExe && pendingUpdate.newFile && !updateSpawned) {
      updateSpawned = true;
      try { spawnAutoUpdate(pendingUpdate.oldExe, pendingUpdate.newFile); } catch (e) {}
    }
  });
  app.on('window-all-closed', () => { app.quit(); });
}

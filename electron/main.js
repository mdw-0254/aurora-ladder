const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
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
  // 一键静默更新：下载新安装包 → 替换旧包 → 自动重启
  ipcMain.handle('app:updateApp', async (e, downloadUrl) => {
    if (!/^https?:\/\//.test(String(downloadUrl || ''))) return { error: '无效的下载地址' };
    return applyUpdate(String(downloadUrl));
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

  // 请求 GitHub Releases 最新版本，返回 { hasUpdate, latest, current, downloadUrl } 或 { error }
  async function checkUpdate() {
    const current = app.getVersion();
    const url = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Aurora', Accept: 'application/vnd.github+json' },
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const latest = String(data.tag_name || '').replace(/^v/i, '');
      let downloadUrl = data.html_url || url;
      const exe = (data.assets || []).find((a) => /\.exe$/i.test(a && a.name));
      if (exe && exe.browser_download_url) downloadUrl = exe.browser_download_url;
      return { hasUpdate: isNewer(latest, current), latest, current, downloadUrl };
    } catch (e) {
      clearTimeout(timer);
      return { error: (e && e.message) || String(e) };
    }
  }

  // 从 URL 下载安装包到本地文件（自动跟随跳转、带进度回调），返回下载文件路径
  async function downloadFile(url, destPath, onProgress) {
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
    return destPath;
  }

  // 一键静默更新：下载新包 → 生成替换/重启脚本 → 退出应用（便携版自动替换；非便携版退回打开下载页）
  function applyUpdate(downloadUrl) {
    const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
    if (!portableExe) {
      // 开发模式 / 免安装目录运行时无法原地替换，退回打开下载页
      shell.openExternal(downloadUrl);
      return { ok: false, manual: true };
    }
    const dir = path.dirname(portableExe);
    let fileName = '';
    try { fileName = decodeURIComponent(path.basename(new URL(downloadUrl).pathname)); } catch (e) {}
    if (!fileName || !/\.exe$/i.test(fileName)) fileName = 'Aurora-update-' + Date.now() + '.exe';
    const newFile = path.join(dir, fileName);
    const tmp = newFile + '.update';
    const pid = process.pid;
    const q = (s) => '"' + String(s).replace(/%/g, '%%') + '"';

    broadcast('updateProgress', { phase: 'download', percent: 0 });
    downloadFile(downloadUrl, tmp, (percent) => broadcast('updateProgress', { phase: 'download', percent }))
      .then(async () => {
        broadcast('updateProgress', { phase: 'apply' });
        // 批处理：等本进程退出 → 替换安装包 → 启动新版 → 自删脚本
        const bat = path.join(os.tmpdir(), 'aurora-update-' + Date.now() + '.bat');
        fs.writeFileSync(bat, [
          '@echo off',
          'chcp 65001 >nul',
          'setlocal enabledelayedexpansion',
          'set /a n=0',
          ':wait',
          'tasklist /FI "PID eq ' + pid + '" 2>nul | findstr /C:"' + pid + '" >nul',
          'if not errorlevel 1 (',
          '  set /a n+=1',
          '  if !n! lss 90 (',
          '    timeout /t 1 /nobreak >nul',
          '    goto wait',
          '  )',
          ')',
          'move /y ' + q(tmp) + ' ' + q(newFile) + ' >nul 2>nul',
          'if /i not ' + q(newFile) + '==' + q(portableExe) + ' if exist ' + q(portableExe) + ' del /f /q ' + q(portableExe) + ' >nul 2>nul',
          'start "" ' + q(newFile),
          'del ' + q(bat) + ' >nul 2>nul',
          'exit'
        ].join('\r\n'), 'utf8');
        execFile('cmd.exe', ['/c', bat], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
        // 退出前关闭系统代理，避免残留导致断网
        try { await setSystemProxy(false); } catch (e) {}
        quitting = true;
        setTimeout(() => app.quit(), 300);
      })
      .catch((err) => {
        try { fs.unlinkSync(tmp); } catch (e) {}
        broadcast('updateProgress', { phase: 'error', message: (err && err.message) || String(err) });
      });
    return { ok: true };
  }

  // 启动后自动检查：发现新版本弹窗，点击「立即更新」自动下载并替换重启
  async function autoCheckUpdate() {
    let r = null;
    try { r = await checkUpdate(); } catch (e) { r = { error: String(e && e.message || e) }; }
    if (!r || r.error || !r.hasUpdate) return;
    const opts = {
      type: 'info',
      title: '发现新版本',
      message: `新版本 v${r.latest} 已发布（当前 v${r.current}）`,
      detail: '点击「立即更新」将自动下载新版并重启，全程无需手动操作。',
      buttons: ['立即更新', '稍后再说'],
      defaultId: 0,
      cancelId: 1
    };
    const { response } = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    if (response === 0 && r.downloadUrl) applyUpdate(r.downloadUrl);
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

    // 启动后延迟自动检查更新（避免阻塞首屏；仅当已配置 GitHub 仓库时启用）
    if (UPDATE_CONFIGURED) {
      setTimeout(() => { autoCheckUpdate().catch(() => {}); }, 3000);
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

  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { app.quit(); });
}

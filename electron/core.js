const { getAllServers } = require('./servers');

const COUNTRY_IP = {
  HK: '103.14.25.71', JP: '45.76.112.8', SG: '128.106.44.7',
  TW: '210.63.118.4', KR: '211.233.28.9', US: '162.159.135.1',
  CA: '99.79.12.5', GB: '52.56.18.2', DE: '116.202.18.6',
  FR: '51.210.15.7', NL: '104.26.3.7', AU: '110.174.22.6',
  AE: '94.200.18.3'
};
const DEFAULT_IP = '45.32.44.22';

function randomIp(code) {
  return COUNTRY_IP[code] || DEFAULT_IP;
}

class CoreEngine {
  constructor(settings) {
    this.settings = settings;
    this.state = 'disconnected'; // disconnected | connecting | connected | disconnecting
    this.server = null;
    this.runtime = 0;
    this.externalIp = '--';
    this.upSpeed = 0;
    this.downSpeed = 0;
    this.sessionUp = 0;
    this.sessionDown = 0;
    this.todayUp = 0;
    this.todayDown = 0;
    this.realUp = 0;
    this.realDown = 0;
    this.history = []; // 速度曲线（仅统计真实代理流量）
    this.connections = [];
    this.logs = [];
    this.logId = 0;
    this.connId = 0;
    this.timer = null;
    this.clockTimer = null;
    this._connPrev = {}; // 各连接上一秒累计字节，用于计算实时速率
    this._prevToday = null;
    this.resetTodayIfNeeded();
  }

  resetTodayIfNeeded() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    try {
      const today = this.settings.get('_todayCache') || {};
      if (today.key !== key) {
        this.todayUp = 0;
        this.todayDown = 0;
        this.settings.set('_todayCache', { key, up: 0, down: 0 });
      } else {
        this.todayUp = today.up || 0;
        this.todayDown = today.down || 0;
      }
    } catch (e) {
      this.todayUp = 0;
      this.todayDown = 0;
    }
    this._prevToday = key;
  }

  // ------- 日志 -------
  log(level, message) {
    const item = {
      id: ++this.logId,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      level,
      message
    };
    this.logs.push(item);
    if (this.logs.length > 800) this.logs.splice(0, this.logs.length - 800);
    this.emit('logAppend', item);
  }

  info(m) { this.log('info', m); }
  warn(m) { this.log('warn', m); }
  error(m) { this.log('error', m); }

  // ------- 连接 -------
  async connect() {
    if (this.state !== 'disconnected') return;
    const all = getAllServers(this.settings);
    if (!all.length) {
      this.warn('暂无节点，请先在服务器页导入订阅');
      return;
    }
    const id = this.settings.get('selectedServerId');
    this.server = all.find(s => s.id === id) || all[0];
    this.setState('connecting');
    this.info(`正在连接节点 [${this.server.code} ${this.server.name}] ...`);
    await this.sleep(1500);
    this.externalIp = '--';
    this.setState('connected');
    this.runtime = 0;
    this.info(`连接成功 ✓  当前节点：${this.server.name}  正在检测出口 IP ...`);
    this.startEngine();
  }

  async disconnect() {
    if (this.state === 'disconnected') return;
    this.setState('disconnecting');
    this.info('正在断开连接 ...');
    await this.sleep(600);
    this.stopEngine();
    this.externalIp = '--';
    this.server = null;
    this.upSpeed = 0;
    this.downSpeed = 0;
    this.setState('disconnected');
    this.info('连接已断开');
  }

  setState(s) {
    this.state = s;
    this.emit('stateUpdate', this.snapshot());
  }

  // ------- 引擎循环 -------
  startEngine() {
    this.stopEngine();
    this.realUp = 0;
    this.realDown = 0;
    this._connPrev = {};
    // 每秒：汇总真实代理流量、累计总量、推进速度曲线、更新会话速率
    this.clockTimer = setInterval(() => this.tick(), 1000);
    this.timer = setInterval(() => { this.runtime++; }, 1000);
    this.info('真实流量引擎已启动（统计来自本地代理转发的实际字节）');
  }

  stopEngine() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.timer) clearInterval(this.timer);
    this.clockTimer = null;
    this.timer = null;
    this.connections = [];
    this._connPrev = {};
    this.emit('connectionsUpdate', this.connections);
  }

  // 每秒汇总：速度 = 本秒真实流量 / 1s；无流量则归零
  tick() {
    if (this.state !== 'connected') return;
    const upKB = this.realUp;
    const downKB = this.realDown;
    this.upSpeed = upKB;
    this.downSpeed = downKB;
    const upBytes = upKB * 1024;
    const downBytes = downKB * 1024;
    this.sessionUp += upBytes;
    this.sessionDown += downBytes;
    this.todayUp += upBytes;
    this.todayDown += downBytes;
    this.persistToday();
    this.realUp = 0;
    this.realDown = 0;
    this.history.push({ up: upKB, down: downKB });
    if (this.history.length > 60) this.history.shift();
    this.updateConnSpeed();
    this.emit('stateUpdate', this.snapshot());
    this.emit('connectionsUpdate', this.connections);
  }

  persistToday() {
    try {
      this.settings.set('_todayCache', {
        key: this._prevToday,
        up: Math.round(this.todayUp),
        down: Math.round(this.todayDown)
      });
    } catch (e) { /* ignore */ }
  }

  addRealTraffic(upBytes, downBytes) {
    this.realUp += upBytes / 1024;
    this.realDown += downBytes / 1024;
  }

  // ------- 真实连接列表（来自本地代理） -------
  // 代理每建立/关闭一条 TCP 会话都会回调到这里
  setConnections(list) {
    this.connections = list || [];
    this.emit('connectionsUpdate', this.connections);
  }

  // 按「本秒字节增量」计算每条会话的实时速率（KB/s）
  updateConnSpeed() {
    const prev = this._connPrev || {};
    const next = {};
    for (const c of this.connections) {
      const p = prev[c.id] || { up: 0, down: 0 };
      c.up = Math.max(0, ((c.upBytes || 0) - p.up) / 1024);
      c.down = Math.max(0, ((c.downBytes || 0) - p.down) / 1024);
      c.total = (c.upBytes || 0) + (c.downBytes || 0);
      next[c.id] = { up: c.upBytes || 0, down: c.downBytes || 0 };
    }
    this._connPrev = next;
  }

  // ------- 延迟测试（真实 TCP 握手耗时） -------
  async testLatency() {
    const net = require('net');
    const list = getAllServers(this.settings);
    const results = {};
    await Promise.all(list.map(async (s) => {
      const conn = s && s.conn;
      if (!conn || !conn.host || !conn.port) {
        results[s.id] = -1;
        return;
      }
      const start = Date.now();
      const ok = await new Promise((resolve) => {
        const sock = net.connect(conn.port, conn.host);
        sock.setTimeout(3000);
        sock.on('connect', () => { sock.destroy(); resolve(true); });
        sock.on('timeout', () => { sock.destroy(); resolve(false); });
        sock.on('error', () => resolve(false));
      });
      results[s.id] = ok ? Date.now() - start : -1;
    }));
    return results;
  }

  setExternalIp(ip) {
    this.externalIp = ip || '--';
    this.emit('stateUpdate', this.snapshot());
  }

  snapshot() {
    const s = this.settings;
    return {
      state: this.state,
      server: this.server,
      runtime: this.runtime,
      upSpeed: Math.round(this.upSpeed * 10) / 10,
      downSpeed: Math.round(this.downSpeed * 10) / 10,
      totalUp: this.sessionUp,
      totalDown: this.sessionDown,
      todayUp: this.todayUp,
      todayDown: this.todayDown,
      externalIp: this.externalIp,
      port: s.get('port'),
      systemProxy: s.get('systemProxy'),
      proxyMode: s.get('proxyMode'),
      coreStatus: 'running',
      history: this.history.map(h => ({ up: Math.round(h.up * 10) / 10, down: Math.round(h.down * 10) / 10 }))
    };
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = CoreEngine;

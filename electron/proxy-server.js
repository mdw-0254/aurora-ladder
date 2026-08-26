// 本地转发代理服务器（真实可用的 HTTP/HTTPS 转发代理）
// - 普通 HTTP 请求：转发到目标服务器（直连或经 SS 隧道）
// - CONNECT 隧道（HTTPS/WebSocket）：建立 TCP 隧道并双向转发（直连或经 SS 隧道）
// - 连接了 SS 节点后，流量通过所选节点加密转发（真正实现代理翻墙）
// - 统计真实流量，回传给核心引擎
const http = require('http');
const net = require('net');
const url = require('url');
const { SSTunnel, CIPHERS } = require('./ss-client');

// 常见域名 → 应用识别（用于连接列表展示，无法识别则归为「浏览器」）
const APP_TAGS = [
  { tag: 'CH', color: '#22d3ee', app: 'Chrome', hosts: ['google', 'gstatic', 'googleusercontent', 'googlevideo', 'youtube', 'ytimg'] },
  { tag: 'GH', color: '#8b5cf6', app: 'GitHub', hosts: ['github', 'githubusercontent'] },
  { tag: 'TG', color: '#38bdf8', app: 'Telegram', hosts: ['telegram', 't.me'] },
  { tag: 'TW', color: '#f43f5e', app: 'X/Twitter', hosts: ['twitter', 'x.com'] },
  { tag: 'MS', color: '#34d399', app: 'Microsoft', hosts: ['microsoft', 'windowsupdate', 'office', 'bing'] },
  { tag: 'AP', color: '#fbbf24', app: 'Apple', hosts: ['apple', 'icloud', 'mzstatic'] },
  { tag: 'AI', color: '#a78bfa', app: 'AI 服务', hosts: ['openai', 'chatgpt', 'anthropic', 'claude', 'deepseek'] }
];

function guessApp(host) {
  const h = String(host || '').toLowerCase();
  for (const a of APP_TAGS) {
    if (a.hosts.some((x) => h.includes(x))) return a;
  }
  return { tag: 'WEB', color: '#94a3b8', app: '浏览器' };
}

class ForwardProxy {
  constructor(onTraffic) {
    this.port = 7891;
    this.server = null;
    this.running = false;
    this.node = null; // 当前所选节点（含 conn 配置）
    this.onTraffic = onTraffic || (() => {});
    this.connections = []; // 真实活跃会话
    this.connSeq = 0;
    this.onConnections = null; // 连接列表变化回调（core.setConnections）
  }

  // 设置当前使用的节点（getAllServers 输出的完整对象）
  setNode(node) {
    this.node = node || null;
  }

  // ---------- 真实会话记录 ----------
  _openConn(host, port) {
    const info = guessApp(host);
    const rec = {
      id: 'c' + (++this.connSeq),
      tag: info.tag,
      color: info.color,
      app: info.app,
      host: (host || '') + ':' + (port || 443),
      up: 0, down: 0, total: 0,
      upBytes: 0, downBytes: 0,
      startedAt: Date.now()
    };
    this.connections.push(rec);
    this._notifyConn();
    return rec;
  }

  _connBytes(rec, up, down) {
    if (!rec) return;
    rec.upBytes += up || 0;
    rec.downBytes += down || 0;
  }

  _closeConn(rec) {
    if (!rec) return;
    const i = this.connections.indexOf(rec);
    if (i >= 0) {
      this.connections.splice(i, 1);
      this._notifyConn();
    }
  }

  _notifyConn() {
    if (this.onConnections) this.onConnections(this.connections.slice());
  }

  // 是否具备可用的 SS 节点配置
  _ssConn() {
    const n = this.node;
    if (n && n.conn && n.conn.protocol === 'SS' && n.conn.method && n.conn.password) {
      const cfg = CIPHERS[String(n.conn.method).toLowerCase()];
      if (cfg) return n.conn;
    }
    return null;
  }

  _makeTunnel(ss, host, port) {
    return new SSTunnel(ss, host, port);
  }

  start(port) {
    if (this.running) this.stop();
    this.port = port;
    const self = this;

    this.server = http.createServer((req, res) => {
      self.handleHttp(req, res);
    });

    // CONNECT 隧道
    this.server.on('connect', (req, clientSocket, head) => {
      self.handleConnect(req, clientSocket, head);
    });

    this.server.on('error', (err) => {
      if (this.running) {
        this.running = false;
        this.onTraffic && this.onTraffic(0, 0, 'error:' + err.message);
      }
    });

    return new Promise((resolve, reject) => {
      this.server.listen(port, '127.0.0.1', () => {
        this.running = true;
        resolve(true);
      });
      this.server.once('error', (err) => {
        try { this.server.close(); } catch (e) {}
        this.server = null;
        this.running = false;
        reject(err);
      });
    });
  }

  stop() {
    if (this.server) {
      try { this.server.close(); } catch (e) {}
      this.server = null;
    }
    this.running = false;
    this.connections = [];
    this._notifyConn();
  }

  // ---------- 普通 HTTP（绝对 URI 形式） ----------
  handleHttp(req, res) {
    const target = url.parse(req.url);
    if (!target.hostname) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request');
      return;
    }
    const targetPort = parseInt(target.port, 10) || 80;
    const rec = this._openConn(target.hostname, targetPort);
    res.on('close', () => this._closeConn(rec));
    const ss = this._ssConn();
    if (!ss) {
      this._httpDirect(req, res, target, targetPort, rec);
      return;
    }
    // 经 SS 隧道转发
    let tunnel;
    try {
      tunnel = this._makeTunnel(ss, target.hostname, targetPort);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy Error: ' + e.message);
      return;
    }
    let closed = false;
    tunnel.once('error', (err) => {
      if (closed) return;
      closed = true;
      try {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Proxy Error: ' + err.message);
      } catch (e) {}
    });
    const headers = { ...req.headers };
    delete headers['proxy-connection'];
    delete headers['connection'];
    headers['Connection'] = 'close';
    const proxyReq = http.request(
      {
        hostname: target.hostname,
        port: targetPort,
        method: req.method,
        path: target.path,
        headers,
        createConnection: () => tunnel
      },
      (proxyRes) => {
        if (closed) return;
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.on('data', (chunk) => { this.onTraffic(0, chunk.length); this._connBytes(rec, 0, chunk.length); });
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      if (closed) return;
      closed = true;
      try {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Proxy Error: ' + err.message);
      } catch (e) {}
    });
    req.on('data', (chunk) => {
      this.onTraffic(chunk.length, 0);
      this._connBytes(rec, chunk.length, 0);
      proxyReq.write(chunk);
    });
    req.on('end', () => proxyReq.end());
  }

  // 直连 HTTP 转发（未连接节点 / 无 SS 配置时的兜底）
  _httpDirect(req, res, target, targetPort, rec) {
    const options = {
      hostname: target.hostname,
      port: targetPort,
      method: req.method,
      path: target.path,
      headers: { ...req.headers }
    };
    delete options.headers['proxy-connection'];
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.on('data', (chunk) => { this.onTraffic(0, chunk.length); this._connBytes(rec, 0, chunk.length); });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      try {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Proxy Error: ' + err.message);
      } catch (e) {}
    });
    req.on('data', (chunk) => { this.onTraffic(chunk.length, 0); this._connBytes(rec, chunk.length, 0); });
    req.pipe(proxyReq);
  }

  // ---------- CONNECT 隧道 ----------
  handleConnect(req, clientSocket, head) {
    const idx = req.url.lastIndexOf(':');
    const host = idx >= 0 ? req.url.slice(0, idx) : req.url;
    const port = parseInt(idx >= 0 ? req.url.slice(idx + 1) : '443', 10) || 443;
    const ss = this._ssConn();
    if (!ss) {
      this._connectDirect(host, port, clientSocket, head);
      return;
    }
    // 经 SS 隧道转发
    let tunnel;
    try {
      tunnel = this._makeTunnel(ss, host, port);
    } catch (e) {
      try { clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (err) {}
      return;
    }
    let responded = false;
    tunnel.once('ready', () => {
      if (responded) return;
      responded = true;
      const rec = this._openConn(host, port);
      try { clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); } catch (e) {}
      if (head && head.length) tunnel.write(head);
      clientSocket.pipe(tunnel);
      tunnel.pipe(clientSocket);
      clientSocket.on('data', (d) => { this.onTraffic(d.length, 0); this._connBytes(rec, d.length, 0); });
      tunnel.on('data', (d) => { this.onTraffic(0, d.length); this._connBytes(rec, 0, d.length); });
      const cleanup = () => {
        clientSocket.destroy();
        tunnel.destroy();
        this._closeConn(rec);
      };
      clientSocket.on('close', cleanup);
      tunnel.on('close', cleanup);
      clientSocket.on('error', cleanup);
      tunnel.on('error', cleanup);
    });
    tunnel.once('error', () => {
      if (responded) return;
      responded = true;
      try { clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (e) {}
    });
  }

  // 直连 CONNECT 隧道（兜底）
  _connectDirect(host, port, clientSocket, head) {
    const serverSocket = net.connect(port, host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) serverSocket.write(head);
      clientSocket.pipe(serverSocket);
      serverSocket.pipe(clientSocket);
      clientSocket.on('data', (d) => this.onTraffic(d.length, 0));
      serverSocket.on('data', (d) => this.onTraffic(0, d.length));
      const cleanup = () => {
        clientSocket.destroy();
        serverSocket.destroy();
      };
      clientSocket.on('close', cleanup);
      serverSocket.on('close', cleanup);
      clientSocket.on('error', cleanup);
      serverSocket.on('error', cleanup);
    });
    serverSocket.on('error', () => {
      try { clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (e) {}
    });
  }
}

module.exports = ForwardProxy;

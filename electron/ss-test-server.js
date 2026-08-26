// 冒烟测试专用：本地 SS 服务器(AEAD) + 目标 HTTP 服务器，用于端到端验证真实代理链路
// 仅在 AURORA_SMOKE=1 时由 main.js 使用，不会影响正常运行
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { CIPHERS, evpBytesToKey, hkdfSha1 } = require('./ss-client');

const TAG = 16;
const MAX = 0x3fff;

function incNonce(n) {
  for (let i = 0; i < 12; i++) {
    if (n[i] === 0xff) n[i] = 0;
    else { n[i]++; break; }
  }
  return n;
}

// 启动一个本地 SS 服务器（SIP004 AEAD 服务端实现）
function startSSServer(port, method, password) {
  const cfg = CIPHERS[method];
  if (!cfg) throw new Error('不支持测试加密方式 ' + method);
  const masterKey = evpBytesToKey(password, cfg.keyLen);
  const server = net.createServer((socket) => {
    let rx = Buffer.alloc(0);
    let decKey = null;
    let decNonce = Buffer.alloc(12);
    let target = null;
    let encKey = null;
    let encNonce = Buffer.alloc(12);
    let sentSalt = false;

    const encChunk = (plain, key, nonce) => {
      const enc = (data) => {
        const c = crypto.createCipheriv(cfg.nodeName, key, nonce);
        const ct = Buffer.concat([c.update(data), c.final()]);
        const tag = c.getAuthTag();
        incNonce(nonce);
        return Buffer.concat([ct, tag]);
      };
      const lb = Buffer.alloc(2);
      lb.writeUInt16BE(plain.length);
      return Buffer.concat([enc(lb), enc(plain)]);
    };
    const decChunk = (data, key, nonce) => {
      const d = crypto.createDecipheriv(cfg.nodeName, key, nonce);
      d.setAuthTag(data.slice(data.length - TAG));
      return Buffer.concat([d.update(data.slice(0, data.length - TAG)), d.final()]);
    };

    const sendToClient = (data) => {
      if (!sentSalt) {
        const salt = crypto.randomBytes(cfg.keyLen);
        encKey = hkdfSha1(masterKey, salt, Buffer.from('ss-subkey'), cfg.keyLen);
        socket.write(salt);
        sentSalt = true;
      }
      // 必须按协议上限 MAX 分块加密，否则单个 data 事件里的大载荷会溢出 2 字节长度字段，
      // 客户端会把块长读成 0xffff 之外的值而判为非法、导致链路挂起
      let off = 0;
      while (off < data.length) {
        const part = data.slice(off, off + MAX);
        off += part.length;
        socket.write(encChunk(part, encKey, encNonce));
      }
    };

    socket.on('data', (d) => {
      rx = Buffer.concat([rx, d]);
      try { pump(); } catch (e) { socket.destroy(); }
    });

    function pump() {
      if (!decKey) {
        if (rx.length < cfg.keyLen) return;
        const salt = rx.slice(0, cfg.keyLen);
        rx = rx.slice(cfg.keyLen);
        decKey = hkdfSha1(masterKey, salt, Buffer.from('ss-subkey'), cfg.keyLen);
      }
      for (;;) {
        // 长度字段先「偷看」，整块（长度+载荷+tag）到齐后再消费，
        // 避免 TCP 分包把「长度在 A 段、载荷在 B 段」的块拆散导致 nonce 错位
        if (rx.length < 2 + TAG) return;
        const lb = decChunk(rx.slice(0, 2 + TAG), decKey, decNonce);
        const len = lb.readUInt16BE(0);
        if (!len || len > MAX) throw new Error('bad len ' + len);
        if (rx.length < 2 + TAG + len + TAG) return;
        incNonce(decNonce);
        rx = rx.slice(2 + TAG);
        const payload = decChunk(rx.slice(0, len + TAG), decKey, decNonce);
        incNonce(decNonce);
        rx = rx.slice(len + TAG);
        if (!target) {
          const atyp = payload[0];
          let host, off;
          if (atyp === 1) { host = [...payload.slice(1, 5)].join('.'); off = 5; }
          else if (atyp === 3) { const l = payload[1]; host = payload.slice(2, 2 + l).toString('utf8'); off = 2 + l; }
          else throw new Error('bad atyp ' + atyp);
          const port = payload.readUInt16BE(off);
          target = net.connect(port, host);
          target.on('data', (td) => sendToClient(td));
          target.on('error', () => socket.destroy());
          target.on('close', () => socket.end());
        } else {
          target.write(payload);
        }
      }
    }

    socket.on('error', () => {});
    socket.on('close', () => { if (target) target.destroy(); });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// 启动目标 HTTP 服务器，响应 PONG-<path>；支持 ?size=N 返回指定字节数（用于生成真实流量曲线）
function startOrigin(port) {
  const srv = http.createServer((req, res) => {
    let size = 0;
    try {
      const q = req.url.split('?')[1] || '';
      size = parseInt(new URLSearchParams(q).get('size') || '0', 10);
    } catch (e) {}
    if (size > 0) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': size });
      res.end(Buffer.alloc(Math.min(size, 2 * 1024 * 1024), 65));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('PONG-' + req.url);
    }
  });
  return new Promise((resolve) => srv.listen(port, '127.0.0.1', () => resolve(srv)));
}

// 启动整套测试环境，返回 { ss, origin, close }
async function startEnvironment({ method = 'aes-128-gcm', password = 'aurora-test-pass' } = {}) {
  const ssPort = 19091;
  const originPort = 19092;
  const ss = await startSSServer(ssPort, method, password);
  const origin = await startOrigin(originPort);
  return {
    method,
    password,
    ssPort,
    originPort,
    ssNode: {
      name: '本地测试节点',
      host: '127.0.0.1',
      port: ssPort,
      method,
      password,
      protocol: 'SS'
    },
    close() {
      try { ss.close(); } catch (e) {}
      try { origin.close(); } catch (e) {}
    }
  };
}

module.exports = { startEnvironment, startSSServer, startOrigin };

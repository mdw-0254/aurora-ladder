// Shadowsocks (SS) 真实客户端 · SIP004 AEAD 加密
// 实现：EVP_BytesToKey(MD5) 派生主密钥 → HKDF-SHA1(ss-subkey) 派生会话密钥
//       → [salt][加密长度+tag][加密载荷+tag] 分块传输，目标地址走 SOCKS5 格式
// 对外提供 SSTunnel（一个 Duplex 流），可像普通 Socket 一样 pipe 使用。
const net = require('net');
const crypto = require('crypto');
const { Duplex } = require('stream');

const MAX_CHUNK = 0x3fff; // 单块最大明文长度（协议上限）
const TAG_LEN = 16; // AEAD tag 长度

// 支持的加密方式 → 密钥长度 / Node 对应算法
const CIPHERS = {
  'aes-128-gcm': { keyLen: 16, nodeName: 'aes-128-gcm' },
  'aes-192-gcm': { keyLen: 24, nodeName: 'aes-192-gcm' },
  'aes-256-gcm': { keyLen: 32, nodeName: 'aes-256-gcm' },
  'chacha20-ietf-poly1305': { keyLen: 32, nodeName: 'chacha20-poly1305' },
  'chacha20-poly1305': { keyLen: 32, nodeName: 'chacha20-poly1305' }
};

// ---------- 密钥派生 ----------
// OpenSSL EVP_BytesToKey(MD5)：D_i = MD5(D_{i-1} + password)
function evpBytesToKey(password, keyLen) {
  const passBuf = Buffer.from(String(password), 'utf8');
  let result = Buffer.alloc(0);
  let prev = Buffer.alloc(0);
  while (result.length < keyLen) {
    const h = crypto.createHash('md5');
    h.update(prev);
    h.update(passBuf);
    prev = h.digest();
    result = Buffer.concat([result, prev]);
  }
  return result.slice(0, keyLen);
}

// RFC5869 HKDF-SHA1
function hkdfSha1(ikm, salt, info, length) {
  const prk = crypto.createHmac('sha1', salt).update(ikm).digest();
  let out = Buffer.alloc(0);
  let t = Buffer.alloc(0);
  let counter = 1;
  while (out.length < length) {
    const h = crypto.createHmac('sha1', prk);
    h.update(t);
    h.update(info);
    h.update(Buffer.from([counter]));
    t = h.digest();
    out = Buffer.concat([out, t]);
    counter++;
  }
  return out.slice(0, length);
}

// 12 字节 nonce，按小端无符号整数自增（低位在前）
function incNonce(nonce) {
  for (let i = 0; i < 12; i++) {
    if (nonce[i] === 0xff) nonce[i] = 0;
    else { nonce[i]++; break; }
  }
  return nonce;
}

// 目标地址编码（SOCKS5 格式）：[1字节atyp][地址][2字节端口]
function encodeAddress(host, port) {
  const parts = [];
  const v4 = net.isIPv4(host);
  const v6 = net.isIPv6(host);
  if (v4) {
    parts.push(Buffer.from([0x01]));
    parts.push(Buffer.from(host.split('.').map((n) => parseInt(n, 10) & 0xff)));
  } else if (v6) {
    parts.push(Buffer.from([0x04]));
    parts.push(parseIPv6(host));
  } else {
    const hb = Buffer.from(host, 'utf8');
    if (hb.length > 255) throw new Error('目标域名过长');
    parts.push(Buffer.from([0x03, hb.length]));
    parts.push(hb);
  }
  const p = Buffer.alloc(2);
  p.writeUInt16BE(port & 0xffff);
  parts.push(p);
  return Buffer.concat(parts);
}

// IPv6 文本 → 16 字节（支持 :: 简写）
function parseIPv6(str) {
  const out = Buffer.alloc(16);
  let fill = -1;
  let head = [];
  let tail = [];
  const side = str.split('::');
  if (side.length === 2) {
    head = side[0].length ? side[0].split(':') : [];
    tail = side[1].length ? side[1].split(':') : [];
    fill = head.length + tail.length;
    for (let i = fill; i < 8; i++) { head.push('0'); }
    head = head.concat(tail);
  } else if (side.length === 1 && str.split(':').length <= 8) {
    head = str.split(':');
    while (head.length < 8) head.push('0');
  } else {
    throw new Error('无法解析 IPv6 地址: ' + str);
  }
  if (head.length !== 8) throw new Error('无法解析 IPv6 地址: ' + str);
  for (let i = 0; i < 8; i++) {
    let g = head[i];
    const m = g.match(/^([0-9a-fA-F]*)$/);
    if (!m) throw new Error('无法解析 IPv6 地址: ' + str);
    out.writeUInt16BE(parseInt(g || '0', 16), i * 2);
  }
  return out;
}

// ---------- SSTunnel：加密隧道（Duplex 流） ----------
// 用法：new SSTunnel(node, targetHost, targetPort) 支持 pipe / write / on('data') / on('ready')
class SSTunnel extends Duplex {
  constructor(node, targetHost, targetPort, options) {
    super(options);
    this.node = node;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
    const method = String(node.method || '').toLowerCase();
    this.cfg = CIPHERS[method];
    if (!this.cfg) {
      const err = new Error('不支持的加密方式：' + (node.method || '(空)'));
      process.nextTick(() => this.destroy(err));
      return;
    }
    this._masterKey = evpBytesToKey(node.password || '', this.cfg.keyLen);
    this._encKey = null;
    this._decKey = null;
    this._encNonce = Buffer.alloc(12);
    this._decNonce = Buffer.alloc(12);
    this._rx = Buffer.alloc(0); // 接收缓冲
    this._ready = false;
    this._socket = null;
  }

  // 建立底层 TCP + 发送 salt + 目标地址
  _construct(cb) {
    const socket = net.connect(this.node.port, this.node.host);
    this._socket = socket;
    socket.on('connect', () => {
      try {
        const salt = crypto.randomBytes(this.cfg.keyLen);
        const subKey = hkdfSha1(this._masterKey, salt, Buffer.from('ss-subkey'), this.cfg.keyLen);
        this._encKey = subKey;
        this._decKey = null; // 服务端返回时再派生
        const head = Buffer.concat([salt, this._encryptChunk(encodeAddress(this.targetHost, this.targetPort))]);
        socket.write(head, () => {
          this._ready = true;
          this.emit('ready');
          cb();
        });
      } catch (e) {
        cb(e);
      }
    });
    socket.on('data', (d) => this._onData(d));
    socket.on('error', (e) => this.destroy(e));
    socket.on('end', () => this.push(null));
    socket.on('close', () => this.push(null));
  }

  _read() { /* 数据由 _onData 主动 push */ }

  _write(chunk, enc, cb) {
    let buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc);
    let off = 0;
    const next = () => {
      if (off >= buf.length) { cb(); return; }
      const part = buf.slice(off, off + MAX_CHUNK);
      off += part.length;
      let encBuf;
      try {
        encBuf = this._encryptChunk(part);
      } catch (e) {
        cb(e);
        return;
      }
      if (!this._socket || this._socket.destroyed) { cb(new Error('隧道已关闭')); return; }
      const flushed = this._socket.write(encBuf);
      if (flushed) next();
      else this._socket.once('drain', next);
    };
    next();
  }

  _final(cb) {
    if (this._socket && !this._socket.destroyed) this._socket.end();
    cb();
  }

  _destroy(err, cb) {
    if (this._socket && !this._socket.destroyed) this._socket.destroy();
    cb(err);
  }

  // 加密一块明文 → [加密长度+tag][加密载荷+tag]
  _encryptChunk(plain) {
    const enc = (data) => {
      const c = crypto.createCipheriv(this.cfg.nodeName, this._encKey, this._encNonce);
      const ct = Buffer.concat([c.update(data), c.final()]);
      const tag = c.getAuthTag();
      incNonce(this._encNonce);
      return Buffer.concat([ct, tag]);
    };
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(plain.length);
    return Buffer.concat([enc(lenBuf), enc(plain)]);
  }

  _decrypt(nonce, data) {
    const d = crypto.createDecipheriv(this.cfg.nodeName, this._decKey, nonce);
    d.setAuthTag(data.slice(data.length - TAG_LEN));
    return Buffer.concat([d.update(data.slice(0, data.length - TAG_LEN)), d.final()]);
  }

  _onData(d) {
    this._rx = Buffer.concat([this._rx, d]);
    try {
      this._pump();
    } catch (e) {
      this.destroy(e);
    }
  }

  // 从接收缓冲中按块解密并 push
  // 注意：长度字段必须先「偷看」（不推进 nonce、不消费缓冲），
  // 等确认整块（长度字段 + 载荷 + tag）都已到齐后才消费，
  // 否则 TCP 分包会拆散「长度字段在 A 段、载荷在 B 段」的块，
  // 导致下一轮把载荷误当长度字段，nonce 错位、认证失败。
  _pump() {
    if (!this._decKey) {
      if (this._rx.length < this.cfg.keyLen) return;
      const salt = this._rx.slice(0, this.cfg.keyLen);
      this._rx = this._rx.slice(this.cfg.keyLen);
      this._decKey = hkdfSha1(this._masterKey, salt, Buffer.from('ss-subkey'), this.cfg.keyLen);
    }
    for (;;) {
      const need = 2 + TAG_LEN;
      if (this._rx.length < need) return;
      // 偷看长度字段（不推进 nonce、不消费）
      const lenBuf = this._decrypt(this._decNonce, this._rx.slice(0, need));
      const len = lenBuf.readUInt16BE(0);
      if (len === 0 || len > MAX_CHUNK) {
        this.destroy(new Error('收到非法数据块长度 ' + len));
        return;
      }
      // 整块未到齐：等待更多数据，长度字段尚未消费
      if (this._rx.length < need + len + TAG_LEN) return;
      // 整块已到齐：消费长度字段并推进 nonce
      incNonce(this._decNonce);
      this._rx = this._rx.slice(need);
      const payload = this._decrypt(this._decNonce, this._rx.slice(0, len + TAG_LEN));
      incNonce(this._decNonce);
      this._rx = this._rx.slice(len + TAG_LEN);
      if (this.push(payload) === false) {
        // 消费端背压：暂停底层读
        if (this._socket) this._socket.pause();
      }
    }
  }

  _read() {
    // 消费端请求更多数据时，恢复底层读取
    if (this._socket && this._socket.isPaused && this._socket.isPaused()) this._socket.resume();
  }

  // Node http 客户端会把隧道当 Socket 用，补充必要的方法桩
  setNoDelay() { return this; }
  setKeepAlive() { return this; }
  setTimeout() { return this; }
  ref() { return this; }
  unref() { return this; }
  address() { return {}; }
}

module.exports = { SSTunnel, CIPHERS, evpBytesToKey, hkdfSha1, encodeAddress, parseIPv6 };

// 订阅导入模块：抓取订阅链接，解析 vmess / vless / ss / ssr / trojan / hysteria2 / tuic / wireguard / Clash YAML 节点
const http = require('http');
const https = require('https');
const zlib = require('zlib');

const UA = 'ClashForWindows/0.20.39';

// ---------- 基础工具 ----------
function b64decode(str) {
  try {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const buf = Buffer.from(s, 'base64');
    const out = buf.toString('utf8');
    return out.indexOf('\uFFFD') >= 0 ? null : out;
  } catch (e) {
    return null;
  }
}

function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function flagEmoji(code) {
  try {
    const s = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    if (s.length !== 2) return '🌐';
    return String.fromCodePoint(...[...s].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
  } catch (e) {
    return '🌐';
  }
}

function fetchText(url, timeout = 15000, redirects = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(new Error('订阅地址格式不正确'));
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return reject(new Error('订阅地址必须是 http/https 链接'));
    }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(
      u,
      { headers: { 'User-Agent': UA, Accept: '*/*' }, timeout },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects < 5) {
          res.resume();
          const next = new URL(res.headers.location, u).href;
          return fetchText(next, timeout, redirects + 1).then(resolve, reject);
        }
        if (status >= 400) {
          res.resume();
          return reject(new Error('订阅地址返回 HTTP ' + status));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const buf = Buffer.concat(chunks);
            const enc = (res.headers['content-encoding'] || '').toLowerCase();
            let out = buf;
            if (enc.includes('gzip')) out = zlib.gunzipSync(buf);
            else if (enc.includes('deflate')) out = zlib.inflateSync(buf);
            resolve(out.toString('utf8'));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('请求超时')));
  });
}

// ---------- 国家/地区 ----------
const COUNTRY = {
  HK: { code: 'HK', flag: '🇭🇰', region: 'asia', city: '香港' },
  TW: { code: 'TW', flag: '🇹🇼', region: 'asia', city: '台北' },
  JP: { code: 'JP', flag: '🇯🇵', region: 'asia', city: '东京' },
  KR: { code: 'KR', flag: '🇰🇷', region: 'asia', city: '首尔' },
  SG: { code: 'SG', flag: '🇸🇬', region: 'asia', city: '新加坡' },
  MY: { code: 'MY', flag: '🇲🇾', region: 'asia', city: '吉隆坡' },
  TH: { code: 'TH', flag: '🇹🇭', region: 'asia', city: '曼谷' },
  VN: { code: 'VN', flag: '🇻🇳', region: 'asia', city: '胡志明' },
  ID: { code: 'ID', flag: '🇮🇩', region: 'asia', city: '雅加达' },
  IN: { code: 'IN', flag: '🇮🇳', region: 'asia', city: '孟买' },
  US: { code: 'US', flag: '🇺🇸', region: 'americas', city: '美国' },
  CA: { code: 'CA', flag: '🇨🇦', region: 'americas', city: '加拿大' },
  BR: { code: 'BR', flag: '🇧🇷', region: 'americas', city: '圣保罗' },
  GB: { code: 'GB', flag: '🇬🇧', region: 'europe', city: '伦敦' },
  DE: { code: 'DE', flag: '🇩🇪', region: 'europe', city: '法兰克福' },
  FR: { code: 'FR', flag: '🇫🇷', region: 'europe', city: '巴黎' },
  NL: { code: 'NL', flag: '🇳🇱', region: 'europe', city: '阿姆斯特丹' },
  IT: { code: 'IT', flag: '🇮🇹', region: 'europe', city: '米兰' },
  ES: { code: 'ES', flag: '🇪🇸', region: 'europe', city: '马德里' },
  RU: { code: 'RU', flag: '🇷🇺', region: 'europe', city: '莫斯科' },
  TR: { code: 'TR', flag: '🇹🇷', region: 'europe', city: '伊斯坦布尔' },
  AU: { code: 'AU', flag: '🇦🇺', region: 'oceania', city: '悉尼' },
  AE: { code: 'AE', flag: '🇦🇪', region: 'mideast', city: '迪拜' }
};

const REGION_BASE = { asia: 48, americas: 155, europe: 172, oceania: 158, mideast: 212 };

const CITY_RE = [
  ['香港|hongkong|hong kong|hong-kong', 'HK'],
  ['台湾|taiwan|taipei|台湾', 'TW'],
  ['日本|japan|tokyo|osaka|东京|大阪|大阪', 'JP'],
  ['韩国|korea|seoul|首尔', 'KR'],
  ['新加坡|singapore|新加坡', 'SG'],
  ['马来|malaysia|吉隆坡', 'MY'],
  ['泰国|thailand|曼谷|thai', 'TH'],
  ['越南|vietnam|胡志明', 'VN'],
  ['印尼|indonesia|雅加达', 'ID'],
  ['印度|india|孟买', 'IN'],
  ['美国|united states|los angeles|san jose|san francisco|new york|seattle|dallas|miami|la |us ', 'US'],
  ['加拿大|canada|toronto|vancouver', 'CA'],
  ['巴西|brazil|圣保罗', 'BR'],
  ['英国|united kingdom|london|伦敦|英', 'GB'],
  ['德国|german|frankfurt|法兰克福|德', 'DE'],
  ['法国|france|paris|巴黎|法', 'FR'],
  ['荷兰|netherlands|amsterdam|阿姆斯特丹|荷', 'NL'],
  ['意大利|italy|米兰', 'IT'],
  ['西班牙|spain|马德里', 'ES'],
  ['俄罗斯|russia|moscow|莫斯科|俄', 'RU'],
  ['土耳其|turkey|伊斯坦布尔', 'TR'],
  ['澳洲|australia|sydney|悉尼|澳', 'AU'],
  ['迪拜|dubai|阿联酋|中东|阿联酋', 'AE']
];

function guessCountry(name, host) {
  const text = (name || '') + ' ' + (host || '');
  const em = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (em) {
    // 按码点展开，避免取到孤立代理项（导致 Invalid code point）
    const cps = [...em[0]].map((c) => c.codePointAt(0));
    if (cps.length >= 2) {
      const code = String.fromCodePoint(
        cps[0] - 0x1f1e6 + 65,
        cps[1] - 0x1f1e6 + 65
      );
      if (COUNTRY[code]) return code;
    }
  }
  for (const [re, code] of CITY_RE) {
    if (new RegExp(re, 'i').test(text)) return code;
  }
  const cc = text.match(/\b([A-Z]{2})\b/);
  if (cc && COUNTRY[cc[1]]) return cc[1];
  const tld = (host || '').match(/\.([a-z]{2})$/i);
  if (tld) {
    const map = { jp: 'JP', hk: 'HK', sg: 'SG', tw: 'TW', kr: 'KR', us: 'US', ca: 'CA', uk: 'GB', de: 'DE', fr: 'FR', nl: 'NL', au: 'AU', ae: 'AE', ru: 'RU', in: 'IN', my: 'MY', th: 'TH', vn: 'VN', id: 'ID', br: 'BR', it: 'IT', es: 'ES', tr: 'TR' };
    const code = map[tld[1].toLowerCase()];
    if (code) return code;
  }
  return null;
}

// ---------- 各协议解析 ----------
function parseVmess(uri) {
  const b64 = uri.slice('vmess://'.length);
  const json = b64decode(b64);
  if (!json) return null;
  try {
    const d = JSON.parse(json);
    const port = parseInt(d.port, 10);
    if (!d.add || !port) return null;
    return {
      name: d.ps || d.add + ':' + port,
      host: d.add,
      port,
      protocol: 'VMess',
      network: d.net,
      tls: d.tls,
      sni: d.sni,
      uri
    };
  } catch (e) {
    return null;
  }
}

function parseVless(uri) {
  const m = uri.match(/^vless:\/\/([^@\s]+)@([^:/\s]+):(\d+)(\?[^#\s]*)?(?:#(.+))?$/);
  if (!m) return null;
  const [, , host, portStr, query, name] = m;
  const port = parseInt(portStr, 10);
  if (!host || !port) return null;
  const q = new URLSearchParams(query || '');
  return {
    name: decodeURIComponent(name || '') || host + ':' + port,
    host,
    port,
    protocol: 'VLESS',
    network: q.get('type') || 'tcp',
    tls: q.get('security') || 'none',
    sni: q.get('sni') || q.get('host') || '',
    uri
  };
}

function parseSs(uri) {
  let rest = uri.slice('ss://'.length).split('?')[0];
  let name = '';
  const hashIdx = rest.indexOf('#');
  if (hashIdx >= 0) {
    name = decodeURIComponent(rest.slice(hashIdx + 1));
    rest = rest.slice(0, hashIdx);
  }
  let payload;
  let hostPort;
  if (rest.includes('@')) {
    const at = rest.lastIndexOf('@');
    const userinfo = rest.slice(0, at);
    hostPort = rest.slice(at + 1);
    payload = b64decode(userinfo) || userinfo;
  } else {
    const dec = b64decode(rest);
    if (!dec || !dec.includes('@')) return null;
    payload = dec.split('@')[0];
    hostPort = dec.split('@').slice(1).join('@');
  }
  const hh = hostPort.split(':');
  const host = hh[0];
  const port = parseInt(hh[1], 10);
  if (!host || !port) return null;
  const mm = payload.match(/^([^:]+):(.*)$/);
  return {
    name: name || host + ':' + port,
    host,
    port,
    protocol: 'SS',
    method: mm ? mm[1] : '',
    password: mm ? mm[2] : '',
    uri
  };
}

function parseSsr(uri) {
  const clean = uri.slice('ssr://'.length).split('?')[0];
  const dec = b64decode(clean);
  if (!dec) return null;
  const parts = dec.split(':');
  if (parts.length < 6) return null;
  const host = parts[0];
  const port = parseInt(parts[1], 10);
  if (!host || !port) return null;
  let name = host + ':' + port;
  const m = uri.match(/#([^#\s]+)$/);
  if (m && m[1]) name = decodeURIComponent(m[1]);
  return { name, host, port, protocol: 'SSR', method: parts[3], uri };
}

function parseTrojan(uri) {
  const m = uri.match(/^trojan:\/\/([^@\s]+)@([^:/\s]+):(\d+)(\?[^#\s]*)?(?:#(.+))?$/);
  if (!m) return null;
  const [, , host, portStr, query, name] = m;
  const port = parseInt(portStr, 10);
  if (!host || !port) return null;
  const q = new URLSearchParams(query || '');
  return {
    name: decodeURIComponent(name || '') || host + ':' + port,
    host,
    port,
    protocol: 'Trojan',
    tls: 'tls',
    sni: q.get('sni') || '',
    uri
  };
}

function parseHysteria2(uri) {
  const m = uri.match(/^hysteria2?:\/\/([^@\s]+)@([^:/\s]+):(\d+)(\?[^#\s]*)?(?:#(.+))?$/);
  if (!m) return null;
  const [, , host, portStr, query, name] = m;
  const port = parseInt(portStr, 10);
  if (!host || !port) return null;
  const q = new URLSearchParams(query || '');
  return {
    name: decodeURIComponent(name || '') || host + ':' + port,
    host,
    port,
    protocol: 'Hysteria2',
    sni: q.get('sni') || '',
    uri
  };
}

function parseTuic(uri) {
  const m = uri.match(/^tuic:\/\/([^@\s]+)@([^:/\s]+):(\d+)(\?[^#\s]*)?(?:#(.+))?$/);
  if (!m) return null;
  const [, , host, portStr, query, name] = m;
  const port = parseInt(portStr, 10);
  if (!host || !port) return null;
  const q = new URLSearchParams(query || '');
  return {
    name: decodeURIComponent(name || '') || host + ':' + port,
    host,
    port,
    protocol: 'TUIC',
    sni: q.get('sni') || '',
    uri
  };
}

function parseWireguard(uri) {
  const m = uri.match(/^wireguard:\/\/([^@\s]+)@([^:/\s]+):(\d+)(\?[^#\s]*)?(?:#(.+))?$/);
  if (!m) return null;
  const [, , host, portStr, , name] = m;
  const port = parseInt(portStr, 10);
  if (!host || !port) return null;
  return {
    name: decodeURIComponent(name || '') || host + ':' + port,
    host,
    port,
    protocol: 'WireGuard',
    uri
  };
}

function parseUri(uri) {
  uri = String(uri).trim();
  if (!uri || !/:\/\//.test(uri)) return null;
  if (uri.startsWith('vmess://')) return parseVmess(uri);
  if (uri.startsWith('vless://')) return parseVless(uri);
  if (uri.startsWith('ss://')) return parseSs(uri);
  if (uri.startsWith('ssr://')) return parseSsr(uri);
  if (uri.startsWith('trojan://')) return parseTrojan(uri);
  if (uri.startsWith('hysteria2://') || uri.startsWith('hysteria://')) return parseHysteria2(uri);
  if (uri.startsWith('tuic://')) return parseTuic(uri);
  if (uri.startsWith('wireguard://')) return parseWireguard(uri);
  return null;
}

// ---------- Clash YAML 解析 ----------
function stripQuote(v) {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

// 流式（单行）格式: - { name: x, type: vmess, ... }
function parseClashYamlFlow(block) {
  const nodes = [];
  const flowRe = /-\s*\{([^}]*)\}/g;
  let m;
  while ((m = flowRe.exec(block)) !== null) {
    const body = m[1];
    const kv = {};
    const kvRe = /([A-Za-z-]+)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^,]+))/g;
    let k;
    while ((k = kvRe.exec(body)) !== null) {
      const val = k[2] !== undefined ? k[2] : k[3] !== undefined ? k[3] : (k[4] || '').trim();
      kv[k[1]] = val;
    }
    const node = yamlEntryToNode(kv);
    if (node) nodes.push(node);
  }
  return nodes;
}

function parseClashYaml(text) {
  const idx = text.indexOf('proxies:');
  if (idx < 0) return [];
  const rest = text.slice(idx + 'proxies:'.length);
  const lines = rest.split(/\r?\n/);
  // 确定条目缩进（第一条 "- " 的缩进）
  let itemIndent = -1;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^-\s/.test(t)) { itemIndent = line.match(/^\s*/)[0].length; break; }
    if (!/^\s/.test(line) && !/^-\s/.test(t)) break; // 非缩进的下一顶层键
  }
  if (itemIndent < 0) return parseClashYamlFlow(rest);
  const entries = [];
  let cur = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const indent = line.match(/^\s*/)[0].length;
    if (/^-\s/.test(t) || t === '-') {
      if (cur) entries.push(cur);
      cur = {};
    } else if (cur && indent > itemIndent && /^[A-Za-z-]+\s*:/.test(t)) {
      const m = t.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (m) cur[m[1]] = stripQuote(m[2]);
    } else if (indent <= itemIndent && /^[A-Za-z-]+\s*:/.test(t)) {
      break; // 新的顶层键（如 proxy-groups: / rules:），结束
    }
  }
  if (cur) entries.push(cur);
  const nodes = [];
  for (const e of entries) {
    const node = yamlEntryToNode(e);
    if (node) nodes.push(node);
  }
  return nodes;
}

function yamlEntryToNode(kv) {
  const type = String(kv.type || '').toLowerCase();
  const host = kv.server || kv.address;
  const port = parseInt(kv.port, 10);
  if (!host || !port) return null;
  const base = {
    name: kv.name || host + ':' + port,
    host,
    port,
    uri: 'clash://' + (kv.name || '') + '@' + host + ':' + port
  };
  switch (type) {
    case 'vmess':
      return {
        ...base, protocol: 'VMess',
        uuid: kv.uuid, alterId: kv.alterId || kv.alterid || 0,
        security: kv.security || 'auto',
        network: kv.network, tls: kv.tls,
        sni: kv.servername || kv.sni,
        wsPath: kv['ws-path'] || kv.path,
        wsHost: kv['ws-host'] || kv.host
      };
    case 'vless':
      return {
        ...base, protocol: 'VLESS',
        uuid: kv.uuid,
        network: kv.network, tls: kv.tls,
        sni: kv.servername || kv.sni,
        wsPath: kv['ws-path'] || kv.path,
        wsHost: kv['ws-host'] || kv.host
      };
    case 'ss':
      return { ...base, protocol: 'SS', method: kv.cipher, password: kv.password };
    case 'trojan':
      return { ...base, protocol: 'Trojan', tls: 'tls', sni: kv.sni, password: kv.password };
    case 'ssr':
      return { ...base, protocol: 'SSR' };
    case 'hysteria2':
    case 'hysteria':
      return { ...base, protocol: 'Hysteria2', sni: kv.sni };
    case 'tuic':
      return { ...base, protocol: 'TUIC', sni: kv.sni };
    case 'wireguard':
      return { ...base, protocol: 'WireGuard' };
    default:
      return null;
  }
}

// ---------- 顶层解析 ----------
function decodeBody(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => /:\/\//.test(l))) return lines;
  const dec = b64decode(text.replace(/\s+/g, ''));
  if (dec) {
    const dl = dec.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (dl.some((l) => /:\/\//.test(l))) return dl;
  }
  return [];
}

function toServer(node) {
  const code = guessCountry(node.name, node.host) || 'XX';
  const c = COUNTRY[code] || { code, flag: flagEmoji(code), region: 'other', city: code };
  const parts = [];
  if (node.tls && node.tls !== 'none') parts.push('TLS');
  if (node.network && node.network !== 'tcp') parts.push(node.network);
  parts.push(node.host);
  return {
    id: 'sub' + hashId(node.uri || node.host + ':' + node.port),
    name: node.name || c.city + ' ' + (node.port || ''),
    city: c.city,
    country: c.code,
    code: c.code,
    flag: c.flag,
    region: c.region,
    base: REGION_BASE[c.region] || 150,
    speed: '订阅节点',
    protocol: node.protocol,
    desc: parts.join(' · '),
    subscribed: true,
    uri: node.uri || '',
    // 真实连接所需配置（代理/核心使用，不直接暴露给渲染进程）
    conn: {
      host: node.host,
      port: node.port,
      protocol: node.protocol,
      method: node.method || '',
      password: node.password || '',
      uuid: node.uuid || '',
      alterId: node.alterId || 0,
      security: node.security || '',
      network: node.network || '',
      tls: node.tls || '',
      sni: node.sni || '',
      wsPath: node.wsPath || '',
      wsHost: node.wsHost || ''
    }
  };
}

async function importSubscription(url) {
  const text = await fetchText(url);
  const lines = decodeBody(text);
  const nodes = [];
  for (const line of lines) {
    const n = parseUri(line);
    if (n) nodes.push(n);
  }
  // 若链路解析为空，尝试 Clash YAML（明文或整体 base64 编码）
  if (!nodes.length) {
    let yamlText = text;
    if (!/proxies:/i.test(yamlText)) {
      const dec = b64decode(text.replace(/\s+/g, ''));
      if (dec && /proxies:/i.test(dec)) yamlText = dec;
    }
    if (/proxies:/i.test(yamlText)) nodes.push(...parseClashYaml(yamlText));
  }
  return nodes;
}

module.exports = { importSubscription, toServer };

// 天气服务：Open-Meteo（免费、无需 API key）+ ip-api 定位，失败自动降级
const http = require('http');
const https = require('https');

function get(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(new Error('timeout')); });
  });
}

// WMO 天气代码 → 中文描述 + 图标键
const WMO = {
  0: { t: '晴', i: 'sunny' },
  1: { t: '少云', i: 'cloudy' },
  2: { t: '多云', i: 'cloudy' },
  3: { t: '阴', i: 'overcast' },
  45: { t: '雾', i: 'fog' },
  48: { t: '雾凇', i: 'fog' },
  51: { t: '毛毛雨', i: 'drizzle' },
  53: { t: '毛毛雨', i: 'drizzle' },
  55: { t: '毛毛雨', i: 'drizzle' },
  56: { t: '冻雨', i: 'drizzle' },
  57: { t: '冻雨', i: 'drizzle' },
  61: { t: '小雨', i: 'rain' },
  63: { t: '中雨', i: 'rain' },
  65: { t: '大雨', i: 'rain' },
  66: { t: '冻雨', i: 'rain' },
  67: { t: '冻雨', i: 'rain' },
  71: { t: '小雪', i: 'snow' },
  73: { t: '中雪', i: 'snow' },
  75: { t: '大雪', i: 'snow' },
  77: { t: '雪粒', i: 'snow' },
  80: { t: '阵雨', i: 'rain' },
  81: { t: '阵雨', i: 'rain' },
  82: { t: '强阵雨', i: 'rain' },
  85: { t: '阵雪', i: 'snow' },
  86: { t: '阵雪', i: 'snow' },
  95: { t: '雷阵雨', i: 'storm' },
  96: { t: '雷暴冰雹', i: 'storm' },
  99: { t: '雷暴冰雹', i: 'storm' }
};

let cache = null;
let cacheAt = 0;
let loading = null;

async function getLocation() {
  try {
    const d = await get('http://ip-api.com/json/?fields=status,country,city,lat,lon&lang=zh-CN');
    if (d && d.status === 'success' && d.lat && d.lon) {
      return { city: d.city || d.country || '未知', lat: d.lat, lon: d.lon };
    }
  } catch (e) {}
  return { city: '上海', lat: 31.2304, lon: 121.4737 };
}

async function fetchWeather() {
  try {
    const loc = await getLocation();
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat +
      '&longitude=' + loc.lon + '&current_weather=true&timezone=auto';
    const d = await get(url);
    const cw = d && d.current_weather;
    if (!cw) throw new Error('no data');
    const w = WMO[cw.weathercode] || { t: '未知', i: 'cloudy' };
    return {
      city: loc.city,
      temp: Math.round(cw.temperature),
      text: w.t,
      icon: w.i,
      wind: Math.round(cw.windspeed),
      ok: true
    };
  } catch (e) {
    return { city: '--', temp: '--', text: '天气获取失败', icon: 'off', ok: false };
  }
}

// 30 分钟缓存；并发去重
function getWeather(force) {
  if (force || !cache || Date.now() - cacheAt > 30 * 60 * 1000) {
    if (!loading) {
      loading = fetchWeather().then((r) => {
        cache = r;
        cacheAt = Date.now();
        loading = null;
        return r;
      }).catch((e) => {
        loading = null;
        return { city: '--', temp: '--', text: '天气获取失败', icon: 'off', ok: false };
      });
    }
    return loading;
  }
  return Promise.resolve(cache);
}

module.exports = { getWeather };

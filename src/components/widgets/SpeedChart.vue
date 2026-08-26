<template>
  <div class="speed-chart" @mousemove="onMove" @mouseleave="onLeave">
    <canvas ref="canvas"></canvas>
    <div v-if="!hasData" class="empty-muted">
      <span class="empty-text">{{ live ? '正在等待实时数据…' : '连接后显示实时速度曲线' }}</span>
    </div>
    <div v-else-if="idle" class="idle-hint">
      <span class="idle-dot"></span>
      <span>已连接 · 等待流量</span>
    </div>
    <!-- 悬停详情浮层 -->
    <div v-if="hover" class="chart-tip" :style="tipStyle">
      <div class="tip-time mono">{{ tipTime }}</div>
      <div class="tip-row">
        <i class="tip-dot" style="background:#c8102e"></i>
        <span class="tip-cap">下载</span>
        <span class="tip-val mono">{{ fmtScale(history[hover.idx]?.down || 0) }}</span>
      </div>
      <div class="tip-row">
        <i class="tip-dot" style="background:#c9a227"></i>
        <span class="tip-cap">上传</span>
        <span class="tip-val mono">{{ fmtScale(history[hover.idx]?.up || 0) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';

const props = defineProps({
  history: { type: Array, default: () => [] },
  live: { type: Boolean, default: false }
});

const canvas = ref(null);
let ctx = null;
let ro = null;
let raf = 0;
let ticking = false;

const hover = ref(null); // { idx, x, y, w, h }

const hasData = computed(() => props.history.length > 0);
const idle = computed(() => hasData.value && props.history.every((d) => !d.up && !d.down));

const tipTime = computed(() => {
  if (!hover.value) return '';
  const n = props.history.length;
  const ago = n - 1 - hover.value.idx;
  if (ago <= 0) return '当前';
  return ago + ' 秒前';
});

const tipStyle = computed(() => {
  if (!hover.value) return {};
  const { x, y, w, h } = hover.value;
  const flipX = x < w * 0.5;
  const flipY = y < 46;
  const tx = flipX ? '14px' : 'calc(-100% - 14px)';
  const ty = flipY ? '14px' : 'calc(-100% - 14px)';
  return { left: x + 'px', top: y + 'px', transform: `translate(${tx}, ${ty})` };
});

function fmtScale(v) {
  if (v >= 1024) return (v / 1024).toFixed(v >= 10240 ? 0 : 1) + ' MB/s';
  if (v >= 1) return Math.round(v) + ' KB/s';
  if (v === 0) return '0 B/s';
  return Math.max(1, Math.round(v * 1024)) + ' B/s';
}

function render(now) {
  const el = canvas.value;
  if (!el) return;
  const dpr = window.devicePixelRatio || 1;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w === 0 || h === 0) return;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (el.width !== bw || el.height !== bh) {
    el.width = bw;
    el.height = bh;
    ctx = el.getContext('2d');
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // 主题感知调色板
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const C_DOWN = light ? '#c8102e' : '#22d3ee';
  const C_UP = light ? '#c9a227' : '#8b5cf6';
  const RGB_DOWN = light ? '200,16,46' : '34,211,238';
  const RGB_UP = light ? '201,162,39' : '139,92,246';
  const GRID = light ? 'rgba(120,92,40,0.1)' : 'rgba(148,163,184,0.09)';
  const GRID_STRONG = light ? 'rgba(120,92,40,0.16)' : 'rgba(148,163,184,0.16)';
  const AXIS = light ? 'rgba(120,92,40,0.5)' : 'rgba(148,163,184,0.5)';
  const REF = light ? 'rgba(120,92,40,0.24)' : 'rgba(148,163,184,0.22)';
  const HOLE = light ? '#ffffff' : '#0a101d';

  const data = props.history;
  if (!data.length) return;

  const pad = 6;
  // 自适应量程：量程下限降到 2KB/s，让小额流量也清晰可见（避免曲线贴底不可见）
  const peak = data.reduce((m, d) => Math.max(m, d.up || 0, d.down || 0), 0);
  const max = Math.max(peak, 2) * 1.15;

  // 网格（3 条横线）+ 基线
  ctx.lineWidth = 1;
  ctx.strokeStyle = GRID;
  for (let i = 1; i < 4; i++) {
    const y = pad + (h - pad * 2) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = GRID_STRONG;
  ctx.beginPath();
  ctx.moveTo(0, h - pad);
  ctx.lineTo(w, h - pad);
  ctx.stroke();

  // 右上角量程标注
  ctx.font = '10px "JetBrains Mono", "Consolas", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = AXIS;
  ctx.fillText(fmtScale(max), w - 2, 2);

  const toX = (i) => pad + (w - pad * 2) * (data.length === 1 ? 1 : i / (data.length - 1));
  const toY = (v) => h - pad - (h - pad * 2) * (Math.min(Math.max(v, 0), max) / max);

  const line = (key, color, gradRGB) => {
    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[key] || 0) }));
    // 渐变填充
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${gradRGB},0.26)`);
    grad.addColorStop(1, `rgba(${gradRGB},0)`);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h - pad);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(pts[pts.length - 1].x, h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // 发光曲线
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 最新点光点
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  line('down', C_DOWN, RGB_DOWN);
  line('up', C_UP, RGB_UP);

  // 悬停标记：十字参考线 + 数据点放大高亮
  if (hover.value && hover.value.idx >= 0) {
    const i = hover.value.idx;
    const hx = toX(i);
    // 垂直参考线
    ctx.strokeStyle = REF;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(hx, pad);
    ctx.lineTo(hx, h - pad);
    ctx.stroke();
    ctx.setLineDash([]);
    // 两条曲线的悬停点
    [['down', C_DOWN], ['up', C_UP]].forEach(([key, color]) => {
      const py = toY(data[i]?.[key] || 0);
      ctx.beginPath();
      ctx.arc(hx, py, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = HOLE;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  // 实时扫描线（仅在已连接时缓慢横扫，直观传达「正在实时刷新」）
  if (props.live) {
    const span = 6000;
    const phase = ((now || performance.now()) % span) / span;
    const sx = pad + (w - pad * 2) * phase;
    const sg = ctx.createLinearGradient(sx - 26, 0, sx, 0);
    sg.addColorStop(0, `rgba(${RGB_DOWN},0)`);
    sg.addColorStop(1, `rgba(${RGB_DOWN},0.15)`);
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 26, pad, 26, h - pad * 2);
    ctx.strokeStyle = `rgba(${RGB_DOWN},0.28)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, pad);
    ctx.lineTo(sx, h - pad);
    ctx.stroke();
  }
}

function onMove(e) {
  const el = canvas.value;
  if (!el || !props.history.length) return;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = rect.width;
  const h = rect.height;
  const pad = 6;
  const n = props.history.length;
  const rel = (x - pad) / (w - pad * 2);
  const idx = Math.round(rel * (n - 1));
  const clamped = Math.max(0, Math.min(n - 1, idx));
  hover.value = { idx: clamped, x, y, w, h };
}

function onLeave() {
  hover.value = null;
}

function ensureLoop() {
  if (ticking) return;
  ticking = true;
  const step = (now) => {
    render(now);
    if (props.live) {
      raf = requestAnimationFrame(step);
    } else {
      ticking = false;
    }
  };
  raf = requestAnimationFrame(step);
}

onMounted(() => {
  ro = new ResizeObserver(() => render(performance.now()));
  if (canvas.value) ro.observe(canvas.value);
  ensureLoop();
});

watch(
  () => [props.history, props.live],
  () => {
    render(performance.now());
    if (props.live) ensureLoop();
  }
);

watch(hover, () => render(performance.now()));

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ticking = false;
  if (ro) ro.disconnect();
});
</script>

<style scoped>
.speed-chart { position: relative; width: 100%; height: 100%; }
.speed-chart canvas { width: 100%; height: 100%; display: block; }
.empty-muted {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3); font-size: 12.5px; letter-spacing: 0.3px;
}
.idle-hint {
  position: absolute; left: 14px; bottom: 8px;
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; color: var(--text-3); letter-spacing: 0.3px;
  opacity: 0.9; pointer-events: none;
}
.idle-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--success); box-shadow: 0 0 8px var(--success);
  animation: idle-pulse 1.6s ease-in-out infinite;
}
@keyframes idle-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* 悬停详情浮层 */
.chart-tip {
  position: absolute;
  z-index: 5;
  min-width: 120px;
  padding: 8px 11px;
  border-radius: 10px;
  background: rgba(15, 23, 40, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  backdrop-filter: blur(8px);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: tip-in 0.14s ease-out;
}
.tip-time {
  font-size: 10px;
  color: #94a3b8;
  letter-spacing: 0.4px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}
.tip-row { display: flex; align-items: center; gap: 7px; }
.tip-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.tip-cap { font-size: 11px; color: #94a3b8; font-weight: 600; }
.tip-val { margin-left: auto; font-size: 12px; font-weight: 700; color: #e2e8f0; font-variant-numeric: tabular-nums; }
@keyframes tip-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
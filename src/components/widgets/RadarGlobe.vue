<template>
  <div class="radar" :class="stateClass" :style="cssSize">
    <!-- 星尘背景 -->
    <div class="dust">
      <i v-for="(s, i) in stars" :key="'s' + i" class="dust-i" :style="starStyle(s)"></i>
    </div>

    <!-- 外层呼吸光晕 -->
    <div class="rg-glow"></div>

    <!-- 外圈刻度环（缓慢旋转） -->
    <div class="tick-ring"></div>

    <!-- 同心测距环 -->
    <div class="ring r1"></div>
    <div class="ring r2"></div>
    <div class="ring r3"></div>

    <!-- 径向辐条 -->
    <div class="spokes"></div>

    <!-- 十字准线 -->
    <div class="cross cross-h"></div>
    <div class="cross cross-v"></div>

    <!-- 雷达扫描（主青 + 副紫反向 + 明亮前缘） -->
    <div class="sweep-track">
      <div class="sweep-main"></div>
      <div class="sweep-edge"></div>
      <div class="sweep-sub"></div>
    </div>

    <!-- 雷达回波点（固定位置，扫描掠过时闪光） -->
    <div class="blips">
      <span
        v-for="(b, i) in blips"
        :key="'b' + i"
        class="blip"
        :class="'b' + (i % 3)"
        :style="blipStyle(b)"
      ></span>
    </div>

    <!-- 旋转轨道弧 -->
    <div class="orbit orbit-a"></div>
    <div class="orbit orbit-b"></div>
    <div class="orbit orbit-c"></div>

    <!-- 环绕卫星（带彗星尾迹） -->
    <div class="sat-track t1"><i class="sat"></i></div>
    <div class="sat-track t2"><i class="sat"></i></div>
    <div class="sat-track t3"><i class="sat"></i></div>
    <div class="sat-track t4"><i class="sat"></i></div>

    <!-- 中心能量核心 -->
    <div class="core-wrap">
      <div class="core-rings"></div>
      <div class="core-halo"></div>
      <div class="core"></div>
      <div class="core-dot"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  connected: { type: Boolean, default: false },
  connecting: { type: Boolean, default: false },
  size: { type: Number, default: 300 }
});

const stateClass = computed(() => (props.connected ? 'connected' : props.connecting ? 'connecting' : 'off'));
const cssSize = computed(() => ({ width: props.size + 'px', height: props.size + 'px' }));

// 星尘：随机位置 / 大小 / 闪烁节奏
const stars = Array.from({ length: 44 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  s: 0.8 + Math.random() * 1.6,
  delay: Math.random() * 5,
  dur: 1.8 + Math.random() * 3.4,
  o: 0.25 + Math.random() * 0.6
}));
const starStyle = (s) => ({
  left: s.x + '%',
  top: s.y + '%',
  width: s.s + 'px',
  height: s.s + 'px',
  opacity: s.o,
  animationDelay: s.delay + 's',
  animationDuration: s.dur + 's'
});

// 回波点：随机极坐标位置，带独立回声节奏
const blips = Array.from({ length: 14 }, (_, i) => {
  const r = 20 + Math.random() * 56; // 20% ~ 76% 半径
  const a = (i * 97 + Math.random() * 40) % 360; // 尽量分散角度
  const rad = (a * Math.PI) / 180;
  const x = 50 + Math.cos(rad) * r;
  const y = 50 + Math.sin(rad) * r;
  return {
    x,
    y,
    size: 2.4 + Math.random() * 3,
    delay: Math.random() * 8,
    dur: 1.6 + Math.random() * 3,
    ringDelay: Math.random() * 9
  };
});
const blipStyle = (b) => ({
  left: b.x + '%',
  top: b.y + '%',
  width: b.size + 'px',
  height: b.size + 'px',
  animationDelay: b.delay + 's',
  animationDuration: b.dur + 's',
  '--ring-delay': b.ringDelay + 's'
});
</script>

<style scoped>
.radar {
  position: relative;
  border-radius: 50%;
  flex: none;
  /* 状态主题变量 */
  --c1: #22d3ee;
  --c2: #a855f7;
  --c3: #6366f1;
  --ring: rgba(34, 211, 238, 0.22);
  --cross: rgba(34, 211, 238, 0.12);
  --glow: rgba(34, 211, 238, 0.16);
  --speed: 5s;
  transition: filter 0.6s;
}
.radar.connected { --c1: #22d3ee; --c2: #a855f7; --c3: #6366f1; --ring: rgba(34,211,238,.3); --cross: rgba(34,211,238,.15); --glow: rgba(34,211,238,.24); --speed: 3s; }
.radar.connecting { --c1: #fbbf24; --c2: #fb923c; --c3: #f43f5e; --ring: rgba(251,191,36,.34); --cross: rgba(251,191,36,.18); --glow: rgba(251,191,36,.28); --speed: 1s; }
.radar.off { --c1: #64748b; --c2: #475569; --c3: #334155; --ring: rgba(100,116,139,.24); --cross: rgba(100,116,139,.12); --glow: rgba(100,116,139,.14); --speed: 8s; }

/* 星尘 */
.dust { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none; }
.dust-i {
  position: absolute; border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 6px rgba(255,255,255,.8);
  animation: twinkle ease-in-out infinite;
}
@keyframes twinkle { 0%,100% { opacity: 0.15; transform: scale(.6); } 50% { opacity: 0.95; transform: scale(1); } }

/* 外层呼吸光晕 */
.rg-glow {
  position: absolute; inset: -26px; border-radius: 50%; pointer-events: none;
  background:
    radial-gradient(circle at 50% 50%, var(--glow), transparent 64%),
    conic-gradient(from 0deg, transparent 0%, var(--glow) 12%, transparent 26%, var(--glow) 40%, transparent 58%, var(--glow) 74%, transparent 88%, transparent 100%);
  filter: blur(7px);
  animation: glow-breathe 4.6s ease-in-out infinite;
}

/* 外圈刻度环 */
.tick-ring {
  position: absolute; inset: -9px; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, var(--ring) 0deg 1.5deg, transparent 1.5deg 6deg);
  -webkit-mask: radial-gradient(circle, transparent 62%, #000 63% 66%, transparent 67%);
  mask: radial-gradient(circle, transparent 62%, #000 63% 66%, transparent 67%);
  animation: spin 60s linear infinite;
  opacity: 0.8;
}

/* 同心环 */
.ring { position: absolute; border-radius: 50%; border: 1px solid var(--ring); pointer-events: none; }
.r1 { inset: 12%; animation: ring-pulse 3.8s ease-in-out infinite; }
.r2 { inset: 30%; animation: ring-pulse 3.8s ease-in-out .5s infinite; }
.r3 { inset: 48%; animation: ring-pulse 3.8s ease-in-out 1s infinite; }
.r3 { border-style: dashed; }

/* 径向辐条 */
.spokes {
  position: absolute; inset: 4%; border-radius: 50%; pointer-events: none; opacity: .5;
  background: repeating-conic-gradient(from 0deg, var(--cross) 0deg .4deg, transparent .4deg 12deg);
  -webkit-mask: radial-gradient(circle, #000 0%, #000 98%, transparent 99%);
  mask: radial-gradient(circle, #000 0%, #000 98%, transparent 99%);
  animation: spin 90s linear infinite reverse;
}

/* 十字准线 */
.cross { position: absolute; background: var(--cross); pointer-events: none; }
.cross-h { left: 4%; right: 4%; top: 50%; height: 1px; }
.cross-v { top: 4%; bottom: 4%; left: 50%; width: 1px; }

/* 雷达扫描锥 */
.sweep-track { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; animation: spin var(--speed) linear infinite; }
.sweep-main, .sweep-sub, .sweep-edge { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; mix-blend-mode: screen; }
.sweep-main {
  background: conic-gradient(from 0deg, var(--c1), rgba(34,211,238,.16) 60deg, rgba(34,211,238,.05) 110deg, transparent 150deg);
}
.sweep-edge {
  background: conic-gradient(from 0deg, #fff 0deg, var(--c1) 4deg, transparent 10deg);
  opacity: .95;
  filter: blur(.5px);
}
.sweep-sub {
  background: conic-gradient(from 180deg, var(--c2), rgba(168,85,247,.14) 52deg, transparent 115deg);
  animation: spin calc(var(--speed) * 1.5) linear infinite reverse;
  opacity: .8;
}

/* 雷达回波点：中心闪烁 + 扩散回声环 */
.blips { position: absolute; inset: 0; pointer-events: none; }
.blip {
  position: absolute; border-radius: 50%;
  background: var(--c1);
  box-shadow: 0 0 8px var(--c1), 0 0 16px var(--c1);
  animation: blip-blink ease-in-out infinite;
}
.blip::after {
  content: '';
  position: absolute; inset: -8px; border-radius: 50%;
  border: 1px solid var(--c1);
  opacity: 0;
  animation: blip-echo 3.4s ease-out infinite;
  animation-delay: var(--ring-delay);
}
.blip.b1 { background: var(--c2); box-shadow: 0 0 8px var(--c2), 0 0 16px var(--c2); }
.blip.b1::after { border-color: var(--c2); }
.blip.b2 { background: #fff; box-shadow: 0 0 6px #fff, 0 0 12px var(--c1); }
.blip.b2::after { border-color: #e2e8f0; }
@keyframes blip-blink { 0%,100% { opacity: .15; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.25); } }
@keyframes blip-echo { 0% { opacity: .8; transform: scale(.4); } 80% { opacity: 0; transform: scale(2.6); } 100% { opacity: 0; transform: scale(2.6); } }

/* 旋转轨道弧 */
.orbit { position: absolute; border-radius: 50%; pointer-events: none; }
.orbit-a {
  inset: -6px;
  border: 2px solid transparent;
  border-top-color: var(--c1);
  border-right-color: rgba(34,211,238,.3);
  filter: drop-shadow(0 0 6px var(--c1));
  animation: spin 7s linear infinite;
}
.orbit-b {
  inset: -15px;
  border: 1.5px solid transparent;
  border-bottom-color: var(--c2);
  border-left-color: rgba(168,85,247,.3);
  filter: drop-shadow(0 0 6px var(--c2));
  animation: spin 11s linear infinite reverse;
}
.orbit-c {
  inset: 4px;
  border: 1px dashed rgba(99,102,241,.34);
  animation: spin 17s linear infinite reverse;
}

/* 环绕卫星（彗星尾迹） */
.sat-track { position: absolute; inset: 0; pointer-events: none; }
.t1 { animation: spin 6s linear infinite; }
.t2 { animation: spin 9s linear infinite reverse; }
.t3 { animation: spin 13s linear infinite; }
.t4 { animation: spin 17s linear infinite reverse; }
.sat {
  position: absolute; top: -3.5px; left: calc(50% - 3.5px);
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c1);
  box-shadow: 0 0 10px var(--c1), 0 0 20px var(--c1);
}
.sat::after {
  content: '';
  position: absolute; right: 5px; top: 50%; width: 26px; height: 1.6px;
  transform: translateY(-50%);
  background: linear-gradient(to left, var(--c1), transparent);
  border-radius: 2px;
  filter: blur(.4px);
}
.t2 .sat { top: 50%; left: calc(100% - 2px); width: 5.5px; height: 5.5px; background: var(--c2); box-shadow: 0 0 9px var(--c2), 0 0 18px var(--c2); }
.t2 .sat::after { background: linear-gradient(to left, var(--c2), transparent); right: 4px; width: 22px; }
.t3 .sat { top: calc(100% - 2px); left: 16%; width: 4.5px; height: 4.5px; opacity: .9; background: var(--c3); box-shadow: 0 0 8px var(--c3); }
.t3 .sat::after { background: linear-gradient(to left, var(--c3), transparent); right: 3px; width: 18px; }
.t4 .sat { top: -2px; left: 72%; width: 4px; height: 4px; opacity: .7; background: #fff; box-shadow: 0 0 7px #fff; }
.t4 .sat::after { background: linear-gradient(to left, #e2e8f0, transparent); right: 3px; width: 16px; }

/* 中心能量核心 */
.core-wrap { position: absolute; inset: 0; pointer-events: none; }
.core-rings {
  position: absolute; top: 50%; left: 50%; width: 66%; height: 66%;
  transform: translate(-50%, -50%); border-radius: 50%;
  border: 1px solid var(--ring);
  border-top-color: var(--c1);
  animation: spin 3.2s linear infinite;
  opacity: .9;
}
.core-rings::after {
  content: '';
  position: absolute; inset: 12%;
  border-radius: 50%;
  border: 1px dashed var(--ring);
  border-bottom-color: var(--c2);
  animation: spin 2.2s linear infinite reverse;
}
.core-halo {
  position: absolute; top: 50%; left: 50%; width: 46%; height: 46%;
  transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(circle, var(--c1), transparent 70%);
  filter: blur(5px);
  animation: core-pulse 2.8s ease-in-out infinite;
}
.core {
  position: absolute; top: 50%; left: 50%; width: 34%; height: 34%;
  transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, rgba(255,255,255,.98), var(--c1) 34%, color-mix(in srgb, var(--c1) 55%, #0b1120) 72%);
  box-shadow: 0 0 30px var(--c1), 0 0 70px var(--c1);
  animation: core-breathe 3s ease-in-out infinite;
}
.core-dot {
  position: absolute; top: 50%; left: 50%; width: 12%; height: 12%;
  transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(circle, #fff, rgba(255,255,255,.08) 72%);
  animation: dot-flicker 2.2s ease-in-out infinite;
}

/* 连接中：中心迸发粒子 */
.radar.connecting .core-halo {
  background: radial-gradient(circle, #fff 0%, var(--c1) 24%, transparent 68%);
  animation: core-pulse .9s ease-in-out infinite;
}
.radar.connecting .core { animation: core-breathe .8s ease-in-out infinite; }
.radar.connecting .ring { border-color: rgba(251,191,36,.5); }
.radar.connecting .blip { animation-duration: .6s; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes glow-breathe { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes ring-pulse {
  0% { opacity: .9; transform: scale(1); }
  60% { opacity: .22; }
  100% { opacity: .9; transform: scale(1.04); }
}
@keyframes core-pulse { 0%,100% { opacity: .95; } 50% { opacity: .45; } }
@keyframes core-breathe {
  0%,100% { transform: translate(-50%,-50%) scale(1); filter: brightness(1); }
  50% { transform: translate(-50%,-50%) scale(1.07); filter: brightness(1.3); }
}
@keyframes dot-flicker { 0%,100% { opacity: 1; } 45% { opacity: .45; } 55% { opacity: .9; } }
</style>

<style>
/* 浅色主题 · 雷达配色与混合模式覆盖 */
:root[data-theme='light'] .radar {
  --c1: #c8102e; --c2: #c9a227; --c3: #8a5a2b;
  --ring: rgba(200, 16, 46, 0.34); --cross: rgba(200, 16, 46, 0.16); --glow: rgba(200, 16, 46, 0.2);
}
:root[data-theme='light'] .radar.connected {
  --c1: #c8102e; --c2: #c9a227; --c3: #8a5a2b;
  --ring: rgba(200, 16, 46, 0.4); --cross: rgba(200, 16, 46, 0.2); --glow: rgba(200, 16, 46, 0.26);
}
:root[data-theme='light'] .radar.connecting {
  --c1: #c9a227; --c2: #b8860b; --c3: #b0641e;
  --ring: rgba(201, 162, 39, 0.44); --cross: rgba(201, 162, 39, 0.22); --glow: rgba(201, 162, 39, 0.3);
}
:root[data-theme='light'] .radar.off {
  --c1: #9a948a; --c2: #8c8578; --c3: #6f685c;
  --ring: rgba(138, 130, 118, 0.34); --cross: rgba(138, 130, 118, 0.18); --glow: rgba(138, 130, 118, 0.16);
}
:root[data-theme='light'] .sweep-main,
:root[data-theme='light'] .sweep-sub,
:root[data-theme='light'] .sweep-edge { mix-blend-mode: normal; }
:root[data-theme='light'] .dust-i { background: #4a3f2f; box-shadow: 0 0 6px rgba(60, 45, 20, 0.55); }
:root[data-theme='light'] .blip.b2 { background: var(--c1); box-shadow: 0 0 6px var(--c1), 0 0 12px var(--c1); }
:root[data-theme='light'] .blip.b2::after { border-color: var(--c1); }
:root[data-theme='light'] .t4 .sat { background: var(--c1); box-shadow: 0 0 7px var(--c1); }
:root[data-theme='light'] .t4 .sat::after { background: linear-gradient(to left, var(--c1), transparent); }
:root[data-theme='light'] .core {
  background: radial-gradient(circle at 38% 32%, rgba(255, 255, 255, 0.98), var(--c1) 34%, color-mix(in srgb, var(--c1) 55%, #3a0d14) 72%);
}
</style>

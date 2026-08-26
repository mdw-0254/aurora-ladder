<template>
  <div class="logs">
    <div class="page-head">
      <div>
        <div class="section-title">日志 <span class="st-en">Console</span></div>
        <div class="section-sub">核心运行日志 · 实时输出</div>
      </div>
      <div class="log-actions">
        <button class="btn btn-sm" @click="togglePause">
          <svg v-if="paused" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5l11 7-11 7V5z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
          {{ paused ? '继续' : '暂停' }}
        </button>
        <button class="btn btn-sm btn-danger" @click="clearLogs">清空</button>
      </div>
    </div>

    <div class="panel log-panel">
      <div class="log-filters">
        <button v-for="lvl in levels" :key="lvl.id" class="chip" :class="{ on: level === lvl.id }" @click="level = lvl.id">
          {{ lvl.label }}
          <span class="count mono">{{ counts[lvl.id] }}</span>
        </button>
      </div>
      <div ref="scrollEl" class="log-body">
        <div v-for="l in visibleLogs" :key="l.id" class="log-line" :class="'lv-' + l.level">
          <span class="log-time mono">{{ l.time }}</span>
          <span class="log-lv mono">{{ lvlTag(l.level) }}</span>
          <span class="log-msg">{{ l.message }}</span>
        </div>
        <div v-if="!visibleLogs.length" class="log-empty muted">暂无日志</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { store } from '../store';

const level = ref('all');
const paused = ref(false);
const scrollEl = ref(null);

const levels = [
  { id: 'all', label: '全部' },
  { id: 'info', label: '信息' },
  { id: 'warn', label: '警告' },
  { id: 'error', label: '错误' },
  { id: 'debug', label: '调试' }
];

const counts = computed(() => {
  const c = { all: store.logs.length, info: 0, warn: 0, error: 0, debug: 0 };
  for (const l of store.logs) if (c[l.level] != null) c[l.level]++;
  return c;
});

const visibleLogs = computed(() => {
  if (level.value === 'all') return store.logs;
  return store.logs.filter((l) => l.level === level.value);
});

function lvlTag(l) {
  return { info: 'INFO', warn: 'WARN', error: 'ERRO', debug: 'DBUG' }[l] || l;
}

function togglePause() {
  paused.value = !paused.value;
}

function clearLogs() {
  store.logs = [];
}

function scrollToBottom() {
  if (!paused.value && scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

watch(() => store.logs.length, async () => {
  await nextTick();
  scrollToBottom();
});
</script>

<style scoped>
.logs { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.log-actions { display: flex; gap: 8px; }

.log-panel { display: flex; flex-direction: column; overflow: hidden; min-height: 420px; }
.log-filters { display: flex; gap: 6px; padding: 12px 16px; border-bottom: 1px solid var(--panel-border); flex-wrap: wrap; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 999px; border: 1px solid var(--panel-border);
  background: var(--panel); color: var(--text-2); font-size: 12px; cursor: pointer;
  font-family: inherit; font-weight: 600; transition: all 0.18s;
}
.chip:hover { color: var(--text-1); }
.chip.on { color: #fff; background: var(--accent-grad); border-color: transparent; }
.count { font-size: 10.5px; opacity: 0.8; }

.log-body { flex: 1; padding: 10px 0; overflow-y: auto; font-family: 'Cascadia Code', Consolas, 'Courier New', monospace; font-size: 12.3px; min-height: 380px; }
.log-line { display: flex; gap: 12px; padding: 3.5px 18px; line-height: 1.55; transition: background 0.12s; }
.log-line:hover { background: var(--panel); }
.log-time { color: var(--text-3); flex: none; }
.log-lv { flex: none; width: 46px; font-weight: 700; }
.lv-info .log-lv { color: var(--success); }
.lv-warn .log-lv { color: var(--warn); }
.lv-error .log-lv { color: var(--danger); }
.lv-debug .log-lv { color: var(--text-3); }
.log-msg { color: var(--text-2); word-break: break-all; }
.lv-error .log-msg { color: var(--danger); }
.lv-warn .log-msg { color: var(--warn); }
.log-empty { padding: 60px; text-align: center; }
</style>

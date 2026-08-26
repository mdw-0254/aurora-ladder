<template>
  <div class="connections">
    <div class="page-head">
      <div>
        <div class="section-title">连接 <span class="st-en">Sessions</span></div>
        <div class="section-sub">当前活跃的会话连接</div>
      </div>
      <div class="filters">
        <button class="chip" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button class="chip" :class="{ on: filter === 'active' }" @click="filter = 'active'">活跃</button>
      </div>
    </div>

    <div class="panel conn-table">
      <div class="ct-head">
        <span class="col app">应用</span>
        <span class="col host">目标主机</span>
        <span class="col up">上传</span>
        <span class="col down">下载</span>
        <span class="col total">总量</span>
        <span class="col dur">时长</span>
      </div>
      <div v-if="!conns.length" class="ct-empty">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" style="margin-bottom:8px;opacity:.5"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M10 18h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <div class="muted">暂无活跃连接 · 连接节点后将在此显示会话</div>
      </div>
      <div v-else>
        <div v-for="c in conns" :key="c.id" class="ct-row">
          <span class="col app">
            <span class="avatar" :style="{ '--ac': c.color }">{{ c.tag }}</span>
            <span class="app-name">{{ c.app }}</span>
          </span>
          <span class="col host mono">{{ c.host }}</span>
          <span class="col up up-color mono">{{ fmtSpeed(c.up) }}</span>
          <span class="col down down-color mono">{{ fmtSpeed(c.down) }}</span>
          <span class="col total mono">{{ fmtBytes(c.total) }}</span>
          <span class="col dur mono">{{ fmtDuration((Date.now() - c.startedAt) / 1000) }}</span>
        </div>
      </div>
    </div>

    <div class="conn-foot">
      <span class="muted">共 {{ conns.length }} 个会话 · 数据为本地代理实时转发的真实流量</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { store } from '../store';
import { formatBytes, formatSpeed, formatDuration } from '../utils/format';

const filter = ref('all');

const conns = computed(() => {
  let list = store.connections;
  if (filter.value === 'active') list = list.filter((c) => c.down > 2);
  return list;
});

function fmtBytes(b) { return formatBytes(b); }
function fmtSpeed(v) { return formatSpeed(v); }
function fmtDuration(s) { return formatDuration(s); }

</script>

<style scoped>
.connections { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; }
.filters { display: flex; gap: 6px; }
.chip {
  padding: 6px 14px; border-radius: 999px; border: 1px solid var(--panel-border);
  background: var(--panel); color: var(--text-2); font-size: 12.5px; cursor: pointer;
  font-family: inherit; font-weight: 600; transition: all 0.18s;
}
.chip:hover { color: var(--text-1); }
.chip.on { color: #fff; background: var(--accent-grad); border-color: transparent; }

.conn-table { overflow: hidden; }
.ct-head, .ct-row {
  display: grid;
  grid-template-columns: 1.2fr 2fr 0.9fr 0.9fr 0.9fr 0.7fr;
  gap: 12px; align-items: center;
  padding: 12px 18px;
}
.ct-head { background: var(--panel); border-bottom: 1px solid var(--panel-border); font-size: 11.5px; color: var(--text-3); font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.ct-row { border-bottom: 1px solid var(--panel-border); transition: background 0.15s; }
.ct-row:last-child { border-bottom: none; }
.ct-row:hover { background: var(--panel); }
.col { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col.app { display: flex; align-items: center; gap: 10px; }
.app-name { font-weight: 600; font-size: 13px; }
.host { font-size: 12.5px; color: var(--text-2); }
.up-color { color: var(--accent-2); }
.down-color { color: var(--accent-1); }
.total { color: var(--text-2); }
.dur { color: var(--text-3); }
.ct-empty { padding: 46px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.conn-foot { text-align: right; font-size: 12px; }
</style>

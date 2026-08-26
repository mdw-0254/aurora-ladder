<template>
  <div class="settings">
    <div class="page-head">
      <div>
        <div class="section-title">设置 <span class="st-en">Preferences</span></div>
        <div class="section-sub">应用偏好与网络配置</div>
      </div>
    </div>

    <!-- 通用 -->
    <div class="panel card">
      <div class="card-title">通用</div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">本地端口</div>
          <div class="row-desc">本地代理服务器监听端口（需重启代理生效）</div>
        </div>
        <input class="input mono port-input" v-model="portText" @blur="savePort" @keydown.enter="savePort" />
      </div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">代理模式</div>
          <div class="row-desc">规则模式按分流规则；全局模式所有流量走代理</div>
        </div>
        <select class="select" :value="store.settings.proxyMode" @change="changeMode">
          <option value="rule">规则模式</option>
          <option value="global">全局模式</option>
          <option value="direct">直连模式</option>
        </select>
      </div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">系统代理</div>
          <div class="row-desc">将系统 HTTP/HTTPS 代理指向本地端口</div>
        </div>
        <ToggleSwitch :model-value="!!store.settings.systemProxy" @update:model-value="(v) => set('systemProxy', v)" />
      </div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">开机启动</div>
          <div class="row-desc">登录 Windows 后自动启动本应用</div>
        </div>
        <ToggleSwitch :model-value="!!store.settings.launchOnBoot" @update:model-value="(v) => set('launchOnBoot', v)" />
      </div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">关闭时最小化到托盘</div>
          <div class="row-desc">点击关闭按钮时隐藏到系统托盘而非退出</div>
        </div>
        <ToggleSwitch :model-value="!!store.settings.closeToTray" @update:model-value="(v) => set('closeToTray', v)" />
      </div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">启动后自动连接</div>
          <div class="row-desc">应用启动后自动连接上次使用的节点</div>
        </div>
        <ToggleSwitch :model-value="!!store.settings.autoConnect" @update:model-value="(v) => set('autoConnect', v)" />
      </div>
    </div>

    <!-- 外观 -->
    <div class="panel card">
      <div class="card-title">外观</div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">主题</div>
          <div class="row-desc">切换应用的配色方案</div>
        </div>
        <div class="theme-group">
          <button v-for="t in themes" :key="t.id" class="theme-btn" :class="{ on: store.settings.theme === t.id }" @click="set('theme', t.id)">
            <span class="theme-swatch" :class="t.id"></span>
            {{ t.label }}
          </button>
        </div>
      </div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">界面语言</div>
          <div class="row-desc">界面显示语言</div>
        </div>
        <select class="select" :value="store.settings.language" @change="changeLang">
          <option value="zh">简体中文</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>

    <!-- 高级 -->
    <div class="panel card">
      <div class="card-title">高级</div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">日志级别</div>
          <div class="row-desc">控制日志输出的详细程度</div>
        </div>
        <select class="select" :value="store.settings.logLevel" @change="changeLogLevel">
          <option value="debug">调试</option>
          <option value="info">信息</option>
          <option value="warn">警告</option>
          <option value="error">错误</option>
        </select>
      </div>
      <div class="row-line">
        <div class="row-info">
          <div class="row-name">延迟测试地址</div>
          <div class="row-desc">用于测量节点延迟的探测地址</div>
        </div>
        <input class="input mono url-input" v-model="testUrl" @blur="saveUrl" @keydown.enter="saveUrl" />
      </div>
      <div class="row-line last">
        <div class="row-info">
          <div class="row-name">恢复默认设置</div>
          <div class="row-desc">将所有配置恢复为初始值</div>
        </div>
        <button class="btn btn-danger btn-sm" @click="resetSettings">恢复默认</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { store, setSetting } from '../store';
import ToggleSwitch from '../components/widgets/ToggleSwitch.vue';
import { toast } from '../utils/toast';

const portText = ref(String(store.settings.port ?? 7891));
const testUrl = ref(store.settings.testingUrl ?? 'https://www.gstatic.com/generate_204');

const themes = [
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' }
];

async function set(key, value) {
  await setSetting(key, value);
  toast('设置已保存', 'success');
}

function savePort() {
  const n = parseInt(portText.value, 10);
  if (isNaN(n) || n < 1 || n > 65535) {
    portText.value = String(store.settings.port);
    toast('端口无效，请输入 1-65535', 'error');
    return;
  }
  if (n !== store.settings.port) {
    setSetting('port', n);
    toast('端口已更新，重连后生效', 'info');
  }
}

function saveUrl() {
  setSetting('testingUrl', testUrl.value);
  toast('测试地址已保存', 'success');
}

function changeMode(e) {
  set('proxyMode', e.target.value);
}

function changeLang(e) {
  set('language', e.target.value);
}

function changeLogLevel(e) {
  set('logLevel', e.target.value);
}

function resetSettings() {
  const keys = ['port', 'systemProxy', 'launchOnBoot', 'closeToTray', 'theme', 'language', 'logLevel', 'autoConnect', 'proxyMode', 'testingUrl'];
  Promise.all(keys.map((k) => setSetting(k, { port: 7891, systemProxy: false, launchOnBoot: false, closeToTray: true, theme: 'dark', language: 'zh', logLevel: 'info', autoConnect: false, proxyMode: 'rule', testingUrl: 'https://www.gstatic.com/generate_204' }[k])));
  toast('已恢复默认设置', 'success');
}
</script>

<style scoped>
.settings { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.page-head { margin-bottom: 2px; }
.card { padding: 6px 22px 4px; }
.card-title { font-size: 13px; font-weight: 800; letter-spacing: 1px; color: var(--text-2); text-transform: uppercase; padding: 16px 0 4px; }
.row-line {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  padding: 15px 0; border-bottom: 1px solid var(--panel-border);
}
.row-line.last { border-bottom: none; }
.row-info { min-width: 0; }
.row-name { font-size: 14px; font-weight: 600; }
.row-desc { font-size: 12px; color: var(--text-3); margin-top: 3px; }
.port-input { width: 110px; text-align: center; }
.url-input { width: 300px; }
.theme-group { display: flex; gap: 8px; }
.theme-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 13px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--panel-border); background: var(--panel);
  color: var(--text-2); font-family: inherit; font-size: 12.5px; font-weight: 600;
  transition: all 0.18s;
}
.theme-btn:hover { color: var(--text-1); }
.theme-btn.on { border-color: var(--accent-1); color: var(--text-1); background: var(--accent-grad-soft); }
.theme-swatch { width: 16px; height: 16px; border-radius: 50%; }
.theme-swatch.dark { background: linear-gradient(135deg, #0a0e17, #1e293b); border: 1px solid rgba(255,255,255,0.3); }
.theme-swatch.light { background: linear-gradient(135deg, #f5f2ec, #c8102e); border: 1px solid rgba(200, 16, 46, 0.3); }
</style>

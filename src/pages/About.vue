<template>
  <div class="about">
    <div class="panel about-card">
      <div class="about-logo-wrap">
        <img class="about-logo" :src="iconUrl" alt="Aurora" />
        <div class="about-glow"></div>
      </div>
      <div class="about-name">Aurora</div>
      <div class="about-version mono">v{{ store.version }} · {{ store.platform.platform }} {{ store.platform.arch }}</div>
      <button class="btn btn-ghost btn-sm about-update-btn" @click="checkForUpdates" :disabled="checking">
        <svg viewBox="0 0 24 24" width="14" height="14" :class="{ 'spin': checking }" fill="none"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        {{ checking ? '检查更新中…' : '检查更新' }}
      </button>
      <div class="about-desc">
        简约而精致的代理客户端 · 基于 Electron + Vue3 构建<br />
        纯 Node.js 代理内核 · 支持多协议订阅导入与全局安全代理
      </div>

      <div class="about-stats">
        <div class="a-stat">
          <div class="a-num">{{ store.servers.length }}</div>
          <div class="a-cap">节点</div>
        </div>
        <div class="a-stat">
          <div class="a-num mono">{{ store.state.port }}</div>
          <div class="a-cap">默认端口</div>
        </div>
        <div class="a-stat">
          <div class="a-num">2</div>
          <div class="a-cap">主题</div>
        </div>
        <div class="a-stat">
          <div class="a-num mono">ES6+</div>
          <div class="a-cap">技术栈</div>
        </div>
      </div>

      <div class="about-tags">
        <span class="tag" v-for="t in tags" :key="t">{{ t }}</span>
      </div>

      <div class="about-links">
        <button class="btn btn-ghost btn-sm" @click="openLink(repoUrl)">项目主页</button>
        <button class="btn btn-ghost btn-sm" @click="openLink('https://www.electronjs.org')">Electron</button>
        <button class="btn btn-ghost btn-sm" @click="openLink('https://cn.vuejs.org')">Vue3</button>
      </div>

      <div class="about-divider"></div>

      <!-- 作者名片 -->
      <div class="about-author">
        <div class="author-avatar">歌</div>
        <div class="author-meta">
          <div class="author-name">作者 · 歌者超</div>
          <div class="author-sub">独立开发，用爱发电，感谢每一位支持者</div>
        </div>
      </div>

      <div class="author-contact">
        <span class="contact-label">微信</span>
        <code class="contact-value mono">1016168805</code>
        <button class="btn btn-ghost btn-sm" @click="copyVx">复制</button>
      </div>

      <!-- 打赏 -->
      <div class="about-donate">
        <div class="donate-head">
          <div>
            <div class="donate-title">支持作者</div>
            <div class="donate-sub">如果这个工具对你有帮助，可以请我喝杯咖啡</div>
          </div>
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" class="donate-heart"><path d="M12 21C7 16.5 3 13.2 3 9.3 3 6.4 5.2 4.2 8 4.2c1.7 0 3.3.9 4 2.3.7-1.4 2.3-2.3 4-2.3 2.8 0 5 2.2 5 5.1 0 3.9-4 7.2-9 11.7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </div>
        <img class="donate-qr" :src="donateQr" alt="微信打赏码" title="点击放大" @click="showQr = true" />
        <div class="donate-tip">微信扫一扫 · 点击二维码可放大</div>
      </div>

      <div class="about-foot faint">© 2026 歌者超 · 保留所有权利</div>

      <!-- 免责声明 -->
      <div class="about-disclaimer">
        <div class="disc-head">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 3l9 16H3l9-16zm0 6v4m0 3h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>免责声明 Disclaimer</span>
        </div>
        <p>本软件仅供网络技术学习、交流与研究使用，请勿将其用于任何违反中华人民共和国及相关国家或地区法律法规的用途。</p>
        <p>使用本软件连接或访问任何网络内容，均属用户个人行为，用户应自行判断其合法性并承担相应责任。本软件不提供任何节点、订阅或内容服务，亦不对用户通过本软件访问的内容负责。</p>
        <p>请遵守当地法律法规，尊重知识产权与网络生态。因用户违规使用本软件所产生的任何后果，作者概不承担任何责任。</p>
      </div>
    </div>

    <!-- 二维码放大层 -->
    <Teleport to="body">
      <Transition name="qr">
        <div v-if="showQr" class="qr-overlay" @click.self="showQr = false">
          <div class="qr-modal">
            <img class="qr-img" :src="donateQr" alt="微信打赏码" />
            <div class="qr-cap">微信扫一扫，打赏支持作者</div>
            <button class="qr-close" title="关闭" @click="showQr = false">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '../store';
import { toast } from '../utils/toast';
import iconUrl from '../assets/icon.png';
import donateQr from '../assets/donate-qr.jpg';

// 发布到 GitHub 后，把这里替换成你的仓库地址
const repoUrl = 'https://github.com/mdw-0254/aurora-ladder';
const author = {
  name: '歌者超',
  vx: '1016168805'
};

const tags = ['Electron', 'Vue 3', 'Vite', '原生代理', '双主题'];
const showQr = ref(false);
const checking = ref(false);

async function checkForUpdates() {
  if (checking.value) return;
  checking.value = true;
  try {
    const r = await window.aurora.checkUpdate();
    if (r && r.error) {
      toast('检查更新失败：' + r.error, 'error');
    } else if (r && r.hasUpdate) {
      toast(`发现新版本 v${r.latest}（当前 v${r.current}）`, 'info', 4000);
      if (confirm(`发现新版本 v${r.latest}\n当前版本 v${r.current}\n\n是否立即下载并自动更新？\n（下载完成后应用会自动重启）`)) {
        const u = await window.aurora.updateApp(r.downloadUrl);
        if (u && u.error) toast('更新失败：' + u.error, 'error');
        else if (u && u.manual) toast('已打开下载页，请手动下载安装', 'info', 4000);
      }
    } else {
      toast('当前已是最新版本', 'success');
    }
  } catch (e) {
    toast('检查更新失败：' + (e && e.message || e), 'error');
  } finally {
    checking.value = false;
  }
}

function openLink(url) {
  window.aurora.openExternal(url);
}

async function copyVx() {
  try {
    await navigator.clipboard.writeText(author.vx);
    toast('微信号已复制：' + author.vx, 'success');
  } catch (e) {
    toast('复制失败，请手动记录：' + author.vx, 'error');
  }
}
</script>

<style scoped>
.about { max-width: 760px; margin: 0 auto; padding-top: 12px; }
.about-card {
  padding: 44px 40px 32px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  overflow: hidden;
}
.about-card::before {
  content: '';
  position: absolute;
  top: 0; left: 60px; right: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6), rgba(139, 92, 246, 0.6), transparent);
}
.about-logo-wrap { position: relative; width: 108px; height: 108px; margin-bottom: 18px; }
.about-logo { width: 100%; height: 100%; border-radius: 26px; object-fit: cover; box-shadow: var(--shadow-2); position: relative; z-index: 1; }
.about-glow {
  position: absolute; inset: -14px; border-radius: 40px; z-index: 0;
  background: radial-gradient(circle, rgba(108, 92, 246, 0.35), transparent 65%);
  filter: blur(6px); animation: pulse-dot 3.4s ease-in-out infinite;
}
.about-name { font-size: 27px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 5px; }
.about-version { font-size: 12.5px; color: var(--text-3); margin-bottom: 10px; }
.about-update-btn { margin-bottom: 14px; gap: 6px; }
.about-update-btn:disabled { opacity: 0.55; cursor: default; }
.about-update-btn .spin { animation: qr-spin 1s linear infinite; }
@keyframes qr-spin { to { transform: rotate(360deg); } }
.about-desc { font-size: 13px; color: var(--text-2); line-height: 1.8; margin-bottom: 24px; }

.about-stats { display: flex; gap: 0; width: 100%; border: 1px solid var(--panel-border); border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
.a-stat { flex: 1; padding: 16px 8px; border-right: 1px solid var(--panel-border); transition: background 0.18s; }
.a-stat:last-child { border-right: none; }
.a-stat:hover { background: var(--panel); }
.a-num { font-size: 19px; font-weight: 700; letter-spacing: -0.2px; }
.a-cap { font-size: 11px; color: var(--text-3); margin-top: 3px; }

.about-tags { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 22px; }
.tag { padding: 4px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: var(--accent-1); background: rgba(34, 211, 238, 0.08); border: 1px solid rgba(34, 211, 238, 0.2); }

.about-links { display: flex; gap: 8px; margin-bottom: 20px; }

.about-divider {
  width: 100%; height: 1px;
  background: linear-gradient(90deg, transparent, var(--panel-border-2), transparent);
  margin-bottom: 22px;
}

/* 作者名片 */
.about-author { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.author-avatar {
  width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800; color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 6px 18px rgba(108, 92, 246, 0.4);
}
.author-meta { text-align: left; }
.author-name { font-size: 16px; font-weight: 700; margin-bottom: 3px; }
.author-sub { font-size: 12px; color: var(--text-3); }

.author-contact {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 14px;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--panel);
  margin-bottom: 22px;
}
.contact-label { font-size: 12px; color: var(--text-3); }
.contact-value {
  flex: 1; text-align: left;
  font-size: 13px; color: var(--accent-1);
  letter-spacing: 0.5px;
}

/* 打赏 */
.about-donate {
  width: 100%; padding: 20px;
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  background: var(--accent-grad-soft);
  display: flex; flex-direction: column; align-items: center;
  margin-bottom: 22px;
}
.donate-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.donate-head > div { text-align: left; }
.donate-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
.donate-sub { font-size: 11.5px; color: var(--text-2); }
.donate-heart { color: #a78bfa; flex-shrink: 0; filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.5)); }
.donate-qr {
  width: 132px; height: 132px;
  border-radius: 14px;
  object-fit: cover;
  border: 3px solid rgba(148, 163, 184, 0.35);
  box-shadow:
    0 0 0 1px rgba(34, 211, 238, 0.18),
    0 0 26px rgba(139, 92, 246, 0.35),
    var(--shadow-2);
  cursor: zoom-in;
  transition: transform 0.22s;
}
.donate-qr:hover { transform: scale(1.05); }
.donate-tip { font-size: 11px; color: var(--text-2); margin-top: 12px; }

.about-foot { font-size: 11.5px; }

/* 免责声明 */
.about-disclaimer {
  width: 100%;
  margin-top: 20px;
  padding: 16px 18px;
  border: 1px solid var(--panel-border);
  border-left: 3px solid var(--warn);
  border-radius: 12px;
  background: var(--panel);
  text-align: left;
}
.disc-head {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 700; color: var(--warn);
  letter-spacing: 0.4px; margin-bottom: 9px;
}
.about-disclaimer p {
  font-size: 11.5px; line-height: 1.75; color: var(--text-3);
  margin: 0 0 6px;
}
.about-disclaimer p:last-child { margin-bottom: 0; }

/* 二维码放大层 */
.qr-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(3, 6, 12, 0.72);
  backdrop-filter: blur(6px);
}
.qr-modal {
  position: relative;
  padding: 22px;
  border-radius: 18px;
  background: var(--panel-solid);
  border: 1px solid var(--panel-border-2);
  box-shadow: var(--shadow-2);
  display: flex; flex-direction: column; align-items: center;
}
.qr-img { width: 260px; height: 260px; border-radius: 14px; object-fit: cover; border: 3px solid #fff; }
.qr-cap { font-size: 12.5px; color: var(--text-2); margin-top: 14px; }
.qr-close {
  position: absolute; top: -14px; right: -14px;
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-1);
  background: var(--panel-solid);
  border: 1px solid var(--panel-border-2);
  cursor: pointer;
  transition: transform 0.18s;
}
.qr-close:hover { transform: scale(1.1); }
.qr-enter-active, .qr-leave-active { transition: opacity 0.2s; }
.qr-enter-from, .qr-leave-to { opacity: 0; }
</style>

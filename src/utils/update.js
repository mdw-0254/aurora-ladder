import { store } from '../store';
import { toast } from './toast';

// 一键立即更新：下载 → 替换 → 自动重启，全程无弹窗打扰
// 供「右上角常驻气泡」与「关于页气泡」共用
export async function startUpdate() {
  const r = store.updateInfo;
  if (!r || !r.downloadUrl) return;
  const u = await window.aurora.updateApp({ downloadUrl: r.downloadUrl, size: r.size || 0 });
  if (u && u.error) toast('更新失败：' + u.error, 'error');
  else if (u && u.manual) toast('已打开下载页，请手动下载安装', 'info', 4000);
}

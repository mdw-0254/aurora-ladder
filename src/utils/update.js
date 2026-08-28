import { store } from '../store';
import { toast } from './toast';

// 一键立即更新：下载完整新版安装包，完成后界面引导用户手动替换，全程无繁琐弹窗
// 供「右上角常驻气泡」与「关于页气泡」共用
export async function startUpdate() {
  const r = store.updateInfo;
  if (!r || !r.downloadUrl) return;
  const u = await window.aurora.updateApp({ downloadUrl: r.downloadUrl, size: r.size || 0 });
  if (u && u.error) toast('更新失败：' + u.error, 'error');
}

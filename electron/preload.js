const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aurora', {
  // 状态
  getState: () => ipcRenderer.invoke('app:getState'),
  connect: () => ipcRenderer.invoke('app:connect'),
  disconnect: () => ipcRenderer.invoke('app:disconnect'),
  // 服务器
  getServers: () => ipcRenderer.invoke('app:getServers'),
  selectServer: (id) => ipcRenderer.invoke('app:selectServer', id),
  testLatency: () => ipcRenderer.invoke('app:testLatency'),
  // 订阅
  importSubscription: (url) => ipcRenderer.invoke('app:importSubscription', url),
  removeSubscription: (id) => ipcRenderer.invoke('app:removeSubscription', id),
  removeBatch: (batchId) => ipcRenderer.invoke('app:removeBatch', batchId),
  // 连接与日志
  getConnections: () => ipcRenderer.invoke('app:getConnections'),
  getLogs: () => ipcRenderer.invoke('app:getLogs'),
  // 设置
  getSettings: () => ipcRenderer.invoke('app:getSettings'),
  setSetting: (key, value) => ipcRenderer.invoke('app:setSetting', key, value),
  // 天气
  getWeather: (force) => ipcRenderer.invoke('app:getWeather', force),
  // 系统
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  updateApp: (payload) => ipcRenderer.invoke('app:updateApp', payload),
  windowControl: (action) => ipcRenderer.invoke('app:windowControl', action),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  // 强制退出并应用已下载的更新（绕开「关闭到托盘」，真正退出后自动覆盖 exe 并启动新版本）
  quitForUpdate: () => ipcRenderer.invoke('app:quitForUpdate'),
  // 在系统文件管理器中定位/打开某个文件所在文件夹（供更新下载完成后「打开所在文件夹」使用）
  showItemInFolder: (p) => ipcRenderer.invoke('app:showItemInFolder', p),
  // 订阅推送
  onStateUpdate: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('stateUpdate', l); return () => ipcRenderer.removeListener('stateUpdate', l); },
  onLogAppend: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('logAppend', l); return () => ipcRenderer.removeListener('logAppend', l); },
  onConnectionsUpdate: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('connectionsUpdate', l); return () => ipcRenderer.removeListener('connectionsUpdate', l); },
  onUpdateProgress: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('updateProgress', l); return () => ipcRenderer.removeListener('updateProgress', l); },
  onUpdateAvailable: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('updateAvailable', l); return () => ipcRenderer.removeListener('updateAvailable', l); }
});

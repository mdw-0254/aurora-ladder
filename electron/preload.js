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
  windowControl: (action) => ipcRenderer.invoke('app:windowControl', action),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  // 订阅推送
  onStateUpdate: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('stateUpdate', l); return () => ipcRenderer.removeListener('stateUpdate', l); },
  onLogAppend: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('logAppend', l); return () => ipcRenderer.removeListener('logAppend', l); },
  onConnectionsUpdate: (cb) => { const l = (_e, v) => cb(v); ipcRenderer.on('connectionsUpdate', l); return () => ipcRenderer.removeListener('connectionsUpdate', l); }
});

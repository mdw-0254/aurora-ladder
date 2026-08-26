export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2) + ' ' + units[i];
}

export function formatSpeed(kb) {
  if (!kb || kb <= 0) return '0 B/s';
  const bytes = kb * 1024;
  return formatBytes(bytes) + '/s';
}

export function formatDuration(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function pingColor(ping) {
  if (ping <= 60) return 'var(--ping-good)';
  if (ping <= 120) return 'var(--ping-mid)';
  if (ping <= 200) return 'var(--ping-warn)';
  return 'var(--ping-bad)';
}

export function pingLabel(ping) {
  if (ping <= 60) return '极佳';
  if (ping <= 120) return '良好';
  if (ping <= 200) return '一般';
  return '较差';
}

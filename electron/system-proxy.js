// Windows 系统代理设置（HKCU 注册表，无需管理员权限）
const { execFile } = require('child_process');

const KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

function run(args) {
  return new Promise((resolve) => {
    execFile('reg.exe', args, { windowsHide: true }, (err, stdout) => {
      if (err) resolve(false);
      else resolve(true);
    });
  });
}

async function enable(port) {
  const server = `127.0.0.1:${port}`;
  await run(['add', KEY, '/v', 'ProxyEnable', '/t', 'REG_DWORD', '/d', '1', '/f']);
  await run(['add', KEY, '/v', 'ProxyServer', '/t', 'REG_SZ', '/d', server, '/f']);
  await run(['add', KEY, '/v', 'ProxyOverride', '/t', 'REG_SZ', '/d', '<local>', '/f']);
  // 通知系统设置已变更
  await notifyChange();
  return true;
}

async function disable() {
  await run(['add', KEY, '/v', 'ProxyEnable', '/t', 'REG_DWORD', '/d', '0', '/f']);
  await notifyChange();
  return true;
}

// 通知系统 WinINet 代理设置已变更
function notifyChange() {
  const ps = [
    'Add-Type -Namespace Win32 -Name Nat -MemberDefinition \'[DllImport("wininet.dll", SetLastError=true)] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);\'',
    '[Win32.Nat]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)',
    '[Win32.Nat]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)'
  ].join('; ');
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, () => resolve(true));
  });
}

module.exports = { enable, disable };

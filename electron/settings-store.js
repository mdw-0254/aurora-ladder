const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  port: 7891,
  systemProxy: false,
  launchOnBoot: false,
  closeToTray: true,
  theme: 'dark',
  language: 'zh',
  logLevel: 'info',
  autoConnect: false,
  proxyMode: 'rule',
  testingUrl: 'https://www.gstatic.com/generate_204',
  selectedServerId: 'hk01'
};

class SettingsStore {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = { ...DEFAULTS };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.data = { ...DEFAULTS, ...parsed };
      }
    } catch (e) {
      console.error('[settings] load failed:', e.message);
    }
  }

  get(key) {
    return key ? this.data[key] : { ...this.data };
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[settings] save failed:', e.message);
    }
  }
}

module.exports = SettingsStore;

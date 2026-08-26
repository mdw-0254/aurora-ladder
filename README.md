<!-- 发布到 GitHub / Gitee 后，请把顶部「仓库地址」相关的链接替换为你自己的仓库地址 -->

<div align="center">

# AuroraVPN 极光代理客户端

**AuroraVPN · A sleek Windows proxy / VPN client built with Electron + Vue 3 + Vite**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue.svg)
![Electron](https://img.shields.io/badge/Electron-33-47848F.svg)
![Vue](https://img.shields.io/badge/Vue-3-42b883.svg)
![Build](https://img.shields.io/badge/build-Vite%206-646cff.svg)
![Release](https://img.shields.io/badge/release-v1.0.0-green.svg)

</div>

简约而精致的 Windows 代理客户端（VPN Client），基于 Electron + Vue 3 + Vite 构建。支持订阅导入、多节点选择、系统代理、实时流量监控、连接会话管理与双主题切换。代理内核由主进程内的纯 Node.js 正向代理模块实现，零第三方代理内核依赖，单文件绿色便携，开箱即用。

- 技术栈：Electron 33 · Vue 3 · Vite 6 · Node.js
- 平台支持：Windows 10 / 11（x64）
- 发行形态：单文件便携版（无需安装）、NSIS 安装版

> 关键词 / Keywords：Windows 代理客户端 · VPN Client · 订阅导入 Subscription · Shadowsocks (SS) · Clash 订阅解析 · 系统代理 System Proxy · 实时流量监控 Traffic Monitor · Electron · Vue 3 · Vite

## 目录

- [项目介绍](#项目介绍)
- [功能特性](#功能特性)
- [界面预览](#界面预览)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [从源码构建](#从源码构建)
- [使用说明](#使用说明)
- [协议支持说明](#协议支持说明)
- [常见问题](#常见问题)
- [作者与联系方式](#作者与联系方式)
- [支持与打赏](#支持与打赏)
- [免责声明](#免责声明)
- [License](#license)

## 项目介绍

AuroraVPN 是一个界面精致、交互流畅的桌面代理客户端，适合需要"轻量、好看、够用"的代理工具的普通用户，也适合想学习 Electron + Vue 3 桌面应用开发的开发者参考。

它参考了主流代理客户端（如 Clash 系）的交互范式，用更轻的技术实现：不依赖任何外部代理内核，由主进程内的正向代理模块直接接管 HTTP/HTTPS 流量，并通过 Windows 注册表自动切换系统代理，实现"一键连接、全局生效"。

## 功能特性

- 订阅导入：粘贴订阅链接一键导入节点，自动识别国家/地区并归档
- 多协议解析：支持解析 vmess / vless / ss / ssr / trojan / hysteria2 / tuic / wireguard / Clash YAML 订阅
- 批次管理：每次导入独立成批，支持一键删除整批节点，旧节点自动归入「历史导入」
- 一键连接 / 断开，支持系统代理自动开关
- 实时流量监控：上传 / 下载速度、累计流量、今日用量、运行时长、实时速度曲线
- 连接会话管理：实时查看当前活跃的代理连接
- 完整日志系统：记录启动、连接、代理等事件
- 顶部信息栏：自动显示日期、城市天气与连接状态
- 深色 / 浅色双主题：紫青科技风深色 + 央视红金白浅色，全局设计系统统一，雷达、速率、图表、按钮均随主题自适应配色
- 原生 Windows 托盘：关闭最小化到托盘，后台常驻
- 版本更新：启动后自动检查 + 「关于」页手动检查，基于 GitHub Releases 比对版本号，一键跳转下载
- 纯 Node.js HTTP/HTTPS 正向代理，无第三方代理内核依赖
- 单文件绿色便携版，双击即用，无需安装

## 界面预览

> 以下截图为深色主题；浅色主题（央视红金白）在「设置 → 外观 → 主题」中切换查看。

![仪表盘](docs/screenshots/dashboard.png)

![服务器节点](docs/screenshots/servers.png)

![订阅导入](docs/screenshots/subscription.png)

![关于与打赏](docs/screenshots/about.png)

## 技术架构

整体采用 Electron 主进程 / 渲染进程分离架构，渲染层通过 preload 暴露的 contextBridge 与主进程进行 IPC 通信。

```
┌──────────────────────────────────────────────┐
│  渲染进程 Renderer（Vue 3 + Vite）             │
│  Dashboard / Servers / Connections            │
│  Logs / Settings / About                      │
└───────────────────┬──────────────────────────┘
                    │ IPC（preload contextBridge）
┌───────────────────┴──────────────────────────┐
│  主进程 Main Process（Electron）               │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Core    │ │ Proxy    │ │ System Proxy │   │
│  │ 状态机    │ │ 代理服务器 │ │ 系统代理      │   │
│  └─────────┘ └──────────┘ └──────────────┘   │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Servers │ │ 订阅解析  │ │ SS 加密客户端  │   │
│  │ 节点列表 │ │ Subscription│ │ ss-client     │   │
│  └─────────┘ └──────────┘ └──────────────┘   │
│  ┌─────────┐ ┌──────────┐                     │
│  │ Settings │ │ Weather  │                     │
│  │ 持久化设置 │ │ 天气服务  │                     │
│  └─────────┘ └──────────┘                     │
└───────────────────┬──────────────────────────┘
                    │ 127.0.0.1:7891
┌───────────────────┴──────────────────────────┐
│  网络流量（HTTP / HTTPS）                      │
└──────────────────────────────────────────────┘
```

各模块职责：

- `electron/main.js`：应用入口，负责窗口、托盘、IPC 通信与生命周期管理
- `electron/preload.js`：contextBridge 安全桥接，向渲染层暴露受限 API
- `electron/core.js`：连接状态机、真实流量统计、运行时日志
- `electron/proxy-server.js`：HTTP / HTTPS 正向代理服务器，接管本地代理流量
- `electron/ss-client.js`：Shadowsocks 加密/解密客户端，负责真实节点转发
- `electron/system-proxy.js`：通过 Windows 注册表配置 / 恢复系统代理
- `electron/servers.js`：节点数据、订阅节点合并 / 增删 / 批次管理
- `electron/subscription.js`：订阅链接抓取与多协议解析（含 Clash YAML）
- `electron/weather.js`：基于 IP 定位的天气服务（含降级策略）
- `electron/settings-store.js`：基于 JSON 文件的设置持久化
- `src/`：Vue 3 渲染层，含设计系统、状态管理、六个功能页面与可视化组件

## 项目结构

```
├── electron/                # Electron 主进程
│   ├── main.js              # 入口：窗口、托盘、IPC
│   ├── preload.js           # contextBridge 桥接
│   ├── core.js              # 连接状态机 / 流量统计
│   ├── proxy-server.js      # HTTP/HTTPS 正向代理
│   ├── ss-client.js         # Shadowsocks 加密客户端
│   ├── system-proxy.js      # Windows 系统代理
│   ├── servers.js           # 节点数据 / 批次管理
│   ├── subscription.js      # 订阅解析（多协议 + Clash YAML）
│   ├── weather.js           # 天气服务
│   └── settings-store.js    # 设置持久化
├── src/                     # Vue 3 渲染层
│   ├── pages/               # 仪表盘/节点/连接/日志/设置/关于
│   ├── components/          # 标题栏/侧边栏/雷达/速度曲线等
│   ├── styles/main.css      # 设计系统（CSS 变量与主题）
│   ├── utils/               # 格式化 / 提示 / 天气图标
│   └── store.js             # 全局响应式状态
├── build/                   # 打包图标资源
├── docs/                    # 文档与素材（截图、打赏码）
├── electron-builder.yml     # 打包配置
├── vite.config.js           # Vite 配置
└── package.json
```

## 快速开始

### 直接使用发行版

从 [Releases](releases) 下载 `AuroraVPN-1.0.0-portable.exe`，双击运行即可，无需安装。

1. 启动后进入左侧「节点」页，点击「导入订阅」粘贴订阅链接
2. 导入成功后，点击任一节点卡片即可选中（可先做延迟测试）
3. 回到「仪表盘」点击连接
4. 开启「系统代理」后，浏览器等应用即可走代理访问

### 运行环境要求

- Windows 10 / 11（x64）
- 从源码构建需要 Node.js 18+ 与 npm

## 从源码构建

```bash
# 安装依赖
npm install

# 开发模式（构建渲染层并启动应用）
npm run dev

# 仅构建渲染层
npm run build

# 打包单文件便携版（执行前已自动 vite build）
npm run dist

# 打包 NSIS 安装版
npm run dist:installer
```

构建产物输出到 `release/` 目录。项目已在 `electron-builder.yml` 中配置 Electron 下载镜像为 `npmmirror`，国内环境通常无需额外配置；若下载仍缓慢，也可在项目根目录新建 `.npmrc`：

```
electron_mirror=https://npmmirror.com/mirrors/electron/
```

## 使用说明

- 默认代理端口：7891（可在「设置」中修改，重连后生效）
- 系统代理：开启后自动配置 Windows 系统代理，断开连接时自动恢复
- 主题：深色（紫青科技风）/ 浅色（央视红金白）双主题，在「设置」中切换
- 托盘：关闭窗口默认最小化到托盘，可在设置中关闭
- 订阅批次：每次导入自动生成一个批次，支持整批删除；重新导入同一订阅会刷新配置而不破坏已有批次

## 协议支持说明

- 订阅导入阶段支持解析 `vmess`、`vless`、`ss`、`ssr`、`trojan`、`hysteria2`、`tuic`、`wireguard` 以及 Clash YAML 格式。
- 真实连接（加密隧道转发）目前完整支持 Shadowsocks（SS）节点。
- 其它协议的节点导入后仍可查看与管理，但连接时会提示「暂不支持直连」，请在后续版本中关注更新。

## 软件更新

软件启动后延时约 3 秒会自动检查一次更新，也可在「关于」页点击「检查更新」手动检查。检查逻辑通过 GitHub Releases 的 latest 版本号与当前版本号对比，发现新版本时弹出提示并可一键打开下载页。

启用更新的前提是已把源码发布到 GitHub 并创建 Release。发布后需在 `electron/main.js` 顶部把占位符替换为你自己的仓库：

```js
const UPDATE_OWNER = '你的GitHub用户名';  // 例如 'gezhechao'
const UPDATE_REPO = '你的仓库名';          // 例如 'AuroraVPN'
```

发布流程：本地修改版本号（`package.json` 的 `version` 字段）→ `npm run dist` 打包出 `.exe` → 在 GitHub 仓库「Releases」中新建 Release，tag 填 `v1.0.1`（带 `v` 前缀，数字与 `version` 对应），并上传 `.exe` 作为附件。用户下次启动或手动检查时即可收到更新提示。

## 常见问题

- **无法访问网站**：确认已连接成功、系统代理已开启，且浏览器未使用其它代理插件。
- **导入订阅失败**：检查订阅链接是否以 `http://` 或 `https://` 开头，且网络可访问该链接。
- **节点显示「需重新导入」**：该节点为旧版本导入，缺少加密配置，请重新「导入订阅」刷新。
- **更改端口后未生效**：修改端口后需先断开再重新连接。

## 作者与联系方式

作者：歌者超

- 微信：`1016168805`

欢迎交流、提 issue、Star，也欢迎一起完善功能。

## 支持与打赏

如果这个工具对你有帮助，可以请作者喝杯咖啡，微信扫一扫即可打赏：

![微信打赏码](docs/donate-qr.jpg)

## 免责声明

本项目仅用于学习与技术交流。请勿将本项目用于任何违反所在地区法律法规的用途，因使用本项目产生的任何后果由使用者自行承担。请遵守当地法律，合理、合法地使用网络。

## License

[MIT](LICENSE)
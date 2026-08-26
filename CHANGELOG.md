# 更新日志 / Changelog

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-08-26

### 新增 / Added

- 订阅导入：粘贴订阅链接一键导入节点，自动识别国家 / 地区并归档
- 多协议解析：vmess / vless / ss / ssr / trojan / hysteria2 / tuic / wireguard / Clash YAML
- 批次管理：每次导入独立成批，支持一键删除整批节点，旧节点自动归入「历史导入」
- 一键连接 / 断开，支持系统代理自动开关
- 实时流量监控：上传 / 下载速度、累计流量、今日用量、运行时长、实时速度曲线
- 连接会话管理：实时查看当前活跃的代理连接
- 完整日志系统：记录启动、连接、代理等事件
- 顶部信息栏：自动显示日期、城市天气与连接状态
- 深色 / 浅色双主题：紫青科技风深色 + 央视红金白浅色
- 原生 Windows 托盘：关闭最小化到托盘，后台常驻
- 版本更新：启动后自动检查 + 「关于」页手动检查，基于 GitHub Releases

### 修复 / Fixed

- 修复浅色主题下按钮样式被覆盖导致按钮"消失"的问题
- 修复 Shadowsocks TCP 分包导致的解密 nonce 错位问题
- 修复订阅节点国旗 emoji 孤立代理项导致的解析错误
- 修复侧栏速率显示被截断的问题

### 变更 / Changed

- 移除所有"演示 / 模拟"相关文本，正式发布
- 连接按钮图标改为插头样式，更直观体现"连接"含义

[1.0.0]: https://github.com/mdw-0254/aurora-vpn/releases/tag/v1.0.0

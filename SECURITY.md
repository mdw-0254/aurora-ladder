# 安全政策 / Security Policy

## 支持版本 / Supported Versions

仅对最新发布的版本提供安全修复。请始终使用 [Releases](releases) 中的最新版本。

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest | :x:                |

## 报告漏洞 / Reporting a Vulnerability

如果你发现安全漏洞，请**不要**在公开渠道（Issues、Pull Requests、讨论区）直接披露，以免被恶意利用。

请通过以下方式私下报告：

- 发送邮件至项目作者微信：`1016168805`
- 或通过 GitHub Security Advisories 的 "Report a vulnerability" 功能提交

请提供以下信息以帮助我们快速定位：

- 漏洞类型与影响范围
- 复现步骤（或最小复现代码）
- 受影响的版本
- 建议的修复方案（如有）

我们会在收到报告后尽快评估并回复，修复完成后会发布新版本，并感谢你的安全贡献。

## 已知安全考虑

- 应用内置代理仅监听 `127.0.0.1`（本机回环地址），默认端口 7891
- 系统代理通过 Windows 注册表配置，断开连接时自动恢复
- 项目仅用于学习与技术交流，请遵守当地法律法规

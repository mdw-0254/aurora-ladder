# 参与贡献 / Contributing

感谢你对 Aurora 的关注与支持！无论是提交代码、反馈问题、完善文档，还是提建议，都非常欢迎。

## 开发环境

- Windows 10 / 11（x64）
- Node.js 18+ 与 npm

```bash
# 安装依赖
npm install

# 开发模式（构建渲染层并启动应用）
npm run dev

# 打包便携版
npm run dist
```

## 代码规范

- 使用 ES Module 语法，代码风格保持与现有代码一致
- 提交信息使用简洁、语义化的描述（中英文皆可）
- 保持代码整洁，删除无用注释与调试输出

## 提交流程（Pull Request）

1. Fork 本仓库到你的账号
2. 创建新分支：`git checkout -b feat/xxx`
3. 提交修改并推送到你的 Fork：`git push origin feat/xxx`
4. 发起 Pull Request，清晰描述改动内容与动机
5. 等待 Review，根据反馈调整后再合并

## Issue 规范

- 报告 Bug 时请说明：复现步骤、预期行为、实际行为、运行环境（系统版本、版本号）
- 提交功能建议时请说明：使用场景、期望效果

## 安全漏洞

发现安全漏洞请勿在公开渠道（Issue / PR）直接披露，请通过 [SECURITY.md](SECURITY.md) 描述的方式私下报告。

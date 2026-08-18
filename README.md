# 🔊 dsh-task-reminder

> DSH 任务完成提醒插件：任务完成时响一声清脆的"叮"。
> A DSH (DeepSeek Harness) Cordis plugin: a crisp **ding** when your agent finishes a task.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

当**当前会话**的智能体完成任务（回复结束）时播放一声清脆的"叮"，无需盯着屏幕也能知道任务已完成。仅响应顶级会话，子代理不触发；声音为内存合成，不依赖系统声音方案。

Plays a crisp ding the moment the agent finishes your task — no need to watch the screen. Only top-level sessions trigger it (subagents never do); the sound is synthesized in memory, independent of the OS sound scheme.

---

## ⚡ 安装 / Install

**npm 一键安装（推荐）**：

```powershell
npx dsh-taskreminder@latest
```

- 从 npm 安装 `dsh-taskreminder` 包并自动安装插件到 `$DSH_HOME/profiles/web`（拷贝源码 + 写组合补丁，幂等）
- 卸载：`npx dsh-taskreminder@latest uninstall`
- 指定 profile：`npx dsh-taskreminder@latest --profile <name>`
- 全局安装后可直接用 `dsh-taskreminder install`

**或 PowerShell 一键脚本**（从 GitHub 克隆仓库 + 建联接，适合开发者改源码）：

```powershell
irm https://raw.githubusercontent.com/LongFuXiaoFeng/dsh-task-reminder/main/install.ps1 | iex
```

- 卸载：`.\install.ps1 -Uninstall`

装完 **重启 DSH** 即自动加载。也可作为动态插件（DSH 会话内，无需重启）：将 [`plugin/index.js`](plugin/index.js) 的 `apply` 函数体粘贴到 `cordis_define` 的 `code.host`（`idPrefix: taskrm`），再 `cordis_run` 激活。

详细说明见 [docs/INSTALL.md](docs/INSTALL.md)。

---

## ⚙️ 工作原理 / How it works

1. 启动时通过 `agents.currentInitiator()` 捕获所属 agent（动态插件方式）；组合方式退化为"任一顶级会话"
2. 监听 `agent/status`，agent 转为 `idle`（任务完成）时触发
3. 经 `shell` 服务以 `workspace-write` 策略执行 PowerShell，合成 1568 Hz 正弦波 + 指数衰减的"叮"（~0.6s）

---

## 🎵 自定义音色 / Customizing

编辑 [`plugin/index.js`](plugin/index.js) 中 `DING` 脚本的关键参数：`$f`（频率 Hz）、`$dur`（秒）、`$decay`（衰减速率）、振幅系数 `0.35`。

---

## 📁 结构 / Layout

```
install.ps1          # 一键安装/卸载脚本
plugin/index.js      # 插件源码
docs/INSTALL.md      # 详细安装说明
```

## 📄 License

[MIT](LICENSE) © 2025 [LongFuXiaoFeng](https://github.com/LongFuXiaoFeng)

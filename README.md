# 🔊 TaskReminder

> DSH 任务完成提醒插件 — 智能体完成任务的那一刻，响起一声清脆的"叮"。
> A DSH (DeepSeek Harness) Cordis plugin — a crisp **ding** the moment your agent finishes a task.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![DSH](https://img.shields.io/badge/DSH-DeepSeek%20Harness-blue)

**中文**：TaskReminder 是一个运行在 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) 中的 Cordis 插件。当**当前会话**的智能体完成你提出的任务（回复结束、转为空闲）时，它会播放**一声清脆的"叮"**，让你无需一直盯着屏幕也能立刻知道任务已完成。

**English**: TaskReminder is a Cordis plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai). The moment the agent of the **current session** finishes your task (reply done, agent goes idle), it plays **a single crisp "ding"**, so you instantly know the task is done without staring at the screen.

---

## ✨ 功能特性 / Features

| 中文 | English |
| --- | --- |
| ✅ 任务完成即时提示 | Instant notification when the task is finished |
| ✅ 一声清脆的"叮" | A single crisp ding (synthesized 1568 Hz sine wave with natural decay) |
| ✅ 仅当前会话触发——子代理完成、其他会话绝不误响 | Only triggers for the current session — subagents & other sessions never trigger it |
| ✅ 内存合成 WAV，不依赖系统声音方案 | WAV synthesized in memory; no dependency on the OS sound scheme |
| ✅ 无文件写入、无常驻 UI、零残留副作用 | No file writes, no UI, zero lingering side effects |
| ✅ 随插件生命周期自动清理 | Everything is cleaned up with the plugin lifecycle (stop / update / remove) |

---

## 🔧 工作原理 / How it works

1. **捕获所属会话**：插件启动时通过 `agents.currentInitiator()` 获取发起本次运行的那个 agent 的 id——`cordis_run` 正是在该 agent 的驱动链内分发的，所以启动时刻的进程级"发起者"就是本会话的 agent。
   **Identify the owner**: at startup, `agents.currentInitiator()` returns the agent that started the plugin (cordis_run dispatches inside that agent's driver chain), so the process-local initiator at apply time is exactly the current session's agent.

2. **监听状态事件**：监听 `agent/status` 事件。根作用域监听器会收到**所有** agent 的状态，因此按捕获的 owner id 过滤（兜底：只播报顶级、非子代理的 agent）。
   **Listen & filter**: the plugin listens on the `agent/status` event. Root-scoped listeners receive the status of *every* agent, so events are filtered by the captured owner id (fallback: top-level agents only).

3. **播放叮声**：当 owner agent 转为 `idle`（任务完成）时，通过 `shell` 服务执行 PowerShell，在内存中合成 1568 Hz（G6）正弦波 + 指数衰减的"叮"声并同步播放（约 0.6 秒）。
   **Play the ding**: when the owner agent turns `idle`, a PowerShell command is run through the `shell` service that synthesizes a 1568 Hz (G6) sine wave with an exponential-decay envelope in memory and plays it synchronously (~0.6 s).

### ⚠️ 一个重要的坑 / A real gotcha we hit

命令使用了 .NET API（`BinaryWriter`、`MemoryStream`、`SoundPlayer`、`Math`）。如果**不显式指定沙箱策略**，命令会运行在 PowerShell 受限语言模式（ConstrainedLanguage）下，这些 .NET 调用被禁用，**声音静默失败**——这正是本插件早期版本"不响"的根因。修复方式：向 `shell.resolve()` 显式传入 `sandboxPolicy: { mode: 'workspace-write', ... }`，让命令以 FullLanguage 运行（与模型工具层一致）。

The ding command uses .NET APIs (`BinaryWriter`, `MemoryStream`, `SoundPlayer`, `Math`). Without an explicit sandbox policy the command runs in PowerShell **ConstrainedLanguage mode**, where those calls are forbidden and the sound silently never plays — this was the actual root cause of the plugin being silent in early versions. The fix: pass an explicit `sandboxPolicy: { mode: 'workspace-write', ... }` to `shell.resolve()`, so the command runs in FullLanguage, same as the model-facing tool layer.

---

## 📦 安装与使用 / Installation & Usage

DSH 插件分两种挂载方式，任选其一。

There are two ways to mount a DSH plugin — pick either.

### 方式一：作为动态插件（推荐，零配置）/ As a dynamic plugin (recommended, zero config)

动态插件通过 DSH 会话内的 `cordis_define` / `cordis_run` 工具注册并激活，无需修改任何配置文件：

Dynamic plugins are registered and activated from inside the DSH session via the `cordis_define` / `cordis_run` tools — no config file changes needed:

1. 打开本仓库的 [`plugin/index.js`](plugin/index.js)，复制 `apply(ctx) { ... }` 函数体（从 `apply(ctx) {` 到对应的 `}`）。
   Open [`plugin/index.js`](plugin/index.js) and copy the body of `apply(ctx) { ... }`.

2. 在 DSH 会话中调用 **cordis_define**：
   Call **cordis_define** in the DSH session:

   | 参数 | 值 |
   | --- | --- |
   | `plugin.kind` | `"new"` |
   | `plugin.idPrefix` | `"taskrm"`（3–6 个小写字母，Host 会追加唯一后缀 / the Host appends a unique suffix） |
   | `name` | `"TaskReminder"` |
   | `purpose` | `"任务完成提醒：当前会话智能体完成任务时播放一声清脆的叮声。"` |
   | `code.host` | 第 1 步复制的函数体 / the copied function body |

3. 调用 **cordis_run** 激活返回的 `pluginId` / `packageId`（host-only 插件无需审批）。
   Call **cordis_run** to activate the returned `pluginId` / `packageId` (host-only packages need no approval).

4. 完成。此后每次当前会话的任务完成，都会响起一声"叮"。之后可随时用 `cordis_stop <pluginId>` 暂停、`cordis_undefine <pluginId>` 移除。
   Done. From now on every finished task in the current session rings once. Pause anytime with `cordis_stop <pluginId>`, remove with `cordis_undefine <pluginId>`.

### 方式二：作为组合插件行 / As a composition plugin row

在 Host 组合（`cordis.yml`）或 agent preset 中加入一行，引用本仓库的 `plugin` 目录：

Add a row to a host composition (`cordis.yml`) or an agent preset that points at this repository's `plugin` directory:

```yaml
plugins:
  - name: taskreminder
    path: ./path/to/TaskReminder/plugin
```

> 要求：运行上下文需挂载 `agents`、`shell`、`sandboxPolicy` 服务（DSH 默认具备）。要求 / Requirements: the mounting context must expose the `agents`, `shell` and `sandboxPolicy` services (DSH provides them by default).

---

## 🎵 自定义提示音 / Customizing the sound

编辑 [`plugin/index.js`](plugin/index.js) 中的 `DING` PowerShell 脚本即可改变音色，关键参数：

Edit the `DING` PowerShell script in [`plugin/index.js`](plugin/index.js) to change the tone. Key parameters:

| 变量 / Variable | 含义 / Meaning | 示例 / Example |
| --- | --- | --- |
| `$f` | 基频（Hz）/ fundamental frequency | `1568.0`（G6，清脆 / bright） |
| `$dur` | 时长（秒）/ duration (s) | `0.6` |
| `$decay` | 衰减速率（`Exp(-5.0*t/dur)`，越大衰减越快）/ decay rate (larger = shorter tail) | `5.0` |
| `$v` 的振幅系数 | 音量 / amplitude | `0.35` |

也可以完全替换为其他命令，例如直接播放系统声音：

Or replace it with any other command, e.g. play the OS system sound:

```powershell
[System.Media.SystemSounds]::Asterisk.Play()
```

---

## 📁 目录结构 / Repository structure

```
TaskReminder/
├── plugin/
│   └── index.js        # 插件源代码（Cordis 模块）/ plugin source (Cordis module)
├── docs/
│   └── INSTALL.md      # 详细安装说明（中文）/ detailed install guide
├── package.json        # npm 元数据 / npm metadata
├── LICENSE             # MIT 许可证 / MIT license
└── README.md           # 本文件 / this file
```

---

## 📄 许可证 / License

[MIT](LICENSE) © 2025 [LongFuXiaoFeng](https://github.com/LongFuXiaoFeng)

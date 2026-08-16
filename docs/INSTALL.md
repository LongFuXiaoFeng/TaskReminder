# TaskReminder 安装说明（中文）

本仓库的插件是纯 Host 端 Cordis 插件，不包含浏览器（Client）代码，因此激活时**无需审批**。

## 一、作为 DSH 动态插件安装（推荐）

动态插件在 DSH 会话内通过模型工具 `cordis_define` / `cordis_run` 完成，不改动任何配置文件。

1. **打开源码**：阅读 [`plugin/index.js`](../plugin/index.js)。这是一个标准 CommonJS 模块，导出 `{ name, apply }`。动态插件需要的是 `apply(ctx) { ... }` 这个函数体（从 `apply(ctx) {` 开始，到对应的 `}` 结束，不含 `module.exports` 包装）。

2. **注册（cordis_define）**：
   - `plugin.kind` → `"new"`
   - `plugin.idPrefix` → `"taskrm"`（3–6 个小写字母；Host 会自动追加唯一数字后缀）
   - `name` → `"TaskReminder"`
   - `purpose` → 一句功能描述，例如 `"任务完成提醒：当前会话智能体完成任务时播放一声清脆的叮声。"`
   - `code.host` → 第 1 步复制的函数体（注意：函数体是纯 JavaScript，不能包含 `import`/`require`/TypeScript/JSX；本文件代码已经满足）

3. **激活（cordis_run）**：用返回的 `pluginId` + `packageId`，`mode: "run"`。Host-only 包直接运行，无需浏览器审批。

4. **验证**：激活后，让当前会话完成一个任务（回复结束、agent 转为 idle），应听到一声清脆的"叮"。

## 二、作为组合插件行安装

在 Host 组合 `cordis.yml`（或 agent preset）的插件列表中加一行引用本目录：

```yaml
plugins:
  - name: taskreminder
    path: ./path/to/TaskReminder/plugin
```

要求运行上下文已挂载 `agents`、`shell`、`sandboxPolicy` 服务（DSH 默认具备）。

## 三、常见问题

**Q: 激活成功但听不到声音？**
- 确认命令以 `workspace-write` 策略运行（源码已显式传入）。若被降级到受限语言模式，.NET 调用会被禁止导致静默失败。
- 确认系统音量/扬声器正常，且没有静音。
- 确认插件日志无 `TaskReminder: ding failed` / `cannot start ding` 报错。

**Q: 子代理完成任务时会不会响？**
- 不会。插件只对启动它的那个会话 agent 播放（`agents.currentInitiator()` 捕获 + `agent/status` 按 id 过滤）。

**Q: 如何停止/移除？**
- 暂停：`cordis_stop <pluginId>`
- 彻底移除：`cordis_undefine <pluginId>`

## 四、自定义音色

编辑 [`plugin/index.js`](../plugin/index.js) 中的 `DING` PowerShell 脚本：
- `$f`：基频（Hz），默认 `1568.0`（G6，清脆）
- `$dur`：时长（秒），默认 `0.6`
- 衰减包络：`$decay = [math]::Exp(-5.0 * $t / $dur)`，数值越大衰减越快
- 振幅：`$v` 中系数 `0.35`，越大越响

也可以整体替换为其它命令，例如 `[System.Media.SystemSounds]::Asterisk.Play()`。

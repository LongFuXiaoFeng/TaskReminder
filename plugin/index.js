/**
 * TaskReminder
 * ============
 * A DSH (DeepSeek Harness) Cordis plugin that plays a crisp "ding" sound the
 * moment the current session's agent finishes a task.
 *
 * 一个 DSH（DeepSeek Harness）Cordis 插件：当前会话的智能体完成任务的那一刻，
 * 播放一声清脆的"叮"，明确告知用户任务已完成。
 *
 * How it works / 工作原理
 * ------------------------
 * 1. The plugin captures its owning session's agent id at startup via
 *    `agents.currentInitiator()` (cordis_run dispatches inside that agent's
 *    driver chain, so the process-local initiator at apply time is exactly
 *    the agent we announce for).
 * 2. It listens on the `agent/status` event. Root-scoped listeners receive
 *    the status of EVERY agent, so events are filtered by the captured owner
 *    id (fallback: only top-level / non-subagent agents).
 * 3. When the owner agent turns `idle` (task finished), it synthesizes a
 *    crisp 1568 Hz "ding" (sine wave with exponential decay) in-memory and
 *    plays it through the `shell` service.
 *
 * Why the explicit sandbox policy / 为什么要显式指定沙箱策略
 * -----------------------------------------------------------
 * The ding command uses .NET APIs (BinaryWriter, MemoryStream, SoundPlayer,
 * Math). Under the default policy the command runs in PowerShell
 * ConstrainedLanguage mode, where those calls are forbidden and the sound
 * silently never plays. Passing an explicit `workspace-write` policy runs the
 * command in FullLanguage — same as the model-facing tool layer.
 */

'use strict';

/**
 * One crisp "ding": a 1568 Hz (G6) sine wave with an exponential decay
 * envelope, ~0.6 s, synthesized as a WAV in memory and played synchronously.
 * No file writes, no dependency on the OS sound scheme.
 *
 * 一声清脆的"叮"：1568 Hz (G6) 正弦波 + 指数衰减包络，约 0.6 秒，
 * 在内存中合成 WAV 并同步播放，不写文件、不依赖系统声音方案。
 */
const DING = `
$sr=44100
$f=1568.0
$dur=0.6
$n=[int]($sr*$dur)
$stream=New-Object System.IO.MemoryStream
$w=New-Object System.IO.BinaryWriter($stream)
function W([string]$s){foreach($c in $s.ToCharArray()){$w.Write([byte]$c)}}
W 'RIFF'
$w.Write([int32](36+$n*2))
W 'WAVE'
W 'fmt '
$w.Write([int32]16)
$w.Write([int16]1)
$w.Write([int16]1)
$w.Write([int32]$sr)
$w.Write([int32]($sr*2))
$w.Write([int16]2)
$w.Write([int16]16)
W 'data'
$w.Write([int32]($n*2))
for($i=0;$i -lt $n;$i++){
  $t=$i/$sr
  $decay=[math]::Exp(-5.0*$t/$dur)
  $v=[math]::Sin(2*[math]::PI*$f*$t)*$decay*0.35
  $w.Write([int16]([int]($v*32767)))
}
$stream.Position=0
$p=New-Object System.Media.SoundPlayer($stream)
$p.PlaySync()
$w.Dispose()
$stream.Dispose()
`;

/**
 * Cordis plugin definition. Loadable either as a dynamic DSH plugin (paste the
 * body of `apply` into `code.host` of cordis_define) or as a composition
 * plugin row pointing at this file.
 *
 * Cordis 插件定义。既可作为 DSH 动态插件使用（把 apply 函数体贴入
 * cordis_define 的 code.host），也可作为组合（composition）插件行引用本文件。
 */
module.exports = {
  name: 'TaskReminder',
  apply(ctx) {
    const agents = ctx.get('agents');
    const shell = ctx.get('shell');
    const sandboxPolicySvc = ctx.get('sandboxPolicy');

    if (agents === undefined || shell === undefined) {
      console.error('TaskReminder: services unavailable (agents/shell)');
      return;
    }

    // Force the same sandbox mode as the model-facing tool layer so the
    // command runs in FullLanguage (see header note).
    let policy;
    try {
      if (sandboxPolicySvc !== undefined && sandboxPolicySvc.workspaceRoot !== undefined) {
        policy = { mode: 'workspace-write', workspaceRoot: sandboxPolicySvc.workspaceRoot };
      }
    } catch (err) {
      console.error('TaskReminder: policy resolve failed', err && err.message ? err.message : String(err));
    }

    const playDing = () => {
      try {
        const request = { command: DING, timeoutMs: 10000 };
        if (policy !== undefined) request.sandboxPolicy = policy;
        const spec = shell.resolve(request);
        shell.run(spec).catch((err) => {
          console.error('TaskReminder: ding failed', err && err.message ? err.message : String(err));
        });
      } catch (err) {
        console.error('TaskReminder: cannot start ding', err && err.message ? err.message : String(err));
      }
    };

    // The plugin is started by this session's agent (cordis_run dispatches
    // inside that agent's driver chain), so the process-local initiator at
    // apply time is exactly the agent whose task completions we announce.
    const captured = agents.currentInitiator();
    const ownerId =
      captured === undefined || captured === null ? undefined : String(captured.id);

    // Root-scoped listeners receive EVERY agent's status events; keep only the
    // current session's agent (fallback: top-level agents only).
    ctx.on('agent/status', (payload) => {
      if (!payload || payload.status !== 'idle') return;
      const agent = payload.agent;
      if (!agent || agent.id === undefined) return;
      if (ownerId !== undefined) {
        if (String(agent.id) !== ownerId) return;
      } else {
        const roots = agents.roots();
        if (!roots.some((r) => r.id === agent.id)) return;
      }
      playDing();
    });

    console.log('TaskReminder: armed');
  },
};

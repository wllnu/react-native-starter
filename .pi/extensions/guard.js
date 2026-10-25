// pi wiring for the guard scripts, the counterpart of the hooks in .claude/settings.json. Logic lives
// in scripts/guard/. pi loads this after you trust the project (/trust).
//
// tool_call blocks what pre-bash.mjs and pre-edit.mjs block, tool_result appends on-edit.mjs
// problems to the edit's result, and agent_before_settle runs on-stop.mjs: a failing verify sends
// the failures back and continues the run once, like Claude Code's Stop hook.

import { fromPi, postToolUse, preToolUse, runGuard, systemMessage } from '../../scripts/guard/adapters.mjs';

export default function guard(pi) {
  let retried = false; // Claude Code's stop_hook_active: this run already continued once for verify

  pi.on('tool_call', async (event, ctx) => {
    const reason = await preToolUse(fromPi(event.toolName, event.input, ctx.cwd), ctx.cwd);
    return reason ? { block: true, reason } : undefined;
  });

  pi.on('tool_result', async (event, ctx) => {
    if (event.isError) return undefined;
    const problems = await postToolUse(fromPi(event.toolName, event.input, ctx.cwd), ctx.cwd);
    return problems ? { content: [...event.content, { type: 'text', text: `Guard found problems in this edit. Fix them:\n${problems}` }] } : undefined;
  });

  pi.on('agent_before_settle', async (event, ctx) => {
    if (event.outcome !== 'completed') return undefined;
    const r = await runGuard('on-stop.mjs', { hook_event_name: 'Stop', stop_hook_active: retried, cwd: ctx.cwd });
    if (r.code === 2) {
      retried = true;
      return { entries: [{ type: 'custom_message', customType: 'guard', content: r.stderr, display: true }], continue: true };
    }
    retried = false;
    const message = systemMessage(r.stdout);
    if (message && ctx.hasUI) ctx.ui.notify(message, 'warning');
    return undefined;
  });
}

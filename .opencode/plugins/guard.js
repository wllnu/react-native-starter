// opencode (2.x) wiring for the guard scripts, the counterpart of the hooks in .claude/settings.json.
// Logic lives in scripts/guard/.
//
// tool execute.before blocks what pre-bash.mjs and pre-edit.mjs block, execute.after appends
// on-edit.mjs problems to the edit's result, and when a session finishes a run, on-stop.mjs runs
// verify: a failure is sent back as a new prompt once, like Claude Code's Stop hook. That needs a
// running server (the TUI or `opencode serve`); one-shot `opencode run --standalone` exits first.

import { fromOpencode, postToolUse, preToolUse, runGuard, systemMessage } from '../../scripts/guard/adapters.mjs';

export default {
  id: 'rn-starter.guard',
  setup: async (ctx) => {
    const cwd = ctx.location.directory;
    const retried = new Set(); // sessions whose last run already continued once for verify

    await ctx.tool.hook('execute.before', async (event) => {
      const reason = await preToolUse(fromOpencode(event.tool, event.input, cwd), cwd);
      if (reason) throw new Error(reason);
    });

    await ctx.tool.hook('execute.after', async (event) => {
      if (event.status !== 'completed') return;
      const problems = await postToolUse(fromOpencode(event.tool, event.input, cwd), cwd);
      if (!problems) return;
      const content = event.result.content;
      const note = { type: 'text', text: `Guard found problems in this edit. Fix them:\n${problems}` };
      event.result = { ...event.result, content: Array.isArray(content) ? [...content, note] : [{ type: 'text', text: String(content || '') }, note] };
    });

    // Events are handled one at a time, so two sessions never run verify at once.
    (async () => {
      for await (const event of ctx.event.subscribe()) {
        if (event.type !== 'session.execution.succeeded') continue;
        const sessionID = event.data.sessionID;
        const r = await runGuard('on-stop.mjs', { hook_event_name: 'Stop', stop_hook_active: retried.has(sessionID), cwd });
        if (r.code === 2) {
          retried.add(sessionID);
          await ctx.session.prompt({ sessionID, text: r.stderr });
          continue;
        }
        retried.delete(sessionID);
        // lazy: the give-up warning goes to opencode's log, not the TUI. Upgrade: a TUI plugin toast.
        const message = systemMessage(r.stdout);
        if (message) console.warn(message);
      }
    })().catch((err) => console.error(`rn-starter.guard: stop gate stopped: ${err}`));
  },
};

// Shared glue for agents other than Claude Code: .pi/extensions/guard.js and .opencode/plugins/guard.js.
//
// Both translate their tool calls into the hook JSON Claude Code sends, then run the same guard
// scripts, so every agent gets the same blocks, the same `rule-id: file:line message` feedback and
// the same stop gate. The guard scripts stay the single source of truth.
// Node 18+, built-ins only, no dependencies.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD_DIR = path.dirname(fileURLToPath(import.meta.url));

// Runs scripts/guard/<script> with `payload` as hook JSON on stdin. Async so a minutes-long verify
// in on-stop.mjs doesn't freeze the agent's UI. `node` from PATH, like .claude/settings.json: inside
// opencode, process.execPath is the opencode binary.
export function runGuard(script, payload) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(GUARD_DIR, script)], { cwd: payload.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: err.message }));
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.stdin.end(JSON.stringify(payload));
  });
}

// The systemMessage on-stop.mjs prints when it gives up after one retry, or ''.
export function systemMessage(stdout) {
  try { return String(JSON.parse(stdout).systemMessage || ''); } catch { return ''; }
}

const abs = (cwd, p) => path.resolve(cwd, String(p).replace(/^@/, ''));

// pi tool call -> [{ tool_name, tool_input }] in Claude Code's shape; [] for tools the guards ignore.
// pi: bash {command}, edit {path, edits: [{oldText, newText}]}, write {path, content}, read {path}.
export function fromPi(toolName, input, cwd) {
  if (!input) return [];
  if (toolName === 'bash') return [{ tool_name: 'Bash', tool_input: { command: input.command } }];
  if (toolName === 'read') return [{ tool_name: 'Read', tool_input: { file_path: abs(cwd, input.path) } }];
  if (toolName === 'write') return [{ tool_name: 'Write', tool_input: { file_path: abs(cwd, input.path), content: input.content } }];
  if (toolName === 'edit') {
    const edits = (Array.isArray(input.edits) ? input.edits : []).map((e) => ({ old_string: e.oldText, new_string: e.newText }));
    return [{ tool_name: 'MultiEdit', tool_input: { file_path: abs(cwd, input.path), edits } }];
  }
  return [];
}

// opencode 2.x tool call -> [{ tool_name, tool_input }]. shell {command}, edit {path, oldString,
// newString}, write {path, content}, read {path}, patch {patchText}. A patch becomes one call per file: Write for
// an added file, Edit for an update (context lines on both sides), and for a delete an `rm` (so
// guard/keep-tests applies) plus an empty Write (so the ios/ and android/ block applies).
export function fromOpencode(tool, input, cwd) {
  if (!input) return [];
  if (tool === 'shell') return [{ tool_name: 'Bash', tool_input: { command: input.command } }];
  if (tool === 'read') return [{ tool_name: 'Read', tool_input: { file_path: abs(cwd, input.path) } }];
  if (tool === 'write') return [{ tool_name: 'Write', tool_input: { file_path: abs(cwd, input.path), content: input.content } }];
  if (tool === 'edit') return [{ tool_name: 'Edit', tool_input: { file_path: abs(cwd, input.path), old_string: input.oldString, new_string: input.newString } }];
  if (tool !== 'patch' || typeof input.patchText !== 'string') return [];

  const calls = [];
  let file = null;
  const flush = () => {
    if (!file) return;
    for (const target of file.paths) {
      const file_path = abs(cwd, target);
      if (file.op === 'add') calls.push({ tool_name: 'Write', tool_input: { file_path, content: file.added.join('\n') } });
      else if (file.op === 'update') calls.push({ tool_name: 'Edit', tool_input: { file_path, old_string: file.removed.join('\n'), new_string: file.added.join('\n') } });
      else calls.push({ tool_name: 'Bash', tool_input: { command: `rm ${JSON.stringify(target)}` } }, { tool_name: 'Write', tool_input: { file_path, content: '' } });
    }
    file = null;
  };
  for (const line of input.patchText.split('\n')) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (header) {
      flush();
      file = { op: header[1].toLowerCase(), paths: [header[2].trim()], added: [], removed: [] };
    } else if (file && line.startsWith('*** Move to: ')) {
      file.paths.push(line.slice('*** Move to: '.length).trim());
    } else if (file && !line.startsWith('***') && !line.startsWith('@@')) {
      const body = line.slice(1);
      if (line[0] === '+') file.added.push(body);
      else if (line[0] === '-') file.removed.push(body);
      else if (line[0] === ' ') { file.added.push(body); file.removed.push(body); }
    }
  }
  flush();
  return calls;
}

// Runs pre-bash.mjs, pre-read.mjs or pre-edit.mjs for each translated call; the first block's message, or null.
export async function preToolUse(calls, cwd) {
  for (const call of calls) {
    const script = call.tool_name === 'Bash' ? 'pre-bash.mjs' : call.tool_name === 'Read' ? 'pre-read.mjs' : 'pre-edit.mjs';
    const r = await runGuard(script, { hook_event_name: 'PreToolUse', cwd, ...call });
    if (r.code === 2) return r.stderr;
  }
  return null;
}

// Runs on-edit.mjs once per written file; the combined problem lines, or ''.
export async function postToolUse(calls, cwd) {
  const files = [...new Set(calls.filter((c) => c.tool_name !== 'Bash' && c.tool_name !== 'Read' && (c.tool_name !== 'Write' || c.tool_input.content)).map((c) => c.tool_input.file_path))];
  const lines = new Set();
  for (const file_path of files) {
    const r = await runGuard('on-edit.mjs', { hook_event_name: 'PostToolUse', cwd, tool_name: 'Edit', tool_input: { file_path } });
    if (r.code === 2) for (const l of r.stderr.split('\n')) if (l.trim()) lines.add(l);
  }
  return [...lines].join('\n');
}

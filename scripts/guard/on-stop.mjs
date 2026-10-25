#!/usr/bin/env node
// Stop hook: the gate before the agent may end its turn. Runs the full verify check set and, when
// it fails, refuses to let the turn end by feeding the failures back into it (wired up in
// .claude/settings.json, but any agent or script can call it).
//
//   {"hook_event_name": "Stop", "stop_hook_active": false, "cwd": "..."}
//
// - verify passes, or stdin is unusable: exit 0, nothing to say.
// - verify fails on the first attempt (stop_hook_active false): failure lines on stderr, exit 2 —
//   Claude Code blocks the stop and feeds stderr back into the turn.
// - verify fails on the retry (stop_hook_active true): let the turn end with one JSON
//   systemMessage on stdout, so a check that can't pass doesn't loop forever.
// Node 18+, built-ins only, no dependencies.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// First non-empty line of some tool output.
function firstLine(s) {
  const hit = String(s || '').split('\n').map((l) => l.trim()).find(Boolean);
  return hit || '';
}

// The app folder holding scripts/, not the git root, so the hook also works from apps/<name> in a monorepo.
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function main() {
  // Bad or empty stdin is a normal, unmarked first stop attempt (so it can still block).
  let active = false;
  try {
    active = Boolean(JSON.parse(fs.readFileSync(0, 'utf8')).stop_hook_active);
  } catch { /* treated as stop_hook_active: false */ }

  const r = spawnSync('node', ['scripts/verify.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
  if (r.status === 0) return 0;

  const stdout = String(r.stdout || '').trimEnd();
  const stderr = String(r.stderr || '').trimEnd() || (r.error && r.error.message) || '';
  if (!active) {
    process.stderr.write(`pnpm verify failed. Fix these before finishing:\n${stdout ? `${stdout}\n` : ''}${stderr ? `${stderr}\n` : ''}`);
    return 2;
  }

  const firstFailing = firstLine(stdout) || firstLine(stderr) || `exited with code ${r.status}`;
  process.stdout.write(JSON.stringify({ systemMessage: `pnpm verify still fails after one retry, letting the turn end: ${firstFailing}` }) + '\n');
  return 0;
}

process.exit(main());
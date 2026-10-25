#!/usr/bin/env node
// PostToolUse hook for Edit|Write|MultiEdit: quick feedback on the file that was just written,
// before the agent moves on (wired up in .claude/settings.json, but any agent or script can call it).
//
//   {"hook_event_name": "PostToolUse", "cwd": "...", "tool_name": "Edit", "tool_input": {"file_path": "/abs/path"}}
//
// Runs ESLint on that one file, then an incremental project tsc (warm 1.0s, cold 2.2s on the starter).
// Errors go back into the turn as `rule-id: file:line message`. Exit 2 = errors (stderr is fed back
// to the agent), exit 0 = clean, including bad input or files outside the gate, which must never
// wedge a write.
// Node 18+, built-ins only, no dependencies.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapEslint } from '../lib/eslint-ids.mjs';
import { TS_LINE } from '../lib/ts-errors.mjs';

const LINTABLE = /\.(ts|tsx|js|mjs|cjs)$/;

// First non-empty line of some tool output.
function firstLine(s) {
  const hit = String(s || '').split('\n').map((l) => l.trim()).find(Boolean);
  return hit || '';
}

// The app folder holding scripts/, not the git root, so the hook also works from apps/<name> in a monorepo.
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function crashed(kind, r) {
  process.stderr.write(`verify/${kind}-crashed: ${firstLine(r.stderr) || (r.error && r.error.message) || `exited with code ${r.status}`}\n`);
}

function main() {
  // Bad or empty stdin must never block a write; treat it as nothing to check.
  let json;
  try { json = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return 0; }

  const cwd = typeof json.cwd === 'string' && json.cwd ? json.cwd : process.cwd();
  const filePath = json.tool_input && json.tool_input.file_path;
  if (typeof filePath !== 'string' || !filePath) return 0;

  if (!LINTABLE.test(filePath)) return 0;
  const abs = path.resolve(cwd, filePath);
  if (!fs.existsSync(abs)) return 0;
  const relToRoot = path.relative(root, abs);
  if (!relToRoot || relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return 0;
  const file = relToRoot.split(path.sep).join('/');

  const problems = [];

  const lint = spawnSync(path.join(root, 'node_modules/.bin/eslint'), ['--format', 'json', '--no-warn-ignored', file], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
  let report;
  try { report = JSON.parse(lint.stdout); }
  catch { crashed('lint', lint); return 2; }
  for (const res of report) {
    for (const m of res.messages || []) {
      if (m.severity < 2) continue; // warnings stay outside this fast gate
      const [rule, message] = mapEslint(m);
      problems.push(`${rule}: ${file}:${m.line} ${message}`); // flat-config eslint echoes absolute paths; report the repo-relative one
    }
  }

  const cacheDir = path.join(root, 'node_modules/.cache/guard');
  fs.mkdirSync(cacheDir, { recursive: true });
  const tsc = spawnSync(path.join(root, 'node_modules/.bin/tsc'), ['--noEmit', '--incremental', '--pretty', 'false', '--tsBuildInfoFile', path.join(cacheDir, 'tsc.tsbuildinfo')], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
  const typeErrors = [];
  for (const line of String(tsc.stdout || '').split('\n')) {
    const m = TS_LINE.exec(line.trim());
    // Report every file, not just this one: an edited signature breaks its callers elsewhere.
    if (m) typeErrors.push(`ts/TS${m.groups.code}: ${m.groups.rel}:${m.groups.line} ${m.groups.message}`);
  }
  if (!typeErrors.length && tsc.status !== 0) { crashed('types', tsc); return 2; }
  problems.push(...typeErrors);

  if (problems.length) {
    process.stderr.write(problems.join('\n') + '\n');
    return 2;
  }
  return 0;
}

process.exit(main());
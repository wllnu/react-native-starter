// Tests for .agents/skills/starter-check/check.mjs: run with `node --test scripts/starter-check.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = path.join(root, '.agents/skills/starter-check/check.mjs');
const run = (target) => spawnSync('node', [check, root, target], { encoding: 'utf8' });

test('the starter passes its own check, so every listed path exists', () => {
  // core.hooksPath is set by pnpm install, not by the checkout, so it is left out here.
  const lines = run(root).stdout.split('\n').filter((l) => l.startsWith('starter-check/') && !l.startsWith('starter-check/git-hook'));
  assert.deepEqual(lines, []);
});

test('a bare app gets one line per gap', () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-check-'));
  try {
    spawnSync('git', ['init', '--quiet'], { cwd: app });
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ scripts: { verify: 'node scripts/verify.mjs' }, dependencies: { expo: '*' } }));
    fs.mkdirSync(path.join(app, 'scripts'));
    fs.writeFileSync(path.join(app, 'scripts/verify.mjs'), '// an old copy\n');
    fs.mkdirSync(path.join(app, '.claude'));
    fs.writeFileSync(path.join(app, '.claude/settings.json'), '{}');

    const r = run(app);
    assert.equal(r.status, 1);
    for (const line of [
      'starter-check/missing: scripts/guard/on-edit.mjs copy it from the starter',
      'starter-check/missing: AGENTS.md',
      'starter-check/outdated: scripts/verify.mjs',
      'starter-check/script: package.json has no "typecheck" script',
      'starter-check/dependency: package.json has no jest-expo',
      'starter-check/hook: .claude/settings.json has no Stop hook on "*" running scripts/guard/on-stop.mjs',
      'starter-check/hook: .claude/settings.json permissions.deny lacks "Edit(ios/**)"',
      'starter-check/git-hook: .githooks',
      'starter-check/package-manager: .',
    ]) {
      assert.ok(r.stdout.includes(line), `expected "${line}" in:\n${r.stdout}`);
    }
    assert.ok(!r.stdout.includes('starter-check/script: package.json has no "verify"'));
  } finally {
    fs.rmSync(app, { recursive: true, force: true });
  }
});

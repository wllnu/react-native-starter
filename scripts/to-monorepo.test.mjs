// scripts/to-monorepo.mjs on a clone of this starter inside a throwaway monorepo: what the clone
// loses, what the root gains, and that the root's own settings survive. The converter deletes this
// test along with itself. Run with `node --test scripts/to-monorepo.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const starter = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const tracked = spawnSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: starter, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

const text = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(text(file));

function tmpDir(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'to-monorepo-'))); // macOS tmp sits behind a /private symlink
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// A committed copy of the starter in its own git repository, as `git clone` leaves it.
function cloneInto(dir) {
  for (const f of tracked) if (fs.statSync(path.join(starter, f), { throwIfNoEntry: false })?.isFile()) write(path.join(dir, f), fs.readFileSync(path.join(starter, f)));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'starter');
}

const convert = (app) => spawnSync('node', ['scripts/to-monorepo.mjs', '--no-install'], { cwd: app, encoding: 'utf8' });

test('to-monorepo merges a clone into an existing monorepo without overwriting its settings', (t) => {
  const root = tmpDir(t);
  write(path.join(root, 'package.json'), JSON.stringify({ name: 'mono', private: true, scripts: { build: 'turbo build' } }));
  write(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n\nallowBuilds:\n    esbuild: true\nminimumReleaseAge: 60\n");
  write(path.join(root, 'AGENTS.md'), '# Mono\n');
  write(path.join(root, '.claude/settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] } }));
  write(path.join(root, 'apps/web/package.json'), '{ "name": "web" }\n');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'mono');

  const app = path.join(root, 'apps/mobile');
  cloneInto(app);
  write(path.join(app, '.env.local'), 'X=1\n'); // ignored by the starter, must survive
  write(path.join(app, 'stray.txt'), 'x');
  assert.match(convert(app).stderr, /clone has uncommitted changes/);
  fs.rmSync(path.join(app, 'stray.txt'));

  const r = convert(app);
  assert.equal(r.status, 0, r.stderr);

  // The clone gives up what the root owns and keeps the rest.
  for (const f of ['.git', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.githooks', '.github/workflows', 'scripts/to-monorepo.mjs', 'scripts/to-monorepo.test.mjs']) assert.ok(!fs.existsSync(path.join(app, f)), `${f} is still in the app`);
  for (const f of ['src', '.github/assets', '.claude/settings.json', '.env.local', 'README.md']) assert.ok(fs.existsSync(path.join(app, f)), `${f} left the app`);
  const appPkg = json(path.join(app, 'package.json'));
  assert.equal(appPkg.name, 'mobile');
  assert.equal(appPkg.scripts.prepare, undefined);
  assert.equal(appPkg.scripts.monorepo, undefined);

  // Workspace: the root's values win, missing keys and children arrive at the root's indent.
  const ws = text(path.join(root, 'pnpm-workspace.yaml'));
  assert.match(ws, /^packages:\n {2}- 'apps\/\*'\n {2}- 'packages\/\*'\n\nallowBuilds:\n {4}esbuild: true\n {4}'@sentry\/cli': true\n/);
  assert.match(ws, /\nminimumReleaseAge: 60\n/);
  assert.match(ws, /\nminimumReleaseAgeExclude:\n {2}- /);
  assert.match(ws, /\npermissions:\n {2}drizzle-kit:\n {4}build: false\n/);
  assert.match(r.stdout, /kept your minimumReleaseAge: 60/);

  const rootPkg = json(path.join(root, 'package.json'));
  assert.equal(rootPkg.scripts.build, 'turbo build');
  assert.equal(rootPkg.scripts.verify, 'pnpm -r --if-present verify');
  assert.ok(rootPkg.scripts.prepare.includes('core.hooksPath .githooks'));
  assert.equal(git(root, 'config', 'core.hooksPath').trim(), '.githooks');
  assert.ok(fs.statSync(path.join(root, '.githooks/pre-commit')).mode & 0o100, 'pre-commit is not executable');

  const workflow = text(path.join(root, '.github/workflows/mobile.yml'));
  assert.match(workflow, /\nname: mobile\n/);
  assert.match(workflow, /working-directory: apps\/mobile\n/);
  assert.match(workflow, /- 'apps\/mobile\/\*\*'/);

  // Agent wiring: the root's own hook stays, every added hook and plugin import points at a real file.
  const hooks = json(path.join(root, '.claude/settings.json')).hooks;
  const commands = Object.values(hooks).flat().flatMap((h) => h.hooks.map((x) => x.command));
  assert.ok(commands.includes('echo mine'));
  const added = commands.filter((c) => c !== 'echo mine');
  assert.equal(added.length, 5);
  for (const c of added) assert.ok(fs.existsSync(c.replace('node "$CLAUDE_PROJECT_DIR"', root)), c);
  for (const f of ['.opencode/plugins/mobile-guard.js', '.pi/extensions/mobile-guard.js']) {
    const spec = text(path.join(root, f)).match(/from '(\.\.\/[^']+adapters\.mjs)'/)[1];
    assert.ok(fs.existsSync(path.resolve(root, path.dirname(f), spec)), `${f} imports ${spec}`);
  }
  assert.match(text(path.join(root, 'AGENTS.md')), /^# Mono\n[\s\S]*apps\/mobile\/AGENTS\.md/);
  assert.equal(text(path.join(root, 'CLAUDE.md')), '@AGENTS.md\n');

  // Everything is staged, nothing is left loose.
  assert.deepEqual(git(root, 'status', '--porcelain').split('\n').filter((l) => l && !/^[AM] /.test(l)), []);
  assert.ok(git(root, 'diff', '--cached', '--name-only').split('\n').includes('apps/mobile/src/app/_layout.tsx'));
});

test('to-monorepo sets up an empty monorepo', (t) => {
  const root = tmpDir(t);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'empty');
  const app = path.join(root, 'apps/mobile');
  cloneInto(app);

  const r = convert(app);
  assert.equal(r.status, 0, r.stderr);
  assert.match(text(path.join(root, 'pnpm-workspace.yaml')), /^packages:\n {2}- apps\/\*\nallowBuilds:\n/);
  assert.equal(json(path.join(root, 'package.json')).scripts.verify, 'pnpm -r --if-present verify');
  assert.ok(fs.existsSync(path.join(root, '.gitignore')));
  assert.ok(text(path.join(root, 'AGENTS.md')).includes('apps/mobile/AGENTS.md'));
});

test('to-monorepo refuses a clone that is not inside a monorepo', (t) => {
  const app = path.join(tmpDir(t), 'mobile');
  cloneInto(app);
  const r = convert(app);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /is not inside a git repository/);
  assert.ok(fs.existsSync(path.join(app, '.git')), 'the refusal changed the clone');
});

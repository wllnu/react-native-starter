#!/usr/bin/env node
// Wires a fresh clone of this starter into the monorepo around it. Clone into the monorepo's apps
// folder, then run it from the clone:
//
//   cd my-monorepo/apps && git clone <starter-url> mobile && cd mobile
//   pnpm monorepo                 (or node scripts/to-monorepo.mjs --no-install)
//
// The monorepo root is the git repository around the clone; an empty one (git init + apps/) works.
// The app keeps its folder name as its package name. What it does:
// - deletes the clone's .git, pnpm-lock.yaml, pnpm-workspace.yaml and .githooks (the root owns them)
// - merges the starter's pnpm settings into the root pnpm-workspace.yaml and makes `packages` cover
//   the app; your own values win, differences are listed at the end
// - moves the CI workflow to .github/workflows/<name>.yml, run in the app folder for its changes only
// - adds the guard hooks to the root .claude/settings.json and as <name>-guard.js plugins for
//   opencode and pi, so agents started at the root get the app's checks
// - adds a pointer to the app's AGENTS.md in the root AGENTS.md and CLAUDE.md
// - adds a `verify` script to the root package.json, plus a pre-commit hook that runs every app's
//   verify when the monorepo has no git hooks yet
// - runs pnpm install at the root, stages the app and the root files it touched, deletes itself
//
// Needs a clean clone and a clean monorepo, so the change is easy to review and to undo:
// `git restore --staged --worktree` on the listed root files, then delete the app folder.
// Node 18+, built-ins only.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const name = path.basename(app);
const INSTALL = !process.argv.includes('--no-install');
const notes = [];

function die(message) {
  console.error(`monorepo: ${message}`);
  process.exit(1);
}

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) die(`git ${args.join(' ')} failed: ${String(r.stderr || r.error || '').trim()}`);
  return r.stdout;
}

const read = (file) => fs.readFileSync(file, 'utf8');

// Exact-string rewrite; a starter file that drifted stops the run before anything changes.
function swap(file, text, from, to) {
  if (!text.includes(from)) die(`${file} no longer contains ${JSON.stringify(from)}. Update scripts/to-monorepo.mjs to match it.`);
  return text.split(from).join(to);
}

// ───────────────────────── tiny YAML merge ─────────────────────────
// lazy: block-style YAML only, the shape pnpm writes. Flow values ({ }, [ ]) count as scalars and
// are listed for a hand merge. Upgrade path: the `yaml` package, once the clone has node_modules.

// `foo: 1` → { key: 'foo', rest: '1' }, `'@a/b': true` → { key: '@a/b', … }, `- x` → { key: '- x' }.
function parseLine(line) {
  const t = line.trim();
  if (!t || t.startsWith('#')) return null;
  if (t.startsWith('- ')) return { key: `- ${t.slice(2).trim().replace(/^['"]|['"]$/g, '')}`, rest: '' };
  const m = /^('[^']*'|"[^"]*"|[^:]+):(.*)$/.exec(t);
  return m ? { key: m[1].replace(/^['"]|['"]$/g, ''), rest: m[2].replace(/\s+#.*$/, '').trim() } : null;
}
const indentOf = (line) => line.length - line.trimStart().length;

// The entries at the shallowest indent in lines[from, to): key line, the comments right above it,
// and every deeper line below it.
function entries(lines, from, to) {
  const out = [];
  let indent = null;
  for (let i = from; i < to; i++) {
    const p = parseLine(lines[i]);
    if (!p) continue;
    indent ??= indentOf(lines[i]);
    if (indentOf(lines[i]) !== indent) continue;
    let start = i;
    while (start > (out.length ? out.at(-1).head + 1 : from) && lines[start - 1].trim().startsWith('#')) start--;
    if (out.length) out.at(-1).end = start;
    out.push({ ...p, head: i, start, end: to });
  }
  return out;
}

// Adds what `source` has and `target` lacks: whole top-level keys, and missing children of keys
// both have. Never changes a value the target already set.
function mergeYaml(target, source) {
  const lines = target.split('\n');
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const src = source.split('\n');
  for (const s of entries(src, 0, src.length)) {
    const mine = entries(lines, 0, lines.length).find((e) => e.key === s.key);
    if (!mine) {
      lines.push(...src.slice(s.start, s.end).filter((l) => l.trim()));
      continue;
    }
    if (s.rest || mine.rest) {
      if (s.rest !== mine.rest) notes.push(`pnpm-workspace.yaml: kept your ${s.key}: ${mine.rest || '(block)'}. The starter uses ${s.rest || 'a block'}.`);
      continue;
    }
    const have = new Set(entries(lines, mine.head + 1, mine.end).map((e) => e.key));
    const child = lines.slice(mine.head + 1, mine.end).find((l) => parseLine(l));
    const unit = child ? indentOf(child) : 2;
    let at = mine.end;
    while (at > mine.head + 1 && !lines[at - 1].trim()) at--;
    for (const c of entries(src, s.head + 1, s.end)) {
      if (have.has(c.key)) continue;
      const add = src.slice(c.start, c.end).filter((l) => l.trim()).map((l) => ' '.repeat((indentOf(l) / 2) * unit) + l.trimStart());
      lines.splice(at, 0, ...add);
      at += add.length;
    }
  }
  return `${lines.join('\n')}\n`;
}

const globRe = (g) => new RegExp(`^${g.replace(/\/$/, '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*')}$`);

// ───────────────────────── preconditions ─────────────────────────
if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) die(`the app folder name becomes the package name, so it must be lowercase: got ${JSON.stringify(name)}.`);
const own = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: app, encoding: 'utf8' });
if (own.status !== 0 || fs.realpathSync(own.stdout.trim()) !== app) die('run this in a fresh clone of the starter: its folder must be its own git repository.');
const outer = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: path.dirname(app), encoding: 'utf8' });
if (outer.status !== 0) die(`${path.dirname(app)} is not inside a git repository. Clone the starter into your monorepo's apps folder and run this there.`);
const root = fs.realpathSync(outer.stdout.trim());
const rel = path.relative(root, app).split(path.sep).join('/');
const at = (file) => path.join(root, file);

if (git(app, 'status', '--porcelain').trim()) die('the clone has uncommitted changes. Its .git is deleted, so commit or drop them first.');
const dirty = git(root, 'status', '--porcelain').split('\n').filter((l) => l && !(l.startsWith('?? ') && `${rel}/`.startsWith(l.slice(3))));
if (dirty.length) die(`commit or stash the monorepo's changes first, so this change is easy to review:\n${dirty.join('\n')}`);

const workflowFile = `.github/workflows/${name}.yml`;
const opencodeFile = `.opencode/plugins/${name}-guard.js`;
const piFile = `.pi/extensions/${name}-guard.js`;
for (const f of [workflowFile, opencodeFile, piFile]) if (fs.existsSync(at(f))) die(`${f} already exists in the monorepo.`);

// ───────────────────────── new file contents ─────────────────────────
const files = {};

const appPkg = JSON.parse(read(path.join(app, 'package.json')));
appPkg.name = name;
delete appPkg.scripts.prepare; // the root owns core.hooksPath
delete appPkg.scripts.monorepo;
files[`${rel}/package.json`] = `${JSON.stringify(appPkg, null, 2)}\n`;

let rootPkg;
try { rootPkg = fs.existsSync(at('package.json')) ? JSON.parse(read(at('package.json'))) : { name: path.basename(root), private: true }; }
catch { die('the root package.json is not valid JSON.'); }
rootPkg.scripts ??= {};
if (!rootPkg.scripts.verify) rootPkg.scripts.verify = 'pnpm -r --if-present verify';
else notes.push(`package.json: kept your root verify script. Make sure it runs the app's: pnpm --filter ${name} verify`);

// A pre-commit hook only when the monorepo has none: never take over husky, lefthook or a hooksPath.
const hooksPath = spawnSync('git', ['config', 'core.hooksPath'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const gitDir = path.resolve(root, git(root, 'rev-parse', '--git-common-dir').trim());
const ownHook = !hooksPath && !fs.existsSync(path.join(gitDir, 'hooks/pre-commit')) && !['.husky', '.githooks', 'lefthook.yml', '.lefthook.yml'].some((f) => fs.existsSync(at(f)));
if (ownHook) {
  files['.githooks/pre-commit'] = `#!/bin/sh\n# Runs every app's verify gate on each commit; core.hooksPath points here via the root prepare script.\nexec pnpm -r --if-present verify\n`;
  if (!rootPkg.scripts.prepare) rootPkg.scripts.prepare = 'git config core.hooksPath .githooks 2>/dev/null || true';
  else notes.push('package.json: add `git config core.hooksPath .githooks` to your root prepare script so fresh clones get the pre-commit hook.');
} else {
  notes.push(`git hooks: the monorepo already has a hook setup. Add \`pnpm --filter ${name} verify\` to its pre-commit.`);
}
files['package.json'] = `${JSON.stringify(rootPkg, null, 2)}\n`;

const workspaceTarget = fs.existsSync(at('pnpm-workspace.yaml')) ? read(at('pnpm-workspace.yaml')) : '';
const tl = workspaceTarget.split('\n');
const pkgEntry = entries(tl, 0, tl.length).find((e) => e.key === 'packages');
const patterns = pkgEntry ? entries(tl, pkgEntry.head + 1, pkgEntry.end).map((e) => e.key.slice(2)).filter((g) => g && !g.startsWith('!')) : [];
const parentGlob = path.posix.dirname(rel) === '.' ? rel : `${path.posix.dirname(rel)}/*`;
const packages = patterns.some((g) => globRe(g).test(rel)) ? '' : `packages:\n  - ${pkgEntry ? rel : parentGlob}\n`;
files['pnpm-workspace.yaml'] = mergeYaml(workspaceTarget, packages + read(path.join(app, 'pnpm-workspace.yaml')).replaceAll('(RULES.md', `(${rel}/RULES.md`));
notes.push('pnpm-workspace.yaml: the starter\'s minimumReleaseAge (new versions wait a day) now applies to every package in the monorepo.');

let workflow = read(path.join(app, '.github/workflows/verify.yml'));
const paths = [`${rel}/**`, 'pnpm-lock.yaml', 'pnpm-workspace.yaml', workflowFile].map((p) => `      - '${p}'`).join('\n');
workflow = swap('verify.yml', workflow, '\nname: verify\n', `\nname: ${name}\n`);
workflow = swap('verify.yml', workflow, 'group: verify-', `group: ${name}-`);
workflow = swap('verify.yml', workflow, '  pull_request:\n  push:\n    branches:\n      - main\n',
  `  pull_request:\n    paths:\n${paths}\n  push:\n    branches:\n      - main\n    paths:\n${paths}\n`);
workflow = swap('verify.yml', workflow, '    timeout-minutes: 30\n',
  `    timeout-minutes: 30\n    defaults:\n      run:\n        # pnpm install still installs the whole workspace from here.\n        working-directory: ${rel}\n`);
if (rootPkg.packageManager) {
  // pnpm/action-setup refuses a second pnpm version next to the packageManager field.
  workflow = swap('verify.yml', workflow, '        with:\n          # Same pnpm as eas.json so the lockfile and build environments match.\n          version: 12.11.2\n', '');
  notes.push(`${rel}/eas.json pins pnpm 12.11.2. Match it to the root packageManager (${rootPkg.packageManager}).`);
}
files[workflowFile] = workflow;

let claudeText = read(path.join(app, '.claude/settings.json'));
claudeText = swap('.claude/settings.json', claudeText, '$CLAUDE_PROJECT_DIR\\"/scripts/', `$CLAUDE_PROJECT_DIR\\"/${rel}/scripts/`);
claudeText = swap('.claude/settings.json', claudeText, '"Edit(ios/**)", "Edit(android/**)"', `"Edit(${rel}/ios/**)", "Edit(${rel}/android/**)"`);
const ours = JSON.parse(claudeText);
let theirs;
try { theirs = fs.existsSync(at('.claude/settings.json')) ? JSON.parse(read(at('.claude/settings.json'))) : {}; }
catch { die('the root .claude/settings.json is not valid JSON.'); }
const claude = {
  ...theirs,
  enabledPlugins: { ...ours.enabledPlugins, ...theirs.enabledPlugins },
  permissions: { ...theirs.permissions, deny: [...new Set([...(theirs.permissions?.deny || []), ...ours.permissions.deny])] },
  hooks: { ...theirs.hooks },
};
for (const [event, list] of Object.entries(ours.hooks)) claude.hooks[event] = [...(claude.hooks[event] || []), ...list];
files['.claude/settings.json'] = `${JSON.stringify(claude, null, 2)}\n`;

const guardImport = "'../../scripts/guard/";
files[opencodeFile] = swap('.opencode/plugins/guard.js', read(path.join(app, '.opencode/plugins/guard.js')), guardImport, `'../../${rel}/scripts/guard/`);
files[piFile] = swap('.pi/extensions/guard.js', read(path.join(app, '.pi/extensions/guard.js')), guardImport, `'../../${rel}/scripts/guard/`);

const pointer = `\n## ${rel}\n\nExpo app for iOS and Android. Read \`${rel}/AGENTS.md\` before you change anything in that folder: it has the app's stack, rules and its \`pnpm verify\` gate.\n`;
const withPointer = (file, fallback) => {
  if (!fs.existsSync(at(file))) return fallback;
  const text = read(at(file));
  return text.includes(`${rel}/AGENTS.md`) ? null : `${text.replace(/\n*$/, '\n')}${pointer}`;
};
const agents = withPointer('AGENTS.md', `pnpm monorepo. Each app has its own AGENTS.md; read it before you change anything in that app.\n${pointer}`);
if (agents) files['AGENTS.md'] = agents;
const claudeMd = fs.existsSync(at('CLAUDE.md')) && /@AGENTS\.md/.test(read(at('CLAUDE.md'))) ? null : withPointer('CLAUDE.md', '@AGENTS.md\n');
if (claudeMd) files['CLAUDE.md'] = claudeMd;
if (!fs.existsSync(at('.gitignore'))) files['.gitignore'] = 'node_modules/\n.DS_Store\n.env*.local\n';

// ───────────────────────── apply ─────────────────────────
for (const f of ['.git', 'node_modules', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.githooks', '.github/workflows', 'scripts/to-monorepo.mjs', 'scripts/to-monorepo.test.mjs']) {
  fs.rmSync(path.join(app, f), { recursive: true, force: true });
}
for (const [file, text] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(at(file)), { recursive: true });
  fs.writeFileSync(at(file), text);
}
if (ownHook) {
  fs.chmodSync(at('.githooks/pre-commit'), 0o755);
  git(root, 'config', 'core.hooksPath', '.githooks');
}
console.log(`monorepo: wired ${rel} into ${root}`);

if (INSTALL) {
  const r = spawnSync('pnpm', ['install'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) notes.push('pnpm install failed. Fix the error above, then run pnpm install at the root.');
}
const touched = [...Object.keys(files).filter((f) => !f.startsWith(`${rel}/`)), ...(fs.existsSync(at('pnpm-lock.yaml')) ? ['pnpm-lock.yaml'] : [])];
git(root, 'add', '-A', '--', rel, ...touched);

console.log(`
Changed at the root (staged): ${touched.join(', ')}

Check by hand:
${notes.map((n) => `  - ${n}`).join('\n')}

Next:
  1. Review with git status, then commit.${INSTALL ? '' : ' Run pnpm install at the root first.'}
  2. The starter's lockfile is gone, so the root install resolved the app's dependencies fresh.
     Run pnpm verify --full in ${rel}: its expo install --check catches versions that drifted from the SDK.
  3. The ${workflowFile} workflow only runs for changes under ${rel}. If branch protection requires
     its "verify" job, PRs that don't touch the app will wait on it.`);

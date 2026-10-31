#!/usr/bin/env node
// Compares a project's agent setup against the starter: the guard hooks, the verify gate, the rules,
// the skills and the package.json and git wiring. The starter is the source of truth.
//
//   node check.mjs <starter-dir> [target-dir]      target defaults to the current directory
//
// The starter-check skill clones the starter from GitHub and runs this file from the clone, so the
// lists below always come from the starter's main branch, never from an app's stale copy.
// Prints one line per finding as `rule-id: path message`. Exit code 1 when anything must be fixed;
// `starter-check/review` lines are expected differences for the agent to judge, not failures.
// Node 18+, built-ins only.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Copied as-is: must exist and match the starter byte for byte. A folder covers every file in it.
const SAME = [
  'scripts/verify.mjs',
  'scripts/verify-visual.mjs',
  'scripts/guard/',
  'scripts/lib/',
  'scripts/monorepo.test.mjs',
  'scripts/visual-build.test.mjs',
  'scripts/visual-flow-isolation.test.mjs',
  'design/check.mjs',
  '.agents/rn-reviewer.md',
  '.agents/skills/ui-design/',
  '.agents/skills/starter-check/',
];
// The app's own version of a starter file: must exist, a difference goes to review.
const OWN = [
  'AGENTS.md',
  'CLAUDE.md',
  'RULES.md',
  '.rules/',
  'eslint.config.js',
  'src/config.test.ts',
  'app.config.ts',
  'DESIGN.md',
  'design/tokens.ts',
  '.maestro/_template.yaml',
  '.claude/skills/ui-design',
  '.claude/skills/starter-check',
];
// Wired at the app root. Inside a monorepo, scripts/to-monorepo.mjs moves these to the monorepo root
// under other names, so they are only checked when the app is the git root.
const APP_ROOT_SAME = ['.githooks/pre-commit', '.opencode/plugins/guard.js', '.pi/extensions/guard.js'];
const APP_ROOT_OWN = ['.github/workflows/verify.yml'];
const SCRIPTS = ['verify', 'verify:visual', 'lint', 'typecheck', 'test'];
// The tools verify.mjs and the guard hooks call.
const DEV_DEPS = ['eslint', 'eslint-config-expo', '@eslint-community/eslint-plugin-eslint-comments', 'typescript', 'jest', 'jest-expo', '@testing-library/react-native'];
const GUARD_SCRIPT = /scripts\/guard\/[\w-]+\.mjs/;

const [starterArg, targetArg = '.'] = process.argv.slice(2);
if (!starterArg) {
  console.error('usage: node check.mjs <starter-dir> [target-dir]');
  process.exit(2);
}
const starter = path.resolve(starterArg);
// Real paths, so they compare equal to what git prints (macOS temp dirs live behind /var -> /private/var).
const target = fs.realpathSync(path.resolve(targetArg));

const fixes = [];
const reviews = [];
const fix = (rule, file, message) => fixes.push(`starter-check/${rule}: ${file} ${message}`);
const review = (file, message) => reviews.push(`starter-check/review: ${file} ${message}`);

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function isFile(file) {
  try { return fs.statSync(file).isFile(); }
  catch { return false; }
}

// Tracked and untracked files under each entry, so a local run also covers uncommitted changes.
function starterFiles(entries) {
  const out = git(starter, 'ls-files', '--cached', '--others', '--exclude-standard', '--', ...entries);
  if (out === null) {
    console.error(`starter-check: ${starter} is not a git checkout of the starter`);
    process.exit(2);
  }
  return out.split('\n').filter(Boolean);
}

function compareFiles(entries, same) {
  for (const file of starterFiles(entries)) {
    const ours = path.join(target, file);
    const theirs = path.join(starter, file);
    if (!fs.existsSync(ours)) {
      const link = fs.lstatSync(theirs).isSymbolicLink() ? fs.readlinkSync(theirs) : null;
      fix('missing', file, link ? `link it to ${link}, as the starter does` : same ? 'copy it from the starter' : 'write the app\'s version, starting from the starter\'s');
      continue;
    }
    if (!isFile(ours) || !isFile(theirs)) continue; // a skill symlink: existing is enough
    if (fs.readFileSync(ours).equals(fs.readFileSync(theirs))) continue;
    if (same) fix('outdated', file, 'differs from the starter. Copy the starter\'s version; change the starter, not the copy');
    else review(file, 'differs from the starter');
  }
}

const gitRoot = git(target, 'rev-parse', '--show-toplevel');
const atAppRoot = !gitRoot || fs.realpathSync(gitRoot) === target;
if (!gitRoot) fix('no-git', '.', 'is not a git repository. verify diffs against main and the pre-commit hook needs git');

compareFiles(SAME, true);
compareFiles(OWN, false);
if (atAppRoot) {
  compareFiles(APP_ROOT_SAME, true);
  compareFiles(APP_ROOT_OWN, false);
} else {
  review(path.relative(target, gitRoot) || '.', 'is a monorepo root. Check that its pre-commit hook runs this app\'s verify and that the opencode and pi guard plugins point at this app');
}

// package.json scripts and the tools they call.
const ourPkg = readJson(path.join(target, 'package.json'));
const theirPkg = readJson(path.join(starter, 'package.json')) || {};
if (!ourPkg) {
  fix('missing', 'package.json', 'is missing or not valid JSON');
} else {
  for (const name of [...SCRIPTS, ...(atAppRoot ? ['prepare'] : [])]) {
    const want = theirPkg.scripts?.[name];
    const have = ourPkg.scripts?.[name];
    if (want === undefined) continue;
    if (have === undefined) fix('script', 'package.json', `has no "${name}" script. The starter's is "${want}"`);
    else if (have !== want) review('package.json', `"${name}" is "${have}", the starter's is "${want}"`);
  }
  const deps = { ...ourPkg.dependencies, ...ourPkg.devDependencies };
  for (const name of DEV_DEPS) {
    if (!deps[name]) fix('dependency', 'package.json', `has no ${name}. verify and the guard hooks run it. Add it as a dev dependency with npx expo install`);
  }
  if (!deps.expo) fix('dependency', 'package.json', 'has no expo. The guard and verify assume an Expo app');
}

// pnpm: verify, the hooks and CI call it. In a monorepo the lockfile sits at the root.
if (![target, gitRoot].filter(Boolean).some((dir) => fs.existsSync(path.join(dir, 'pnpm-lock.yaml')))) {
  fix('package-manager', '.', 'has no pnpm-lock.yaml. The hooks, verify and CI run pnpm');
}

// Agent hooks: every guard script the starter wires up, under the same event and matcher. Claude
// Code reads .claude/settings.json at the project root, which is the git root in a monorepo.
const hookKeys = (settings) => {
  const keys = new Set();
  for (const [event, groups] of Object.entries(settings?.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        const script = GUARD_SCRIPT.exec(hook.command ?? '')?.[0];
        if (script) keys.add(`${event} ${group.matcher ?? '*'} ${script}`);
      }
    }
  }
  return keys;
};
const settingsFile = path.join(gitRoot || target, '.claude/settings.json');
const settingsRel = path.relative(target, settingsFile);
const ourSettings = readJson(settingsFile);
const theirSettings = readJson(path.join(starter, '.claude/settings.json'));
if (!ourSettings) {
  fix('missing', settingsRel, 'is missing or not valid JSON. It wires the guard hooks into Claude Code');
} else {
  const ours = hookKeys(ourSettings);
  for (const key of hookKeys(theirSettings)) {
    if (ours.has(key)) continue;
    const [event, matcher, script] = key.split(' ');
    fix('hook', settingsRel, `has no ${event} hook on "${matcher}" running ${script}`);
  }
  const deny = new Set(ourSettings.permissions?.deny ?? []);
  for (const rule of theirSettings?.permissions?.deny ?? []) {
    if (!deny.has(rule)) fix('hook', settingsRel, `permissions.deny lacks "${rule}"`);
  }
}

// The pre-commit hook only runs when git looks in .githooks; the prepare script sets that on install.
if (gitRoot && atAppRoot && git(target, 'config', 'core.hooksPath') !== '.githooks') {
  fix('git-hook', '.githooks', 'is not core.hooksPath, so the pre-commit hook never runs. Run pnpm install, or git config core.hooksPath .githooks');
}

// Continuous Native Generation: committed native folders mean the app is not on prebuild yet.
if (gitRoot && git(target, 'ls-files', '--', 'ios', 'android')) {
  fix('native-folders', 'ios/ android/', 'are committed. The starter generates them with prebuild; move native config into app.config.ts and config plugins');
}

for (const line of [...fixes, ...reviews]) console.log(line);
const version = git(starter, 'rev-parse', '--short', 'HEAD') || starter;
console.log(`\nstarter-check: ${fixes.length} to fix, ${reviews.length} to review, against the starter at ${version}.`);
process.exitCode = fixes.length ? 1 : 0;

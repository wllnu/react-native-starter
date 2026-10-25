#!/usr/bin/env node
// The verify gate: the one command agents, git hooks and CI run before they hand off.
//
//   node scripts/verify.mjs          check the files changed since the merge base with main (+ untracked)
//   node scripts/verify.mjs --full   check everything (implied when the CI env var is set)
//   node scripts/verify.mjs --visual also run the simulator tier (scripts/verify-visual.mjs), manual only
//
// Tiers are picked from the changed files; lint, types and tests run concurrently. Every failure
// prints as one line: `rule-id: file:line message`. Exit code 1 when anything failed.
// Node 18+, built-ins only, no dependencies.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapEslint } from './lib/eslint-ids.mjs';
import { TS_LINE } from './lib/ts-errors.mjs';

const FULL = process.argv.includes('--full') || Boolean(process.env.CI);
const VISUAL = process.argv.includes('--visual'); // manual only: the user starts a simulator run, never a hook, CI or an agent on its own

// ───────────────────────── small helpers ─────────────────────────
function gitOut(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`git ${args.join(' ')} failed to start: ${r.error.message}`);
  return r.stdout;
}

// First non-empty, ANSI-free, trimmed line of some tool output.
function firstLine(s) {
  const lines = String(s || '').replace(/\x1b\[[\d;]*[A-Za-z]/g, '').replace(/\r/g, '').split('\n');
  const hit = lines.map((l) => l.trim()).find(Boolean);
  return hit || '';
}

// Prefer an "error"-looking line over a random first line (CLI tools pad stderr with banners).
function firstErrorLine(r) {
  const lines = String(r.stderr || '').replace(/\x1b\[[\d;]*[A-Za-z]/g, '').replace(/\r/g, '').split('\n');
  const meaningful = lines.map((l) => l.trim()).filter(Boolean);
  return meaningful.find((l) => /error|exception|invalid|cannot|failed/i.test(l)) || firstLine(r.stdout) || `exited with code ${r.code}`;
}

// First meaningful line of a failed dependency check: skip banners ("Running N checks...") and
// pass marks, and grab a line with a failure mark or the word error if there is one. The marks are
// escaped below so the design check never flags this file's own lines.
const FAIL_MARK = /^[\u2717\u2716\u274c\u2715\u2718]/u;
const PASS_MARK = /^[\u2714\u2713\u221a\u2705]/u;
function firstDepLine(r) {
  const lines = String(r.stdout || '').replace(/\x1b\[[\d;]*[A-Za-z]/g, '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  const failHit = lines.find((l) => FAIL_MARK.test(l) || (/error/i.test(l) && !/^dependencies are up to date/i.test(l)));
  if (failHit) return failHit;
  return lines.find((l) => !PASS_MARK.test(l) && !/^(running \d+ checks?|environment info)/i.test(l)) || lines[0];
}

const rel = (abs) => (abs ? path.relative(root, path.resolve(root, abs)).split(path.sep).join('/') : '');

// ───────────────────────── changed files ─────────────────────────
// The app folder holding scripts/, not the git root, so the gate also works from apps/<name> in a monorepo.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

let base = 'HEAD'; // fall back here when the merge base can't be determined (no main, detached)
try { base = gitOut(['merge-base', 'HEAD', 'main']).trim() || 'HEAD'; }
catch { base = 'HEAD'; }

const changed = (() => {
  const set = new Set();
  // Diff base against the working tree: committed-since-base, staged and unstaged in one call.
  // --relative keeps the diff inside the app folder with app-relative paths; ls-files already does.
  for (const line of gitOut(['diff', '--name-only', '--relative', base]).split('\n')) if (line) set.add(line);
  for (const line of gitOut(['ls-files', '--others', '--exclude-standard']).split('\n')) if (line) set.add(line);
  return [...set];
})();
const existing = changed.filter((f) => fs.existsSync(path.join(root, f)));

const codeFiles = existing.filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
const srcCode = existing.filter((f) => /^src\/.+\.(ts|tsx)$/.test(f));
const designChanged = existing.some((f) => f === 'DESIGN.md' || /\.tsx$/.test(f));
const maestroChanged = existing.some((f) => f.startsWith('.maestro/'));
const depsChanged = ['package.json', 'pnpm-lock.yaml'].some((f) => changed.includes(f));
const scriptsChanged = existing.some((f) => f.startsWith('scripts/'));
const configChanged = ['app.config.ts', 'eas.json'].some((f) => changed.includes(f)) || changed.some((f) => f.startsWith('plugins/'));

// ───────────────────────── findings ─────────────────────────
const TIER_ORDER = { lint: 0, types: 1, tests: 2, guards: 2.5, design: 3, visual: 3.5, deps: 4, config: 5, native: 6, secrets: 7 };
const failures = [];
const warnings = [];
const ran = [];
const skipped = [];
let counter = 0;

function fail(tier, rule, file, line, message) {
  return { order: counter++, tier, rule, file, line, message };
}
function skip(name, reason) {
  skipped.push({ name, reason });
}
// A tool that produced nothing parseable is a failure, not a pass.
function crash(tier, r) {
  failures.push(fail(tier, `verify/${tier}-crashed`, undefined, undefined, firstLine(r ? r.stderr || r.stdout : '') || (r ? `exited with code ${r.code}, no output` : 'could not start')));
}

function runCapture(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd || root, shell: false, env: opts.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => resolve({ code: -1, stdout, stderr: `${stderr}${stderr ? '\n' : ''}${e.message}` }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    // Never let a hung tool wedge the gate: tiers have generous, finite timeouts.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ code: -1, stdout, stderr: `${stderr}timed out after ${opts.timeoutMs}ms` });
    }, opts.timeoutMs || 10 * 60 * 1000);
    timer.unref();
  });
}

async function guard(tier, fn) {
  try { await fn(); }
  catch (e) { crash(tier, { stderr: e.message, stdout: '', code: -1 }); }
}

// ───────────────────────── shared result parsers ─────────────────────────
const RN_ID = /^(rn-[\w-]+\/[\w-]+):\s*/;

// Jest: failures become `jest/test-failed` unless the assertion message carries a rule ID.
function collectJestFailures(parsed, tier) {
  for (const suite of parsed.testResults || []) {
    let sawFailedAssertion = false;
    for (const a of suite.assertionResults || []) {
      if (a.status !== 'failed') continue;
      sawFailedAssertion = true;
      const first = firstLine((a.failureMessages && a.failureMessages[0]) || '');
      const hit = RN_ID.exec(first);
      failures.push(fail(tier, hit ? hit[1].replace(/:$/, '') : 'jest/test-failed', rel(suite.name), (a.location && a.location.line) || undefined, `${a.fullName}: ${hit ? first.slice(hit[0].length) : first}`));
    }
    // Suite-level failure with no individual assertion (an import or setup crash).
    if (suite.status === 'failed' && !sawFailedAssertion) {
      failures.push(fail(tier, 'jest/test-failed', rel(suite.name), undefined, firstLine(suite.message || 'test suite failed')));
    }
  }
}

// Shared temp dir for the Jest --outputFile; removed when the caller finishes.
async function runJest(tier, jestArgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `verify-${tier}-`));
  try {
    const outfile = path.join(dir, 'jest.json');
    const r = await runCapture('npx', ['jest', ...jestArgs, '--json', '--outputFile', outfile]);
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(outfile, 'utf8')); }
    catch { crash(tier, r); return; }
    collectJestFailures(parsed, tier);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ───────────────────────── tiers ─────────────────────────
async function runLint() {
  ran.push('lint');
  const args = FULL ? ['--format', 'json', '.'] : ['--format', 'json', ...codeFiles];
  const r = await runCapture('npx', ['eslint', ...args]);
  let parsed;
  try { parsed = JSON.parse(r.stdout); }
  catch { crash('lint', r); return; }
  for (const res of parsed) {
    for (const m of res.messages || []) {
      const [rule, message] = mapEslint(m);
      const line = fail('lint', rule, rel(res.filePath), m.line, message);
      if (m.severity >= 2) failures.push(line);
      else warnings.push(line);
    }
  }
}

async function runTypes() {
  ran.push('types');
  const r = await runCapture('npx', ['tsc', '--noEmit', '--pretty', 'false']);
  const found = [];
  for (const line of r.stdout.split('\n')) {
    const m = TS_LINE.exec(line.trim());
    if (m) found.push(fail('types', `ts/TS${m.groups.code}`, rel(m.groups.rel), Number(m.groups.line), m.groups.message));
  }
  if (found.length) { found.forEach((f) => failures.push(f)); return; }
  if (r.code !== 0) crash('types', r); // tsc failed but nothing matched the standard error format
}

async function runTests() {
  ran.push('tests');
  if (FULL) { await runJest('tests', ['--passWithNoTests']); return; }
  await runJest('tests', ['--findRelatedTests', ...srcCode, '--passWithNoTests']);
}

// The guard scripts' own node:test suites (Jest's jest-expo preset doesn't load plain .mjs).
async function runGuards() {
  ran.push('guards');
  const files = gitOut(['ls-files', '--cached', '--others', '--exclude-standard', 'scripts/']).split('\n').filter((f) => f.endsWith('.test.mjs'));
  if (!files.length) return;
  const r = await runCapture('node', ['--test', '--test-reporter=tap', ...files]);
  const failed = r.stdout.split('\n').map((l) => l.trim()).filter((l) => /^not ok \d+ - /.test(l));
  for (const l of failed) failures.push(fail('guards', 'guard/test-failed', undefined, undefined, l.replace(/^not ok \d+ - /, '')));
  if (r.code !== 0 && !failed.length) crash('guards', r);
}

async function runDesign() {
  ran.push('design');
  const files = FULL ? gitOut(['ls-files', '*.tsx']).split('\n').filter((f) => f.startsWith('src/')) : [];
  const args = FULL ? ['--json', ...files] : ['--base', base, '--json'];
  const r = await runCapture('node', ['design/check.mjs', ...args]);
  let parsed;
  try { parsed = JSON.parse(r.stdout); }
  catch { crash('design', r); return; }
  for (const p of parsed.problems || []) {
    const message = `${p.val ? `${p.val} ` : ''}${p.hint || 'design check'}`.trim();
    failures.push(fail('design', `design/${p.rule}`, p.file, p.line, message));
  }
  if (!parsed.problems?.length && r.code !== 0) crash('design', r);
}

// Dependencies a third-party React Native package replaces with a first-party Expo module.
const EXPO_MODULE_FIRST = [
  ['react-native-fast-image', 'expo-image', 'expo-image'],
  ['react-native-linear-gradient', 'expo-linear-gradient', 'expo-linear-gradient'], // design-ignore: package names, not a style
  ['react-native-haptic-feedback', 'expo-haptics', 'expo-haptics'],
  ['react-native-device-info', 'expo-device or expo-application', 'expo-device'],
  ['react-native-splash-screen', 'expo-splash-screen', 'expo-splash-screen'],
  ['react-native-fs', 'expo-file-system', 'expo-file-system'],
  ['react-native-video', 'expo-video', 'expo-video'],
  ['react-native-camera', 'expo-camera', 'expo-camera'],
];
function checkExpoModuleFirst() {
  const pkgFile = path.join(root, 'package.json');
  if (!fs.existsSync(pkgFile)) return;
  const lines = fs.readFileSync(pkgFile, 'utf8').split('\n');
  let pkg;
  try { pkg = JSON.parse(lines.join('\n')); } catch { return; }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  for (const name of Object.keys(deps)) {
    const hit = EXPO_MODULE_FIRST.find(([bad]) => bad === name);
    if (!hit) continue;
    const line = lines.findIndex((l) => l.includes(`"${hit[0]}"`));
    const where = line >= 0 ? line + 1 : undefined;
    failures.push(fail('deps', 'rn-native-deps/expo-module-first', 'package.json', where, `${hit[0]} is replaced by ${hit[1]}. Use npx expo install ${hit[2]}.`));
  }
}

async function runDeps() {
  ran.push('deps');
  checkExpoModuleFirst();
  const checks = [
    [['expo', 'install', '--check'], 'rn-native-deps/expo-install-check'],
    [['expo-doctor'], 'rn-native-deps/expo-doctor'],
  ];
  for (const [args, rule] of checks) {
    const r = await runCapture('npx', args);
    if (r.code !== 0) {
      const line = firstDepLine(r) || firstLine(r.stderr);
      if (line) failures.push(fail('deps', rule, undefined, undefined, line));
      else crash('deps', r);
    }
  }
}

async function runPrebuild() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-prebuild-'));
  try {
    // Copy the whole tracked + untracked tree into a scratch dir so prebuild can never
    // touch (or delete, via --clean) anything in the real repository.
    for (const f of gitOut(['ls-files', '--cached', '--others', '--exclude-standard']).split('\n')) {
      if (!f || f === '.git') continue;
      const src = path.join(root, f);
      if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
      const dest = path.join(tmp, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
    const r = await runCapture('npx', ['expo', 'prebuild', '--clean', '--no-install'], { cwd: tmp, env: { ...process.env, CI: '1' } });
    if (r.code !== 0) {
      failures.push(fail('config', 'rn-native-deps/prebuild', undefined, undefined, firstErrorLine(r)));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function runConfig() {
  ran.push('config');
  if (fs.existsSync(path.join(root, 'src/config.test.ts'))) {
    await runJest('config', ['src/config.test.ts', '--passWithNoTests']);
  } else {
    skip('config test', 'src/config.test.ts missing');
  }
  await runPrebuild();
}

// Simulator tier behind --visual. UI changes = any .tsx, DESIGN.md or .maestro flow.
async function runVisual() {
  ran.push('visual');
  const r = await runCapture('node', ['scripts/verify-visual.mjs'], { timeoutMs: 60 * 60 * 1000 });
  if (r.code !== 0) {
    failures.push(fail('visual', 'verify/visual-failed', undefined, undefined, firstErrorLine(r)));
    // The visual run is long; keep more of its output so the agent can fix the failing flow.
    console.log(`${r.stdout || ''}${r.stderr || ''}`.split('\n').slice(-60).join('\n'));
  }
}

// ───────────────────────── inline checks ─────────────────────────
const SECRET_RE = /EXPO_PUBLIC_\w*(SECRET|PRIVATE|PASSWORD|SERVICE_ROLE)\w*/;
const BINARY_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'icns', 'pdf', 'zip', 'tgz', 'gz', 'bz2', '7z', 'ttf', 'otf', 'woff', 'woff2', 'eot', 'mp4', 'mov', 'm4v', 'avi', 'mkv', 'mp3', 'wav', 'aac', 'ogg', 'flac', 'wasm', 'bin', 'dat', 'sqlite', 'db', 'node']);
function runInlineChecks() {
  ran.push('native', 'secrets');
  // Continuous Native Generation: ios/ and android/ are outputs, never inputs.
  for (const f of changed) {
    if (f.startsWith('ios/') || f.startsWith('android/')) {
      failures.push(fail('native', 'rn-native-deps/no-native-edits', f, undefined, 'ios/ and android/ are generated by prebuild. Put native config in app.config.ts or a config plugin.'));
    }
  }
  // Secret names in EXPO_PUBLIC_ variables ship in the app bundle: scan every changed text file.
  for (const f of existing) {
    if (f === 'scripts/verify.mjs' || f === 'pnpm-lock.yaml') continue;
    if (BINARY_EXT.has(f.split('.').pop())) continue;
    let buf;
    try { buf = fs.readFileSync(path.join(root, f)); } catch { continue; }
    if (buf.includes(0)) continue; // actual binary, not just an odd extension
    const lines = buf.toString('utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const hit = lines[i].match(SECRET_RE);
      if (!hit) continue;
      failures.push(fail('secrets', 'rn-security/no-client-secrets', f, i + 1, `${hit[0]} is a secret name. EXPO_PUBLIC_ values ship inside the app bundle. Keep secrets on a server.`));
    }
  }
}

// ───────────────────────── main ─────────────────────────
function print() {
  const sortKey = (f) => `${TIER_ORDER[f.tier] ?? 9}~${String(f.order).padStart(6, '0')}`;
  const line = (f) => {
    const loc = f.file ? `${f.file}${f.line != null ? `:${f.line}` : ''}` : '';
    return `${f.rule}:${loc ? ` ${loc}` : ''} ${f.message}`;
  };
  for (const f of [...failures].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1))) console.log(line(f));
  if (warnings.length) {
    console.log('');
    console.log('Warnings:');
    for (const w of warnings) console.log(line(w));
  }
  console.log('');
  const ranList = [...ran].sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b]).join(', ');
  const skipList = skipped.map((s) => `${s.name} (${s.reason})`).join(', ');
  console.log(`verify: ${failures.length} failures. Ran: ${ranList}.${skipped.length ? ` Skipped: ${skipList}.` : ''}`);
  process.exitCode = failures.length ? 1 : 0;
}

async function main() {
  runInlineChecks();

  const concurrent = [];
  if (codeFiles.length || FULL) concurrent.push(guard('lint', runLint));
  else skip('lint', 'no lintable files changed');
  concurrent.push(guard('types', runTypes));
  if (srcCode.length || FULL) concurrent.push(guard('tests', runTests));
  else skip('tests', 'no src .ts/.tsx changed');
  if (scriptsChanged || FULL) concurrent.push(guard('guards', runGuards));
  else skip('guards', 'no scripts/ change');
  await Promise.all(concurrent);

  if (designChanged || FULL) await guard('design', runDesign);
  else skip('design', 'no .tsx or DESIGN.md changed');

  if (depsChanged || FULL) await guard('deps', runDeps);
  else skip('deps', 'no package.json or lockfile change');

  if (configChanged || FULL) await guard('config', runConfig);
  else skip('config', 'no app.config.ts, eas.json or plugins/ change');

  if (VISUAL && (designChanged || maestroChanged || FULL)) await guard('visual', runVisual);
  else if (VISUAL) skip('visual', 'no .tsx, DESIGN.md or .maestro flow changed');
  else skip('visual', 'manual only, run when the user asks');

  print();
}

await main();
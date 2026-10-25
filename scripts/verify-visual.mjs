#!/usr/bin/env node
// Visual verification: the only sanctioned way to look at app screens.
//
//   node scripts/verify-visual.mjs          build (if needed), boot two simulators, run each flow in light and dark
//   node scripts/verify-visual.mjs --setup-only    stop after build, install and Metro are ready (no flows)
//
// It boots an iPhone SE (3rd generation) and the largest Pro Max, installs the development build
// (rebuilding only when @expo/fingerprint says the native project changed), starts Metro, and runs
// each Maestro flow in .maestro/ in light and dark (`xcrun simctl ui <device> appearance <mode>`).
// Screenshots land in artifacts/screens/<flow>-<device>-<light|dark>.png and are printed at the end.
//
// Because console noise is how React Native surfaces real bugs, Metro and the simulator log stream
// are captured while the flows run. Failures: red boxes (`ERROR` lines), any of
// "VirtualizedLists should never be nested", "Each child in a list should have a unique key",
// "Cannot update a component while rendering", and iOS crashes (NSException/SIGABRT) in the app
// process. Other yellow boxes (`WARN` lines) are listed but don't fail.
//
// Run as a tier of `pnpm verify --visual`; see scripts/verify.mjs. Everything this script touches is
// machine-local and gitignored (ios/, .expo/, artifacts/), and a run starts from a fresh install
// (flows assume an empty database), so repeated runs are stable.
//
// Node 18+, macOS, Xcode and Maestro (brew install maestro). No dependencies beyond the app's own.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SETUP_ONLY = process.argv.includes('--setup-only');

const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim() || process.cwd();
const ARTIFACTS = path.join(root, 'artifacts');
const SCREEN_DIR = path.join(ARTIFACTS, 'screens');
const LOG_DIR = path.join(ARTIFACTS, 'logs');
const VISUAL_DIR = path.join(root, '.expo', 'visual'); // gitignored: fingerprint cache, DerivedData, per-run Maestro output
const MAESTRO_DIR = path.join(root, '.maestro');
const DERIVED_DATA = path.join(VISUAL_DIR, 'DerivedData');
const METRO_PORT = 8081;

// eslint-disable-next-line no-restricted-syntax -- Metro's status endpoint is the local dev server; loopback HTTP is correct here.
const METRO_STATUS = `http://localhost:${METRO_PORT}/status`;

const FLOW_TIMEOUT_MS = 10 * 60 * 1000; // a flow that takes 10 minutes is lost anyway
const BUILD_TIMEOUT_MS = 45 * 60 * 1000; // first native build on a cold machine
const METRO_TIMEOUT_MS = 2 * 60 * 1000;

const failures = [];

function die(message) {
  console.error(`verify-visual: ${message}`);
  process.exit(1);
}

function stripAnsi(s) {
  return String(s || '').replace(/\x1b\[[\d;]*[A-Za-z]/g, '');
}

// Trailing chunk of a failed tool's output, where the interesting error lines usually sit.
function tail(s, lines = 40) {
  return stripAnsi(s).split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-lines).join('\n');
}

function run(cmd, args, { timeoutMs, env, label } = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs || FLOW_TIMEOUT_MS, env: { ...process.env, ...env } });
  if (r.status !== 0) {
    die(`${label || cmd} failed (exit ${r.status}${r.error ? `, ${r.error.message}` : ''}).\n${tail(`${r.stderr || ''}\n${r.stdout || ''}`)}`);
  }
  return r;
}

function simctl(args) {
  return spawnSync('xcrun', ['simctl', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// ───────────────────────── fail-fast tool checks ─────────────────────────
if (process.platform !== 'darwin') die('macOS with Xcode is required (this script drives iOS simulators).');
if (spawnSync('which', ['maestro'], { encoding: 'utf8' }).status !== 0) {
  die([
    'Maestro is not installed. It is the driver for the flows in .maestro/, so nothing can run without it.',
    '',
    '  Install it:',
    '    brew install maestro',
    '  (https://docs.maestro.dev/get-started/readme.md has other options.)',
    '',
    '  Then re-run: pnpm verify:visual',
  ].join('\n'));
}
if (spawnSync('which', ['xcodebuild'], { encoding: 'utf8' }).status !== 0) die('Xcode is not installed or not activated (no xcodebuild on PATH).');

// ───────────────────────── devices ─────────────────────────
// "xcrun simctl list devicetypes" lines look like: iPhone 17 Pro Max (com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max)
function deviceTypes() {
  return (simctl(['list', 'devicetypes']).stdout || '').split('\n').flatMap((line) => {
    const m = /^(.*?)\s+\((com\.apple\.CoreSimulator\.SimDeviceType\.[^\s]+)\)/.exec(line.trim());
    return m ? { name: m[1], id: m[2] } : [];
  });
}

// "xcrun simctl list devices available": a section per runtime, entries like "(UDID) (Shutdown)".
function availableDevices() {
  const devices = [];
  for (const line of (simctl(['list', 'devices', 'available']).stdout || '').split('\n')) {
    const m = /^(.*?)\s+\(([0-9A-F-]{36})\)\s+\(([\w ]+)\)/.exec(line.trim());
    if (m) devices.push({ name: m[1], udid: m[2], state: m[3] });
  }
  return devices;
}

// Newest installed iOS runtime id, e.g. com.apple.CoreSimulator.SimRuntime.iOS-26-4, for new devices.
function newestIOSRuntime() {
  const hits = (simctl(['list', 'runtimes']).stdout || '').split('\n').flatMap((l) => {
    const m = /iOS[-\s]+(\d+(?:\.\d+)?).*?(com\.apple\.CoreSimulator\.SimRuntime\.iOS-[\d-]+)/.exec(l);
    return m ? { version: Number(m[1]), id: m[2] } : [];
  }).sort((a, b) => a.version - b.version);
  if (!hits.length) die('No iOS simulator runtime is installed. Install one from Xcode (Settings > Platforms).');
  return hits.at(-1).id;
}

// Find-or-create keeps other machines' clones working: the device name is stable, the UDID is not.
function findOrCreateDevice(typeName) {
  const type = deviceTypes().find((t) => t.name === typeName);
  if (!type) die(`No simulator device type named "${typeName}" exists (your Xcode is too old).`);
  const found = availableDevices().find((d) => d.name === typeName); // simulators default to their type name
  if (found) { console.log(`verify-visual: using ${typeName} (${found.udid})`); return found; }
  console.log(`verify-visual: creating a ${typeName} simulator`);
  simctl(['create', typeName, type.id, newestIOSRuntime()]);
  const created = availableDevices().find((d) => d.name === typeName);
  if (!created) die(`Could not create a ${typeName} simulator (xcrun simctl create failed).`);
  console.log(`verify-visual: created ${typeName} (${created.udid})`);
  return created;
}

function boot(udid) {
  const r = simctl(['boot', udid]);
  if (r.status !== 0 && !/already booted|Unable to lookup in current state: Booted/i.test(`${r.stderr || ''}${r.stdout || ''}`)) {
    die(`xcrun simctl boot ${udid} failed.\n${tail(`${r.stderr || ''}${r.stdout || ''}`)}`);
  }
  simctl(['bootstatus', udid, '-b']); // waits until the device can install and launch apps
}

function appearance(udid, mode) {
  simctl(['ui', udid, 'appearance', mode]);
}

const SMALL_NAME = 'iPhone SE (3rd generation)';
const PRO_TYPES = deviceTypes().filter((t) => /Pro Max$/.test(t.name));
if (!PRO_TYPES.length) die('No Pro Max simulator device type is installed (Xcode too old).');
const LARGE_NAME = PRO_TYPES.at(-1).name; // the last Pro Max in the list is the newest Xcode's
const devices = [SMALL_NAME, LARGE_NAME].map((name) => {
  const d = findOrCreateDevice(name);
  return { name: d.name, udid: d.udid, slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
});

console.log('verify-visual: booting simulators');
for (const d of devices) boot(d.udid);

// ───────────────────────── one dev build, reused across both devices ─────────────────────────
fs.mkdirSync(SCREEN_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(VISUAL_DIR, { recursive: true });
fs.rmSync(path.join(SCREEN_DIR, 'failed'), { recursive: true, force: true });

const fingerprintRun = spawnSync('node', ['-e', "import('@expo/fingerprint').then((m) => m.createProjectHashAsync('.').then((h) => console.log(h))).catch((e) => { console.error(String(e)); process.exit(1); })"], { cwd: root, encoding: 'utf8' });
if (fingerprintRun.status !== 0 || !/^[0-9a-f]{40}$/.test((fingerprintRun.stdout || '').trim())) {
  die(`@expo/fingerprint did not produce a hash.\n${tail(`${fingerprintRun.stderr || ''}${fingerprintRun.stdout || ''}`)}`);
}
const fingerprint = fingerprintRun.stdout.trim();

const CACHE_FILE = path.join(VISUAL_DIR, 'build.json');
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; } })();

const iosDir = path.join(root, 'ios');
const PRODUCTS_DIR = path.join(DERIVED_DATA, 'Build', 'Products', 'Debug-iphonesimulator');

// Names expo generates depend on the app's `name` value, so discover workspace and scheme from the
// prebuild output instead of hardcoding: variants rename everything ("Starter (development)" builds as Starterdevelopment).
function discoverIOSProject() {
  const workspace = fs.readdirSync(iosDir).find((f) => f.endsWith('.xcworkspace'));
  if (!workspace) die('expo prebuild did not produce an .xcworkspace in ios/.');
  const xcodeproj = path.join(iosDir, workspace.replace(/\.xcworkspace$/, ''), '.xcodeproj');
  const schemes = fs.readdirSync(path.join(xcodeproj, 'xcshareddata', 'xcschemes')).filter((f) => f.endsWith('.xcscheme'));
  if (schemes.length !== 1) die(`Expected exactly one scheme in ios/, found: ${schemes.join(', ')}`);
  return { workspace, scheme: schemes[0].replace(/\.xcscheme$/, '') };
}

// Called before the first install and after xcodebuild: exactly one .app must exist to install it.
function findBuiltApp() {
  if (!fs.existsSync(PRODUCTS_DIR)) return undefined;
  const apps = fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.app'));
  return apps.length === 1 ? path.join(PRODUCTS_DIR, apps[0]) : undefined; // more than one .app means a mixed DerivedData
}

let appPath = cache.app && fs.existsSync(cache.app) && cache.fingerprint === fingerprint ? cache.app : undefined;
if (appPath) {
  console.log(`verify-visual: fingerprint unchanged, reusing ${path.relative(root, appPath)}`);
} else {
  console.log('verify-visual: generating the iOS project (expo prebuild; ios/ is gitignored output)');
  run('npx', ['expo', 'prebuild', '-p', 'ios', '--clean', '--no-install'], { env: { APP_VARIANT: 'development', CI: '1' }, timeoutMs: BUILD_TIMEOUT_MS, label: 'expo prebuild' });
  const proj = discoverIOSProject();
  console.log(`verify-visual: installing pods (${proj.scheme})`);
  run('pod', ['install'], { cwd: iosDir, timeoutMs: BUILD_TIMEOUT_MS, label: 'pod install' }); // pod generates the .xcworkspace the build needs
  // Drop stale .app bundles (a rename or variant change leaves them behind) so the install step is unambiguous.
  if (fs.existsSync(PRODUCTS_DIR)) {
    fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.app') || f.endsWith('.app.dSYM')).forEach((f) => fs.rmSync(path.join(PRODUCTS_DIR, f), { recursive: true, force: true }));
  }
  console.log('verify-visual: building the development app (the first build takes minutes)');
  run('xcodebuild', [
    '-workspace', path.join(iosDir, proj.workspace),
    '-scheme', proj.scheme,
    '-configuration', 'Debug',
    '-destination', 'generic/platform=iOS Simulator', // one simulator build installs on both devices
    '-derivedDataPath', DERIVED_DATA,
    'build',
  ], { timeoutMs: BUILD_TIMEOUT_MS, label: 'xcodebuild' });
  appPath = findBuiltApp();
  if (!appPath) die('Could not find exactly one built .app under DerivedData.');
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ fingerprint, app: appPath }, null, 2));
  console.log(`verify-visual: built ${path.relative(root, appPath)}`);
}

// The bundle id and executable name change when the identifier block in app.config.ts changes, so read
// both from the built app itself (the log-stream predicate only matches the app process).
function readPlist(key) {
  const r = spawnSync('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Info.plist')], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout)[key]; } catch { return undefined; }
}
const bundleId = readPlist('CFBundleIdentifier') || cache.bundleId;
if (!bundleId) die('Could not read the app bundle id from the built .app (Info.plist).');
const appExecutable = readPlist('CFBundleExecutable');
if (!appExecutable) die('Could not read the app executable name from the built .app (Info.plist).');

// A reinstall is the reset switch: every run starts from an empty database, which is what the flows assume.
console.log(`verify-visual: installing ${bundleId} on both devices`);
for (const d of devices) {
  simctl(['uninstall', d.udid, bundleId]); // harmless when the app is not installed
  const r = simctl(['install', d.udid, appPath]);
  if (r.status !== 0) die(`installing on ${d.name} failed.\n${tail(`${r.stderr || ''}${r.stdout || ''}`)}`);
}

if (SETUP_ONLY) {
  console.log('verify-visual: setup complete (device up, app installed, fingerprint cached). Run maestro test or the full pnpm verify:visual next.');
  process.exit(0);
}

// ───────────────────────── Metro ─────────────────────────
const alreadyRunning = await fetch(METRO_STATUS).then((r) => r.status === 200).catch(() => false);
if (alreadyRunning) die(`Something already answers on ${METRO_STATUS}. Stop the other Metro (usually pnpm start in another tab), then re-run.`);
console.log(`verify-visual: starting Metro on ${METRO_PORT} (log: artifacts/logs/metro.log)`);
const metroLogPath = path.join(LOG_DIR, 'metro.log');
const metroLog = fs.openSync(metroLogPath, 'w');
const metro = spawn('node_modules/.bin/expo', ['start', '--dev-client', '--port', String(METRO_PORT)], {
  cwd: root,
  env: { ...process.env, APP_VARIANT: 'development', CI: '1' },
  stdio: ['ignore', metroLog, metroLog],
});
const metroReady = await new Promise((resolve) => {
  const started = Date.now();
  const poll = async () => {
    const ok = await fetch(METRO_STATUS).then((r) => (r.status === 200 ? r.text().then((t) => t.includes('packager-status:running')) : false)).catch(() => false);
    if (ok) return resolve(true);
    if (Date.now() - started > METRO_TIMEOUT_MS) return resolve(false);
    setTimeout(poll, 500);
  };
  poll();
});
if (!metroReady) {
  metro.kill('SIGKILL');
  fs.closeSync(metroLog);
  die(`Metro did not report running within ${METRO_TIMEOUT_MS / 1000}s. ${path.relative(root, metroLogPath)} has the output.`);
}
console.log('verify-visual: Metro is running.');

// ───────────────────────── device log streams ─────────────────────────
// One stream per device, filtered to the app process: this catches native crashes and boxes that
// only exist on the device side. JS console noise arrives at Metro instead.
const deviceLogs = devices.map((d) => {
  const file = path.join(LOG_DIR, `sim-${d.slug}.log`);
  const out = fs.openSync(file, 'w');
  const child = spawn(
    'xcrun',
    ['simctl', 'spawn', d.udid, 'log', 'stream', '--style', 'compact', '--predicate', `processImagePath CONTAINS "${appExecutable}"`],
    { cwd: root, stdio: ['ignore', out, out] },
  );
  return { file, child };
});

// ───────────────────────── flows ─────────────────────────
const flows = fs.readdirSync(MAESTRO_DIR).filter((f) => f.endsWith('.yaml') && !f.startsWith('_')).sort();
if (!flows.length) die(`No flows found in ${path.relative(root, MAESTRO_DIR)}. See .maestro/_template.yaml.`);
// The paywall is only reachable when a RevenueCat key is set, matching paywallEnabled() in src/features/pro.
const paywallEnabled = Boolean(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY);
const flowQueue = flows.filter((f) => paywallEnabled || f !== 'paywall.yaml');
const skippedFlows = flows.filter((f) => !flowQueue.includes(f));

function moveScreenshot(fromDir, target) {
  const found = [];
  const stack = [fromDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(path.join(dir, entry.name));
      else if (entry.name.endsWith('.png')) found.push(path.join(dir, entry.name));
    }
  }
  if (!found.length) return false;
  // takeScreenshot output wins over Maestro's own step screenshots, which only exist on failing steps.
  const shot = found.find((f) => f.includes(`${path.sep}takeScreenshot`)) || found.find((f) => !f.includes(`${path.sep}screenshots${path.sep}`)) || found[0];
  fs.renameSync(shot, target);
  return true;
}

function runFlow(flow, udid, mode) {
  const outDir = path.join(VISUAL_DIR, 'maestro-run');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const name = flow.replace(/\.yaml$/, '');
  const target = path.join(SCREEN_DIR, `${name}-${udid}-${mode}.png`);
  const r = spawnSync('maestro', ['--device', udid, 'test', '--test-output-dir', outDir, path.join(MAESTRO_DIR, flow)], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: FLOW_TIMEOUT_MS });
  if (r.status !== 0 || r.error) {
    // Keep Maestro's artifact bundle (device log, step screenshots, view hierarchy): it is the fastest way to debug a failed flow.
    const failedDir = path.join(SCREEN_DIR, `failed-${name}-${udid}-${mode}`);
    fs.rmSync(failedDir, { recursive: true, force: true });
    if (fs.existsSync(outDir)) fs.cpSync(outDir, failedDir, { recursive: true });
    failures.push(`${name}: maestro exited ${r.status || r.error.message}. Maestro's artifacts are in artifacts/screens/${path.basename(failedDir)}.`);
    return undefined;
  }
  if (moveScreenshot(outDir, target)) {
    fs.rmSync(outDir, { recursive: true, force: true });
    console.log(`verify-visual: screenshot for ${name} → ${path.relative(root, target)}`);
    return target;
  }
  failures.push(`${name}: flow passed but no takeScreenshot output was found in ${outDir}.`);
  return undefined;
}

const keptScreenshots = [];
for (const d of devices) {
  for (const mode of ['light', 'dark']) {
    appearance(d.udid, mode);
    console.log(`verify-visual: ${d.name} appearance ${mode}`);
    for (const flow of flowQueue) {
      const shot = runFlow(flow, d.udid, mode);
      if (shot) keptScreenshots.push(shot);
    }
  }
}

// ───────────────────────── log scan ─────────────────────────
// Fail on real bugs; list everything else. console.error and red boxes surface in the Metro log as
// `ERROR` lines (and duplicate on the device; only Metro is strict there because the device stream
// is noisy). The device stream is scanned for crashes: NSException / SIGABRT.
const FAIL_WARNINGS = [
  'VirtualizedLists should never be nested',
  'Each child in a list should have a unique key',
  'Cannot update a component while rendering',
];
const REPORT_LIMIT = 50;
const yellow = [];
for (const file of [metroLogPath, ...deviceLogs.map((l) => l.file)]) {
  const isMetro = path.basename(file) === 'metro.log';
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch { continue; }
  for (const line of lines) {
    const capped = line.slice(0, 500);
    if (FAIL_WARNINGS.some((w) => capped.includes(w))) {
      failures.push(`log/${path.basename(file)}: ${capped.trim()}`);
    } else if (isMetro && /\bERROR\b/.test(capped)) {
      failures.push(`log/${path.basename(file)}: red box ${capped.trim()}`);
    } else if (!isMetro && /\bNSException\b|\bSIGABRT\b|Fatal error/.test(capped)) {
      failures.push(`log/${path.basename(file)}: crash ${capped.trim()}`);
    } else if (isMetro && /\bWARN\b/.test(capped)) {
      if (yellow.length < REPORT_LIMIT) yellow.push(`${path.basename(file)}: ${capped.trim()}`);
    }
  }
}

// ───────────────────────── shutdown and report ─────────────────────────
for (const l of deviceLogs) l.child.kill('SIGKILL');
metro.kill('SIGKILL');
fs.closeSync(metroLog);
for (const d of devices) appearance(d.udid, 'light'); // leave the devices as they were found

if (skippedFlows.length) console.log(`verify-visual: skipped flows: ${skippedFlows.join(', ')} (set EXPO_PUBLIC_REVENUECAT_IOS_KEY to run them)`);
if (yellow.length) {
  console.log(`\nverify-visual: yellow boxes (passed, fix when noticed):`);
  for (const w of yellow) console.log(`  ${w}`);
}
console.log('\nverify-visual: screenshots');
for (const p of keptScreenshots) console.log(`  ${path.relative(root, p)}`);

if (failures.length) {
  console.error(`\nverify-visual: ${failures.length} failure(s):`);
  for (const f of [...new Set(failures)]) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nverify-visual: OK');

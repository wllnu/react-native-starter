// Regression tests for flow isolation in the visual tier: run with
// `node --test scripts/visual-flow-isolation.test.mjs` (the guards tier picks scripts/**/*.test.mjs up).
//
// The bug they guard: scripts/verify-visual.mjs installed the app once per run and then ran each
// sorted flow in both appearances on top of that. note-detail.yaml leaves a "Seed note" in the app
// database while every other flow waits for the empty-state text "Your notes show up here.", so
// every flow after the first note-detail run timed out, and the dark pass timed out earlier still.
// The fix reinstalls the app (terminate, uninstall, install) on the flow's own device before every
// flow, so each starts with clean data and a cold process.
//
// Everything device-shaped is faked: simctl/maestro are recording executors, and the last test
// runs the real verify-visual.mjs under --setup-only against PATH stubs for xcrun, maestro,
// xcodebuild and plutil plus a stub @expo/fingerprint, so no simulator, build, Metro or real
// install is ever touched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { freshInstall, runEveryFlow } from './lib/visual-flows.mjs';

const BUNDLE_ID = 'com.example.starter.dev';
const APP = '/build/Fake.app';
const DEVICES = [{ name: 'Small', udid: 'U-S' }, { name: 'Large', udid: 'U-L' }];

// simctl/maestro fakes that record every call in order; the maestro fake plays Maestro's success
// path for real: a takeScreenshot png appears in the per-run output dir it was pointed at.
function recorders(failInstall) {
  const events = [];
  const installCounts = {};
  const simctl = (args) => {
    events.push(`simctl ${args.join(' ')}`);
    if (args[0] === 'install') {
      const udid = args[1];
      installCounts[udid] = (installCounts[udid] || 0) + 1;
      if (failInstall && failInstall.udid === udid && installCounts[udid] === failInstall.nth) {
        return { status: 65, stderr: 'simulated simctl install failure', stdout: '' };
      }
    }
    return { status: 0, stderr: '', stdout: '' };
  };
  const maestro = (args) => {
    events.push(`maestro ${args[1]} ${path.basename(args.at(-1))}`);
    const outDir = args[args.indexOf('--test-output-dir') + 1];
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'shot.png'), 'png bytes');
    return { status: 0, error: undefined };
  };
  return { events, simctl, maestro, installCounts };
}

test('freshInstall resets a device in terminate, uninstall, install order and reports install failures', () => {
  const { events, simctl } = recorders();
  const device = { name: 'Test Max', udid: 'U-1' };
  const ok = freshInstall({ device, bundleId: BUNDLE_ID, appPath: APP, simctl });
  assert.deepEqual(events, [
    `simctl terminate U-1 ${BUNDLE_ID}`,
    `simctl uninstall U-1 ${BUNDLE_ID}`,
    `simctl install U-1 ${APP}`,
  ]);
  assert.equal(ok.ok, true);

  const failed = freshInstall({ device, bundleId: BUNDLE_ID, appPath: APP, simctl: () => ({ status: 65, stderr: 'simulated simctl install failure', stdout: '' }) });
  assert.equal(failed.ok, false);
  assert.match(failed.message, /installing on Test Max failed \(exit 65\)/);
  assert.match(failed.message, /simulated simctl install failure/);
});

// The core regression: the matrix runs every (device × appearance × flow) and each maestro call
// sits immediately after its own install, with no install ever skipped or reused across flows.
test('runEveryFlow reinstalls the app on the flow device immediately before every flow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfi-flow-'));
  try {
    const flows = ['new-note.yaml', 'note-detail.yaml', 'notes-list.yaml']; // real names, sorted order
    const modes = ['light', 'dark'];
    const { events, simctl, maestro, installCounts } = recorders();
    const failures = [];
    const kept = runEveryFlow({
      devices: DEVICES, flows, modes, bundleId: BUNDLE_ID, appPath: APP, timeoutMs: 1000,
      root: tmp, maestroDir: '/maestro', screenDir: path.join(tmp, 'screens'), outDir: path.join(tmp, 'run'),
      simctl, maestro, onFailure: (m) => failures.push(m), log: () => {},
    });

    const expected = [];
    for (const { udid } of DEVICES) {
      for (const mode of modes) {
        expected.push(`simctl ui ${udid} appearance ${mode}`);
        for (const flow of flows) {
          expected.push(
            `simctl terminate ${udid} ${BUNDLE_ID}`,
            `simctl uninstall ${udid} ${BUNDLE_ID}`,
            `simctl install ${udid} ${APP}`,
            `maestro ${udid} ${flow}`,
          );
        }
      }
    }
    assert.deepEqual(events, expected);
    assert.deepEqual(failures, []);
    assert.equal(kept.length, DEVICES.length * modes.length * flows.length);
    for (const { udid } of DEVICES) assert.equal(installCounts[udid], modes.length * flows.length);
    assert.ok(fs.existsSync(path.join(tmp, 'screens', 'new-note-U-S-light.png')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a failed install skips that flow and the remaining flows on the device, reported once, keeping other devices intact', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfi-fail-'));
  try {
    const { events, simctl, maestro, installCounts } = recorders({ udid: 'U-L', nth: 1 });
    const failures = [];
    const kept = runEveryFlow({
      devices: DEVICES, flows: ['a.yaml', 'b.yaml'], modes: ['light', 'dark'], bundleId: BUNDLE_ID, appPath: APP, timeoutMs: 1000,
      root: tmp, maestroDir: '/maestro', screenDir: path.join(tmp, 'screens'), outDir: path.join(tmp, 'run'),
      simctl, maestro, onFailure: (m) => failures.push(m), log: () => {},
    });

    assert.equal(failures.length, 1);
    assert.match(failures[0], /^a: /);
    assert.match(failures[0], /installing on Large failed \(exit 65\)/);
    assert.match(failures[0], /were skipped without screenshots/);
    assert.ok(events.every((e) => !e.startsWith('maestro U-L')), 'a flow ran on the device whose install failed');
    assert.equal(installCounts['U-L'], 1); // broken-device memo: the failing install is not retried
    assert.equal(installCounts['U-S'], 4); // the healthy device keeps running everything
    assert.equal(kept.length, 4); // all kept screenshots come from the healthy device
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a failed flow keeps Maestro artifacts but never produces a target screenshot', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfi-shot-'));
  try {
    const outDir = path.join(tmp, 'run');
    const maestro = (args) => {
      fs.mkdirSync(outDir, { recursive: true });
      fs.mkdirSync(path.join(outDir, 'takeScreenshot'), { recursive: true });
      fs.writeFileSync(path.join(outDir, 'takeScreenshot', 'mid-run.png'), 'png bytes'); // a screenshot mid-flow, before the flow fails
      return { status: 1, error: undefined };
    };
    const simctl = () => ({ status: 0, stderr: '', stdout: '' });
    const failures = [];
    const kept = runEveryFlow({
      devices: [{ name: 'Small', udid: 'U-S' }], flows: ['note-detail.yaml'], modes: ['light'], bundleId: BUNDLE_ID, appPath: APP, timeoutMs: 1000,
      root: tmp, maestroDir: '/maestro', screenDir: path.join(tmp, 'screens'), outDir,
      simctl, maestro, onFailure: (m) => failures.push(m), log: () => {},
    });

    assert.deepEqual(kept, []);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /^note-detail: maestro exited 1\./);
    assert.match(failures[0], /failed-note-detail-U-S-light/);
    assert.ok(!fs.existsSync(path.join(tmp, 'screens', 'note-detail-U-S-light.png')), 'a failed flow produced a screenshot');
    assert.ok(fs.existsSync(path.join(tmp, 'screens', 'failed-note-detail-U-S-light', 'takeScreenshot', 'mid-run.png')), 'Maestro artifacts were not kept for debugging');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('screenshot output prefers the takeScreenshot directory and a missing png is a failure', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfi-move-'));
  try {
    const outDir = path.join(tmp, 'run');
    const simctl = () => ({ status: 0, stderr: '', stdout: '' });
    const failures = [];
    const runOnce = (maestro, flow) => runEveryFlow({
      devices: [{ name: 'Small', udid: 'U-S' }], flows: [flow], modes: ['light'], bundleId: BUNDLE_ID, appPath: APP, timeoutMs: 1000,
      root: tmp, maestroDir: '/maestro', screenDir: path.join(tmp, 'screens'), outDir,
      simctl, maestro, onFailure: (m) => failures.push(m), log: () => {},
    });

    // takeScreenshot output wins over Maestro's own step screenshots.
    let maestro = (args) => {
      const dir = args[args.indexOf('--test-output-dir') + 1];
      fs.mkdirSync(path.join(dir, 'takeScreenshot'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'takeScreenshot', 'one.png'), 'one');
      fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'screenshots', 'step.png'), 'step');
      return { status: 0, error: undefined };
    };
    assert.deepEqual(runOnce(maestro, 'note-detail.yaml'), [path.join(tmp, 'screens', 'note-detail-U-S-light.png')]);
    assert.equal(fs.readFileSync(path.join(tmp, 'screens', 'note-detail-U-S-light.png'), 'utf8'), 'one');

    // A passing flow with no png anywhere is still a reported failure, not a silently kept run.
    maestro = (args) => {
      fs.mkdirSync(args[args.indexOf('--test-output-dir') + 1], { recursive: true });
      return { status: 0, error: undefined };
    };
    assert.deepEqual(runOnce(maestro, 'notes-list.yaml'), []);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /^notes-list: flow passed but no takeScreenshot output/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// The real script under --setup-only: it must leave the app freshly installed on the one device (the
// newest Pro Max, never the SE that is also listed) and stop there. PATH stubs intercept every device side effect, so this exercises the actual wiring
// end to end without a simulator, build or Metro.
test('verify-visual.mjs --setup-only installs only the newest Pro Max and never builds or runs flows', (t) => {
  if (process.platform !== 'darwin') return t.skip('verify-visual.mjs exits outside macOS before any device work; the unit tests above cover the scheduling.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfi-setup-'));
  try {
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    const callLog = path.join(tmp, 'calls.log');
    const stub = (name, lines) => {
      fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${`\n${lines.join('\n')}`}\n`);
      fs.chmodSync(path.join(bin, name), 0o755);
    };
    stub('xcrun', [
      'echo "xcrun $*" >> "$FAKE_STUB_LOG"',
      'case "$*" in',
      '  "simctl list devicetypes")',
      '    echo "iPhone SE (3rd generation) (com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation)"',
      '    echo "iPhone 17 Pro Max (com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max)"',
      '    ;;',
      '  "simctl list devices available")',
      '    echo "iPhone SE (3rd generation) (CE1D6E8D-1A2B-3C4D-5E6F-1122334455AA) (Shutdown)"',
      '    echo "iPhone 17 Pro Max (0F1E2D3C-4B5A-6978-8796-CCDDAA1122BB) (Shutdown)"',
      '    ;;',
      '  "simctl list runtimes")',
      '    echo "iOS 26.2 (com.apple.CoreSimulator.SimRuntime.iOS-26-2) (x86_64)"',
      '    ;;',
      'esac',
    ]);
    stub('maestro', ['echo "maestro $*" >> "$FAKE_STUB_LOG"']);
    stub('xcodebuild', ['echo "xcodebuild $*" >> "$FAKE_STUB_LOG"']);
    stub('plutil', ['echo "plutil $*" >> "$FAKE_STUB_LOG"', 'for arg in "$@"; do :; done', 'cat "$arg"']);

    // Stub @expo/fingerprint: a stable hash lets the pre-seeded cache stand in for a native build.
    const fingerprint = 'a'.repeat(40);
    const fingerprintDir = path.join(tmp, 'node_modules', '@expo', 'fingerprint');
    fs.mkdirSync(fingerprintDir, { recursive: true });
    fs.writeFileSync(path.join(fingerprintDir, 'package.json'), JSON.stringify({ name: '@expo/fingerprint', version: '0.0.0-stub', type: 'module', exports: './index.mjs' }));
    fs.writeFileSync(path.join(fingerprintDir, 'index.mjs'), `export async function createProjectHashAsync() { return '${fingerprint}'; }\n`);

    // Fake build product plus matching cache, so the script takes the reuse path: no prebuild, pod or xcodebuild.
    const visualDir = path.join(tmp, '.expo', 'visual');
    const fakeApp = path.join(visualDir, 'Fake.app');
    fs.mkdirSync(fakeApp, { recursive: true });
    fs.writeFileSync(path.join(fakeApp, 'Info.plist'), JSON.stringify({ CFBundleIdentifier: BUNDLE_ID, CFBundleExecutable: 'Starter' }));
    fs.writeFileSync(path.join(visualDir, 'build.json'), JSON.stringify({ fingerprint, app: fakeApp }, null, 2));

    const r = spawnSync(process.execPath, [fileURLToPath(new URL('./verify-visual.mjs', import.meta.url)), '--setup-only'], {
      cwd: tmp,
      env: { ...process.env, FAKE_STUB_LOG: callLog, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
      timeout: 60_000,
    });
    const report = `${r.stdout || ''}\n${r.stderr || ''}`.slice(-2500);
    assert.equal(r.status, 0, `--setup-only run failed (exit ${r.status})\n${report}`);
    assert.match(r.stdout, /installing com\.example\.starter\.dev on iPhone 17 Pro Max/);
    assert.match(r.stdout, /setup complete \(device up, app installed, fingerprint cached\)/);

    const lines = fs.readFileSync(callLog, 'utf8').split('\n').filter(Boolean);
    const simctlCalls = lines.filter((l) => l.startsWith('xcrun simctl '));
    for (const udid of ['0F1E2D3C-4B5A-6978-8796-CCDDAA1122BB']) {
      const at = simctlCalls.findIndex((l) => l.startsWith(`xcrun simctl install ${udid} `));
      assert.ok(at >= 0, `no install for ${udid}. Log:\n${lines.join('\n')}`);
      assert.equal(simctlCalls[at - 1], `xcrun simctl uninstall ${udid} ${BUNDLE_ID}`, `no uninstall before the install for ${udid}`);
      assert.equal(simctlCalls[at - 2], `xcrun simctl terminate ${udid} ${BUNDLE_ID}`, `no terminate before the install for ${udid}`);
    }
    assert.equal(lines.filter((l) => l.startsWith('xcrun simctl install ')).length, 1, 'more than the one device install ran');
    assert.ok(lines.every((l) => !l.includes('CE1D6E8D-1A2B-3C4D-5E6F-1122334455AA')), 'the iPhone SE was booted or installed');
    assert.ok(lines.every((l) => !l.startsWith('maestro ')), 'a flow ran under --setup-only');
    assert.ok(lines.every((l) => !l.startsWith('xcodebuild ')), 'a native build ran under --setup-only');
    assert.ok(lines.every((l) => !l.includes(' simctl ui ')), 'an appearance change ran under --setup-only');
    assert.ok(!fs.existsSync(path.join(visualDir, 'DerivedData')), 'DerivedData appeared under --setup-only');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
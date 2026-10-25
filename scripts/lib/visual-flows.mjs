// The flow half of scripts/verify-visual.mjs, split out so its scheduling is regression-testable
// (scripts/visual-flow-isolation.test.mjs) without simulators, native builds or Maestro: device
// side effects come in as the `simctl`/`maestro` executors, and verify-visual.mjs passes the real
// ones in.
//
// A fresh install before every flow: no flow may start from the previous one's state.
// note-detail.yaml leaves a "Seed note" in the database, and every other flow waits for
// "Your notes show up here.", which only an empty database shows. An app process left running also
// reopens on whatever screen the previous flow ended on. So before each flow the app is killed,
// uninstalled and installed again on the flow's own device. When an install fails, that device's
// remaining flows are skipped and none of them produces a screenshot, because a flow over a stale
// install would screenshot an invented state.

import fs from 'node:fs';
import path from 'node:path';

// Trailing chunk of a failed tool's output, where the interesting error lines usually sit.
function tail(s, lines = 40) {
  return String(s || '').replace(/\x1b\[[\d;]*[A-Za-z]/g, '').split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-lines).join('\n');
}

// Reset one device to "freshly installed": kill the app process, drop its data, install the build.
// `simctl` gets simctl-style args and returns the spawnSync result. On failure the caller reports
// it and skips the flow, so the returned message already carries the failed tool's output tail.
export function freshInstall({ device, bundleId, appPath, simctl }) {
  simctl(['terminate', device.udid, bundleId]); // harmless when the app is not running
  simctl(['uninstall', device.udid, bundleId]); // harmless when the app is not installed
  const r = simctl(['install', device.udid, appPath]);
  if (r.status !== 0 || r.error) {
    return { ok: false, message: `installing on ${device.name} failed (exit ${r.status}${r.error ? `, ${r.error.message}` : ''}).\n${tail(`${r.stderr || ''}${r.stdout || ''}`)}` };
  }
  return { ok: true };
}

// takeScreenshot output wins over Maestro's own step screenshots, which only exist on failing steps.
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
  const shot = found.find((f) => f.includes(`${path.sep}takeScreenshot`)) || found.find((f) => !f.includes(`${path.sep}screenshots${path.sep}`)) || found[0];
  fs.renameSync(shot, target);
  return true;
}

// Run every flow on every device in both appearances, with the app freshly installed before each
// flow. `simctl` gets simctl-style args and returns the spawnSync result; `maestro` gets the full
// maestro CLI args plus `{ timeoutMs }`. Failure rules:
//   - an install failure skips that device's remaining flows and is reported once (no screenshot);
//   - a failed flow keeps Maestro's artifact bundle (device log, step screenshots, view hierarchy)
//     for debugging but its target screenshot file is never written.
// Returns the kept screenshots.
export function runEveryFlow({ devices, flows, modes, bundleId, appPath, timeoutMs, root, maestroDir, screenDir, outDir, simctl, maestro, onFailure, log }) {
  const kept = [];
  const brokenDevices = new Set(); // devices whose install failed: their remaining flows are skipped

  const runFlow = (flow, device, mode) => {
    const name = flow.replace(/\.yaml$/, '');
    const target = path.join(screenDir, `${name}-${device.udid}-${mode}.png`);
    fs.mkdirSync(screenDir, { recursive: true });
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const r = maestro(['--device', device.udid, 'test', '--test-output-dir', outDir, path.join(maestroDir, flow)], { timeoutMs });
    if (r.status !== 0 || r.error) {
      // Keep Maestro's artifact bundle (device log, step screenshots, view hierarchy): it is the fastest way to debug a failed flow.
      const failedDir = path.join(screenDir, `failed-${name}-${device.udid}-${mode}`);
      fs.rmSync(failedDir, { recursive: true, force: true });
      if (fs.existsSync(outDir)) fs.cpSync(outDir, failedDir, { recursive: true });
      onFailure(`${name}: maestro exited ${r.status || r.error.message}. Maestro's artifacts are in artifacts/screens/${path.basename(failedDir)}.`);
      return undefined;
    }
    if (moveScreenshot(outDir, target)) {
      fs.rmSync(outDir, { recursive: true, force: true });
      log(`verify-visual: screenshot for ${name} → ${path.relative(root, target)}`);
      return target;
    }
    onFailure(`${name}: flow passed but no takeScreenshot output was found in ${outDir}.`);
    return undefined;
  };

  for (const device of devices) {
    for (const mode of modes) {
      simctl(['ui', device.udid, 'appearance', mode]);
      log(`verify-visual: ${device.name} appearance ${mode}`);
      for (const flow of flows) {
        if (brokenDevices.has(device.udid)) {
          log(`verify-visual: skipped ${flow} on ${device.name} (an earlier install failed there)`);
          continue;
        }
        const name = flow.replace(/\.yaml$/, '');
        log(`verify-visual: ${name} on ${device.name} (${mode}): reinstalling the app for a clean start`);
        const r = freshInstall({ device, bundleId, appPath, simctl });
        if (!r.ok) {
          brokenDevices.add(device.udid);
          onFailure(`${name}: ${r.message} It and the remaining flows on ${device.name} were skipped without screenshots.`);
          continue;
        }
        const shot = runFlow(flow, device, mode);
        if (shot) kept.push(shot);
      }
    }
  }
  return kept;
}
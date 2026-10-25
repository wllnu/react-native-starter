// Native iOS build helpers for scripts/verify-visual.mjs: the command runner and the Xcode project
// discovery, split out so `node --test scripts/` (the guards tier of scripts/verify.mjs) can exercise
// them with fixture directories instead of pod install and xcodebuild. die() is injected: the script
// passes its exit(1) helper so production failures keep the same format, tests record and throw.
//
// Discovery contract, verified against the SDK 57 toolchain: `expo prebuild -p ios --clean
// --no-install` generates ios/<app>/ sources plus ios/<app>.xcodeproj with one shared scheme — and no
// .xcworkspace; CocoaPods generates the wrapper .xcworkspace during `pod install`. So
// discoverIOSProject() runs on the pre-pod-install state (scheme discovery must not require the
// workspace), and projectWorkspace() resolves the pod-generated workspace as the gate before
// xcodebuild builds against it. Nothing is hardcoded: variants rename everything
// ("Starter (development)" generates "Starterdevelopment").
//
//   import { createVisualTools } from './lib/visual-build.mjs';
//   const { run, discoverIOSProject, projectWorkspace } = createVisualTools({ root, die });

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // fallback for direct users; the script injects its own

export function stripAnsi(s) {
  return String(s || '').replace(/\x1b\[[\d;]*[A-Za-z]/g, '');
}

// Trailing chunk of a failed tool's output, where the interesting error lines usually sit.
export function tail(s, lines = 40) {
  return stripAnsi(s).split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-lines).join('\n');
}

export function createVisualTools({ root, die, defaultTimeoutMs = DEFAULT_TIMEOUT_MS }) {
  // Run one build command inside the repo (cwd option overrides, e.g. pod install inside ios/)
  // and die with the tool's own last lines on failure.
  function run(cmd, args, { cwd, timeoutMs, env, label } = {}) {
    const r = spawnSync(cmd, args, { cwd: cwd ?? root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs || defaultTimeoutMs, env: { ...process.env, ...env } });
    if (r.status !== 0) {
      die(`${label || cmd} failed (exit ${r.status}${r.error ? `, ${r.error.message}` : ''}).\n${tail(`${r.stderr || ''}\n${r.stdout || ''}`)}`);
    }
    return r;
  }

  // Exactly one .xcodeproj at the top of ios/, with exactly one shared scheme. Deliberately does not
  // look at .xcworkspace: pod install has not run when this is called, so the wrapper workspace does
  // not exist yet.
  function discoverIOSProject(iosDir) {
    let top;
    try { top = fs.readdirSync(iosDir); } catch { return die('expo prebuild did not generate ios/, or it is unreadable.'); }
    const projects = top.filter((f) => f.endsWith('.xcodeproj'));
    if (!projects.length) return die('expo prebuild did not produce an .xcodeproj in ios/.');
    if (projects.length > 1) return die(`Expected exactly one .xcodeproj in ios/, found: ${projects.join(', ')}`);
    const project = projects[0];
    const schemeDir = path.join(iosDir, project, 'xcshareddata', 'xcschemes');
    if (!fs.existsSync(schemeDir)) return die(`${project} has no shared scheme: expo prebuild did not create xcshareddata/xcschemes.`);
    const schemes = fs.readdirSync(schemeDir).filter((f) => f.endsWith('.xcscheme'));
    if (!schemes.length) return die(`${project} has no shared scheme in xcshareddata/xcschemes.`);
    if (schemes.length > 1) return die(`Expected exactly one shared scheme in ${project}, found: ${schemes.join(', ')}`);
    return { project, scheme: schemes[0].replace(/\.xcscheme$/, '') };
  }

  // After pod install: exactly one wrapper .xcworkspace, named after the project it wraps (CocoaPods
  // generates <project>.xcworkspace next to <project>.xcodeproj). xcodebuild -workspace needs it to
  // see the Pods, so it is resolved and validated here, after pod install, not trusted from before.
  function projectWorkspace(iosDir, project) {
    let top;
    try { top = fs.readdirSync(iosDir); } catch { return die('could not read ios/ after pod install.'); }
    const workspaces = top.filter((f) => f.endsWith('.xcworkspace'));
    if (!workspaces.length) return die('pod install did not produce an .xcworkspace in ios/ (xcodebuild needs it to build with Pods).');
    if (workspaces.length > 1) return die(`Expected exactly one .xcworkspace in ios/, found: ${workspaces.join(', ')}`);
    const expected = `${project.replace(/\.xcodeproj$/, '')}.xcworkspace`;
    if (workspaces[0] !== expected) return die(`Expected pod install to generate ${expected} for ${project}, found: ${workspaces[0]}`);
    return workspaces[0];
  }

  return { run, discoverIOSProject, projectWorkspace };
}
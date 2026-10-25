// Regression tests for the visual tier's native build helpers (wired into scripts/verify-visual.mjs
// via scripts/lib/visual-build.mjs). Run with `node --test scripts/` — the guards tier of
// scripts/verify.mjs does too. Nothing native runs here — no pod install, no xcodebuild, no
// simulator: run() executes plain node child processes, and the discovery functions read fixture
// directories shaped like the real SDK 57 output (prebuild --no-install leaves one .xcodeproj with
// one shared scheme and no .xcworkspace; pod install adds the wrapper workspace next to it).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVisualTools } from './lib/visual-build.mjs';

// die() is injected: capture the messages so assertions can pin the exact failure text.
function tools(root) {
  const failures = [];
  const created = createVisualTools({
    root,
    die: (message) => { failures.push(message); throw new Error(message); },
  });
  return { ...created, failures };
}

// Layout mirror of ios/ as this project's toolchain actually generates it. The names come from the
// app config's identifier block ("Starter (development)" renames to Starterdevelopment), which is
// why discovery never hardcodes them.
const PROJ = 'Starterdevelopment';
const prebuild = [
  [`ios/${PROJ}/AppDelegate.swift`, '// prebuild: the app source dir, sibling to the .xcodeproj'],
  [`ios/${PROJ}.xcodeproj/xcshareddata/xcschemes/${PROJ}.xcscheme`, '<Scheme />'],
];
const podWorkspace = [[`ios/${PROJ}.xcworkspace/contents.xcworkspacedata`, 'Workspace FileRefs — pod install adds this; prebuild --no-install does not.']];

function makeFixture(t, ...groups) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-build-fixture-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [rel, content] of groups.flat()) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

// ───────────────────────── run ─────────────────────────
test('run forwards the supplied cwd to the command (pod install must run inside ios/)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-build-cwd-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const iosDir = path.join(dir, 'ios');
  fs.mkdirSync(iosDir);
  const { run, failures } = tools(dir);
  const r = run(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], { label: 'cwd probe', cwd: iosDir });
  assert.equal(fs.realpathSync(String(r.stdout).trim()), fs.realpathSync(iosDir));
  assert.deepEqual(failures, []);
});

test('run defaults cwd to the injected root when none is supplied', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-build-root-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { run, failures } = tools(dir);
  const r = run(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], { label: 'cwd probe' });
  assert.equal(fs.realpathSync(String(r.stdout).trim()), fs.realpathSync(dir));
  assert.deepEqual(failures, []);
});

test('run reports label, exit code and the command stderr through die on failure', () => {
  const { run, failures } = tools(os.tmpdir());
  assert.throws(
    () => run(process.execPath, ['-e', 'process.stderr.write("boom\\n"); process.exit(3)'], { label: 'pod install' }),
    /pod install failed \(exit 3\)/,
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /boom/); // the tool's own output reaches the failure message
});

// ───────────────────────── discoverIOSProject ─────────────────────────
test('discoverIOSProject finds the .xcodeproj and shared scheme before pod install (no .xcworkspace exists yet)', (t) => {
  const dir = makeFixture(t, prebuild);
  const { discoverIOSProject, failures } = tools(dir);
  assert.deepEqual(discoverIOSProject(path.join(dir, 'ios')), { project: `${PROJ}.xcodeproj`, scheme: PROJ });
  assert.deepEqual(failures, []);
});

test('discoverIOSProject is unaffected by the workspace pod install has since created', (t) => {
  const dir = makeFixture(t, prebuild, podWorkspace);
  const { discoverIOSProject, failures } = tools(dir);
  assert.deepEqual(discoverIOSProject(path.join(dir, 'ios')), { project: `${PROJ}.xcodeproj`, scheme: PROJ });
  assert.deepEqual(failures, []);
});

test('discoverIOSProject fails clearly when prebuild produced no .xcodeproj', (t) => {
  const dir = makeFixture(t, [[`ios/${PROJ}/AppDelegate.swift`, '// no .xcodeproj sibling: prebuild went wrong']]);
  const { discoverIOSProject, failures } = tools(dir);
  assert.throws(() => discoverIOSProject(path.join(dir, 'ios')), /did not produce an \.xcodeproj/);
  assert.equal(failures.length, 1);
});

test('discoverIOSProject fails clearly when more than one .xcodeproj exists', (t) => {
  const dir = makeFixture(t, prebuild, [[`ios/${PROJ}2.xcodeproj/project.pbxproj`, '// second project makes the target ambiguous']]);
  const { discoverIOSProject, failures } = tools(dir);
  assert.throws(() => discoverIOSProject(path.join(dir, 'ios')), /Expected exactly one \.xcodeproj/);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /, found: /); // the names are listed, not just counted
});

test('discoverIOSProject fails clearly when the project has no shared scheme', (t) => {
  const dir = makeFixture(t, [[`ios/${PROJ}/AppDelegate.swift`, '// prebuild source dir'], [`ios/${PROJ}.xcodeproj/project.pbxproj`, '// project without xcshareddata/xcschemes']]);
  const { discoverIOSProject, failures } = tools(dir);
  assert.throws(() => discoverIOSProject(path.join(dir, 'ios')), /has no shared scheme/);
  assert.equal(failures.length, 1);
});

test('discoverIOSProject names every scheme when more than one shared scheme exists', (t) => {
  const dir = makeFixture(t, prebuild, [[`ios/${PROJ}.xcodeproj/xcshareddata/xcschemes/Extra.xcscheme`, '<Scheme />']]);
  const { discoverIOSProject, failures } = tools(dir);
  assert.throws(() => discoverIOSProject(path.join(dir, 'ios')), /Expected exactly one shared scheme/);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /Starterdevelopment\.xcscheme/);
  assert.match(failures[0], /Extra\.xcscheme/);
});

// ───────────────────────── projectWorkspace ─────────────────────────
test('projectWorkspace returns the pod-generated wrapper workspace for the project', (t) => {
  const dir = makeFixture(t, prebuild, podWorkspace);
  const { projectWorkspace, failures } = tools(dir);
  assert.equal(projectWorkspace(path.join(dir, 'ios'), `${PROJ}.xcodeproj`), `${PROJ}.xcworkspace`);
  assert.deepEqual(failures, []);
});

test('projectWorkspace fails clearly when pod install produced no workspace', (t) => {
  const dir = makeFixture(t, prebuild);
  const { projectWorkspace, failures } = tools(dir);
  assert.throws(() => projectWorkspace(path.join(dir, 'ios'), `${PROJ}.xcodeproj`), /pod install did not produce an \.xcworkspace/);
  assert.equal(failures.length, 1);
});

test('projectWorkspace fails clearly when the workspace is ambiguous', (t) => {
  const dir = makeFixture(t, prebuild, podWorkspace, [['ios/Other.xcworkspace/contents.xcworkspacedata', 'workspace']]);
  const { projectWorkspace, failures } = tools(dir);
  assert.throws(() => projectWorkspace(path.join(dir, 'ios'), `${PROJ}.xcodeproj`), /Expected exactly one \.xcworkspace/);
  assert.equal(failures.length, 1);
});

test('projectWorkspace fails clearly when the workspace does not wrap the project', (t) => {
  const dir = makeFixture(t, prebuild, [['ios/Other.xcworkspace/contents.xcworkspacedata', 'workspace']]);
  const { projectWorkspace, failures } = tools(dir);
  assert.throws(() => projectWorkspace(path.join(dir, 'ios'), `${PROJ}.xcodeproj`), /Expected pod install to generate/);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /Starterdevelopment\.xcworkspace/); // says what it expected against what it found
});

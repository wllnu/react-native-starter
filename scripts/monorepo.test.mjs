// The gate scripts take the app folder as their root, not the git root, so the app also works as
// apps/<name> in a monorepo. Builds a throwaway monorepo with a sibling app and checks that only
// the app's own files are judged. Run with `node --test scripts/monorepo.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const STYLED = (color) => `import { StyleSheet } from 'react-native';\nexport const s = StyleSheet.create({ a: { color: '${color}' } });\n`;

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

// tmp/apps/mobile holds copies of the scripts under test, tmp/apps/worker is the sibling.
function monorepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'monorepo-'))); // macOS tmp sits behind a /private symlink
  const mobile = path.join(root, 'apps/mobile');
  const worker = path.join(root, 'apps/worker');
  for (const f of ['design/check.mjs', 'DESIGN.md', 'scripts/guard/pre-edit.mjs']) write(path.join(mobile, f), fs.readFileSync(path.join(app, f), 'utf8'));
  write(path.join(mobile, 'src/a.tsx'), STYLED('red'));
  write(path.join(worker, 'src/a.tsx'), STYLED('red'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  return { root, mobile, worker };
}

test('design check judges only the app folder, with app-relative paths', (t) => {
  const { root, mobile, worker } = monorepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // A changed tracked file and an untracked file in each app: the diff and ls-files paths.
  for (const dir of [mobile, worker]) {
    write(path.join(dir, 'src/a.tsx'), STYLED('#ff00aa'));
    write(path.join(dir, 'src/b.tsx'), STYLED('#ff00aa'));
  }
  const r = spawnSync('node', ['design/check.mjs', '--json'], { cwd: mobile, encoding: 'utf8' });
  const files = new Set(JSON.parse(r.stdout).problems.map((p) => p.file));
  assert.deepEqual([...files].sort(), ['src/a.tsx', 'src/b.tsx']);
});

test('pre-edit blocks the app ios/ folder when the agent runs at the monorepo root', (t) => {
  const { root, mobile } = monorepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const edit = (filePath) => spawnSync('node', [path.join(mobile, 'scripts/guard/pre-edit.mjs')], {
    input: JSON.stringify({ cwd: root, tool_name: 'Write', tool_input: { file_path: filePath, content: 'x' } }),
    encoding: 'utf8',
  });
  const blocked = edit('apps/mobile/ios/Podfile');
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /^rn-native-deps\/no-native-edits: /);
  assert.equal(edit('apps/worker/ios/Podfile').status, 0); // another app's folder is not this app's concern
});

// Unit tests for the PreToolUse guard scripts: run with `node --test scripts/guard/`.
//
// The forbidden comment strings are assembled at runtime (ED/DI) so this file never contains a bare
// directive comment: once the hooks are wired up, editing this file must not be blocked by its own
// test fixtures.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkBash } from './pre-bash.mjs';
import { checkEdit } from './pre-edit.mjs';

const ED = ['eslint', '-disable'].join('');
const DI = ['design', '-ignore'].join('');
const BAD_NEXT = `// ${ED}-next-line no-console`;
const OK_NEXT = `// ${ED}-next-line no-console -- debug output for CI`;
const BAD_BLOCK = `/* ${ED} no-console */`;
const BAD_DASH = `// ${ED}-next-line no-console --`;
const BAD_DESIGN = `// ${DI}`;
const OK_DESIGN = `// ${DI}: legacy flat list, reviewed in .rules/rn-ui.md`;
const EMSG = `eslint-comments/require-description: add a reason after --, e.g. ${OK_NEXT}`;
const DMSG = 'design/ignore-reason: write design-ignore: <reason>.';

// ───────────────────────── checkBash ─────────────────────────
// [command, rule id] for every blocked row of the table, plus chained and prefixed variants.
const BLOCKED = [
  ['expo eject', 'rn-native-deps/no-native-edits'],
  ['npx expo eject', 'rn-native-deps/no-native-edits'],
  ['npx --yes expo eject', 'rn-native-deps/no-native-edits'],
  ['pnpm exec expo eject', 'rn-native-deps/no-native-edits'],
  ['pnpm dlx expo eject', 'rn-native-deps/no-native-edits'],
  ['yarn expo eject', 'rn-native-deps/no-native-edits'],
  ['cd app && expo eject', 'rn-native-deps/no-native-edits'],

  ['git commit --no-verify -m x', 'guard/no-verify'],
  ['git commit -n -m x', 'guard/no-verify'],
  ['git commit -nm "msg"', 'guard/no-verify'],
  ['git commit --amend --no-verify', 'guard/no-verify'],
  ['git stash && git commit --no-verify', 'guard/no-verify'],

  ['git push --force', 'guard/no-force-push'],
  ['git push -f', 'guard/no-force-push'],
  ['git push -f origin main', 'guard/no-force-push'],
  ['git push origin main --force', 'guard/no-force-push'],
  ['git push --force-with-lease', 'guard/no-force-push'],
  ['git push --force-with-lease=main', 'guard/no-force-push'],
  ['echo x; git push --force-with-lease', 'guard/no-force-push'],

  ['pnpm add lodash', 'guard/expo-install'],
  ['pnpm add -D lodash', 'guard/expo-install'],
  ['pnpm install lodash', 'guard/expo-install'],
  ['pnpm i lodash', 'guard/expo-install'],
  ['pnpm i --filter web lodash', 'guard/expo-install'],
  ['pnpm --dir app install lodash', 'guard/expo-install'],
  ['pnpm install -D typescript', 'guard/expo-install'],
  ['npm install lodash', 'guard/expo-install'],
  ['npm i --save-dev lodash', 'guard/expo-install'],
  ['npm i -g nodemon', 'guard/expo-install'],
  ['yarn add lodash', 'guard/expo-install'],
  ['bun add lodash', 'guard/expo-install'],
  ['pnpm build && pnpm add lodash', 'guard/expo-install'],

  ['rm src/app/x.test.ts', 'guard/keep-tests'],
  ['rm src/app/x.test.tsx', 'guard/keep-tests'],
  ['rm -rf src/app/x.test.tsx', 'guard/keep-tests'],
  ['rm b.test.ts', 'guard/keep-tests'],
  ['git rm --cached src/app/x.test.ts', 'guard/keep-tests'],
  ['git rm -r src/app/x.test.tsx', 'guard/keep-tests'],
  ['cat f | rm src/app/x.test.ts', 'guard/keep-tests'],
  ['pnpm install --frozen-lockfile\nrm src/app/x.test.ts', 'guard/keep-tests'],
];

const ALLOWED = [
  'pnpm install',
  'pnpm install --frozen-lockfile',
  'pnpm i',
  'pnpm i --frozen-lockfile',
  'pnpm install --filter web',
  'pnpm install --frozen-lockfile > /dev/null',
  'npm install',
  'npm install --frozen-lockfile',
  'npm ci',
  'npx expo install foo',
  'npx expo install expo-image',
  'pnpm exec expo install foo',
  'git commit -m "fix -n flag"',
  'git commit -am "mention --no-verify in the message"',
  'git commit -m "ship it"',
  'git push',
  'git push origin main',
  'git push -u origin main',
  'rm src/foo.ts',
  'rm -rf dist',
  'git rm -r --cached x',
  'echo "expo eject"',
  'pnpm install --frozen-lockfile && npx expo install expo-image',
  '',
];

test('checkBash blocks every blocked row', () => {
  for (const [command, rule] of BLOCKED) {
    const verdict = checkBash(command);
    assert.ok(verdict, `expected a block for: ${command}`);
    assert.ok(verdict.startsWith(`${rule}: `), `${command} blocked as: ${verdict}`);
  }
});

test('checkBash allows every allowed row', () => {
  for (const command of ALLOWED) {
    assert.equal(checkBash(command), null, `blocked an allowed command: ${command}`);
  }
});

test('checkBash ignores non-string input', () => {
  assert.equal(checkBash(null), null);
  assert.equal(checkBash(undefined), null);
});

// ───────────────────────── checkEdit ─────────────────────────
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
fs.mkdirSync(path.join(root, 'ios'), { recursive: true });
fs.writeFileSync(path.join(root, 'legacy.ts'), `const a = 1; ${BAD_NEXT}\n`);

test('checkEdit blocks paths under the generated native trees', () => {
  const rules = /rn-native-deps\/no-native-edits: ios\/ and android\/ are generated/;
  assert.match(checkEdit('Write', { file_path: `${root}/ios/Podfile`, content: 'x' }, root), rules);
  assert.match(checkEdit('Write', { file_path: `${root}/android/build.gradle`, content: 'x' }, root), rules);
  assert.match(checkEdit('Edit', { file_path: `${root}/ios/App/Info.plist`, old_string: 'a', new_string: 'b' }, root), rules);
  assert.match(checkEdit('MultiEdit', { file_path: `${root}/android/x.gradle`, edits: [{ old_string: 'a', new_string: 'b' }] }, root), rules);
  assert.match(checkEdit('Write', { file_path: `${root}/ios`, content: 'x' }, root), rules);
});

test('checkEdit allows ordinary paths', () => {
  assert.equal(checkEdit('Write', { file_path: `${root}/src/app/index.tsx`, content: 'x' }, root), null);
  assert.equal(checkEdit('Edit', { file_path: 'src/shared/use-notes.ts', old_string: 'a', new_string: 'b' }, root), null);
  assert.equal(checkEdit('Write', { file_path: `${root}/ios.md`, content: 'x' }, root), null); // name, not directory
  assert.equal(checkEdit('Edit', { file_path: `${root}/../outside.ts`, old_string: 'a', new_string: 'b' }, root), null); // outside the repo
  assert.equal(checkEdit('Grep', { file_path: `${root}/src/readme.ts`, old_string: 'a', new_string: 'b' }, root), null); // not an edit tool
});

test('checkEdit blocks newly added eslint-disable without a reason', () => {
  const file = `${root}/src/a.ts`;
  assert.equal(checkEdit('Edit', { file_path: file, old_string: 'a', new_string: `const x = 1; ${BAD_NEXT}` }, root), EMSG);
  assert.equal(checkEdit('Write', { file_path: file, content: `${BAD_NEXT}\nconst y = 2;\n` }, root), EMSG);
  // MultiEdit: one bad edit is enough, even after a clean one.
  assert.equal(checkEdit('MultiEdit', { file_path: file, edits: [{ old_string: 'x', new_string: 'y' }, { old_string: 'p', new_string: `q ${BAD_BLOCK}` }] }, root), EMSG);
  // `--` dangling with nothing after it is not a reason.
  assert.equal(checkEdit('Edit', { file_path: file, old_string: 'a', new_string: BAD_DASH }, root), EMSG);
});

test('checkEdit allows eslint-disable with a reason or already present in the old text', () => {
  const file = `${root}/src/a.ts`;
  assert.equal(checkEdit('Edit', { file_path: file, old_string: 'a', new_string: `const n = 1; ${OK_NEXT}` }, root), null);
  assert.equal(checkEdit('Edit', { file_path: file, old_string: BAD_NEXT, new_string: BAD_NEXT }, root), null);
  assert.equal(checkEdit('MultiEdit', { file_path: file, edits: [{ old_string: BAD_NEXT, new_string: BAD_NEXT }, { old_string: 'p', new_string: `q = ${OK_NEXT}` }] }, root), null);
  // Write over a file that already carries the comment: pre-existing, not newly added.
  assert.equal(checkEdit('Write', { file_path: `${root}/legacy.ts`, content: `const a = 2; ${BAD_NEXT}\n` }, root), null);
  // An edited marker that still lacks a reason is treated as newly added, so it is blocked.
  assert.equal(checkEdit('Edit', { file_path: file, old_string: BAD_NEXT, new_string: `${BAD_NEXT} more` }, root), EMSG);
});

test('checkEdit enforces design-ignore reasons', () => {
  const file = `${root}/src/a.ts`;
  assert.equal(checkEdit('Edit', { file_path: file, old_string: 'a', new_string: `const x = 1; ${BAD_DESIGN}` }, root), DMSG);
  assert.equal(checkEdit('Write', { file_path: file, content: `${DI}\n` }, root), DMSG);
  assert.equal(checkEdit('Edit', { file_path: file, old_string: 'a', new_string: `x; ${DI} no colon` }, root), DMSG);
  assert.equal(checkEdit('Edit', { file_path: file, old_string: 'a', new_string: OK_DESIGN }, root), null);
  assert.equal(checkEdit('Edit', { file_path: file, old_string: BAD_DESIGN, new_string: BAD_DESIGN }, root), null);
  // An edited marker that still lacks a reason is treated as newly added, so it is blocked.
  assert.equal(checkEdit('Edit', { file_path: file, old_string: BAD_DESIGN, new_string: `${BAD_DESIGN} moved` }, root), DMSG);
});

test('checkEdit checks comment text only in code files', () => {
  assert.equal(checkEdit('Write', { file_path: `${root}/docs/a.md`, content: `use ${BAD_NEXT} here` }, root), null);
  assert.equal(checkEdit('Write', { file_path: `${root}/README.md`, content: `<!-- ${BAD_DESIGN} -->` }, root), null);
});

test('checkEdit allows missing tool input fields', () => {
  assert.equal(checkEdit('Write', { file_path: `${root}/src/b.ts` }, root), null); // no content
  assert.equal(checkEdit('MultiEdit', { file_path: `${root}/src/b.ts` }, root), null); // no edits
  assert.equal(checkEdit('Write', {}, root), null); // no file_path
  assert.equal(checkEdit('Write', null, root), null);
});
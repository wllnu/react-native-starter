#!/usr/bin/env node
// PreToolUse hook for Bash: blocks the commands this repo forbids before they run.
//
// Reads the hook JSON on stdin. A block writes one line to stderr as `rule-id: message` and exits 2;
// clean or unparseable input allows silently with exit 0. The decision lives in checkBash() so unit
// tests can call it directly. Blocks: expo eject, git commit --no-verify, git push --force, package
// installs that bypass `npx expo install`, rm/git rm of *.test.ts(x), and any command naming a .env*
// file. Node 18+, built-ins only.

import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { ENV_READ, isEnvPath } from './pre-read.mjs';

const CNG = ['rn-native-deps/no-native-edits', 'ios/ and android/ are generated (CNG). Put native config in app.config.ts or a config plugin.'];
const NO_VERIFY = ['guard/no-verify', "don't skip the pre-commit hook. Fix what pnpm verify reports."];
const NO_FORCE_PUSH = ['guard/no-force-push', 'force-push rewrites shared history. Ask the user.'];
const EXPO_INSTALL = ['guard/expo-install', 'add packages with npx expo install <pkg>, it picks SDK-compatible versions.'];
const KEEP_TESTS = ['guard/keep-tests', "don't delete tests. Fix the code or the test."];

const RUNNERS = new Set(['npx', 'npm', 'pnpm', 'yarn', 'bun', 'bunx']);
const RUNNER_SUBS = new Set(['exec', 'dlx', 'run']);
const PM_SUBS = { pnpm: ['add', 'install', 'i', 'in'], npm: ['add', 'install', 'i', 'in'], yarn: ['add'], bun: ['add'] };
// Flags that swallow the next token as their value (pnpm --filter web keeps a bare install legal).
const VALUE_FLAGS = new Set(['--filter', '--dir', '-C', '--prefix', '--registry', '--tag']);
const REDIRECT_OP = /^[0-9]{0,2}[<>]{1,2}(&[0-9]+)?$/; // >, 2>, >&1, 2>&1 — the target follows
const TEST_PATH = /\.test\.tsx?$/;

// One segment per `&&`, `||`, `;`, `|` or newline outside of quotes; quotes are kept for the tokenizer.
function segments(command) {
  const parts = [];
  let part = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      part += c;
      if (c === '\\' && i + 1 < command.length) { part += command[i + 1]; i++; }
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      part += c;
    } else if (c === '&' || c === '|' || c === ';' || c === '\n') {
      parts.push(part);
      part = '';
      if ((c === '&' || c === '|') && command[i + 1] === c) i++;
    } else {
      part += c;
    }
  }
  parts.push(part);
  return parts;
}

// Shell-ish tokenizer: honours single and double quotes and a backslash escape, nothing else.
function tokenize(part) {
  const tokens = [];
  let token = '';
  let quote = null;
  let open = false;
  for (let i = 0; i < part.length; i++) {
    const c = part[i];
    if (quote) {
      if (c === '\\' && i + 1 < part.length) { token += part[i + 1]; i++; }
      else if (c === quote) quote = null;
      else token += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      open = true;
    } else if (c === '\\') {
      token += part[i + 1] || '';
      i++;
      open = true;
    } else if (/\s/.test(c)) {
      if (open) { tokens.push(token); token = ''; open = false; }
    } else {
      token += c;
      open = true;
    }
  }
  if (open) tokens.push(token);
  return tokens;
}

// Index of the program token, past one package runner, its flags and its exec-style subcommand, so
// `npx expo eject`, `pnpm exec expo eject` and plain `expo eject` all reach the same check.
function programIndex(tokens) {
  let i = 0;
  if (RUNNERS.has(tokens[0])) {
    i = 1;
    while (i < tokens.length && tokens[i].startsWith('-')) i++;
    if (RUNNER_SUBS.has(tokens[i])) i++;
  }
  return i;
}

// `expo eject` fights CNG: ios/ and android/ are generated, native config belongs in app.config.ts.
function checkExpoEject(tokens) {
  const p = programIndex(tokens);
  return tokens[p] === 'expo' && tokens[p + 1] === 'eject' ? CNG : null;
}

// `--no-verify` or a short flag containing an `n` after `git commit` skips the pre-commit hook.
function checkNoVerify(tokens) {
  const p = programIndex(tokens);
  if (tokens[p] !== 'git' || tokens[p + 1] !== 'commit') return null;
  const flags = tokens.slice(p + 2).filter((t) => t.startsWith('-'));
  return flags.some((t) => t === '--no-verify' || /^-[a-z]*n[a-z]*$/i.test(t)) ? NO_VERIFY : null;
}

// `--force*` or a short flag containing an `f` after `git push` rewrites shared history.
function checkForcePush(tokens) {
  const p = programIndex(tokens);
  if (tokens[p] !== 'git' || tokens[p + 1] !== 'push') return null;
  const flags = tokens.slice(p + 2).filter((t) => t.startsWith('-'));
  return flags.some((t) => t.startsWith('--force') || /^-[a-z]*f[a-z]*$/i.test(t)) ? NO_FORCE_PUSH : null;
}

// Package adds outside `npx expo install`: `add` always, `install`/`i` only with a package argument.
function checkExpoInstall(tokens) {
  const subs = PM_SUBS[tokens[0]];
  if (!subs) return null;
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    i += VALUE_FLAGS.has(tokens[i]) ? 2 : 1;
  }
  const sub = tokens[i];
  if (!subs.includes(sub)) return null;
  if (sub === 'add') return EXPO_INSTALL;
  for (let j = i + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (!t.startsWith('-')) {
      if (REDIRECT_OP.test(t)) { j++; continue; } // the redirect target follows as its own token
      if (/[<>]/.test(t)) continue; // op and target glued together, e.g. >log
      return EXPO_INSTALL;
    }
    if (VALUE_FLAGS.has(t)) j++;
  }
  return null;
}

// `rm` or `git rm` whose arguments name a *.test.ts(x) file would break the guardrails' own tests.
function checkKeepTests(tokens) {
  const from = tokens[0] === 'rm' ? 1 : tokens[0] === 'git' && tokens[1] === 'rm' ? 2 : -1;
  if (from < 0) return null;
  return tokens.slice(from).some((t) => !t.startsWith('-') && TEST_PATH.test(t)) ? KEEP_TESTS : null;
}

// Any program can read a file (cat, source, grep, node --env-file=), so every argument naming a .env*
// file blocks: the part after a `=` or `<`, as in --env-file=.env and $(<.env). Arguments with spaces
// are prose (a commit message), not paths.
// lazy: string-level, so `cat .e""nv` or a variable holding the path gets through. Upgrade: a sandbox
// that denies the files themselves.
function checkEnvRead(tokens) {
  return tokens.some((t) => !/\s/.test(t) && isEnvPath(t.split(/[=<]/).pop())) ? ENV_READ : null;
}

const CHECKS = [checkExpoInstall, checkExpoEject, checkNoVerify, checkForcePush, checkKeepTests, checkEnvRead];

// The decision: one stderr line for the first violated rule in the command, or null to allow.
export function checkBash(command) {
  if (typeof command !== 'string') return null;
  for (const part of segments(command)) {
    const tokens = tokenize(part);
    if (!tokens.length) continue;
    for (const check of CHECKS) {
      const hit = check(tokens);
      if (hit) return `${hit[0]}: ${hit[1]}`;
    }
  }
  return null;
}

function main() {
  let hook;
  try {
    hook = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return 0; // a hook cannot judge input it cannot parse; allow
  }
  const command = hook && hook.tool_input && hook.tool_input.command;
  const verdict = typeof command === 'string' ? checkBash(command) : null;
  if (!verdict) return 0;
  fs.writeSync(2, `${verdict}\n`);
  return 2;
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) process.exit(main());
#!/usr/bin/env node
// PreToolUse hook for Read/Grep: blocks reads of .env* files, which hold secrets.
//
// Reads the hook JSON on stdin. A block writes one line to stderr as `rule-id: message` and exits 2;
// clean or unparseable input allows silently with exit 0. The decision lives in checkRead() so unit
// tests can call it directly. pre-bash.mjs uses isEnvPath() to block the same files in shell
// commands. .env.example is allowed: it is committed and holds variable names, not values.
// Node 18+, built-ins only.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ENV_READ = ['guard/no-env-read', '.env files hold secrets. Read .env.example for the variable names, or ask the user.'];
const MESSAGE = ENV_READ.join(': ');

// True when the last path segment starts with .env (.env, .env.local, .envrc, a .env* glob), except .env.example.
export function isEnvPath(p) {
  if (typeof p !== 'string') return false;
  const base = p.split(/[\\/]/).pop();
  return base.startsWith('.env') && base !== '.env.example';
}

// The decision: the stderr line, or null to allow. Read names one file; Grep can name one as its
// path or select them with its glob.
// lazy: a Grep over a whole directory still searches .env unless .gitignore hides it. Upgrade: block
// a Grep without a glob whose path contains a non-ignored .env file.
export function checkRead(toolName, toolInput) {
  if (!toolInput) return null;
  if (toolName === 'Read') return isEnvPath(toolInput.file_path) ? MESSAGE : null;
  if (toolName === 'Grep') return isEnvPath(toolInput.path) || isEnvPath(toolInput.glob) ? MESSAGE : null;
  return null;
}

function main() {
  let hook;
  try {
    hook = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return 0; // a hook cannot judge input it cannot parse; allow
  }
  const verdict = hook ? checkRead(hook.tool_name, hook.tool_input) : null;
  if (!verdict) return 0;
  fs.writeSync(2, `${verdict}\n`);
  return 2;
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) process.exit(main());

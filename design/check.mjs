#!/usr/bin/env node
// design-check: one design-system verifier for web and React Native. Node 18+, no dependencies.
// Reads the tokens and `checks` settings straight from DESIGN.md front matter.
//
//   node design/check.mjs                 check lines added since HEAD (staged, unstaged, untracked)
//   node design/check.mjs --base main     check lines added since branching from main (PR review)
//   node design/check.mjs src/a.tsx ...   check whole files
//   node design/check.mjs build           validate DESIGN.md, regenerate design/theme.css + design/tokens.ts
//   node design/check.mjs extract x.html  summarise a prototype's raw values (used when writing DESIGN.md)
//
// Options: --design <path> (default DESIGN.md), --json, --max <n> (default 40 lines of output).
// A deliberate exception: put `design-ignore` in a comment on that line, with a reason.
// Exit code 1 when problems are found (warnings only if `checks.strict: false`).

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a, i) => !a.startsWith('--') && !['--design', '--base', '--max', '--out'].includes(argv[i - 1]));
const cmd = ['build', 'extract', 'check'].includes(positional[0]) ? positional.shift() : 'check';
const designPath = opt('--design', 'DESIGN.md');
const maxLines = Number(opt('--max', 40));

// ───────────────────────── tiny YAML (front-matter subset) ─────────────────────────
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}
function scalar(s) {
  s = s.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'")) return s.slice(1, -1);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
function flow(src) {
  let i = 0;
  const ws = () => { while (/\s/.test(src[i] || '')) i++; };
  const atom = (stops) => {
    ws();
    if (src[i] === '"' || src[i] === "'") { const q = src[i++]; const st = i; while (i < src.length && src[i] !== q) i++; return src.slice(st, i++); }
    let depth = 0; const st = i;
    while (i < src.length) { const c = src[i]; if (c === '(') depth++; else if (c === ')') depth--; else if (!depth && stops.includes(c)) break; i++; }
    return scalar(src.slice(st, i));
  };
  const value = (stops) => { ws(); if (src[i] === '{') return obj(); if (src[i] === '[') return arr(); return atom(stops); };
  function obj() { i++; const o = {}; for (;;) { ws(); if (src[i] === '}') { i++; return o; } const k = String(atom(':')); ws(); i++; o[k] = value(',}'); ws(); if (src[i] === ',') i++; } }
  function arr() { i++; const a = []; for (;;) { ws(); if (src[i] === ']') { i++; return a; } a.push(value(',]')); ws(); if (src[i] === ',') i++; } }
  return value('');
}
function parseYaml(text) {
  const lines = text.split('\n').map((raw) => stripComment(raw).replace(/\s+$/, '')).filter((l) => l.trim())
    .map((l) => ({ ind: l.match(/^ */)[0].length, t: l.trim() }));
  let p = 0;
  function block(ind) {
    if (lines[p].t.startsWith('- ')) {
      const a = [];
      while (p < lines.length && lines[p].ind === ind && lines[p].t.startsWith('- ')) { const v = lines[p++].t.slice(2); a.push(/^[{[]/.test(v) ? flow(v) : scalar(v)); }
      return a;
    }
    const o = {};
    while (p < lines.length && lines[p].ind === ind) {
      const { t } = lines[p++];
      const m = t.match(/^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*))?$/);
      if (!m) continue;
      const key = String(scalar(m[1])); const rest = (m[2] || '').trim();
      if (rest) o[key] = /^[{[]/.test(rest) ? flow(rest) : scalar(rest);
      else o[key] = p < lines.length && lines[p].ind > ind ? block(lines[p].ind) : null;
    }
    return o;
  }
  return lines.length ? block(lines[0].ind) : {};
}
function readDesign(file) {
  if (!fs.existsSync(file)) die(`${file} not found. Run from the repo root or pass --design <path>.`);
  const m = fs.readFileSync(file, 'utf8').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) die(`${file}: no YAML front matter (--- fences at the top).`);
  return { data: parseYaml(m[1]), body: m[2] };
}
function die(msg) { console.error(msg); process.exit(2); }

// ───────────────────────── values ─────────────────────────
const toPx = (v, fs = 16) => {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').trim().match(/^(-?[\d.]+)(px|rem|em|pt)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return { px: n, rem: n * 16, em: n * fs, pt: (n * 96) / 72 }[m[2] || 'px'];
};
const normHex = (h) => {
  let x = String(h).toLowerCase().replace('#', '');
  if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join('');
  if (x.length === 8 && x.endsWith('ff')) x = x.slice(0, 6);
  return /^[0-9a-f]{6}([0-9a-f]{2})?$/.test(x) ? '#' + x : null;
};
const rgbToHex = (s) => {
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/i);
  if (!m) return null;
  const h = (n) => Math.round(Math.min(255, Number(n))).toString(16).padStart(2, '0');
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
  return '#' + h(m[1]) + h(m[2]) + h(m[3]) + (a < 1 ? h(a * 255) : '');
};
const toHex = (lit) => (lit.startsWith('#') ? normHex(lit) : rgbToHex(lit));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

function system(data) {
  const colors = data.colors || {};
  const themes = data.themes || {};
  const all = [colors, ...Object.values(themes)].flatMap((o) => Object.values(o || {})).map((c) => normHex(c)).filter(Boolean);
  const typo = data.typography || {};
  const nums = (o) => Object.values(o || {}).map((v) => toPx(v)).filter((v) => v !== null);
  const fams = Object.values(typo).map((t) => String(t?.fontFamily || '').toLowerCase()).filter(Boolean);
  const nativeFams = Object.values(data.platforms?.native?.fontFamilies || {}).map((f) => String(f).toLowerCase());
  const c = data.checks || {};
  return {
    palette: new Set(all),
    palette6: new Set(all.map((h) => h.slice(0, 7))),
    fontSizes: new Set(Object.values(typo).map((t) => toPx(t?.fontSize)).filter((v) => v !== null)),
    families: new Set([...fams, ...nativeFams, 'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'arial', 'sans-serif', 'serif', 'monospace', 'system', 'ui-sans-serif', 'ui-monospace', 'inherit']),
    spacing: new Set([0, 1, 2, ...nums(data.spacing)]),
    radii: new Set([0, 9999, ...nums(data.rounded)]),
    touchMin: toPx(data.sizes?.['touch-min']) || 44,
    banned: new Set(c.banned || []),
    allowShadowIn: c.allowShadowIn || [],
    include: c.include || [],
    exclude: [...(c.exclude || []), 'design/**', '**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.stories.*', '**/*.d.ts'],
    strict: c.strict !== false,
  };
}

function globRe(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') { if (g[i + 1] === '*') { i++; if (g[i + 1] === '/') { re += '(?:.*/)?'; i++; } else re += '.*'; } else re += '[^/]*'; }
    else if (c === '?') re += '[^/]';
    else if (c === '{') { const e = g.indexOf('}', i); re += '(?:' + g.slice(i + 1, e).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')'; i = e; }
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

// ───────────────────────── check ─────────────────────────
const HINT = {
  color: 'not in the palette → use a colour token',
  'raw-color': 'is a token value → reference the token, not the hex',
  'font-size': 'is not a type role size → use a type role',
  'font-family': 'is not a design font',
  spacing: 'is off the spacing scale',
  radius: 'is not a radius token',
  arbitrary: 'arbitrary Tailwind value → use a token utility',
  'touch-target': 'tap target below minimum',
  gradient: 'gradient (banned in DESIGN.md)',
  glass: 'backdrop blur/glass (banned in DESIGN.md)',
  'box-shadow': 'shadow (banned outside overlays)',
  'uppercase-tracking': 'all-caps text (banned)',
  'em-dash': 'em dash in UI copy (banned)',
  'emoji-in-ui': 'emoji in UI (banned)',
  'inline-style-web': 'inline style object on web (banned)',
  important: '!important (banned)',
};
const SCANNABLE = /\.(css|scss|less|tsx|jsx|ts|js|mjs|html|vue|svelte|astro)$/;
const COLOR_LIT = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const CSS_SPACE = /^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(gap|row-gap|column-gap)$/;
const RN_SPACE = /^(margin|padding)(Top|Right|Bottom|Left|Horizontal|Vertical|Start|End)?$|^(gap|rowGap|columnGap)$/;
const INTERACTIVE = /button|btn|press|touch|tap|row|tab|chip|input|field|toggle|switch|link|action/i;

function git(args) { return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); }

function collectTargets(sys) {
  const inc = sys.include.map(globRe), exc = sys.exclude.map(globRe);
  const keep = (f) => SCANNABLE.test(f) && !exc.some((r) => r.test(f)) && (!inc.length || inc.some((r) => r.test(f)));
  if (positional.length) return positional.filter((f) => fs.existsSync(f)).map((f) => ({ file: f.split(path.sep).join('/'), lines: null }));
  let root;
  try { root = git('rev-parse --show-toplevel').trim(); } catch { die('Not a git repository. Pass files to check, e.g. node design/check.mjs src/**/*.tsx'); }
  const rel = (f) => path.relative(process.cwd(), path.join(root, f)).split(path.sep).join('/');
  const targets = new Map();
  let from = 'HEAD';
  const base = opt('--base');
  try {
    if (base) from = git(`merge-base ${base} HEAD`).trim();
    else git('rev-parse --verify HEAD');
  } catch { from = null; }
  if (from) {
    const diff = git(`diff --no-color --no-ext-diff --unified=0 --diff-filter=AMR ${from}`);
    let cur = null;
    for (const l of diff.split('\n')) {
      if (l.startsWith('+++ ')) { const f = l.slice(4).replace(/^b\//, ''); cur = f !== '/dev/null' && keep(f) ? f : null; if (cur && !targets.has(cur)) targets.set(cur, new Set()); }
      else if (cur && l.startsWith('@@')) { const m = l.match(/\+(\d+)(?:,(\d+))?/); const s = Number(m[1]), n = m[2] === undefined ? 1 : Number(m[2]); for (let k = 0; k < n; k++) targets.get(cur).add(s + k); }
    }
  }
  const untracked = from ? git('ls-files --others --exclude-standard') : git('ls-files --cached --others --exclude-standard');
  for (const f of untracked.split('\n').filter(Boolean)) if (keep(f)) targets.set(f, null);
  return [...targets].filter(([, s]) => s === null || s.size).map(([f, s]) => ({ file: rel(f), lines: s }));
}

function checkFile(file, onlyLines, sys, out) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return 0; }
  const lines = src.split('\n');
  const isCss = /\.(css|scss|less)$/.test(file);
  const isScript = /\.(tsx|jsx|ts|js|mjs)$/.test(file);
  const native = /from ['"]react-native['"]|StyleSheet\.create/.test(src);
  const shadowOk = sys.allowShadowIn.some((g) => globRe(g).test(file));
  let n = 0;
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (onlyLines && !onlyLines.has(ln)) return;
    n++;
    if (line.includes('design-ignore')) return;
    const trimmed = line.trim();
    if (!isCss && /^(\/\/|\*|\/\*)/.test(trimmed)) return;
    if (isCss && /^(\/\*|\*)/.test(trimmed)) return;
    const hit = (rule, val) => out.push({ file, line: ln, rule, val });

    for (const lit of line.match(COLOR_LIT) || []) {
      if (lit.startsWith('#') && !/color|background|fill|stroke|border|shadow|bg-|text-|#[0-9a-f]{3,8}['"`]/i.test(line)) continue; // anchors, ids
      const hex = toHex(lit);
      if (!hex || hex === '#00000000') continue;
      hit(sys.palette.has(hex) || (hex.length === 9 && sys.palette6.has(hex.slice(0, 7))) ? 'raw-color' : 'color', lit);
    }
    const ban = (id, re) => { if (sys.banned.has(id) && re.test(line) && !(id === 'box-shadow' && shadowOk)) hit(id, ''); };
    ban('gradient', /(linear|radial|conic)-gradient|LinearGradient|bg-gradient-to-|bg-linear-/);
    ban('glass', /backdrop-filter|backdrop-blur|BlurView/);
    ban('box-shadow', /box-shadow\s*:|shadowColor|shadowOpacity|\bshadow-(sm|md|lg|xl|2xl)\b|boxShadow/);
    ban('uppercase-tracking', /text-transform\s*:\s*uppercase|textTransform\s*:\s*['"]uppercase|\buppercase\b/);
    ban('important', /!important/);
    ban('em-dash', /—/);
    ban('emoji-in-ui', EMOJI);
    if (!native) ban('inline-style-web', /style=\{\{/);

    if (!native) {
      for (const m of line.matchAll(/(?:^|[;{\s"'])([a-z-]+)\s*:\s*([^;{}"']+)/g)) {
        const [, prop, val] = m;
        if (prop === 'font-size') { const px = toPx(val.trim()); if (px !== null && sys.fontSizes.size && !sys.fontSizes.has(px)) hit('font-size', val.trim()); }
        else if (CSS_SPACE.test(prop)) { for (const p of val.trim().split(/\s+/)) { const px = toPx(p); if (px !== null && !sys.spacing.has(Math.abs(px))) hit('spacing', `${prop} ${p}`); } }
        else if (/radius$/.test(prop)) { for (const p of val.trim().split(/\s+/)) { const px = toPx(p); if (px !== null && !sys.radii.has(px)) hit('radius', p); } }
        else if (prop === 'font-family') { const f = val.split(',')[0].replace(/["']/g, '').trim().toLowerCase(); if (f && !f.startsWith('var(') && !sys.families.has(f)) hit('font-family', f); }
      }
      for (const m of line.matchAll(/\b(?:text|bg|border|p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|space-[xy]|rounded(?:-[a-z]+)?|leading|tracking|shadow|font)-\[([^\]]+)\]/g)) hit('arbitrary', m[0]);
    }
    if (native || isScript) {
      for (const m of line.matchAll(/\b([a-zA-Z]+)\s*:\s*(-?\d+(?:\.\d+)?)\b(?!\s*[%*/+-])/g)) {
        const prop = m[1], v = Number(m[2]);
        if (prop === 'fontSize' && sys.fontSizes.size && !sys.fontSizes.has(v)) hit('font-size', v);
        else if (RN_SPACE.test(prop) && !sys.spacing.has(Math.abs(v))) hit('spacing', `${prop} ${v}`);
        else if (/Radius$/.test(prop) && !sys.radii.has(v)) hit('radius', v);
        else if ((prop === 'height' || prop === 'minHeight') && v > 2 && v < sys.touchMin) {
          let owner = null;
          for (let k = idx; k >= Math.max(0, idx - 12) && !owner; k--) { const mm = lines[k].slice(0, k === idx ? line.indexOf(prop) : undefined).match(/([\w$]+)\s*:\s*\{[^{}]*$/); if (mm) owner = mm[1]; }
          if (owner && INTERACTIVE.test(owner)) hit('touch-target', `${owner}.${prop} ${v} < ${sys.touchMin}`);
        }
      }
      const fm = line.match(/fontFamily\s*:\s*['"]([^'"]+)['"]/);
      if (fm && !sys.families.has(fm[1].toLowerCase())) hit('font-family', fm[1]);
    }
  });
  return n;
}

function runCheck() {
  const { data } = readDesign(designPath);
  const sys = system(data);
  const targets = collectTargets(sys);
  const out = [];
  let linesChecked = 0;
  for (const t of targets) linesChecked += checkFile(t.file, t.lines, sys, out);
  const level = sys.strict ? 'error' : 'warn';
  if (flags.has('--json')) { console.log(JSON.stringify({ files: targets.length, lines: linesChecked, problems: out.map((o) => ({ ...o, hint: HINT[o.rule] })) })); }
  else {
    const scope = positional.length ? 'files' : opt('--base') ? `diff vs ${opt('--base')}` : 'diff vs HEAD';
    if (!out.length) console.log(`design-check ✓ ${targets.length} file(s), ${linesChecked} line(s) (${scope})`);
    else {
      for (const o of out.slice(0, maxLines)) console.log(`${o.file}:${o.line}  ${o.rule}  ${o.val !== '' ? o.val + ' ' : ''}${HINT[o.rule]}`);
      if (out.length > maxLines) console.log(`… ${out.length - maxLines} more (use --max)`);
      console.log(`design-check ✗ ${out.length} ${level}(s) in ${new Set(out.map((o) => o.file)).size} file(s) (${scope}). Fix them, or mark a deliberate exception with a \`design-ignore: <reason>\` comment.`);
    }
  }
  process.exit(out.length && sys.strict ? 1 : 0);
}

// ───────────────────────── build ─────────────────────────
function runBuild() {
  const { data, body } = readDesign(designPath);
  const problems = [];
  const warn = (m) => problems.push(m);
  if (!data.colors) warn('error: no `colors` in front matter');
  if (!data.typography) warn('error: no `typography` in front matter');
  const colors = {};
  for (const [k, v] of Object.entries(data.colors || {})) { const h = normHex(v); if (!h) warn(`error: colors.${k} = ${v} must be hex (#RRGGBB), so it works on web and React Native`); colors[k] = h || String(v); }
  const themes = {};
  for (const [t, vals] of Object.entries(data.themes || {})) {
    themes[t] = { ...colors };
    for (const [k, v] of Object.entries(vals || {})) { const h = normHex(v); if (!h) warn(`error: themes.${t}.${k} must be hex`); if (!(k in colors)) warn(`warn: themes.${t}.${k} has no light colour`); themes[t][k] = h || String(v); }
  }
  const resolve = (v, d = 0) => { const m = typeof v === 'string' && v.match(/^\{([\w.-]+)\}$/); if (!m || d > 6) return v; let n = data; for (const p of m[1].split('.')) { if (n == null || !(p in n)) { warn(`error: broken reference ${v}`); return v; } n = n[p]; } return resolve(n, d + 1); };
  const typo = {};
  for (const [role, s] of Object.entries(data.typography || {})) {
    const fs = toPx(s?.fontSize) ?? 16;
    let lh = s?.lineHeight ?? 1.4; lh = typeof lh === 'number' ? (lh < 4 ? lh : lh / fs) : (toPx(lh, fs) ?? fs * 1.4) / fs;
    const ls = s?.letterSpacing != null ? toPx(s.letterSpacing, fs) ?? 0 : 0;
    typo[role] = { family: String(s?.fontFamily || 'System'), size: fs, weight: Number(s?.fontWeight || 400), lh: Math.round(lh * 100) / 100, lhPx: Math.round(fs * lh), lsPx: Math.round(ls * 100) / 100, lsEm: Math.round((ls / fs) * 1000) / 1000 };
  }
  const dims = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, toPx(v)]).filter(([, v]) => v !== null));
  const spacing = dims(data.spacing), rounded = dims(data.rounded), sizes = dims(data.sizes), bps = dims(data.breakpoints);
  const motion = Object.fromEntries(Object.entries(data.motion || {}).map(([k, v]) => { const m = String(v).match(/^([\d.]+)(ms|s)$/); return [k, m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : v]; }));
  for (const [k, v] of Object.entries(spacing)) if (v > 2 && v % 4) warn(`warn: spacing.${k} = ${v}px is off the 4px grid`);
  if (typo.body && typo.body.size < 16) warn(`warn: body text is ${typo.body.size}px; 16px is the usual minimum`);
  for (const [c, props] of Object.entries(data.components || {})) for (const v of Object.values(props || {})) resolve(v);
  // contrast of role pairs, light and each theme
  const check = (pal, label) => {
    const fg = ['ink', 'text', 'foreground', 'muted'].filter((k) => pal[k]), bg = ['canvas', 'background', 'surface'].filter((k) => pal[k]);
    for (const f of fg) for (const b of bg) { const r = contrast(pal[f], pal[b]); if (r < 4.5) warn(`warn: ${label} ${f} on ${b} is ${r.toFixed(2)}:1 (needs 4.5)`); }
    for (const k of Object.keys(pal)) if (k.startsWith('on-') && pal[k.slice(3)] && normHex(pal[k]) && normHex(pal[k.slice(3)])) { const r = contrast(pal[k], pal[k.slice(3)]); if (r < 4.5) warn(`warn: ${label} ${k} on ${k.slice(3)} is ${r.toFixed(2)}:1`); }
  };
  if (Object.values(colors).every(normHex)) check(colors, 'light');
  for (const [t, pal] of Object.entries(themes)) if (Object.values(pal).every(normHex)) check(pal, t);
  const known = Object.keys(HINT).filter((k) => !['color', 'raw-color', 'font-size', 'font-family', 'spacing', 'radius', 'arbitrary', 'touch-target'].includes(k));
  for (const b of data.checks?.banned || []) if (!known.includes(b)) warn(`warn: checks.banned "${b}" is unknown (known: ${known.join(', ')})`);
  const TAG = /^\/?(a|br|b|i|em|strong|code|kbd|span|div|p|ul|ol|li|img|svg|table|tr|td|th|button|input|label|details|summary)\b/i;
  for (const m of body.replace(/`[^`\n]*`/g, '').matchAll(/<([^<>\n!]{2,80})>/g)) if (!TAG.test(m[1])) warn(`error: unfilled placeholder <${m[1]}>`);
  for (const k of Object.keys(colors)) if (!new RegExp('`' + k.replace(/[-]/g, '\\-') + '`|\\b' + k + '\\b').test(body)) warn(`warn: colour \`${k}\` has no usage rule in the prose`);
  if (!/^##\s+Do'?s and Don'?ts/im.test(body)) warn("warn: no '## Do's and Don'ts' section");

  // outputs
  const dir = opt('--out', 'design');
  fs.mkdirSync(dir, { recursive: true });
  const P = '--ds-';
  const rem = (px) => (px ? `${Math.round((px / 16) * 10000) / 10000}rem` : '0');
  const css = ['/* Generated from DESIGN.md by `node design/check.mjs build`. Do not edit. */', ':root {'];
  for (const [k, v] of Object.entries(colors)) css.push(`  ${P}color-${k}: ${v};`);
  for (const [r, t] of Object.entries(typo)) css.push(`  ${P}font-${r}: ${/^system/i.test(t.family) ? 'system-ui' : `"${t.family}"`}, system-ui, sans-serif;`, `  ${P}text-${r}: ${rem(t.size)};`, `  ${P}leading-${r}: ${t.lh};`, `  ${P}weight-${r}: ${t.weight};`, `  ${P}tracking-${r}: ${t.lsEm}em;`);
  for (const [k, v] of Object.entries(spacing)) css.push(`  ${P}space-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(rounded)) css.push(`  ${P}radius-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(sizes)) css.push(`  ${P}size-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(motion)) css.push(`  ${P}motion-${k}: ${typeof v === 'number' ? v + 'ms' : v};`);
  css.push(themes.dark ? '  color-scheme: light dark;' : '  color-scheme: light;', '}');
  if (themes.dark) {
    const changed = Object.entries(themes.dark).filter(([k, v]) => colors[k] !== v).map(([k, v]) => `${P}color-${k}: ${v};`);
    css.push('', '@media (prefers-color-scheme: dark) {', '  :root:not([data-theme="light"]) {', ...changed.map((l) => '    ' + l), '  }', '}', '', ':root[data-theme="dark"] {', ...changed.map((l) => '  ' + l), '}');
  }
  css.push('', '@media (prefers-reduced-motion: reduce) {', '  :root {', ...Object.entries(motion).filter(([, v]) => typeof v === 'number').map(([k]) => `    ${P}motion-${k}: 0ms;`), '  }', '}');
  css.push('', '/* Tailwind v4: `@import "tailwindcss"; @import "./design/theme.css";` Only design tokens exist as utilities. */', '@theme inline {', '  --color-*: initial;', '  --font-*: initial;', '  --text-*: initial;', '  --radius-*: initial;');
  for (const k of Object.keys(colors)) css.push(`  --color-${k}: var(${P}color-${k});`);
  for (const r of Object.keys(typo)) css.push(`  --font-${r}: var(${P}font-${r});`, `  --text-${r}: var(${P}text-${r});`, `  --text-${r}--line-height: var(${P}leading-${r});`, `  --text-${r}--font-weight: var(${P}weight-${r});`, `  --text-${r}--letter-spacing: var(${P}tracking-${r});`);
  for (const k of Object.keys(spacing)) css.push(`  --spacing-${k}: var(${P}space-${k});`);
  for (const k of Object.keys(rounded)) css.push(`  --radius-${k}: var(${P}radius-${k});`);
  for (const [k, v] of Object.entries(bps)) css.push(`  --breakpoint-${k}: ${rem(v)};`);
  css.push('}', '');
  fs.writeFileSync(path.join(dir, 'theme.css'), css.join('\n'));

  const fam = data.platforms?.native?.fontFamilies || {};
  const nf = (t) => (/^system/i.test(t.family) ? 'System' : fam[`${t.family}:${t.weight}`] || fam[t.family] || t.family);
  const obj = (o, ind = '  ') => '{\n' + Object.entries(o).map(([k, v]) => `${ind}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${typeof v === 'object' ? obj(v, ind + '  ') : JSON.stringify(v)},`).join('\n') + '\n' + ind.slice(2) + '}';
  const rnTypo = Object.fromEntries(Object.entries(typo).map(([r, t]) => [r, { fontFamily: nf(t), fontSize: t.size, lineHeight: t.lhPx, fontWeight: String(t.weight), letterSpacing: t.lsPx }]));
  const ts = [
    '// Generated from DESIGN.md by `node design/check.mjs build`. Do not edit.',
    '// React Native / Expo: unitless numbers, hex colours, absolute line heights.',
    `export const colors = ${obj(colors)} as const;`,
    `export const darkColors = ${themes.dark ? obj(themes.dark) : 'colors'} as const;`,
    'export const themes = { light: colors, dark: darkColors } as const;',
    `export const spacing = ${obj(spacing)} as const;`,
    `export const radius = ${obj(rounded)} as const;`,
    `export const sizes = ${obj(sizes)} as const;`,
    `export const motion = ${obj(Object.fromEntries(Object.entries(motion).filter(([, v]) => typeof v === 'number')))} as const;`,
    `export const typography = ${obj(rnTypo)} as const;`,
    'export type ColorToken = keyof typeof colors;',
    'export type TypeRole = keyof typeof typography;',
    'export default { colors, darkColors, themes, spacing, radius, sizes, motion, typography };',
    '',
  ];
  fs.writeFileSync(path.join(dir, 'tokens.ts'), ts.join('\n'));

  for (const p of problems) console.log(p);
  const errs = problems.filter((p) => p.startsWith('error')).length;
  console.log(`build ${errs ? '✗' : '✓'} ${dir}/theme.css, ${dir}/tokens.ts · ${Object.keys(colors).length} colours, ${Object.keys(typo).length} type roles, ${Object.keys(spacing).length} spacing, ${Object.keys(rounded).length} radii · ${errs} error(s), ${problems.length - errs} warning(s)`);
  process.exit(errs ? 1 : 0);
}

// ───────────────────────── extract (prototype inventory) ─────────────────────────
function runExtract() {
  if (!positional.length) die('Usage: node check.mjs extract prototype.html [more.html]');
  let css = '', text = '', classes = [];
  for (const f of positional) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css += m[1] + '\n';
    for (const m of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)) { const p = path.join(path.dirname(f), m[1]); if (!/^https?:/.test(m[1]) && fs.existsSync(p)) css += fs.readFileSync(p, 'utf8') + '\n'; }
    for (const m of html.matchAll(/style=["']([^"']+)["']/gi)) css += `x{${m[1]}}\n`;
    for (const m of html.matchAll(/class=["']([^"']+)["']/gi)) classes.push(...m[1].split(/\s+/));
    text += html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  }
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) vars[m[1]] ??= m[2].trim();
  const res = (v, d = 0) => (d > 5 ? v : v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, n, fb) => res(vars[n] ?? fb ?? _, d + 1)));
  const count = () => new Map();
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const C = { color: count(), size: count(), family: count(), weight: count(), space: count(), radius: count(), shadow: count() };
  const flagsF = { gradient: 0, glass: 0, uppercase: 0, important: 0 };
  const pairs = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim(); const decls = {};
    for (const d of m[2].split(';')) { const i = d.indexOf(':'); if (i < 0) continue; const p = d.slice(0, i).trim().toLowerCase(); if (p.startsWith('--')) continue; decls[p] = res(d.slice(i + 1).trim()); }
    for (const [p, v] of Object.entries(decls)) {
      for (const lit of v.match(COLOR_LIT) || []) { const h = toHex(lit); if (h) inc(C.color, h); }
      if (/^(color|background(-color)?)$/.test(p) && /\b(white|black)\b/.test(v)) inc(C.color, v.includes('white') ? '#ffffff' : '#000000');
      if (p === 'font-size') { const px = toPx(v); if (px !== null) inc(C.size, px); }
      if (p === 'font-family') inc(C.family, v.split(',')[0].replace(/["']/g, '').trim());
      if (p === 'font-weight') inc(C.weight, v);
      if (CSS_SPACE.test(p)) for (const x of v.split(/\s+/)) { const px = toPx(x); if (px !== null) inc(C.space, px); }
      if (/radius$/.test(p)) for (const x of v.split(/\s+/)) { const px = toPx(x); if (px !== null) inc(C.radius, px); }
      if (p === 'box-shadow' && v !== 'none') inc(C.shadow, v.slice(0, 60));
      if (/gradient\(/.test(v)) flagsF.gradient++;
      if (/backdrop-filter/.test(p)) flagsF.glass++;
      if (p === 'text-transform' && v === 'uppercase') flagsF.uppercase++;
      if (/!important/.test(v)) flagsF.important++;
    }
    const fg = decls.color && (toHex((decls.color.match(COLOR_LIT) || [])[0] || '') || (decls.color === 'white' ? '#ffffff' : null));
    const bgv = decls['background-color'] || decls.background;
    const bg = bgv && !/gradient/.test(bgv) && (toHex((bgv.match(COLOR_LIT) || [])[0] || '') || (/\bwhite\b/.test(bgv) ? '#ffffff' : null));
    if (fg && bg && fg.length === 7 && bg.length === 7) { const r = contrast(fg, bg); const big = (toPx(decls['font-size'] || '') || 16) >= 24; if (r < (big ? 3 : 4.5)) pairs.push(`${sel} ${fg} on ${bg} = ${r.toFixed(2)}:1`); }
  }
  const sorted = (m) => [...m].sort((a, b) => (typeof a[0] === 'number' ? a[0] - b[0] : b[1] - a[1]));
  const fmt = (m) => sorted(m).map(([k, v]) => `${k}×${v}`).join('  ') || '-';
  // near-duplicate colours (simple RGB distance)
  const hexes = [...C.color.keys()].filter((h) => h.length === 7);
  const dupes = [];
  for (let i = 0; i < hexes.length; i++) for (let j = i + 1; j < hexes.length; j++) { const a = rgb(hexes[i]), b = rgb(hexes[j]); if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 12) dupes.push(`${hexes[i]}≈${hexes[j]}`); }
  const offGrid = [...C.space.keys()].filter((v) => v > 2 && v % 4);
  const hints = ['card', 'badge|pill|chip|tag', 'hero', 'modal|dialog|sheet', 'tab', 'stat|kpi|metric', 'eyebrow|kicker|overline', 'nav|sidebar|header'].map((h) => [h, classes.filter((c) => new RegExp(h, 'i').test(c)).length]).filter(([, n]) => n);
  console.log([
    `colours (${C.color.size}): ${sorted(C.color).map(([k, v]) => `${k}×${v}`).join('  ')}`,
    `near-duplicates: ${dupes.join('  ') || '-'}`,
    `font families: ${fmt(C.family)}`,
    `font sizes px: ${fmt(C.size)}`,
    `font weights: ${fmt(C.weight)}`,
    `spacing px: ${fmt(C.space)}${offGrid.length ? `   (off 4px grid: ${offGrid.join(', ')})` : ''}`,
    `radii px: ${fmt(C.radius)}`,
    `shadows: ${C.shadow.size}  gradients: ${flagsF.gradient}  glass: ${flagsF.glass}  uppercase rules: ${flagsF.uppercase}  !important: ${flagsF.important}`,
    `em dashes in copy: ${(text.match(/—/g) || []).length}  emoji: ${(text.match(new RegExp(EMOJI, 'gu')) || []).length}`,
    `contrast failures: ${pairs.join(' | ') || 'none found in declared pairs'}`,
    `css variables: ${Object.keys(vars).length}  dark mode query: ${/prefers-color-scheme:\s*dark/.test(css)}  breakpoints: ${[...new Set([...css.matchAll(/@media[^{]*?(min|max)-width:\s*([\d.]+)(px|em|rem)/g)].map((m) => m[1] + ' ' + m[2] + m[3]))].join(', ') || '-'}`,
    `class hints: ${hints.map(([h, n]) => `${h.split('|')[0]}×${n}`).join('  ') || '-'}${classes.filter((c) => /^(p|m|text|bg|gap|rounded)-/.test(c)).length > 20 ? '   (Tailwind classes: static values incomplete, look at the rendered page too)' : ''}`,
  ].join('\n'));
}

if (cmd === 'build') runBuild();
else if (cmd === 'extract') runExtract();
else runCheck();

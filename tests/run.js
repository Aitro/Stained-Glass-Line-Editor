#!/usr/bin/env node
// Regression test for Lead Line Leveler.
//
//   node tests/run.js                 run every case, compare with the approved result
//   node tests/run.js lily-9in hb     run only the named cases
//   node tests/run.js --approve NAME  save the current result of NAME as its new approved result
//   node tests/run.js --approve-all   save the current result of every case (after checking them!)
//
// The pattern files are kept on your own computer (they are not on GitHub); see the README.
// Each case in tests/cases/ is:
//   NAME.json         the settings: picture size, whether it is a colored pattern, the run options
//   NAME.gray.gz      the picture exactly as the page hands it to the worker (grayscale, one byte a pixel)
//   NAME.approved.gz  the lines of the approved result
// A case fails when any line moved more than the allowed distance (default 2.5 working pixels,
// about a sixth of a line width) from the approved result, or a line appeared or disappeared.
// For every failing case a picture is written to tests/out/NAME-diff.png: approved lines in gray,
// new lines in red, so you can see what changed.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CASES = path.join(__dirname, 'cases');
const OUT = path.join(__dirname, 'out');

// ---- the worker, assembled from src/worker/ the same way build.py does it
function workerSource() {
  const dir = path.join(ROOT, 'src', 'worker');
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    const cut = lines.slice(0, 6).findIndex(l => l.startsWith('// ---'));
    return cut >= 0 ? lines.slice(cut + 1).join('\n') : lines.join('\n');
  }).join('');
}

function runCase(src, c, gray) {
  const msgs = [];
  const ctx = { postMessage: m => msgs.push(m), Math, Date, console, Float64Array, Float32Array, Int32Array,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Array, Map, Set, Object, JSON, Number, String,
    Infinity, NaN, isFinite, Error };
  vm.createContext(ctx);
  vm.runInContext(src + ';this.__onm=onmessage;', ctx);
  ctx.__onm({ data: { type: 'load', id: 1, w: c.w, h: c.h, colored: !!c.colored, buf: new Uint8Array(gray).buffer } });
  const p = Object.assign({ auto: true, threshold: 128, invert: false, smooth: 1, exact: true, square: true }, c.params || {});
  ctx.__onm({ data: { type: 'run', id: 1, params: p } });
  const d = msgs.find(m => m.type === 'done') || msgs.find(m => m.type === 'error');
  if (!d) throw new Error('worker gave no result');
  if (d.type === 'error') throw new Error('worker error: ' + d.message);
  return { pts: Array.from(d.pts, v => Math.round(v * 100) / 100), offs: Array.from(d.offs), ms: d.ms };
}

const strokesOf = r => { const out = []; for (let i = 0; i + 1 < r.offs.length; i++) { const s = []; for (let k = r.offs[i]; k < r.offs[i + 1]; k++) s.push([r.pts[2 * k], r.pts[2 * k + 1]]); if (s.length > 1) out.push(s); } return out; };

// densely sampled points along every line, with a grid to find the nearest one quickly
function sampler(strokes) {
  const P = [];
  for (const s of strokes) for (let i = 1; i < s.length; i++) {
    const [ax, ay] = s[i - 1], [bx, by] = s[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5));
    for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
    if (i === s.length - 1) P.push([bx, by]);
  }
  const G = new Map(), C = 8, key = (x, y) => (Math.floor(x / C)) + ',' + (Math.floor(y / C));
  for (const p of P) { const k = key(p[0], p[1]); if (!G.has(k)) G.set(k, []); G.get(k).push(p); }
  const near = (x, y, lim) => { let best = Infinity; const r = Math.ceil(lim / C);
    const cx = Math.floor(x / C), cy = Math.floor(y / C);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const L = G.get((cx + i) + ',' + (cy + j)); if (L) for (const q of L) { const d = Math.hypot(q[0] - x, q[1] - y); if (d < best) best = d; } }
    return best; };
  return { P, near };
}

function compare(a, b, tol) {
  const A = sampler(a), B = sampler(b), bad = [];
  let worst = 0;
  for (const [S, T, tag] of [[B, A, 'new'], [A, B, 'gone']]) for (const p of S.P) {
    const d = T.near(p[0], p[1], 12); if (d > worst && isFinite(d)) worst = d;
    if (d > tol) bad.push({ x: p[0], y: p[1], d, tag });
  }
  return { worst: Math.min(worst, 99), bad };
}

// ---- a small PNG writer for the difference pictures
function png(w, h, rgb) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function diffPicture(c, gray, a, b, bad, file) {
  const s = Math.min(1, 1600 / Math.max(c.w, c.h)), w = Math.round(c.w * s), h = Math.round(c.h * s), img = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const g = 255 - (255 - gray[Math.floor(y / s) * c.w + Math.floor(x / s)]) * 0.15; img.fill(g, (y * w + x) * 3, (y * w + x) * 3 + 3); }
  const dot = (x, y, r, col) => { for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const X = Math.round(x * s) + i, Y = Math.round(y * s) + j; if (X >= 0 && Y >= 0 && X < w && Y < h) col.forEach((v, k) => img[(Y * w + X) * 3 + k] = v); } };
  for (const p of sampler(a).P) dot(p[0], p[1], 1, [150, 150, 150]);
  for (const p of sampler(b).P) dot(p[0], p[1], 0, [220, 0, 0]);
  for (const q of bad) dot(q.x, q.y, 3, q.tag === 'new' ? [220, 0, 0] : [0, 90, 220]);
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(file, png(w, h, img));
}

// ---- main
const args = process.argv.slice(2);
const approveAll = args.includes('--approve-all'), approveOne = args.includes('--approve');
const names = args.filter(a => !a.startsWith('--'));
const all = fs.readdirSync(CASES).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const todo = names.length ? names : all;
if (approveOne && !names.length) { console.error('say which case to approve, e.g.  node tests/run.js --approve lily-9in'); process.exit(2); }
const src = workerSource();
let failed = 0, skipped = 0;
for (const name of todo) {
  if (!all.includes(name)) { console.log(`?? ${name}: no such case`); failed++; continue; }
  const c = JSON.parse(fs.readFileSync(path.join(CASES, name + '.json'), 'utf8'));
  const gfile = path.join(CASES, name + '.gray.gz');
  if (!fs.existsSync(gfile)) { console.log(`skip   ${name}: its pattern file (${name}.gray.gz) is not in tests/cases`); skipped++; continue; }
  const gray = zlib.gunzipSync(fs.readFileSync(gfile));
  const r = runCase(src, c, gray);
  const apFile = path.join(CASES, name + '.approved.gz');
  if (approveAll || approveOne || !fs.existsSync(apFile)) {
    fs.writeFileSync(apFile, zlib.gzipSync(JSON.stringify({ pts: r.pts, offs: r.offs })));
    console.log(`saved  ${name}  (${r.offs.length - 1} lines, ${(r.ms / 1000).toFixed(1)} s)`); continue;
  }
  const ap = JSON.parse(zlib.gunzipSync(fs.readFileSync(apFile)));
  const tol = c.tolerance || 2.5, cmp = compare(strokesOf(ap), strokesOf(r), tol);
  if (cmp.bad.length) {
    failed++; const f = path.join(OUT, name + '-diff.png'); diffPicture(c, gray, strokesOf(ap), strokesOf(r), cmp.bad, f);
    console.log(`FAIL   ${name}: lines moved up to ${cmp.worst.toFixed(1)} px (allowed ${tol}); see ${path.relative(ROOT, f)}`);
  } else console.log(`ok     ${name}  (largest move ${cmp.worst.toFixed(1)} px, ${(r.ms / 1000).toFixed(1)} s)`);
}
if (failed) { console.log(`\n${failed} case(s) changed. If every change is an improvement, approve them with --approve NAME.`); process.exit(1); }
if (skipped === todo.length) { console.log('\nno pattern files found: put the test patterns into tests/cases (see README)'); process.exit(1); }
console.log('\nall cases match their approved results' + (skipped ? ` (${skipped} skipped)` : ''));

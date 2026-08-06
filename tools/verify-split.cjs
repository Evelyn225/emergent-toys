'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(__dirname, 'split-manifest.json');

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

function firstDiff(a, b) {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  const len = Math.min(ba.length, bb.length);
  for (let i = 0; i < len; i++) {
    if (ba[i] !== bb[i]) return i;
  }
  return ba.length === bb.length ? -1 : len;
}

function describeAt(text, byteOffset) {
  const upto = Buffer.from(text, 'utf8').slice(0, byteOffset).toString('utf8');
  const line = upto.split('\n').length;
  const ctx = text.slice(Math.max(0, upto.length - 40), upto.length + 40);
  return `line ~${line}: ${JSON.stringify(ctx)}`;
}

function verifySplit() {
  const baseline = read('tools/.baseline/script-body.txt');
  const rebuilt = readManifest().map(read).join('');
  const at = firstDiff(baseline, rebuilt);
  if (at === -1) return { ok: true, detail: `sources match baseline (${Buffer.byteLength(baseline)} bytes)` };
  return {
    ok: false,
    detail:
      `sources diverge from baseline at byte ${at}\n` +
      `  baseline ${describeAt(baseline, at)}\n` +
      `  rebuilt  ${describeAt(rebuilt, at)}\n` +
      `  baseline bytes=${Buffer.byteLength(baseline)} rebuilt bytes=${Buffer.byteLength(rebuilt)}`,
  };
}

module.exports = { verifySplit, readManifest };

if (require.main === module) {
  const r = verifySplit();
  console.log(r.ok ? 'PASS ' + r.detail : 'FAIL ' + r.detail);
  process.exit(r.ok ? 0 : 1);
}

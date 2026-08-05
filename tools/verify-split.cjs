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

// This repo has core.autocrlf=true, so the working copy is CRLF even though
// the stored blob is LF. Derive the separator instead of assuming it.
function detectEol(s) {
  return s.includes('\r\n') ? '\r\n' : '\n';
}

// Pull whatever JS is still inline between <script> and </script>.
function inlineRemainder(html) {
  const eol = detectEol(html);
  const openTag = eol + '<script>' + eol;
  const closeTag = eol + '</script>' + eol;
  const open = html.indexOf(openTag);
  if (open === -1) return '';
  const start = open + openTag.length;
  const close = html.indexOf(closeTag, start);
  if (close === -1) throw new Error('Found <script> with no matching </script>');
  return html.slice(start, close + eol.length);
}

// Confirm the page loads the extracted files in manifest order.
function checkTagOrder(html, expected) {
  const found = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map(m => m[1])
    .filter(src => src.startsWith('os/') || src.startsWith('apps/'));
  if (found.length !== expected.length || found.some((f, i) => f !== expected[i])) {
    return `script tag order does not match manifest\n  manifest: ${JSON.stringify(expected)}\n  in html:  ${JSON.stringify(found)}`;
  }
  return null;
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
  const html = read('sleep-os.html');
  const manifest = readManifest();

  const orderErr = checkTagOrder(html, manifest);
  if (orderErr) return { ok: false, detail: orderErr };

  const baseline = read('tools/.baseline/script-body.txt');
  const rebuilt = manifest.map(read).join('') + inlineRemainder(html);

  const at = firstDiff(baseline, rebuilt);
  if (at === -1) return { ok: true, detail: `script body matches (${Buffer.byteLength(baseline)} bytes)` };

  return {
    ok: false,
    detail:
      `script body diverges at byte ${at}\n` +
      `  baseline ${describeAt(baseline, at)}\n` +
      `  rebuilt  ${describeAt(rebuilt, at)}\n` +
      `  baseline bytes=${Buffer.byteLength(baseline)} rebuilt bytes=${Buffer.byteLength(rebuilt)}\n` +
      `  (a byte-count gap near one-per-line means something rewrote line endings on one side)`,
  };
}

module.exports = { verifySplit, readManifest };

if (require.main === module) {
  const r = verifySplit();
  console.log(r.ok ? 'PASS ' + r.detail : 'FAIL ' + r.detail);
  process.exit(r.ok ? 0 : 1);
}

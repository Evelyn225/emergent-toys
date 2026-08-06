'use strict';
// Usage: node tools/extract-slice.cjs <outPath> <startLine> <endLine>
// Line numbers are baseline-relative (original line minus 1500), 1-indexed, inclusive.
//
// Cuts the next slice off the TOP of os/_remainder.js, writes it to outPath,
// and inserts outPath into the manifest immediately before os/_remainder.js,
// which must stay last since it holds the suffix.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(__dirname, 'split-manifest.json');
const BASELINE = path.join(__dirname, '.baseline', 'script-body.txt');

const [outPath, startArg, endArg] = process.argv.slice(2);
if (!outPath || !startArg || !endArg) {
  console.error('Usage: node tools/extract-slice.cjs <outPath> <startLine> <endLine>');
  process.exit(2);
}
const start = Number(startArg);
const end = Number(endArg);

// This repo has core.autocrlf=true, so the working copy is CRLF even though
// the stored blob is LF. Derive the separator instead of assuming it.
function detectEol(s) {
  return s.includes('\r\n') ? '\r\n' : '\n';
}

const baselineText = fs.readFileSync(BASELINE, 'utf8');
const EOL = detectEol(baselineText);

// Splitting on '\n' leaves the '\r' attached to each element under CRLF, and
// joining on '\n' puts it back, so the slice round-trips byte-exactly either
// way. The trailing separator is '\n' and NOT EOL for the same reason: the
// last sliced element already ends with '\r' under CRLF, so appending EOL
// would emit '\r\r\n'.
const baseline = baselineText.split('\n');
const slice = baseline.slice(start - 1, end).join('\n') + '\n';

const REMAINDER = path.join(ROOT, 'os/_remainder.js');
let remainder = fs.readFileSync(REMAINDER, 'utf8');

if (!remainder.startsWith(slice)) {
  console.error(
    'FAIL: requested slice is not the current top of os/_remainder.js.\n' +
    '  Either a previous cut was skipped, or the line range is wrong.\n' +
    '  slice starts:     ' + JSON.stringify(slice.slice(0, 80)) + '\n' +
    '  remainder starts: ' + JSON.stringify(remainder.slice(0, 80))
  );
  process.exit(1);
}

const absOut = path.join(ROOT, outPath);
fs.mkdirSync(path.dirname(absOut), { recursive: true });
fs.writeFileSync(absOut, slice);
fs.writeFileSync(REMAINDER, remainder.slice(slice.length));

// Insert before the remainder, which must stay last in the manifest.
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
manifest.splice(manifest.indexOf('os/_remainder.js'), 0, outPath);
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`extracted ${outPath}  baseline lines ${start}-${end}  ${end - start + 1} lines  ${Buffer.byteLength(slice)} bytes`);

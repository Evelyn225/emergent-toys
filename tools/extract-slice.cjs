'use strict';
// Usage: node tools/extract-slice.cjs <outPath> <startLine> <endLine>
// Line numbers are baseline-relative (original line minus 1500), 1-indexed, inclusive.
//
// Cuts the next slice off the TOP of the remaining inline <script> block,
// writes it to outPath, inserts a <script src> tag in load order, and
// appends outPath to the manifest.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'sleep-os.html');
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

let html = fs.readFileSync(HTML, 'utf8');

const OPEN = EOL + '<script>' + EOL;
const CLOSE = EOL + '</script>' + EOL;
const openIdx = html.indexOf(OPEN);
if (openIdx === -1) {
  console.error('FAIL: no inline <script> block left to cut from');
  process.exit(1);
}
const bodyStart = openIdx + OPEN.length;
const closeIdx = html.indexOf(CLOSE, bodyStart);
if (closeIdx === -1) {
  console.error('FAIL: <script> has no matching </script>');
  process.exit(1);
}
const bodyEnd = closeIdx + EOL.length;
const remainder = html.slice(bodyStart, bodyEnd);

// Safety: the slice must be exactly the top of what is still inline.
// This is what enforces strict top-down extraction.
if (!remainder.startsWith(slice)) {
  console.error(
    'FAIL: requested slice is not the current top of the inline script.\n' +
    '  Either a previous cut was skipped, or the line range is wrong.\n' +
    '  slice starts:     ' + JSON.stringify(slice.slice(0, 80)) + '\n' +
    '  remainder starts: ' + JSON.stringify(remainder.slice(0, 80))
  );
  process.exit(1);
}

// Write the extracted file.
const absOut = path.join(ROOT, outPath);
fs.mkdirSync(path.dirname(absOut), { recursive: true });
fs.writeFileSync(absOut, slice);

// Remove the slice from the inline block.
html = html.slice(0, bodyStart) + remainder.slice(slice.length) + html.slice(bodyEnd);

// Insert the tag after the last existing extracted tag, or immediately before <script>.
// These lines are built from scratch, so they must use EOL explicitly.
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const tag = `<script src="${outPath}"></script>` + EOL;
if (manifest.length === 0) {
  const at = html.indexOf(OPEN);
  html = html.slice(0, at + EOL.length) + tag + html.slice(at + EOL.length);
} else {
  const prevTag = `<script src="${manifest[manifest.length - 1]}"></script>` + EOL;
  const at = html.indexOf(prevTag);
  if (at === -1) {
    console.error('FAIL: could not find previous tag ' + prevTag.trim());
    process.exit(1);
  }
  html = html.slice(0, at + prevTag.length) + tag + html.slice(at + prevTag.length);
}

fs.writeFileSync(HTML, html);

manifest.push(outPath);
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`extracted ${outPath}  baseline lines ${start}-${end}  ${end - start + 1} lines  ${Buffer.byteLength(slice)} bytes`);

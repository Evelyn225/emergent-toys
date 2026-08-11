'use strict';
// vercel.json uses the legacy `builds` array, and that array is an ALLOWLIST:
// a file that matches no `src` pattern is simply not uploaded, with no warning
// at build time. Everything still works locally, because server.cjs serves the
// project root with express.static and does not care.
//
// This has now bitten twice. `os/os.css` has its own line in vercel.json
// because of the first time. The second was os/sounds/*.ogg: committed,
// pushed, deployed, and 404 in production while every test passed and the
// local server was fine. os/audio.js swallows a failed fetch on purpose - a
// missing sound must never break the thing it decorates - so the only symptom
// was silence.
//
// The fix is not to remember. It is this: anything the running OS fetches by
// URL must be covered by a build entry, checked here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

// Vercel's globs: `**` crosses directory separators, a single `*` does not.
function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { out += '.*'; i++; }
      else out += '[^/]*';
    } else if ('\\^$+?.()|{}[]'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

const buildPatterns = (vercel.builds || [])
  .map(b => b && b.src)
  .filter(Boolean)
  .map(src => ({ src, re: globToRegExp(src) }));

function isDeployed(rel) {
  return buildPatterns.some(p => p.re.test(rel));
}

// Sanity-check the matcher against entries already in vercel.json, so a broken
// globToRegExp fails loudly here instead of certifying everything below.
test('the glob matcher agrees with vercel.json entries that are known to work', () => {
  assert.ok(isDeployed('os/os.css'), 'os/os.css is live in production but read as undeployed');
  assert.ok(isDeployed('sleep-os.bundle.js'), 'the bundle is live in production but read as undeployed');
  assert.ok(isDeployed('images/favicon-32x32.png'), 'images/** should cover nested files');
  assert.ok(!isDeployed('os/kernel.js'), 'a single * must not cross a directory separator');
  assert.ok(!isDeployed('tools/build.cjs'), 'build tooling is not expected to deploy');
});

// The two files the OS loads by URL at runtime, beyond the page itself.
test('the bundles the page and kernel load are deployed', () => {
  for (const rel of ['sleep-os.bundle.js', 'sleep-os-worker.bundle.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} is missing from the repo`);
    assert.ok(isDeployed(rel), `${rel} matches no vercel.json build src, so it will 404 in production`);
  }
});

test('every sound os/audio.js fetches is deployed', () => {
  const audioSrc = fs.readFileSync(path.join(ROOT, 'os/audio.js'), 'utf8');
  const dirMatch = audioSrc.match(/const SOUND_DIR = '([^']+)'/);
  assert.ok(dirMatch, "const SOUND_DIR = '...' not found in os/audio.js");
  const dir = dirMatch[1];

  const files = [...audioSrc.matchAll(/^\s{2}[a-z][a-z0-9_]*:\s*'([^']+\.ogg)'/gm)].map(m => m[1]);
  assert.ok(files.length >= 7, `expected the SOUND_FILES table, found ${files.length} entries`);
  for (const file of files) {
    assert.ok(isDeployed(dir + file),
      `${dir}${file} matches no vercel.json build src - it will 404 in production and the OS will fall silent`);
  }
});

// Not fetched by os/audio.js, but loaded by the desktop the same way and lost
// the same way. Empty is fine; wrongly configured is not.
test('os/icons is deployed if it has anything in it', () => {
  const dir = path.join(ROOT, 'os/icons');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    assert.ok(isDeployed('os/icons/' + name),
      `os/icons/${name} matches no vercel.json build src, so it will 404 in production`);
  }
});

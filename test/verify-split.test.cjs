'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readManifest } = require('../tools/verify-split.cjs');

const ROOT = path.join(__dirname, '..');

test('sleep-os.html loads the bundle and nothing else', () => {
  const html = fs.readFileSync(path.join(ROOT, 'sleep-os.html'), 'utf8');
  assert.ok(!/\r?\n<script>\r?\n/.test(html), 'no inline <script> block');

  const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(srcs.includes('sleep-os.bundle.js'), 'must load sleep-os.bundle.js');
  assert.deepStrictEqual(
    srcs.filter(s => s.startsWith('os/') || s.startsWith('apps/')),
    [],
    'sources must not be loaded directly - only through the bundle'
  );
});

test('every file in the manifest exists and is non-empty', () => {
  for (const rel of readManifest()) {
    const stat = fs.statSync(path.join(ROOT, rel));
    assert.ok(stat.size > 0, `${rel} is empty`);
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readManifest, readWorkerManifest } = require('../tools/verify-split.cjs');
const ROOT = path.join(__dirname, '..');

test('every worker source exists and parses', () => {
  for (const rel of readWorkerManifest()) {
    const full = path.join(ROOT, rel);
    assert.ok(fs.existsSync(full), 'missing ' + rel);
    new Function(fs.readFileSync(full, 'utf8'));   // throws on a syntax error
  }
});

test('the interpreter is in both bundles and nothing else is', () => {
  const shared = readManifest().filter(f => readWorkerManifest().includes(f));
  assert.deepStrictEqual(shared, ['os/script/interp.js'],
    'only the interpreter may be shared; both contexts run scripts');
});

test('the worker bundle is current', () => {
  const { buildWorker, WORKER_OUT } = require('../tools/build.cjs');
  assert.strictEqual(buildWorker(), fs.readFileSync(WORKER_OUT, 'utf8'),
    'run npm run build');
});

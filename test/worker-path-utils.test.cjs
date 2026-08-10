'use strict';
// Drift guard for os/worker/path-utils.js, which exists because a worker
// cannot load os/vfs.js or os/fs-core.js (test/worker-build.test.cjs enforces
// that only the interpreter is shared between the two bundles) but
// os/script/interp.js's execScript calls fsNormalizeDir/fsSplitPath as plain
// globals regardless of which thread it runs on. The worker copy must behave
// identically to the main thread's os/vfs.js versions across the inputs that
// matter - drive-prefix stripping, separator normalization, and the
// fallback-directory path - or a spawned script's paths would resolve
// differently than an identical command typed into the terminal.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

const SAMPLE_PATHS = [
  '', '   ', 'a.txt', 'DOCS\\a.txt', 'C:\\sleepOS\\DOCS\\a.txt', 'C:\\sleepOS',
  'C:\\sleepOSother\\x', '/DOCS/a.txt', '  DOCS\\a.txt  ', '\\\\DOCS\\\\a.txt\\\\',
  'docs\\sub\\file.txt', 'C:\\sleepOS\\', 'sub/dir/file.TXT',
];
const SAMPLE_FALLBACKS = ['', 'ROOT', 'docs', 'A\\B'];

function loadMain() { return loadOsSources(makeOsContext(), ['os/vfs.js']); }
function loadWorker() { return loadOsSources(makeOsContext(), ['os/worker/path-utils.js']); }

test('fsNormalizeDir matches os/vfs.js\'s vfsNormalizeDir byte-for-byte', () => {
  const mainCtx = loadMain();
  const workerCtx = loadWorker();
  for (const p of SAMPLE_PATHS) {
    assert.strictEqual(workerCtx.fsNormalizeDir(p), mainCtx.vfsNormalizeDir(p), `fsNormalizeDir(${JSON.stringify(p)})`);
  }
});

test('fsSplitPath matches os/vfs.js\'s vfsSplitPath byte-for-byte across paths and fallbacks', () => {
  const mainCtx = loadMain();
  const workerCtx = loadWorker();
  for (const p of SAMPLE_PATHS) {
    for (const fb of SAMPLE_FALLBACKS) {
      assert.deepStrictEqual(
        plain(workerCtx.fsSplitPath(p, fb)),
        plain(mainCtx.vfsSplitPath(p, fb)),
        `fsSplitPath(${JSON.stringify(p)}, ${JSON.stringify(fb)})`
      );
    }
  }
});

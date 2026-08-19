'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { extractFunctionSource } = require('./helpers/load-os.cjs');

const ROOT = path.join(__dirname, '..');
const mediaSrc = fs.readFileSync(path.join(ROOT, 'os/media.js'), 'utf8');

// os/media.js cannot be loaded whole in this harness: handleFileUpload's
// siblings pull in window management, dialogs, and the terminal. This
// extracts just handleFileUpload (plus the two small local kind/mime
// helpers it calls) and runs it against hand-mocked globals - the same
// source-slice pattern test/daemon-corruption.test.cjs uses for os/daemon.js.
//
// The only caller of saveBlobEntry is handleFileUpload, at the end of an
// already-async per-file handler that already has an { ok:false, name }
// failure channel feeding the user-visible added/failed lists. Before this
// fix, saveBlobEntry's result was never read at all - the surrounding
// try/catch swallowed it and the function unconditionally returned
// { ok: true }, so a save that persisted nowhere still told the user it
// worked.
function makeUploadCtx(overrides) {
  const ctx = Object.assign({
    console,
    Promise,
    _uploadCwd: '',
    fsNormalizeDir: s => String(s || '').toUpperCase(),
    ensureFsDir: () => {},
    vfsDirExistsSync: () => true,
    osAlert: () => {},
    showUploadConfirm: () => {},
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} },
    readFileAsText: async () => '',
    readFileAsArrayBuffer: async () => new ArrayBuffer(0),
    vfsWriteFile: async () => ({}),
    vfsWriteBlob: async () => ({}),
  }, overrides || {});
  vm.createContext(ctx);
  const src = [
    extractFunctionSource(mediaSrc, 'inferBlobKindFromName'),
    extractFunctionSource(mediaSrc, 'inferBlobMimeFromName'),
    extractFunctionSource(mediaSrc, 'handleFileUpload'),
  ].join('\n');
  new vm.Script(src, { filename: 'media-upload-slice' }).runInContext(ctx);
  return ctx;
}

test('a blob whose bytes fail to persist is reported as failed, not silently ok', async () => {
  const ctx = makeUploadCtx({
    saveBlobEntry: async () => false, // every persistence path failed
  });
  const alerts = [];
  ctx.showUploadConfirm = names => { throw new Error('must not report success for: ' + names); };
  ctx.osAlert = msg => alerts.push(msg);

  const file = { name: 'big.png', size: 5 * 1024 * 1024, type: 'image/png' };
  await ctx.handleFileUpload([file]);

  assert.strictEqual(alerts.length, 1, 'a failed persist must produce exactly one Upload Failed alert');
  assert.ok(/could not be uploaded/.test(alerts[0]), alerts[0]);
});

test('a blob that persists successfully is still reported as added', async () => {
  const ctx = makeUploadCtx({
    saveBlobEntry: async () => true,
  });
  let confirmed = null;
  ctx.showUploadConfirm = names => { confirmed = names; };
  ctx.osAlert = () => { throw new Error('must not alert on a successful upload'); };

  const file = { name: 'ok.png', size: 100, type: 'image/png' };
  await ctx.handleFileUpload([file]);

  assert.deepStrictEqual(confirmed, ['ok.png']);
});

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
// Tasks 9e/9f deleted saveBlobEntry and the mirrors it wrote to (the only
// thing that used to give a blob upload a synchronous-ish "did this actually
// persist" answer). A blob's bytes now reach the block layer entirely
// through the vfsWriteBlob call already in this function, and that write's
// real durability (the commit, up to 400ms later) is reported separately
// through reportVfsError's toast if it fails - the same channel every other
// write in this OS already relies on. handleFileUpload's added/failed lists
// now report only what they can actually know synchronously: whether
// vfsWriteFile/vfsWriteBlob itself accepted the write (a full disk still
// throws ENOSPC up front). `saveBlobEntry` is deliberately NOT stubbed
// below - if handleFileUpload ever called it again, that call would throw
// (nothing defines it in this context) and the success-path test would fail.
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

test('a blob upload is reported as added once vfsWriteBlob accepts it, with no separate persistence check', async () => {
  const writes = [];
  const ctx = makeUploadCtx({
    vfsWriteBlob: async (name, record, dirPath) => { writes.push({ name, record, dirPath }); return {}; },
  });
  let confirmed = null;
  ctx.showUploadConfirm = names => { confirmed = names; };
  ctx.osAlert = () => { throw new Error('must not alert on a successful upload'); };

  const file = { name: 'ok.png', size: 5 * 1024 * 1024, type: 'image/png' }; // large: no mirror ever covered this
  await ctx.handleFileUpload([file]);

  assert.deepStrictEqual(confirmed, ['ok.png']);
  assert.strictEqual(writes.length, 1, 'the blob must reach vfsWriteBlob exactly once');
  assert.strictEqual(writes[0].record.url, 'blob:stub');
});

test('a blob upload vfsWriteBlob refuses is reported as failed, and its object URL is released', async () => {
  const revoked = [];
  const ctx = makeUploadCtx({
    vfsWriteBlob: async () => { const err = new Error('not enough space'); err.code = 'ENOSPC'; throw err; },
    URL: { createObjectURL: () => 'blob:doomed', revokeObjectURL: url => revoked.push(url) },
  });
  const alerts = [];
  ctx.showUploadConfirm = names => { throw new Error('must not report success for: ' + names); };
  ctx.osAlert = msg => alerts.push(msg);

  const file = { name: 'full-disk.png', size: 100, type: 'image/png' };
  await ctx.handleFileUpload([file]);

  assert.strictEqual(alerts.length, 1, 'a refused write must produce exactly one Upload Failed alert');
  assert.ok(/could not be uploaded/.test(alerts[0]), alerts[0]);
  assert.deepStrictEqual(revoked, ['blob:doomed'],
    'the object URL must be released once the tree entry was refused, not leaked');
});

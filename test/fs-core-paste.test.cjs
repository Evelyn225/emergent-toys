'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

// `_expClipboard` is a top-level `let` in os/fs-core.js, so it is a global
// lexical binding rather than a property of the vm context and cannot be set
// from the host. Global lexical scope IS shared across scripts run in the same
// context, so a second evaluated script can assign to it.
function setClipboard(ctx, clipboard) {
  ctx.__evalSource('_expClipboard = ' + JSON.stringify(clipboard) + ';', 'set-clipboard');
}

// _copyEntryInto's blob branch re-fetches the source's object URL to mint an
// independent copy. Not provided by default (makeOsContext ships no `fetch`
// at all) - callers that exercise a blob copy add their own fetch/URL pair;
// everything else here never touches a blob's bytes, so the plain default
// context (fetch undefined, URL a static stub) is enough.
async function paster(overrides) {
  const ctx = loadOsSources(makeOsContext(overrides), ['os/vfs.js', 'os/storage-mem.js', 'os/fs-core.js']);
  const alerts = [];
  ctx.osAlert = message => alerts.push(message);
  await ctx.vfsMount(ctx.createMemStorage({}), {});
  // Bound the recursion so a runaway copy fails the test instead of hanging it.
  // Every await inside _copyEntryInto resolves as a microtask, so a timeout
  // would never fire: the macrotask queue is starved for as long as it runs.
  const realMkdir = ctx.vfsMkdir;
  const calls = { mkdir: 0 };
  ctx.vfsMkdir = function (...args) {
    calls.mkdir += 1;
    if (calls.mkdir > 50) {
      return Promise.reject(new Error('runaway recursion: vfsMkdir called ' + calls.mkdir + ' times'));
    }
    return realMkdir(...args);
  };
  return { ctx, alerts, calls };
}

test('pasting a copied folder into itself is refused, not recursed', async () => {
  const { ctx, alerts, calls } = await paster();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsWriteFile('DOCS\\note.txt', 'payload', '');
  const mkdirsAfterSetup = calls.mkdir;

  setClipboard(ctx, { items: [{ name: 'DOCS', kind: 'dir', srcCwd: '' }], cut: false });
  const changed = await ctx.pasteClipboardInto('DOCS');

  assert.strictEqual(changed, false, 'nothing should have been pasted');
  assert.deepStrictEqual(alerts, ['Cannot paste a folder into itself.']);
  assert.strictEqual(calls.mkdir, mkdirsAfterSetup, 'the copy must never start');
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS\\DOCS'), false);
  assert.deepStrictEqual(plain(ctx.vfsListSync('DOCS')).map(e => e.name), ['note.txt']);
});

test('pasting a copied folder into its own grandchild is refused', async () => {
  const { ctx, alerts, calls } = await paster();
  await ctx.vfsMkdir('A', '');
  await ctx.vfsMkdir('A\\SUB', '');
  await ctx.vfsMkdir('A\\SUB\\DEEP', '');
  const mkdirsAfterSetup = calls.mkdir;

  setClipboard(ctx, { items: [{ name: 'A', kind: 'dir', srcCwd: '' }], cut: false });
  const changed = await ctx.pasteClipboardInto('A\\SUB\\DEEP');

  assert.strictEqual(changed, false);
  assert.deepStrictEqual(alerts, ['Cannot paste a folder into itself.']);
  assert.strictEqual(calls.mkdir, mkdirsAfterSetup, 'the copy must never start');
  assert.deepStrictEqual(plain(ctx.vfsListSync('A\\SUB\\DEEP')), []);
});

test('cutting a folder into itself is refused and leaves the source in place', async () => {
  const { ctx, alerts } = await paster();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsWriteFile('DOCS\\note.txt', 'payload', '');
  const before = JSON.stringify(plain(ctx.vfsSerializeTree()));

  setClipboard(ctx, { items: [{ name: 'DOCS', kind: 'dir', srcCwd: '' }], cut: true });
  const changed = await ctx.pasteClipboardInto('DOCS');

  assert.strictEqual(JSON.stringify(plain(ctx.vfsSerializeTree())), before,
    'a refused cut must not detach the subtree');
  assert.strictEqual(changed, false);
  assert.strictEqual(alerts.length, 1);
  assert.match(alerts[0], /into itself/);
});

test('copying a folder into a different folder still copies the whole subtree', async () => {
  const { ctx, alerts } = await paster();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsMkdir('DOCS\\SUB', '');
  await ctx.vfsWriteFile('DOCS\\top.txt', 'top', '');
  await ctx.vfsWriteFile('DOCS\\SUB\\deep.txt', 'deep', '');
  await ctx.vfsMkdir('TARGET', '');

  setClipboard(ctx, { items: [{ name: 'DOCS', kind: 'dir', srcCwd: '' }], cut: false });
  const changed = await ctx.pasteClipboardInto('TARGET');

  assert.strictEqual(changed, true);
  assert.deepStrictEqual(alerts, []);
  assert.strictEqual(await ctx.vfsReadFile('TARGET\\DOCS\\top.txt', ''), 'top');
  assert.strictEqual(await ctx.vfsReadFile('TARGET\\DOCS\\SUB\\deep.txt', ''), 'deep');
  // The original is untouched and the copy is a separate subtree, not an alias.
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\top.txt', ''), 'top');
  await ctx.vfsWriteFile('TARGET\\DOCS\\added.txt', 'only in the copy', '');
  assert.strictEqual(await ctx.vfsReadFile('DOCS\\added.txt', ''), null);
});

// A name collision is what makes this dangerous: _uniqueNameIn returns
// 'PHOTOS_copy' in mixed case, vfsMkdir stores 'PHOTOS_COPY', and the recursion
// used to carry the mixed-case string down as the destination directory before
// the fix noted above it. With no more separate blob-store row to land under
// the wrong name, the failure mode this guarded against can no longer exist
// structurally - vfsWriteBlob is the only place a blob's destination path is
// computed at all, and it is fed the same `dstCwd` the tree itself used. This
// now checks that guarantee directly: the copied blob must be findable at the
// tree's real, uppercased directory.
test('a colliding folder copy places its blob under the real, uppercased directory', async () => {
  const { ctx } = await paster();
  await ctx.vfsMkdir('PHOTOS', '');
  await ctx.vfsWriteBlob('PHOTOS\\pic.png', { url: 'blob:x', kind: 'image', size: 10, mime: 'image/png' }, '');

  // Paste into the root, where PHOTOS already exists, forcing the _copy suffix.
  setClipboard(ctx, { items: [{ name: 'PHOTOS', kind: 'dir', srcCwd: '' }], cut: false });
  assert.strictEqual(await ctx.pasteClipboardInto(''), true);

  const made = ctx.vfsListSync('').filter(e => e.kind === 'dir').map(e => e.name);
  assert.ok(made.includes('PHOTOS_COPY'), 'the tree holds the uppercased name, got ' + JSON.stringify(made));
  const stat = ctx.vfsStatSync('pic.png', 'PHOTOS_COPY');
  assert.ok(stat && stat.kind === 'blob', 'the copied blob must be findable under the real directory name');
});

// _copyEntryInto's own new job, now that the blob-store mirror it used to
// lean on for a spare copy of the bytes is gone: mint the copy's own object
// URL directly, by re-fetching the source's live URL, rather than aliasing
// the source's URL the way a bare `{ ...st.blob }` spread would.
test('copying a blob mints its own independent object URL when the source can be re-fetched', async () => {
  let nextUrl = 0;
  const { ctx } = await paster({
    URL: {
      createObjectURL: () => 'blob:' + (nextUrl++),
      revokeObjectURL: () => {},
    },
    fetch: async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
    Blob, // _copyEntryInto wraps the re-fetched bytes in a real Blob before minting the copy's URL
  });
  const srcUrl = ctx.URL.createObjectURL();
  await ctx.vfsWriteBlob('pic.png', { url: srcUrl, kind: 'image', size: 3, mime: 'image/png' }, '');

  setClipboard(ctx, { items: [{ name: 'pic.png', kind: 'blob', srcCwd: '' }], cut: false });
  assert.strictEqual(await ctx.pasteClipboardInto(''), true);

  const copyUrl = ctx.vfsStatSync('pic_copy.png', '').blob.url;
  assert.notStrictEqual(copyUrl, srcUrl, 'the copy must not alias the source\'s object URL');
});

test('copying a blob whose source cannot be re-fetched falls back to sharing its URL', async () => {
  // No `fetch` override at all - makeOsContext ships none, so the fetch call
  // throws (matching an offline seeded asset or an already-revoked URL) and
  // the fallback below must still leave the copy usable.
  const { ctx } = await paster();
  await ctx.vfsWriteBlob('pic.png', { url: 'blob:unreachable', kind: 'image', size: 3, mime: 'image/png' }, '');

  setClipboard(ctx, { items: [{ name: 'pic.png', kind: 'blob', srcCwd: '' }], cut: false });
  assert.strictEqual(await ctx.pasteClipboardInto(''), true);

  const copyUrl = ctx.vfsStatSync('pic_copy.png', '').blob.url;
  assert.strictEqual(copyUrl, 'blob:unreachable',
    'with nothing to re-fetch from, the copy must still work by sharing the source\'s URL');
});

test('a paste does not advance the drive fragmentation meter', async () => {
  const { ctx } = await paster();
  await ctx.vfsMkdir('DOCS', '');
  await ctx.vfsWriteFile('DOCS\\a.txt', 'a', '');
  await ctx.vfsWriteFile('DOCS\\b.txt', 'b', '');
  await ctx.vfsMkdir('TARGET', '');
  // vfsWriteFile/vfsMkdir/vfsWriteBlob call increaseDriveFragmentation unless
  // trackFragmentation is off. Installing it only now keeps the setup writes
  // above out of the count.
  let bumps = 0;
  ctx.increaseDriveFragmentation = () => { bumps += 1; };
  ctx.calcTextFragmentationDelta = () => 0.008;
  ctx.calcBlobFragmentationDelta = () => 0.01;

  setClipboard(ctx, { items: [{ name: 'DOCS', kind: 'dir', srcCwd: '' }], cut: false });
  assert.strictEqual(await ctx.pasteClipboardInto('TARGET'), true);
  assert.strictEqual(bumps, 0, 'a copy must not fragment the drive, matching the pre-migration paste');
});

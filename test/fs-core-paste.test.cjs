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

async function paster() {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js', 'os/fs-core.js']);
  const alerts = [];
  ctx.osAlert = message => alerts.push(message);
  // The cut path keeps the blob store in step with the tree. None of these
  // cases involve a blob; stub them so a missing global cannot masquerade as
  // the refusal being tested.
  ctx.moveBlobEntryStorage = () => {};
  ctx.moveBlobStorageSubtree = () => {};
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
// used to carry the mixed-case string down as the destination directory. Every
// nested blob-store row then landed under a directory name the tree can never
// produce, and since removeBlobEntry and friends key off the normalized
// vfsStatSync().dirName, those rows were unreachable forever: deleting the file
// left them behind and the next boot restored an image the user had
// permanently deleted.
test('a colliding folder copy writes blob-store rows under the real, uppercased directory', async () => {
  const { ctx } = await paster();
  const copiedTo = [];
  ctx.copyBlobEntryStorage = (srcDir, srcName, dstDir, dstName) => {
    copiedTo.push({ dstDir, dstName });
    return Promise.resolve(null);
  };
  await ctx.vfsMkdir('PHOTOS', '');
  await ctx.vfsWriteBlob('PHOTOS\\pic.png', { url: 'blob:x', kind: 'image', size: 10, mime: 'image/png' }, '');

  // Paste into the root, where PHOTOS already exists, forcing the _copy suffix.
  setClipboard(ctx, { items: [{ name: 'PHOTOS', kind: 'dir', srcCwd: '' }], cut: false });
  assert.strictEqual(await ctx.pasteClipboardInto(''), true);

  const made = ctx.vfsListSync('').filter(e => e.kind === 'dir').map(e => e.name);
  assert.ok(made.includes('PHOTOS_COPY'), 'the tree holds the uppercased name, got ' + JSON.stringify(made));
  assert.deepStrictEqual(plain(copiedTo), [{ dstDir: 'PHOTOS_COPY', dstName: 'pic.png' }],
    'the blob-store row must use the directory name the tree actually has');
  // The key the delete path would compute must be the key that was written.
  assert.strictEqual(ctx.vfsStatSync('pic.png', 'PHOTOS_COPY').dirName, copiedTo[0].dstDir);
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

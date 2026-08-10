'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

// The interpreter must reach the filesystem only through options.fs. Loading it
// with no VFS in scope proves there is no hidden global dependency left.
function interpCtx() {
  const ctx = makeOsContext();
  ctx.__evalSource('function fsNormalizeDir(s){ return String(s||"").toUpperCase(); }');
  ctx.__evalSource('function fsSplitPath(p,f){ var i=String(p).lastIndexOf("\\\\"); return i<0?{dirName:String(f||"").toUpperCase(),fileName:String(p)}:{dirName:p.slice(0,i).toUpperCase(),fileName:p.slice(i+1)}; }');
  return loadOsSources(ctx, ['os/script/interp.js']);
}

function stubFs(files) {
  const made = [];
  const removed = [];
  const events = [];
  return {
    made, removed, events,
    async stat(path) {
      return Object.prototype.hasOwnProperty.call(files, path)
        ? { kind: 'text', size: files[path].length, dirName: '', name: path } : null;
    },
    async exists(path) { return Object.prototype.hasOwnProperty.call(files, path); },
    async dirExists() { return false; },
    async readFile(path) { return files[path] ?? null; },
    async writeFile(path, text) { files[path] = text; return { dirName: '', fileName: path }; },
    async mkdir(path) { made.push(path); return { dirName: '', fileName: path, created: true }; },
    async unlink(path) { removed.push(path); delete files[path]; return { ok: true }; },
    async openUi() {},
    async openSystem() { return true; },
    async isSystemPath() { return false; },
    async notifyChanged() { events.push('fs-changed'); },
    async clearScreen() {},
  };
}

test('the interpreter reads a file through the injected adapter', async () => {
  const ctx = interpCtx();
  const out = [];
  const fs = stubFs({ 'a.txt': 'alpha\nbeta\n' });
  const code = await ctx.execScript('grep "alpha" a.txt', s => out.push(s), { fs, dirName: '' });
  assert.strictEqual(code, 0);
  assert.ok(out.some(l => l.includes('alpha')), 'grep output: ' + JSON.stringify(out));
});

test('the interpreter writes through the injected adapter', async () => {
  const ctx = interpCtx();
  const fs = stubFs({});
  await ctx.execScript('mkdir OUT', () => {}, { fs, dirName: '' });
  assert.deepStrictEqual(fs.made, ['OUT']);
});

test('a missing file surfaces as a script error, not a crash', async () => {
  const ctx = interpCtx();
  const out = [];
  const code = await ctx.execScript('grep "x" nope.txt', s => out.push(s), { fs: stubFs({}), dirName: '' });
  assert.notStrictEqual(code, 0);
  assert.ok(out.join('\n').includes('nope.txt'), out.join('\n'));
});

// del/rm must go through the adapter, not deleteVirtualPath. A worker has no
// such global, and on the main thread that function is what enforces the
// Recycle Bin.
test('del routes through the adapter', async () => {
  const ctx = interpCtx();
  const fs = stubFs({ 'gone.txt': 'x' });
  const code = await ctx.execScript('DEL gone.txt', () => {}, { fs, dirName: '' });
  assert.strictEqual(code, 0);
  assert.deepStrictEqual(fs.removed, ['gone.txt']);
});

// The interpreter must not touch `document`. In a Worker that is a
// ReferenceError, and this context has no DOM at all - so a surviving reference
// fails here rather than in a browser.
test('a write notifies through the adapter and never touches document', async () => {
  const ctx = interpCtx();
  const fs = stubFs({});
  const code = await ctx.execScript('TOUCH made.txt', () => {}, { fs, dirName: '' });
  assert.strictEqual(code, 0);
  assert.deepStrictEqual(fs.events, ['fs-changed']);
});

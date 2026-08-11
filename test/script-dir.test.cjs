'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

// Loading interp.js alone (no VFS in scope) requires the same two stubs
// interp-fs-adapter.test.cjs uses: execScript calls fsNormalizeDir
// unconditionally while building its initial state, before running a single
// instruction, so it must exist even though DIR itself never calls it.
function interp() {
  const ctx = makeOsContext();
  ctx.__evalSource('function fsNormalizeDir(s){ return String(s||"").toUpperCase(); }');
  ctx.__evalSource('function fsSplitPath(p,f){ var i=String(p).lastIndexOf("\\\\"); return i<0?{dirName:String(f||"").toUpperCase(),fileName:String(p)}:{dirName:p.slice(0,i).toUpperCase(),fileName:p.slice(i+1)}; }');
  return loadOsSources(ctx, ['os/script/interp.js']);
}
// The same adapter shape both realms present.
function stubFs(entries, dirs) {
  return {
    async stat() { return null; },
    async exists() { return false; },
    async dirExists(p) { return (dirs || ['']).includes(p); },
    async list() { return entries; },
    async readFile() { return null; },
    async writeFile() {}, async mkdir() {}, async unlink() {},
    async openUi() {}, async openSystem() { return true; },
    async isSystemPath() { return false; },
    async notifyChanged() {}, async clearScreen() {},
  };
}

test('dir prints one entry per line, directories marked', async () => {
  const ctx = interp();
  const lines = [];
  const code = await ctx.execScript('dir', l => lines.push(l), {
    fs: stubFs([
      { name: 'NOTES.txt', type: 'file', kind: 'text', size: 12 },
      { name: 'SUB', type: 'dir', kind: 'dir', size: 0 },
    ]),
    dirName: '',
  });
  assert.strictEqual(code, 0);
  assert.deepStrictEqual(lines, ['NOTES.txt', 'SUB\\']);
});

test('dir on an empty directory prints nothing and still succeeds', async () => {
  const ctx = interp();
  const lines = [];
  const code = await ctx.execScript('dir', l => lines.push(l), { fs: stubFs([]), dirName: '' });
  assert.strictEqual(code, 0);
  assert.deepStrictEqual(lines, []);
});

test('dir on a missing directory is an error naming the line', async () => {
  const ctx = interp();
  const lines = [];
  const code = await ctx.execScript('print one\ndir NOPE', l => lines.push(l), {
    fs: stubFs([], ['']),
    dirName: '',
  });
  assert.notStrictEqual(code, 0, 'a missing directory must not look like an empty one');
  assert.ok(lines.join('\n').includes('line 2'), 'the error names the failing line: ' + lines.join('\n'));
});

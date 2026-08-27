'use strict';
// Task 10: a double-clicked .exe now spawns instead of always opening in
// Notepad, on both surfaces that can double-click a file - Explorer's
// openItem and the desktop's openDesktopShortcutTarget. Both call sites
// share one predicate, programIsSpawnableExe (os/programs.js), specifically
// so they cannot drift from each other. This file proves:
//   1. the predicate itself is correct for a user .exe vs a system .exe vs
//      a non-.exe;
//   2. Explorer's double-click spawns a user .exe and does NOT spawn a
//      system binary (which still opens through Notepad, whose own routing
//      to the decompiler is already covered by notepad-exe-routing.test.cjs);
//   3. the desktop shortcut path behaves identically;
//   4. neither consumer still carries its own inline copy of the test -
//      a source grep, the same kind of guard this repo already uses
//      elsewhere (see e.g. test/icon-assets.test.cjs).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

const ROOT = path.join(__dirname, '..');

// ── A minimal, generic DOM element ──────────────────────────────────────
// openExplorer() drives real DOM APIs (createElement, appendChild, style,
// classList, addEventListener/dispatchEvent, setAttribute, querySelectorAll,
// getBoundingClientRect...) well beyond what makeDocumentStub() in
// test/helpers/load-os.cjs provides - that stub's getElementById returns
// null and it has no createElement at all, which is enough for the tests it
// was built for but not for driving a real explorer window. Rather than
// grow the shared helper for one consumer, this file builds its own stub
// element: a Proxy that stores whatever is assigned to it (style, className,
// innerHTML...) and answers every DOM method with a harmless no-op, except
// addEventListener/dispatchEvent, which are wired for real so a synthetic
// dblclick on a rendered item actually reaches openItem.
function makeStubElement() {
  const store = {
    style: {},
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    children: [],
  };
  const listeners = new Map();
  const methods = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners.get(type) || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(evt) {
      (listeners.get(evt.type) || []).forEach(fn => fn(evt));
      return true;
    },
    appendChild(child) { store.children.push(child); return child; },
    removeChild(child) {
      const i = store.children.indexOf(child);
      if (i >= 0) store.children.splice(i, 1);
      return child;
    },
    remove() {},
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    focus() {}, blur() {}, select() {},
  };
  return new Proxy(store, {
    get(target, prop) {
      if (prop === '__isStub') return true;
      if (Object.prototype.hasOwnProperty.call(methods, prop)) return methods[prop];
      return target[prop];
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

// Depth-first search through the fake DOM tree (built purely out of
// appendChild calls on makeStubElement instances) for the item element
// makeItem() built for `fileName` - identified by its innerHTML, the only
// place the rendered name ends up in this stub.
function findItemEl(root, fileName) {
  if (root && root.innerHTML && String(root.innerHTML).includes('>' + fileName + '<')) return root;
  for (const child of (root && root.children) || []) {
    const hit = findItemEl(child, fileName);
    if (hit) return hit;
  }
  return null;
}

// document.getElementById must return the SAME element for the SAME id on
// repeated calls - openExplorer looks up 'wb-'+id once for `body` and
// appends everything to it, but this test needs to fetch that identical
// `body` back afterward to search it, so ids are cached rather than
// re-minted every call the way document.createElement's fresh elements are.
function makeDocStub() {
  const cache = new Map();
  const doc = makeStubElement();
  doc.getElementById = id => {
    if (!cache.has(id)) cache.set(id, makeStubElement());
    return cache.get(id);
  };
  doc.createElement = () => makeStubElement();
  doc.body = makeStubElement();
  return doc;
}

// Builds a context with the real os/vfs.js, os/programs.js and
// apps/explorer.js loaded; everything else explorer.js reaches out to is
// stubbed. `files` seeds the VFS root (name -> text content); `rootMeta`
// seeds ROOT_SYSTEM_FILE_META, the table programIsSystemBinary consults -
// this is what makes an entry a "system binary" rather than a user .exe, the
// same override pattern test/desktop-open-system-file.test.cjs uses.
function explorerCtx(files, rootMeta) {
  const calls = { spawn: [], notepad: [] };
  const doc = makeDocStub();
  const ctx = makeOsContext({
    document: doc,
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    ROOT_SYSTEM_FILE_META: rootMeta || [],
    daemonStory: { endingReached: false, stage: 0 },
    KERNEL_PID: 1,
    wins: {},
    mkWin: () => true,
    setWinTitle: () => {},
    nextExplorerWinId: () => 1,
    resolveFsIcon: () => 'icon:unknown',
    iconMarkup: () => '',
    iconLabel: name => String(name == null ? '' : name),
    escHtml: s => String(s == null ? '' : s),
    procSetTimeout: (winId, fn) => fn(),
    addLongPress: () => {},
    showCtxMenu: () => {},
    openWithAssociation: () => false,
    openMediaFile: () => {},
    isRecycleBinItemName: () => false,
    canAttemptDeleteItem: () => false,
    getVisibleDesktopIcons: () => [],
    getDesktopShortcutsForDir: () => [],
    getDesktopSystemIconsForDir: () => [],
    normalizeShortcutPath: p => String(p || ''),
    inferBlobKindFromName: () => 'binary',
    isDesktopVirtualItem: () => false,
    handleWallpaperFileRename: () => {},
    osPrompt: () => {},
    recycleBinEntries: [],
    openRecycleBin: () => {},
    openTerminal: () => {},
    openDesktopShortcutTarget: () => {},
    openSystemFile: () => false,
    openNotepad: (...args) => { calls.notepad.push(args); },
    // kernelSpawn must return a real Promise, never a bare value - the
    // caller (openItem) does `void kernelSpawn(...)`; a bare value would
    // still pass a truthiness check but this matches production shape and
    // catches a caller that ever adds a `.catch` or `.then`.
    kernelSpawn: (p, argv, opts) => { calls.spawn.push({ p, argv: [...argv], opts }); return Promise.resolve(1); },
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/programs.js', 'apps/explorer.js']);
  ctx.vfsSetTree({ dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  const tree = ctx.vfsGetTree();
  Object.entries(files || {}).forEach(([name, text]) => tree.files.set(name, text));
  ctx.openExplorer('');
  const body = doc.getElementById('wb-1');
  return { ctx, calls, body };
}

function dblclick(body, fileName) {
  const el = findItemEl(body, fileName);
  assert.ok(el, 'no rendered item found for ' + fileName);
  el.dispatchEvent({ type: 'dblclick' });
}

// ── The shared predicate ────────────────────────────────────────────────

test('programIsSpawnableExe: a user .exe is spawnable', () => {
  const ctx = loadOsSources(makeOsContext({ ROOT_SYSTEM_FILE_META: [{ name: 'CALC.exe' }] }), ['os/programs.js']);
  assert.strictEqual(ctx.programIsSpawnableExe('HELLO.exe'), true);
  assert.strictEqual(ctx.programIsSpawnableExe('hello.EXE'), true);
});

test('programIsSpawnableExe: a system binary is not spawnable, by exact name or alias', () => {
  const ctx = loadOsSources(makeOsContext({ ROOT_SYSTEM_FILE_META: [{ name: 'CALC.exe' }] }), ['os/programs.js']);
  assert.strictEqual(ctx.programIsSpawnableExe('CALC.exe'), false);
  assert.strictEqual(ctx.programIsSpawnableExe('calc.exe'), false);
  // '?????.exe' has no ROOT_SYSTEM_FILE_META entry - it is a PROGRAM_LAUNCHERS
  // key with an alias instead. programIsSystemBinary's alias branch is what
  // this exercises.
  assert.strictEqual(ctx.programIsSpawnableExe('?????.exe'), false);
});

test('programIsSpawnableExe: a non-.exe is never spawnable', () => {
  const ctx = loadOsSources(makeOsContext({ ROOT_SYSTEM_FILE_META: [] }), ['os/programs.js']);
  assert.strictEqual(ctx.programIsSpawnableExe('notes.txt'), false);
  assert.strictEqual(ctx.programIsSpawnableExe(''), false);
});

// ── Explorer ────────────────────────────────────────────────────────────

test('Explorer: double-clicking a user .exe spawns it, not Notepad', () => {
  const { calls, body } = explorerCtx({ 'HELLO.exe': 'PRINT hi' }, [{ name: 'CALC.exe' }]);
  dblclick(body, 'HELLO.exe');
  assert.strictEqual(calls.spawn.length, 1);
  assert.strictEqual(calls.spawn[0].p, 'HELLO.exe');
  assert.deepStrictEqual(calls.notepad, []);
});

test('Explorer: double-clicking a system binary does not spawn - it goes to Notepad', () => {
  const { calls, body } = explorerCtx({ 'CALC.exe': 'binary bytes here' }, [{ name: 'CALC.exe' }]);
  dblclick(body, 'CALC.exe');
  assert.deepStrictEqual(calls.spawn, []);
  assert.strictEqual(calls.notepad.length, 1);
  assert.strictEqual(calls.notepad[0][0], 'CALC.exe');
});

// ── Desktop ─────────────────────────────────────────────────────────────

function desktopCtx() {
  const calls = { spawn: [], notepad: [] };
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'CALC.exe' }],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    KERNEL_PID: 1,
    openWithAssociation: () => false,
    openMediaFile: () => {},
    openExplorer: () => {},
    osAlert: () => {},
    openNotepad: (...args) => { calls.notepad.push(args); },
    kernelSpawn: (p, argv, opts) => { calls.spawn.push({ p, argv: [...argv], opts }); return Promise.resolve(1); },
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/desktop-model.js', 'os/programs.js']);
  ctx.vfsSetTree({ dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  return { ctx, calls };
}

test('Desktop: a shortcut to a user .exe spawns it, not Notepad', () => {
  const { ctx, calls } = desktopCtx();
  ctx.vfsGetTree().files.set('HELLO.exe', 'PRINT hi');
  ctx.openDesktopShortcutTarget({ path: 'C:\\sleepOS\\HELLO.exe', name: 'HELLO.exe', kind: 'file' });
  assert.strictEqual(calls.spawn.length, 1);
  assert.strictEqual(calls.spawn[0].p, 'HELLO.exe');
  assert.deepStrictEqual(calls.notepad, []);
});

test('Desktop: a shortcut to a system binary does not spawn - it goes to Notepad', () => {
  const { ctx, calls } = desktopCtx();
  ctx.vfsGetTree().files.set('CALC.exe', 'binary bytes here');
  ctx.openDesktopShortcutTarget({ path: 'C:\\sleepOS\\CALC.exe', name: 'CALC.exe', kind: 'file' });
  assert.deepStrictEqual(calls.spawn, []);
  assert.strictEqual(calls.notepad.length, 1);
  assert.strictEqual(calls.notepad[0][0], 'CALC.exe');
});

// ── No duplicated inline copy ───────────────────────────────────────────
// The whole point of extracting programIsSpawnableExe was that two inline
// copies of `/\.exe$/i.test(name) && !programIsSystemBinary(name)` WILL
// drift. Proving both call sites route through the shared predicate (above)
// is necessary but not sufficient - either file could still carry a second,
// unused-but-confusing copy of the regex. Guard against that directly, the
// same way test/icon-assets.test.cjs greps source rather than trusting
// behavior alone to prove a single source of truth.
test('neither Explorer nor the desktop model still inlines the spawnable-exe test', () => {
  const explorerSrc = fs.readFileSync(path.join(ROOT, 'apps', 'explorer.js'), 'utf8');
  const desktopSrc = fs.readFileSync(path.join(ROOT, 'os', 'desktop-model.js'), 'utf8');
  const inlinePattern = /\\\.exe\$\/i\.test\([^)]*\)\s*&&\s*!programIsSystemBinary/;
  assert.strictEqual(inlinePattern.test(explorerSrc), false, 'apps/explorer.js still has an inline copy');
  assert.strictEqual(inlinePattern.test(desktopSrc), false, 'os/desktop-model.js still has an inline copy');
  assert.ok(explorerSrc.includes('programIsSpawnableExe('), 'apps/explorer.js does not call the shared predicate');
  assert.ok(desktopSrc.includes('programIsSpawnableExe('), 'os/desktop-model.js does not call the shared predicate');
});

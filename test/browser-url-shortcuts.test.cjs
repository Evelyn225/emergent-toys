'use strict';
// Task: the browser's right-click menu can now "Save as Shortcut", writing a
// real DESKTOP\<name>.url file, and opening a .url anywhere (desktop,
// Explorer, the terminal's OPEN) routes through the registry association to
// BROWSER.exe, which reads the URL back out and navigates to it. This covers
// the pieces that do not need a live DOM: the write+read round trip, the
// parser rejecting a malformed shortcut, the association lookup, filename
// sanitising/collision handling, and the icon. The context menu itself is
// DOM event work and is not covered here - see apps/browser.js's own
// comments on the contextmenu bridge for why a right-click on real
// (cross-origin) page content can never reach it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, extractFunctionSource } = require('./helpers/load-os.cjs');

const ROOT = path.join(__dirname, '..');
const BROWSER_SRC = fs.readFileSync(path.join(ROOT, 'apps', 'browser.js'), 'utf8');
const WM_SRC = fs.readFileSync(path.join(ROOT, 'os', 'wm.js'), 'utf8');

// sanitizeShortcutFileStem, hostnameFromUrl and parseUrlShortcutTarget are
// plain top-level functions in apps/browser.js with no DOM dependency -
// sliced out verbatim rather than reimplemented, so a change to the real
// parser is what this test actually exercises.
function shortcutHelperCtx() {
  // makeOsContext's URL stub is object-createObjectURL/revokeObjectURL only,
  // not the real parsing constructor (most callers never need one) -
  // hostnameFromUrl does, so this slice gets the host's real URL class
  // instead. It crosses the vm boundary as a plain constructor function,
  // which `new URL(...)` only needs to be.
  const ctx = makeOsContext({ URL });
  ctx.__evalSource(extractFunctionSource(BROWSER_SRC, 'sanitizeShortcutFileStem'), 'browser-slice-sanitize');
  ctx.__evalSource(extractFunctionSource(BROWSER_SRC, 'hostnameFromUrl'), 'browser-slice-hostname');
  ctx.__evalSource(extractFunctionSource(BROWSER_SRC, 'parseUrlShortcutTarget'), 'browser-slice-parse');
  return ctx;
}

// ── parseUrlShortcutTarget ──────────────────────────────────────────

test('parses the URL out of a well-formed .url file', () => {
  const ctx = shortcutHelperCtx();
  const content = '[InternetShortcut]\nURL=https://en.wikipedia.org/\n';
  assert.strictEqual(ctx.parseUrlShortcutTarget(content), 'https://en.wikipedia.org/');
});

test('is lenient about a missing [InternetShortcut] header', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.parseUrlShortcutTarget('URL=https://example.com\n'), 'https://example.com');
});

test('rejects a file with no URL= line at all', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.parseUrlShortcutTarget('[InternetShortcut]\n'), '');
});

test('rejects an empty URL value', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.parseUrlShortcutTarget('[InternetShortcut]\nURL=\n'), '');
});

test('rejects a non-http(s) scheme', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.parseUrlShortcutTarget('[InternetShortcut]\nURL=javascript:alert(1)\n'), '');
  assert.strictEqual(ctx.parseUrlShortcutTarget('[InternetShortcut]\nURL=file:///etc/passwd\n'), '');
});

test('rejects garbage content entirely', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.parseUrlShortcutTarget('not a shortcut file'), '');
  assert.strictEqual(ctx.parseUrlShortcutTarget(''), '');
  assert.strictEqual(ctx.parseUrlShortcutTarget(null), '');
});

// Non-vacuity: prove the guard actually does something by breaking it and
// watching the test above fail, then restoring it.
test('non-vacuity: a parser that accepts any scheme would fail the http(s)-only test', () => {
  const brokenSrc = BROWSER_SRC.replace(
    "return /^https?:\\/\\//i.test(url) ? url : '';",
    "return url;"
  );
  assert.notStrictEqual(brokenSrc, BROWSER_SRC, 'replacement did not match - source moved');
  const ctx = makeOsContext({});
  ctx.__evalSource(extractFunctionSource(brokenSrc, 'parseUrlShortcutTarget'), 'browser-slice-parse-broken');
  assert.strictEqual(ctx.parseUrlShortcutTarget('[InternetShortcut]\nURL=javascript:alert(1)\n'), 'javascript:alert(1)',
    'the broken version should accept the scheme the real parser rejects, proving the real assertion is load-bearing');
});

// ── sanitizeShortcutFileStem / hostnameFromUrl ──────────────────────

test('strips path separators and Windows-illegal characters from a title', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.sanitizeShortcutFileStem('a\\b/c:d*e?f"g<h>i|j'), 'a b c d e f g h i j');
});

test('collapses whitespace and trims', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.sanitizeShortcutFileStem('  Wikipedia   Random   Article  '), 'Wikipedia Random Article');
});

test('truncates an absurdly long title', () => {
  const ctx = shortcutHelperCtx();
  const long = 'x'.repeat(300);
  assert.strictEqual(ctx.sanitizeShortcutFileStem(long).length, 80);
});

test('hostnameFromUrl falls back to the raw string for a bad URL', () => {
  const ctx = shortcutHelperCtx();
  assert.strictEqual(ctx.hostnameFromUrl('https://en.wikipedia.org/wiki/Foo'), 'en.wikipedia.org');
  assert.strictEqual(ctx.hostnameFromUrl('not a url'), 'not a url');
});

// ── write + read round trip through the real VFS ────────────────────
// saveUrlShortcut itself is a closure local to openBrowser() and cannot be
// called in isolation, but this proves the two things that matter about it:
// the exact content shape it writes ([InternetShortcut]\nURL=...\n) survives
// a real vfsWriteFile/vfsReadFile round trip and comes back out through the
// same parser openBrowserFromUrlFile uses.
async function vfsCtx() {
  const ctx = loadOsSources(makeOsContext({}), ['os/vfs.js', 'os/storage-mem.js', 'os/fs-core.js']);
  ctx.__evalSource(extractFunctionSource(BROWSER_SRC, 'parseUrlShortcutTarget'), 'browser-slice-parse');
  await ctx.vfsMount(ctx.createMemStorage({}), {});
  await ctx.vfsMkdir('DESKTOP', '');
  return ctx;
}

test('a shortcut written to the Desktop reads back the same URL', async () => {
  const ctx = await vfsCtx();
  const url = 'https://en.wikipedia.org/wiki/Special:Random';
  await ctx.vfsWriteFile('DESKTOP\\Wikipedia Random.url', '[InternetShortcut]\nURL=' + url + '\n', '');
  const content = await ctx.vfsReadFile('DESKTOP\\Wikipedia Random.url', '');
  assert.strictEqual(ctx.parseUrlShortcutTarget(content), url);
});

test('a hand-edited shortcut with the URL= line deleted parses as invalid, not home:', async () => {
  const ctx = await vfsCtx();
  await ctx.vfsWriteFile('DESKTOP\\Broken.url', '[InternetShortcut]\n', '');
  const content = await ctx.vfsReadFile('DESKTOP\\Broken.url', '');
  assert.strictEqual(ctx.parseUrlShortcutTarget(content), '',
    'a malformed shortcut must not silently resolve to some URL - openBrowserFromUrlFile alerts instead of opening home:');
});

// ── filename collision ───────────────────────────────────────────────
// saveUrlShortcut resolves a collision with fs-core's own _uniqueNameIn
// (the same helper Explorer's copy/paste already uses for a name clash)
// rather than prompting - one convention for "this name is taken" across the
// OS instead of a second one invented just for shortcuts.
test('a second shortcut with the same title is uniquified, not overwritten', async () => {
  const ctx = await vfsCtx();
  await ctx.vfsWriteFile('DESKTOP\\Example.url', '[InternetShortcut]\nURL=https://example.com/\n', '');
  const second = ctx._uniqueNameIn('DESKTOP', 'Example.url');
  assert.strictEqual(second, 'Example_copy.url');
  await ctx.vfsWriteFile('DESKTOP\\' + second, '[InternetShortcut]\nURL=https://example.org/\n', '');

  const first = await ctx.vfsReadFile('DESKTOP\\Example.url', '');
  const secondContent = await ctx.vfsReadFile('DESKTOP\\Example_copy.url', '');
  assert.strictEqual(ctx.parseUrlShortcutTarget(first), 'https://example.com/',
    'the original shortcut must survive untouched');
  assert.strictEqual(ctx.parseUrlShortcutTarget(secondContent), 'https://example.org/');
});

// ── returning user whose persisted root has no DESKTOP ───────────────
// FIX ROUND 1: seedFreshRootTree (os/fs-persist.js) only installs DESKTOP
// `if (!root.dirs.size && !root.files.size)` - a genuinely empty root - and
// even then with no queued op, on purpose (DESKTOP is "meant to stay
// uncommitted, regenerated ... on every boot", per that function's own
// comment). Nothing was doing that regeneration, so any returning user whose
// mount restores a persisted tree without DESKTOP in it - a real profile
// team-lead measured with root dirs CACHE, MUSIC, SYS, VIDEOS, DOCS and no
// DESKTOP - got ENOENT from vfsWriteFile forever after, on the very first
// "Save as Shortcut". vfsBootMount now heals DESKTOP the same way it already
// heals RECYCLE_STORAGE_DIR (os/fs-persist.js). This builds the tree the
// mount would restore for that exact profile - no seed runs, because the
// root is not empty - and proves the write both fails before the heal and
// succeeds after it.
const DAEMON_SRC = fs.readFileSync(path.join(ROOT, 'os', 'daemon.js'), 'utf8');
const FS_PERSIST_SRC = fs.readFileSync(path.join(ROOT, 'os', 'fs-persist.js'), 'utf8');

async function returningUserMissingDesktopCtx() {
  const ctx = loadOsSources(makeOsContext({}), ['os/vfs.js', 'os/storage-mem.js', 'os/fs-core.js']);
  ctx.__evalSource(extractFunctionSource(BROWSER_SRC, 'parseUrlShortcutTarget'), 'browser-slice-parse');
  ctx.__evalSource(extractFunctionSource(DAEMON_SRC, 'ensureFsDir'), 'daemon-slice-ensureFsDir');
  const backend = ctx.createMemStorage({
    tree: {
      dirs: ['CACHE', 'MUSIC', 'SYS', 'VIDEOS', 'DOCS'],
      files: {},
      subdirs: { DOCS: { dirs: [], files: {}, subdirs: {} } },
    },
  });
  // No `seed` option passed - matching vfsBootMount for a non-empty root,
  // where the seed callback's own emptiness check skips seedFreshRootTree.
  await ctx.vfsMount(backend, {});
  return ctx;
}

test('a persisted root missing DESKTOP has no DESKTOP before the heal runs', async () => {
  const ctx = await returningUserMissingDesktopCtx();
  assert.strictEqual(ctx.vfsDirExistsSync('DESKTOP'), false,
    'the synthetic persisted tree must reproduce the reported bug precondition');
  await assert.rejects(
    () => ctx.vfsWriteFile('DESKTOP\\Wikipedia Random.url', '[InternetShortcut]\nURL=https://en.wikipedia.org/\n', 'DESKTOP'),
    /no such directory/,
    'this is the exact failure team-lead saw: ENOENT for DESKTOP, leaking as the alert text'
  );
});

test('ensureFsDir(DESKTOP) heals a returning user, and a shortcut can then be saved and read back', async () => {
  const ctx = await returningUserMissingDesktopCtx();
  ctx.ensureFsDir('DESKTOP');
  assert.strictEqual(ctx.vfsDirExistsSync('DESKTOP'), true);

  const url = 'https://en.wikipedia.org/';
  await ctx.vfsWriteFile('DESKTOP\\Wikipedia.url', '[InternetShortcut]\nURL=' + url + '\n', 'DESKTOP');
  const content = await ctx.vfsReadFile('DESKTOP\\Wikipedia.url', 'DESKTOP');
  assert.strictEqual(ctx.parseUrlShortcutTarget(content), url);
});

test('ensureFsDir(DESKTOP) is idempotent - a user who already has DESKTOP is untouched', async () => {
  const ctx = loadOsSources(makeOsContext({}), ['os/vfs.js', 'os/storage-mem.js', 'os/fs-core.js']);
  ctx.__evalSource(extractFunctionSource(DAEMON_SRC, 'ensureFsDir'), 'daemon-slice-ensureFsDir');
  const backend = ctx.createMemStorage({
    tree: { dirs: ['DESKTOP'], files: {}, subdirs: { DESKTOP: { dirs: [], files: { 'existing.txt': 'kept' }, subdirs: {} } } },
  });
  await ctx.vfsMount(backend, {});
  ctx.ensureFsDir('DESKTOP');
  assert.strictEqual(await ctx.vfsReadFile('DESKTOP\\existing.txt', ''), 'kept',
    'healing an already-present DESKTOP must not disturb what is already in it');
});

// Pins WHERE the heal lives, not just that ensureFsDir works in isolation -
// team-lead asked for the boot path specifically, since DESKTOP missing
// breaks every write into it (uploads, New Folder, wallpaper drops), not
// just shortcuts. A source check is what catches the fix quietly moving back
// into saveUrlShortcut alone on a future edit.
test("vfsBootMount heals DESKTOP the same way it heals RECYCLE_STORAGE_DIR", () => {
  const bootBody = extractFunctionSource(FS_PERSIST_SRC, 'vfsBootMount');
  assert.ok(/ensureFsDir\(\s*RECYCLE_STORAGE_DIR\s*\)/.test(bootBody), 'the existing RECYCLE_STORAGE_DIR heal must still be there');
  assert.ok(/ensureFsDir\(\s*'DESKTOP'\s*\)/.test(bootBody), "vfsBootMount must call ensureFsDir('DESKTOP')");
});

// Non-vacuity: prove the source check above is not just matching on the word
// "DESKTOP" appearing anywhere in the function.
test('non-vacuity: the boot-path source check fails without the DESKTOP heal', () => {
  const brokenSrc = FS_PERSIST_SRC.replace("  ensureFsDir('DESKTOP');\n", '');
  assert.notStrictEqual(brokenSrc, FS_PERSIST_SRC, 'replacement did not match - source moved');
  const bootBody = extractFunctionSource(brokenSrc, 'vfsBootMount');
  assert.strictEqual(/ensureFsDir\(\s*'DESKTOP'\s*\)/.test(bootBody), false);
});

// ── registry association ─────────────────────────────────────────────

function registryCtx(overrides) {
  return loadOsSources(makeOsContext(Object.assign({
    openBrowser: () => { throw new Error('openBrowser() should not be called for a named .url file'); },
    openBrowserFromUrlFile: () => {},
    openNotepad: () => {}, openImageViewer: () => {},
    vfsStatSync: () => null, inferBlobKindFromName: () => 'binary',
    openVideoPlayer: () => {}, openAudioPlayer: () => {},
    runScriptInTerminal: () => {},
  }, overrides)), ['os/registry.js']);
}

test('.url resolves to BROWSER.exe in the registry', () => {
  const ctx = registryCtx();
  assert.strictEqual(ctx.getFileAssociation('SHORTCUT.url'), 'BROWSER.exe');
  assert.strictEqual(ctx.getFileAssociation('shortcut.URL'), 'BROWSER.exe', 'lookup is case-insensitive on the extension');
});

test('openWithAssociation routes a .url file to openBrowserFromUrlFile with its name and directory', () => {
  const calls = [];
  const ctx = registryCtx({ openBrowserFromUrlFile: (name, dir) => calls.push([name, dir]) });
  const handled = ctx.openWithAssociation('Wikipedia Random.url', 'DESKTOP');
  assert.strictEqual(handled, true);
  assert.deepStrictEqual(calls, [['Wikipedia Random.url', 'DESKTOP']]);
});

test('FILE_HANDLERS["BROWSER.exe"] still opens a blank browser when called with no name', () => {
  let opened = false;
  const ctx = registryCtx({ openBrowser: () => { opened = true; } });
  // FILE_HANDLERS is a top-level `const` in os/registry.js, so (per
  // load-os.cjs's own header comment) it never becomes a property on the vm
  // context object - only `function` and `var` declarations do. Reaching it
  // means running a snippet INSIDE the same context via __evalSource, the
  // same trick test/fs-core-paste.test.cjs uses for fs-core's `_expClipboard`.
  ctx.__evalSource("FILE_HANDLERS['BROWSER.exe']();", 'invoke-browser-handler-bare');
  assert.strictEqual(opened, true, 'the desktop icon and Start menu call BROWSER.exe with no arguments and must still get home:');
});

// Non-vacuity: prove the association test actually pins the registry value by
// loading a version of os/registry.js with the .url line removed and
// watching the lookup fail.
test('non-vacuity: removing the .url association breaks the lookup test', () => {
  const REGISTRY_SRC = fs.readFileSync(path.join(ROOT, 'os', 'registry.js'), 'utf8');
  const brokenSrc = REGISTRY_SRC.replace("      '.url':    { type:'REG_SZ', value:'BROWSER.exe' },\n", '');
  assert.notStrictEqual(brokenSrc, REGISTRY_SRC, 'replacement did not match - source moved');
  const ctx = makeOsContext({
    openBrowser: () => {}, openBrowserFromUrlFile: () => {},
    openNotepad: () => {}, openImageViewer: () => {},
    vfsStatSync: () => null, inferBlobKindFromName: () => 'binary',
    openVideoPlayer: () => {}, openAudioPlayer: () => {},
    runScriptInTerminal: () => {},
  });
  ctx.__evalSource(brokenSrc, 'registry-broken');
  assert.strictEqual(ctx.getFileAssociation('SHORTCUT.url'), '',
    'with the association removed, the lookup must fail - proving the passing test above depends on it being present');
});

// ── icon ──────────────────────────────────────────────────────────────

function resolveFsIconCtx() {
  const ctx = { isRecycleBinItemName: () => false, recycleBinEntries: [], SYSTEM_FILE_ICONS: {} };
  const vm = require('vm');
  vm.createContext(ctx);
  new vm.Script(extractFunctionSource(WM_SRC, 'resolveFsIcon'), { filename: 'wm-slice-resolveFsIcon' }).runInContext(ctx);
  return ctx;
}

test('a .url file gets the browser icon, same as .html', () => {
  const ctx = resolveFsIconCtx();
  assert.strictEqual(ctx.resolveFsIcon('Wikipedia Random.url'), 'icon:browser');
  assert.strictEqual(ctx.resolveFsIcon('page.html'), 'icon:browser');
});

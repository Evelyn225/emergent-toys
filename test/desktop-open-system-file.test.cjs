'use strict';
// os/desktop-model.js's openSystemFile had zero automated coverage before
// this file existed: test/kernel-ui-syscalls.test.cjs stubs openSystemFile
// out entirely rather than exercising the real function, and nothing else in
// test/ ever requires os/desktop-model.js. That means the registry lookup
// itself (programsInDir('').find(...), the .open guard, the Recycle Bin
// branch, the void.tmp early return) had never run under test, before or
// after the refactor that replaced the old hardcoded SYS map with it.
//
// This loads the real os/vfs.js, os/desktop-model.js and os/programs.js -
// the same three-file dependency chain openSystemFile actually runs
// against in production - and stubs only the launcher functions it calls
// out to, plus osAlert.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

// ROOT_SYSTEM_FILE_META normally lives in os/daemon.js (manifest position
// 14, well after both os/desktop-model.js at position 6 and os/programs.js
// at position 8), so it has to arrive as a context override rather than be
// loaded for real - the same approach test/programs-resolve.test.cjs uses.
// Values are copied from os/daemon.js's real table so the registry under
// test has the same eight root programs it does in production.
const ROOT_SYSTEM_FILE_META = [
  { name: 'TERMINAL.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'SYSMON.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'NOTEPAD.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'BROWSER.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'DEFRAG.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'CALC.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'REGEDIT.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'EXPLORER.exe', size: '8,192', date: '11/13/2024  10:31' },
];

// Loads a fresh context per call (mirroring programs()'s pattern in
// test/programs-resolve.test.cjs) so no state - localStorage, the calls
// array, daemonStory - leaks between tests.
//
// openRecycleBin is NOT on this override list even though it is one of the
// things openSystemFile can trigger. os/desktop-model.js declares
// `function openRecycleBin(){ openExplorer('RECYCLE'); }` itself, and a real
// function declaration in a script run later against the same vm context
// overwrites whatever property was already there - the same way a hoisted
// `var` would clobber a pre-set global. A pre-loaded spy under that name
// would just get thrown away the moment os/desktop-model.js runs. openExplorer
// is what openRecycleBin calls, is never declared inside os/desktop-model.js,
// and stays a controllable spy, so the Recycle Bin test below asserts on
// openExplorer('RECYCLE') instead.
function desktop(overrides) {
  const calls = [];
  function spy(name) {
    return (...args) => { calls.push([name, ...args]); };
  }
  const ctx = makeOsContext(Object.assign({
    ROOT_SYSTEM_FILE_META,
    daemonStory: { endingReached: false, quarantineSigned: false, stage: 0 },
    openNotepad: spy('notepad'),
    openTerminal: spy('terminal'),
    openSysmon: spy('sysmon'),
    openBrowser: spy('browser'),
    openDefrag: spy('defrag'),
    openCalculator: spy('calc'),
    openRegedit: spy('regedit'),
    openExplorer: spy('explorer'),
    openWelcome: spy('welcome'),
    openVoid: spy('void'),
    openDaemon: spy('daemon'),
    openUnknown: spy('unknown'),
    openFiles: spy('files'),
    osAlert: spy('alert'),
  }, overrides || {}));
  loadOsSources(ctx, ['os/vfs.js', 'os/desktop-model.js', 'os/programs.js']);
  // RECYCLE_BIN_NAME is `const` inside the real os/desktop-model.js, which
  // (per the header comment in test/helpers/load-os.cjs) does NOT become a
  // context property - it is a lexical binding visible to identifiers, not
  // an object property a test can read off ctx. Copying it onto the context
  // object here, rather than hardcoding the literal 'RECYCLE BIN' a second
  // time, means this test always exercises whatever value the real file
  // actually declares.
  ctx.__evalSource('globalThis.__RECYCLE_BIN_NAME = RECYCLE_BIN_NAME;');
  return { ctx, calls };
}

test('NOTEPAD.exe routes to openNotepad and fires nothing else', () => {
  const { ctx, calls } = desktop();
  assert.strictEqual(ctx.openSystemFile('NOTEPAD.exe'), true);
  assert.deepStrictEqual(calls, [['notepad', undefined, '']]);
});

test('CALC.exe routes to openCalculator and fires nothing else', () => {
  const { ctx, calls } = desktop();
  assert.strictEqual(ctx.openSystemFile('CALC.exe'), true);
  assert.deepStrictEqual(calls, [['calc']]);
});

test('WELCOME.README routes to openWelcome and fires nothing else', () => {
  const { ctx, calls } = desktop();
  assert.strictEqual(ctx.openSystemFile('WELCOME.README'), true);
  assert.deepStrictEqual(calls, [['welcome']]);
});

test('EXPLORER.exe routes to openExplorer and fires nothing else', () => {
  const { ctx, calls } = desktop();
  assert.strictEqual(ctx.openSystemFile('EXPLORER.exe'), true);
  assert.deepStrictEqual(calls, [['explorer', '']]);
});

test('an unknown name returns false and fires no launcher', () => {
  const { ctx, calls } = desktop();
  // This exact contract - false, nothing fired - is what
  // apps/explorer.js (two call sites), os/desktop-model.js's own shortcut
  // path, and os/script/interp.js all depend on to report a missing target
  // instead of silently doing nothing.
  assert.strictEqual(ctx.openSystemFile('NOSUCH.exe'), false);
  assert.deepStrictEqual(calls, []);
});

test('the Recycle Bin name opens the bin and returns true, despite not being in the registry', () => {
  const { ctx, calls } = desktop();
  // Deliberately not a program: no directory, cannot be typed at the
  // terminal, must never resolve on PATH. It survives as a hardcoded branch
  // ahead of the registry lookup rather than an entry inside it.
  assert.strictEqual(ctx.openSystemFile(ctx.__RECYCLE_BIN_NAME), true);
  assert.deepStrictEqual(calls, [['explorer', 'RECYCLE']]);
});

test('void.tmp after the ending alerts instead of opening, and does not call openVoid', () => {
  const { ctx, calls } = desktop({ daemonStory: { endingReached: true, quarantineSigned: false, stage: 9 } });
  assert.strictEqual(ctx.openSystemFile('void.tmp'), true);
  assert.deepStrictEqual(calls, [['alert', 'void.tmp is no longer present.', 'void.tmp', 'icon:void']]);
});

test('void.tmp before the ending opens normally through the registry', () => {
  const { ctx, calls } = desktop({ daemonStory: { endingReached: false, quarantineSigned: false, stage: 0 } });
  assert.strictEqual(ctx.openSystemFile('void.tmp'), true);
  assert.deepStrictEqual(calls, [['void']]);
});

test('matching on name is case-insensitive', () => {
  const { ctx, calls } = desktop();
  assert.strictEqual(ctx.openSystemFile('notepad.exe'), true);
  assert.strictEqual(ctx.openSystemFile('NOTEPAD.EXE'), true);
  assert.deepStrictEqual(calls, [
    ['notepad', undefined, ''],
    ['notepad', undefined, ''],
  ]);
});

test('matching does not append .exe and does not use aliases', () => {
  const { ctx, calls } = desktop();
  // This is the deliberate difference from the terminal's programResolve,
  // which does both. openSystemFile receives a real filename Explorer or a
  // stored shortcut already resolved, never something a person typed, so
  // loose matching here would only let a wrong name silently launch a
  // program.
  assert.strictEqual(ctx.openSystemFile('notepad'), false);
  assert.strictEqual(ctx.openSystemFile('welcome'), false);
  assert.deepStrictEqual(calls, []);
});

test('a GUI launch does not consult PATH, unlike the terminal\'s resolver', () => {
  const { ctx, calls } = desktop();
  // openSystemFile takes only a name - no cwd, no PATH - so there is no
  // input through which a broken PATH could reach it. Prove that matters by
  // reusing the exact broken-PATH scenario Task 4 established: PATH that has
  // dropped the root, read from a cwd that is not the root, is unreachable
  // through the terminal's own resolver...
  assert.strictEqual(ctx.programResolve('CALC.exe', 'DOCS', 'C:\\sleepOS\\PROJECTS'), null,
    'sanity check: this PATH really does defeat the terminal\'s resolver');
  // ...yet the GUI launch of the very same program succeeds regardless,
  // because it never looks at PATH in the first place.
  assert.strictEqual(ctx.openSystemFile('CALC.exe'), true);
  assert.deepStrictEqual(calls, [['calc']]);
});

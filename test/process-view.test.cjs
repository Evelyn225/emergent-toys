'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

// process-view.js reads three globals. Stubbing them here rather than loading
// os/kernel.js and os/daemon.js keeps this test about the merge itself, and
// lets a story list be posed at an exact daemon stage without driving the story.
function view(overrides) {
  const ctx = makeOsContext(Object.assign({
    wins: {},
    kernelListProcesses: () => [],
    getBuiltInProcesses: () => [],
  }, overrides || {}));
  return loadOsSources(ctx, ['os/process-view.js']);
}

test('a spawned process and a window process both appear, sorted by pid', () => {
  const ctx = view({
    wins: { terminal: { title: 'TERMINAL.exe - Command Prompt', pid: 2000 } },
    kernelListProcesses: () => [
      { pid: 2000, name: 'TERMINAL.exe', kind: 'system', state: 'running', winId: 'terminal' },
      { pid: 2001, name: 'job.script', kind: 'user', state: 'running', winId: null },
    ],
  });
  const rows = plain(ctx.buildProcessRows());
  assert.deepStrictEqual(rows.map(r => r.pid), [2000, 2001]);
  assert.deepStrictEqual(rows.map(r => r.kind), ['system', 'user']);
});

test('a spawned process carries null cpu and mem, not invented numbers', () => {
  const ctx = view({
    kernelListProcesses: () => [{ pid: 2001, name: 'job.script', kind: 'user', state: 'running', winId: null }],
  });
  const row = ctx.buildProcessRows()[0];
  assert.strictEqual(row.cpu, null);
  assert.strictEqual(row.mem, null);
  assert.strictEqual(row.isStory, false);
});

test('story rows get kind and state synthesized and are flagged isStory', () => {
  const ctx = view({
    getBuiltInProcesses: () => [{ pid: 512, name: 'soul_svc.exe', cpu: 7.4, mem: 31.2, protected: true }],
  });
  const rows = plain(ctx.buildProcessRows());
  assert.deepStrictEqual(rows, [{
    pid: 512, name: 'soul_svc.exe', kind: 'system', state: 'running',
    cpu: 7.4, mem: 31.2, winId: null, isStory: true,
  }]);
});

test('a window process name is derived live, so a retitle is reflected', () => {
  const wins = { notepad: { title: 'NOTEPAD.exe', pid: 2000 } };
  const ctx = view({
    wins,
    kernelListProcesses: () => [{ pid: 2000, name: 'NOTEPAD.exe', kind: 'system', state: 'running', winId: 'notepad' }],
  });
  assert.strictEqual(ctx.buildProcessRows()[0].name, 'NOTEPAD.exe');
  // Notepad retitles itself once a file is open. The kernel entry still holds
  // the registration-time name; the view must not.
  wins.notepad.title = 'README.txt \u2014 Notepad';
  assert.strictEqual(ctx.buildProcessRows()[0].name, 'README.txt');
});

test('the derivation splits on both separators sleepOS actually uses', () => {
  const ctx = view({});
  // Em dash: explorer and notepad. Hyphen: terminal, sysmon, defrag, browser,
  // daemon. Neither: calculator, regedit, dialogs.
  assert.strictEqual(ctx.processDisplayName('README.txt \u2014 Notepad', 'notepad'), 'README.txt');
  assert.strictEqual(ctx.processDisplayName('FILE EXPLORER \u2014 C:\\sleepOS', 'explorer'), 'FILE EXPLORER.exe');
  assert.strictEqual(ctx.processDisplayName('TERMINAL.exe - Command Prompt', 'terminal'), 'TERMINAL.exe');
  assert.strictEqual(ctx.processDisplayName('SYSMON.exe - System Monitor', 'sysmon'), 'SYSMON.exe');
  assert.strictEqual(ctx.processDisplayName('daemon.core - Containment', 'daemon'), 'daemon.core');
  assert.strictEqual(ctx.processDisplayName('Calculator', 'calc'), 'Calculator.exe');
  assert.strictEqual(ctx.processDisplayName('', 'orphan'), 'orphan.exe');
});

test('a kernel process with no window keeps its stored name', () => {
  const ctx = view({
    kernelListProcesses: () => [{ pid: 2001, name: 'job.script', kind: 'user', state: 'running', winId: null }],
  });
  assert.strictEqual(ctx.buildProcessRows()[0].name, 'job.script');
});

test('the story toggle filters story rows and leaves real ones', () => {
  const ctx = view({
    kernelListProcesses: () => [{ pid: 2001, name: 'job.script', kind: 'user', state: 'running', winId: null }],
    getBuiltInProcesses: () => [{ pid: 512, name: 'soul_svc.exe', cpu: 7.4, mem: 31.2, protected: true }],
  });
  const rows = ctx.buildProcessRows();
  assert.deepStrictEqual(rows.filter(r => !r.isStory).map(r => r.pid), [2001]);
  assert.deepStrictEqual(rows.map(r => r.pid), [512, 2001]);
});

test('pid 1 is present, which is why SYSMON used to be missing it', () => {
  // SYSMON enumerated `wins`, and the kernel has no window, so pid 1 could
  // never appear there while `ps` listed it throughout.
  const ctx = view({
    kernelListProcesses: () => [{ pid: 1, name: 'kernel', kind: 'system', state: 'running', winId: null }],
  });
  assert.deepStrictEqual(ctx.buildProcessRows().map(r => r.pid), [1]);
});

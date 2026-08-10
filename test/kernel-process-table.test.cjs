'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function kernel() {
  const ctx = loadOsSources(makeOsContext(), ['os/kernel.js']);
  ctx.kernelInit();
  return ctx;
}

// A worker the kernel can drive without a browser.
function fakeWorker() {
  const posted = [];
  return { posted, terminated: false, postMessage(m) { posted.push(m); }, terminate() { this.terminated = true; } };
}

test('pid 1 is the kernel and pids are monotonic', () => {
  const ctx = kernel();
  assert.strictEqual(ctx.kernelGetProcess(1).name, 'kernel');
  const a = ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  const b = ctx.kernelRegisterSystem('win-b', 'EXPLORER');
  assert.ok(b > a, 'pids must increase');
  ctx.kernelDeregisterSystem('win-a');
  const c = ctx.kernelRegisterSystem('win-c', 'CALC');
  assert.ok(c > b, 'a freed pid must never be reused');
});

test('deregistering a system process removes it from the table', () => {
  const ctx = kernel();
  const pid = ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  assert.ok(ctx.kernelGetProcess(pid));
  ctx.kernelDeregisterSystem('win-a');
  assert.strictEqual(ctx.kernelGetProcess(pid), null);
});

test('SIGKILL terminates the worker, SIGTERM only flags it', () => {
  const ctx = kernel();
  const w = fakeWorker();
  const pid = ctx.__spawnForTest(w, 'job.script');
  assert.strictEqual(ctx.kernelSignal(pid, 'SIGTERM'), true);
  assert.strictEqual(w.terminated, false, 'SIGTERM must be refusable');
  assert.ok(w.posted.some(m => m.type === 'signal' && m.sig === 'SIGTERM'));
  assert.strictEqual(ctx.kernelSignal(pid, 'SIGKILL'), true);
  assert.strictEqual(w.terminated, true);
});

test('signalling an unknown pid returns false rather than throwing', () => {
  assert.strictEqual(kernel().kernelSignal(9999, 'SIGKILL'), false);
});

// pid 1 is the kernel: kind 'system' with no winId. Before this fix that fell
// through the system-kind branch and returned true unconditionally, claiming
// success while closing nothing. The kernel must refuse - report false - not
// silently no-op while lying about it.
test('signalling pid 1 (the kernel) reports refusal rather than a false success', () => {
  const ctx = kernel();
  assert.strictEqual(ctx.kernelSignal(1, 'SIGTERM'), false);
  assert.strictEqual(ctx.kernelGetProcess(1).state, 'running', 'the kernel must not be killable');
});

test('signalling a system process with a real window still closes it and reports success', () => {
  let closed = null;
  const ctx = loadOsSources(makeOsContext({ closeWin: (id) => { closed = id; } }), ['os/kernel.js']);
  ctx.kernelInit();
  const pid = ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  assert.strictEqual(ctx.kernelSignal(pid, 'SIGTERM'), true);
  assert.strictEqual(closed, 'win-a');
});

test('exit records the code, notifies the waiter, and reaps', async () => {
  const ctx = kernel();
  const pid = ctx.__spawnForTest(fakeWorker(), 'job.script');
  const waited = ctx.kernelWait(pid);
  ctx.kernelExit(pid, 3);
  assert.strictEqual(await waited, 3);
  assert.strictEqual(ctx.kernelGetProcess(pid), null, 'the entry must be reaped');
});

test('orphans reparent to pid 1', () => {
  const ctx = kernel();
  const parent = ctx.__spawnForTest(fakeWorker(), 'parent.script');
  const child = ctx.__spawnForTest(fakeWorker(), 'child.script', parent);
  assert.strictEqual(ctx.kernelGetProcess(child).parentPid, parent);
  ctx.kernelExit(parent, 0);
  assert.strictEqual(ctx.kernelGetProcess(child).parentPid, 1);
});

test('listProcesses is sorted by pid and labels both kinds', () => {
  const ctx = kernel();
  ctx.__spawnForTest(fakeWorker(), 'job.script');
  ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  const list = ctx.kernelListProcesses();
  assert.deepStrictEqual(list.map(p => p.pid), list.map(p => p.pid).slice().sort((x, y) => x - y));
  assert.deepStrictEqual(new Set(list.map(p => p.kind)), new Set(['system', 'user']));
});

// os/daemon.js hardcodes a fictional process list (BUILTIN_PROCESS_SEED and the
// generated 500 + i*13 series) that never exceeds pid 1333, including pid 512,
// which is scripted dialogue and cannot move. Real allocation must stay clear of
// that whole range - see the KERNEL_FIRST_USER_PID comment in os/kernel.js.
// kernel.js is loaded in isolation here (no os/daemon.js), so the ceiling is
// asserted as the constant the story actually uses rather than loaded live.
const DAEMON_STORY_PID_CEILING = 1333;

test('pid 1 is reserved for the kernel and real allocation starts at 2000, clear of the daemon story', () => {
  const ctx = kernel();
  assert.strictEqual(ctx.kernelGetProcess(1).name, 'kernel');
  const first = ctx.kernelRegisterSystem('win-a', 'NOTEPAD');
  assert.ok(first >= 2000, `first real pid ${first} must be >= 2000`);
});

test('no allocated pid ever lands in the daemon story range', () => {
  const ctx = kernel();
  const allocated = [
    ctx.kernelRegisterSystem('win-a', 'NOTEPAD'),
    ctx.kernelRegisterSystem('win-b', 'EXPLORER'),
    ctx.__spawnForTest(fakeWorker(), 'job.script'),
  ];
  ctx.kernelDeregisterSystem('win-a');
  allocated.push(ctx.kernelRegisterSystem('win-c', 'CALC'));
  allocated.forEach(pid => {
    assert.ok(pid > DAEMON_STORY_PID_CEILING, `pid ${pid} collides with the daemon story range (<= ${DAEMON_STORY_PID_CEILING})`);
  });
});

// A fake `Worker` global lets kernelSpawn be exercised without a browser: it
// records what it was constructed with and what was posted to it, the same
// shape __spawnForTest hands the table for a process already running.
function FakeWorkerCtor(posts) {
  return function Worker(url) {
    this.url = url;
    this.posted = [];
    this.postMessage = (m) => { this.posted.push(m); posts.push(m); };
    this.terminate = () => {};
  };
}

function kernelWithSpawn(files) {
  const posts = [];
  const ctx = makeOsContext({
    Worker: FakeWorkerCtor(posts),
    vfsStatSync: (path) => (Object.prototype.hasOwnProperty.call(files, path) ? { name: path, dirName: '', kind: 'text' } : null),
    vfsReadFile: async (name) => files[name],
  });
  loadOsSources(ctx, ['os/kernel.js']);
  ctx.kernelInit();
  return { ctx, posts };
}

test('kernelSpawn allocates a real pid, registers a running user process, and posts init to the worker', async () => {
  const { ctx, posts } = kernelWithSpawn({ 'job.script': 'PRINT hi' });
  const pid = await ctx.kernelSpawn('job.script', ['a', 'b'], { cwd: 'DOCS' });
  assert.ok(pid >= 2000, 'a spawned process is a real pid, not a story one');
  const proc = ctx.kernelGetProcess(pid);
  assert.strictEqual(proc.kind, 'user');
  assert.strictEqual(proc.state, 'running');
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].type, 'init');
  assert.strictEqual(posts[0].source, 'PRINT hi');
  assert.deepStrictEqual(posts[0].argv, ['a', 'b']);
});

test('kernelSpawn refuses a missing script with ENOENT and creates no process', async () => {
  const { ctx } = kernelWithSpawn({});
  const before = ctx.kernelListProcesses().length;
  await assert.rejects(ctx.kernelSpawn('nope.script', [], {}), (err) => {
    assert.strictEqual(err.code, 'ENOENT');
    return true;
  });
  assert.strictEqual(ctx.kernelListProcesses().length, before, 'a failed spawn must not leave a table entry');
});

// _kernelWrite is what the worker's `write` syscall (os/kernel.js dispatch)
// and kernelSpawn's onerror backstop both call. It must route to the bound
// callback when one exists and retain output on the entry when it does not,
// per the comment above it in os/kernel.js.
test('_kernelWrite routes to the bound sink and retains output when nothing is bound', () => {
  const ctx = loadOsSources(makeOsContext(), ['os/kernel.js']);
  ctx.kernelInit();
  const seen = [];
  const boundProc = { onStdout: (line) => seen.push(line) };
  assert.strictEqual(ctx._kernelWrite(boundProc, 'stdout', 'hello'), true);
  assert.deepStrictEqual(seen, ['hello']);

  const unboundProc = {};
  ctx._kernelWrite(unboundProc, 'stderr', 'oops');
  assert.deepStrictEqual(plain(unboundProc.stderr), ['oops']);
});

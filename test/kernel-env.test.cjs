'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function kernel() {
  const ctx = loadOsSources(makeOsContext(), ['os/kernel.js']);
  ctx.kernelInit();
  return ctx;
}

function fakeWorker() {
  const posted = [];
  return { posted, terminated: false, postMessage(m) { posted.push(m); }, terminate() { this.terminated = true; } };
}

test('pid 1 is seeded with the default environment', () => {
  const ctx = kernel();
  const env = ctx.kernelGetProcess(1).env;
  assert.strictEqual(env.COMPUTERNAME, 'SOMA-686');
  assert.strictEqual(env.USERNAME, 'VISITOR');
  assert.strictEqual(env.PATH, 'C:\\sleepOS;[redacted]');
});

test('kernelDefaultEnv hands out a copy, not the shared table', () => {
  const ctx = kernel();
  const first = ctx.kernelDefaultEnv();
  first.USERNAME = 'TAMPERED';
  assert.strictEqual(ctx.kernelDefaultEnv().USERNAME, 'VISITOR');
});

test('a registered window inherits the environment', () => {
  const ctx = kernel();
  const pid = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  assert.strictEqual(ctx.kernelGetProcess(pid).env.PATH, ctx.kernelGetProcess(1).env.PATH);
});

test('a spawned process inherits from its parent, not from pid 1', () => {
  const ctx = kernel();
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  ctx.kernelGetProcess(parent).env.PATH = 'C:\\sleepOS\\DOCS';
  ctx.kernelGetProcess(parent).env.MARKER = 'set-by-terminal';
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  assert.strictEqual(ctx.kernelGetProcess(child).env.PATH, 'C:\\sleepOS\\DOCS');
  assert.strictEqual(ctx.kernelGetProcess(child).env.MARKER, 'set-by-terminal');
});

test('a child mutating its environment does not reach the parent', () => {
  const ctx = kernel();
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  ctx.kernelGetProcess(child).env.PATH = 'C:\\nowhere';
  ctx.kernelGetProcess(child).env.NEWVAR = 'child-only';
  assert.strictEqual(ctx.kernelGetProcess(parent).env.PATH, 'C:\\sleepOS;[redacted]');
  assert.strictEqual(ctx.kernelGetProcess(parent).env.NEWVAR, undefined);
});

test('a spawn with an unknown parent falls back to the kernel environment', () => {
  const ctx = kernel();
  const child = ctx.__spawnForTest(fakeWorker(), 'orphan.script', 99999);
  assert.strictEqual(ctx.kernelGetProcess(child).env.USERNAME, 'VISITOR');
});

test('getenv reads the process environment it is now backed by', async () => {
  const ctx = kernel();
  const worker = fakeWorker();
  const pid = ctx.__spawnForTest(worker, 'job.script', 1);
  await ctx.kernelHandleSyscall(pid, { seq: 7, name: 'getenv', args: ['USERNAME'] });
  // posted[0] was built inside the vm by the kernel's postMessage call, so it
  // carries that realm's Object.prototype - plain() before comparing.
  assert.deepStrictEqual(plain(worker.posted[0]), { type: 'syscall-reply', seq: 7, ok: true, value: 'VISITOR' });
});

// kernelSpawn is the fourth env-populating site, and the one that matters most
// in production: it is the only path a real script takes. __spawnForTest above
// is a test seam that bypasses vfsStatSync/vfsReadFile and the Worker
// constructor entirely, so nothing above this line exercises kernelSpawn's own
// env wiring. Reuses the FakeWorkerCtor/kernelWithSpawn shape from
// test/kernel-process-table.test.cjs:172-191 rather than inventing a new one -
// a fake `Worker` global that records what it was constructed with and what
// was posted to it, plus stubbed vfsStatSync/vfsReadFile so kernelSpawn can
// resolve a script with no real filesystem.
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

test('kernelSpawn with no parentPid gets a real environment, not {}', async () => {
  const { ctx } = kernelWithSpawn({ 'job.script': 'PRINT hi' });
  const pid = await ctx.kernelSpawn('job.script', [], { cwd: '' });
  const env = ctx.kernelGetProcess(pid).env;
  assert.strictEqual(env.USERNAME, 'VISITOR');
  assert.strictEqual(env.PATH, 'C:\\sleepOS;[redacted]');
});

// This is the exact regression the task exists to fix: kernelSpawn's parentPid
// used to be discarded (env was hardcoded to `{}`, so which parent it came
// from was moot). If a future edit reintroduces `parentPid: KERNEL_PID`
// unconditionally instead of `opts.parentPid || KERNEL_PID`, this goes red -
// the spawned child would carry pid 1's environment instead of the terminal's,
// and MARKER (which only the terminal's env has) would be missing.
test('kernelSpawn inherits from opts.parentPid, not unconditionally from pid 1', async () => {
  const { ctx } = kernelWithSpawn({ 'job.script': 'PRINT hi' });
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  ctx.kernelGetProcess(parent).env.PATH = 'C:\\sleepOS\\DOCS';
  ctx.kernelGetProcess(parent).env.MARKER = 'set-by-terminal';
  const pid = await ctx.kernelSpawn('job.script', [], { cwd: '', parentPid: parent });
  const proc = ctx.kernelGetProcess(pid);
  assert.strictEqual(proc.parentPid, parent);
  assert.strictEqual(proc.env.PATH, 'C:\\sleepOS\\DOCS');
  assert.strictEqual(proc.env.MARKER, 'set-by-terminal');
});

// The env kernelSpawn stores on the table entry must be the same one it hands
// to the worker in the init message - if a future edit drops `env` from the
// postMessage call, posted.env goes undefined and this goes red. Deliberately
// asserts on values only (not on reference identity or on mutating posts[0].env
// and checking proc.env back) - kernelSpawn shares one object between the table
// entry and the postMessage payload, which is fine in production because a real
// Worker.postMessage structured-clones, but the fake Worker here does not, so
// an identity/mutation assertion would pass or fail for a reason that does not
// exist in production.
// This is the regression the null-prototype fix exists for. Before it, both
// helpers built the env with Object.assign({}, ...), which carries
// Object.prototype - and scriptResolveText (os/script/interp.js) expands
// $name as `vars[key] ?? ''`, a prototype-reachable lookup. That let
// $constructor and $toString resolve to native function source, and made
// __proto__ silently unassignable via SET. Object.create(null) closes both
// holes; this asserts the prototype is actually null, not just that the
// values look right (deepStrictEqual would pass on a polluted object too).
test('kernelDefaultEnv and kernelInheritEnv build a null-prototype object', () => {
  const ctx = kernel();
  const fresh = ctx.kernelDefaultEnv();
  assert.strictEqual(Object.getPrototypeOf(fresh), null);
  assert.strictEqual(fresh.constructor, undefined);
  assert.strictEqual(fresh.toString, undefined);

  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  const child = ctx.__spawnForTest(fakeWorker(), 'job.script', parent);
  const inherited = ctx.kernelGetProcess(child).env;
  assert.strictEqual(Object.getPrototypeOf(inherited), null);
  assert.strictEqual(inherited.constructor, undefined);
  assert.strictEqual(inherited.toString, undefined);
});

test('kernelSpawn posts the same environment values it stores on the process entry', async () => {
  const { ctx, posts } = kernelWithSpawn({ 'job.script': 'PRINT hi' });
  const parent = ctx.kernelRegisterSystem('terminal', 'TERMINAL.exe');
  ctx.kernelGetProcess(parent).env.MARKER = 'set-by-terminal';
  const pid = await ctx.kernelSpawn('job.script', [], { cwd: '', parentPid: parent });
  const proc = ctx.kernelGetProcess(pid);
  assert.strictEqual(posts.length, 1);
  assert.ok(posts[0].env, 'the init message must carry an env field');
  assert.strictEqual(posts[0].env.MARKER, 'set-by-terminal');
  assert.strictEqual(posts[0].env.PATH, proc.env.PATH);
  assert.strictEqual(posts[0].env.USERNAME, proc.env.USERNAME);
});

// The kernel owns the process table and the filesystem. Processes run in Workers
// and never touch storage; every path they name arrives here as a syscall. That
// is what lets phase 4 swap the storage backend without a process noticing.
//
// Two kinds of process share one table. System processes are the built-in apps
// on the main thread: real pids, real lifetimes, and `kill` closes the window,
// which genuinely ends them. User processes are spawned scripts in Workers:
// isolated, and killable against their will. This mirrors the distinction a Unix
// kernel makes between kernel threads and user processes.
var _kernelProcs = new Map();     // pid -> entry
var _kernelByWinId = new Map();   // winId -> pid
var _kernelNextPid = 1;
var _kernelWaiters = new Map();   // pid -> [resolve]

// Per-pid figures reported by workers. Absent means "not measured", which is
// what SYSMON renders as a dash - and after this phase a dash has one precise
// meaning: no measurable execution context.
var _kernelMetrics = new Map();

function kernelMetricsFor(pid) {
  const m = _kernelMetrics.get(pid);
  if (!m) return { cpu: null, mem: null, memUnit: null };
  return { cpu: m.cpu, mem: m.mem, memUnit: 'bytes' };
}

function kernelRecordMetrics(pid, msg) {
  const prev = _kernelMetrics.get(pid) || { lastBusyMs: 0, lastWallMs: 0 };
  const dBusy = Math.max(0, msg.busyMs - prev.lastBusyMs);
  const dWall = Math.max(0, msg.wallMs - prev.lastWallMs);
  _kernelMetrics.set(pid, {
    lastBusyMs: msg.busyMs,
    lastWallMs: msg.wallMs,
    // Share of one core since the previous heartbeat, not since spawn: a
    // script that looped hard then went idle must stop reporting busy.
    cpu: dWall > 0 ? Math.min(100, (dBusy / dWall) * 100) : 0,
    mem: msg.memBytes == null ? null : msg.memBytes,
  });
}

const KERNEL_PID = 1;

// Pids 2 through 1333 (and the generated 500 + i*13 series) belong to the daemon
// story's fictional process list in os/daemon.js - soul_svc.exe, mirror_watch.exe,
// and the rest, including pid 512, which is scripted dialogue ("It restarts pid
// 512. It is not pid 512."). Those are narrative constants and must never move.
// Real allocation used to land in 2000-7999 for the same reason, back when
// pidFromId hashed window ids into that range; this restores that floor so a
// real window can never again collide with a scripted pid. Lowering this number
// does not just look untidy - it breaks a story beat.
const KERNEL_FIRST_USER_PID = 2000;

// The machine's identity, and the root of the environment tree. This used to
// be DEFAULT_SHELL_VARS inside apps/terminal.js's openTerminal closure, which
// meant the OS's own name and PATH lived inside one window's local scope and
// no other process could see them. Every process inherits from its parent and
// every chain ends here, at pid 1.
//
// PATH is read by programResolve (os/programs.js). It is no longer decorative:
// changing it changes what the terminal can find.
const KERNEL_DEFAULT_ENV = {
  COMPUTERNAME: 'SOMA-686',
  USERNAME: 'VISITOR',
  OS: 'sleepOS 0.9b2',
  SOUL_INTEGRITY: '87',
  DAEMON_COUNT: '7',
  DAEMON_KNOWN: '4',
  TEMPORAL_DRIFT: '+/-2.3yr',
  VOID_PRESSURE: '12',
  OBSERVER_COUNT: '[classified]',
  PATH: 'C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]',
};

// A copy every time. Handing out the shared table would let one process's SET
// rewrite the defaults every later process inherits.
//
// Object.create(null), not {}: scriptResolveText (os/script/interp.js)
// expands `$name` as `vars[key] ?? ''`, which is a prototype-reachable
// lookup. An ordinary object leaks `constructor`, `toString` and every other
// Object.prototype member into the variable namespace ($constructor prints
// "function Object() { [native code] }"), and it also makes `__proto__`
// unassignable - `SET __proto__=hello` silently hits Object.prototype's
// `__proto__` setter instead of creating a variable. os/worker/host.js
// rebuilds the environment the same way for exactly this reason, and
// os/script/interp.js:533 falls back to `Object.create(null)` when no vars
// are supplied at all - this keeps the process table's own default in step
// with that fallback.
function kernelDefaultEnv() {
  return Object.assign(Object.create(null), KERNEL_DEFAULT_ENV);
}

// Shallow copy of a flat string map, which is what exec does: a child gets the
// parent's environment as it stood at spawn, and can never write back into it.
// Falls back to the kernel's own environment when the parent is gone or was
// never given - an orphan gets the machine defaults rather than nothing.
// Object.create(null) here too, for the same reason as kernelDefaultEnv above -
// a plain {} would reintroduce the prototype-pollution hole on every child a
// process spawns, not just on the machine defaults.
function kernelInheritEnv(parentPid) {
  const parent = _kernelProcs.get(parentPid);
  if (parent && parent.env) return Object.assign(Object.create(null), parent.env);
  const root = _kernelProcs.get(KERNEL_PID);
  return root && root.env ? Object.assign(Object.create(null), root.env) : kernelDefaultEnv();
}

function kernelInit() {
  _kernelProcs = new Map();
  _kernelByWinId = new Map();
  _kernelWaiters = new Map();
  _kernelNextPid = 1;
  const pid = _kernelAllocPid();
  _kernelProcs.set(pid, {
    pid, name: 'kernel', kind: 'system', state: 'running', parentPid: 0,
    cwd: '', env: kernelDefaultEnv(), worker: null, winId: null, exitCode: null, startedAt: Date.now(),
  });
  _kernelNextPid = KERNEL_FIRST_USER_PID;
}

// Monotonic and never reused within a session. Reuse would make a stale pid in a
// terminal scrollback address a different process, which is exactly the kind of
// lie this phase exists to remove.
function _kernelAllocPid() { return _kernelNextPid++; }

function kernelRegisterSystem(winId, name) {
  const existing = _kernelByWinId.get(winId);
  if (existing) return existing;
  const pid = _kernelAllocPid();
  _kernelProcs.set(pid, {
    pid, name, kind: 'system', state: 'running', parentPid: KERNEL_PID,
    cwd: '', env: kernelInheritEnv(KERNEL_PID), worker: null, winId, exitCode: null, startedAt: Date.now(),
  });
  _kernelByWinId.set(winId, pid);
  return pid;
}

function kernelDeregisterSystem(winId) {
  const pid = _kernelByWinId.get(winId);
  if (!pid) return;
  _kernelByWinId.delete(winId);
  kernelExit(pid, 0);
}

function kernelGetProcess(pid) { return _kernelProcs.get(pid) || null; }

// The terminal knows its own winId but needs its pid to parent the processes
// it spawns.
function kernelPidForWin(winId) { return _kernelByWinId.get(winId) || null; }

function kernelListProcesses() {
  return [..._kernelProcs.values()].sort((a, b) => a.pid - b.pid);
}

function kernelSignal(pid, sig) {
  const proc = _kernelProcs.get(pid);
  if (!proc || proc.state !== 'running') return false;
  if (proc.kind === 'system') {
    // The kernel itself (pid 1) is a system-kind entry with no winId, so it
    // used to fall through this branch and report success while closing
    // nothing - a lie. Refuse instead of pretending: the kernel is not
    // killable, and the caller can tell the difference now.
    if (!proc.winId || typeof closeWin !== 'function') return false;
    closeWin(proc.winId);
    return true;
  }
  if (sig === 'SIGKILL') {
    // kernelExit terminates proc.worker itself now (see below) - do not repeat
    // it here, or the "who is responsible for cleanup" story splits in two.
    kernelExit(pid, 137);
    return true;
  }
  // SIGTERM is a request. The host loop checks it between instructions, so a
  // process can finish what it is doing and exit cleanly - or ignore it.
  if (proc.worker) proc.worker.postMessage({ type: 'signal', sig: 'SIGTERM' });
  return true;
}

function kernelExit(pid, code) {
  const proc = _kernelProcs.get(pid);
  if (!proc || proc.state === 'zombie') return;
  proc.state = 'zombie';
  proc.exitCode = code;
  // A dedicated Worker outlives the return of its message handler - it is not
  // reclaimed just because the process table entry is gone. Every exit path
  // (normal `exit` syscall, SIGTERM honoured by the script, onerror, SIGKILL)
  // funnels through here, so this is the one place that needs to terminate it.
  // System-kind entries (the kernel itself, windows registered through
  // kernelRegisterSystem) never have a `worker` property, so this is a no-op
  // for them.
  if (proc.worker) proc.worker.terminate();
  // Order versus the delete below does not matter: this closes over `pid`
  // directly rather than looking the parent up in the map, and JS is
  // single-threaded, so there is no intermediate state anything could observe
  // either way.
  _kernelProcs.forEach(child => {
    if (child.parentPid !== pid) return;
    child.parentPid = KERNEL_PID;
    // The sinks close over the exiting parent's window: onStdout writes into
    // that window's output element. Clearing them makes _kernelWrite fall back
    // to buffering on the entry, so a process outliving its terminal keeps
    // running and its output is retained rather than written into a detached
    // DOM node.
    child.onStdout = null;
    child.onStderr = null;
  });
  const waiters = _kernelWaiters.get(pid) || [];
  _kernelWaiters.delete(pid);
  waiters.forEach(resolve => resolve(code));
  if (proc.winId) _kernelByWinId.delete(proc.winId);
  _kernelProcs.delete(pid);
  _kernelMetrics.delete(pid);
}

// TRAP: kernelWait(pid) on a pid that has already been reaped resolves 0,
// the same value as a process that exited successfully - because kernelExit
// deletes the table entry, there is no way to tell "already gone" apart from
// "exited with code 0" once you get here. Deliberate, not fixed: nothing
// outside tests calls kernelWait today. Fixing it for real means keeping a
// zombie entry (with its exitCode) around after kernelExit until something
// waits on it, rather than deleting immediately - a real design change to
// process lifecycle, not a one-line patch. Whoever adds the first real
// caller needs to make that call, not inherit this silently.
function kernelWait(pid) {
  const proc = _kernelProcs.get(pid);
  if (!proc) return Promise.resolve(0);
  return new Promise(resolve => {
    const list = _kernelWaiters.get(pid) || [];
    list.push(resolve);
    _kernelWaiters.set(pid, list);
  });
}

// Test seam: register a user process against any object exposing postMessage and
// terminate, so the table can be exercised without a browser.
function __spawnForTest(worker, name, parentPid) {
  const pid = _kernelAllocPid();
  const parent = parentPid || KERNEL_PID;
  _kernelProcs.set(pid, {
    pid, name, kind: 'user', state: 'running', parentPid: parent,
    cwd: '', env: kernelInheritEnv(parent), worker, winId: null, exitCode: null, startedAt: Date.now(),
  });
  return pid;
}

// ── Syscall dispatch ───────────────────────────────────────────────
// A Worker has no filesystem of its own; every path it names arrives here as
// a syscall message and every reply crosses back the same way. Defaults to
// the real VFS. Tests replace it so dispatch can be exercised without
// mounting a filesystem.
var _kernelFs = null;
function kernelSetFs(impl) { _kernelFs = impl; }
function _kernelFsImpl() {
  if (_kernelFs) return _kernelFs;
  return {
    async readFile(path, cwd) { return await vfsReadFile(path, cwd); },
    async writeFile(path, text, cwd) { return await vfsWriteFile(path, text, cwd); },
    async stat(path, cwd) { return vfsStatSync(path, cwd); },
    async mkdir(path, cwd) { return await vfsMkdir(path, cwd); },
    // deleteVirtualPath, not vfsUnlink: it enforces the Recycle Bin and the
    // story's undeletable files, and a worker must not be able to bypass either.
    // deleteVirtualPath never throws - a denied or refused delete is a normal
    // outcome it reports as a result object ({ok:false, message, details}),
    // not an exceptional one. Do NOT inspect that .ok here and throw a coded
    // error instead: os/script/interp.js's `del`/`rm` case (around line 416)
    // reads `deletion.ok` itself and turns a false into a script error - that
    // IS the adapter contract for this method, mirrored unchanged by the
    // worker-side adapter's `unlink` (os/worker/syscalls.js) and the
    // main-thread one (os/script/interp.js's makeVfsScriptFs, ~line 595).
    // `reply.ok` at the syscall-reply boundary only means "this syscall did
    // not throw"; it is a per-method contract, not a blanket success signal,
    // and for unlink the success/failure signal is the returned object's own
    // `.ok`. Throwing here would make the worker path reject where the
    // main-thread path still resolves to an object, splitting the one
    // behavior this boundary exists to keep unified.
    async unlink(path, cwd) { return await deleteVirtualPath(path, cwd); },
    // vfsDirExistsSync -> vfsDirNodeSync, which resolves the whole path as a
    // directory and ignores cwd. That disagrees with a stat-based derivation on
    // root paths and relative names, so this gets its own syscall rather than
    // being derived from stat() on the other side of the boundary.
    async dirExists(path) { return vfsDirExistsSync(path); },
    async list(path) { return vfsListSync(path); },
  };
}

async function kernelHandleSyscall(pid, msg) {
  const proc = _kernelProcs.get(pid);
  // A worker can post one last syscall after SIGKILL, or after its own exit
  // syscall is already in flight. Dropping it is correct; replying would post
  // to a terminated worker.
  if (!proc || proc.state !== 'running') return;
  const { seq, name } = msg;
  // One normalization for the whole dispatch: a missing (or null) `args` is as
  // valid as an empty one, for every syscall including `exit`, which used to
  // read args[0] before this line ran and throw an unhandled TypeError on a
  // bare `exit` with no args key at all.
  const args = msg.args || [];
  if (name === 'exit') { kernelExit(pid, Math.trunc(args[0] ?? 0)); return; }
  try {
    const value = await _kernelSyscall(proc, name, args);
    proc.worker.postMessage({ type: 'syscall-reply', seq, ok: true, value });
  } catch (err) {
    // Only code and message survive structured cloning of an Error subclass in a
    // useful form, and the interpreter branches on code to build script errors.
    proc.worker.postMessage({
      type: 'syscall-reply', seq, ok: false,
      error: { code: err && err.code ? err.code : 'EIO', message: (err && err.message) || String(err) },
    });
  }
}

// The directory a syscall resolves against is per-call, not per-process: the
// interpreter passes the resolved directory of the target, which for `run` and
// `grep` is the target's own directory rather than the script's. Fall back to
// the process cwd only when the caller supplied none.
function _kernelCwd(proc, arg) { return arg === undefined ? proc.cwd : arg; }

async function _kernelSyscall(proc, name, args) {
  const fs = _kernelFsImpl();
  switch (name) {
    case 'readFile':  return await fs.readFile(args[0], _kernelCwd(proc, args[1]));
    case 'writeFile': return await fs.writeFile(args[0], args[1], _kernelCwd(proc, args[2]));
    case 'stat':      return await fs.stat(args[0], _kernelCwd(proc, args[1]));
    case 'mkdir':     return await fs.mkdir(args[0], _kernelCwd(proc, args[1]));
    case 'unlink':    return await fs.unlink(args[0], _kernelCwd(proc, args[1]));
    case 'dirExists': return await fs.dirExists(args[0]);
    // vfsListSync, like vfsDirExistsSync, resolves a directory path directly
    // and ignores cwd - no _kernelCwd fallback here, same as dirExists.
    case 'list':      return await fs.list(args[0]);
    case 'cwd':       return proc.cwd;
    case 'getenv':    return proc.env[args[0]];
    case 'sleep':     return await new Promise(r => setTimeout(r, Math.max(0, Math.trunc(args[0]) || 0)));
    case 'write':     return _kernelWrite(proc, args[0], args[1]);
    case 'spawn':     return await kernelSpawn(args[0], args[1] || [], { parentPid: proc.pid, cwd: proc.cwd });
    case 'ui.open':   return _kernelUiOpen(proc, args[0], args[1]);
    case 'ui.openSystem': return _kernelUiOpenSystem(proc, args[0], args[1], args[2]);
    case 'ui.isSystemPath': return _kernelUiIsSystemPath(proc, args[0]);
    default: {
      const err = new Error('unknown syscall: ' + name);
      err.code = 'ENOSYS';
      throw err;
    }
  }
}

const WORKER_BUNDLE_URL = 'sleep-os-worker.bundle.js';

// Streams live on the kernel side so a process cannot write anywhere the kernel
// has not bound. The terminal binds stdout to its window; unbound output is
// retained on the entry so nothing is silently dropped.
function _kernelWrite(proc, stream, text) {
  const line = String(text == null ? '' : text);
  const sink = stream === 'stderr' ? proc.onStderr : proc.onStdout;
  if (typeof sink === 'function') sink(line);
  else (proc[stream] = proc[stream] || []).push(line);
  return true;
}

// scriptOpenUiTarget/scriptOpenSystemProgram (os/script/interp.js) are the one
// shared implementation makeVfsScriptFs's openUi/openSystem also call - see
// the comments there. Both only ever run on the main thread, so calling them
// from here (which only happens by answering a worker's syscall) is safe.
function _kernelUiOpen(proc, path, cwd) {
  return scriptOpenUiTarget(path, _kernelCwd(proc, cwd));
}

function _kernelUiOpenSystem(proc, name, cwd, arg) {
  return scriptOpenSystemProgram(name, _kernelCwd(proc, cwd), arg);
}

function _kernelUiIsSystemPath(proc, path) {
  return isVisibleSystemPath(path, { includeExplorer: true });
}

async function kernelSpawn(path, argv, opts) {
  opts = opts || {};
  const cwd = opts.cwd || '';
  const st = vfsStatSync(path, cwd);
  if (!st || st.kind !== 'text') {
    const err = new Error('script not found: ' + path);
    err.code = 'ENOENT';
    throw err;
  }
  const source = await vfsReadFile(st.name, st.dirName);
  const worker = new Worker(WORKER_BUNDLE_URL);
  const pid = _kernelAllocPid();
  const parentPid = opts.parentPid || KERNEL_PID;
  const env = kernelInheritEnv(parentPid);
  _kernelProcs.set(pid, {
    pid, name: st.name, kind: 'user', state: 'running',
    parentPid, cwd: st.dirName, env,
    worker, winId: null, exitCode: null, startedAt: Date.now(),
    onStdout: opts.onStdout || null, onStderr: opts.onStderr || null,
  });
  worker.onmessage = e => {
    if (e.data && e.data.type === 'metrics') { kernelRecordMetrics(pid, e.data); return; }
    void kernelHandleSyscall(pid, e.data);
  };
  // A worker that throws before its first syscall would otherwise stay running
  // forever in the table.
  worker.onerror = e => { _kernelWrite(_kernelProcs.get(pid) || {}, 'stderr', e.message || 'worker error'); kernelExit(pid, 1); };
  // env crosses at init rather than being fetched with the getenv syscall on
  // demand: scriptResolveText (os/script/interp.js) expands $name with a
  // synchronous object lookup inside a regex replace, so a lazy read would
  // mean making variable expansion async through the whole interpreter in both
  // realms. Copying at exec time is what real systems do anyway, and it hands
  // the child a private copy for free.
  worker.postMessage({ type: 'init', source, name: st.name, cwd: st.dirName, argv, env });
  return pid;
}

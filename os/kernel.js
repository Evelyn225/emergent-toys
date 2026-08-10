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

function kernelInit() {
  _kernelProcs = new Map();
  _kernelByWinId = new Map();
  _kernelWaiters = new Map();
  _kernelNextPid = 1;
  const pid = _kernelAllocPid();
  _kernelProcs.set(pid, {
    pid, name: 'kernel', kind: 'system', state: 'running', parentPid: 0,
    cwd: '', env: {}, worker: null, winId: null, exitCode: null, startedAt: Date.now(),
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
    cwd: '', env: {}, worker: null, winId, exitCode: null, startedAt: Date.now(),
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

function kernelListProcesses() {
  return [..._kernelProcs.values()].sort((a, b) => a.pid - b.pid);
}

function kernelSignal(pid, sig) {
  const proc = _kernelProcs.get(pid);
  if (!proc || proc.state !== 'running') return false;
  if (proc.kind === 'system') {
    if (proc.winId && typeof closeWin === 'function') closeWin(proc.winId);
    return true;
  }
  if (sig === 'SIGKILL') {
    if (proc.worker) proc.worker.terminate();
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
  // Reparent before reaping, or a child would briefly point at a pid that is
  // already gone.
  _kernelProcs.forEach(child => { if (child.parentPid === pid) child.parentPid = KERNEL_PID; });
  const waiters = _kernelWaiters.get(pid) || [];
  _kernelWaiters.delete(pid);
  waiters.forEach(resolve => resolve(code));
  if (proc.winId) _kernelByWinId.delete(proc.winId);
  _kernelProcs.delete(pid);
}

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
  _kernelProcs.set(pid, {
    pid, name, kind: 'user', state: 'running', parentPid: parentPid || KERNEL_PID,
    cwd: '', env: {}, worker, winId: null, exitCode: null, startedAt: Date.now(),
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

// Stubs, deliberately: dispatch is complete now, but _kernelWrite and
// _kernelUiOpen/_kernelUiOpenSystem/_kernelUiIsSystemPath are wired for real in
// a later task, and kernelSpawn refuses rather than pretend to work until then.
function _kernelWrite() { return true; }
function _kernelUiOpen() { return true; }
function _kernelUiOpenSystem() { return true; }
// Task 6 wires this to isVisibleSystemPath; until then nothing is a system path.
function _kernelUiIsSystemPath() { return false; }
async function kernelSpawn() { const e = new Error('spawn not wired yet'); e.code = 'ENOSYS'; throw e; }

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

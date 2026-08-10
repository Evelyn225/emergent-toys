// Worker side of the syscall boundary. Every call is a postMessage with a
// sequence number; the reply resolves the matching promise. The worker has no
// filesystem, no DOM, and no VFS - this file is its entire view of the OS.
var _sysSeq = 0;
var _sysPending = new Map();

function sysCall(name, args) {
  const seq = ++_sysSeq;
  return new Promise((resolve, reject) => {
    _sysPending.set(seq, { resolve, reject });
    self.postMessage({ type: 'syscall', seq, name, args: args || [] });
  });
}

function sysHandleReply(msg) {
  const pending = _sysPending.get(msg.seq);
  if (!pending) return;
  _sysPending.delete(msg.seq);
  if (msg.ok) { pending.resolve(msg.value); return; }
  // Rebuild an error the interpreter recognises. It branches on `.code` to turn
  // a filesystem failure into a script error carrying a line number, and that
  // behaviour must survive the trip across the boundary.
  const err = new Error(msg.error.message);
  err.name = 'VfsError';
  err.code = msg.error.code;
  pending.reject(err);
}

// The same adapter shape makeVfsScriptFs produces on the main thread. The
// interpreter cannot tell which one it has. Every method is a syscall, including
// isSystemPath: the system-file list depends on story state, so a snapshot taken
// at spawn would go stale.
//
// The directory argument is forwarded on every path syscall rather than
// dropped: the interpreter passes the resolved directory of the *target*
// (interp.js openUi/readFile/run/grep), which is not always the calling
// script's own cwd. The kernel falls back to the process's cwd only when the
// caller supplies none - see _kernelCwd in os/kernel.js.
function makeSyscallScriptFs() {
  return {
    async stat(path, cwd) { return await sysCall('stat', [path, cwd]); },
    async exists(path, cwd) { return (await sysCall('stat', [path, cwd])) !== null; },
    async dirExists(path) { return await sysCall('dirExists', [path]); },
    async list(path) { return await sysCall('list', [path]); },
    async readFile(path, cwd) { return await sysCall('readFile', [path, cwd]); },
    async writeFile(path, text, cwd) { return await sysCall('writeFile', [path, text, cwd]); },
    async mkdir(path, cwd) { return await sysCall('mkdir', [path, cwd]); },
    async unlink(path, cwd) { return await sysCall('unlink', [path, cwd]); },
    async openUi(path, cwd) { return await sysCall('ui.open', [path, cwd]); },
    async openSystem(name, cwd, arg) { return await sysCall('ui.openSystem', [name, cwd, arg]); },
    async isSystemPath(path) { return await sysCall('ui.isSystemPath', [path]); },
    // A worker has no DOM to refresh, and the kernel already dispatches
    // 'fs-changed' from _vfsQueue on every mutation it performs on the worker's
    // behalf. Calling back would be a second, redundant event.
    async notifyChanged() {},
    async clearScreen() {},
  };
}

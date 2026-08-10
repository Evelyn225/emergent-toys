// Worker bootstrap. Receives one init message carrying the script source, argv
// and cwd, runs the interpreter against the syscall-backed filesystem, and
// reports the exit code. SIGTERM sets a flag the interpreter's abort signal
// observes between instructions, so the process can refuse it - which is the
// difference between SIGTERM and SIGKILL.
var _hostAborted = false;
// scriptSleep (os/script/interp.js) is what makes SIGTERM interrupt a running
// WAIT rather than merely being noticed at the next instruction boundary up
// to 30s later: it registers a real 'abort' listener on the signal and rejects
// as soon as one fires. A signal whose addEventListener is a no-op - which
// this was - never wakes it, so a killed process' WAIT ran to completion
// regardless of SIGTERM. This is a minimal AbortSignal-like target: dispatch
// is a plain synchronous callback list, not the DOM event system.
var _hostAbortListeners = [];

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'syscall-reply') { sysHandleReply(msg); return; }
  if (msg.type === 'signal' && msg.sig === 'SIGTERM') {
    _hostAborted = true;
    _hostAbortListeners.slice().forEach(fn => fn());
    return;
  }
  if (msg.type !== 'init') return;

  const signal = {
    get aborted() { return _hostAborted; },
    addEventListener(type, fn) { if (type === 'abort') _hostAbortListeners.push(fn); },
    removeEventListener(type, fn) {
      if (type !== 'abort') return;
      const i = _hostAbortListeners.indexOf(fn);
      if (i >= 0) _hostAbortListeners.splice(i, 1);
    },
  };
  let code = 0;
  try {
    code = await execScript(msg.source, line => sysCall('write', ['stdout', String(line)]), {
      fs: makeSyscallScriptFs(),
      dirName: msg.cwd,
      sourceName: msg.name,
      args: msg.argv || [],
      signal,
    });
  } catch (err) {
    await sysCall('write', ['stderr', (err && err.message) || String(err)]);
    code = 1;
  }
  self.postMessage({ type: 'syscall', seq: 0, name: 'exit', args: [code] });
};

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
  const startedAt = performance.now();
  // Busy is wall minus parked. Reported on a heartbeat so a long-running
  // script shows up while it runs, not only when it finishes - which is the
  // whole point of watching RUNAWAY.exe pin the graph.
  const heartbeat = setInterval(function () {
    const wallMs = performance.now() - startedAt;
    self.postMessage({
      type: 'metrics',
      // parkTotalMs() reads its own, slightly later clock than wallMs above
      // (it now counts an open park through to the moment it's called - see
      // os/park.js). On a script that has been parked for its entire life,
      // that later read can exceed this wallMs snapshot by a hair, which
      // would otherwise report negative busy time. Clamp rather than let
      // that arithmetic quirk become a visible number.
      busyMs: Math.max(0, wallMs - parkTotalMs()),
      wallMs,
      // Read live rather than captured at spawn: the whole point of the column
      // is that it responds to what the script allocates while it runs.
      memBytes: scriptLiveStateBytes(),
    });
  }, 1000);
  let code = 0;
  try {
    code = await execScript(msg.source, line => sysCall('write', ['stdout', String(line)]), {
      fs: makeSyscallScriptFs(),
      dirName: msg.cwd,
      sourceName: msg.name,
      args: msg.argv || [],
      // The inherited environment arrives as ordinary script variables, so a
      // spawned script reads $PATH and $USERNAME with no new syntax. This is
      // already a private copy (kernelInheritEnv copied it), and Object.assign
      // onto a null-prototype object matches what execScript builds when no
      // vars are supplied - see os/script/interp.js's `options.vars ||
      // Object.create(null)`.
      vars: Object.assign(Object.create(null), msg.env || {}),
      signal,
    });
  } catch (err) {
    await sysCall('write', ['stderr', (err && err.message) || String(err)]);
    code = 1;
  }
  clearInterval(heartbeat);
  self.postMessage({ type: 'syscall', seq: 0, name: 'exit', args: [code] });
};

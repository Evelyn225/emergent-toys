// Worker bootstrap. Receives one init message carrying the script source, argv
// and cwd, runs the interpreter against the syscall-backed filesystem, and
// reports the exit code. SIGTERM sets a flag the interpreter's abort signal
// observes between instructions, so the process can refuse it - which is the
// difference between SIGTERM and SIGKILL.
var _hostAborted = false;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'syscall-reply') { sysHandleReply(msg); return; }
  if (msg.type === 'signal' && msg.sig === 'SIGTERM') { _hostAborted = true; return; }
  if (msg.type !== 'init') return;

  const signal = { get aborted() { return _hostAborted; }, addEventListener() {}, removeEventListener() {} };
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

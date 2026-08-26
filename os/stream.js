// -- Line streams ---------
// A "source" here is any async iterable of strings, one per line. The
// pipeline in apps/terminal.js passes sources between stages instead of
// arrays, which is what lets a stage that never terminates - a spawned
// RUNAWAY.exe - still feed a downstream GREP.
//
// Nothing in this file touches the DOM, the VFS or the kernel. That is
// deliberate and is the same split os/park.js and os/instrument.js use: the
// semantics get pinned down in node, and apps/terminal.js only wires them up.

// A bounded producer. Twenty of the twenty-five pipeable commands build a
// finite array of lines and genuinely ARE whole-array producers, so wrapping
// them here is the honest shape rather than a shortcut - rewriting DIR as a
// generator would add no truth and one more thing to get wrong.
async function* streamFromLines(lines) {
  const list = Array.isArray(lines) ? lines : [];
  for (let i = 0; i < list.length; i++) yield list[i];
}

// The only real transformer among the built-in commands.
async function* streamGrep(source, re) {
  for await (const line of source) {
    if (re.test(line)) yield line;
  }
}

// A fold. WC and every redirect target are folds by nature: neither can emit
// anything until it has seen the whole stream, so neither is a failure of
// streaming.
async function streamCollect(source) {
  const out = [];
  if (!source) return out;
  for await (const line of source) out.push(line);
  return out;
}

// The shim. runPipeStage still returns a plain array for the bounded
// producers; the pipeline driver normalises whatever it gets, so a command
// only opts into streaming when streaming actually buys it something.
function streamNormalize(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return streamFromLines(value);
  return value;
}

// A source fed from the outside, for output that arrives on a callback rather
// than from a loop we control - specifically a spawned worker's onStdout.
//
// The wake/await handshake has no lost-wakeup race: the executor passed to
// `new Promise` runs synchronously, so `wake` is assigned before this
// generator suspends, and JS is single-threaded, so nothing can push between
// the `done` check and that assignment.
//
// `signal` is optional. Without one this behaves exactly as before - nothing
// here changes for a caller that never passes it.
function makePushStream(signal) {
  const buffer = [];
  let closed = false;
  let failure = null;
  let wake = null;

  function wakeUp() {
    if (!wake) return;
    const resume = wake;
    wake = null;
    resume();
  }

  const api = {
    push(line) {
      if (closed) return;
      buffer.push(String(line));
      wakeUp();
    },
    close() {
      closed = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      wakeUp();
    },
    fail(err) {
      failure = err || new Error('stream failed');
      closed = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      wakeUp();
    },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        // Drain before reporting either end condition: lines that were
        // already produced are not discarded by a later close or failure.
        while (buffer.length) yield buffer.shift();
        if (failure) throw failure;
        if (closed) return;
        await new Promise(resolve => { wake = resolve; });
      }
    },
  };

  // An abort must wake a suspended consumer, or a Ctrl+C on a pipeline
  // reading from a live process deadlocks: the consumer waits on a promise
  // only push/close/fail resolve, so a caller's finally (the one that would
  // kill the process) never runs. Failing the stream is what lets that
  // finally actually reach its SIGKILL.
  //
  // signal.reason carries whatever the aborter passed to abort(), which in
  // the terminal is a proper AbortError. The fallback keeps this file free of
  // any dependency on interp.js's helpers, so it still loads standalone in
  // the vm harness.
  function onAbort() { api.fail(signal.reason || new Error('aborted')); }
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  return api;
}

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
function makePushStream() {
  const buffer = [];
  let closed = false;
  let failure = null;
  let wake = null;

  function signal() {
    if (!wake) return;
    const resume = wake;
    wake = null;
    resume();
  }

  return {
    push(line) {
      if (closed) return;
      buffer.push(String(line));
      signal();
    },
    close() {
      closed = true;
      signal();
    },
    fail(err) {
      failure = err || new Error('stream failed');
      closed = true;
      signal();
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
}

'use strict';
// os/worker/host.js's abort signal used to have no-op addEventListener, so
// scriptSleep's abort listener (registered while a WAIT instruction is in
// flight - os/script/interp.js) never fired: SIGTERM set the `_hostAborted`
// flag, but nothing woke the sleeping promise, so a killed process' WAIT ran
// to completion (up to 30s) before the flag was even checked again at the
// next instruction. `kill <pid>` (apps/terminal.js) would print "terminated"
// immediately while the process kept running underneath it - a lie by
// omission, and the opposite of what Task 6's kill demo is supposed to show.
// This drives the real worker manifest (readWorkerManifest(), so it tracks
// tools/worker-manifest.json) exactly the way a browser would: an init
// message, then a signal message shortly into a long WAIT.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');
const { readWorkerManifest } = require('../tools/verify-split.cjs');

function loadWorker() {
  const posted = [];
  const self = {
    postMessage(m) {
      posted.push(m);
      // Answer every outbound syscall immediately and generically - this
      // test only cares about the write triggered by the abort's stderr
      // message and the final exit, not real filesystem behaviour.
      if (m.type === 'syscall' && m.name !== 'exit') {
        self.onmessage({ data: { type: 'syscall-reply', seq: m.seq, ok: true, value: null } });
      }
    },
  };
  const ctx = loadOsSources(makeOsContext({ self }), readWorkerManifest());
  return { ctx, self, posted };
}

test('SIGTERM interrupts an in-progress WAIT instead of waiting for it to elapse', async () => {
  const { self, posted } = loadWorker();
  self.onmessage({ data: { type: 'init', source: 'WAIT 5000', name: 'job.script', cwd: '', argv: [] } });
  // Let the interpreter reach the WAIT and register its abort listener before
  // signalling - matches how a real kill arrives mid-wait, not before it starts.
  await new Promise(r => setTimeout(r, 20));
  const start = Date.now();
  self.onmessage({ data: { type: 'signal', sig: 'SIGTERM' } });
  await new Promise(r => setTimeout(r, 80));
  const elapsed = Date.now() - start;
  const exitMsg = posted.find(m => m.name === 'exit');
  assert.ok(exitMsg, 'the process must have exited already, not still be asleep');
  assert.ok(elapsed < 1000, `exit arrived after ${elapsed}ms - the WAIT was not actually interrupted`);
  assert.notStrictEqual(exitMsg.args[0], 0, 'an interrupted process must not report a clean exit');
});

test('a process with no WAIT still exits normally when never signalled', async () => {
  const { self, posted } = loadWorker();
  self.onmessage({ data: { type: 'init', source: 'PRINT hi', name: 'job.script', cwd: '', argv: [] } });
  await new Promise(r => setTimeout(r, 20));
  const exitMsg = posted.find(m => m.name === 'exit');
  assert.deepStrictEqual(plain(exitMsg && exitMsg.args), [0]);
});

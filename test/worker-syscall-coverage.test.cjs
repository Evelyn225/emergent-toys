'use strict';
// The worker emits syscall names as wire strings - the sysCall('name', ...)
// call sites in os/worker/syscalls.js and os/worker/host.js - and
// os/kernel.js's _kernelSyscall dispatches on them with a `switch`. Nothing
// before this test checked that every name the worker can emit has a case in
// that switch. That exact gap shipped TWICE in this phase (ui.openSystem
// routed with no handler defined, then ui.isSystemPath called with no case
// at all) and both times a human reading the diff caught it, not CI, because
// the failure mode is an ENOSYS thrown inside a Worker realm with no
// console to report it to.
//
// test/worker-syscalls.test.cjs's adapter-drift guard compares the two
// script-fs adapters' method names and arity - it does not see the wire
// strings sysCall() actually sends, which is the layer this defect lives on.
//
// This is a static regex over source text rather than a require+dispatch
// test: the two things that must agree are string literals in two different
// files, and running the code would not make that comparison any more
// trustworthy than reading it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Only real sysCall(...) call sites count as "emitted". host.js also posts
// {type:'exit'} directly (not through sysCall) - that message is handled by
// kernelHandleSyscall before it ever reaches _kernelSyscall's switch, so it
// deliberately has no `case 'exit'` there and must not be treated as missing.
function extractEmittedSyscalls() {
  const files = ['os/worker/syscalls.js', 'os/worker/host.js'];
  const names = new Set();
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of src.matchAll(/sysCall\(\s*'([^']+)'/g)) names.add(m[1]);
  }
  return names;
}

function extractHandledSyscalls() {
  const src = fs.readFileSync(path.join(ROOT, 'os/kernel.js'), 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/case\s+'([^']+)'\s*:/g)) names.add(m[1]);
  return names;
}

test('every syscall name the worker can emit has a matching case in the kernel dispatch', () => {
  const emitted = extractEmittedSyscalls();
  const handled = extractHandledSyscalls();
  // Guards the guard: if the regex stops matching anything (e.g. sysCall got
  // renamed), this fails loudly instead of the test below passing vacuously.
  assert.ok(emitted.size >= 10, 'expected to find worker syscall call sites - extraction regex may be broken (found ' + emitted.size + ')');
  const missing = [...emitted].filter(name => !handled.has(name));
  assert.deepStrictEqual(missing, [],
    'the worker emits these syscalls but os/kernel.js has no case for them in _kernelSyscall: ' + missing.join(', '));
});

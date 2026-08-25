// Per-pid CPU accounting over a sample window.
//
// Pure arithmetic: every entry point takes the current time rather than
// reading a clock, so the whole thing is testable in node without faking
// performance.now(). The callers that DO read a clock are the probe in
// os/wm.js and the tick in apps/sysmon.js.
//
// "CPU %" means busy milliseconds attributed to a process divided by
// wall-clock milliseconds in the window - share of one core over the window.
// The same definition covers main-thread apps and worker scripts, which is
// what makes the two comparable in one column.
var _instBusyMs = new Map();
var _instWindowOpenedAt = null;

function instBusyAdd(pid, ms) {
  // A window event on a chrome element with no owning process, or a
  // zero-length dispatch, carries no information and must not create a row.
  if (!pid || !(ms > 0)) return;
  _instBusyMs.set(pid, (_instBusyMs.get(pid) || 0) + ms);
}

function instBusyMsFor(pid) { return _instBusyMs.get(pid) || 0; }

function instWindowOpen(nowMs) {
  _instWindowOpenedAt = nowMs;
  _instBusyMs.clear();
}

function instWindowSample(nowMs) {
  const out = new Map();
  const elapsed = _instWindowOpenedAt === null ? 0 : nowMs - _instWindowOpenedAt;
  if (elapsed > 0) {
    _instBusyMs.forEach(function (ms, pid) {
      // Capped at 100: a single worker cannot occupy more than one core's
      // worth of a window, and main-thread apps share one thread by
      // definition. A figure above 100 would mean the measurement is wrong,
      // and printing it would be worse than clamping it.
      out.set(pid, Math.min(100, (ms / elapsed) * 100));
    });
  }
  // Always reopen, including on a zero-length window. Leaving the old totals
  // in place would report the same work again next tick and keep an idle
  // process looking busy.
  instWindowOpen(nowMs);
  return out;
}

// ---- Main-thread attribution -------------------------------------------
//
// Timers first, because they are the simple half: a timer never touches the
// DOM, so the capture probe below cannot see it. The owning window is captured
// at registration and the callback is bracketed on invocation.
function _instRunFor(winId, fn) {
  const pid = typeof kernelPidForWin === 'function' ? kernelPidForWin(winId) : null;
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    // finally, so a throwing callback still reports the time it burned. A
    // handler that throws on every tick is exactly the one worth seeing.
    instBusyAdd(pid, performance.now() - t0);
  }
}

function procSetTimeout(winId, fn, ms) {
  return setTimeout(function () { _instRunFor(winId, fn); }, ms);
}

function procSetInterval(winId, fn, ms) {
  return setInterval(function () { _instRunFor(winId, fn); }, ms);
}

// The probe. One capture-phase listener on the window root, per event type.
//
// Capture runs root-to-target, so this fires before any handler registered
// inside the subtree no matter what order they were added in. The measurement
// is closed on a microtask rather than by a bubble-phase listener on the same
// root, and that is not a stylistic choice: apps/ contains 25
// stopPropagation() calls, every one of which would stop a bubble listener
// firing and silently under-report exactly the paths doing the most work.
// Microtasks drain once the JS stack empties - after the whole synchronous
// dispatch - so neither stopPropagation nor a throwing handler can prevent the
// close.
var INST_PROBE_EVENTS = ['click', 'mousedown', 'mouseup', 'keydown', 'keyup',
                         'input', 'change', 'contextmenu', 'wheel', 'dblclick'];

function instInstallProbe(rootEl, winId) {
  if (!rootEl || !rootEl.addEventListener) return function () {};
  const onEvent = function () {
    const pid = typeof kernelPidForWin === 'function' ? kernelPidForWin(winId) : null;
    if (!pid) return;
    const t0 = performance.now();
    queueMicrotask(function () { instBusyAdd(pid, performance.now() - t0); });
  };
  INST_PROBE_EVENTS.forEach(function (type) {
    rootEl.addEventListener(type, onEvent, true);
  });
  return function instRemoveProbe() {
    INST_PROBE_EVENTS.forEach(function (type) {
      rootEl.removeEventListener(type, onEvent, true);
    });
  };
}

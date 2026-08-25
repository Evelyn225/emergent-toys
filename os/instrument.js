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

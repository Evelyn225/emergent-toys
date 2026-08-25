// Parked time for the current realm.
//
// A process is "parked" when it is waiting on something rather than occupying
// its thread. Worker CPU is computed as wall time minus parked time, which is
// both cheaper and more accurate than bracketing every interpreter
// instruction: two clock reads per instruction is real overhead on a loop that
// runs to SCRIPT_MAX_STEPS, and it would still miss interpreter work happening
// between instructions.
//
// This file is in BOTH bundles. os/script/interp.js is too, and its
// scriptSleep parks; a worker-only accumulator would leave the main-thread
// copy referencing an undefined function.
var _parkTotalMs = 0;
var _parkDepth = 0;
var _parkStartedAt = 0;

// Depth-counted rather than a plain begin/end pair, because syscalls can be in
// flight concurrently. Two overlapping parks mean the process was parked ONCE
// across the union of their intervals - counting each separately would
// subtract the overlap twice and report a busy process as idle.
function parkBegin() {
  if (_parkDepth === 0) _parkStartedAt = performance.now();
  _parkDepth++;
}

function parkEnd() {
  // A stray end (a reply arriving after parkReset, say) must not open a
  // negative depth that swallows the next real interval.
  if (_parkDepth === 0) return;
  _parkDepth--;
  if (_parkDepth === 0) _parkTotalMs += performance.now() - _parkStartedAt;
}

// Includes the open interval, not just closed ones. A heartbeat that samples
// while a script is parked would otherwise see zero subtracted and report a
// sleeping process as 100% busy - which is precisely the WAIT-reports-100%-CPU
// lie this whole mechanism exists to prevent.
function parkTotalMs() {
  return _parkDepth > 0
    ? _parkTotalMs + (performance.now() - _parkStartedAt)
    : _parkTotalMs;
}

function parkReset() {
  _parkTotalMs = 0;
  _parkDepth = 0;
  _parkStartedAt = 0;
}

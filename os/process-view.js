// The one place that answers "what processes exist" - and, since this phase,
// the one place that decides what happens when a process row's End Task /
// TASKKILL-equivalent action is triggered. Both `ps` (apps/terminal.js) and
// SYSMON (apps/sysmon.js) read buildProcessRows, so they cannot disagree
// about what processes exist; both also route their "end this process"
// action through endProcessAction below, so they cannot disagree about what
// happens when the user tries to end one either. endProcessAction lives here
// rather than in apps/sysmon.js's closure because it is unit-testable here
// and is not there (see test/sysmon-end-process.test.cjs); that is also why
// closeWin and kernelSignal are dependencies of this module now, alongside
// the kernel/window-manager reads buildProcessRows already needed. The next
// person adding a UI action for a process row belongs here too, for the
// same reason - not back in apps/sysmon.js's untestable closure.
//
// The daemon story's processes are MERGED here rather than registered into the
// kernel table, because getBuiltInProcesses() is a live projection of story
// state: pid 512 disappears when the daemon is stopped, mirror_watch.exe
// appears at stage 4, and the soul_svc_NN phantoms are generated from a
// registry key the player can edit. Registering them would put narrative state
// inside the kernel and turn a pure function into a cache needing invalidation
// on every story beat.
//
// The naive concatenate-then-sort in buildProcessRows below is safe only
// because the two pid ranges never collide: real allocation starts at
// KERNEL_FIRST_USER_PID = 2000 (os/kernel.js), while the daemon story's pids
// stay at or below 1333 (os/kernel.js, os/daemon.js). Neither range may move
// without checking the other.
function processDisplayName(title, fallbackId) {
  // Window titles use two separators: an em dash (notepad, explorer) and a
  // plain hyphen (terminal, sysmon, defrag, browser, daemon). Splitting on
  // only the em dash is why `ps` used to report the process name of the
  // terminal as "TERMINAL.exe - Command Prompt".
  const raw = String(title || fallbackId || '').split(/\s\u2014|\s-\s/)[0].trim();
  if (!raw) return String(fallbackId || '').trim() + '.exe';
  return raw.includes('.') ? raw : raw + '.exe';
}

function buildProcessRows() {
  const rows = kernelListProcesses().map(proc => ({
    pid: proc.pid,
    // Derived live: the kernel captured a name at registration, and windows
    // retitle themselves afterwards.
    name: proc.winId && wins[proc.winId]
      ? processDisplayName(wins[proc.winId].title, proc.winId)
      : proc.name,
    kind: proc.kind,
    state: proc.state,
    // Only phase 5 makes these measurable for a real process. Until then a
    // spawned process reports nothing rather than a fabricated number.
    cpu: null,
    mem: null,
    winId: proc.winId || null,
    isStory: false,
  }));
  // getBuiltInProcesses returns { pid, name, cpu, mem, protected } and carries
  // no kind or state, so they are synthesized to match what ps already prints.
  getBuiltInProcesses().forEach(p => rows.push({
    pid: p.pid, name: p.name, kind: 'system', state: 'running',
    cpu: p.cpu, mem: p.mem, winId: null, isStory: true,
  }));
  return rows.sort((a, b) => a.pid - b.pid);
}

// SYSMON's End Process used to call closeWin(row.winId) for everything. A
// spawned process has no winId, so that was a button that silently did
// nothing. A story row is not routed to a refusal here: SYSMON's own story
// branch has two distinct outcomes (the pid-512 branch mutates story state,
// every other story pid shows Access Denied), so this router hands story
// rows straight back and touches neither the kernel nor the window manager.
// Returns what it did so the caller can decide what to show.
//
// kernelSignal's return value is not discarded: it is false for the kernel
// itself (pid 1, a system-kind process with no winId - os/kernel.js refuses
// rather than pretend to close a window that does not exist) and for any
// process that already exited between the row being rendered and the click
// landing. Both are real refusals, not successes, so both come back here as
// 'refused' rather than the caller silently doing nothing. The terminal's
// KILL command hits the identical kernelSignal-returns-false case and prints
// "Access denied: PID N cannot be terminated." - SYSMON must say the same
// thing for the same outcome, or the two surfaces disagree about the result
// of the same operation, which is the one thing this whole module exists to
// prevent.
function endProcessAction(row) {
  if (row.isStory) return 'story';
  if (row.winId && wins[row.winId]) { closeWin(row.winId); return 'closed'; }
  return kernelSignal(row.pid, 'SIGTERM') ? 'signalled' : 'refused';
}

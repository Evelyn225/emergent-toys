// The one place that answers "what processes exist". Both `ps` (apps/terminal.js)
// and SYSMON (apps/sysmon.js) read it, so they cannot disagree.
//
// The daemon story's processes are MERGED here rather than registered into the
// kernel table, because getBuiltInProcesses() is a live projection of story
// state: pid 512 disappears when the daemon is stopped, mirror_watch.exe
// appears at stage 4, and the soul_svc_NN phantoms are generated from a
// registry key the player can edit. Registering them would put narrative state
// inside the kernel and turn a pure function into a cache needing invalidation
// on every story beat.
function processDisplayName(title, fallbackId) {
  // Window titles use two separators: an em dash (notepad, explorer) and a
  // plain hyphen (terminal, sysmon, defrag, browser, daemon). Splitting on
  // only the em dash is why `ps` used to report the process name of the
  // terminal as "TERMINAL.exe - Command Prompt".
  const raw = String(title || fallbackId || '').split(/\s—|\s-\s/)[0].trim();
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

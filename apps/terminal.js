let _termNav = null; // exposes cwd navigation to callers when terminal is already open
let _termExec = null;

// Hoisted out of writePipelineOutput (openTerminal) so node can reach it -
// the same reason runPipelineStages below is top-level.
//
// Redirecting into one of the eight system binaries (`echo junk >
// TERMINAL.exe`) would silently replace it, and refreshSeededSystemBinaries
// only heals that on the next boot - not before this command's output would
// already have landed. Same protection, and the same "protected" wording,
// as Notepad's save guard (apps/notepad.js's notepadGuardProtectedSave).
//
// FIX ROUND 2: programIsSystemBinary is a NAME predicate - it does not
// split a path - so an earlier version of this guard checked the raw
// redirect target and a path-qualified one ("C:\sleepOS\TERMINAL.exe",
// "\TERMINAL.exe", "C:/sleepOS/TERMINAL.exe") sailed past it while
// vfsWriteFile (which DOES split, via vfsSplitPath) still resolved it onto
// the real root file. `dir` must be the SAME fallback directory
// writePipelineOutput is about to pass to vfsWriteFile (cwd) - using any
// other fallback would make this guard's resolution disagree with the
// write's, which is exactly the class of bug being fixed. Splitting first
// and checking `!dirName` (root only) is the same shape as the
// pre-existing DELETE guard, isVisibleSystemPath (os/daemon.js) - a
// DOCS\TERMINAL.exe is a different, legitimate file and must stay writable.
function terminalProtectedWriteError(target, dir) {
  const { dirName, fileName } = vfsSplitPath(target, dir);
  if (dirName || !programIsSystemBinary(fileName)) return null;
  return new Error('Cannot overwrite ' + fileName + ': System files are protected.');
}

// The pipeline driver, hoisted out of openTerminal so node can reach it -
// the same reason buildPsRows is top-level. Dependencies are injected rather
// than closed over because every one of them (getCommandParts, runPipeStage,
// the Notepad sink) needs terminal state that does not exist under test.
//
// Returns { stream, consumedBySink }. The caller decides what to do with the
// stream: print it, fold it into a file, or nothing when a sink already ate
// it.
async function runPipelineStages(stages, deps) {
  let stream = null;
  let consumedBySink = false;
  for (let i = 0; i < stages.length; i++) {
    const { cmd, args } = deps.getCommandParts(stages[i]);
    if (!cmd) throw new Error('Invalid command pipeline.');
    const isLastStage = i === stages.length - 1;
    // Notepad is a sink rather than a stage: it has no output to hand on, so
    // it is only legal last. Anywhere else it falls through to runStage,
    // which does not know it, and reports the ordinary unsupported-command
    // error rather than a special case.
    if (isLastStage && (cmd === 'notepad' || cmd === 'notepad.exe')) {
      await deps.onNotepadSink(args, stream);
      consumedBySink = true;
      break;
    }
    const result = await deps.runStage(cmd, args, stream);
    if (result === null || result === undefined) throw new Error('Piping not supported for command: ' + cmd.toUpperCase());
    stream = streamNormalize(result);
  }
  return { stream, consumedBySink };
}

// A spawned worker as a pipeline stage. Its output arrives on callbacks
// rather than from a loop we drive, which is exactly what makePushStream is
// for.
//
// A process is a SOURCE, never a filter: it ignores whatever is upstream of
// it, because scripts have no syscall for reading a pipe and inventing one is
// not this phase's business.
//
// stderr is merged into the same stream deliberately. Splitting it would mean
// a second source nothing downstream can address, and `HELLO.exe | grep
// ERROR` is the case the master spec leads with.
//
// deps.signal is optional and forwarded straight to makePushStream: it is
// what lets a Ctrl+C wake a pipeline that is suspended reading from this
// still-running process, rather than only ever ending when the process itself
// exits. Kept as an injectable dependency, not read from terminal state
// directly, so the fake-kernel tests do not need a real AbortController.
async function pipelineSpawnStage(tokens, deps) {
  const push = makePushStream(deps.signal);
  const pid = await deps.spawn(tokens[0], tokens.slice(1), {
    onStdout: line => push.push(line),
    onStderr: line => push.push(line),
  });
  // Not awaited: the whole point is that the stage is readable while the
  // process is still running. The exit only closes the stream.
  Promise.resolve(deps.wait(pid)).then(() => push.close(), err => push.fail(err));
  return { pid, stream: push };
}

// Delegates to os/process-view.js, the one module both `ps` and SYSMON read
// so the two views cannot disagree about what processes exist.
function buildPsRows() {
  return buildProcessRows();
}

// Shared by CMDS.kill so it cannot disagree with `ps`/`taskkill` about which
// pids belong to the daemon story: findBuiltInProcess is the same lookup
// taskkill already uses, so both commands agree on what counts as a story
// process by construction, not by a second hand-maintained list. Returns the
// message to print and stop, or null if pid is not a story process and
// CMDS.kill should proceed to the real kernel table.
function buildKillDenialMessage(pid) {
  const builtIn = findBuiltInProcess(pid);
  return builtIn ? `${pid} is a system process. Use TASKKILL.` : null;
}
function openTerminal(startDir, initialCommand) {
  if (!mkWin({ id:'terminal', title:'TERMINAL.exe - Command Prompt', icon:'icon:terminal', w:520, h:320, x:140, y:90, menubar:false, statusbar:false })) {
    if (startDir && _termNav) _termNav(startDir);
    if (initialCommand && _termExec) _termExec(initialCommand);
    return;
  }
  const body = document.getElementById('wb-terminal');
  body.style.padding = '0'; body.style.overflow = 'hidden';
  body.innerHTML = `
    <div class="term-wrap" id="tw">
      <div class="term-out" id="to"></div>
      <div class="term-in-line">
        <span class="term-prompt" id="term-prompt">C:\sleepOS&gt;&nbsp;</span>
        <input class="term-input" id="ti" type="text" autocomplete="off" spellcheck="false">
      </div>
    </div>`;

  const out = document.getElementById('to');
  const inp = document.getElementById('ti');

  body.addEventListener('contextmenu', e => {
    e.preventDefault();
    const sel = window.getSelection()?.toString();
    showCtxMenu(e.clientX, e.clientY, [
      { label: 'Copy',            disabled: !sel, action: () => sel && navigator.clipboard?.writeText(sel) },
      { label: 'Paste',           action: () => navigator.clipboard?.readText().then(t => { inp.value += t; inp.focus(); }) },
      '-',
      { label: 'Clear Screen',    action: () => { out.innerHTML = ''; } },
      '-',
      { label: 'Close',           action: () => closeWin('terminal') },
    ]);
  });

  const print = (text, color) => {
    const div = document.createElement('div');
    div.textContent = text;
    if (color) div.style.color = color;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  };

  print('sleepOS Command Processor v2.33');
  print('Copyright (C) MMXXI Eve Networks Corp.');
  print('');
  print('Type HELP for available commands.');
  print('');

  let cmdHistory = [], histIdx = -1;
  let cwd = startDir ? startDir.toUpperCase() : ''; // '' = root, 'DOCS' = DOCS dir, etc.
  // The environment is the terminal PROCESS's, not the terminal WINDOW's.
  // shellVars is a live reference into the kernel process table, so SET, INC,
  // INPUT and $var expansion all read and write the same object a spawned
  // child will inherit - no copying, no syncing, and no second source of
  // truth. The defaults live in os/kernel.js as KERNEL_DEFAULT_ENV.
  //
  // A consequence, and a deliberate one: closing the terminal destroys the
  // process entry, so reopening it gets a fresh environment inherited from the
  // kernel. A new shell does not remember the last shell's PATH. Persisting
  // that would mean putting the environment in the registry, which is a
  // different feature.
  //
  // The fallback covers callers that reach openTerminal without a registered
  // window, which is what the test harness does.
  const _termPid = typeof kernelPidForWin === 'function' ? kernelPidForWin('terminal') : null;
  const _termProc = _termPid ? kernelGetProcess(_termPid) : null;
  const shellVars = _termProc && _termProc.env
    ? _termProc.env
    : Object.assign(Object.create(null), kernelDefaultEnv());
  let promptOverride = '';
  let activeCommandController = null;
  let pendingRead = null;

  function getPromptStr() {
    return cwd ? `C:\\sleepOS\\${cwd}>` : 'C:\\sleepOS>';
  }
  function getActivePromptStr() {
    return promptOverride || getPromptStr();
  }
  function updatePrompt() {
    const el = document.getElementById('term-prompt');
    if (el) el.textContent = getActivePromptStr() + '\u00a0';
  }
  function setPromptOverride(text) {
    promptOverride = String(text || '').trim();
    updatePrompt();
  }

  function getCurrentCommandSignal() {
    return activeCommandController ? activeCommandController.signal : null;
  }

  function refreshTerminalInputMode() {
    inp.readOnly = !!activeCommandController && !pendingRead;
  }

  function interruptActiveCommand() {
    if (!activeCommandController && !pendingRead) return false;
    const err = makeAbortError();
    if (pendingRead) {
      const { reject } = pendingRead;
      pendingRead = null;
      setPromptOverride('');
      if (reject) reject(err);
    }
    if (activeCommandController && !activeCommandController.signal.aborted) {
      activeCommandController.abort(err);
    }
    inp.value = '';
    refreshTerminalInputMode();
    print('^C', '#ff4444');
    inp.focus();
    return true;
  }

  // Allow openTerminal(dir) to navigate us when already open
  _termNav = (dir) => { cwd = dir.toUpperCase(); updatePrompt(); print(`\nChanged directory to C:\\sleepOS\\${cwd}`); };

  updatePrompt(); // set prompt correctly if startDir was given

  function unquoteShellValue(value) {
    const trimmed = String(value ?? '').trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1).replace(/\\(["'])/g, '$1');
    }
    return trimmed;
  }

  function parseTerminalDelayMs(value) {
    const ms = scriptParseNumber(unquoteShellValue(value));
    if (ms === null || ms < 0) throw new Error('Usage: SLEEP <ms>');
    return Math.floor(ms);
  }

  function resolveShellText(text) {
    return scriptResolveText(String(text ?? ''), shellVars);
  }

  function normalizeTerminalReadPrompt(text) {
    const trimmed = String(text || '').trim();
    return trimmed || 'INPUT:';
  }

  function readTerminalLine(promptText) {
    if (pendingRead) throw new Error('Another INPUT request is already pending.');
    throwIfAborted(getCurrentCommandSignal());
    const normalizedPrompt = normalizeTerminalReadPrompt(promptText);
    return new Promise((resolve, reject) => {
      pendingRead = { promptText: normalizedPrompt, resolve, reject };
      setPromptOverride(normalizedPrompt);
      refreshTerminalInputMode();
      inp.focus();
    });
  }

  function getCommandParts(segment) {
    const trimmed = String(segment || '').trim();
    if (!trimmed) return { cmd: '', args: '' };
    const sp = trimmed.search(/\s/);
    return sp === -1
      ? { cmd: trimmed.toLowerCase(), args: '' }
      : { cmd: trimmed.slice(0, sp).toLowerCase(), args: trimmed.slice(sp + 1).trim() };
  }

  function splitUnquoted(text, delimiter) {
    const parts = [];
    let quote = null;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === quote && text[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === delimiter) {
        parts.push(text.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(text.slice(start));
    return parts;
  }

  function findLastUnquotedRedirect(text) {
    let quote = null;
    let found = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === quote && text[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '>') {
        const op = text[i + 1] === '>' ? '>>' : '>';
        found = { index: i, op };
        if (op === '>>') i++;
      }
    }
    return found;
  }

  function parseShellLine(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    const redirect = findLastUnquotedRedirect(trimmed);
    let commandText = trimmed;
    let redirectOp = null;
    let redirectTarget = '';
    if (redirect) {
      commandText = trimmed.slice(0, redirect.index).trim();
      redirectOp = redirect.op;
      redirectTarget = trimmed.slice(redirect.index + redirect.op.length).trim();
    }
    return {
      stages: splitUnquoted(commandText, '|').map(part => part.trim()).filter(Boolean),
      redirectOp,
      redirectTarget,
    };
  }

  function applyShellSet(rawArgs) {
    const text = String(rawArgs ?? '').trim();
    if (!text) return buildSetLines();

    let match = text.match(/^(\w+)=(.*)$/);
    if (match) {
      const key = match[1];
      if (match[2] === '') {
        delete shellVars[key];
      } else {
        shellVars[key] = scriptStripOuterQuotes(resolveShellText(match[2]));
      }
      return [];
    }

    match = resolveShellText(text).match(/^(\w+)(?:\s+(.*))?$/);
    if (!match) throw new Error('Usage: SET [name[=value] | name value]');
    if (match[2] === undefined) return buildSetLines(match[1]);

    shellVars[match[1]] = scriptStripOuterQuotes(match[2]);
    return [];
  }

  function runShellNumericCommand(op, rawArgs) {
    const resolved = resolveShellText(rawArgs).trim();
    const match = resolved.match(/^(\w+)(?:\s+(.+))?$/);
    if (!match) {
      const usage = op === 'mul' || op === 'div' || op === 'mod'
        ? `Usage: ${op.toUpperCase()} <var> <amount>`
        : `Usage: ${op.toUpperCase()} <var> [amount]`;
      throw new Error(usage);
    }
    const nextValue = scriptMutateNumericVar(shellVars, match[1], op, match[2] === undefined ? undefined : scriptStripOuterQuotes(match[2]), 0);
    return [`${match[1]}=${nextValue}`];
  }

  async function runShellInputCommand(rawArgs) {
    const resolved = resolveShellText(rawArgs).trim();
    const match = resolved.match(/^(\w+)(?:\s+(.+))?$/);
    if (!match) throw new Error('Usage: INPUT <var> [prompt]');
    const key = match[1];
    const prompt = match[2] ? scriptStripOuterQuotes(match[2]) : key + ':';
    const value = await readTerminalLine(prompt);
    shellVars[key] = value;
    return [value];
  }

  // Resolution goes through os/programs.js, which searches the current
  // directory first and then each PATH entry. The `launchers` map that used to
  // live here was one of three lists of the same programs; it is gone, and the
  // launch banners and the daemon's 320ms beat moved into the registry with
  // the programs they belong to.
  function launchTerminalTarget(rawTarget) {
    const key = resolveShellText(rawTarget).trim();
    if (!key) return false;
    // Checked before resolution so the message is about the story, not about
    // PATH. void.tmp is already absent from the root set after the ending, so
    // without this the player would get "not recognized" for a file the story
    // says was removed.
    if (key.toLowerCase() === 'void.tmp' && daemonStory.endingReached) {
      print('void.tmp is no longer present.');
      return true;
    }
    const hit = programResolve(key, cwd, shellVars.PATH);
    if (!hit) return false;
    const program = hit.program;
    // TERMINAL.exe resolving from inside the terminal is the one program whose
    // launch is a message rather than an action.
    if (program.selfLines) {
      program.selfLines.forEach(line => print(line));
      return true;
    }
    program.lines.forEach(line => print(line));
    // Master spec: "running it from the terminal spawns it there with stdout
    // bound to the terminal window." Without these sinks a spawned .exe's
    // output only ever reaches kernelExit's post-exit buffer - the terminal
    // itself is the one caller of program.open with a window to bind to (see
    // programSpawnOrAlert, os/programs.js), so it is the one that must
    // supply them; a built-in's own `open` just ignores `ctx.sinks`.
    //
    // No `[pid] name` line here, unlike CMDS.spawn - every OTHER bare-name
    // launch through this same function (NOTEPAD, CALC, a project...) prints
    // only its banner, never a pid, and a .exe launched bare is asking to run
    // like a program, not to be introspected like SPAWN's explicit low-level
    // command. Keeping this path silent on that score is what keeps it
    // consistent with every other entry in the same table.
    if (program.open) {
      procSetTimeout('terminal', () => program.open({
        cwd,
        sinks: { onStdout: line => print(line), onStderr: line => print(line, '#ff4444') },
      }), program.delay);
    }
    return true;
  }

  function expandGlob(pattern) {
    if (!vfsDirExistsSync(cwd)) return [pattern];
    const allNames = vfsListSync(cwd).filter(e => e.type === 'file').map(e => e.name);
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp('^' + escaped + '$', 'i');
    const matches = allNames.filter(n => re.test(n));
    return matches.length ? matches : [pattern];
  }

  function buildDirLines(args) {
    const targetArg = (args || '').trim();
    if (targetArg && /[*?]/.test(targetArg)) return expandGlob(targetArg);
    const targetCwd = targetArg ? targetArg.toUpperCase() : cwd;
    if (!vfsDirExistsSync(targetCwd)) throw new Error(`Directory not found: ${args}`);
    const entries = vfsListSync(targetCwd);
    const path = targetCwd ? `C:\\sleepOS\\${targetCwd}` : 'C:\\sleepOS';
    const now = new Date();
    const ds = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`;
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const lines = [
      'Volume in drive C is CORPUS',
      'Volume Serial Number is DEAD-C0DE',
      '',
      `Directory of ${path}`,
      '',
    ];
    if (!targetCwd) {
      [
        `11/13/2024  10:31    <DIR>    .`,
        `11/13/2024  10:31    <DIR>    ..`,
        `11/13/2024  10:31    <DIR>    DOCS`,
        `11/13/2024  10:31    <DIR>    PROJECTS`,
      ].forEach(line => lines.push(line));
      getTerminalRootSystemEntries().forEach(entry => {
        lines.push(`${entry.date}  ${String(entry.size).padStart(7)}    ${entry.name}`);
      });
      entries.filter(e => e.type === 'dir' && e.name !== 'DOCS').forEach(e => lines.push(`${ds}  ${ts}    <DIR>    ${e.name}`));
      entries.filter(e => e.kind === 'text').forEach(e => lines.push(`${ds}  ${ts}  ${String(e.size).padStart(7)}    ${e.name}`));
      entries.filter(e => e.kind === 'blob').forEach(e => lines.push(`${ds}  ${ts}  ${fmtSize(e.size).padStart(7)}    ${e.name}  [${e.blob.kind}]`));
    } else {
      entries.filter(e => e.type === 'dir').forEach(e => lines.push(`${ds}  ${ts}    <DIR>    ${e.name}`));
      entries.filter(e => e.kind === 'text').forEach(e => lines.push(`${ds}  ${ts}  ${String(e.size).padStart(7)}    ${e.name}`));
      entries.filter(e => e.kind === 'blob').forEach(e => lines.push(`${ds}  ${ts}  ${fmtSize(e.size).padStart(7)}    ${e.name}  [${e.blob.kind}]`));
      if (entries.length === 0) lines.push('  (empty directory)');
    }
    lines.push('');
    return lines;
  }

  function buildPsLines() {
    const lines = ['   PID  KIND    STATE    PROCESS', '  ----  ----    -----    -------'];
    buildPsRows().forEach(p => {
      lines.push('  ' + String(p.pid).padStart(4) + '  ' + p.kind.padEnd(6) + '  ' + p.state.padEnd(7) + '  ' + p.name);
    });
    return lines;
  }

  function buildVerLines() {
    return [
      'sleepOS Version 0.9β (Build 2024.11.13-EXPERIMENTAL)',
      'Soul Architecture: SOMA-686  /  Corpus Mode: ACTIVE',
    ];
  }

  function buildWhoLines() {
    return [
      'Current user : VISITOR\\UNKNOWN',
      'Domain       : sleepOS.CORPUS',
      'Session ID   : 0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0'),
      'Observers    : unknown (cannot enumerate)',
    ];
  }

  function buildDateLines() {
    const now = new Date();
    return [
      'System date: ' + now.toDateString(),
      'NOTE: Clock drift detected. True date: +/- 2.3 years from displayed.',
    ];
  }

  function buildIpconfigLines() {
    return [
      'sleepOS IP Configuration',
      '',
      'Adapter: SOMA-686 NIC',
      '  Connection-specific DNS  : corpus.internal',
      '  IPv4 Address             : 0.0.0.0',
      '  Subnet Mask              : 255.255.255.???',
      '  Default Gateway          : [unreachable]',
      '  DNS Servers              : unknown (responding)',
      '',
      'Adapter: VOID Interface',
      '  Status                   : Connected',
      '  Address                  : [cannot be expressed]',
      '  Packets in               : ∞',
      '  Packets out              : 0',
    ];
  }

  function buildTreeLines() {
    const lines = ['C:\\sleepOS', '├── DOCS\\'];
    const docsFiles = vfsListSync('DOCS').filter(e => e.kind === 'text').map(e => e.name);
    docsFiles.forEach((n, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${n}`));
    const rootEntries = vfsListSync('');
    rootEntries.filter(e => e.type === 'dir').forEach(e => {
      const d = e.name;
      if (d === 'DOCS') return;
      lines.push(`├── ${d}\\`);
      const subEntries = vfsListSync(d);
      subEntries.filter(x => x.kind === 'text').forEach((x, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${x.name}`));
      subEntries.filter(x => x.kind === 'blob').forEach((x, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${x.name}`));
    });
    getRootSystemFiles({ includeExplorer: true })
      .filter(name => !vfsStatSync(name, ''))
      .forEach(name => {
        let label = name;
        if (name === 'daemon.core') label = daemonStory.endingReached ? 'daemon.core              [ARCHIVED]' : 'daemon.core              [CONTAINMENT]';
        if (name === '?????.exe') label = daemonStory.stage >= 7 ? getExeDisplayName() + '                [QUARANTINE LAUNCHER]' : '?????.exe                [DO NOT EXECUTE]';
        lines.push(`├── ${label}`);
      });
    rootEntries.filter(e => e.kind === 'text').forEach(e => lines.push(`├── ${e.name}`));
    rootEntries.filter(e => e.kind === 'blob').forEach(e => lines.push(`├── ${e.name}  [${e.blob.kind}]`));
    lines.push('└── PROJECTS\\');
    lines.push('    ├── sand playground');
    lines.push('    ├── fireworks');
    lines.push('    ├── ... (more objects)');
    lines.push('    └── [1 object cannot be listed]');
    return lines;
  }

  async function getPipeableText(path) {
    const { dirName, fileName } = vfsSplitPath(path, cwd);
    const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
    if (upperPath === 'DAEMON.CORE') {
      daemonActivate('raw');
      return buildDaemonCoreRawContent().split('\n');
    }
    if (upperPath === 'VOID.TMP' && !daemonStory.endingReached) {
      daemonRecordInvestigation('void');
      return getVoidTmpContent().split('\n');
    }
    const st = vfsStatSync(path, cwd);
    if (!st || st.type !== 'file') throw new Error('File not found: ' + path);
    if (upperPath === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
    if (upperPath === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
    if (st.kind === 'blob') {
      return [
        `Binary file: ${st.name} (${st.blob.kind}, ${fmtSize(st.blob.size)})`,
        `Use OPEN ${st.name} to view it.`,
      ];
    }
    const text = await vfsReadFile(path, cwd);
    return text ? text.split('\n') : [];
  }

  async function buildPingLines(args, signal) {
    const host = (args || 'evenet.fun').trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '');
    const lines = [`Pinging ${host} with 32 bytes of data:`];
    const times = [];
    let received = 0;
    for (let i = 0; i < 4; i++) {
      throwIfAborted(signal);
      if (i > 0) await scriptSleep(1000, signal);
      const ctrl = new AbortController();
      const tid = procSetTimeout('terminal', () => ctrl.abort(), 4000);
      const abortFetch = () => ctrl.abort();
      if (signal) signal.addEventListener('abort', abortFetch, { once: true });
      const t0 = performance.now();
      try {
        await fetch(`https://${host}/`, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
        clearTimeout(tid);
        const ms = Math.round(performance.now() - t0);
        times.push(ms);
        received++;
        lines.push(`Reply from ${host}: bytes=32 time=${ms}ms TTL=57`);
      } catch (e) {
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', abortFetch);
        if (signal?.aborted) throw signal.reason && isAbortError(signal.reason) ? signal.reason : makeAbortError();
        lines.push(`Request timeout for ${host}.`);
        continue;
      }
      if (signal) signal.removeEventListener('abort', abortFetch);
    }
    lines.push('');
    lines.push(`Ping statistics for ${host}:`);
    const lost = 4 - received;
    lines.push(`  Packets: Sent = 4, Received = ${received}, Lost = ${lost} (${Math.round(lost / 4 * 100)}% loss)`);
    if (times.length) {
      lines.push(`Approximate round trip times: Min=${Math.min(...times)}ms  Max=${Math.max(...times)}ms  Avg=${Math.round(times.reduce((a, b) => a + b) / times.length)}ms`);
    }
    return lines;
  }

  function buildHelpLines() {
    return [
      'Available commands:',
      '  HELP                - show this help',
      '  DIR, LS             - list directory',
      '  CD [path]           - change directory',
      '  MKDIR [name]        - create a directory',
      '  TOUCH [name]        - create empty file',
      '  ECHO [text]         - print text',
      '  PRINT [text]        - alias for ECHO',
      '  DEL, RM [file]      - delete a file or directory',
      '  COPY [src] [dst]    - copy a file',
      '  MOVE, MV            - move a file',
      '  TYPE, CAT [file]    - read file contents',
      '  GREP <pattern> [f]  - filter a file or piped text',
      '  WC [file]           - count lines, words, bytes',
      '  TREE                - directory tree',
      '  PS                  - list running processes',
      '  TASKKILL [pid]      - terminate a process',
      '  SPAWN <script> [args] - run a script as a background process',
      '  KILL <pid> [/F]     - terminate a process (SIGTERM, or /F for SIGKILL)',
      '  IPCONFIG            - network configuration',
      '  SET [name=value]    - show or assign shell variables',
      '  ENV                 - show the process environment',
      '  PATH [value]        - show or set the executable search path',
      '  WHERE <name>        - show which directory a program resolves from',
      '  INPUT <var> [text]  - read a line into a shell variable',
      '  INC, DEC <var> [n]  - adjust numeric shell variables',
      '  ADD, SUB, MUL, DIV, MOD - arithmetic on shell variables',
      '  PING [host]         - ping a host',
      '  SLEEP <ms>          - pause for a number of milliseconds',
      '  WAIT <ms>           - alias for SLEEP',
      '  VER                 - show OS version',
      '  WHO, WHOAMI         - current user info',
      '  DATE                - system date',
      '  CLS                 - clear screen',
      '  CLEAR               - alias for CLS',
      '  OPEN [file]         - open a file (image/video in viewer, text in editor)',
      '  RUN <file> [args]   - execute a .script file',
      '  NOTEPAD [file]      - open Notepad (optionally open a file)',
      '  START [program]     - run an executable or project',
      '  EXIT                - close terminal',
      '',
      'Pipes and redirection:',
      '  DIR | GREP txt',
      '  CAT README.txt | NOTEPAD',
      '  DIR > listing.txt',
      '  CAT README.txt | GREP TODO >> notes.txt',
      '',
      'Scripting: see DOCS/SCRIPTING.txt  (CD DOCS, CAT SCRIPTING.txt)',
      '  Scripts support labels, subroutines, args, existence tests, and status codes.',
      '',
      'You can also type executables directly:',
      '  notepad.exe, terminal.exe, calc.exe, regedit.exe, sysmon.exe',
      '  welcome.readme, void.tmp, daemon.core, ?????.exe',
      '  or any project name (try: fireworks, fluid, ...)',
      '  Programs are found in the current directory first, then along PATH.',
    ];
  }

  function buildSetLines(nameFilter) {
    const keys = Object.keys(shellVars).sort((a, b) => a.localeCompare(b));
    if (!nameFilter) return keys.map(key => `${key}=${shellVars[key]}`);
    return Object.prototype.hasOwnProperty.call(shellVars, nameFilter)
      ? [`${nameFilter}=${shellVars[nameFilter]}`]
      : [`Variable not defined: ${nameFilter}`];
  }

  // The same table SET prints, under the name a person types. Delegating rather
  // than re-listing shellVars is what stops the two from ever disagreeing about
  // what the environment contains.
  function buildEnvLines() {
    return buildSetLines();
  }

  function buildWhereLines(rawArgs) {
    const name = unquoteShellValue(resolveShellText(rawArgs)).trim();
    if (!name) throw new Error('Usage: WHERE <name>');
    const hit = programResolve(name, cwd, shellVars.PATH);
    // NOT the message real where.exe gives - Windows prints "INFO: Could not
    // find files for the given pattern(s)." and does not echo the name back.
    // Kept this way anyway: naming the thing that was searched for is more
    // useful than the real message's fidelity, and this shell already departs
    // from cmd.exe in plenty of other places.
    if (!hit) return [`INFO: Could not find "${name}".`];
    return [programDisplayDir(hit.dir) + '\\' + hit.program.name];
  }

  // cmd.exe's PATH: bare prints, with a value assigns. Sugar over SET PATH=,
  // and the thing a person actually types. Writes straight through shellVars,
  // which is the terminal process's env, so a PATH set here is the same PATH
  // programResolve reads and the same one a spawned child inherits.
  function applyShellPath(rawArgs) {
    const text = String(rawArgs ?? '').trim();
    if (!text) return [`PATH=${shellVars.PATH ?? ''}`];
    shellVars.PATH = scriptStripOuterQuotes(resolveShellText(text));
    return [];
  }

  // A stage is a program when the VFS holds a .exe text file by that name
  // that is not one of the built-in windows. Task 6's programIsSystemBinary
  // is the authority on the second half.
  //
  // FIX ROUND (browser Critical B1): getCommandParts lowercases every
  // stage's command before this ever sees it, but the VFS `files` Map is
  // keyed by the real, case-preserved filename with a case-sensitive lookup
  // - so `vfsStatSync(cmd, dir)` on the lowercased command alone could never
  // find HELLO.exe, and `HELLO.exe | grep ...` fell all the way through to
  // "Piping not supported for command: HELLO.EXE". programResolve already
  // folds case the same way bare-name execution does (launchTerminalTarget,
  // above) and hands back the entry's real name and directory, PATH search
  // included - reusing it here is what lets a pipe stage resolve exactly
  // like typing the same name on its own would, instead of a second,
  // narrower case-insensitive scan that only agrees with it by accident.
  // Returns the resolved hit (real name + dir) or null, not a boolean, so
  // the caller can spawn the real filename in the real directory rather than
  // the lowercased command text it was typed as.
  function terminalIsExecutableStage(cmd, dir) {
    if (!/\.exe$/i.test(cmd)) return null;
    if (programIsSystemBinary(cmd)) return null;
    const hit = programResolve(cmd, dir, shellVars.PATH);
    return (hit && !programIsSystemBinary(hit.program.name)) ? hit : null;
  }

  async function runPipeStage(cmd, args, stdin) {
    cmd = ({ print: 'echo', wait: 'sleep', clear: 'cls' }[cmd] || cmd);
    if (cmd === 'echo') return [unquoteShellValue(resolveShellText(args))];
    if (cmd === 'help') return buildHelpLines();
    if (cmd === 'dir' || cmd === 'ls') return buildDirLines(resolveShellText(args));
    if (cmd === 'ps') return buildPsLines();
    if (cmd === 'ver') return buildVerLines();
    if (cmd === 'who' || cmd === 'whoami') return buildWhoLines();
    if (cmd === 'date') return buildDateLines();
    if (cmd === 'set') return applyShellSet(args);
    // Registering these here as well as in CMDS is not belt-and-braces: an
    // unknown command makes runPipeStage return null, which the caller turns
    // into "Piping not supported for command: X". A command added to CMDS
    // alone would look supported right up until someone piped or redirected it.
    if (cmd === 'env') return buildEnvLines();
    if (cmd === 'where') return buildWhereLines(args);
    if (cmd === 'path') return applyShellPath(args);
    if (cmd === 'input') return runShellInputCommand(args);
    if (cmd === 'inc' || cmd === 'dec' || cmd === 'add' || cmd === 'sub' || cmd === 'mul' || cmd === 'div' || cmd === 'mod') {
      return runShellNumericCommand(cmd, args);
    }
    if (cmd === 'ipconfig') return buildIpconfigLines();
    if (cmd === 'tree') return buildTreeLines();
    if (cmd === 'ping') return buildPingLines(resolveShellText(args), getCurrentCommandSignal());
    if (cmd === 'sleep') {
      await scriptSleep(parseTerminalDelayMs(resolveShellText(args)), getCurrentCommandSignal());
      return stdin || [];
    }
    if (cmd === 'cls') {
      out.innerHTML = '';
      return stdin || [];
    }
    if (cmd === 'cat' || cmd === 'type') {
      const target = resolveShellText(args).trim();
      if (target) return streamFromLines(await getPipeableText(target));
      if (stdin) return stdin;
      throw new Error('Usage: CAT [file]');
    }
    if (cmd === 'grep') {
      const match = resolveShellText(args).trim().match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)(?:\s+(.+))?$/);
      if (!match) throw new Error('Usage: GREP <pattern> [file]');
      const pattern = unquoteShellValue(match[1]);
      const target = match[2] ? unquoteShellValue(match[2]) : '';
      let re;
      try { re = new RegExp(pattern, 'i'); } catch (e) { throw new Error('Invalid regex: ' + pattern); }
      const source = target ? streamFromLines(await getPipeableText(target)) : stdin;
      if (!source) throw new Error('Usage: GREP <pattern> [file]');
      return streamGrep(source, re);
    }
    if (cmd === 'wc') {
      let sourceText = '';
      let label = '';
      const targetArg = resolveShellText(args).trim();
      if (targetArg) {
        const target = unquoteShellValue(targetArg);
        const st = vfsStatSync(target, cwd);
        if (!st || st.kind !== 'text') throw new Error('File not found: ' + target);
        sourceText = (await vfsReadFile(target, cwd)) || '';
        label = '  ' + st.name;
      } else if (stdin) {
        sourceText = (await streamCollect(stdin)).join('\n');
      } else {
        throw new Error('Usage: WC [file]');
      }
      const lines = sourceText ? sourceText.split('\n').length : 0;
      const words = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
      const bytes = new TextEncoder().encode(sourceText).length;
      return [`  ${String(lines).padStart(6)}  ${String(words).padStart(6)}  ${String(bytes).padStart(6)}${label}`];
    }
    return null;
  }

  async function writePipelineOutput(targetPath, lines, append) {
    const normalizedTarget = unquoteShellValue(resolveShellText(targetPath));
    if (!normalizedTarget) throw new Error('Missing redirect target.');
    const guardErr = terminalProtectedWriteError(normalizedTarget, cwd);
    if (guardErr) throw guardErr;
    const existingStat = vfsStatSync(normalizedTarget, cwd);
    if (existingStat && existingStat.kind === 'blob') throw new Error('Cannot write text output to binary file: ' + normalizedTarget);
    const output = lines.join('\n');
    const existingText = existingStat && existingStat.kind === 'text' ? (await vfsReadFile(normalizedTarget, cwd)) || '' : '';
    const nextValue = append
      ? (existingText && output ? existingText + '\n' + output : existingText + output)
      : output;
    try {
      return await vfsWriteFile(normalizedTarget, nextValue, cwd);
    } catch (err) {
      throw new Error(err.code === 'ENOSPC' ? 'Disk full. Nothing was written.'
        : err.code === 'EACCES' ? 'Storage is unavailable. Nothing was written.'
        : 'Write failed: ' + err.message);
    }
  }

  async function tryExecutePipeline(raw) {
    const parsed = parseShellLine(raw);
    if (!parsed || (!parsed.redirectOp && parsed.stages.length < 2)) return false;
    if (!parsed.stages.length) {
      print('Invalid command pipeline.', '#ff4444');
      print('');
      return true;
    }
    const pipelinePids = new Set();
    try {
      const { stream, consumedBySink } = await runPipelineStages(parsed.stages, {
        getCommandParts,
        runStage: async (cmd, args, stdin) => {
          const stageHit = terminalIsExecutableStage(cmd, cwd);
          if (stageHit) {
            // The real, case-preserved filename and the directory it was
            // actually found in - never the lowercased `cmd` text and never
            // the terminal's own cwd if PATH is what found it. See
            // programs-resolve.test.cjs's "a VFS .exe found via PATH from a
            // different cwd spawns in its own directory" for why the second
            // half matters just as much as the first.
            const tokens = scriptTokenize((stageHit.program.name + ' ' + args).trim());
            const stage = await pipelineSpawnStage(tokens, {
              spawn: (path, argv, sinks) => kernelSpawn(path, argv, Object.assign({
                cwd: stageHit.dir,
                parentPid: kernelPidForWin('terminal'),
              }, sinks)),
              wait: pid => kernelWait(pid),
              signal: getCurrentCommandSignal(),
            });
            pipelinePids.add(stage.pid);
            return stage.stream;
          }
          return runPipeStage(cmd, args, stdin);
        },
        onNotepadSink: async (args, upstream) => {
          const lines = await streamCollect(upstream);
          const content = lines.join('\n');
          const target = args.trim();
          if (target) {
            const saved = await writePipelineOutput(target, lines, false);
            print(`Opening ${saved.fileName} in Notepad...`);
            procSetTimeout('terminal', () => openNotepad(saved.fileName, saved.dirName), 300);
          } else {
            print('Opening piped output in Notepad...');
            procSetTimeout('terminal', () => openNotepad(undefined, cwd, { initialContent: content }), 300);
          }
        },
      });
      if (parsed.redirectOp) {
        if (consumedBySink) throw new Error('Cannot redirect output after piping into Notepad.');
        // A file write is a fold, like WC: nothing can be written until the
        // whole stream has arrived, so collecting here is not a streaming
        // failure.
        const saved = await writePipelineOutput(parsed.redirectTarget, await streamCollect(stream), parsed.redirectOp === '>>');
        print(`${parsed.redirectOp === '>>' ? 'Appended' : 'Wrote'}: ${saved.fileName}`);
      } else if (!consumedBySink && stream) {
        // Progressive: this is what makes an unterminated producer observable
        // at all rather than a hang followed by nothing.
        for await (const line of stream) print(line);
      }
    } catch (err) {
      // An abort is how a live process stage's stream gets woken at all (see
      // makePushStream's signal handling) - it is not a real failure, so it
      // must not print as one. '^C' already told the player the command was
      // interrupted.
      if (!isAbortError(err)) print(err.message || String(err), '#ff4444');
    } finally {
      // Covers abort, error and normal completion in one place. A pid that
      // already exited is gone from the table, and kernelSignal returns false
      // for a missing pid rather than throwing, so this is a no-op in the
      // happy path and a real kill on Ctrl+C.
      pipelinePids.forEach(pid => { kernelSignal(pid, 'SIGKILL'); });
    }
    print('');
    return true;
  }

  const CMDS = {
    type: (args) => CMDS.cat(args),
    cd: (args) => {
      const dest = (args || '').trim();
      if (!dest || dest === '.' || dest === 'C:\\sleepOS' || dest === '\\') {
        cwd = ''; updatePrompt(); return;
      } else if (dest === '..') {
        if (!cwd) { print('Already at root.'); return; }
        const i = cwd.lastIndexOf('\\'); cwd = i >= 0 ? cwd.slice(0, i) : ''; updatePrompt(); return;
      } else {
        const rawNewCwd = cwd ? cwd + '\\' + dest.toUpperCase() : dest.toUpperCase();
        if (vfsDirExistsSync(rawNewCwd)) { cwd = vfsNormalizeDir(rawNewCwd); updatePrompt(); }
        else { print(`The system cannot find the path specified: ${dest}`); }
      }
    },
    mkdir: async (args) => {
      if (!args) { print('Usage: MKDIR [name]'); return; }
      const name = args.trim().toUpperCase();
      if (['PROJECTS','DOCS','.','..'].includes(name)) {
        print(`A subdirectory or file ${name} already exists.`); return;
      }
      let result;
      try {
        result = await vfsMkdir(name, cwd);
      } catch (err) {
        print(err.code === 'ENOSPC' ? 'Disk full. Nothing was written.'
            : err.code === 'EACCES' ? 'Storage is unavailable. Nothing was written.'
            : 'Write failed: ' + err.message, '#ff4444');
        return;
      }
      if (!result.created) { print(`A subdirectory or file ${name} already exists.`); return; }
      print(`Directory created: ${getPromptStr().replace('>','')}\\${name}`);
    },
    touch: async (args) => {
      if (!args) { print('Usage: TOUCH [filename]'); return; }
      const name = args.trim();
      const st = vfsStatSync(name, cwd);
      if (st && st.kind === 'text') { print(`File already exists: ${name}`); return; }
      try {
        await vfsWriteFile(name, '', cwd);
      } catch (err) {
        print(err.code === 'ENOSPC' ? 'Disk full. Nothing was written.'
            : err.code === 'EACCES' ? 'Storage is unavailable. Nothing was written.'
            : 'Write failed: ' + err.message, '#ff4444');
        return;
      }
      print(`Created: ${name}`);
    },
    del: async (args) => {
      const raw = (args || '').trim();
      if (!raw) { print('Usage: DEL [filename]'); return; }
      const result = await deleteVirtualPath(raw, cwd);
      if (!result.ok) print(result.message || `Cannot delete ${raw}`, '#ff4444');
      (result.details || []).forEach(line => print(line, result.ok ? undefined : '#dddd00'));
    },
    rm: (args) => CMDS.del(args),
    copy: (args) => {
      const parts = (args || '').trim().split(/\s+/);
      if (parts.length < 2) { print('Usage: COPY [source] [destination]'); return; }
      print(`Copying '${parts[0]}' to '${parts[1]}'...`);
      procSetTimeout('terminal', () => {
        print('1 file(s) copied.');
        print(`WARNING: The copy is not identical to the original.`);
        print('This is considered normal.');
      }, 700);
    },
    move: (args) => {
      if (!args) { print('Usage: MOVE [source] [destination]'); return; }
      print('Move failed.', '#ff4444');
      print('Files in sleepOS cannot be moved.');
      print('They are already where they need to be.');
    },
    mv: (args) => CMDS.move(args),
    taskkill: (args) => {
      const pidStr = (args || '').replace(/\D/g,'');
      if (!pidStr) { print('Usage: TASKKILL <pid>'); return; }
      const pid = parseInt(pidStr, 10);
      if (pid === 512) {
        const result = killSoulDaemonProcess();
        print(result.message, result.ok ? undefined : '#ff4444');
        (result.details || []).forEach(line => print(line, result.ok ? undefined : '#dddd00'));
        return;
      }
      const builtIn = findBuiltInProcess(pid);
      if (builtIn) {
        print(`Terminating ${builtIn.name} (PID ${pid})...`);
        print(`ERROR: Access is denied. (PID ${pid})`, '#ff4444');
        print('System processes cannot be terminated.');
        return;
      }
      // Look up the real window through the kernel table - pids are real now,
      // not a hash of the window id, so this is a table lookup rather than a guess.
      const proc = kernelGetProcess(pid);
      const winId = proc && proc.winId;
      if (winId && wins[winId]) {
        const name = wins[winId].title.split(' \u2014')[0].trim();
        print(`Terminating ${name} (PID ${pid})...`);
        procSetTimeout('terminal', () => {
          closeWin(winId);
          print(`SUCCESS: Process "${name}" (PID ${pid}) terminated.`);
        }, 400);
      } else {
        print(`ERROR: The process with PID ${pid} was not found.`, '#ff4444');
      }
    },
    cat: async (args) => {
      const raw = (args||'').trim();
      if (!raw) { print('Usage: CAT <file>'); return; }
      const { dirName, fileName } = vfsSplitPath(raw, cwd);
      const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
      if (upperPath === 'DAEMON.CORE') {
        daemonActivate('raw');
        buildDaemonCoreRawContent().split('\n').forEach(line => print(line));
        return;
      }
      if (upperPath === 'VOID.TMP' && !daemonStory.endingReached) {
        daemonRecordInvestigation('void');
        getVoidTmpContent().split('\n').forEach(line => print(line));
        return;
      }
      const st = vfsStatSync(raw, cwd);
      if (!st || st.type !== 'file') {
        print('File not found: ' + raw);
        return;
      }
      if (upperPath === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
      if (upperPath === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
      if (st.kind === 'blob') {
        print(`Binary file: ${st.name} (${st.blob.kind}, ${fmtSize(st.blob.size)})`);
        print(`Use OPEN ${st.name} to view it.`);
        return;
      }
      const text = await vfsReadFile(raw, cwd);
      if (text === '') {
        print('(empty file)');
        return;
      }
      (text || '').split('\n').forEach(line => print(line));
    },
    open: (args) => {
      const raw = (args || '').trim();
      if (!raw) { print('Usage: OPEN [filename]'); return; }
      const split = vfsSplitPath(raw, cwd);
      if (isVisibleSystemPath(raw, { includeExplorer: true })) {
        print(`Opening ${split.fileName}...`);
        procSetTimeout('terminal', () => openSystemFile(split.fileName), 300);
        return;
      }
      const st = vfsStatSync(raw, cwd);
      if (st && st.kind === 'blob') {
        print(`Opening ${raw}...`);
        procSetTimeout('terminal', () => openMediaFile(raw, cwd), 300);
      } else if (st && st.kind === 'text') {
        print(`Opening ${raw}...`);
        procSetTimeout('terminal', () => openNotepad(raw, cwd), 300);
      } else {
        print(`File not found: ${raw}`);
        print('Use DIR to list available files.');
      }
    },
    notepad: (args) => {
      const fname = args ? args.trim() : null;
      if (fname) {
        const st = vfsStatSync(fname, cwd);
        if (!st || st.kind !== 'text') { print(`File not found: ${fname}`); return; }
      }
      print(fname ? `Opening ${fname} in Notepad...` : 'Opening Notepad...');
      procSetTimeout('terminal', () => openNotepad(fname || undefined, cwd), 300);
    },
    grep: async (args) => {
      if (!args) { print('Usage: GREP <pattern> <file>'); return; }
      const parts = args.match(/^("(?:[^"\\]|\\.)*"|[^\s]+)\s+(.+)$/);
      if (!parts) { print('Usage: GREP <pattern> <file>'); return; }
      const pattern = parts[1].replace(/^"|"$/g,'');
      const fname = parts[2].trim();
      let re;
      try { re = new RegExp(pattern, 'i'); } catch(e) { print('Invalid regex: ' + pattern, '#ff4444'); return; }
      const st = vfsStatSync(fname, cwd);
      if (!st || st.kind !== 'text') { print('File not found: ' + fname); return; }
      const content = (await vfsReadFile(fname, cwd)) || '';
      const lines = content.split('\n');
      let matches = 0;
      lines.forEach((line, i) => {
        if (re.test(line)) { print((i+1) + ':' + line); matches++; }
      });
      if (matches === 0) print('(no matches)');
      else print('\n' + matches + ' match' + (matches !== 1 ? 'es' : '') + ' found');
    },
    wc: async (args) => {
      const fname = (args || '').trim();
      if (!fname) { print('Usage: WC <file>'); return; }
      const st = vfsStatSync(fname, cwd);
      if (!st || st.kind !== 'text') { print('File not found: ' + fname); return; }
      const content = (await vfsReadFile(fname, cwd)) || '';
      const lines = content.split('\n').length;
      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      const bytes = new TextEncoder().encode(content).length;
      print(`  ${String(lines).padStart(6)}  ${String(words).padStart(6)}  ${String(bytes).padStart(6)}  ${fname}`);
    },
    exit: () => closeWin('terminal'),
  };

  CMDS.help = () => buildHelpLines().forEach(line => print(line));
  CMDS.dir = (args) => buildDirLines(args).forEach(line => print(line));
  CMDS.ls = (args) => CMDS.dir(args);
  CMDS.ps = () => buildPsLines().forEach(line => print(line));
  CMDS.ver = () => buildVerLines().forEach(line => print(line));
  CMDS.who = () => buildWhoLines().forEach(line => print(line));
  CMDS.whoami = () => CMDS.who();
  CMDS.date = () => buildDateLines().forEach(line => print(line));
  CMDS.ping = async (args) => {
    (await buildPingLines(resolveShellText(args), getCurrentCommandSignal())).forEach(line => print(line));
  };
  CMDS.ipconfig = () => buildIpconfigLines().forEach(line => print(line));
  CMDS.tree = () => buildTreeLines().forEach(line => print(line));
  CMDS.sleep = async (args) => {
    await scriptSleep(parseTerminalDelayMs(args), getCurrentCommandSignal());
  };
  CMDS.wait = (args) => CMDS.sleep(args);
  CMDS.echo = (args) => { print(unquoteShellValue(args || '')); };
  CMDS.print = (args) => CMDS.echo(args);
  CMDS.cls = () => { out.innerHTML = ''; };
  CMDS.clear = () => CMDS.cls();
  CMDS.set = (args) => applyShellSet(args).forEach(line => print(line));
  CMDS.env = () => buildEnvLines().forEach(line => print(line));
  CMDS.where = (args) => buildWhereLines(args).forEach(line => print(line));
  CMDS.path = (args) => applyShellPath(args).forEach(line => print(line));
  CMDS.input = async (args) => {
    await runShellInputCommand(args);
  };
  CMDS.inc = (args) => runShellNumericCommand('inc', args).forEach(line => print(line));
  CMDS.dec = (args) => runShellNumericCommand('dec', args).forEach(line => print(line));
  CMDS.add = (args) => runShellNumericCommand('add', args).forEach(line => print(line));
  CMDS.sub = (args) => runShellNumericCommand('sub', args).forEach(line => print(line));
  CMDS.mul = (args) => runShellNumericCommand('mul', args).forEach(line => print(line));
  CMDS.div = (args) => runShellNumericCommand('div', args).forEach(line => print(line));
  CMDS.mod = (args) => runShellNumericCommand('mod', args).forEach(line => print(line));
  CMDS.start = (args) => {
    if (!args || !String(args).trim()) { print('Usage: START [program]'); return; }
    if (!launchTerminalTarget(args)) print(`Cannot find program: ${args}`);
  };
  CMDS.run = async (args) => {
    const tokens = scriptTokenize(args || '');
    if (!tokens.length) { print('Usage: RUN <script.script> [args...]'); return; }
    const fname = tokens[0];
    const st = vfsStatSync(fname, cwd);
    if (!st || st.kind !== 'text') { print(`Script not found: ${fname}`, '#ff4444'); return; }
    print(`Running ${fname}...`);
    const text = await vfsReadFile(fname, cwd);
    const exitCode = await execScript(text, print, {
      fs: makeVfsScriptFs(),
      sourceName: st.name,
      dirName: st.dirName,
      vars: shellVars,
      readLine: readTerminalLine,
      signal: getCurrentCommandSignal(),
      args: tokens.slice(1),
      clearFn: () => { out.innerHTML = ''; },
    });
    if (exitCode !== 0) print(`Exit code: ${exitCode}`, '#dddd00');
  };

  CMDS.spawn = async (args) => {
    const tokens = scriptTokenize(args || '');
    if (!tokens.length) { print('Usage: SPAWN <script.script> [args...]'); return; }
    try {
      const pid = await kernelSpawn(tokens[0], tokens.slice(1), {
        cwd,
        parentPid: kernelPidForWin('terminal'),
        onStdout: line => print(line),
        onStderr: line => print(line, '#ff4444'),
      });
      print(`[${pid}] ${tokens[0]}`);
    } catch (err) {
      print(err.code === 'ENOENT' ? `Script not found: ${tokens[0]}` : err.message, '#ff4444');
    }
  };

  CMDS.kill = (args) => {
    const parts = (args || '').trim().split(/\s+/).filter(Boolean);
    const force = parts.some(p => p.toLowerCase() === '/f' || p === '-9');
    const pid = parseInt(parts.find(p => /^\d+$/.test(p)), 10);
    if (!pid) { print('Usage: KILL <pid> [/F]'); return; }
    const denial = buildKillDenialMessage(pid);
    if (denial) { print(denial, '#ff4444'); return; }
    const proc = kernelGetProcess(pid);
    if (!proc) { print(`No such process: ${pid}`, '#ff4444'); return; }
    // kernelSignal reports whether it actually did anything - pid 1 (the
    // kernel) and any system process with no window return false, and this
    // must not print a success line it did not earn.
    const ok = kernelSignal(pid, force ? 'SIGKILL' : 'SIGTERM');
    if (!ok) { print(`Access denied: PID ${pid} cannot be terminated.`, '#ff4444'); return; }
    print(`[${pid}] ${force ? 'killed' : 'terminated'}`);
  };

  async function runTerminalCommand(raw, options) {
    if (activeCommandController) {
      print('A command is already running. Press Ctrl+C to interrupt.', '#dddd00');
      print('');
      return;
    }
    const text = String(raw || '').trim();
    options = options || {};
    activeCommandController = new AbortController();
    refreshTerminalInputMode();
    histIdx = -1;
    print(getPromptStr() + ' ' + text);
    if (text && options.recordHistory !== false) {
      cmdHistory.push(text);
      if (cmdHistory.length > 50) cmdHistory.shift();
    }
    try {
      if (await tryExecutePipeline(text)) return;

      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = resolveShellText(parts.slice(1).join(' '));
      const exeAlias = cmd.endsWith('.exe') ? cmd.slice(0, -4) : '';

      if ((cmd === 'del' || cmd === 'rm') && args.includes('*')) {
        const expanded = expandGlob(args.trim());
        // Sequential: DEL prints a line per file, and a parallel run would
        // interleave those with each other and with the blank line below.
        for (const name of expanded) await CMDS.del(name);
        print('');
        return;
      }

      if (!cmd) {
        // no-op
      } else if (CMDS[cmd]) {
        await CMDS[cmd](args);
      } else if (!args && launchTerminalTarget(parts[0])) {
        // A bare name ending in .exe is unambiguously asking to run a
        // program, so it goes through PATH resolution first.
      } else if (exeAlias && CMDS[exeAlias] && (args || !programFindAnywhere(parts[0]))) {
        // Whether the trailing alias branch may still catch a PATH miss
        // depends on whether the name is a real program at all, not just on
        // whether the launcher branch above fired.
        //   - A name WITH arguments (NOTEPAD.exe README.txt) always reaches
        //     here directly - the registry launcher takes no arguments, so
        //     this was never PATH-gated to begin with.
        //   - A bare name whose launcher attempt above failed reaches here
        //     only if programFindAnywhere says it isn't a real program (DIR,
        //     HELP, VER, DATE, ... have no registry entry - there is nothing
        //     for PATH to govern, so DIR.exe keeps working exactly like
        //     bare DIR always has). If it IS a real program (NOTEPAD.exe),
        //     the failed PATH lookup is the final answer and must not fall
        //     back to the same-named builtin - an earlier version of this
        //     reorder let that fallback stay unconditional, so a PATH-denied
        //     NOTEPAD.exe kept opening Notepad anyway, reintroducing the
        //     exact bug this reorder exists to fix.
        await CMDS[exeAlias](args);
      } else {
        print(`'${parts[0]}' is not recognized as an internal or external command.`);
        // A player who narrows PATH and then gets a generic "not recognized"
        // concludes the OS is broken rather than that they changed it. Naming
        // the directory the program is actually in is the whole payoff for
        // making PATH real, so it is not an optional nicety.
        const elsewhere = programFindAnywhere(resolveShellText(parts[0]).trim());
        if (elsewhere) {
          print(`${elsewhere.program.name} exists in ${programDisplayDir(elsewhere.dir)}, which is not on PATH.`);
        } else {
          print('Type HELP for a list of commands, or DIR to list executables.');
        }
      }
    } catch (err) {
      if (!isAbortError(err)) print(err.message || String(err), '#ff4444');
    } finally {
      activeCommandController = null;
      refreshTerminalInputMode();
    }
    print('');
  }

  _termExec = async (raw) => {
    if (pendingRead) {
      print('Finish the current INPUT prompt before starting another command.', '#ff4444');
      print('');
      return;
    }
    if (activeCommandController) {
      print('A command is already running. Press Ctrl+C to interrupt.', '#dddd00');
      print('');
      return;
    }
    await runTerminalCommand(raw, { recordHistory: true });
  };

  inp.addEventListener('keydown', async (e) => {
    if (pendingRead) {
      if (e.ctrlKey && !e.altKey && !e.metaKey && String(e.key).toLowerCase() === 'c') {
        if (interruptActiveCommand()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const response = inp.value;
        const { promptText, resolve } = pendingRead;
        inp.value = '';
        pendingRead = null;
        setPromptOverride('');
        refreshTerminalInputMode();
        print(promptText + ' ' + response);
        resolve(response);
      }
      return;
    }

    if (e.ctrlKey && !e.altKey && !e.metaKey && String(e.key).toLowerCase() === 'c') {
      if (interruptActiveCommand()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (histIdx < cmdHistory.length - 1) histIdx++;
      inp.value = cmdHistory[cmdHistory.length - 1 - histIdx] || '';
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      histIdx = Math.max(-1, histIdx - 1);
      inp.value = histIdx < 0 ? '' : cmdHistory[cmdHistory.length - 1 - histIdx];
      return;
    }

    if (e.key !== 'Enter') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if (activeCommandController) {
      print('A command is already running. Press Ctrl+C to interrupt.', '#dddd00');
      print('');
      return;
    }

    const raw = inp.value.trim();
    inp.value = '';
    await runTerminalCommand(raw, { recordHistory: true });
  }, true);

  refreshTerminalInputMode();
  document.getElementById('tw').addEventListener('click', () => inp.focus());
  procSetTimeout('terminal', () => inp.focus(), 80);
  if (initialCommand) procSetTimeout('terminal', () => { if (_termExec) _termExec(initialCommand); }, 30);
}


let _termNav = null; // exposes cwd navigation to callers when terminal is already open
let _termExec = null;
function openTerminal(startDir, initialCommand) {
  if (!mkWin({ id:'terminal', title:'TERMINAL.exe - Command Prompt', icon:'💻', w:520, h:320, x:140, y:90, menubar:false, statusbar:false })) {
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
      { label: '📋 Copy',         disabled: !sel, action: () => sel && navigator.clipboard?.writeText(sel) },
      { label: '📄 Paste',        action: () => navigator.clipboard?.readText().then(t => { inp.value += t; inp.focus(); }) },
      '-',
      { label: '🧹 Clear Screen', action: () => { out.innerHTML = ''; } },
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
  const DEFAULT_SHELL_VARS = {
    COMPUTERNAME: 'SOMA-686',
    USERNAME: 'VISITOR',
    OS: 'sleepOS 0.9b2',
    SOUL_INTEGRITY: '87',
    DAEMON_COUNT: '7',
    DAEMON_KNOWN: '4',
    TEMPORAL_DRIFT: '+/-2.3yr',
    VOID_PRESSURE: '12',
    OBSERVER_COUNT: '[classified]',
    PATH: 'C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]',
  };
  let shellVars = Object.assign(Object.create(null), DEFAULT_SHELL_VARS);
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

  function findTerminalProject(key) {
    return PROJECTS.find(p =>
      p.file.toLowerCase() === key ||
      p.file.toLowerCase().replace('.html', '') === key ||
      p.name.toLowerCase() === key ||
      p.name.toLowerCase().replace(/ /g, '-') === key
    );
  }

  function launchTerminalTarget(rawTarget) {
    const key = resolveShellText(rawTarget).trim().toLowerCase();
    if (!key) return false;
    if (key === 'void.tmp' && daemonStory.endingReached) {
      print('void.tmp is no longer present.');
      return true;
    }

    const openExplorerAtCwd = () => openExplorer(cwd || '');
    const launchers = {
      'welcome.readme': { lines: ['Opening WELCOME.README...'], action: openWelcome },
      welcome: { lines: ['Opening WELCOME.README...'], action: openWelcome },
      'notepad.exe': { lines: ['Opening Notepad...'], action: () => openNotepad(undefined, cwd) },
      notepad: { lines: ['Opening Notepad...'], action: () => openNotepad(undefined, cwd) },
      'terminal.exe': { lines: ['TERMINAL.exe is already running.', 'You are inside it.'] },
      terminal: { lines: ['TERMINAL.exe is already running.', 'You are inside it.'] },
      'explorer.exe': { lines: ['Opening File Explorer...'], action: openExplorerAtCwd },
      explorer: { lines: ['Opening File Explorer...'], action: openExplorerAtCwd },
      files: { lines: ['Opening Files...'], action: openFiles },
      'sysmon.exe': { lines: ['Starting SYSMON.exe...'], action: openSysmon },
      sysmon: { lines: ['Starting SYSMON.exe...'], action: openSysmon },
      'browser.exe': { lines: ['Starting BROWSER.exe...'], action: openBrowser },
      browser: { lines: ['Starting BROWSER.exe...'], action: openBrowser },
      'defrag.exe': { lines: ['Starting DEFRAG.exe...'], action: openDefrag },
      defrag: { lines: ['Starting DEFRAG.exe...'], action: openDefrag },
      'calc.exe': { lines: ['Starting CALC.exe...'], action: openCalculator },
      calc: { lines: ['Starting CALC.exe...'], action: openCalculator },
      'regedit.exe': { lines: ['Starting REGEDIT.exe...'], action: openRegedit },
      regedit: { lines: ['Starting REGEDIT.exe...'], action: openRegedit },
      'daemon.core': {
        lines: ['Opening daemon.core...'],
        action: openDaemon,
        delay: 320,
      },
      'void.tmp': { lines: ['Opening void.tmp...'], action: openVoid },
      '?????.exe': { lines: ['Executing ?????.exe...'], action: openUnknown },
      '?????': { lines: ['Executing ?????.exe...'], action: openUnknown },
    };

    const entry = launchers[key];
    if (entry) {
      (entry.lines || []).forEach(line => print(line));
      if (entry.action) setTimeout(entry.action, entry.delay ?? 300);
      return true;
    }

    const project = findTerminalProject(key);
    if (!project) return false;
    print(`Launching ${project.name}...`);
    print('Opening in new tab.');
    setTimeout(() => window.open(project.file, '_blank'), 400);
    return true;
  }

  function expandGlob(pattern) {
    const dir = fsGetDir(cwd);
    if (!dir) return [pattern];
    const allNames = [...dir.files.keys(), ...dir.blobs.keys()];
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp('^' + escaped + '$', 'i');
    const matches = allNames.filter(n => re.test(n));
    return matches.length ? matches : [pattern];
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
      '  DEL, RM [file]      - delete a file or directory',
      '  COPY [src] [dst]    - copy a file',
      '  MOVE, MV            - move a file',
      '  TYPE, CAT [file]    - read file contents',
      '  GREP <pattern> [f]  - filter a file or piped text',
      '  WC [file]           - count lines, words, bytes',
      '  TREE                - directory tree',
      '  PS                  - list running processes',
      '  TASKKILL [pid]      - terminate a process',
      '  IPCONFIG            - network configuration',
      '  SET                 - show environment variables',
      '  PING [host]         - ping a host',
      '  SLEEP <ms>          - pause for a number of milliseconds',
      '  VER                 - show OS version',
      '  WHO, WHOAMI         - current user info',
      '  DATE                - system date',
      '  CLS                 - clear screen',
      '  OPEN [file]         - open a file (image/video in viewer, text in editor)',
      '  RUN <file>          - execute a .script file',
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
      '  Scripts now support labels, goto, if, inc, and dec.',
      '',
      'You can also type executables directly:',
      '  notepad.exe, sysmon.exe, welcome.readme, void.tmp, daemon.core, ?????.exe',
      '  or any project name (try: fireworks, fluid, ...)',
    ];
  }

  function buildDirLines(args) {
    const targetArg = (args || '').trim();
    if (targetArg && /[*?]/.test(targetArg)) return expandGlob(targetArg);
    const targetCwd = targetArg ? targetArg.toUpperCase() : cwd;
    const dir = fsGetDir(targetCwd);
    if (!dir) throw new Error(`Directory not found: ${args}`);
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
      getTerminalRootSystemEntries({ includeExplorer: true }).forEach(entry => {
        lines.push(`${entry.date}  ${String(entry.size).padStart(7)}    ${entry.name}`);
      });
      termFS.dirs.forEach(d => { if (d !== 'DOCS') lines.push(`${ds}  ${ts}    <DIR>    ${d}`); });
      termFS.files.forEach((c, n) => lines.push(`${ds}  ${ts}  ${c.length.toString().padStart(7)}    ${n}`));
      termFS.blobs.forEach((b, n) => lines.push(`${ds}  ${ts}  ${fmtSize(b.size).padStart(7)}    ${n}  [${b.kind}]`));
    } else {
      dir.dirs.forEach(d => lines.push(`${ds}  ${ts}    <DIR>    ${d}`));
      dir.files.forEach((c, n) => lines.push(`${ds}  ${ts}  ${c.length.toString().padStart(7)}    ${n}`));
      dir.blobs.forEach((b, n) => lines.push(`${ds}  ${ts}  ${fmtSize(b.size).padStart(7)}    ${n}  [${b.kind}]`));
      if (dir.files.size + dir.blobs.size + dir.dirs.size === 0) lines.push('  (empty directory)');
    }
    lines.push('');
    return lines;
  }

  function buildPsLines() {
    const lines = [
      '  PID   CPU    MEM   PROCESS',
      '  ---   ---    ---   -------',
    ];
    getBuiltInProcesses().forEach(proc => {
      lines.push(`  ${String(proc.pid).padStart(4, '0')}  ${String(proc.cpu.toFixed(1)).padStart(3)}%  ${String(proc.mem.toFixed(1)).padStart(4)}%  ${proc.name}`);
    });
    [['0333', '0.0%', ' 0.1%', 'UNKNOWN'], ['0334', '0.0%', ' 0.1%', 'UNKNOWN'], ['0335', '0.0%', ' 0.1%', 'UNKNOWN']]
      .forEach(([pid, cpu, mem, name]) => lines.push(`  ${pid}  ${cpu}  ${mem}  ${name}`));
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

  function buildSetLines() {
    return [
      'COMPUTERNAME=SOMA-686',
      'USERNAME=VISITOR',
      'OS=sleepOS 0.9b2',
      'SOUL_INTEGRITY=87',
      'DAEMON_COUNT=7',
      'DAEMON_KNOWN=4',
      'TEMPORAL_DRIFT=+/-2.3yr',
      'VOID_PRESSURE=12',
      'OBSERVER_COUNT=[classified]',
      'PATH=C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]',
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
    const docs = fsGetDir('DOCS');
    [...docs.files.keys()].forEach((n, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${n}`));
    termFS.dirs.forEach(d => {
      if (d === 'DOCS') return;
      lines.push(`├── ${d}\\`);
      const sub = termFS.subdirs?.get(d);
      if (sub) {
        [...sub.files.keys()].forEach((n, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${n}`));
        [...sub.blobs.keys()].forEach((n, i, a) => lines.push(`│   ${i === a.length - 1 ? '└' : '├'}── ${n}`));
      }
    });
    getRootSystemFiles({ includeExplorer: true }).forEach(name => {
      let label = name;
      if (name === 'daemon.core') label = daemonStory.endingReached ? 'daemon.core              [ARCHIVED]' : 'daemon.core              [CONTAINMENT]';
      if (name === '?????.exe') label = daemonStory.stage >= 7 ? getExeDisplayName() + '                [QUARANTINE LAUNCHER]' : '?????.exe                [DO NOT EXECUTE]';
      lines.push(`├── ${label}`);
    });
    termFS.files.forEach((_, n) => lines.push(`├── ${n}`));
    termFS.blobs.forEach((b, n) => lines.push(`├── ${n}  [${b.kind}]`));
    lines.push('└── PROJECTS\\');
    lines.push('    ├── sand playground');
    lines.push('    ├── fireworks');
    lines.push('    ├── ... (more objects)');
    lines.push('    └── [1 object cannot be listed]');
    return lines;
  }

  function getPipeableText(path) {
    const { dirName, fileName } = fsSplitPath(path, cwd);
    const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
    if (upperPath === 'DAEMON.CORE') {
      daemonActivate('raw');
      return buildDaemonCoreRawContent().split('\n');
    }
    if (upperPath === 'VOID.TMP' && !daemonStory.endingReached) {
      daemonRecordInvestigation('void');
      return getVoidTmpContent().split('\n');
    }
    const entry = fsGetEntry(path, cwd);
    if (!entry) throw new Error('File not found: ' + path);
    if (upperPath === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
    if (upperPath === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
    if (entry.kind === 'blob') {
      return [
        `Binary file: ${entry.fileName} (${entry.value.kind}, ${fmtSize(entry.value.size)})`,
        `Use OPEN ${entry.fileName} to view it.`,
      ];
    }
    return entry.value ? entry.value.split('\n') : [];
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
      const tid = setTimeout(() => ctrl.abort(), 4000);
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
      '  IPCONFIG            - network configuration',
      '  SET [name=value]    - show or assign shell variables',
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
    ];
  }

  function buildSetLines(nameFilter) {
    const keys = Object.keys(shellVars).sort((a, b) => a.localeCompare(b));
    if (!nameFilter) return keys.map(key => `${key}=${shellVars[key]}`);
    return Object.prototype.hasOwnProperty.call(shellVars, nameFilter)
      ? [`${nameFilter}=${shellVars[nameFilter]}`]
      : [`Variable not defined: ${nameFilter}`];
  }

  async function runPipeStage(cmd, args, stdinLines) {
    cmd = ({ print: 'echo', wait: 'sleep', clear: 'cls' }[cmd] || cmd);
    if (cmd === 'echo') return [unquoteShellValue(resolveShellText(args))];
    if (cmd === 'help') return buildHelpLines();
    if (cmd === 'dir' || cmd === 'ls') return buildDirLines(resolveShellText(args));
    if (cmd === 'ps') return buildPsLines();
    if (cmd === 'ver') return buildVerLines();
    if (cmd === 'who' || cmd === 'whoami') return buildWhoLines();
    if (cmd === 'date') return buildDateLines();
    if (cmd === 'set') return applyShellSet(args);
    if (cmd === 'input') return runShellInputCommand(args);
    if (cmd === 'inc' || cmd === 'dec' || cmd === 'add' || cmd === 'sub' || cmd === 'mul' || cmd === 'div' || cmd === 'mod') {
      return runShellNumericCommand(cmd, args);
    }
    if (cmd === 'ipconfig') return buildIpconfigLines();
    if (cmd === 'tree') return buildTreeLines();
    if (cmd === 'ping') return buildPingLines(resolveShellText(args), getCurrentCommandSignal());
    if (cmd === 'sleep') {
      await scriptSleep(parseTerminalDelayMs(resolveShellText(args)), getCurrentCommandSignal());
      return Array.isArray(stdinLines) ? stdinLines.slice() : [];
    }
    if (cmd === 'cls') {
      out.innerHTML = '';
      return Array.isArray(stdinLines) ? stdinLines.slice() : [];
    }
    if (cmd === 'cat' || cmd === 'type') {
      const target = resolveShellText(args).trim();
      if (target) return getPipeableText(target);
      if (Array.isArray(stdinLines)) return stdinLines.slice();
      throw new Error('Usage: CAT [file]');
    }
    if (cmd === 'grep') {
      const match = resolveShellText(args).trim().match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)(?:\s+(.+))?$/);
      if (!match) throw new Error('Usage: GREP <pattern> [file]');
      const pattern = unquoteShellValue(match[1]);
      const target = match[2] ? unquoteShellValue(match[2]) : '';
      let re;
      try { re = new RegExp(pattern, 'i'); } catch (e) { throw new Error('Invalid regex: ' + pattern); }
      const sourceLines = target ? getPipeableText(target) : Array.isArray(stdinLines) ? stdinLines.slice() : null;
      if (!sourceLines) throw new Error('Usage: GREP <pattern> [file]');
      return sourceLines.filter(line => re.test(line));
    }
    if (cmd === 'wc') {
      let sourceText = '';
      let label = '';
      const targetArg = resolveShellText(args).trim();
      if (targetArg) {
        const target = unquoteShellValue(targetArg);
        const entry = fsGetEntry(target, cwd);
        if (!entry || entry.kind !== 'text') throw new Error('File not found: ' + target);
        sourceText = entry.value;
        label = '  ' + entry.fileName;
      } else if (Array.isArray(stdinLines)) {
        sourceText = stdinLines.join('\n');
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

  function writePipelineOutput(targetPath, lines, append) {
    const normalizedTarget = unquoteShellValue(resolveShellText(targetPath));
    if (!normalizedTarget) throw new Error('Missing redirect target.');
    const existing = fsGetEntry(normalizedTarget, cwd);
    if (existing && existing.kind === 'blob') throw new Error('Cannot write text output to binary file: ' + normalizedTarget);
    const output = lines.join('\n');
    const existingText = existing && existing.kind === 'text' ? existing.value : '';
    const nextValue = append
      ? (existingText && output ? existingText + '\n' + output : existingText + output)
      : output;
    const saved = fsWriteTextFile(normalizedTarget, nextValue, cwd);
    if (!saved) throw new Error('Cannot write file: ' + normalizedTarget);
    document.dispatchEvent(new CustomEvent('fs-changed'));
    return saved;
  }

  async function tryExecutePipeline(raw) {
    const parsed = parseShellLine(raw);
    if (!parsed || (!parsed.redirectOp && parsed.stages.length < 2)) return false;
    if (!parsed.stages.length) {
      print('Invalid command pipeline.', '#ff4444');
      print('');
      return true;
    }
    try {
      let stream = null;
      let consumedBySink = false;
      for (let i = 0; i < parsed.stages.length; i++) {
        const { cmd, args } = getCommandParts(parsed.stages[i]);
        if (!cmd) throw new Error('Invalid command pipeline.');
        const isLastStage = i === parsed.stages.length - 1;
        if (isLastStage && (cmd === 'notepad' || cmd === 'notepad.exe')) {
          const content = Array.isArray(stream) ? stream.join('\n') : '';
          const target = args.trim();
          if (target) {
            const saved = writePipelineOutput(target, Array.isArray(stream) ? stream : [], false);
            print(`Opening ${saved.fileName} in Notepad...`);
            setTimeout(() => openNotepad(saved.fileName, saved.dirName), 300);
          } else {
            print('Opening piped output in Notepad...');
            setTimeout(() => openNotepad(undefined, cwd, { initialContent: content }), 300);
          }
          consumedBySink = true;
          break;
        }
        const result = await runPipeStage(cmd, args, stream);
        if (!result) throw new Error('Piping not supported for command: ' + cmd.toUpperCase());
        stream = result;
      }
      if (parsed.redirectOp) {
        if (consumedBySink) throw new Error('Cannot redirect output after piping into Notepad.');
        const saved = writePipelineOutput(parsed.redirectTarget, Array.isArray(stream) ? stream : [], parsed.redirectOp === '>>');
        print(`${parsed.redirectOp === '>>' ? 'Appended' : 'Wrote'}: ${saved.fileName}`);
      } else if (!consumedBySink) {
        (stream || []).forEach(line => print(line));
      }
    } catch (err) {
      print(err.message || String(err), '#ff4444');
    }
    print('');
    return true;
  }

  const CMDS = {
    help: () => {
      buildHelpLines().forEach(l => print(l));
      return;
      [
        'Available commands:',
        '  HELP            - show this help',
        '  DIR, LS         - list directory',
        '  CD [path]       - change directory',
        '  MKDIR [name]    - create directory',
        '  TOUCH [name]    - create empty file',
        '  cmd > file      - redirect command output (>> to append)',
        '  DEL, RM [file]  - delete a file or directory',
        '  COPY [src] [dst]- copy a file',
        '  MOVE, MV        - move a file',
        '  TYPE [file]     - print file contents',
        '  TREE            - directory tree',
        '  PS              - list running processes',
        '  TASKKILL [pid]  - terminate a process',
        '  IPCONFIG        - network configuration',
        '  SET             - show environment variables',
        '  CAT [file]      - read a file',
        '  PING [host]     - ping a host',
        '  ECHO [text]     - echo text',
        '  VER             - show OS version',
        '  WHO, WHOAMI     - current user info',
        '  DATE            - system date',
        '  CLS             - clear screen',
        '  OPEN [file]     - open a file (image/video in viewer, text in editor)',
        '  RUN <file>      - execute a .script file',
        '  NOTEPAD [file]  - open Notepad (optionally open a file)',
        '  cmd | NOTEPAD   - open piped output in Notepad',
        '  START [program] - run an executable or project',
        '  EXIT            - close terminal',
        '',
        'Scripting: see DOCS/SCRIPTING.txt  (CD DOCS, CAT SCRIPTING.txt)',
        '',
        'You can also type executables directly:',
        '  notepad.exe, sysmon.exe, welcome.readme, void.tmp, daemon.core, ?????.exe',
        '  or any project name (try: fireworks, fluid, ...)',
      ].forEach(l => print(l));
    },
    dir: (args) => {
      const targetCwd = args ? args.trim().toUpperCase() : cwd;
      const dir = fsGetDir(targetCwd);
      if (!dir) { print(`Directory not found: ${args}`); return; }
      const path = targetCwd ? `C:\\sleepOS\\${targetCwd}` : 'C:\\sleepOS';
      print('Volume in drive C is CORPUS');
      print('Volume Serial Number is DEAD-C0DE');
      print('');
      print(`Directory of ${path}`);
      print('');
      const now = new Date();
      const ds = `${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')}/${now.getFullYear()}`;
      const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
      if (!targetCwd) {
        // Root: show system entries
        [
          `11/13/2024  10:31    <DIR>    .`,
          `11/13/2024  10:31    <DIR>    ..`,
          `11/13/2024  10:31    <DIR>    DOCS`,
          `11/13/2024  10:31    <DIR>    PROJECTS`,
          `11/13/2024  10:31    4,096    TERMINAL.exe`,
          `11/13/2024  10:31    8,192    SYSMON.exe`,
          `11/13/2024  03:17        0    void.tmp`,
          `11/13/2024  ??:??       ??    daemon.core`,
          `11/13/2024  ??:??       ??    ?????.exe`,
        ].forEach(l => print(l));
        termFS.dirs.forEach(d => { if (d !== 'DOCS') print(`${ds}  ${ts}    <DIR>    ${d}`); });
        termFS.files.forEach((c, n) => print(`${ds}  ${ts}  ${c.length.toString().padStart(7)}    ${n}`));
        termFS.blobs.forEach((b, n) => print(`${ds}  ${ts}  ${fmtSize(b.size).padStart(7)}    ${n}  [${b.kind}]`));
      } else {
        dir.dirs.forEach(d => print(`${ds}  ${ts}    <DIR>    ${d}`));
        dir.files.forEach((c, n) => print(`${ds}  ${ts}  ${c.length.toString().padStart(7)}    ${n}`));
        dir.blobs.forEach((b, n) => print(`${ds}  ${ts}  ${fmtSize(b.size).padStart(7)}    ${n}  [${b.kind}]`));
        if (dir.files.size + dir.blobs.size + dir.dirs.size === 0) print('  (empty directory)');
      }
      print('');
    },
    ls: (args) => CMDS.dir(args),
    ps: () => {
      print('  PID   CPU    MEM   PROCESS');
      print('  ---   ---    ---   -------');
      [
        ['0001', '0.0%', ' 2.1%', 'System Idle'],
        ['0004', '0.3%', ' 4.8%', 'kernel.exe'],
        ['0088', '1.2%', '12.4%', 'sleep_gui.exe'],
        ['0112', '0.8%', ' 8.3%', 'dream_fragment.exe'],
        ['0247', '3.1%', '22.7%', 'noise_engine.exe'],
        ['0333', '0.0%', ' 0.1%', 'UNKNOWN'],
        ['0334', '0.0%', ' 0.1%', 'UNKNOWN'],
        ['0335', '0.0%', ' 0.1%', 'UNKNOWN'],
        ['0512', '7.4%', '31.2%', 'soul_daemon.exe'],
        ['0999', '0.0%', '  ???', 'void.exe'],
      ].forEach(([pid, cpu, mem, name]) => {
        const isUnk = name === 'UNKNOWN';
        print(`  ${pid}  ${cpu}  ${mem}  ${name}`, isUnk ? '#ff4444' : undefined);
      });
    },
    ver: () => {
      print('sleepOS Version 0.9\u03b2 (Build 2024.11.13-EXPERIMENTAL)');
      print('Soul Architecture: SOMA-686  /  Corpus Mode: ACTIVE');
    },
    who: () => {
      print('Current user : VISITOR\\UNKNOWN');
      print('Domain       : sleepOS.CORPUS');
      print('Session ID   : 0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6,'0'));
      print('Observers    : unknown (cannot enumerate)');
    },
    date: () => {
      const now = new Date();
      print('System date: ' + now.toDateString());
      print('NOTE: Clock drift detected. True date: +/- 2.3 years from displayed.');
    },
    ping: async (args) => {
      const host = (args || 'evenet.fun').trim().replace(/^https?:\/\//i,'').replace(/[/?#].*$/,'');
      print(`Pinging ${host} with 32 bytes of data:`);
      const times = []; let received = 0;
      for (let i = 0; i < 4; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 1000));
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const t0 = performance.now();
        try {
          await fetch(`https://${host}/`, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
          clearTimeout(tid);
          const ms = Math.round(performance.now() - t0);
          times.push(ms); received++;
          print(`Reply from ${host}: bytes=32 time=${ms}ms TTL=57`);
        } catch(e) {
          clearTimeout(tid);
          print(`Request timeout for ${host}.`);
        }
      }
      print('');
      print(`Ping statistics for ${host}:`);
      const lost = 4 - received;
      print(`  Packets: Sent = 4, Received = ${received}, Lost = ${lost} (${Math.round(lost/4*100)}% loss)`);
      if (times.length) print(`Approximate round trip times: Min=${Math.min(...times)}ms  Max=${Math.max(...times)}ms  Avg=${Math.round(times.reduce((a,b)=>a+b)/times.length)}ms`);
    },
    sleep: async (args) => {
      await scriptSleep(parseTerminalDelayMs(args));
    },
    echo: (args) => { if (args) print(args); },
    cls: () => { out.innerHTML = ''; },
    whoami: (args) => CMDS.who(args),
    type: (args) => CMDS.cat(args),
    cd: (args) => {
      const dest = (args || '').trim();
      if (!dest || dest === '.' || dest === 'C:\\sleepOS' || dest === '\\') {
        cwd = ''; updatePrompt(); return;
      } else if (dest === '..') {
        if (!cwd) { print('Already at root.'); return; }
        const i = cwd.lastIndexOf('\\'); cwd = i >= 0 ? cwd.slice(0, i) : ''; updatePrompt(); return;
      } else {
        const newCwd = cwd ? cwd + '\\' + dest.toUpperCase() : dest.toUpperCase();
        const dir = fsGetDir(newCwd);
        if (dir) { cwd = newCwd; updatePrompt(); }
        else { print(`The system cannot find the path specified: ${dest}`); }
      }
    },
    mkdir: (args) => {
      if (!args) { print('Usage: MKDIR [name]'); return; }
      const name = args.trim().toUpperCase();
      const dir = fsGetDir(cwd);
      if (dir.dirs.has(name) || ['PROJECTS','DOCS','.','..'].includes(name)) {
        print(`A subdirectory or file ${name} already exists.`); return;
      }
      fsCreateDir(name, cwd);
      print(`Directory created: ${getPromptStr().replace('>','')}\\${name}`);
    },
    touch: (args) => {
      if (!args) { print('Usage: TOUCH [filename]'); return; }
      const name = args.trim();
      const dir = fsGetDir(cwd);
      if (dir.files.has(name)) { print(`File already exists: ${name}`); return; }
      fsWriteTextFile(name, '', cwd);
      print(`Created: ${name}`);
    },
    del: (args) => {
      const raw = (args || '').trim();
      if (!raw) { print('Usage: DEL [filename]'); return; }
      const result = deleteVirtualPath(raw, cwd);
      if (!result.ok) print(result.message || `Cannot delete ${raw}`, '#ff4444');
      (result.details || []).forEach(line => print(line, result.ok ? undefined : '#dddd00'));
    },
    rm: (args) => CMDS.del(args),
    copy: (args) => {
      const parts = (args || '').trim().split(/\s+/);
      if (parts.length < 2) { print('Usage: COPY [source] [destination]'); return; }
      print(`Copying '${parts[0]}' to '${parts[1]}'...`);
      setTimeout(() => {
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
    tree: () => {
      print('C:\\sleepOS');
      // DOCS (always)
      print('├── DOCS\\');
      const docs = fsGetDir('DOCS');
      [...docs.files.keys()].forEach((n, i, a) => print(`│   ${i===a.length-1?'└':'├'}── ${n}`));
      // User dirs
      termFS.dirs.forEach(d => {
        if (d === 'DOCS') return;
        print(`├── ${d}\\`);
        const sub = termFS.subdirs?.get(d);
        if (sub) {
          [...sub.files.keys()].forEach((n, i, a) => print(`│   ${i===a.length-1?'└':'├'}── ${n}`));
          [...sub.blobs.keys()].forEach((n, i, a) => print(`│   ${i===a.length-1?'└':'├'}── ${n}`));
        }
      });
      // System files
      ['TERMINAL.exe','SYSMON.exe','NOTEPAD.exe','BROWSER.exe','DEFRAG.exe',
       'void.tmp','daemon.core              [UNREADABLE]','?????.exe                [DO NOT EXECUTE]'
      ].forEach(n => print(`├── ${n}`));
      // User files
      termFS.files.forEach((_, n) => print(`├── ${n}`));
      termFS.blobs.forEach((b, n) => print(`├── ${n}  [${b.kind}]`));
      // PROJECTS
      print('└── PROJECTS\\');
      print('    ├── sand playground');
      print('    ├── fireworks');
      print('    ├── ... (more objects)');
      print('    └── [1 object cannot be listed]');
    },
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
      // Look up real window by PID
      const winId = winIdByPid(pid);
      if (winId && wins[winId]) {
        const name = wins[winId].title.split(' \u2014')[0].trim();
        print(`Terminating ${name} (PID ${pid})...`);
        setTimeout(() => {
          closeWin(winId);
          print(`SUCCESS: Process "${name}" (PID ${pid}) terminated.`);
        }, 400);
      } else {
        print(`ERROR: The process with PID ${pid} was not found.`, '#ff4444');
      }
    },
    ipconfig: () => {
      [
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
      ].forEach(l => print(l));
    },
    set: () => {
      [
        'COMPUTERNAME=SOMA-686',
        'USERNAME=VISITOR',
        'OS=sleepOS 0.9b2',
        'SOUL_INTEGRITY=87',
        'DAEMON_COUNT=7',
        'DAEMON_KNOWN=4',
        'TEMPORAL_DRIFT=+/-2.3yr',
        'VOID_PRESSURE=12',
        'OBSERVER_COUNT=[classified]',
        'PATH=C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]',
      ].forEach(l => print(l));
    },
    cat: (args) => {
      const raw = (args||'').trim();
      if (!raw) { print('Usage: CAT <file>'); return; }
      const { dirName, fileName } = fsSplitPath(raw, cwd);
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
      const entry = fsGetEntry(raw, cwd);
      if (!entry) {
        print('File not found: ' + raw);
        return;
      }
      if (upperPath === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
      if (upperPath === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
      if (entry.kind === 'blob') {
        print(`Binary file: ${entry.fileName} (${entry.value.kind}, ${fmtSize(entry.value.size)})`);
        print(`Use OPEN ${entry.fileName} to view it.`);
        return;
      }
      if (entry.value === '') {
        print('(empty file)');
        return;
      }
      entry.value.split('\n').forEach(line => print(line));
    },
    start: (args) => {
      if (!args) { print('Usage: START [program]'); return; }
      // re-use the exe dispatch by simulating a command run
      const key = args.toLowerCase().trim();
      const EXES_start = {
        'welcome.readme': openWelcome,
        'welcome':        openWelcome,
        'notepad.exe':    openNotepad,
        'notepad':        openNotepad,
        'explorer.exe':   openExplorer,
        'explorer':       openExplorer,
        'sysmon.exe':     openSysmon,
        'sysmon':         openSysmon,
        'browser.exe':    openBrowser,
        'browser':        openBrowser,
        'defrag.exe':     openDefrag,
        'defrag':         openDefrag,
        'daemon.core':    openDaemon,
        'void.tmp':       openVoid,
        '?????.exe':      openUnknown,
      };
      const proj = PROJECTS.find(p =>
        p.file.toLowerCase() === key ||
        p.file.toLowerCase().replace('.html','') === key ||
        p.name.toLowerCase() === key ||
        p.name.toLowerCase().replace(/ /g,'-') === key
      );
      if (EXES_start[key]) {
        print(`Starting ${args}...`);
        setTimeout(EXES_start[key], 300);
      } else if (proj) {
        print(`Launching ${proj.name}...`);
        setTimeout(() => window.open(proj.file, '_blank'), 400);
      } else {
        print(`Cannot find program: ${args}`);
      }
    },
    open: (args) => {
      const raw = (args || '').trim();
      if (!raw) { print('Usage: OPEN [filename]'); return; }
      const split = fsSplitPath(raw, cwd);
      if (isVisibleSystemPath(raw, { includeExplorer: true })) {
        print(`Opening ${split.fileName}...`);
        setTimeout(() => openSystemFile(split.fileName), 300);
        return;
      }
      const entry = fsGetEntry(raw, cwd);
      if (entry && entry.kind === 'blob') {
        print(`Opening ${raw}...`);
        setTimeout(() => openMediaFile(raw, cwd), 300);
      } else if (entry && entry.kind === 'text') {
        print(`Opening ${raw}...`);
        setTimeout(() => openNotepad(raw, cwd), 300);
      } else {
        print(`File not found: ${raw}`);
        print('Use DIR to list available files.');
      }
    },
    run: async (args) => {
      const fname = (args || '').trim();
      if (!fname) { print('Usage: RUN <script.script>'); return; }
      const entry = fsGetEntry(fname, cwd);
      if (!entry || entry.kind !== 'text') { print(`Script not found: ${fname}`, '#ff4444'); return; }
      print(`Running ${fname}...`);
      await execScript(entry.value, print, {
        sourceName: entry.fileName,
        dirName: entry.dirName,
        clearFn: () => { out.innerHTML = ''; },
      });
    },
    notepad: (args) => {
      const fname = args ? args.trim() : null;
      if (fname) {
        const entry = fsGetEntry(fname, cwd);
        if (!entry || entry.kind !== 'text') { print(`File not found: ${fname}`); return; }
      }
      print(fname ? `Opening ${fname} in Notepad...` : 'Opening Notepad...');
      setTimeout(() => openNotepad(fname || undefined, cwd), 300);
    },
    grep: (args) => {
      if (!args) { print('Usage: GREP <pattern> <file>'); return; }
      const parts = args.match(/^("(?:[^"\\]|\\.)*"|[^\s]+)\s+(.+)$/);
      if (!parts) { print('Usage: GREP <pattern> <file>'); return; }
      const pattern = parts[1].replace(/^"|"$/g,'');
      const fname = parts[2].trim();
      let re;
      try { re = new RegExp(pattern, 'i'); } catch(e) { print('Invalid regex: ' + pattern, '#ff4444'); return; }
      const dir = fsGetDir(cwd);
      if (!dir || !dir.files.has(fname)) { print('File not found: ' + fname); return; }
      const lines = dir.files.get(fname).split('\n');
      let matches = 0;
      lines.forEach((line, i) => {
        if (re.test(line)) { print((i+1) + ':' + line); matches++; }
      });
      if (matches === 0) print('(no matches)');
      else print('\n' + matches + ' match' + (matches !== 1 ? 'es' : '') + ' found');
    },
    wc: (args) => {
      const fname = (args || '').trim();
      if (!fname) { print('Usage: WC <file>'); return; }
      const dir = fsGetDir(cwd);
      if (!dir || !dir.files.has(fname)) { print('File not found: ' + fname); return; }
      const content = dir.files.get(fname);
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
    const entry = fsGetEntry(fname, cwd);
    if (!entry || entry.kind !== 'text') { print(`Script not found: ${fname}`, '#ff4444'); return; }
    print(`Running ${fname}...`);
    const exitCode = await execScript(entry.value, print, {
      sourceName: entry.fileName,
      dirName: entry.dirName,
      vars: shellVars,
      readLine: readTerminalLine,
      signal: getCurrentCommandSignal(),
      args: tokens.slice(1),
      clearFn: () => { out.innerHTML = ''; },
    });
    if (exitCode !== 0) print(`Exit code: ${exitCode}`, '#dddd00');
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
        expanded.forEach(name => CMDS.del(name));
        print('');
        return;
      }

      if (!cmd) {
        // no-op
      } else if (CMDS[cmd]) {
        await CMDS[cmd](args);
      } else if (exeAlias && CMDS[exeAlias]) {
        await CMDS[exeAlias](args);
      } else if (!args && launchTerminalTarget(parts[0])) {
        // launched directly
      } else {
        print(`'${parts[0]}' is not recognized as an internal or external command.`);
        print('Type HELP for a list of commands, or DIR to list executables.');
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
  setTimeout(() => inp.focus(), 80);
  if (initialCommand) setTimeout(() => { if (_termExec) _termExec(initialCommand); }, 30);
}

function openSysmon() {
  if (!mkWin({ id:'sysmon', title:'SYSMON.exe - System Monitor', icon:'📊', w:460, h:400, x:160, y:80 })) return;
  const mb   = document.getElementById('mb-sysmon');
  const body = document.getElementById('wb-sysmon');
  body.style.cssText = 'background:#c0c0c0;overflow:hidden;display:flex;flex-direction:column;';

  const METRICS = [
    { key:'cpu',       label:'CPU Usage',      val:34, color:'#000080' },
    { key:'ram',       label:'RAM Usage',       val:61, color:'#000080' },
    { key:'soul',      label:'Soul Integrity',  val:87, color:'#006400' },
    { key:'dream',     label:'Dream Cache',     val:23, color:'#800080' },
    { key:'entropy',   label:'Entropy Level',   val:74, color:'#8b4513' },
    { key:'void',      label:'Void Pressure',   val:12, color:'#000080' },
    { key:'daemon',    label:'Daemon Activity', val:45, color:'#800000' },
    { key:'coherence', label:'Coherence',       val:91, color:'#006060' },
  ];
  const state = {};
  METRICS.forEach(m => { state[m.key] = m.val; });

  let updateInterval = 1500;
  let showSysProcs   = true;
  let activeTab      = 'resources';
  let selectedProc   = null;
  let smTimer        = null;

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;border-bottom:2px solid #808080;background:#c0c0c0;flex-shrink:0;padding:3px 4px 0;gap:2px;';
  function makeTabBtn(label, key) {
    const t = document.createElement('button');
    t.textContent = label; t.dataset.tab = key;
    t.style.cssText = 'background:#c0c0c0;border:1px solid;border-color:#fff #808080 #808080 #fff;border-bottom:none;padding:2px 12px;font-size:11px;cursor:default;font-family:var(--sleep-font);position:relative;bottom:-1px;';
    t.addEventListener('click', () => switchTab(key));
    tabBar.appendChild(t); return t;
  }
  const tabRes  = makeTabBtn('Resources', 'resources');
  const tabProc = makeTabBtn('Processes', 'processes');
  body.appendChild(tabBar);

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow:hidden;position:relative;';
  body.appendChild(content);

  // Resources panel
  const resPanel = document.createElement('div');
  resPanel.style.cssText = 'position:absolute;inset:0;overflow:auto;padding:6px 6px 4px;';
  resPanel.innerHTML = METRICS.map(m => `
    <div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
      <div style="width:112px;font-size:10px;white-space:nowrap;">${m.label}</div>
      <div style="flex:1;height:14px;border:1px solid;border-color:#808080 #fff #fff #808080;background:#fff;position:relative;min-width:60px;">
        <div id="smbar-${m.key}" style="position:absolute;inset:0;right:auto;width:${m.val}%;background:${m.color || '#000080'};"></div>
      </div>
      <div id="smval-${m.key}" style="width:30px;font-size:10px;text-align:right;">${m.val}%</div>
    </div>`).join('') + `
    <div style="margin-top:6px;padding:3px 0 0;font-size:10px;color:#444;border-top:1px solid #b0b0b0;">
      <b>Processes:</b> <span id="sm-proc-count">--</span> running &nbsp;|&nbsp; <b>Uptime:</b> <span id="sm-uptime">--:--:--</span>
    </div>`;
  content.appendChild(resPanel);

  // Processes panel
  const procPanel = document.createElement('div');
  procPanel.style.cssText = 'position:absolute;inset:0;overflow:hidden;display:none;flex-direction:column;';
  const btnStyle = 'background:#c0c0c0;border:1px solid;border-color:#fff #808080 #808080 #fff;padding:2px 10px;font-size:10px;cursor:default;font-family:var(--sleep-font);';
  const procToolbar = document.createElement('div');
  procToolbar.style.cssText = 'padding:3px 4px;display:flex;gap:3px;border-bottom:1px solid #808080;flex-shrink:0;';
  procToolbar.innerHTML = `
    <button id="sm-kill-btn"    style="${btnStyle}">End Task</button>
    <button id="sm-copypid-btn" style="${btnStyle}">Copy PID</button>
    <button id="sm-refresh-btn" style="${btnStyle}">Refresh</button>`;
  procPanel.appendChild(procToolbar);
  const procHeader = document.createElement('div');
  procHeader.style.cssText = 'display:flex;background:#c0c0c0;border-bottom:1px solid #808080;font-size:10px;font-weight:bold;flex-shrink:0;';
  procHeader.innerHTML = `
    <div style="width:54px;padding:2px 4px;border-right:1px solid #808080;">PID</div>
    <div style="flex:1;padding:2px 4px;border-right:1px solid #808080;">Image Name</div>
    <div style="width:52px;padding:2px 4px;border-right:1px solid #808080;">CPU %</div>
    <div style="width:58px;padding:2px 4px;">Mem %</div>`;
  procPanel.appendChild(procHeader);
  const procList = document.createElement('div');
  procList.style.cssText = 'flex:1;overflow-y:auto;background:#fff;';
  procPanel.appendChild(procList);
  content.appendChild(procPanel);

  function getProcessList() {
    const procs = [];
    Object.entries(wins).forEach(([id, w]) => {
      const rawName = w.title.split(' \u2014')[0].trim();
      const name = (rawName.endsWith('.exe') || rawName.endsWith('.readme') || rawName.includes('.')) ? rawName : rawName + '.exe';
      procs.push({ pid: pidFromId(id), name, cpu: parseFloat((0.3 + Math.random() * 4).toFixed(1)), mem: parseFloat((1 + Math.random() * 12).toFixed(1)), winId: id, isSystem: false });
    });
    if (showSysProcs) {
      getBuiltInProcesses().forEach(p => procs.push({
        ...p,
        cpu: parseFloat((p.cpu + (Math.random() - 0.5) * 0.2).toFixed(1)),
        mem: parseFloat((p.mem + (Math.random() - 0.5) * 0.3).toFixed(1)),
        winId: null,
        isSystem: true,
      }));
    }
    return procs.sort((a, b) => a.pid - b.pid);
  }

  function renderProcesses() {
    if (!wins['sysmon']) return;
    const procs = getProcessList();
    procList.innerHTML = '';
    procs.forEach(p => {
      const sel = selectedProc && selectedProc.pid === p.pid;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;font-size:10px;border-bottom:1px solid #f0f0f0;cursor:default;background:${sel ? '#000080' : 'transparent'};color:${sel ? '#fff' : '#000'};`;
      row.innerHTML = `<div style="width:54px;padding:1px 4px;border-right:1px solid #e8e8e8;">${p.pid}</div><div style="flex:1;padding:1px 4px;border-right:1px solid #e8e8e8;overflow:hidden;white-space:nowrap;">${p.name}</div><div style="width:52px;padding:1px 4px;border-right:1px solid #e8e8e8;">${p.cpu.toFixed(1)}</div><div style="width:58px;padding:1px 4px;">${p.mem.toFixed(1)}</div>`;
      row.addEventListener('click', () => { selectedProc = p; renderProcesses(); });
      row.addEventListener('contextmenu', e => {
        e.preventDefault();
        selectedProc = p;
        renderProcesses();
        showCtxMenu(e.clientX, e.clientY, [
          { label: 'End Task', action: () => procToolbar.querySelector('#sm-kill-btn').click() },
          '-',
          { label: 'Copy PID', action: () => procToolbar.querySelector('#sm-copypid-btn').click() },
        ]);
      });
      procList.appendChild(row);
    });
    const ct = document.getElementById('sm-proc-count');
    if (ct) ct.textContent = procs.length;
  }

  procToolbar.querySelector('#sm-kill-btn').addEventListener('click', () => {
    if (!selectedProc) return;
    if (selectedProc.isSystem) {
      if (selectedProc.pid === 512) {
        const result = killSoulDaemonProcess();
        selectedProc = null;
        renderProcesses();
        osAlert([result.message, ...(result.details || [])].filter(Boolean).join('\n'), result.ok ? 'Process Update' : 'Access Denied', '⚠️');
        return;
      }
      const dlgId = 'sm-killerr-' + Date.now();
      if (mkWin({ id:dlgId, title:'Access Denied', icon:'\u26a0\ufe0f', w:290, h:110, popup:true, menubar:false, statusbar:false })) {
        const db = document.getElementById('wb-' + dlgId);
        if (db) { db.style.cssText = 'padding:12px 14px;font-size:11px;'; db.innerHTML = `<p style="margin-bottom:10px;">Unable to terminate system process.<br><b>Access Denied</b> (PID: ${selectedProc.pid})</p><div style="text-align:center"><button style="${btnStyle}" onclick="closeWin('${dlgId}')">OK</button></div>`; }
      }
      return;
    }
    if (selectedProc.winId && wins[selectedProc.winId]) {
      const wid = selectedProc.winId; selectedProc = null; closeWin(wid); renderProcesses();
    }
  });
  procToolbar.querySelector('#sm-copypid-btn').addEventListener('click', () => {
    if (!selectedProc) return;
    navigator.clipboard.writeText(String(selectedProc.pid)).catch(() => {});
    const btn = procToolbar.querySelector('#sm-copypid-btn');
    const orig = btn.textContent; btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 800);
  });
  procToolbar.querySelector('#sm-refresh-btn').addEventListener('click', renderProcesses);

  function switchTab(tab) {
    activeTab = tab;
    if (tab === 'resources') {
      resPanel.style.display = 'block'; procPanel.style.display = 'none';
      tabRes.style.background = '#fff'; tabRes.style.borderColor = '#fff #808080 #c0c0c0 #fff';
      tabProc.style.background = '#c0c0c0'; tabProc.style.borderColor = '#fff #808080 #808080 #fff';
    } else {
      resPanel.style.display = 'none'; procPanel.style.display = 'flex';
      tabRes.style.background = '#c0c0c0'; tabRes.style.borderColor = '#fff #808080 #808080 #fff';
      tabProc.style.background = '#fff'; tabProc.style.borderColor = '#fff #808080 #c0c0c0 #fff';
      renderProcesses();
    }
  }
  switchTab('resources');

  mb.innerHTML = '';
  const viewSpan = document.createElement('span'); viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
  viewSpan.addEventListener('click', e => { e.stopPropagation(); showDropdown(viewSpan, [
    { label: 'Update Speed: Fast (0.5s)',   action: () => { updateInterval = 500;  restartSmTimer(); } },
    { label: 'Update Speed: Normal (1.5s)', action: () => { updateInterval = 1500; restartSmTimer(); } },
    { label: 'Update Speed: Slow (3s)',     action: () => { updateInterval = 3000; restartSmTimer(); } },
    { label: 'Update Speed: Paused',        action: () => { updateInterval = 0;    restartSmTimer(); } },
    '-',
    { label: 'Resources Tab', action: () => switchTab('resources') },
    { label: 'Processes Tab', action: () => switchTab('processes') },
  ]); });
  mb.appendChild(viewSpan);
  const optSpan = document.createElement('span'); optSpan.className = 'menu-item'; optSpan.textContent = 'Options';
  optSpan.addEventListener('click', e => { e.stopPropagation(); showDropdown(optSpan, [
    { label: (showSysProcs ? '\u2713 ' : '  ') + 'Show System Processes', action: () => { showSysProcs = !showSysProcs; if (activeTab === 'processes') renderProcesses(); } },
    '-',
    { label: 'Close', action: () => closeWin('sysmon') },
  ]); });
  mb.appendChild(optSpan);

  body.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { label: 'Resources', action: () => switchTab('resources') },
      { label: 'Processes', action: () => switchTab('processes') },
      '-',
      { label: updateInterval === 0 ? '\u25b6 Resume' : '\u23f8 Pause', action: () => { updateInterval = updateInterval === 0 ? 1500 : 0; restartSmTimer(); } },
      '-',
      { label: 'Close', action: () => closeWin('sysmon') },
    ]);
  });

  function smTick() {
    if (!wins['sysmon']) { clearInterval(smTimer); return; }
    METRICS.forEach(m => {
      let v = state[m.key] + (Math.random() - 0.5) * 7;
      if (m.key === 'soul')    v = Math.min(92, Math.max(60, v - 0.05));
      if (m.key === 'void' && Math.random() < 0.06) v = 75 + Math.random() * 24;
      v = Math.max(1, Math.min(99, v));
      state[m.key] = v;
      const bar = document.getElementById('smbar-' + m.key);
      const val = document.getElementById('smval-' + m.key);
      const col = (m.key === 'void' && v > 70) ? '#cc0000' : (m.color || '#000080');
      if (bar) { bar.style.width = v.toFixed(0) + '%'; bar.style.background = col; }
      if (val) val.textContent = v.toFixed(0) + '%';
    });
    const sec = Math.floor(performance.now() / 1000);
    const up = document.getElementById('sm-uptime');
    if (up) up.textContent = `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    const ct = document.getElementById('sm-proc-count');
    if (ct) ct.textContent = Object.keys(wins).length + (showSysProcs ? getBuiltInProcesses().length : 0);
    if (activeTab === 'processes') renderProcesses();
  }

  function restartSmTimer() {
    if (smTimer) clearInterval(smTimer);
    smTimer = null;
    if (updateInterval > 0) smTimer = setInterval(smTick, updateInterval);
    if (wins['sysmon']) wins['sysmon']._interval = smTimer;
  }

  restartSmTimer();
}

function openDefrag() {
  if (!mkWin({ id:'defrag', title:'DEFRAG.exe - Disk Defragmenter', icon:'🧩', w:560, h:400, x:100, y:60 })) return;

  const mb   = document.getElementById('mb-defrag');
  const body = document.getElementById('wb-defrag');
  const ws   = document.getElementById('ws-defrag');
  body.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:5px;font-size:11px;overflow:hidden;';

  const COLS = 40, ROWS = 16, TOTAL = COLS * ROWS;
  // States: 0=free, 1=used(blue), 2=optimized(green), 3=active(red)
  const COLORS = { 0:'#ffffff', 1:'#0000aa', 2:'#00aa00', 3:'#cc2200' };
  const lastDefragTs = Math.max(0, Math.trunc(Number(defragState.lastDefragTs) || 0));
  const msSince = lastDefragTs ? Date.now() - lastDefragTs : null;
  const fragLevel = getDriveFragmentationLevel();

  // Build initial cell states: used blocks are green or blue based on frag level
  const cells = Array.from({ length: TOTAL }, () => {
    if (Math.random() > 0.68) return 0;                           // free
    return Math.random() < fragLevel ? 1 : 2;                     // fragmented or clean
  });
  const USED_TOTAL = cells.filter(c => c > 0).length;

  function timeAgo(ms) {
    if (!ms) return 'never';
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr${h !== 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
  }

  const initOptPct = getDriveOptimizationPercent();
  const initFragPct = Math.round(fragLevel * 100);

  // ── Drive info ─────────────────────────────────────────────────
  const infoRow = document.createElement('div');
  infoRow.style.cssText = 'display:flex;gap:16px;align-items:center;border:2px solid;border-color:#808080 #fff #fff #808080;padding:3px 8px;background:#fff;flex-shrink:0;';
  infoRow.innerHTML = `<span>Drive: <b>C:\\</b></span><span>Capacity: 2,147 MB</span><span>Free: 683 MB</span><span id="df-last" style="color:#555;">Last defrag: ${timeAgo(msSince)}</span><span id="df-frag" style="color:#555;">Fragmentation: ${initFragPct}%</span><span id="df-pct" style="margin-left:auto;font-weight:bold;">${initOptPct}% optimized</span>`;
  body.appendChild(infoRow);

  // ── Canvas grid ────────────────────────────────────────────────
  const gridWrap = document.createElement('div');
  gridWrap.style.cssText = 'border:2px solid;border-color:#808080 #fff #fff #808080;background:#111;flex:1;min-height:0;overflow:hidden;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;';
  gridWrap.appendChild(canvas);
  body.appendChild(gridWrap);

  function drawGrid() {
    const W = gridWrap.clientWidth, H = gridWrap.clientHeight;
    if (!W || !H) return;
    const bw = Math.floor(W / COLS), bh = Math.floor(H / ROWS);
    if (!bw || !bh) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < TOTAL; i++) {
      ctx.fillStyle = COLORS[cells[i]];
      ctx.fillRect((i % COLS) * bw + 1, Math.floor(i / COLS) * bh + 1, bw - 2, bh - 2);
    }
  }

  // ── Progress bar ───────────────────────────────────────────────
  const pbWrap = document.createElement('div');
  pbWrap.style.cssText = 'border:2px solid;border-color:#808080 #fff #fff #808080;height:18px;background:#c0c0c0;position:relative;overflow:hidden;flex-shrink:0;';
  const pbFill = document.createElement('div');
  pbFill.style.cssText = `position:absolute;left:0;top:0;height:100%;width:${initOptPct}%;background:#000080;`;
  const pbLabel = document.createElement('div');
  pbLabel.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;mix-blend-mode:difference;';
  pbLabel.textContent = initOptPct + '%';
  pbWrap.appendChild(pbFill); pbWrap.appendChild(pbLabel);
  body.appendChild(pbWrap);

  // ── File label ─────────────────────────────────────────────────
  const fileLabel = document.createElement('div');
  fileLabel.style.cssText = 'font-size:10px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;height:13px;';
  fileLabel.textContent = fragLevel < 0.05
    ? 'Disk is optimized. No defragmentation necessary.'
    : fragLevel < 0.3
      ? `Disk is ${initFragPct}% fragmented. Some defragmentation recommended.`
      : `Disk is ${initFragPct}% fragmented. Defragmentation recommended.`;
  body.appendChild(fileLabel);

  // ── Buttons ────────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;flex-shrink:0;';
  const startBtn = document.createElement('button');
  startBtn.className = 'dlg-btn primary'; startBtn.textContent = 'Start';
  const stopBtn = document.createElement('button');
  stopBtn.className = 'dlg-btn'; stopBtn.textContent = 'Stop'; stopBtn.disabled = true;
  btnRow.appendChild(startBtn); btnRow.appendChild(stopBtn);
  body.appendChild(btnRow);

  // ── Legend ─────────────────────────────────────────────────────
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:10px;font-size:10px;align-items:center;flex-shrink:0;';
  [['#ffffff','Free'],['#0000aa','Used'],['#00aa00','Optimized'],['#cc2200','Reading']].forEach(([c,l]) => {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:flex;align-items:center;gap:3px;';
    const sq = document.createElement('span');
    sq.style.cssText = `width:12px;height:12px;background:${c};border:1px solid #808080;display:inline-block;flex-shrink:0;`;
    wrap.appendChild(sq); wrap.appendChild(document.createTextNode(l));
    legend.appendChild(wrap);
  });
  body.appendChild(legend);

  // ── Animation ──────────────────────────────────────────────────
  const FILES = [
    'C:\\WINDOWS\\SYSTEM\\kernel32.dll',    'C:\\DREAMS\\fragment_001.tmp',
    'C:\\USERS\\you\\desktop\\memory.old',  'C:\\VOID\\unresolved.dat',
    'C:\\DREAMS\\fragment_047.tmp',         'C:\\WINDOWS\\TEMP\\~DF3A2.tmp',
    'C:\\USERS\\you\\documents\\letter_unsent.txt', 'C:\\DREAMS\\fragment_112.tmp',
    'C:\\SYSTEM32\\observer.dll',           'C:\\DREAMS\\fragment_????.tmp',
    'C:\\USERS\\you\\pictures\\face.bmp',   'C:\\VOID\\pending.inf',
    'C:\\DREAMS\\core_loop.dat',            'C:\\SLEEP\\log_0000.bin',
    'C:\\USERS\\you\\desktop\\todo.txt',    'C:\\DREAMS\\fragment_[CORRUPTED]',
    'C:\\WINDOWS\\SYSTEM\\time.dll',        'C:\\VOID\\[FILE NAME UNREADABLE]',
  ];

  let running = false, timer = null, optimized = cells.filter(c => c === 2).length, fileIdx = 0;
  let leftPtr = 0, rightPtr = TOTAL - 1, activeCell = -1;

  function updateProgress() {
    const pct = Math.min(100, Math.round((optimized / USED_TOTAL) * 100));
    pbFill.style.width = pct + '%';
    pbLabel.textContent = pct + '%';
    document.getElementById('df-pct').textContent = pct + '% optimized';
    if (ws) ws.textContent = 'Defragmenting C:\\ - ' + pct + '%';
  }

  function step() {
    if (!wins['defrag']) { clearTimeout(timer); return; }

    // Resolve previous active cell → optimized
    if (activeCell >= 0) { cells[activeCell] = 2; optimized++; activeCell = -1; }

    // Advance pointers
    while (leftPtr < TOTAL && cells[leftPtr] !== 0) leftPtr++;
    while (rightPtr >= 0  && cells[rightPtr] !== 1) rightPtr--;

    if (leftPtr >= rightPtr) {
      // Finalize any remaining used-in-place blocks
      for (let i = 0; i < TOTAL; i++) if (cells[i] === 1) { cells[i] = 2; optimized++; }
      running = false; startBtn.disabled = false; stopBtn.disabled = true;
      pbFill.style.width = '98%'; pbLabel.textContent = '98%';
      document.getElementById('df-pct').textContent = '98% optimized';
      fileLabel.textContent = 'Defragmentation complete.  1 file could not be moved: C:\\VOID\\[FILE NAME UNREADABLE]';
      if (ws) ws.textContent = 'Complete - 1 file could not be moved';
      optimizeDriveFragmentation({ targetLevel: 0.02 });
      const lastEl = document.getElementById('df-last');
      if (lastEl) lastEl.textContent = 'Last defrag: just now';
      const fragEl = document.getElementById('df-frag');
      if (fragEl) fragEl.textContent = 'Fragmentation: 2%';
      drawGrid();
      return;
    }

    // Move rightPtr block to leftPtr (show as red at destination)
    cells[rightPtr] = 0;
    cells[leftPtr]  = 3;
    activeCell = leftPtr;
    leftPtr++; rightPtr--;

    if (fileIdx % 5 === 0) fileLabel.textContent = 'Moving: ' + FILES[fileIdx % FILES.length];
    fileIdx++;

    drawGrid();
    updateProgress();
    timer = setTimeout(step, 55);
  }

  startBtn.addEventListener('click', () => {
    if (running) return;
    running = true; startBtn.disabled = true; stopBtn.disabled = false;
    fileLabel.textContent = 'Analyzing C:\\ ...';
    if (ws) ws.textContent = 'Analyzing...';
    setTimeout(step, 700);
  });
  stopBtn.addEventListener('click', () => {
    running = false; clearTimeout(timer);
    if (activeCell >= 0) { cells[activeCell] = 1; activeCell = -1; }
    startBtn.disabled = false; stopBtn.disabled = true;
    fileLabel.textContent = 'Defragmentation stopped.';
    if (ws) ws.textContent = 'Stopped';
    drawGrid();
  });

  const dfResizeObserver = new ResizeObserver(() => drawGrid());
  dfResizeObserver.observe(gridWrap);
  const _origCloseDefrag = wins['defrag']?._onclose;
  if (wins['defrag']) wins['defrag']._onclose = () => { dfResizeObserver.disconnect(); if (_origCloseDefrag) _origCloseDefrag(); };

  body.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { label: running ? '⏹ Stop' : '▶ Start', action: () => running ? stopBtn.click() : startBtn.click() },
      '-',
      { label: 'Close', action: () => closeWin('defrag') },
    ]);
  });

  // ── Menus ──────────────────────────────────────────────────────
  function dfDropdown(anchor, items) {
    const old = document.getElementById('active-dropdown'); if (old) old.remove();
    const rect = anchor.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
    dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
    items.forEach(item => {
      if (item === '-') { const s = document.createElement('div'); s.className = 'menu-dd-sep'; dd.appendChild(s); }
      else {
        const el = document.createElement('div'); el.className = 'menu-dd-item'; el.textContent = item.label;
        el.addEventListener('mousedown', e => { e.stopPropagation(); dd.remove(); item.action(); });
        dd.appendChild(el);
      }
    });
    document.body.appendChild(dd);
    setTimeout(() => document.addEventListener('mousedown', () => { const d = document.getElementById('active-dropdown'); if (d) d.remove(); }, { once: true }), 0);
  }

  mb.innerHTML = '';
  [
    { label: 'Drive', items: [
      { label: 'C:\\ (2,147 MB)  ✓', action: () => { if (ws) ws.textContent = 'Drive C:\\ selected'; } },
      { label: 'D:\\ - [NOT FOUND]', action: () => osAlert('Drive D:\\ is not available.\n\nIt may have never existed.', 'Drive Not Found', '⚠️') },
      '-',
      { label: 'Exit', action: () => closeWin('defrag') },
    ]},
    { label: 'Help', items: [
      { label: 'Help Topics', action: () => osAlert('DEFRAG.exe - Help\n\nClick Start to defragment drive C:\\.\n\nRepeated file edits, uploads, and deletes increase fragmentation over time.\n\nLower fragmentation reduces late-stage application distortion.\n\nNote: some system files cannot be moved.', 'Help Topics', '❓') },
      '-',
      { label: 'About DEFRAG.exe', action: () => osAlert('DEFRAG.exe - Disk Defragmenter\nsleepOS v1.0\n\nConsolidates fragmented files\nand free space on your hard disk.\n\nA small amount of the drive always remains unmovable.', 'About DEFRAG.exe', '🧩') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); dfDropdown(span, items); });
    mb.appendChild(span);
  });

  setTimeout(drawGrid, 80);
}

function openDaemon() {
  if (!mkWin({ id:'daemon', title:'daemon.core - Properties', icon:'👁️', w:300, h:270, x:200, y:140, menubar:false, statusbar:false })) return;
  document.getElementById('wb-daemon').innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon" style="font-size:44px;line-height:1;">👁️</div>
      <div class="dlg-text" style="line-height:1.9;">
        <b>File:</b> daemon.core<br>
        <b>Size:</b> [REDACTED]<br>
        <b>Created:</b> before system boot<br>
        <b>Modified:</b> always<br>
        <b>Owner:</b> SYSTEM\\???<br>
        <b>Status:</b> <span style="color:#cc0000;font-weight:bold">ACTIVE</span>
      </div>
    </div>
    <div style="font-size:10px;color:#555;border-top:1px solid #d0d0d0;padding:6px 12px;">
      This file cannot be read, moved, deleted, or ignored.<br>It watches all active processes.
    </div>
    <div class="dlg-btns"><button class="dlg-btn primary" onclick="closeWin('daemon')">OK</button></div>`;
}

// ─────────────────────────────────────────────────────────────────
// BROWSER
// ─────────────────────────────────────────────────────────────────
function renderDaemonPanel() {
  const body = document.getElementById('wb-daemon');
  if (!body) return;
  applyDaemonWindowState();
  const title = document.getElementById('wtitle-daemon');
  if (title) title.textContent = daemonStory.endingReached ? 'daemon.core - Archive' : 'daemon.core - Containment';
  const telemetry = getContainmentTelemetry();
  const mirrorLockActive = telemetry.mirrorLockActive;
  const checklist = getContainmentChecklist();
  const status = daemonStory.endingReached
    ? 'Contained'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? 'Seal Interrupted'
      : daemonStageLabel(daemonStory.stage);
  const statusColor = daemonStory.endingReached
    ? '#006400'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? '#aa5500'
      : daemonStory.stage >= 5
        ? '#800080'
        : daemonStory.stage >= 4
          ? '#aa0000'
          : '#000080';
  const notes = [];
  if (daemonStory.endingReached) {
    notes.push('Containment complete. The archive is quiet.');
  } else if (daemonStory.stage >= 7 && !mirrorLockActive) {
    notes.push('The seal lattice was ready, then the mirror lock dropped again.');
    notes.push('Restore MIRROR_LOCK to 1 before you run ?????.exe or delete void.tmp.');
  } else if (daemonStory.stage >= 7) {
    notes.push('The seal lattice is ready. Run ?????.exe to write SYS\\quarantine.sig, then delete void.tmp.');
  } else if (daemonStory.stage >= 5) {
    notes.push('You removed the anchor. The mirror is no longer deflected away from the user.');
    notes.push('Inspect void.tmp and CACHE\\mirror.dat. Read DOCS\\MIRROR_PROTOCOL.txt for the procedure. Restore MIRROR_LOCK when done.');
  } else if (daemonStory.stage >= 4) {
    notes.push('PID 512 stayed dead. The quiet that followed was a failure state, not a victory.');
    notes.push('Lower MIRROR_LOCK in the registry, then delete SYS\\anchor.seed to open the channel. Inspect CACHE\\mirror.dat first.');
  } else if (daemonStory.stage >= 2) {
    notes.push('The watch layer answered your kill attempt. RESPAWN_LOCK must be cleared before PID 512 will stay down.');
  } else {
    notes.push('This file is the restraint, not the intrusion.');
    notes.push('Open the raw read, then check DOCS for the first containment note.');
  }
  const gauge = value => `<div style="height:6px;border:1px solid #8f8f8f;background:#dadada;"><div style="height:100%;width:${Math.max(0, Math.min(100, value))}%;background:#000080;"></div></div>`;
  body.innerHTML = `
    <div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:11px;line-height:1.5;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div style="font-size:42px;line-height:1;">👁️</div>
        <div style="flex:1;">
          <div><b>File:</b> daemon.core</div>
          <div><b>Status:</b> <span style="color:${statusColor};font-weight:bold">${status}</span></div>
          <div><b>Containment:</b> <span style="color:${telemetry.rating.color};font-weight:bold">${telemetry.rating.code} / ${telemetry.rating.label}</span></div>
          <div><b>Observed:</b> ${daemonStory.openedDaemon ? 'yes' : 'no'}</div>
          <div><b>Last Event:</b> ${escHtml(daemonStory.lastEventText || 'none')}</div>
          <div><b>Mirror Lock:</b> ${telemetry.mirrorLockActive ? '1' : '0'}</div>
          <div><b>Respawn Lock:</b> ${telemetry.respawnLockActive ? '1' : '0'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Void Pressure</b> ${telemetry.pressure}</div>
          ${gauge(telemetry.pressure)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Lattice Stability</b> ${telemetry.lattice}</div>
          ${gauge(telemetry.lattice)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Signal Depth</b> ${telemetry.signalDepth}</div>
          ${gauge(telemetry.signalDepth)}
        </div>
        <div style="border:1px solid #b0b0b0;background:#efefef;padding:6px;">
          <div><b>Aperture Bias</b></div>
          <div style="margin-top:4px;color:${telemetry.bias === 'user-facing' ? '#8a0036' : telemetry.bias === 'sealed' ? '#0a7a2a' : '#005f73'};font-weight:bold;text-transform:uppercase;">${telemetry.bias}</div>
        </div>
      </div>
      <div style="border:1px solid #b0b0b0;background:#fff;padding:8px;min-height:78px;">
        ${notes.map(line => `<div>${escHtml(line)}</div>`).join('')}
      </div>
      ${daemonStory.stage >= 4 ? `
        <div style="border:1px solid #b0b0b0;background:#f7f7f7;padding:8px;">
          <div style="font-weight:bold;margin-bottom:4px;">Containment Checklist</div>
          ${checklist.map(item => `<div style="display:flex;align-items:center;gap:6px;color:${item.done ? '#0a662f' : '#555'};"><span style="font-weight:bold;width:12px;">${item.done ? '■' : '□'}</span><span>${escHtml(item.label)}</span></div>`).join('')}
        </div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        <button class="dlg-btn" onclick="openNotepad('daemon.core')">Raw Read</button>
        ${daemonStory.stage >= 4 && !daemonStory.endingReached ? `<button class="dlg-btn" onclick="openVoid()">Open void.tmp</button>` : ''}
      </div>
      <div style="text-align:right;">
        <button class="dlg-btn primary" onclick="closeWin('daemon')">Close</button>
      </div>
    </div>`;
  resizeDaemonWindow();
}

function resizeDaemonWindow() {
  const daemonWin = wins.daemon?.el;
  const body = document.getElementById('wb-daemon');
  if (!daemonWin || !body) return;
  if (wins.daemon.maximized) return;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) return;
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  const stage = daemonStory.stage || 0;
  const targetWidth = stage >= 7 ? 470 : stage >= 3 ? 450 : 430;
  const contentHeight = Math.ceil(body.scrollHeight);
  const targetHeight = stage >= 7
    ? Math.max(500, contentHeight + 76)
    : stage >= 3
      ? Math.max(470, contentHeight + 72)
      : Math.max(430, contentHeight + 68);
  const maxWidth = Math.max(360, desktop.clientWidth - 24);
  const maxHeight = Math.max(320, desktop.clientHeight - 24);
  const nextWidth = Math.min(maxWidth, Math.max(daemonWin.offsetWidth, targetWidth));
  const nextHeight = Math.min(maxHeight, Math.max(daemonWin.offsetHeight, targetHeight));
  daemonWin.style.width = nextWidth + 'px';
  daemonWin.style.height = nextHeight + 'px';
  const maxLeft = Math.max(0, desktop.clientWidth - nextWidth);
  const maxTop = Math.max(0, desktop.clientHeight - nextHeight);
  const currentLeft = parseFloat(daemonWin.style.left) || 0;
  const currentTop = parseFloat(daemonWin.style.top) || 0;
  daemonWin.style.left = Math.max(0, Math.min(maxLeft, currentLeft)) + 'px';
  daemonWin.style.top = Math.max(0, Math.min(maxTop, currentTop)) + 'px';
}

function openDaemon() {
  daemonActivate('panel');
  const stage = daemonStory.stage || 0;
  const initialWidth = stage >= 7 ? 470 : stage >= 3 ? 450 : 430;
  const initialHeight = stage >= 7 ? 500 : stage >= 3 ? 470 : 430;
  if (!mkWin({ id:'daemon', title:'daemon.core - Containment', icon:'👁️', w:initialWidth, h:initialHeight, x:200, y:110, menubar:false, statusbar:false }) && !document.getElementById('wb-daemon')) return;
  renderDaemonPanel();
}

function daemonVoidAction(mode) {
  const telemetry = getContainmentTelemetry();
  daemonVoidFeedMode = mode;
  if (mode === 'observe') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'This is not a damaged file. This is the aperture surface.'
      : daemonStory.stage >= 4
        ? 'The relay went quiet and this surface brightened. Silence is not safety.'
        : 'Nothing stable answers yet, but the file is already taking a shape.';
  } else if (mode === 'measure') {
    daemonVoidFeed = [
      `containment: ${telemetry.rating.code} / ${telemetry.rating.label}`,
      `void pressure: ${telemetry.pressure}`,
      `lattice stability: ${telemetry.lattice}`,
      `signal depth: ${telemetry.signalDepth}`,
      `aperture bias: ${telemetry.bias}`,
      'disk locality: negative',
    ].join('\n');
  } else if (mode === 'listen') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'The reflected side does not speak in words. It leans against the room tone.'
      : daemonStory.stage >= 4
        ? 'You hear the shape of a voice through the monitor gap.'
        : 'Static. Then the suggestion of a room tone.';
  } else if (mode === 'trace') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'trace path:\n  user-facing aperture <- mirror offset <- unresolved source\n  return latency remains non-local'
      : daemonStory.stage >= 4
        ? 'trace path:\n  monitor gap -> pressure rise -> reflected surface'
        : 'No stable trace path yet.';
  } else if (mode === 'sample') {
    daemonVoidFeed = daemonStory.stage >= 5
      ? 'sample:\n  carrier mismatch: confirmed\n  human voice match: negative\n  daemon-authored signature: false'
      : daemonStory.stage >= 4
        ? 'sample:\n  carrier unstable\n  monitor loss amplified the return path'
        : 'Sampling window too narrow.';
  } else if (mode === 'stabilize') {
    daemonVoidFeed = telemetry.mirrorLockActive
      ? daemonStory.quarantineSigned
        ? 'stabilize:\n  seal lattice catches for 0.8s\n  pressure drops in stepped increments'
        : 'stabilize:\n  mirror lock absorbs part of the return\n  pressure hesitates, then climbs again'
      : 'stabilize refused:\n  MIRROR_LOCK=0\n  aperture remains user-facing';
    triggerGlitch({ intensity: daemonStory.stage >= 7 ? 7 : daemonStory.stage >= 5 ? 5 : 4 });
  } else if (mode === 'pulse') {
    daemonVoidFeed = daemonStory.quarantineSigned
      ? 'The quarantine signature holds. The aperture recoils.'
      : daemonStory.stage >= 5
        ? 'A pulse returns before the machine feels ready for it, as if the file were farther away than the disk.'
        : 'The pulse dissipates without a readable return.';
    if (daemonStory.stage >= 5) triggerGlitch();
  }
  daemonRecordVoidAction(mode);
  const out = document.getElementById('void-readout');
  if (out) renderVoidReadout(out, daemonVoidFeed, telemetry);
}

function renderVoid() {
  const body = document.getElementById('wb-void');
  if (!body) return;
  applyDaemonWindowState();
  const title = document.getElementById('wtitle-void');
  if (title) title.textContent = daemonStory.endingReached ? 'void.tmp - Sealed' : 'void.tmp';
  body.style.cssText = 'background:#000;display:flex;flex-direction:column;overflow:hidden;padding:10px;gap:10px;';
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const pressure = telemetry.pressure;
  const summary = daemonStory.endingReached
    ? 'No active signal remains.'
    : daemonStory.stage >= 5
      ? `This file is the breach surface.\nUse the probes here to profile it.\n${getVoidObjectiveLine()}`
      : daemonStory.stage >= 4
        ? `Pressure rose after the daemon relay went quiet.\nUse Measure, Listen, or Trace to make the change legible.\n${getVoidObjectiveLine()}`
        : 'No stable observation channel yet.';
  const readout = daemonVoidFeed || summary;
  body.innerHTML = `
    <div style="border:1px solid #123512;background:#030703;color:#7fd37f;padding:8px;font-size:11px;line-height:1.5;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <div><b>CONTAINMENT:</b> ${telemetry.rating.code}</div>
        <div style="color:${telemetry.rating.color};font-weight:bold;">${telemetry.rating.label}</div>
      </div>
      <div>
        <div><b>BIAS:</b> ${telemetry.bias.toUpperCase()}</div>
        <div><b>QUARANTINE:</b> ${daemonStory.quarantineSigned ? 'present' : 'missing'}</div>
      </div>
      <div>
        <div><b>VOID PRESSURE:</b> ${pressure}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, pressure))}%;background:#6ab56a;"></div></div>
      </div>
      <div>
        <div><b>LATTICE:</b> ${telemetry.lattice}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, telemetry.lattice))}%;background:#7fd37f;"></div></div>
      </div>
      <div>
        <div><b>SIGNAL DEPTH:</b> ${telemetry.signalDepth}</div>
        <div style="height:6px;border:1px solid #245a24;background:#010301;margin-top:3px;"><div style="height:100%;width:${Math.max(0, Math.min(100, telemetry.signalDepth))}%;background:#9ee29e;"></div></div>
      </div>
      <div>
        <div><b>MIRROR LOCK:</b> ${telemetry.mirrorLockActive ? '1' : '0'}</div>
        <div><b>DELETE AUTH:</b> ${telemetry.deleteAuthorized ? 'yes' : 'no'}</div>
      </div>
      <div>
        <div><b>PROBES:</b> ${actions.length}/${VOID_ACTION_ORDER.length}</div>
        <div><b>PROFILE:</b> ${getVoidProfileLabel().toUpperCase()}</div>
      </div>
    </div>
    <div id="void-readout" style="flex:1;min-height:0;overflow:auto;border:1px solid #123512;background:#020402;color:#6ab56a;padding:10px;font-size:11px;line-height:1.7;white-space:pre-wrap;">${escHtml(readout)}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;">
      <button class="dlg-btn" onclick="daemonVoidAction('observe')">Observe</button>
      <button class="dlg-btn" onclick="daemonVoidAction('measure')">Measure</button>
      <button class="dlg-btn" onclick="daemonVoidAction('listen')">Listen</button>
      <button class="dlg-btn" onclick="daemonVoidAction('trace')">Trace</button>
      <button class="dlg-btn" onclick="daemonVoidAction('sample')">Sample</button>
      <button class="dlg-btn" onclick="daemonVoidAction('stabilize')">Stabilize</button>
      <button class="dlg-btn" onclick="daemonVoidAction('pulse')">Pulse</button>
      <button class="dlg-btn primary" onclick="closeWin('void')">Close</button>
    </div>`;
  renderVoidReadout(document.getElementById('void-readout'), readout, telemetry);
  resizeVoidWindow();
}

function resizeVoidWindow() {
  const voidWin = wins.void?.el;
  if (!voidWin || wins.void.maximized) return;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) return;
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  const targetWidth = daemonStory.stage >= 5 ? 560 : 540;
  const targetHeight = daemonStory.stage >= 5 ? 520 : 500;
  const maxWidth = Math.max(380, desktop.clientWidth - 24);
  const maxHeight = Math.max(360, desktop.clientHeight - 24);
  const nextWidth = Math.min(maxWidth, Math.max(voidWin.offsetWidth, targetWidth));
  const nextHeight = Math.min(maxHeight, Math.max(voidWin.offsetHeight, targetHeight));
  voidWin.style.width = nextWidth + 'px';
  voidWin.style.height = nextHeight + 'px';
  const maxLeft = Math.max(0, desktop.clientWidth - nextWidth);
  const maxTop = Math.max(0, desktop.clientHeight - nextHeight);
  const currentLeft = parseFloat(voidWin.style.left) || 0;
  const currentTop = parseFloat(voidWin.style.top) || 0;
  voidWin.style.left = Math.max(0, Math.min(maxLeft, currentLeft)) + 'px';
  voidWin.style.top = Math.max(0, Math.min(maxTop, currentTop)) + 'px';
}

function openVoid() {
  if (daemonStory.endingReached) {
    osAlert('void.tmp is no longer present.', 'void.tmp', '⬛');
    return;
  }
  daemonRecordInvestigation('void');
  const initialWidth = daemonStory.stage >= 5 ? 560 : 540;
  const initialHeight = daemonStory.stage >= 5 ? 520 : 500;
  if (!mkWin({ id:'void', title:'void.tmp', icon:'⬛', w:initialWidth, h:initialHeight, x:200, y:110, menubar:false, statusbar:false }) && !document.getElementById('wb-void')) return;
  renderVoid();
}

function openUnknown() {
  const wid = 'unk-warn-' + Date.now();
  if (!mkWin({ id:wid, title:getExeDisplayName(), icon:'❓', w:320, h:190, x:220, y:130, menubar:false, statusbar:false, popup:true })) return;
  const ready = daemonStory.stage >= 7 && !daemonStory.endingReached && Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const signed = daemonStory.quarantineSigned;
  const inertMsg = daemonStory.stage < 4
    ? 'The launcher does not respond.<br><br>There is nothing here for it to do yet.'
    : daemonStory.stage < 6
    ? 'The launcher is inert.<br><br>The investigation is incomplete. Find the channel.'
    : 'The launcher is waiting.<br><br>MIRROR_LOCK must be restored before it will sign anything.';
  document.getElementById('wb-' + wid).innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">❓</div>
      <div class="dlg-text">
        ${signed
          ? 'SYS\\quarantine.sig is already present.<br><br>The launcher is waiting for the final delete.'
          : ready
          ? 'The quarantine launcher is armed.<br><br>Running <b>?????.exe</b> will write <b>SYS\\quarantine.sig</b>.'
          : inertMsg}
      </div>
    </div>
    <div class="dlg-btns">
      <button class="dlg-btn primary" onclick="closeWin('${wid}');runUnknown()">${signed ? 'Check Status' : ready ? 'Generate Signature' : 'Run Anyway'}</button>
      <button class="dlg-btn" onclick="closeWin('${wid}')">Cancel</button>
    </div>`;
}

function runUnknown() {
  let message = '';
  if (daemonStory.endingReached) {
    message = 'The quarantine launcher has been archived.\nThere is nothing left to sign.';
  } else if (daemonStory.stage < 4) {
    message = '?????.exe does not execute.\n\nThere is nothing for it to do yet.';
  } else if (daemonStory.stage < 6) {
    message = '?????.exe does not execute.\n\nThe investigation is incomplete. Find and inspect the channel before you use this.';
  } else if (daemonStory.stage < 7 || Number(getContainmentValue('MIRROR_LOCK')) !== 1) {
    message = '?????.exe does not execute.\n\nRestore MIRROR_LOCK to 1 first. The launcher will not sign an open lattice.';
  } else if (!daemonStory.quarantineSigned) {
    updateDaemonStory(story => {
      story.quarantineSigned = true;
      story.lastEventText = 'quarantine signature written';
      daemonVoidFeed = 'A signature passes through the aperture and the pressure drops.';
      daemonVoidFeedMode = '';
    }, {
      glitch: true,
    });
    message = 'quarantine.sig written.\n\nDelete void.tmp to complete containment.';
  } else {
    message = 'SYS\\quarantine.sig is already present.\n\nThe launcher has nothing else to do.';
  }
  const rid = 'unk-result-' + Date.now();
  if (!mkWin({ id:rid, title:'?????.exe', icon:'❓', w:360, h:220, x:180, y:110, menubar:false, statusbar:false })) return;
  document.getElementById('wb-' + rid).innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon">❓</div>
      <div class="dlg-text" style="white-space:pre-line;">${escHtml(message)}</div>
    </div>
    <div class="dlg-btns"><button class="dlg-btn primary" onclick="closeWin('${rid}')">OK</button></div>`;
}

function openBrowser() {
  if (!mkWin({ id:'browser', title:'sleepWEB - Web Browser', icon:'🌐', w:640, h:460, x:80, y:50 })) return;

  const mb   = document.getElementById('mb-browser');
  const body = document.getElementById('wb-browser');
  const ws   = document.getElementById('ws-browser');
  body.style.cssText = 'display:flex;flex-direction:column;padding:0;overflow:hidden;';

  let hist = [], histIdx = -1;

  // ── home page ──────────────────────────────────────────────────
  function buildHome() {
    const projectLinks = PROJECTS.map(p =>
      `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${JSON.stringify(p.file).replace(/</g, '\\u003c')}},"*");return false;'>${p.emoji} ${escHtml(p.name)}</a>`
    ).join('');
    const favoriteLinks = browserFavorites
      .filter(fav => !DEFAULT_BROWSER_FAVORITE_URLS.has(fav.url.toLowerCase()))
      .map(fav => {
        const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
        const safeTitle = escHtml(fav.title || fav.url);
        return `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>&#9734; ${safeTitle}</a>`;
      }).join('');
    const webLinks = DEFAULT_BROWSER_FAVORITES.map(fav => {
      const safeUrl = JSON.stringify(fav.url).replace(/</g, '\u003c');
      const safeTitle = escHtml(fav.title);
      return `<a class="lnk" href="#" onclick='window.parent.postMessage({type:"browser-nav",url:${safeUrl}},"*");return false;'>${fav.homeIcon} ${safeTitle}</a>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font.woff') format('woff');font-style:normal;font-weight:400;font-display:swap;}
@font-face{font-family:'W95font';src:url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff2') format('woff2'),url('https://raw.githubusercontent.com/evelyn225/emergent-toys/main/w95font-bold.woff') format('woff');font-style:normal;font-weight:700;font-display:swap;}
:root{--sleep-font:'W95font',sans-serif;}
      body{margin:0;background:#c0c0c0;font-family: var(--sleep-font);font-size:12px;}
      h1{background:#000080;color:#fff;margin:0;padding:6px 12px;font-size:13px;}
      .sec{padding:6px 12px;}.sec h2{font-size:11px;margin:6px 0 4px;border-bottom:1px solid #808080;}
      .grid{display:flex;flex-wrap:wrap;gap:3px;}
      .lnk{background:#fff;border:2px solid;border-color:#fff #808080 #808080 #fff;
           padding:1px 7px;font-size:11px;text-decoration:none;color:#000;display:inline-block;}
      .lnk:hover{background:#000080;color:#fff;}
    </style></head><body>
    <h1>&#127760; sleepWEB &#8212; Start Page</h1>
    <div class="sec"><h2>sleepOS Projects</h2><div class="grid">${projectLinks}</div></div>
    <div class="sec"><h2>The Web (may not load in frame)</h2><div class="grid">${webLinks}${favoriteLinks}</div></div>
</body></html>`;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'browser-toolbar';
  toolbar.innerHTML = `
    <button class="br-btn" id="br-back" title="Back" disabled>◀</button>
    <button class="br-btn" id="br-fwd"  title="Forward" disabled>▶</button>
    <button class="br-btn" id="br-stop" title="Stop">✕</button>
    <button class="br-btn" id="br-ref"  title="Refresh">↻</button>
    <button class="br-btn" id="br-home" title="Home">🏠</button>
    <div class="br-vsep"></div>
    <span class="br-addr-label">Address:</span>
    <input class="br-addr" id="br-url" type="text" value="home:">
    <button class="br-btn" id="br-go">Go</button>
    <button class="br-btn" id="br-fav" title="Add to Favorites">⭐</button>`;
  body.appendChild(toolbar);

  // ── iframe + error overlay ─────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#fff;';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation';
  wrap.appendChild(iframe);

  const errDiv = document.createElement('div');
  errDiv.id = 'br-err';
  errDiv.style.cssText = 'display:none;position:absolute;inset:0;background:#c0c0c0;padding:30px;';
  const errBox = document.createElement('div');
  errBox.style.cssText = 'background:#fff;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:16px;max-width:380px;margin:auto;font-size:11px;';
  errDiv.appendChild(errBox);
  wrap.appendChild(errDiv);

  function showError(url) {
    errBox.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px;">🚫</div>
      <b>This page cannot be displayed</b><br><br>
      <span style="word-break:break-all;color:#444;">${url}</span><br><br>
      This site sent <code style="background:#eee;padding:1px 3px;">X-Frame-Options</code> or
      <code style="background:#eee;padding:1px 3px;">Content-Security-Policy</code> headers that
      block embedding.<br><br>
      To fix this on <b>your own sites</b>, add this header:<br>
      <code style="background:#eee;padding:2px 4px;display:block;margin:4px 0;">X-Frame-Options: ALLOWALL</code>
      <div style="margin-top:10px;display:flex;gap:6px;justify-content:center;">
        <button class="dlg-btn primary" id="br-err-tab">Open in New Tab</button>
        <button class="dlg-btn" id="br-err-ok">OK</button>
      </div>`;
    errDiv.style.display = 'block';
    document.getElementById('br-err-tab').onclick = () => window.open(url, '_blank');
    document.getElementById('br-err-ok').onclick  = () => { errDiv.style.display = 'none'; };
    if (ws) ws.textContent = 'Error: site blocked embedding';
  }
  body.appendChild(wrap);

  // ── navigate ───────────────────────────────────────────────────
  function updateNav() {
    document.getElementById('br-back').disabled = histIdx <= 0;
    document.getElementById('br-fwd').disabled  = histIdx >= hist.length - 1;
  }

  let lastAttemptedUrl = '';

  function navigate(url, push = true) {
    errDiv.style.display = 'none';
    if (!url || url === 'home:') {
      url = 'home:';
      document.getElementById('br-url').value = 'home:';
      iframe.removeAttribute('src');
      iframe.srcdoc = buildHome();
      if (ws) ws.textContent = 'sleepWEB Start Page';
    } else {
      if (!/^https?:\/\/|^data:|^about:/.test(url)) url = 'https://' + url;
      lastAttemptedUrl = url;
      document.getElementById('br-url').value = url;
      iframe.removeAttribute('srcdoc');
      iframe.src = url;
      if (ws) ws.textContent = 'Connecting to ' + (url.split('/')[2] || url);
    }
    if (push) { hist = hist.slice(0, histIdx + 1); hist.push(url); histIdx = hist.length - 1; }
    updateNav();
  }

  function syncUrl() {
    try {
      const loc = iframe.contentWindow.location.href;
      if (loc && loc !== 'about:blank' && loc !== 'about:srcdoc') {
        const bar = document.getElementById('br-url');
        if (bar && bar.value !== loc) {
          bar.value = loc;
          if (hist[histIdx] !== loc) {
            hist = hist.slice(0, histIdx + 1); hist.push(loc); histIdx = hist.length - 1;
            updateNav();
          }
        }
      }
    } catch(e) { /* cross-origin - cannot read URL */ }
  }

  // Poll to catch SPA pushState/hash navigation and link clicks
  const _urlPoll = setInterval(syncUrl, 600);

  iframe.addEventListener('load', () => {
    syncUrl();
    if (ws) ws.textContent = 'Done';
  });

  // Clear poll when browser window closes
  document.getElementById('win-browser')?.addEventListener('remove', () => clearInterval(_urlPoll), { once: true });
  // Use MutationObserver to detect window removal
  new MutationObserver((_, obs) => {
    if (!document.getElementById('win-browser')) { clearInterval(_urlPoll); obs.disconnect(); }
  }).observe(document.getElementById('desktop'), { childList: true });
  iframe.addEventListener('error', () => showError(lastAttemptedUrl));

  // ── handle nav messages from srcdoc home page ──────────────────
  function onBrowserMsg(e) {
    if (e.data && e.data.type === 'browser-nav') navigate(e.data.url);
  }
  window.addEventListener('message', onBrowserMsg);
  // clean up when window closes
  const winEl = document.getElementById('win-browser');
  if (winEl) new MutationObserver((_, obs) => {
    if (!document.getElementById('win-browser')) {
      window.removeEventListener('message', onBrowserMsg); obs.disconnect();
    }
  }).observe(document.getElementById('desktop'), { childList: true });

  // ── button wiring ──────────────────────────────────────────────
  document.getElementById('br-back').addEventListener('click', () => {
    if (histIdx > 0) { histIdx--; navigate(hist[histIdx], false); }
  });
  document.getElementById('br-fwd').addEventListener('click', () => {
    if (histIdx < hist.length - 1) { histIdx++; navigate(hist[histIdx], false); }
  });
  document.getElementById('br-stop').addEventListener('click', () => {
    iframe.src = 'about:blank'; if (ws) ws.textContent = 'Stopped.';
  });
  document.getElementById('br-ref').addEventListener('click', () => {
    const u = hist[histIdx]; if (u === 'home:') { iframe.srcdoc = buildHome(); } else { iframe.src = iframe.src; }
    if (ws) ws.textContent = 'Refreshing...';
  });
  document.getElementById('br-home').addEventListener('click', () => navigate('home:'));
  document.getElementById('br-go').addEventListener('click', () => navigate(document.getElementById('br-url').value.trim()));
  document.getElementById('br-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') navigate(document.getElementById('br-url').value.trim());
  });

  // ── favorites helpers ──────────────────────────────────────────
  function currentUrl() { return hist[histIdx] || 'home:'; }
  function refreshHome() {
    if (currentUrl() === 'home:') iframe.srcdoc = buildHome();
  }
  function addToFavorites() {
    const url = currentUrl();
    if (url === 'home:') return;
    if (browserFavorites.some(fav => fav.url.toLowerCase() === url.toLowerCase())) {
      if (ws) ws.textContent = 'Site is already in Favorites.';
      return;
    }
    osPrompt('Save to Favorites as:', document.getElementById('br-url').value, 'Add to Favorites', title => {
      if (!title) return;
      browserFavorites.push({ title, url });
      saveFavorites();
      refreshHome();
      if (ws) ws.textContent = 'Added to Favorites.';
    }, '*');
  }

  document.getElementById('br-fav').addEventListener('click', addToFavorites);

  // ── browser body right-click ───────────────────────────────────
  body.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, [
      { label: '◀ Back',    disabled: histIdx <= 0,               action: () => document.getElementById('br-back').click() },
      { label: '▶ Forward', disabled: histIdx >= hist.length - 1, action: () => document.getElementById('br-fwd').click() },
      { label: '↻ Refresh', action: () => document.getElementById('br-ref').click() },
      '-',
      { label: '⭐ Add to Favorites', disabled: currentUrl() === 'home:', action: addToFavorites },
      '-',
      { label: '🏠 Home',      action: () => navigate('home:') },
      { label: '🔗 Open in New Tab', disabled: currentUrl() === 'home:', action: () => window.open(currentUrl(), '_blank') },
    ]);
  });

  // ── menu bar ───────────────────────────────────────────────────
  function brDropdown(anchor, items) {
    const old = document.getElementById('active-dropdown'); if (old) old.remove();
    const rect = anchor.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
    dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
    items.forEach(item => {
      if (item === '-') {
        const s = document.createElement('div'); s.className = 'menu-dd-sep'; dd.appendChild(s);
      } else {
        const el = document.createElement('div'); el.className = 'menu-dd-item'; el.textContent = item.label;
        el.addEventListener('mousedown', e => { e.stopPropagation(); dd.remove(); item.action(); });
        dd.appendChild(el);
      }
    });
    document.body.appendChild(dd);
    setTimeout(() => document.addEventListener('mousedown', () => { const d = document.getElementById('active-dropdown'); if (d) d.remove(); }, { once: true }), 0);
  }

  mb.innerHTML = '';
  [
    { label: 'File', items: [
      { label: 'Open Location...', action: () => osPrompt('Enter URL:', 'https://', 'Open Location', u => { if (u) navigate(u); }, '🌐') },
      '-',
      { label: 'Close', action: () => closeWin('browser') },
    ]},
    { label: 'View', items: [
      { label: 'Home',    action: () => navigate('home:') },
      { label: 'Refresh', action: () => document.getElementById('br-ref').click() },
      { label: 'Stop',    action: () => document.getElementById('br-stop').click() },
      '-',
      { label: 'View Source', action: () => {
        try {
          const src = iframe.contentDocument.documentElement.outerHTML;
          const w = window.open(''); w.document.write('<pre style="white-space:pre-wrap;font-size:12px;">' + src.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>');
        } catch(e) { osAlert('Cannot view source of cross-origin pages.', 'View Source', '🚫'); }
      }},
    ]},
    { label: 'Help', items: [
      { label: 'About sleepWEB', action: () => osAlert('sleepWEB - Web Browser\nsleepOS v1.0\n\nNote: many modern sites block\nbeing loaded inside frames.', 'About sleepWEB', '🌐') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); brDropdown(span, items); });
    mb.appendChild(span);
  });

  // Favorites menu (dynamic - built on open)
  const favSpan = document.createElement('span');
  favSpan.className = 'menu-item'; favSpan.textContent = 'Favorites';
  favSpan.addEventListener('click', e => {
    e.stopPropagation();
    const items = [
      { label: '⭐ Add to Favorites', action: addToFavorites },
      { label: '🗑️ Clear All Favorites', action: () => {
        if (!browserFavorites.length) return;
        osConfirm('Clear all favorites?', 'Confirm', ok => {
          if (!ok) return;
          browserFavorites.length = 0; saveFavorites(); refreshHome(); if (ws) ws.textContent = 'Favorites cleared.';
        }, '🗑️');
      }},
    ];
    if (browserFavorites.length) {
      items.push('-');
      browserFavorites.forEach((fav, i) => items.push({
        label: fav.title,
        action: () => navigate(fav.url),
      }));
    }
    brDropdown(favSpan, items);
  });
  mb.appendChild(favSpan);

  navigate('home:');
}

// ─────────────────────────────────────────────────────────────────
// GLITCH EFFECT
// ─────────────────────────────────────────────────────────────────
function triggerGlitch(options) {
  const desktop = document.getElementById('desktop');
  const windowsLayer = document.getElementById('windows-layer');
  const taskbar = document.getElementById('taskbar');
  const glitch = document.getElementById('glitch');
  const intensity = Number(options?.intensity) || 0;
  const subtle = !!options?.subtle;
  pulseDaemonWindows(intensity, { subtle });
  const targets = [desktop, windowsLayer, taskbar].filter(Boolean);
  const glitchClass = subtle ? 'glitching-soft' : 'glitching';
  targets.forEach(el => el.classList.add(glitchClass));
  setTimeout(() => targets.forEach(el => {
    el.classList.remove('glitching');
    el.classList.remove('glitching-soft');
  }), subtle ? 420 : intensity >= 7 ? 900 : intensity >= 5 ? 760 : 650);

  if (glitch) {
    glitch.style.display = 'block';
    glitch.style.background = intensity >= 7
      ? 'linear-gradient(90deg, rgba(255,0,120,0.14), transparent 22%, rgba(80,255,255,0.18) 58%, transparent 78%), repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 6px)'
      : intensity >= 5
        ? 'linear-gradient(90deg, rgba(255,0,80,0.09), transparent 28%, rgba(90,255,240,0.12) 64%, transparent 82%), repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 8px)'
        : 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent 50%, rgba(120,255,255,0.06)), repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 10px)';
    glitch.style.opacity = subtle
      ? intensity >= 7 ? '0.54' : intensity >= 5 ? '0.38' : '0.24'
      : intensity >= 7 ? '0.9' : intensity >= 5 ? '0.65' : '0.42';
    glitch.style.transform = subtle
      ? intensity >= 7 ? 'translateX(-2px)' : intensity >= 5 ? 'translateX(1px)' : 'translateX(0)'
      : intensity >= 7 ? 'translateX(-6px)' : intensity >= 5 ? 'translateX(4px)' : 'translateX(0)';
    setTimeout(() => {
      glitch.style.display = 'none';
      glitch.style.opacity = '';
      glitch.style.transform = '';
      glitch.style.background = '';
    }, subtle ? 110 : intensity >= 7 ? 180 : 130);
  }

  // Brief scanline intensify
  const crt = document.getElementById('crt');
  crt.style.opacity = subtle
    ? intensity >= 7 ? '1.55' : intensity >= 5 ? '1.35' : '1.22'
    : intensity >= 7 ? '2.45' : intensity >= 5 ? '2.2' : '2';
  setTimeout(() => { crt.style.opacity = '1'; }, subtle ? 150 : intensity >= 7 ? 260 : 180);
}

let endingRebootActive = false;
const ENDING_REBOOT_ANIM_MS = 2350;
const ENDING_REBOOT_TEXT_HOLD_MS = 2400;
function playContainmentEndingReboot() {
  if (endingRebootActive) return;
  endingRebootActive = true;
  closeStart();
  closeDropdown();
  closeCad();
  if (altTabActive) closeAltTab();

  const overlay = document.getElementById('ending-reboot');
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  }
  document.body.classList.add('final-rebooting');

  setTimeout(() => {
    const desktop = document.getElementById('desktop');
    const taskbar = document.getElementById('taskbar');
    const daemonFx = document.getElementById('daemon-fx');
    const bios = document.getElementById('bios');

    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (desktop) desktop.style.display = 'none';
    if (taskbar) taskbar.style.display = 'none';
    if (daemonFx) daemonFx.style.display = 'none';
    document.body.classList.remove('final-rebooting');

    if (bios) {
      bios.style.display = 'flex';
      bios.style.opacity = '1';
      bios.style.transition = 'none';
      bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);font-size:18px;color:#858585;white-space:pre;line-height:1.55;">
Containment complete.
Draining chroma channels...               [SEALED]
Archiving daemon.core...                 [OK]
Rebooting sleepOS shell...
      </div>`;
    }

    try { sessionStorage.setItem(FORCE_BOOT_SESSION_KEY, '1'); } catch (e) {}
    setTimeout(() => { window.location.replace('sleep-os.html'); }, ENDING_REBOOT_TEXT_HOLD_MS);
  }, ENDING_REBOOT_ANIM_MS);
}

// ─────────────────────────────────────────────────────────────────
// SHUTDOWN
// ─────────────────────────────────────────────────────────────────
function doShutdown() {
  const id = 'shutdown';
  const powerIconSvg = '<svg viewBox="0 -3 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5v5.2"></path><path d="M4.8 3.3a5 5 0 1 0 6.4 0"></path></svg>';
  const powerIcon = `<span class="power-icon">${powerIconSvg}</span>`;
  if (!mkWin({ id, title:'Shut Down sleepOS', icon:powerIcon, w:300, h:165,
               x:Math.floor(window.innerWidth/2)-150, y:Math.floor(window.innerHeight/2)-80,
               menubar:false, statusbar:false, popup:true })) return;
  document.getElementById('wb-shutdown').innerHTML = `
    <div class="dlg-body">
      <div class="dlg-icon power-icon">${powerIconSvg}</div>
      <div class="dlg-text">
        What do you want the computer to do?<br><br>
        <select id="shutdown-sel" style="width:180px;font-size:11px;margin-top:2px;">
          <option value="off">Shut down</option>
          <option value="restart">Restart</option>
          <option value="sleep">Sleep</option>
          <option value="back">Return to Eve Net</option>
        </select>
      </div>
    </div>
    <div class="dlg-btns">
      <button class="dlg-btn primary" onclick="confirmShutdown()">OK</button>
      <button class="dlg-btn" onclick="closeWin('shutdown')">Cancel</button>
    </div>`;
}

function confirmShutdown() {
  const sel = document.getElementById('shutdown-sel');
  const val = sel ? sel.value : 'back';
  closeWin('shutdown');
  if (val === 'sleep') {
    enterIdleSleep(MANUAL_SLEEP_WAKE_DELAY_MS);
    return;
  }

  const bios = document.getElementById('bios');
  bios.style.display = 'flex'; bios.style.opacity = '0'; bios.style.transition = 'opacity 0.6s';
  bios.innerHTML = `<div id="bios-text" style="font-family: var(--sleep-font);font-size:18px;color:#888;white-space:pre;line-height:1.5;">
sleepOS - ${val === 'restart' ? 'Restarting' : 'Shutting Down'}...

Stopping soul_daemon.exe...              [OK]
Stopping dream_fragment.exe...           [OK]
Stopping unknown (PID 0333)...           [TIMEOUT]
Stopping unknown (PID 0334)...           [TIMEOUT]
Stopping unknown (PID 0335)...           [TIMEOUT]
Flushing corpus cache...                 [OK]
Unloading kernel modules...              [OK]
Saving system state...                   [OK]
  </div>`;
  document.getElementById('desktop').style.display = 'none';
  document.getElementById('taskbar').style.display = 'none';
  setTimeout(() => { bios.style.opacity = '1'; }, 30);
  setTimeout(() => {
    if (val === 'back') window.location.href = '/';
    else if (val === 'restart') window.location.href = 'sleep-os.html';
    else window.close();
  }, 3200);
}

// ─────────────────────────────────────────────────────────────────
// REGISTRY EDITOR
// ─────────────────────────────────────────────────────────────────
function openRegedit() {
  if (!mkWin({ id:'regedit', title:'Registry Editor', icon:'🗝️', w:580, h:380, x:90, y:70 })) return;
  const body = document.getElementById('wb-regedit');
  const ws   = document.getElementById('ws-regedit');
  const mb   = document.getElementById('mb-regedit');
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
  const REGEDIT_LOCKED_VALUE_NAMES = new Set(['OBSERVER_COUNT', 'ANCHOR_FILE', 'TEMPORAL_DRIFT']);

  const layout = document.createElement('div');
  layout.className = 'reg-layout';
  body.appendChild(layout);

  // ── Tree panel ─────────────────────────────────────────────────
  const tree = document.createElement('div');
  tree.className = 'reg-tree';
  layout.appendChild(tree);

  // ── Values panel ───────────────────────────────────────────────
  const vals = document.createElement('div');
  vals.className = 'reg-vals';
  layout.appendChild(vals);

  let selectedPath = null; // { hive, key }

  function isLockedRegValue(hive, keyPath, valName) {
    return REGEDIT_LOCKED_VALUE_NAMES.has(String(valName || '').toUpperCase());
  }

  function showLockedRegValueNotice(valName) {
    osAlert('The registry value "' + valName + '" is protected and cannot be modified.', 'Registry Editor', '🗝️');
  }

  function buildTree() {
    tree.innerHTML = '';
    Object.keys(registryData).forEach(hive => {
      const hiveEl = document.createElement('div');
      hiveEl.style.cssText = 'margin-bottom:1px;';

      const hiveRow = document.createElement('div');
      hiveRow.className = 'reg-tree-item';
      hiveRow.innerHTML = '<span class="reg-tree-arrow">▶</span><span class="reg-tree-icon">📁</span>&nbsp;<span>' + hive + '</span>';
      let expanded = false;
      const childWrap = document.createElement('div');
      childWrap.style.paddingLeft = '12px';
      childWrap.style.display = 'none';

      hiveRow.addEventListener('click', () => {
        expanded = !expanded;
        childWrap.style.display = expanded ? '' : 'none';
        hiveRow.querySelector('.reg-tree-arrow').textContent = expanded ? '▼' : '▶';
      });

      Object.keys(registryData[hive]).forEach(keyPath => {
        const keyEl = document.createElement('div');
        keyEl.className = 'reg-tree-item';
        keyEl.innerHTML = '<span class="reg-tree-icon">🗂️</span>&nbsp;<span>' + keyPath + '</span>';
        keyEl.addEventListener('click', e => {
          e.stopPropagation();
          tree.querySelectorAll('.reg-tree-item.selected').forEach(el => el.classList.remove('selected'));
          keyEl.classList.add('selected');
          selectedPath = { hive, key: keyPath };
          renderVals(hive, keyPath);
          if (ws) ws.textContent = hive + '\\' + keyPath;
        });
        childWrap.appendChild(keyEl);
      });

      hiveEl.appendChild(hiveRow);
      hiveEl.appendChild(childWrap);
      tree.appendChild(hiveEl);
    });
  }

  function renderVals(hive, keyPath) {
    vals.innerHTML = '';
    const data = registryData[hive][keyPath];
    const tbl = document.createElement('table');
    tbl.className = 'reg-vals-table';
    tbl.innerHTML = '<thead><tr><th style="width:180px;">Name</th><th style="width:100px;">Type</th><th>Data</th></tr></thead>';
    const tbody = document.createElement('tbody');

    Object.keys(data).forEach(valName => {
      const entry = data[valName];
      const locked = isLockedRegValue(hive, keyPath, valName);
      const tr = document.createElement('tr');
      tr.className = 'reg-val-row';
      tr.innerHTML = '<td>📄 ' + valName + '</td><td>' + entry.type + '</td><td>' + escHtml(String(entry.value)) + '</td>';
      tr.addEventListener('dblclick', () => {
        if (locked) {
          showLockedRegValueNotice(valName);
          return;
        }
        editRegValue(hive, keyPath, valName);
      });
      tr.addEventListener('contextmenu', e => {
        e.preventDefault();
        tr.classList.add('selected');
        showCtxMenu(e.clientX, e.clientY, [
          { label: 'Modify', disabled: locked, action: () => editRegValue(hive, keyPath, valName) },
        ]);
        setTimeout(() => tr.classList.remove('selected'), 800);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    vals.appendChild(tbl);
  }

  function editRegValue(hive, keyPath, valName) {
    if (isLockedRegValue(hive, keyPath, valName)) {
      showLockedRegValueNotice(valName);
      return;
    }
    const entry = registryData[hive][keyPath][valName];
    const currentVal = String(entry.value);
    osPrompt('Edit value for: ' + valName, currentVal, 'Edit Registry Value', newVal => {
      if (newVal === null) return;
      if (entry.type === 'REG_DWORD') {
        entry.value = parseInt(newVal) || 0;
      } else {
        entry.value = newVal;
      }
      saveRegistry();
      applyRegistryEffects(hive, keyPath, valName, entry.value);
      renderVals(hive, keyPath);
    }, '🗝️');
  }

  function applyRegistryEffects(hive, keyPath, valName, newValue) {
    if (hive === 'HKEY_SLEEPBOX_MACHINE') {
      if (keyPath === 'SYSTEM\\CurrentConfig') {
        if (valName === 'CRT_SCANLINES') {
          osSettings.crtScanlines = !!newValue;
          const crt = document.getElementById('crt');
          if (crt) crt.style.display = newValue ? '' : 'none';
        } else if (valName === 'VIDEO_DITHER') {
          osSettings.videoDither = !!newValue;
          document.querySelectorAll('.vp-dither').forEach(d => d.style.display = newValue ? '' : 'none');
        } else if (valName === 'CLOCK_FORMAT') {
          osSettings.clock12h = (newValue === '12h');
          updateClock();
        }
        saveSettings();
      } else if (keyPath === 'SOUL\\Metrics') {
        if (valName === 'SOUL_INTEGRITY') {
          const bar = document.getElementById('bar-soul');
          const val = document.getElementById('val-soul');
          const v = Math.max(0, Math.min(99, parseInt(newValue) || 0));
          if (bar) bar.style.width = v + '%';
          if (val) val.textContent = v + '%';
        } else if (valName === 'DAEMON_COUNT') {
          const count = parseInt(newValue) || 0;
          if (count !== 7) triggerGlitch({ intensity: Math.abs(count - 7) > 3 ? 6 : 3 });
          updateDaemonStory(story => {
            story.lastEventText = count > 7 ? 'daemon count elevated - ' + count : count < 7 ? 'daemon count reduced - ' + count : 'daemon count nominal';
          }, { forceSync: true });
          if (typeof renderDaemonPanel === 'function' && document.getElementById('wb-daemon')) renderDaemonPanel();
        } else if (valName === 'TEMPORAL_DRIFT') {
          triggerGlitch({ intensity: 3 });
          updateDaemonStory(story => { story.lastEventText = 'temporal drift set: ' + String(newValue); }, { forceSync: true });
          if (typeof renderDaemonPanel === 'function' && document.getElementById('wb-daemon')) renderDaemonPanel();
        }
      } else if (keyPath === 'VOID') {
        if (valName === 'VOID_PRESSURE_BASE') {
          const base = Math.max(0, Math.min(99, parseInt(newValue) || 0));
          triggerGlitch({ intensity: base > 50 ? 7 : base > 25 ? 5 : 2 });
          if (typeof renderVoid === 'function' && document.getElementById('wb-void')) renderVoid();
        } else if (valName === 'OBSERVER_COUNT') {
          const val = String(newValue).trim();
          if (val !== '[classified]' && val !== '') {
            triggerGlitch({ intensity: 8 });
            updateDaemonStory(story => { story.lastEventText = 'observer count declassified: ' + val; }, { forceSync: true });
          }
        }
      } else if (keyPath === 'Containment') {
        if (valName === 'RESPAWN_LOCK') {
          updateDaemonStory(story => {
            if (story.openedDaemon && !story.daemonStopped) {
              story.lastEventText = Number(newValue) === 0 ? 'respawn lock cleared' : 'respawn lock raised';
            }
          }, { forceSync: true });
        } else if (valName === 'MIRROR_LOCK') {
          updateDaemonStory(story => {
            if (Number(newValue) === 0) {
              if (story.stage >= 4) story.lastEventText = story.anchorDeleted ? 'mirror lattice lowered' : 'mirror lock lowered';
            } else if (story.anchorDeleted && story.stage >= 6) {
              story.mirrorLockRestored = true;
              story.lastEventText = 'mirror lattice restored';
            } else if (story.anchorDeleted) {
              story.lastEventText = 'mirror lock raised';
            }
          }, { forceSync: true, glitch: Number(newValue) === 0 && daemonStory.stage >= 5 });
        }
      }
    } else if (hive === 'HKEY_CURRENT_USER') {
      if (keyPath === 'Desktop' && valName === 'Wallpaper') {
        applyWallpaper(String(newValue), { updateRegistry: false, deferMissing: false });
      } else if (keyPath === 'SOFTWARE\\sleepOS') {
        if (valName === 'SkipBoot') {
          osSettings.skipBoot = !!newValue;
          saveSettings();
        } else if (valName === 'IdleSleepMinutes') {
          const normalized = normalizeIdleSleepMinutes(newValue);
          registryData[hive][keyPath][valName].value = normalized;
          saveRegistry();
          scheduleIdleSleep();
        }
      }
    }
  }

  // ── Menu bar ────────────────────────────────────────────────────
  mb.innerHTML = '';
  [
    { label: 'Registry', items: [
      { label: 'Export...', action: () => {
        let txt = 'Windows Registry Editor Version 5.00\n\n';
        Object.keys(registryData).forEach(hive => {
          Object.keys(registryData[hive]).forEach(keyPath => {
            txt += '[' + hive + '\\' + keyPath + ']\n';
            const data = registryData[hive][keyPath];
            Object.keys(data).forEach(v => {
              const e = data[v];
              if (e.type === 'REG_DWORD') txt += '"' + v + '"=dword:' + (e.value >>> 0).toString(16).padStart(8,'0') + '\n';
              else txt += '"' + v + '"="' + String(e.value).replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"\n';
            });
            txt += '\n';
          });
        });
        const fname = 'registry_export.reg';
        fsWriteTextFile(fname, txt, '');
        osAlert('Registry exported to:\nC:\\sleepOS\\' + fname, 'Export', '🗝️');
      }},
      '-',
      { label: 'Close', action: () => closeWin('regedit') },
    ]},
    { label: 'Edit', items: [
      { label: 'Modify', disabled: !selectedPath, action: () => {
        if (!selectedPath) return;
        const keys = Object.keys(registryData[selectedPath.hive][selectedPath.key]);
        const editableKey = keys.find(valName => !isLockedRegValue(selectedPath.hive, selectedPath.key, valName));
        if (editableKey) editRegValue(selectedPath.hive, selectedPath.key, editableKey);
      }},
    ]},
    { label: 'Help', items: [
      { label: 'About Registry Editor', action: () => osAlert('Registry Editor\nsleepOS v0.9β\n\nModifying registry values affects\nlive system behavior.\n\nProceed with caution.', 'About', '🗝️') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items); });
    mb.appendChild(span);
  });

  buildTree();
  if (ws) ws.textContent = 'My Computer';
}

// ─────────────────────────────────────────────────────────────────
// CALCULATOR
// ─────────────────────────────────────────────────────────────────
function openCalculator() {
  if (!mkWin({ id:'calc', title:'Calculator', icon:'🔢', w:240, h:300, x:200, y:120, menubar:true, statusbar:false })) return;
  const body = document.getElementById('wb-calc');
  const mb   = document.getElementById('mb-calc');
  body.style.cssText = 'padding:0;overflow:hidden;';

  let calcMode = 'dec'; // dec | hex | bin
  let calcExpr = '';
  let calcDisplay = '0';
  let calcOp = null;
  let calcPrev = null;
  let calcNewNum = true;

  const wrap = document.createElement('div');
  wrap.className = 'calc-body';
  body.appendChild(wrap);

  const display = document.createElement('div');
  display.className = 'calc-display';
  display.textContent = '0';
  wrap.appendChild(display);

  const subDisplay = document.createElement('div');
  subDisplay.style.cssText = 'font-size:10px;color:#555;text-align:right;min-height:14px;';
  wrap.appendChild(subDisplay);

  const modeRow = document.createElement('div');
  modeRow.className = 'calc-mode-row';
  ['dec','hex','bin'].forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'calc-mode-btn' + (m === calcMode ? ' active' : '');
    btn.textContent = m.toUpperCase();
    btn.setAttribute('data-mode', m);
    btn.addEventListener('click', () => {
      calcMode = m;
      modeRow.querySelectorAll('.calc-mode-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === m));
      updateDisplay();
      renderGrid();
    });
    modeRow.appendChild(btn);
  });
  wrap.appendChild(modeRow);

  const grid = document.createElement('div');
  grid.className = 'calc-grid';
  wrap.appendChild(grid);

  function getDisplayValue() {
    const n = parseFloat(calcDisplay);
    if (isNaN(n)) return calcDisplay;
    if (calcMode === 'hex') return '0x' + Math.trunc(n).toString(16).toUpperCase();
    if (calcMode === 'bin') return '0b' + Math.trunc(n).toString(2);
    return calcDisplay;
  }

  function updateDisplay() {
    display.textContent = getDisplayValue();
    if (calcOp && calcPrev !== null) {
      subDisplay.textContent = calcPrev + ' ' + calcOp;
    } else {
      subDisplay.textContent = '';
    }
  }

  function pressDigit(d) {
    if (calcNewNum) { calcDisplay = String(d); calcNewNum = false; }
    else { if (calcDisplay === '0' && d !== '.') calcDisplay = String(d); else calcDisplay += String(d); }
    updateDisplay();
  }

  function pressOp(op) {
    const cur = parseFloat(calcDisplay);
    if (calcOp && !calcNewNum && calcPrev !== null) {
      calcPrev = doCalc(calcPrev, cur, calcOp);
      calcDisplay = String(calcPrev);
    } else {
      calcPrev = cur;
    }
    calcOp = op;
    calcNewNum = true;
    updateDisplay();
  }

  function doCalc(a, b, op) {
    switch(op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      case '%': return a % b;
    }
    return b;
  }

  function pressEquals() {
    const cur = parseFloat(calcDisplay);
    if (calcOp && calcPrev !== null) {
      const result = doCalc(calcPrev, cur, calcOp);
      calcDisplay = isNaN(result) ? 'Error' : String(result);
      calcOp = null; calcPrev = null; calcNewNum = true;
      updateDisplay();
    }
  }

  function pressClear() {
    calcDisplay = '0'; calcOp = null; calcPrev = null; calcNewNum = true;
    updateDisplay();
  }

  function pressCE() {
    calcDisplay = '0'; calcNewNum = true; updateDisplay();
  }

  function pressBS() {
    if (calcNewNum || calcDisplay.length <= 1 || calcDisplay === 'Error') {
      calcDisplay = '0'; calcNewNum = true;
    } else {
      calcDisplay = calcDisplay.slice(0, -1) || '0';
    }
    updateDisplay();
  }

  function pressPlusMinus() {
    const n = parseFloat(calcDisplay);
    if (!isNaN(n) && n !== 0) { calcDisplay = String(-n); updateDisplay(); }
  }

  function renderGrid() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    grid.style.gridTemplateRows = 'repeat(5, 1fr)';

    const buttons = [
      ['CE','C','BS','/'],
      ['7','8','9','*'],
      ['4','5','6','-'],
      ['1','2','3','+'],
      ['+/-','0','.','='],
    ];

    if (calcMode === 'hex') {
      // Replace digits row 1 with hex letters
      buttons.unshift(['A','B','C','D']);
      buttons[1] = ['E','F','CE','C'];
      grid.style.gridTemplateRows = 'repeat(6, 1fr)';
    }

    buttons.forEach(row => {
      row.forEach(label => {
        const btn = document.createElement('button');
        const isOp  = ['+','-','*','/','%'].includes(label);
        const isEq  = label === '=';
        const isCl  = label === 'C' || label === 'CE';
        btn.className = 'calc-btn' + (isOp ? ' op' : '') + (isEq ? ' equals' : '') + (isCl ? ' clear' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
          if (/^[0-9A-F]$/.test(label)) pressDigit(label);
          else if (label === '.') { if (!calcDisplay.includes('.')) pressDigit('.'); }
          else if (isOp) pressOp(label);
          else if (isEq) pressEquals();
          else if (label === 'C') pressClear();
          else if (label === 'CE') pressCE();
          else if (label === 'BS') pressBS();
          else if (label === '+/-') pressPlusMinus();
        });
        grid.appendChild(btn);
      });
    });
    updateDisplay();
  }

  // Keyboard support
  const calcKeyHandler = e => {
    if (!wins['calc']) { document.removeEventListener('keydown', calcKeyHandler); return; }
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA') && focused.closest('#win-calc') === null) return;
    const map = {
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      '+':'+','-':'-','*':'*','/':'/',
      'Enter':'=','=':'=',
      'Backspace':'BS','Delete':'C','Escape':'C','.':'.',
    };
    if (map[e.key]) {
      e.preventDefault();
      const lbl = map[e.key];
      if (/^[0-9]$/.test(lbl)) pressDigit(lbl);
      else if (['+','-','*','/'].includes(lbl)) pressOp(lbl);
      else if (lbl === '=') pressEquals();
      else if (lbl === 'C') pressClear();
      else if (lbl === 'BS') pressBS();
      else if (lbl === '.') { if (!calcDisplay.includes('.')) pressDigit('.'); }
    }
  };
  document.addEventListener('keydown', calcKeyHandler);

  // Menu bar
  mb.innerHTML = '';
  const editSpan = document.createElement('span');
  editSpan.className = 'menu-item'; editSpan.textContent = 'Edit';
  editSpan.addEventListener('click', e => {
    e.stopPropagation();
    showDropdown(editSpan, [
      { label: 'Copy', action: () => navigator.clipboard?.writeText(display.textContent) },
      { label: 'Paste', action: () => navigator.clipboard?.readText().then(t => {
        const n = parseFloat(t);
        if (!isNaN(n)) { calcDisplay = String(n); calcNewNum = false; updateDisplay(); }
      })},
    ]);
  });
  mb.appendChild(editSpan);
  const viewSpan = document.createElement('span');
  viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
  viewSpan.addEventListener('click', e => {
    e.stopPropagation();
    showDropdown(viewSpan, [
      { label: (calcMode==='dec'?'* ':'  ')+'Decimal',  action: () => { calcMode='dec'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='dec')); updateDisplay(); renderGrid(); }},
      { label: (calcMode==='hex'?'* ':'  ')+'Hexadecimal', action: () => { calcMode='hex'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='hex')); updateDisplay(); renderGrid(); }},
      { label: (calcMode==='bin'?'* ':'  ')+'Binary',   action: () => { calcMode='bin'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='bin')); updateDisplay(); renderGrid(); }},
    ]);
  });
  mb.appendChild(viewSpan);

  renderGrid();
}

// ─────────────────────────────────────────────────────────────────
// RUN DIALOG
// ─────────────────────────────────────────────────────────────────
function openRunDialog() {
  const id = 'run-dialog';
  const p = _osDlgPos(360, 160);
  if (!mkWin({ id, title:'Run', icon:'▶', w:360, h:160, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:10px;font-size:11px;';
  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div style="font-size:28px;line-height:1;">▶</div>
      <div style="flex:1;">
        <div style="margin-bottom:8px;line-height:1.5;">Type the name of a program to open it.</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="white-space:nowrap;">Open:</span>
          <input id="run-input" type="text" style="flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;padding:2px 4px;font-family:var(--sleep-font);font-size:11px;background:#fff;">
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:6px;">
      <button class="dlg-btn primary" id="run-ok">OK</button>
      <button class="dlg-btn" id="run-cancel">Cancel</button>
    </div>`;
  const inp = document.getElementById('run-input');
  const ok  = document.getElementById('run-ok');
  const can = document.getElementById('run-cancel');

  const RUN_MAP = {
    'notepad': openNotepad, 'notepad.exe': openNotepad,
    'terminal': openTerminal, 'terminal.exe': openTerminal,
    'calc': openCalculator, 'calc.exe': openCalculator,
    'calculator': openCalculator,
    'regedit': openRegedit, 'regedit.exe': openRegedit,
    'sysmon': openSysmon, 'sysmon.exe': openSysmon,
    'explorer': openExplorer, 'explorer.exe': openExplorer,
    'defrag': openDefrag, 'defrag.exe': openDefrag,
    'browser': openBrowser, 'browser.exe': openBrowser,
    'welcome': openWelcome, 'welcome.readme': openWelcome,
    'sysmon.exe': openSysmon,
    'void.tmp': openVoid, 'daemon.core': openDaemon,
    '?????.exe': openUnknown,
  };

  ok.addEventListener('click', () => {
    const v = inp.value.trim().toLowerCase();
    if (!v) return;
    closeWin(id);
    const fn = RUN_MAP[v];
    if (fn) { fn(); return; }
    const proj = PROJECTS.find(p =>
      p.file.toLowerCase() === v ||
      p.file.toLowerCase().replace('.html','') === v ||
      p.name.toLowerCase() === v
    );
    if (proj) { window.open(proj.file, '_blank'); return; }
    osAlert('Cannot find program:\n"' + inp.value + '"\n\nMake sure the name is correct and try again.', 'Run', '▶');
  });
  can.addEventListener('click', () => closeWin(id));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') ok.click();
    if (e.key === 'Escape') can.click();
  });
  setTimeout(() => inp.focus(), 40);
}

// ─────────────────────────────────────────────────────────────────
// SPACE+TAB / KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────
let altTabActive = false;
let altTabIdx = 0;
let altTabWinIds = [];
let spaceTabHeld = false;

function getAltTabWindowIds() {
  return Object.entries(wins)
    .filter(([, win]) => !win.minimized)
    .sort(([, a], [, b]) => (parseInt(b.el.style.zIndex, 10) || 0) - (parseInt(a.el.style.zIndex, 10) || 0))
    .map(([id]) => id);
}

function renderAltTab() {
  const box = document.getElementById('alttab-box');
  if (!box) return;
  if (!altTabWinIds.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '';
  const head = document.createElement('div');
  head.id = 'alttab-head';
  head.innerHTML = `
    <div id="alttab-title">Window Switcher</div>
    <div id="alttab-hint">Hold Space, tap Tab, release Space to select</div>`;
  box.appendChild(head);
  const strip = document.createElement('div');
  strip.id = 'alttab-strip';
  altTabWinIds.forEach((id, i) => {
    const w = wins[id];
    const item = document.createElement('div');
    item.className = 'alttab-item' + (i === altTabIdx ? ' focused' : '');
    item.innerHTML = '<div class="at-icon">' + (w.icon || '📄') + '</div><div class="at-label">' + (w.title || id) + '</div>';
    item.addEventListener('click', () => {
      altTabIdx = i;
      commitAltTab();
    });
    strip.appendChild(item);
  });
  box.appendChild(strip);
}

function openAltTab(direction) {
  const ids = getAltTabWindowIds();
  if (ids.length === 0) return;
  const step = direction === -1 ? -1 : 1;
  altTabWinIds = ids;
  if (!altTabActive) altTabIdx = ids.length === 1 ? 0 : (step > 0 ? 1 : ids.length - 1);
  else altTabIdx = (altTabIdx + step + ids.length) % ids.length;
  renderAltTab();
  document.getElementById('alttab-overlay').classList.add('active');
  altTabActive = true;
}

function commitAltTab() {
  document.getElementById('alttab-overlay').classList.remove('active');
  altTabActive = false;
  const id = altTabWinIds[altTabIdx];
  if (id && wins[id]) {
    if (wins[id].minimized) unminWin(id);
    else focusWin(id);
  }
  altTabWinIds = [];
}

function closeAltTab() {
  document.getElementById('alttab-overlay').classList.remove('active');
  altTabActive = false;
  altTabIdx = 0;
  altTabWinIds = [];
  renderAltTab();
}

function closeCad() {
  document.getElementById('cad-overlay').classList.remove('active');
}
function cadAction(type) {
  closeCad();
  if (type === 'lock') {
    const lock = document.createElement('div');
    lock.id = 'lock-screen';
    lock.style.cssText = 'position:fixed;inset:0;z-index:99995;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
    lock.innerHTML = `
      <div style="color:#888;font-size:28px;">🔒</div>
      <div style="color:#ccc;font-size:13px;font-family:var(--sleep-font);">sleepOS is locked</div>
      <div style="color:#666;font-size:11px;font-family:var(--sleep-font);">Press any key or click to unlock</div>`;
    document.body.appendChild(lock);
    const unlock = () => { lock.remove(); };
    lock.addEventListener('click', unlock);
    lock.addEventListener('keydown', unlock);
    setTimeout(() => lock.addEventListener('keydown', unlock), 100);
  } else if (type === 'taskmgr') {
    openSysmon();
  } else if (type === 'shutdown') {
    doShutdown();
  }
}

// ── Global keyboard shortcuts ─────────────────────────────────────
document.addEventListener('keydown', e => {
  // Don't fire in inputs/textareas (except specific shortcuts)
  const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
  const key = String(e.key || '').toLowerCase();
  const secureAttention = e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && key === 'q';

  if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (!inInput) {
      spaceTabHeld = true;
      e.preventDefault();
    }
    return;
  }
  if (!inInput && e.key === 'Tab' && spaceTabHeld && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    openAltTab(e.shiftKey ? -1 : 1);
    return;
  }
  if (inInput && !secureAttention) return;

  // Ctrl+Shift+Q - secure attention sequence
  if (secureAttention) {
    e.preventDefault();
    document.getElementById('cad-overlay').classList.add('active');
    return;
  }

  // Escape - close context menus / dismiss overlays
  if (e.key === 'Escape') {
    closeDropdown();
    closeStart();
    const cad = document.getElementById('cad-overlay');
    if (cad.classList.contains('active')) cad.classList.remove('active');
    if (altTabActive) closeAltTab();
    return;
  }

});
document.addEventListener('keyup', e => {
  if (e.code !== 'Space') return;
  const wasHeld = spaceTabHeld;
  spaceTabHeld = false;
  if (!wasHeld || !altTabActive) return;
  e.preventDefault();
  commitAltTab();
});
window.addEventListener('blur', () => {
  spaceTabHeld = false;
  if (altTabActive) closeAltTab();
});

// ─────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────
function startDesktop() {
  document.getElementById('desktop').style.display = 'block';
  document.getElementById('taskbar').style.display = 'flex';
  const savedWp = getInitialWallpaperPath();
  if (savedWp) applyWallpaper(savedWp, { deferMissing: !isSystemWallpaperPath(savedWp) });
  applySettings();
  applyDaemonVisualState();
  setupIcons();
  armIdleSleep();
}

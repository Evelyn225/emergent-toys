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
    if (!vfsDirExistsSync(cwd)) return [pattern];
    const allNames = vfsListSync(cwd).filter(e => e.type === 'file').map(e => e.name);
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
      getTerminalRootSystemEntries({ includeExplorer: true }).forEach(entry => {
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
    getRootSystemFiles({ includeExplorer: true }).forEach(name => {
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
      if (target) return await getPipeableText(target);
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
      const sourceLines = target ? await getPipeableText(target) : Array.isArray(stdinLines) ? stdinLines.slice() : null;
      if (!sourceLines) throw new Error('Usage: GREP <pattern> [file]');
      return sourceLines.filter(line => re.test(line));
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

  async function writePipelineOutput(targetPath, lines, append) {
    const normalizedTarget = unquoteShellValue(resolveShellText(targetPath));
    if (!normalizedTarget) throw new Error('Missing redirect target.');
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
            const saved = await writePipelineOutput(target, Array.isArray(stream) ? stream : [], false);
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
        const saved = await writePipelineOutput(parsed.redirectTarget, Array.isArray(stream) ? stream : [], parsed.redirectOp === '>>');
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
        setTimeout(() => openSystemFile(split.fileName), 300);
        return;
      }
      const st = vfsStatSync(raw, cwd);
      if (st && st.kind === 'blob') {
        print(`Opening ${raw}...`);
        setTimeout(() => openMediaFile(raw, cwd), 300);
      } else if (st && st.kind === 'text') {
        print(`Opening ${raw}...`);
        setTimeout(() => openNotepad(raw, cwd), 300);
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
      setTimeout(() => openNotepad(fname || undefined, cwd), 300);
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


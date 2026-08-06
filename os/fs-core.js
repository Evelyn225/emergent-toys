let zTop = 100;
const wins = {};
let _expClipboard = null; // { items:[{name,kind,sysfile,srcCwd}], cut:bool }
let _shellDragPayload = null; // { item, srcCwd, source:'explorer'|'desktop', sourceId?:string }
let _explorerWinSeq = 0;

function nextExplorerWinId() {
  do { _explorerWinSeq += 1; } while (wins['explorer-' + _explorerWinSeq]);
  return 'explorer-' + _explorerWinSeq;
}

// Shared PID helpers (used by SYSMON and TASKKILL)
function pidFromId(id) {
  let h = 2000;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fff;
  return 2000 + (h % 6000);
}
function winIdByPid(pid) {
  for (const id of Object.keys(wins)) {
    if (pidFromId(id) === pid) return id;
  }
  return null;
}

// Shared virtual filesystem (terminal + notepad + media + explorer)
// subdirs: Map<dirName, { files: Map, blobs: Map, dirs: Set }>
const termFS = {
  dirs:    new Set(['DOCS']),
  files:   new Map(),
  blobs:   new Map(),
  subdirs: new Map([['DOCS', {
    dirs: new Set(), blobs: new Map(), subdirs: new Map(),
    files: new Map([
      ['README.txt', [
        '== sleepOS v0.9β - README ==',
        '',
        'ROOT: C:\\sleepOS',
        '  DOCS\\      - documentation (this folder)',
        '  PROJECTS\\  - interactive apps (read-only)',
        '',
        'SYSTEM FILES (read-only):',
        '  WELCOME.README  NOTEPAD.exe  TERMINAL.exe',
        '  SYSMON.exe  BROWSER.exe  DEFRAG.exe',
        '  CALC.exe  REGEDIT.exe  EXPLORER.exe',
        '  void.tmp  daemon.core  ?????.exe',
        '',
        'USER FILES:',
        '  Create with TOUCH, NOTEPAD, or ECHO >.',
        '  Upload via right-click > Upload File.',
        '  New items go into your current folder.',
        '',
        'SHORTCUTS:',
        '  Space + Tab     switch windows',
        '  Ctrl + Alt + Q  session controls',
        '  Esc             close menus and overlays',
        '',
        'TERMINAL (quick ref):',
        '  DIR / LS          list files',
        '  CD <dir>          enter folder  |  CD ..  go up',
        '  CAT <file>        read file',
        '  TOUCH <file>      create file',
        '  MKDIR <dir>       create folder',
        '  DEL <file>        delete',
        '  GREP <pat> <file> search lines matching pattern',
        '  WC <file>         word/line/byte count',
        '  SET name=value    assign a shell variable',
        '  INPUT <var>       read a line into a shell variable',
        '  SLEEP <ms>        pause in milliseconds',
        '  LS *.txt          wildcard file listing',
        '  CAT f | GREP pat  pipe output between commands',
        '  DIR > out.txt     redirect output to a file',
        '  CAT f | NOTEPAD   pipe output into Notepad',
        '',
        'KEYBOARD SHORTCUTS:',
        '  Ctrl+Alt+Q      secure attention sequence',
        '  Space+Tab         switch windows',
        '  Escape            close menus / overlays',
        '',
        'Bonus: RUN DOCS\\REACTOR.script to play a terminal game.',
        '',
        'See COMMANDS.txt for full terminal reference.',
        'See SCRIPTING.txt for the .script language.',
      ].join('\n')],
      ['SCRIPTING.txt', [
        '== sleepOS Script Language (.script files) ==',
        '',
        'Scripts are plain text files with .script extension.',
        'Create one with: NOTEPAD myscript.script',
        'Run one with:    RUN myscript.script',
        '',
        '── COMMANDS ─────────────────────────────────',
        '',
        '  print <text>       print text to terminal',
        '  echo <text>        same as print',
        '  wait <ms>          pause N milliseconds',
        '  set <var> <value>  assign a variable',
        '  input <var> [text] read a line from the terminal',
        '  inc <var> [n]      increase a numeric variable',
        '  dec <var> [n]      decrease a numeric variable',
        '  add <var> <n>      add n to a numeric variable',
        '  sub <var> <n>      subtract n from a numeric variable',
        '  mul <var> <n>      multiply a numeric variable',
        '  div <var> <n>      divide a numeric variable',
        '  mod <var> <n>      modulo a numeric variable',
        '  clear              clear the terminal output',
        '  touch <file>       create an empty file',
        '  mkdir <dir>        create a directory',
        '  del <file>         delete a file',
        '  open <file>        open file in viewer',
        '  start <program>    launch a program',
        '  notepad [file]     open Notepad',
        '  run <script> [..]  run another script in the same context',
        '  call <label> [..]  call a subroutine label',
        '  return [code]      return from a subroutine',
        '  exit [code]        stop the script with a status code',
        '  grep <pattern> <file> print matching lines',
        '',
        '-- CONTROL FLOW --------------------------------------------',
        '',
        '  :label             declare a jump target',
        '  goto <label>       jump to a label',
        '  if a == b goto x   branch on a comparison',
        '  if not a == b goto x',
        '  if exists file goto x',
        '  if defined name goto x',
        '  if not exists file goto x',
        '  if not defined name goto x',
        '',
        '  Supported operators: ==  !=  >  >=  <  <=',
        '  == and != compare strings after $var expansion.',
        '  >, >=, <, <= require both sides to be numbers.',
        '',
        '── VARIABLES ────────────────────────────────',
        '',
        '  set name Visitor',
        '  print Hello, $name!',
        '  -> Hello, Visitor!',
        '  print Arg 1: $1  / argc=$argc',
        '  if $status != 0 goto failed',
        '',
        '  Child scripts launched with RUN share the same variables.',
        '  RUN and CALL provide positional args as $0, $1, $2, ...',
        '  $argc is the arg count. $status / $errorlevel is the last exit code.',
        '  INPUT only works when the script is launched from TERMINAL.',
        '',
        '── COLORS ───────────────────────────────────',
        '',
        '  print [red]    error text',
        '  print [green]  success text',
        '  print [yellow] warning text',
        '  print [cyan]   info text',
        '  print [blue]   note text',
        '',
        '── COMMENTS ─────────────────────────────────',
        '',
        '  # hash comment',
        '  // double-slash comment',
        '',
        '── EXAMPLE SCRIPT ───────────────────────────',
        '',
        '  # loop.script',
        '  input name "Operator name:"',
        '  set mode debug',
        '  set count 1',
        '  if not exists DOCS goto no_docs',
        '  if $mode == debug goto debug',
        '  print Normal mode for $name',
        '  goto start',
        '  :debug',
        '  print [cyan] Debug mode enabled for $name',
        '  call tick_loop $name',
        '  if $status != 0 goto failed',
        '  exit 0',
        '  :tick_loop',
        '  :start',
        '  print [yellow] Doubling counter...',
        '  :loop',
        '  print Tick $count',
        '  mul count 2',
        '  wait 250',
        '  if $count <= 4 goto loop',
        '  print [green] Done.',
        '  return 0',
        '  :no_docs',
        '  print [red] DOCS missing',
        '  exit 2',
        '  :failed',
        '  print [red] Subroutine failed',
        '  exit $status',
        '',
        '── PROGRAMS FOR start/open ──────────────────',
        '',
        '  notepad, terminal, sysmon, browser,',
        '  defrag, explorer, welcome,',
        '  calc, regedit',
      ].join('\n')],
      ['COMMANDS.txt', [
        '== Terminal Commands Reference ==',
        '',
        '── FILESYSTEM ───────────────────────────────',
        '  DIR, LS              list current directory',
        '  CD <path>            change directory',
        '  CD ..                go up one level',
        '  MKDIR <name>         create directory',
        '  TOUCH <name>         create empty file',
        '  DEL, RM <file>       delete file/directory',
        '  CAT, TYPE <file>     read file contents',
        '  COPY <src> <dst>     copy a file',
        '  TREE                 show directory tree',
        '  OPEN <file>          open in viewer/editor',
        '',
        '── SCRIPTING ────────────────────────────────',
        '  RUN <file.script> [args] execute a script file',
        '  .script files support labels, subroutines, args,',
        '  shared variables, existence tests, and exit codes',
        '  ECHO text > file     write text to file',
        '  ECHO text >> file    append to file',
        '',
        '── PROGRAMS ─────────────────────────────────',
        '  NOTEPAD [file]       text editor',
        '  START <name>         start any program',
        '  EXIT                 close terminal',
        '  CALC                 open calculator',
        '  REGEDIT              open registry editor',
        '  EXPLORER             open file explorer',
        '',
        '── SYSTEM ───────────────────────────────────',
        '  VER                  OS version',
        '  WHO, WHOAMI          current user',
        '  DATE                 system date',
        '  PS                   running processes',
        '  TASKKILL <pid>       terminate process',
        '  IPCONFIG             network config',
        '  SET [name[=value]]   show or assign shell variables',
        '  INPUT <var> [prompt] read a line into a shell variable',
        '  INC, DEC <var> [n]   adjust numeric shell variables',
        '  ADD, SUB, MUL, DIV, MOD  arithmetic on shell variables',
        '  PING [host]          ping a host',
        '  SLEEP <ms>           pause for milliseconds',
        '  ECHO <text>          print text',
        '  PRINT <text>         alias for ECHO',
        '  WAIT <ms>            alias for SLEEP',
        '  CLS                  clear screen',
        '  CLEAR                alias for CLS',
        '  HELP                 this help',
        '',
        '── SEARCH & PIPES ───────────────────────────',
        '  GREP <pattern> <file>  find matching lines',
        '  WC <file>              word/line/byte count',
        '  LS *.ext               wildcard glob listing',
        '  DEL *.tmp              wildcard delete',
        '  CAT f | GREP pattern   pipe output to command',
        '  cmd > file             write command output to a file',
        '  cmd >> file            append command output to a file',
        '  cmd | NOTEPAD          open piped output in Notepad',
        '  cmd | NOTEPAD file     save piped output and open it',
        '',
        '── KEYBOARD SHORTCUTS ───────────────────────',
        '  Ctrl+Alt+Q    secure attention sequence',
        '  Space+Tab       switch windows',
        '  Escape          close menus / overlays',
      ].join('\n')],
      ['REACTOR.script', [
        '# REACTOR.script',
        'clear',
        'print [cyan] REACTOR WATCH',
        'print You are alone in the control loop.',
        'print Survive 5 turns without melting down.',
        'print',
        'print 1) VENT  - lower heat, costs power',
        'print 2) BOOST - gain power, raises heat',
        'print 3) PATCH - repair integrity, costs power',
        'print',
        'input pilot "Operator name:"',
        'set heat 4',
        'set power 5',
        'set integrity 6',
        'set turn 1',
        'print [green] Good luck, $pilot.',
        'wait 300',
        ':loop',
        'call check_fail',
        'if $status != 0 goto game_over',
        'if $turn > 5 goto win',
        'call hud',
        'call event_brief',
        'call choose_action',
        'if $status != 0 goto loop',
        'call apply_event',
        'call check_fail',
        'if $status != 0 goto game_over',
        'inc turn 1',
        'wait 250',
        'goto loop',
        ':hud',
        'print',
        'print [blue] ------------------------------',
        'print [blue] TURN $turn / 5',
        'print Heat: $heat',
        'print Power: $power',
        'print Integrity: $integrity',
        'print [blue] ------------------------------',
        'return 0',
        ':event_brief',
        'if $turn == 1 goto brief_1',
        'if $turn == 2 goto brief_2',
        'if $turn == 3 goto brief_3',
        'if $turn == 4 goto brief_4',
        'goto brief_5',
        ':brief_1',
        'print [yellow] Alert: a solar flare is incoming.',
        'print [yellow] End of turn effect: heat +2',
        'return 0',
        ':brief_2',
        'print [yellow] Alert: coolant leak in the outer ring.',
        'print [yellow] End of turn effect: integrity -2',
        'return 0',
        ':brief_3',
        'print [yellow] Alert: ghost load in the battery banks.',
        'print [yellow] End of turn effect: power -2',
        'return 0',
        ':brief_4',
        'print [yellow] Alert: chamber tremor in progress.',
        'print [yellow] End of turn effect: heat +1, integrity -1',
        'return 0',
        ':brief_5',
        'print [yellow] Alert: cascade surge across all systems.',
        'print [yellow] End of turn effect: heat +2, power -1, integrity -1',
        'return 0',
        ':choose_action',
        'print 1) VENT',
        'print 2) BOOST',
        'print 3) PATCH',
        'input choice "Action:"',
        'if $choice == 1 goto act_vent',
        'if $choice == 2 goto act_boost',
        'if $choice == 3 goto act_patch',
        'print [red] Invalid action. Choose 1, 2, or 3.',
        'return 1',
        ':act_vent',
        'print [cyan] You vent plasma into the dark.',
        'dec heat 3',
        'dec power 1',
        'call clamp_heat',
        'return 0',
        ':act_boost',
        'print [cyan] You push fresh charge into the grid.',
        'add power 2',
        'add heat 2',
        'return 0',
        ':act_patch',
        'print [cyan] You patch fractures in the shell.',
        'add integrity 2',
        'dec power 2',
        'return 0',
        ':clamp_heat',
        'if $heat >= 0 goto clamp_done',
        'set heat 0',
        ':clamp_done',
        'return 0',
        ':apply_event',
        'if $turn == 1 goto event_1',
        'if $turn == 2 goto event_2',
        'if $turn == 3 goto event_3',
        'if $turn == 4 goto event_4',
        'goto event_5',
        ':event_1',
        'add heat 2',
        'print [yellow] The flare hits. Heat climbs.',
        'return 0',
        ':event_2',
        'sub integrity 2',
        'print [yellow] Coolant loss scars the outer casing.',
        'return 0',
        ':event_3',
        'sub power 2',
        'print [yellow] The ghost load drains your reserves.',
        'return 0',
        ':event_4',
        'add heat 1',
        'sub integrity 1',
        'print [yellow] The chamber shudders under strain.',
        'return 0',
        ':event_5',
        'add heat 2',
        'sub power 1',
        'sub integrity 1',
        'print [yellow] The final cascade tears through the stack.',
        'return 0',
        ':check_fail',
        'if $heat < 10 goto check_power',
        'print [red] MELTDOWN. Heat reached $heat.',
        'return 10',
        ':check_power',
        'if $power > 0 goto check_integrity',
        'print [red] BLACKOUT. Power collapsed.',
        'return 11',
        ':check_integrity',
        'if $integrity > 0 goto safe',
        'print [red] BREACH. Integrity failed.',
        'return 12',
        ':safe',
        'return 0',
        ':win',
        'print',
        'print [green] Reactor stable after 5 turns.',
        'print [green] Nice work, $pilot.',
        'exit 0',
        ':game_over',
        'print [red] The control loop goes silent.',
        'exit $status',
      ].join('\n')],
    ]),
  }]]),
};
termFS.dirs.add('DESKTOP');
if (!termFS.subdirs.has('DESKTOP')) {
  termFS.subdirs.set('DESKTOP', { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
}

// Helper: get a directory object by name ('' = root)
function fsGetDir(path) {
  if (!path) return termFS;
  const parts = String(path).toUpperCase().replace(/\//g,'\\').split('\\').filter(Boolean);
  let node = termFS;
  for (const part of parts) {
    if (!node.subdirs) node.subdirs = new Map();
    if (!node.subdirs.has(part)) {
      if (node.dirs.has(part)) node.subdirs.set(part, { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
      else return null;
    }
    node = node.subdirs.get(part);
  }
  return node;
}

function fsNormalizeDir(name) {
  return String(name || '')
    .trim()
    .replace(/^C:\\sleepOS\\?/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '')
    .toUpperCase();
}

function fsSplitPath(path, fallbackDir) {
  const cleaned = String(path || '')
    .trim()
    .replace(/^C:\\sleepOS\\?/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '');
  if (!cleaned) return { dirName: fsNormalizeDir(fallbackDir), fileName: '' };
  const parts = cleaned.split('\\').filter(Boolean);
  if (parts.length === 1) return { dirName: fsNormalizeDir(fallbackDir), fileName: parts[0] };
  return {
    dirName: fsNormalizeDir(parts.slice(0, -1).join('\\')),
    fileName: parts[parts.length - 1],
  };
}

function fsGetEntry(path, fallbackDir) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const dir = fsGetDir(dirName);
  if (!dir || !fileName) return null;
  if (dir.files.has(fileName)) return { dir, dirName, fileName, kind: 'text', value: dir.files.get(fileName) };
  if (dir.blobs.has(fileName)) return { dir, dirName, fileName, kind: 'blob', value: dir.blobs.get(fileName) };
  return null;
}

function calcTextFragmentationDelta(prevValue, nextValue, created) {
  if (prevValue === nextValue) return 0;
  const prevLen = String(prevValue ?? '').length;
  const nextLen = String(nextValue ?? '').length;
  const contentWeight = Math.max(nextLen, Math.abs(nextLen - prevLen));
  return Math.min(0.035, (created ? 0.014 : 0.009) + Math.min(0.018, contentWeight / 18000));
}

function calcBlobFragmentationDelta(size, created) {
  return Math.min(0.04, (created ? 0.016 : 0.01) + Math.min(0.02, Math.max(0, Number(size) || 0) / 180000));
}

function calcRemovalFragmentationDelta(kind, payload) {
  if (kind === 'dir') return 0.007;
  if (kind === 'blob') return Math.min(0.026, 0.009 + Math.min(0.014, Math.max(0, Number(payload) || 0) / 220000));
  return Math.min(0.022, 0.008 + Math.min(0.012, String(payload ?? '').length / 22000));
}

function fsWriteTextFile(path, value, fallbackDir, options) {
  options = options || {};
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const dir = fsGetDir(dirName);
  if (!dir || !fileName) return null;
  const nextValue = String(value ?? '');
  const hadFile = dir.files.has(fileName);
  const prevValue = hadFile ? dir.files.get(fileName) : null;
  if (hadFile && prevValue === nextValue) return { dir, dirName, fileName, created: false, unchanged: true };
  dir.files.set(fileName, nextValue);
  schedSave();
  if (options.trackFragmentation !== false) {
    increaseDriveFragmentation(calcTextFragmentationDelta(prevValue, nextValue, !hadFile));
  }
  return { dir, dirName, fileName, created: !hadFile };
}

function fsWriteBlobFile(path, value, fallbackDir, options) {
  options = options || {};
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const dir = fsGetDir(dirName);
  if (!dir || !fileName) return null;
  const existing = dir.blobs.get(fileName);
  if (existing?.url && existing.url !== value?.url) URL.revokeObjectURL(existing.url);
  dir.blobs.set(fileName, value);
  schedSave();
  if (options.trackFragmentation !== false) {
    increaseDriveFragmentation(calcBlobFragmentationDelta(value?.size, !existing));
  }
  return { dir, dirName, fileName, created: !existing };
}

function fsCreateDir(path, fallbackDir, options) {
  options = options || {};
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const parent = fsGetDir(dirName);
  const name = String(fileName || '').toUpperCase();
  if (!parent || !name) return null;
  if (parent.dirs.has(name)) return { dir: parent, dirName, fileName: name, created: false };
  parent.dirs.add(name);
  if (!parent.subdirs) parent.subdirs = new Map();
  if (!parent.subdirs.has(name)) parent.subdirs.set(name, { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  schedSave();
  if (options.trackFragmentation !== false) increaseDriveFragmentation(0.006);
  return { dir: parent, dirName, fileName: name, created: true };
}


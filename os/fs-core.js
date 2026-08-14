let zTop = 100;
const wins = {};
let _expClipboard = null; // { items:[{name,kind,sysfile,srcCwd}], cut:bool }
let _shellDragPayload = null; // { item, srcCwd, source:'explorer'|'desktop', sourceId?:string }
let _explorerWinSeq = 0;

// Pick a free name in dirName for `name`, appending _copy / _copy2 / _copy3...
// on a collision. Built on vfsExistsSync so it never pokes at a dir node's
// files/blobs/dirs directly.
function _uniqueNameIn(dirName, name) {
  if (!vfsExistsSync(name, dirName)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext  = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (vfsExistsSync(base + '_copy' + (i > 2 ? i : '') + ext, dirName)) i++;
  return base + '_copy' + (i > 2 ? i : '') + ext;
}

// Recursively copy one entry into a directory that has already been checked
// to exist. Used by the non-cut (copy) side of pasteClipboardInto, which has
// no single VFS primitive to lean on the way a move does.
// The caller must already have refused a paste whose destination lies inside
// the source directory; see pasteClipboardInto. Without that check this
// recursion never terminates, because vfsListSync(srcPath) rediscovers the
// copy it just made one level up.
//
// trackFragmentation is off on all three writes because the paste this
// replaces touched the DEFRAG meter zero times, and task 8 is a refactor under
// a behavior-identical constraint. Whether a copy should fragment the drive is
// a product decision, not this migration's to make.
async function _copyEntryInto(name, srcCwd, dstCwd, dstName, kind) {
  if (kind === 'dir') {
    // Recurse under the name vfsMkdir ACTUALLY created, not the one we asked
    // for. Directory names are uppercased in the tree, and _uniqueNameIn
    // returns mixed case ('PHOTOS_copy'), so building the path from dstName
    // sent every nested blob-store row to 'PHOTOS_copy\...' while the tree held
    // 'PHOTOS_COPY'. removeBlobEntry, moveBlobEntryStorage and
    // moveBlobStorageSubtree all key off vfsStatSync().dirName, which is
    // normalized, so those rows could never be found again: deleting the file
    // left them behind and the next boot restored the image the user had
    // permanently deleted.
    const made = await vfsMkdir(dstName, dstCwd, { trackFragmentation: false });
    const srcPath = srcCwd ? srcCwd + '\\' + name : name;
    const dstPath = dstCwd ? dstCwd + '\\' + made.fileName : made.fileName;
    for (const entry of vfsListSync(srcPath)) {
      await _copyEntryInto(entry.name, srcPath, dstPath, entry.name, entry.kind);
    }
  } else if (kind === 'blob') {
    const st = vfsStatSync(name, srcCwd);
    if (st && st.blob) {
      // A copied blob needs its own row in the blob store and its own object
      // URL. Sharing the source's URL means deleting either entry revokes the
      // other one's bytes, and with no store row under the new path the copy
      // is gone entirely on the next boot - blobs are never in the VFS
      // snapshot. Falls back to sharing the URL only when there is nothing
      // stored to copy (a seeded blob), which is what the old code always did.
      const record = { ...st.blob };
      const url = await copyBlobEntryStorage(srcCwd, name, dstCwd, dstName);
      if (url) record.url = url;
      await vfsWriteBlob(dstName, record, dstCwd, { trackFragmentation: false });
    }
  } else {
    const content = await vfsReadFile(name, srcCwd);
    await vfsWriteFile(dstName, content == null ? '' : content, dstCwd, { trackFragmentation: false });
  }
}

// Paste the shell clipboard into a directory. Lives here beside _expClipboard
// rather than inside openExplorer so the desktop and every Explorer window
// share one implementation. Returns true if anything changed; callers that
// render their own view (Explorer) should refresh on true. The desktop needs
// no explicit refresh because setupIcons listens for 'fs-changed', which the
// VFS now fires itself on every mutation.
//
// Each item is awaited in turn rather than pasted via Promise.all/forEach: a
// concurrent paste could resolve before every item lands, so a caller's
// render() would draw a half-pasted directory.
async function pasteClipboardInto(dstCwd) {
  if (!_expClipboard || dstCwd === 'PROJECTS' || dstCwd === 'RECYCLE') return false;
  if (!vfsDirExistsSync(dstCwd)) return false;
  let changed = false;
  let failMessage = null;
  const items = _expClipboard.items;
  const cut = _expClipboard.cut;
  for (const { name, srcCwd } of items) {
    if (!vfsDirExistsSync(srcCwd)) continue;
    // Trust the live stat over the clipboard's remembered kind: a blob's kind
    // is image/video/audio/binary there, not 'blob', and the entry may have
    // changed kind entirely since it was cut or copied.
    const st = vfsStatSync(name, srcCwd);
    if (!st) continue;
    const dstName = _uniqueNameIn(dstCwd, name);
    try {
      if (cut) {
        const movedName = await vfsMove(srcCwd, name, dstCwd, dstName);
        if (!movedName) continue;
        // vfsMove only touches the in-memory tree; the blob store is keyed by
        // path and is the caller's job to keep in sync, same as
        // moveFsItemByPath does today.
        if (st.kind === 'blob') {
          moveBlobEntryStorage(srcCwd, name, dstCwd, movedName);
        } else if (st.kind === 'dir') {
          moveBlobStorageSubtree(
            srcCwd ? srcCwd + '\\' + name : name,
            dstCwd ? dstCwd + '\\' + movedName : movedName
          );
        }
      } else {
        // A copy into the source's own subtree would recurse without bound:
        // _copyEntryInto re-lists the source on every level and would keep
        // rediscovering the directory it just created. Refuse it here rather
        // than inside the recursion so the user gets a message instead of a
        // silently skipped item. Same predicate vfsMove uses for a cut.
        if (st.kind === 'dir') {
          const srcFull = st.dirName ? st.dirName + '\\' + st.name : st.name;
          const dstNorm = vfsNormalizeDir(dstCwd);
          if (dstNorm === srcFull || dstNorm.startsWith(srcFull + '\\')) {
            failMessage = failMessage || 'Cannot paste a folder into itself.';
            continue;
          }
        }
        await _copyEntryInto(name, srcCwd, dstCwd, dstName, st.kind);
      }
      changed = true;
    } catch (err) {
      failMessage = failMessage || (err.code === 'ENOSPC' ? 'Not enough space to paste this item.' : err.message);
    }
  }
  if (cut) _expClipboard = null;
  if (failMessage) osAlert(failMessage, 'Paste Failed', 'icon:error');
  return changed;
}

function nextExplorerWinId() {
  do { _explorerWinSeq += 1; } while (wins['explorer-' + _explorerWinSeq]);
  return 'explorer-' + _explorerWinSeq;
}

// The seeded filesystem. vfsBootMount installs this as the initial tree when
// nothing is persisted, and re-applies the DOCS subtree on every boot.
// subdirs: Map<dirName, { files: Map, blobs: Map, dirs: Set }>
function vfsSeedTree() {
  const seed = {
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
        '  ENV               show the process environment',
        '  PATH [value]      show or set the program search path',
        '  WHERE <name>      locate a program on PATH',
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
        'Spawn one as a real process with:  SPAWN myscript.script',
        'A spawned script gets a real PID, shows up in PS, and can be KILLed.',
        '',
        '── COMMANDS ─────────────────────────────────',
        '',
        '  print <text>       print text to terminal',
        '  echo <text>        same as print',
        '  wait <ms>          pause N milliseconds',
        '  set <var> <value>  assign a variable',
        '  input <var> [text]  read a line from the terminal',
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
        '  dir [path]         list a directory (path is root-relative, not',
        '                     relative to the running script)',
        '  del <file>         delete a file',
        '  rm <file>          same as del',
        '  open <file>        open file in viewer',
        '  start <program>    launch a program',
        '  notepad [file]     open Notepad',
        '  run <script> [..]  run another script in the same context',
        '  call <label> [..]  call a subroutine label',
        '  return [code]      return from a subroutine',
        '  exit [code]        stop the script with a status code',
        '  grep <pattern> <file>  print matching lines',
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
        '-- THE ENVIRONMENT -----------------------------------------',
        '',
        '  A spawned script inherits the environment as ordinary',
        '  variables, so $USERNAME, $COMPUTERNAME and $PATH are',
        '  already set before its first line runs.',
        '',
        '    # whoami.script',
        '    print Running as $USERNAME on $COMPUTERNAME',
        '    print Search path: $PATH',
        '',
        '  SPAWN gives the script its OWN COPY. Changing a variable',
        '  inside a spawned script does not change the terminal\'s.',
        '  RUN is different: a script run with RUN shares the',
        '  caller\'s variables, as described above.',
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
        '  MOVE, MV <src> <dst>  always fails - files are already home',
        '  TREE                 show directory tree',
        '  OPEN <file>          open in viewer/editor',
        '',
        '── SCRIPTING ────────────────────────────────',
        '  RUN <file.script> [args]  execute a script file',
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
        '── PATH AND THE ENVIRONMENT ─────────────────',
        '  Programs are looked up in the current folder',
        '  first, then in each PATH entry in order.',
        '',
        '  PATH                 print the search path',
        '  PATH C:\\sleepOS      set it',
        '  WHERE calc           C:\\sleepOS\\CALC.exe',
        '',
        '  SET PATH=            removes PATH entirely, so SET and ENV',
        '  stop listing it - PATH <value> recreates it. A script that',
        '  reads $PATH after that gets an empty string, even though',
        '  SCRIPTING.txt says PATH is already set when a script starts.',
        '',
        '  Because the current folder is searched first,',
        '  the programs in C:\\sleepOS always run from',
        '  C:\\sleepOS even with PATH emptied. From any',
        '  other folder they need C:\\sleepOS on PATH.',
        '',
        '  The same rule governs PROJECTS. START <project>',
        '  needs C:\\sleepOS\\PROJECTS on PATH, or you need',
        '  to be standing in it. Empty your PATH and the',
        '  projects are still there: CD PROJECTS, then',
        '  START works again.',
        '',
        '  The environment belongs to the terminal, and',
        '  the terminal is a process. Close it and that',
        '  process ends, so a new terminal starts from the',
        '  system defaults and forgets your PATH edits.',
        '',
        '── SYSTEM ───────────────────────────────────',
        '  VER                  OS version',
        '  WHO, WHOAMI          current user',
        '  DATE                 system date',
        '  PS                   running processes',
        '  TASKKILL <pid>       terminate process',
        '  SPAWN <script> [args]  run a script as a real process',
        '  KILL <pid> [/F]        signal a process (/F to force)',
        '  IPCONFIG             network config',
        '  SET [name[=value]]   show or assign shell variables',
        '  ENV                  show the process environment',
        '  PATH [value]         show or set the executable search path',
        '  WHERE <name>         which directory a program resolves from',
        '  INPUT <var> [prompt]  read a line into a shell variable',
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
  seed.dirs.add('DESKTOP');
  if (!seed.subdirs.has('DESKTOP')) {
    seed.subdirs.set('DESKTOP', { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  }
  return seed;
}

// Several modules touch the filesystem while the bundle is still evaluating
// (registry defaults, recycle-bin setup, the seeded-DOCS snapshot taken at the
// top of os/fs-persist.js). Install the seed synchronously so those reads find
// a tree; vfsBootMount replaces it with persisted state before the desktop
// renders. The manifest order os/vfs.js -> os/fs-core.js -> os/fs-persist.js
// is what makes that work and must not change.
vfsSetTree(vfsSeedTree());

// Kept as thin wrappers rather than deleted: 47 call sites across nine files
// still use them, and until now they were byte-identical copies of the VFS
// versions, which is how the C:\sleepOS prefix bug came to exist in four
// places instead of two. Delegating kills the duplication permanently.
function fsNormalizeDir(name) { return vfsNormalizeDir(name); }
function fsSplitPath(path, fallbackDir) { return vfsSplitPath(path, fallbackDir); }

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



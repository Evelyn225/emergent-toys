const WELCOME_DEFAULT =
`== sleepOS v0.9\u03b2 \u2014 WELCOME ==

You are running sleepOS, an experimental interactive desktop.

Programs:
  PROJECTS.DIR  \u2014 interactive apps (double-click to browse)
  NOTEPAD.exe   \u2014 text editor with syntax highlighting
  TERMINAL.exe  \u2014 command line (type HELP for commands)
  BROWSER.exe   \u2014 web browser
  SYSMON.exe    \u2014 system monitor
  DEFRAG.exe    \u2014 disk defragmenter
  CALC.exe      \u2014 calculator
  REGEDIT.exe   \u2014 registry editor

Files:
  Right-click the desktop or any folder to create
  files and folders, or upload from your machine.
  Everything persists within your session.

Shortcuts:
  Space + Tab     switch windows
  Ctrl + Alt + Q  session controls
  Esc             close menus and overlays

Known issues:
  [!] void.tmp cannot be read, deleted, or ignored
  [!] Something is watching this session`;

function openWelcome() { openNotepad('WELCOME.README', '', { initialContent: WELCOME_DEFAULT }); }
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function detectLang(fname) {
  if (!fname) return 'txt';
  const ext = (fname.split('.').pop() || '').toLowerCase();
  return { js:'js', mjs:'js', ts:'js', jsx:'js', tsx:'js',
           html:'html', htm:'html',
           css:'css', scss:'css',
           json:'json',
           md:'md', markdown:'md',
           py:'py',
           script:'script' }[ext] || 'txt';
}

const LANG_LABELS = { js:'JavaScript', html:'HTML', css:'CSS', json:'JSON', md:'Markdown', py:'Python', script:'.script', txt:'Plain Text' };

// Each rule: { re (global regex), cls (CSS class) }
const LANG_RULES = {
  js: [
    { re: /\/\*[\s\S]*?\*\//g,          cls: 'tok-cmt' },
    { re: /\/\/[^\n]*/g,                 cls: 'tok-cmt' },
    { re: /`(?:[^`\\]|\\.)*`/g,          cls: 'tok-str' },
    { re: /"(?:[^"\\]|\\.)*"/g,          cls: 'tok-str' },
    { re: /'(?:[^'\\]|\\.)*'/g,          cls: 'tok-str' },
    { re: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|this|class|extends|import|export|default|try|catch|finally|throw|async|await|true|false|null|undefined|void|static|get|set|from)\b/g, cls: 'tok-kw' },
    { re: /\b([A-Za-z_$][\w$]*)\s*(?=\()/g, cls: 'tok-fn' },
    { re: /\b0x[\da-fA-F]+|\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, cls: 'tok-num' },
  ],
  html: [
    { re: /<!--[\s\S]*?-->/g,            cls: 'tok-cmt' },
    { re: new RegExp("\"(?:[^\"\\\\]|\\\\.)*\"", "g"), cls: 'tok-str' },
    { re: new RegExp("'(?:[^'\\\\]|\\\\.)*'", "g"), cls: 'tok-str' },
    { re: /\b[a-zA-Z-]+=(?=["'])/g,     cls: 'tok-att' },
    { re: /<\/?[A-Za-z][A-Za-z0-9]*|>/g, cls: 'tok-tag' },
  ],
  css: [
    { re: /\/\*[\s\S]*?\*\//g,           cls: 'tok-cmt' },
    { re: /"[^"]*"|'[^']*'/g,            cls: 'tok-str' },
    { re: /#[0-9a-fA-F]{3,8}\b/g,        cls: 'tok-num' },
    { re: /\b\d+(\.\d+)?(px|em|rem|%|vh|vw|vmin|vmax|pt|cm|mm|s|ms|deg|fr)?\b/g, cls: 'tok-num' },
    { re: /[.#:[\]A-Za-z*][^{;]*(?=\{)/g, cls: 'tok-fn' },
    { re: /[\w-]+(?=\s*:)/g,             cls: 'tok-kw' },
  ],
  json: [
    { re: /"(?:[^"\\]|\\.)*"\s*(?=:)/g,  cls: 'tok-att' },
    { re: /"(?:[^"\\]|\\.)*"/g,           cls: 'tok-str' },
    { re: /\b(true|false|null)\b/g,       cls: 'tok-kw' },
    { re: /-?\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, cls: 'tok-num' },
  ],
  md: [
    { re: /^#{1,6} .+/gm,               cls: 'tok-hdr' },
    { re: /`[^`]+`/g,                    cls: 'tok-cmt' },
    { re: /\*\*[^*\n]+\*\*|__[^_\n]+__/g, cls: 'tok-kw' },
    { re: /\*[^*\n]+\*|_[^_\n]+_/g,     cls: 'tok-str' },
    { re: /^\s*[-*+] /gm,               cls: 'tok-fn' },
    { re: /\[[^\]]+\]\([^)]+\)/g,        cls: 'tok-fn' },
  ],
  py: [
    { re: /"""[\s\S]*?"""|'''[\s\S]*?'''/g, cls: 'tok-str' },
    { re: /#[^\n]*/g,                    cls: 'tok-cmt' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, cls: 'tok-str' },
    { re: /\b(def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|try|except|finally|raise|with|lambda|pass|break|continue|yield|True|False|None|global|nonlocal|del|assert|async|await)\b/g, cls: 'tok-kw' },
    { re: /\b([A-Za-z_]\w*)\s*(?=\()/g, cls: 'tok-fn' },
    { re: /\b\d+(\.\d+)?\b/g,           cls: 'tok-num' },
  ],
  script: [
    { re: /#[^\n]*/g,                    cls: 'tok-cmt' },
    { re: /\/\/[^\n]*/g,                 cls: 'tok-cmt' },
    { re: /^\s*:[A-Za-z_][\w.-]*/gm,     cls: 'tok-fn' },
    { re: /\b(print|echo|set|input|wait|inc|dec|add|sub|mul|div|mod|clear|touch|mkdir|del|rm|open|notepad|start|run|goto|if|not|exists|defined|call|return|exit|grep)\b/gi, cls: 'tok-kw' },
    { re: /==|!=|>=|<=|>|</g,            cls: 'tok-att' },
    { re: /\[(red|green|yellow|cyan|blue|white)\]/gi, cls: 'tok-fn' },
    { re: /\$\w+/g,                      cls: 'tok-var' },
    { re: /\b\d+\b/g,                    cls: 'tok-num' },
  ],
  txt: [],
};

function highlight(text, lang) {
  const rules = LANG_RULES[lang] || [];
  if (!rules.length) return escHtml(text);

  // Collect all non-overlapping token intervals
  const intervals = [];
  for (let ri = 0; ri < rules.length; ri++) {
    const { re, cls } = rules[ri];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      intervals.push({ start: m.index, end: m.index + m[0].length, cls, ri });
    }
  }
  // Sort by start; ties broken by rule order (lower ri = higher priority)
  intervals.sort((a, b) => a.start !== b.start ? a.start - b.start : a.ri - b.ri);

  // Sweep: drop intervals that overlap an already-chosen one
  const chosen = [];
  let coveredTo = 0;
  for (const iv of intervals) {
    if (iv.start >= coveredTo) { chosen.push(iv); coveredTo = iv.end; }
  }

  let result = '';
  let cur = 0;
  for (const iv of chosen) {
    if (iv.start > cur) result += escHtml(text.slice(cur, iv.start));
    result += `<span class="${iv.cls}">${escHtml(text.slice(iv.start, iv.end))}</span>`;
    cur = iv.end;
  }
  if (cur < text.length) result += escHtml(text.slice(cur));
  return result;
}

// Notepad counter for unique window IDs
let _notepadCount = 0;

function openDecompilerView(filename) {
  const id = 'decompile-' + filename.replace(/\W/g,'_');
  if (!mkWin({ id, title: filename + ' \u2014 Decompiler View', icon: '\u2699\uFE0F', w:500, h:360 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  const content = getExeDecompilerContent(filename);

  // Read-only display with syntax highlighting (asm-like)
  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;overflow:auto;background:#fff;padding:8px;font-family:var(--sleep-font);font-size:11px;line-height:1.7;white-space:pre;';

  // Basic asm-style syntax coloring
  function highlightAsm(text) {
    return text.split('\n').map(line => {
      const esc = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (esc.trimStart().startsWith(';')) return '<span style="color:#6a9955;font-style:italic;">' + esc + '</span>';
      const opcodes = /\b(PUSH|CALL|MOV|CMP|JE|JZ|JNE|JNZ|JLE|JL|JG|JGE|JMP|TEST|SUB|ADD|AND|OR|XOR|LEA|RET|NOP|HLT)\b/g;
      const colored = esc.replace(opcodes, m => '<span style="color:#0000cc;font-weight:bold;">' + m + '</span>');
      return colored.replace(/\b(0x[0-9A-Fa-f]+)\b/g, '<span style="color:#098658;">$1</span>')
                    .replace(/\b(DD|DB|DQ|DW|RESB|RESW|RESD|dup)\b/g, '<span style="color:#dd4400;">$1</span>');
    }).join('\n');
  }

  wrap.innerHTML = highlightAsm(content);
  body.appendChild(wrap);

  if (ws) ws.textContent = filename + '  \u2014  Read-only  |  Decompiler View';

  if (mb) {
    const fileSpan = document.createElement('span');
    fileSpan.className = 'menu-item'; fileSpan.textContent = 'File';
    fileSpan.addEventListener('click', e => {
      e.stopPropagation();
      showDropdown(fileSpan, [
        { label: 'Close', action: () => closeWin(id) },
      ]);
    });
    mb.appendChild(fileSpan);
    const viewSpan = document.createElement('span');
    viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
    viewSpan.addEventListener('click', e => {
      e.stopPropagation();
      showDropdown(viewSpan, [
        { label: 'Copy All', action: () => navigator.clipboard?.writeText(content) },
      ]);
    });
    mb.appendChild(viewSpan);
  }
}

function openLoreNotepad(filename, content, title, icon) {
  const id = 'lore-' + (filename || '').replace(/\W/g,'_');
  if (!mkWin({ id, title: title + ' \u2014 Notepad', icon: icon || '📝', w:440, h:320, menubar:false, statusbar:false })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;';
  const pre = document.createElement('pre');
  pre.style.cssText = 'background:#fff;padding:8px;margin:0;height:100%;overflow:auto;font-family:var(--sleep-font);font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;';
  pre.textContent = content;
  body.appendChild(pre);
}

function runScriptInPopup(name, source, dirName) {
  const id = 'script-out-' + Date.now();
  if (!mkWin({ id, title: name + ' - Script Output', icon: '📜', w: 420, h: 280, menubar: false, statusbar: false, popup: true })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'background:#000;padding:6px;overflow:auto;font-family: var(--sleep-font);font-size:12px;color:#ccc;';
  const print = (text, color) => {
    const div = document.createElement('div');
    div.textContent = text || '\u00a0';
    if (color) div.style.color = color;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  };
  print('Running ' + name + '...', '#888');
  print('');
  execScript(source, print, { sourceName: name, dirName, clearFn: () => { body.innerHTML = ''; } })
    .then(code => { if (code !== 0) print('Exit code: ' + code, '#dddd00'); });
}

function quoteTerminalArg(text) {
  const value = String(text ?? '');
  if (!value) return '""';
  if (!/[\s"]/.test(value)) return value;
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function runScriptInTerminal(name, dirName, args) {
  const items = [quoteTerminalArg(name), ...(Array.isArray(args) ? args.map(quoteTerminalArg) : [])];
  openTerminal(dirName || '', 'RUN ' + items.join(' '));
}

function openSaveDialog(defaultName, callback) {
  const id = 'saveas-' + Date.now();
  if (!mkWin({ id, title: 'Save As', icon: '💾', w: 420, h: 310, menubar: false, statusbar: false, popup: true })) return;
  const body = document.getElementById('wb-' + id);
  body.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:6px;font-size:11px;overflow:hidden;';

  let saveCwd = '';

  // ── "Save in:" bar ────────────────────────────────────────────
  const locRow = document.createElement('div');
  locRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
  const locLabel = document.createElement('span');
  locLabel.textContent = 'Save in:'; locLabel.style.whiteSpace = 'nowrap';
  const locDisp = document.createElement('div');
  locDisp.style.cssText = 'flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;background:#fff;padding:1px 4px;font-family: var(--sleep-font);font-size:11px;';
  locRow.appendChild(locLabel); locRow.appendChild(locDisp);
  body.appendChild(locRow);

  // ── File list ────────────────────────────────────────────────
  const fileList = document.createElement('div');
  fileList.style.cssText = 'flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;background:#fff;overflow:auto;padding:4px;display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start;min-height:0;';
  body.appendChild(fileList);

  // ── File name row ────────────────────────────────────────────
  const nameRow = document.createElement('div');
  nameRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
  const nameLabel = document.createElement('span');
  nameLabel.textContent = 'File name:'; nameLabel.style.whiteSpace = 'nowrap';
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.value = defaultName;
  nameInput.style.cssText = 'flex:1;border:2px solid;border-color:#808080 #fff #fff #808080;padding:1px 4px;font-family: var(--sleep-font);font-size:11px;background:#fff;';
  nameRow.appendChild(nameLabel); nameRow.appendChild(nameInput);
  body.appendChild(nameRow);

  // ── Buttons ──────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;flex-shrink:0;';
  const saveBtn   = document.createElement('button'); saveBtn.className = 'dlg-btn primary'; saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'dlg-btn';        cancelBtn.textContent = 'Cancel';
  btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
  body.appendChild(btnRow);

  function makeFLItem(emoji, label) {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:68px;padding:3px;cursor:default;border:1px solid transparent;font-size:10px;text-align:center;word-break:break-word;';
    el.innerHTML = `<div style="font-size:22px;">${emoji}</div><span>${label}</span>`;
    el.addEventListener('mouseover', () => { el.style.background='#000080'; el.style.color='#fff'; });
    el.addEventListener('mouseout',  () => { el.style.background='';        el.style.color=''; });
    return el;
  }

  function renderSaveList() {
    fileList.innerHTML = '';
    locDisp.textContent = saveCwd ? `C:\\sleepOS\\${saveCwd}` : 'C:\\sleepOS';

    if (saveCwd) {
      const up = makeFLItem('📁', '..');
      up.addEventListener('dblclick', () => { saveCwd = ''; renderSaveList(); });
      fileList.appendChild(up);
    }

    // vfsListSync is synchronous metadata, so this render loop never awaits.
    // It reports dirs first, then text files, then blobs; the dialog offers
    // only text files to save over, exactly as the old dir.files walk did.
    const entries = vfsListSync(saveCwd);
    const listedDirs = entries.filter(e => e.kind === 'dir').map(e => e.name);
    const dirs = saveCwd ? listedDirs
                         : ['DOCS', ...listedDirs].filter((v, i, a) => a.indexOf(v) === i);
    dirs.forEach(d => {
      const el = makeFLItem('📁', d);
      el.addEventListener('dblclick', () => { saveCwd = d; renderSaveList(); });
      fileList.appendChild(el);
    });

    entries.filter(e => e.kind === 'text').forEach(({ name }) => {
      const ext = (name.split('.').pop() || '').toLowerCase();
      const emoji = { script:'📜', txt:'📄', md:'📋', js:'📜', py:'🐍' }[ext] || '📄';
      const el = makeFLItem(emoji, name);
      el.addEventListener('click', () => { nameInput.value = name; });
      el.addEventListener('dblclick', () => { nameInput.value = name; saveBtn.click(); });
      fileList.appendChild(el);
    });
  }

  saveBtn.addEventListener('click', () => {
    const fname = nameInput.value.trim();
    if (!fname) return;
    closeWin(id);
    callback(fname, saveCwd);
  });
  cancelBtn.addEventListener('click', () => closeWin(id));
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  renderSaveList();
  setTimeout(() => { nameInput.focus(); nameInput.select(); }, 50);
}

// Lore-ified pseudo-bytecode for .exe decompiler view
function getExeDecompilerContent(fname) {
  const name = (fname || '').toLowerCase();
  const base = fname.replace(/\.exe$/i,'').toUpperCase();
  const loreMap = {
    'terminal.exe': [
      '; TERMINAL.exe - Disassembly v1.0',
      'section .text',
      '  PUSH soul_daemon',
      '  CALL obsv.sys',
      '  MOV  eax, [STDIN_HANDLE]',
      '  CMP  eax, 0x00000000',
      '  JE   void_fallback',
      '  CALL parse_command',
      '  JMP  main_loop',
      'void_fallback:',
      '  MOV  [VOID_PRESSURE], 0xFF',
      '  RET',
      '; NOTE: 3 subroutines unresolved',
      '; CALL 0xDEAD???? - target unknown',
    ],
    'sysmon.exe': [
      '; SYSMON.exe - Disassembly',
      'section .data',
      '  soul_integrity  DD 0x57',
      '  daemon_count    DD 0x07',
      '  observer_ref    DD [CLASSIFIED]',
      'section .text',
      '  PUSH soul_integrity',
      '  CALL read_corpus_metrics',
      '  MOV  eax, [soul_integrity]',
      '  SUB  eax, 0x01',
      '  JLE  integrity_critical',
      '  CALL update_display',
      '  JMP  tick_loop',
      'integrity_critical:',
      '  CALL emit_warning',
      '  PUSH 0xDEAD',
      '  RET',
    ],
    'browser.exe': [
      '; BROWSER.exe - Disassembly',
      'section .rodata',
      '  home_url  DB "sleep://home", 0',
      '  err_msg   DB "site blocked by void", 0',
      'section .text',
      '  MOV  esi, home_url',
      '  CALL resolve_sleep_addr',
      '  TEST eax, eax',
      '  JZ   frame_blocked',
      '  CALL render_page',
      '  JMP  event_loop',
      'frame_blocked:',
      '  PUSH err_msg',
      '  CALL show_error',
      '  ; observer may intercept traffic here',
      '  RET',
    ],
    'defrag.exe': [
      '; DEFRAG.exe - Disassembly',
      'section .bss',
      '  corpus_blocks RESB 640',
      '  void_fragment DB [CANNOT RESOLVE]',
      'section .text',
      '  MOV  ecx, 0x280',
      '  LEA  edi, [corpus_blocks]',
      '  CALL scan_fragments',
      '  MOV  eax, [void_fragment]',
      '  CMP  eax, 0x00',
      '  JNE  skip_void',
      '  ; void_fragment cannot be moved',
      '  ; it has always been here',
      'skip_void:',
      '  CALL compact_corpus',
      '  JMP  defrag_loop',
    ],
    'notepad.exe': [
      '; NOTEPAD.exe - Disassembly',
      'section .data',
      '  welcome_readme DB "WELCOME.README", 0',
      '  null_text      DD 0x00',
      'section .text',
      '  MOV  esi, welcome_readme',
      '  CALL fs_open_read',
      '  TEST eax, eax',
      '  JZ   open_blank',
      '  CALL load_text_buffer',
      '  JMP  editor_loop',
      'open_blank:',
      '  MOV  [text_buffer], null_text',
      '  CALL init_editor',
      '  RET',
    ],
    'explorer.exe': [
      '; EXPLORER.exe - Disassembly',
      'section .data',
      '  root_path DB "C:\\sleepOS\\", 0',
      '  sys_files DD 9',
      'section .text',
      '  PUSH root_path',
      '  CALL enumerate_fs',
      '  MOV  ecx, sys_files',
      '  CALL add_system_entries',
      '  ; 1 entry cannot be enumerated',
      '  ; see: ?????.exe',
      '  CALL render_icon_grid',
      '  JMP  window_loop',
    ],
    'calc.exe': [
      '; CALC.exe - Disassembly',
      'section .data',
      '  display_buf DB 32 dup(0)',
      '  soul_pi     DQ 3.14159265358979',
      'section .text',
      '  MOV  eax, 0x00',
      '  MOV  [accumulator], eax',
      '  CALL init_display',
      '  JMP  calc_loop',
      'calc_loop:',
      '  CALL wait_keypress',
      '  CALL eval_operation',
      '  PUSH [accumulator]',
      '  CALL update_display',
      '  JMP  calc_loop',
      '; NOTE: division by zero returns VOID',
    ],
    'regedit.exe': [
      '; REGEDIT.exe - Disassembly',
      'section .data',
      '  hive_root DB "HKEY_SLEEPBOX_MACHINE", 0',
      '  soul_key  DB "SOUL\\Metrics", 0',
      'section .text',
      '  PUSH hive_root',
      '  CALL open_registry_hive',
      '  MOV  esi, soul_key',
      '  CALL reg_open_key',
      '  CALL enumerate_values',
      '  ; WARNING: OBSERVER_COUNT is classified',
      '  ; ACCESS DENIED for key VOID\\',
      '  CALL render_tree',
      '  JMP  edit_loop',
    ],
  };
  const specific = loreMap[name];
  if (specific) return specific.join('\n');
  return [
    '; ' + base + ' - Disassembly',
    '; File type: WIN32 PE (sleepOS compatible)',
    '',
    'section .data',
    '  entry_point DD 0x' + Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0'),
    '  build_stamp DD 0x' + Math.floor(Math.random()*0xFFFFFFFF).toString(16).toUpperCase().padStart(8,'0'),
    '',
    'section .text',
    '  PUSH soul_daemon',
    '  CALL obsv.sys',
    '  MOV  eax, [entry_point]',
    '  CALL eax',
    '  CMP  eax, 0',
    '  JNZ  execution_error',
    '  RET',
    'execution_error:',
    '  PUSH 0xDEADC0DE',
    '  CALL void_handler',
    '  JMP  0x0000',
    '',
    '; [decompiler: 1 function unresolved]',
  ].join('\n');
}

// Lore content for daemon.core and void.tmp
const DAEMON_CORE_CONTENT =
`[DAEMON CORE - raw read attempt]

This file is being written.
It is always being written.

Fragment recovered at offset 0x0000:
  owner    : SYSTEM\\???
  type     : persistent observer
  priority : ABOVE_KERNEL
  started  : before system boot
  status   : ACTIVE

Fragment recovered at offset 0x00FF:
  watching : all active processes
  watching : all inactive processes
  watching : this file

Fragment recovered at offset 0x01FE:
  [UNREADABLE - data still being written]
  [UNREADABLE - data still being written]
  [UNREADABLE - data still being written]

Do not attempt to modify this file.
You cannot. It is already modified.
`;

function getVoidTmpContent() {
  return buildVoidTmpRawContent();
}

// The live Notepad window editing `pathKey`, or null. Reads `wins` directly so
// a closed window can never leave a stale entry behind, and matches
// case-insensitively because sleepOS paths are case-insensitive everywhere else.
function findNotepadWindowFor(pathKey) {
  const key = String(pathKey).toUpperCase();
  return Object.keys(wins).find(id =>
    wins[id].notepadPath && String(wins[id].notepadPath).toUpperCase() === key) || null;
}

function openNotepad(filename, dirName, options) {
  options = options || {};
  const splitInfo = fsSplitPath(filename, dirName);
  const fullPathUpper = ((splitInfo.dirName ? splitInfo.dirName + '\\' : '') + splitInfo.fileName).toUpperCase();
  // Special handling for .exe files - decompiler view (read-only)
  const normalizedName = (filename || '').toLowerCase();
  const isExe = normalizedName.endsWith('.exe');
  const isDaemonCore = normalizedName === 'daemon.core';
  const isVoidTmp = normalizedName === 'void.tmp';

  if (isExe && filename) {
    return openDecompilerView(filename);
  }
  if (isDaemonCore) {
    daemonActivate('raw');
    return openLoreNotepad(filename, buildDaemonCoreRawContent(), 'daemon.core - [RAW READ]', '👁️');
  }
  if (isVoidTmp) {
    daemonRecordInvestigation('void');
    return openLoreNotepad(filename, getVoidTmpContent(), 'void.tmp - [OBSERVATION]', '⬛');
  }

  // vfsStatSync is metadata only, so the story checks and the window can all be
  // decided synchronously. Note the `type === 'file'` test: fsGetEntry returned
  // null for a directory, while vfsStatSync returns a stat for one, so without
  // it a directory whose uppercased name collides with a story path would fire
  // the investigation beat.
  const st = filename ? vfsStatSync(filename, dirName) : null;
  const isFile = !!st && st.type === 'file';
  if (isFile && fullPathUpper === STORY_FILE_PATHS.mirrorProtocol.toUpperCase()) daemonRecordInvestigation('protocol');
  if (isFile && fullPathUpper === STORY_FILE_PATHS.mirrorDat.toUpperCase()) daemonRecordInvestigation('mirror');
  const { dirName: initialDir, fileName } = splitInfo;
  const pathKey = filename ? ((initialDir ? initialDir + '\\' : '') + fileName) : String(++_notepadCount);
  // Which file a window is editing lives on the window record, not in its id.
  // The id is baked from the path at open time and cannot follow a Save As, so
  // matching on it meant reopening the original file focused the window that
  // had moved on to the new one, and opening the new file - whose id was still
  // free - built a SECOND editor on it. Two windows on one file is a silent
  // data-loss path: whichever saves last discards the other's edits.
  const existingId = filename ? findNotepadWindowFor(pathKey) : null;
  if (existingId) { focusWin(existingId); unminWin(existingId); return; }
  // Suffix rather than bail out when the natural id is taken by a window that
  // has been saved to a different name; mkWin dedupes on id and would return
  // null, leaving the file unopenable.
  let id = 'notepad-' + pathKey.replace(/\W/g,'_');
  while (wins[id]) id += '_';
  const displayName = fileName || 'untitled.txt';
  const hasInitialContent = Object.prototype.hasOwnProperty.call(options, 'initialContent');
  // `initial` starts empty for a stored text file and is filled in below when
  // the async read resolves. openNotepad stays SYNCHRONOUS: it has 22 call
  // sites - dispatch tables, menu actions, an inline HTML onclick - that are
  // bare function references and cannot await. This mirrors what the binary
  // branch further down has always done.
  const initial = hasInitialContent ? String(options.initialContent ?? '') : '';
  if (!mkWin({ id, title: displayName + ' \u2014 Notepad', icon: '📝', w:500, h:360 })) return;
  // Untitled documents stay null so they never match a stored file.
  wins[id].notepadPath = filename ? pathKey : null;

  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

  // ── editor container (highlight div + textarea overlay) ──────
  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';

  const hl = document.createElement('div');
  hl.className = 'editor-highlight';

  const ta = document.createElement('textarea');
  ta.className = 'note-textarea';
  ta.value = initial;
  ta.spellcheck = false;

  wrap.appendChild(hl);
  wrap.appendChild(ta);
  body.appendChild(wrap);

  let currentFile = fileName || null;
  let currentDir = currentFile ? initialDir : fsNormalizeDir(dirName);
  let lang = detectLang(fileName || filename);

  function renderHighlight() {
    hl.innerHTML = highlight(ta.value, lang) + '\n'; // trailing \n keeps last-line height correct
    syncScroll();
  }
  function syncScroll() {
    hl.scrollTop  = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
  }

  renderHighlight();

  const lineCount = () => ta.value.split('\n').length;

  // Set when a binary file's bytes could not be read, so the status bar can say
  // why instead of leaving an unexplained empty document.
  let binaryReadError = '';

  const updateStatus = () => {
    if (!ws) return;
    const fname = currentFile || 'untitled.txt';
    if (binaryReadError) { ws.textContent = `${fname}  -  ${binaryReadError}`; return; }
    ws.textContent = `${fname}  -  Ln ${lineCount()}  |  ${ta.value.length} bytes  |  ${LANG_LABELS[lang] || lang}`;
  };

  // Text content is async now, so the window is already on screen and the
  // textarea fills a microtask later. Imperceptible while the tree is in
  // memory, and still correct when phase 4 moves content to IndexedDB.
  if (st && st.kind === 'text' && !hasInitialContent) {
    // Read from the stat's own resolved directory and name rather than
    // re-splitting the raw arguments, so the read cannot land anywhere other
    // than the entry the stat found.
    vfsReadFile(st.name, st.dirName).then(text => {
      if (!wins[id]) return;
      if (text == null) return;
      ta.value = text;
      renderHighlight();
      updateStatus();
    }).catch(err => { reportVfsError(err); });
  }

  // Opening a binary file in Notepad shows its bytes as ANSI mojibake, the way
  // Windows does, instead of a blank document. Reading a blob is async, so the
  // window opens first and fills in. Saving over it is refused by
  // vfsWriteFile, which throws EEXIST, so the file cannot be damaged from here.
  if (st && st.kind === 'blob' && !hasInitialContent) {
    readBlobAsAnsiText(st.blob).then(result => {
      if (!wins[id]) return;
      if (result.error) { binaryReadError = result.error; updateStatus(); return; }
      ta.value = result.text;
      renderHighlight();
      updateStatus();
    });
  }

  ta.addEventListener('input', () => { renderHighlight(); updateStatus(); });
  ta.addEventListener('scroll', syncScroll);
  ta.addEventListener('dragover', e => e.preventDefault());
  ta.addEventListener('drop', e => {
    e.preventDefault();
    // Collect names from internal shell drag or external OS files
    const shellPayload = getShellDragPayload();
    let names = [];
    if (shellPayload?.items?.length) {
      names = shellPayload.items.map(i => i.name);
      clearShellDragPayload();
    } else if (e.dataTransfer?.files?.length) {
      names = [...e.dataTransfer.files].map(f => f.name);
    }
    if (!names.length) return;
    const insert = names.join(' ');
    const start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + insert.length;
    renderHighlight();
    updateStatus();
  });
  updateStatus();

  // ── IDE keybindings ──────────────────────────────────────────
  ta.addEventListener('keydown', e => {
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
      renderHighlight(); updateStatus();
    }
    // Enter → auto-indent (match leading whitespace of current line)
    if (e.key === 'Enter') {
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const indent = ta.value.slice(lineStart).match(/^[ \t]*/)[0];
      if (indent.length) {
        e.preventDefault();
        ta.value = ta.value.slice(0, s) + '\n' + indent + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 1 + indent.length;
        renderHighlight(); updateStatus();
      }
    }
    // Ctrl+S / Cmd+S → save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      currentFile ? save(currentFile) : promptSaveAs();
    }
    // Ctrl+/ → toggle line comment
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      const cmt = { js:'//', html:'<!--', css:'/*', py:'#', script:'#', md:'', txt:'', json:'' }[lang] || '//';
      if (!cmt) return;
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const lineEnd = ta.value.indexOf('\n', s);
      const line = ta.value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      const trimmed = line.trimStart();
      const prefix = line.slice(0, line.length - trimmed.length);
      let newLine;
      if (trimmed.startsWith(cmt)) newLine = prefix + trimmed.slice(cmt.length);
      else newLine = prefix + cmt + trimmed;
      ta.value = ta.value.slice(0, lineStart) + newLine + (lineEnd === -1 ? '' : ta.value.slice(lineEnd));
      ta.selectionStart = ta.selectionEnd = s + (newLine.length - line.length);
      renderHighlight(); updateStatus();
    }
  });

  // One implementation for Save and Save As. Both used to be near-duplicates,
  // which is how a try/catch gets added to one and forgotten on the other.
  // Returns true when the text is in the filesystem, false when the user has
  // been told it is not - fsWriteTextFile returned null on failure and every
  // caller ignored it, so a full disk silently ate the document.
  //
  // The title and status bar are updated ONLY on success. Reporting a saved
  // document that was never written is precisely the failure this phase exists
  // to kill.
  async function writeAndSync(fname, dir) {
    let saved;
    try {
      saved = await vfsWriteFile(fname, ta.value, dir || currentDir);
    } catch (err) {
      if (err.code === 'ENOSPC') {
        osAlert('Not enough space to save this file.\nDelete something and try again.', 'Disk Full', 'X');
      } else if (err.code === 'EACCES') {
        osAlert('Storage is unavailable, so this file cannot be saved.', 'Cannot Save', 'X');
      } else if (err.code === 'EEXIST') {
        osAlert('A binary file already uses that name.', 'Cannot Save', 'X');
      } else {
        osAlert('Could not save: ' + err.message, 'Cannot Save', 'X');
      }
      return false;
    }
    currentFile = saved.fileName;
    currentDir = saved.dirName;
    // Save As moves this window onto a different file. Repoint its identity so
    // the original file can be opened again and the new one resolves here
    // instead of getting a second editor.
    if (wins[id]) wins[id].notepadPath = (currentDir ? currentDir + '\\' : '') + currentFile;
    // re-detect lang if filename changed
    const newLang = detectLang(currentFile);
    if (newLang !== lang) { lang = newLang; renderHighlight(); }
    // Not just the titlebar span: the taskbar button, Alt+Tab, SYSMON and the
    // terminal's task list all kept showing the pre-Save-As name.
    setWinTitle(id, currentFile + ' \u2014 Notepad');
    updateStatus();
    return true;
  }

  // Every caller is a key handler or a menu action, none of which can await.
  // writeAndSync reports its own failures; this catch only stops an unexpected
  // throw from becoming an unhandled rejection.
  function save(fname, dir) {
    writeAndSync(fname, dir).catch(err => { reportVfsError(err); });
  }

  function promptSaveAs() {
    openSaveDialog(currentFile || 'untitled.txt', (fname, dir) => save(fname, dir));
  }

  function setLang(l) { lang = l; renderHighlight(); updateStatus(); }

  function buildMenu() {
    mb.innerHTML = '';
    [
      { label: 'File', items: [
        { label: 'New',           action: () => openNotepad() },
        '-',
        { label: 'Save  Ctrl+S', action: () => currentFile ? save(currentFile) : promptSaveAs() },
        { label: 'Save As\u2026', action: promptSaveAs },
        '-',
        { label: 'Close',         action: () => closeWin(id) },
      ]},
      { label: 'Edit', items: [
        { label: 'Select All',    action: () => { ta.focus(); ta.select(); } },
        '-',
        { label: 'Toggle Comment  Ctrl+/', action: () => ta.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{key:'/',ctrlKey:true,bubbles:true}))) },
      ]},
      { label: 'Language', items: Object.entries(LANG_LABELS).map(([k,v]) => ({
          label: (lang === k ? '\u2713 ' : '\u00a0\u00a0') + v,
          action: () => setLang(k),
        }))
      },
    ].forEach(({ label, items }) => {
      const span = document.createElement('span');
      span.className = 'menu-item'; span.textContent = label;
      span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items); });
      mb.appendChild(span);
    });
  }
  buildMenu();
  // Rebuild language menu when lang changes so checkmark updates
  const origSetLang = setLang;
  setLang = (l) => { origSetLang(l); buildMenu(); };

  ta.addEventListener('contextmenu', e => {
    e.preventDefault();
    const hasSel = ta.selectionStart !== ta.selectionEnd;
    showCtxMenu(e.clientX, e.clientY, [
      { label: '✂️ Cut',              disabled: !hasSel, action: () => document.execCommand('cut') },
      { label: '📋 Copy',             disabled: !hasSel, action: () => document.execCommand('copy') },
      { label: '📄 Paste',            action: () => { ta.focus(); navigator.clipboard?.readText().then(t => document.execCommand('insertText', false, t)); } },
      '-',
      { label: 'Select All',          action: () => { ta.focus(); ta.select(); } },
      { label: 'Toggle Comment',      action: () => ta.dispatchEvent(Object.assign(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true }))) },
      '-',
      { label: 'Save  Ctrl+S',        action: () => currentFile ? save(currentFile) : promptSaveAs() },
      { label: 'Save As\u2026',       action: promptSaveAs },
    ]);
  });
}


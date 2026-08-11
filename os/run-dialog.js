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
    // 'X', not the Run dialog's own '▶': this is a failure, and every other
    // failure in the OS is titled and iconed as one.
    osAlert('Cannot find program:\n"' + inp.value + '"\n\nMake sure the name is correct and try again.', 'Cannot Find Program', 'X');
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

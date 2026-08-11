function openDefrag() {
  if (!mkWin({ id:'defrag', title:'DEFRAG.exe - Disk Defragmenter', icon:'icon:defrag', w:560, h:400, x:100, y:60 })) return;

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
      stopSoundLoop('defrag', { fade: 0.6 });
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
    // The drive noise starts with the analysis pass, not with the first block
    // move, so the 700ms of "Analyzing C:\..." is not silent.
    startSoundLoop('defrag', { crossfade: DEFRAG_CROSSFADE_SEC });
    fileLabel.textContent = 'Analyzing C:\\ ...';
    if (ws) ws.textContent = 'Analyzing...';
    setTimeout(step, 700);
  });
  stopBtn.addEventListener('click', () => {
    running = false; clearTimeout(timer);
    stopSoundLoop('defrag', { fade: 0.25 });
    if (activeCell >= 0) { cells[activeCell] = 1; activeCell = -1; }
    startBtn.disabled = false; stopBtn.disabled = true;
    fileLabel.textContent = 'Defragmentation stopped.';
    if (ws) ws.textContent = 'Stopped';
    drawGrid();
  });

  const dfResizeObserver = new ResizeObserver(() => drawGrid());
  dfResizeObserver.observe(gridWrap);
  const _origCloseDefrag = wins['defrag']?._onclose;
  if (wins['defrag']) wins['defrag']._onclose = () => {
    dfResizeObserver.disconnect();
    // Closing the window mid-run must take the drive noise with it; step()
    // stops itself on the same condition but has no way to say so.
    stopSoundLoop('defrag', { fade: 0.2 });
    if (_origCloseDefrag) _origCloseDefrag();
  };

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
      // The plain drive art lives here, now that DEFRAG's own icon is the drive
      // being cleaned. The tick stays in the label: the gutter is the icon's
      // now, so it can no longer double as the selected-drive marker.
      { label: 'C:\\ (2,147 MB)  ✓', icon: 'icon:disk', action: () => { if (ws) ws.textContent = 'Drive C:\\ selected'; } },
      { label: 'D:\\ - [NOT FOUND]', icon: 'icon:disk', action: () => osAlert('Drive D:\\ is not available.\n\nIt may have never existed.', 'Drive Not Found', 'icon:warning') },
      '-',
      { label: 'Exit', action: () => closeWin('defrag') },
    ]},
    { label: 'Help', items: [
      { label: 'Help Topics', action: () => osAlert('DEFRAG.exe - Help\n\nClick Start to defragment drive C:\\.\n\nRepeated file edits, uploads, and deletes increase fragmentation over time.\n\nLower fragmentation reduces late-stage application distortion.\n\nNote: some system files cannot be moved.', 'Help Topics', 'icon:tip') },
      '-',
      { label: 'About DEFRAG.exe', action: () => osAlert('DEFRAG.exe - Disk Defragmenter\nsleepOS v1.0\n\nConsolidates fragmented files\nand free space on your hard disk.\n\nA small amount of the drive always remains unmovable.', 'About DEFRAG.exe', 'icon:defrag') },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item'; span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); dfDropdown(span, items); });
    mb.appendChild(span);
  });

  setTimeout(drawGrid, 80);
}


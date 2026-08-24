function openDefrag() {
  if (!mkWin({ id:'defrag', title:'DEFRAG.exe - Disk Defragmenter', icon:'icon:defrag', w:680, h:520, x:100, y:60 })) return;

  const mb   = document.getElementById('mb-defrag');
  const body = document.getElementById('wb-defrag');
  const ws   = document.getElementById('ws-defrag');
  body.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:5px;font-size:11px;overflow:hidden;';

  // One cell per block. 128x32 = 4096, matching FS_IDB_TOTAL_BLOCKS. The grid
  // area is wide and short (roughly 664x378 in a 680x520 window), so this
  // gives a 5x11px cell; a square 64x64 would give 8x3 and disappear after the
  // 1px inset.
  const COLS = 128, ROWS = 32, TOTAL = COLS * ROWS;
  // 0 = free, 1 = allocated, 2 = moving right now.
  const CELL_FREE = 0, CELL_USED = 1, CELL_MOVING = 2;
  const FREE_COLOR = '#ffffff', MOVING_COLOR = '#cc2200';

  const lastDefragTs = Math.max(0, Math.trunc(Number(defragState.lastDefragTs) || 0));
  const msSince = lastDefragTs ? Date.now() - lastDefragTs : null;
  const fragLevel = getDriveFragmentationLevel();

  // Which inode owns each block, so a contiguous file reads as one solid band
  // and a scattered one reads as speckle. That is what makes fragmentation
  // legible as a shape, which matters now that the number rounds to 0% in
  // almost every state.
  let cells = new Uint8Array(TOTAL);
  let owners = new Int32Array(TOTAL).fill(-1);

  // Hue derived arithmetically rather than from a palette: the file count is
  // unbounded, and 137.5 degrees is the golden angle, which keeps consecutive
  // inodes visually distinct instead of walking slowly around the wheel.
  function dfInodeHue(ino) { return (ino * 137.508) % 360; }

  async function dfReadDiskCells() {
    const backend = typeof vfsGetBackend === 'function' ? vfsGetBackend() : null;
    if (!backend || typeof backend._readInodeEntries !== 'function') return false;
    const sb = backend._superblock;
    if (!sb) return false;
    const next = new Uint8Array(TOTAL);
    const nextOwners = new Int32Array(TOTAL).fill(-1);
    const limit = Math.min(TOTAL, sb.totalBlocks);
    for (let i = 0; i < limit; i++) next[i] = fsBitGet(sb.freeBitmap, i) ? CELL_USED : CELL_FREE;
    (await backend._readInodeEntries()).forEach(([ino, inode]) => {
      (inode && inode.blocks || []).forEach(b => { if (b >= 0 && b < TOTAL) nextOwners[b] = ino; });
    });
    cells = next; owners = nextOwners;
    return true;
  }

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
  function dfDriveText() {
    const backend = typeof vfsGetBackend === 'function' ? vfsGetBackend() : null;
    const sb = backend && backend._superblock;
    if (!sb) return { capacity: '-', free: '-' };
    return {
      capacity: fmtSize(sb.totalBlocks * sb.blockSize),
      free: fmtSize(fsCountFreeBlocks(sb) * sb.blockSize),
    };
  }
  const drive0 = dfDriveText();
  const infoRow = document.createElement('div');
  infoRow.style.cssText = 'display:flex;gap:16px;align-items:center;border:2px solid;border-color:#808080 #fff #fff #808080;padding:3px 8px;background:#fff;flex-shrink:0;';
  infoRow.innerHTML = `<span>Drive: <b>C:\\</b></span><span id="df-cap">Capacity: ${drive0.capacity}</span><span id="df-free">Free: ${drive0.free}</span><span id="df-last" style="color:#555;">Last defrag: ${timeAgo(msSince)}</span><span id="df-frag" style="color:#555;">Fragmentation: ${initFragPct}%</span><span id="df-pct" style="margin-left:auto;font-weight:bold;">${initOptPct}% optimized</span>`;
  body.appendChild(infoRow);

  function dfRefreshStats() {
    const drive = dfDriveText();
    const capEl = document.getElementById('df-cap');
    const freeEl = document.getElementById('df-free');
    const fragEl = document.getElementById('df-frag');
    const pctEl = document.getElementById('df-pct');
    if (capEl) capEl.textContent = 'Capacity: ' + drive.capacity;
    if (freeEl) freeEl.textContent = 'Free: ' + drive.free;
    if (fragEl) fragEl.textContent = 'Fragmentation: ' + Math.round(getDriveFragmentationLevel() * 100) + '%';
    if (pctEl) pctEl.textContent = getDriveOptimizationPercent() + '% optimized';
  }

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
      if (cells[i] === CELL_MOVING) ctx.fillStyle = MOVING_COLOR;
      else if (cells[i] === CELL_FREE) ctx.fillStyle = FREE_COLOR;
      else if (owners[i] < 0) ctx.fillStyle = '#808080';
      else ctx.fillStyle = 'hsl(' + dfInodeHue(owners[i]).toFixed(1) + ',65%,45%)';
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
  [[FREE_COLOR,'Free'],['hsl(200,65%,45%)','Allocated (by file)'],[MOVING_COLOR,'Moving']].forEach(([c,l]) => {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:flex;align-items:center;gap:3px;';
    const sq = document.createElement('span');
    sq.style.cssText = `width:12px;height:12px;background:${c};border:1px solid #808080;display:inline-block;flex-shrink:0;`;
    wrap.appendChild(sq); wrap.appendChild(document.createTextNode(l));
    legend.appendChild(wrap);
  });
  body.appendChild(legend);

  // Fire and forget: the window is already on screen, and a disk read that
  // fails leaves an all-free grid rather than blocking the app from opening.
  void dfReadDiskCells().then(ok => { if (ok) drawGrid(); });

  // ── Run ────────────────────────────────────────────────────────
  let running = false;

  startBtn.addEventListener('click', async () => {
    if (running) return;
    running = true; startBtn.disabled = true; stopBtn.disabled = false;
    startSoundLoop('defrag', { crossfade: DEFRAG_CROSSFADE_SEC });
    fileLabel.textContent = 'Analyzing C:\\ ...';
    if (ws) ws.textContent = 'Analyzing...';
    let lastMoved = -1;
    await dfReadDiskCells();
    drawGrid();

    const result = await fsRunCompaction({
      shouldStop: () => !running || !wins['defrag'],
      onProgress: (move, done, total) => {
        // Paint the block that just landed, so the animation marks a real
        // transaction rather than a timer tick. Only ONE cell is ever red:
        // the previous one reverts to its allocated colour first, or red
        // cells would accumulate across the whole run instead of showing
        // where the drive is working.
        if (lastMoved >= 0) cells[lastMoved] = CELL_USED;
        if (move.from >= 0 && move.from < TOTAL) { cells[move.from] = CELL_FREE; owners[move.from] = -1; }
        if (move.to >= 0 && move.to < TOTAL) {
          cells[move.to] = CELL_MOVING;
          owners[move.to] = move.ino;
          lastMoved = move.to;
        }
        const pct = Math.min(100, Math.round((done / total) * 100));
        pbFill.style.width = pct + '%';
        pbLabel.textContent = pct + '%';
        if (ws) ws.textContent = 'Defragmenting C:\\ - ' + pct + '%';
        fileLabel.textContent = 'Moving block ' + move.from + ' to ' + move.to;
        drawGrid();
      },
    });

    running = false;
    startBtn.disabled = false; stopBtn.disabled = true;
    stopSoundLoop('defrag', { fade: 0.6 });
    await dfReadDiskCells();
    drawGrid();
    dfRefreshStats();

    const lastEl = document.getElementById('df-last');
    if (lastEl) lastEl.textContent = 'Last defrag: just now';

    if (result.reason === 'no-space') {
      fileLabel.textContent = 'Cannot defragment: the drive has no free block to work in.';
      if (ws) ws.textContent = 'Cannot defragment';
    } else if (result.reason === 'nothing-to-do') {
      fileLabel.textContent = 'Disk is already contiguous. Nothing to move.';
      if (ws) ws.textContent = 'Nothing to do';
    } else if (result.stopped) {
      fileLabel.textContent = 'Stopped after ' + result.moved + ' of ' + result.total + ' blocks.';
      if (ws) ws.textContent = 'Stopped';
    } else if (result.reason === 'failed') {
      fileLabel.textContent = 'Defragmentation failed after ' + result.moved + ' blocks. The drive is unchanged from that point.';
      if (ws) ws.textContent = 'Failed';
    } else {
      pbFill.style.width = '100%'; pbLabel.textContent = '100%';
      fileLabel.textContent = 'Defragmentation complete. ' + result.moved + ' blocks moved.';
      // The story entity has no inode and no blocks, so DEFRAG genuinely never
      // examined it. Say that, rather than claiming a move that was never
      // attempted, and only while it actually exists.
      if (ws) {
        ws.textContent = (typeof daemonStory === 'object' && daemonStory && !daemonStory.endingReached)
          ? 'Complete - 1 file could not be read: C:\\VOID\\[FILE NAME UNREADABLE]'
          : 'Complete';
      }
    }
  });

  stopBtn.addEventListener('click', () => {
    // fsRunCompaction polls shouldStop before each move, so clearing this is
    // all it takes: the run ends between transactions, leaving the disk
    // consistent and partly compacted, and the next run replans from there.
    running = false;
    stopBtn.disabled = true;
  });

  const dfResizeObserver = new ResizeObserver(() => drawGrid());
  dfResizeObserver.observe(gridWrap);
  const _origCloseDefrag = wins['defrag']?._onclose;
  if (wins['defrag']) wins['defrag']._onclose = () => {
    dfResizeObserver.disconnect();
    running = false;
    // Closing the window mid-run must take the drive noise with it; the run
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


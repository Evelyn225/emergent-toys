function openSysmon() {
  if (!mkWin({ id:'sysmon', title:'SYSMON.exe - System Monitor', icon:'icon:sysmon', w:460, h:400, x:160, y:80 })) return;
  const mb   = document.getElementById('mb-sysmon');
  const body = document.getElementById('wb-sysmon');
  body.style.cssText = 'background:#c0c0c0;overflow:hidden;display:flex;flex-direction:column;';

  // Two meters, both measured. The six flavor meters that used to sit here
  // were a random walk wearing a percentage sign, and a system monitor is the
  // one place that fiction cannot live. They were deleted rather than
  // relocated: a meter that exists only to be invented has no honest home.
  //
  // There is deliberately no RAM bar. Summing interpreter bytes and DOM nodes
  // produces a quantity that means nothing, and no meter beats an incoherent
  // one.
  const METRICS = [
    { key: 'cpu',  label: 'CPU Usage', color: '#000080' },
    { key: 'disk', label: 'Disk Used', color: '#000080' },
  ];

  let updateInterval = 1500;
  let showSysProcs   = true;
  let activeTab      = 'resources';
  let selectedProc   = null;
  let smTimer        = null;
  // The probe's per-app percentages. instWindowSample RESETS the window as a
  // side effect, so the result has to be held here: renderProcesses runs later
  // in the same tick and would otherwise find the totals already cleared.
  let lastCpuSample = new Map();

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
        <div id="smbar-${m.key}" style="position:absolute;inset:0;right:auto;width:0%;background:${m.color || '#000080'};"></div>
      </div>
      <div id="smval-${m.key}" style="width:30px;font-size:10px;text-align:right;">-</div>
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
    <div style="width:96px;padding:2px 4px;">Mem</div>`;
  procPanel.appendChild(procHeader);
  const procList = document.createElement('div');
  procList.style.cssText = 'flex:1;overflow-y:auto;background:#fff;';
  procPanel.appendChild(procList);
  content.appendChild(procPanel);

  function getProcessList() {
    // Phase 5b deleted the story rows' authored cpu/mem, so there is nothing
    // left to jitter: a story process has no window and no interpreter, so it
    // has no measurable execution context and reports null like any other
    // unmeasured row. Real (kernel-table) rows carry their measured cpu/mem
    // straight through from buildProcessRows.
    return buildProcessRows().filter(p => showSysProcs || !p.isStory);
  }

  function renderProcesses() {
    if (!wins['sysmon']) return;
    const procs = getProcessList();
    procList.innerHTML = '';
    procs.forEach(p => {
      const sel = selectedProc && selectedProc.pid === p.pid;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;font-size:10px;border-bottom:1px solid #f0f0f0;cursor:default;background:${sel ? '#000080' : 'transparent'};color:${sel ? '#fff' : '#000'};`;
      let mem = p.mem, memUnit = p.memUnit;
      // A script row's mem/memUnit come straight through from
      // buildProcessRows (interpreter-tracked bytes). An app row measures
      // nothing there - its cost is the DOM subtree of its own window, and
      // that's the OS layer's business, not process-view.js's, so it's
      // counted here at render time.
      if (mem === null && p.winId && wins[p.winId] && wins[p.winId].el) {
        mem = wins[p.winId].el.getElementsByTagName('*').length + 1;
        memUnit = 'nodes';
      }
      // Three cases, and the difference between the last two is the point of
      // this phase. A worker reports interpreter-measured CPU. An app has a
      // live window, so it IS measurable - if the probe recorded nothing this
      // window it was genuinely idle, which is 0.0, not "unmeasurable". A row
      // with no window and no interpreter has no execution context at all, and
      // only that reads as a dash.
      let cpu = p.cpu;
      if (cpu === null && p.winId && wins[p.winId]) {
        cpu = lastCpuSample.get(p.pid) || 0;
      }
      const cpuText = cpu === null ? '-' : cpu.toFixed(1);
      // Each cell carries its own unit because the two process classes report
      // genuinely different things: a script reports interpreter-tracked bytes,
      // an app reports the node count of its window subtree. Neither is heap
      // and the column header claims neither.
      const memText = mem === null ? '-'
        : memUnit === 'nodes' ? mem.toLocaleString() + ' nodes'
        : (mem / 1024).toFixed(1) + ' KB';
      row.innerHTML = `<div style="width:54px;padding:1px 4px;border-right:1px solid #e8e8e8;">${p.pid}</div><div style="flex:1;padding:1px 4px;border-right:1px solid #e8e8e8;overflow:hidden;white-space:nowrap;">${p.name}</div><div style="width:52px;padding:1px 4px;border-right:1px solid #e8e8e8;">${cpuText}</div><div style="width:96px;padding:1px 4px;">${memText}</div>`;
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
    const action = endProcessAction(selectedProc);
    if (action === 'story') {
      if (selectedProc.pid === 512) {
        const result = killSoulDaemonProcess();
        selectedProc = null;
        renderProcesses();
        osAlert([result.message, ...(result.details || [])].filter(Boolean).join('\n'), result.ok ? 'Process Update' : 'Access Denied', 'icon:warning');
        return;
      }
      const dlgId = 'sm-killerr-' + Date.now();
      if (mkWin({ id:dlgId, title:'Access Denied', icon:'icon:warning', w:290, h:110, popup:true, menubar:false, statusbar:false })) {
        const db = document.getElementById('wb-' + dlgId);
        if (db) { db.style.cssText = 'padding:12px 14px;font-size:11px;'; db.innerHTML = `<p style="margin-bottom:10px;">Unable to terminate system process.<br><b>Access Denied</b> (PID: ${selectedProc.pid})</p><div style="text-align:center"><button style="${btnStyle}" onclick="closeWin('${dlgId}')">OK</button></div>`; }
      }
      return;
    }
    if (action === 'refused') {
      // kernelSignal said no - the kernel process itself (pid 1), or a
      // process that already exited between this row rendering and the
      // click landing. Match the terminal's KILL wording for the identical
      // case (apps/terminal.js) so the two surfaces agree about what
      // happened, instead of this button quietly doing nothing.
      osAlert(`Access denied: PID ${selectedProc.pid} cannot be terminated.`, 'Access Denied', 'icon:warning');
      return;
    }
    // action is 'closed' or 'signalled': endProcessAction already told the
    // window manager or the kernel what to do.
    selectedProc = null;
    renderProcesses();
  });
  procToolbar.querySelector('#sm-copypid-btn').addEventListener('click', () => {
    if (!selectedProc) return;
    navigator.clipboard.writeText(String(selectedProc.pid)).catch(() => {});
    const btn = procToolbar.querySelector('#sm-copypid-btn');
    const orig = btn.textContent; btn.textContent = 'Copied!';
    procSetTimeout('sysmon', () => { btn.textContent = orig; }, 800);
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
    lastCpuSample = instWindowSample(performance.now());
    let cpuTotal = 0;
    lastCpuSample.forEach(function (pct) { cpuTotal += pct; });
    getProcessList().forEach(function (p) {
      if (p.cpu != null) cpuTotal += p.cpu;
    });
    cpuTotal = Math.min(100, cpuTotal);

    const backend = typeof vfsGetBackend === 'function' ? vfsGetBackend() : null;
    const sb = backend && backend._superblock;
    const diskPct = sb
      ? ((sb.totalBlocks - fsCountFreeBlocks(sb)) / sb.totalBlocks) * 100
      : null;

    const values = { cpu: cpuTotal, disk: diskPct };
    METRICS.forEach(function (m) {
      const v = values[m.key];
      const bar = document.getElementById('smbar-' + m.key);
      const val = document.getElementById('smval-' + m.key);
      // A null reading renders as a dash, never as 0%. The superblock is
      // briefly absent after a failed write transaction discards it, and
      // painting 0% there would be a fabricated number.
      if (bar) { bar.style.width = (v == null ? 0 : v).toFixed(0) + '%'; bar.style.background = m.color; }
      if (val) { val.textContent = v == null ? '-' : v.toFixed(0) + '%'; }
    });
    const sec = Math.floor(performance.now() / 1000);
    const up = document.getElementById('sm-uptime');
    if (up) up.textContent = `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    const ct = document.getElementById('sm-proc-count');
    if (ct) ct.textContent = getProcessList().length;
    if (activeTab === 'processes') renderProcesses();
  }

  function restartSmTimer() {
    if (smTimer) clearInterval(smTimer);
    smTimer = null;
    if (updateInterval > 0) smTimer = procSetInterval('sysmon', smTick, updateInterval);
    if (wins['sysmon']) wins['sysmon']._interval = smTimer;
  }

  // Open the first window now so the first tick measures a real interval
  // rather than dividing by the time since page load.
  instWindowOpen(performance.now());
  restartSmTimer();
}


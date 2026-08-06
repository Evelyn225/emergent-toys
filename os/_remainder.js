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

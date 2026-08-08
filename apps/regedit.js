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
      { label: 'Export...', action: async () => {
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
        // The success alert has to sit after the await and inside the guard.
        // Left where it was it would fire before the write resolved, and the OS
        // would cheerfully report an export that never happened.
        try {
          await vfsWriteFile(fname, txt, '');
        } catch (err) {
          osAlert(
            err.code === 'ENOSPC' ? 'Not enough space to export the registry.' : err.message,
            'Export Failed', 'X'
          );
          return;
        }
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

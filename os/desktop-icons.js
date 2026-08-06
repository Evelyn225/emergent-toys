const _mobileGrid  = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700;
const ICON_CELL_W  = _mobileGrid ? 104 : 86;
const ICON_CELL_H  = _mobileGrid ? 104 : 86;
const ICON_BOX_W   = _mobileGrid ? 96  : 80;
const ICON_BOX_H   = _mobileGrid ? 96  : 80;
const ICON_PAD_X   = 6;
const ICON_PAD_Y   = 6;
const ICON_POS_KEY = 'sleepOS-icon-positions';
let iconPositions  = {};   // { ic.name: { col, row, manual? } }

function iconGetGridMetrics() {
  const layer = document.getElementById('icons-layer');
  if (!layer) {
    return {
      cols: 1,
      rows: 1,
      stepX: 0,
      stepY: 0,
      padX: ICON_PAD_X,
      padY: ICON_PAD_Y,
    };
  }
  const availW = Math.max(ICON_BOX_W, layer.offsetWidth - ICON_PAD_X * 2);
  const availH = Math.max(ICON_BOX_H, layer.offsetHeight - ICON_PAD_Y * 2);
  const cols = Math.max(1, Math.floor((availW - ICON_BOX_W) / ICON_CELL_W) + 1);
  const rows = Math.max(1, Math.floor((availH - ICON_BOX_H) / ICON_CELL_H) + 1);
  return {
    cols,
    rows,
    stepX: cols > 1 ? (availW - ICON_BOX_W) / (cols - 1) : 0,
    stepY: rows > 1 ? (availH - ICON_BOX_H) / (rows - 1) : 0,
    padX: ICON_PAD_X,
    padY: ICON_PAD_Y,
  };
}

function iconGetGridSize() {
  const { cols, rows } = iconGetGridMetrics();
  return { cols, rows };
}

function iconCellToPixel(col, row) {
  const { stepX, stepY, padX, padY } = iconGetGridMetrics();
  return {
    left: Math.round(padX + col * stepX),
    top: Math.round(padY + row * stepY),
  };
}

function iconRecycleBinCell() {
  const { cols, rows } = iconGetGridSize();
  return { col: Math.max(0, cols - 1), row: Math.max(0, rows - 1) };
}

function iconPixelToCell(px, py) {
  const { cols, rows, stepX, stepY, padX, padY } = iconGetGridMetrics();
  return {
    col: Math.max(0, Math.min(cols - 1, stepX > 0 ? Math.round((px - padX) / stepX) : 0)),
    row: Math.max(0, Math.min(rows - 1, stepY > 0 ? Math.round((py - padY) / stepY) : 0)),
  };
}

function iconDefaultPositions(icons) {
  const { rows } = iconGetGridSize();
  const out = {};
  icons.forEach((ic, i) => { out[ic.name] = { col: Math.floor(i / rows), row: i % rows }; });
  return out;
}

function iconFindFreeCell(wantCol, wantRow, excludeName) {
  const { cols, rows } = iconGetGridSize();
  const clamp = (c, r) => ({ col: Math.max(0, Math.min(c, cols - 1)), row: Math.max(0, Math.min(r, rows - 1)) });
  const occ = new Set(
    Object.entries(iconPositions).filter(([k]) => k !== excludeName).map(([, p]) => p.col + ',' + p.row)
  );
  const start = clamp(wantCol, wantRow);
  const visited = new Set();
  const q = [start];
  let iter = 0;
  while (q.length && iter++ < cols * rows * 2) {
    const { col, row } = q.shift();
    const k = col + ',' + row;
    if (visited.has(k)) continue;
    visited.add(k);
    if (!occ.has(k)) return { col, row };
    for (const [dc, dr] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nc = col + dc, nr = row + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) q.push({ col: nc, row: nr });
    }
  }
  return start;
}

function saveIconPositions() {
  localStorage.setItem(ICON_POS_KEY, JSON.stringify(iconPositions));
}

function isDesktopBuiltInIcon(ic) {
  return !!ic && !ic.desktopEntry && !ic.custom && !ic.recycleBin;
}

function getDesktopFolderDropTarget(clientX, clientY, draggingIcons) {
  const draggingSet = new Set(Array.isArray(draggingIcons) ? draggingIcons : [draggingIcons].filter(Boolean));
  const folderEls = Array.from(document.querySelectorAll('#icons-layer .desktop-icon')).filter(el => {
    const targetIcon = el._ic;
    if (!targetIcon || draggingSet.has(targetIcon)) return false;
    return !!targetIcon.desktopEntry && targetIcon.kind === 'dir';
  });
  for (const el of folderEls) {
    const rect = el.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return el._ic;
    }
  }
  return null;
}

function moveDesktopIconIntoFolder(icon, folderIcon) {
  if (!icon || !folderIcon?.desktopEntry || folderIcon.kind !== 'dir') return false;
  const dstDirPath = folderIcon.target.path;
  return moveShellItemToDir(icon, 'DESKTOP', dstDirPath);
}

// ─────────────────────────────────────────────────────────────────
// DESKTOP ICONS
// ─────────────────────────────────────────────────────────────────
const desktopSel = new Set(); // Set of icon div elements currently selected

function clearDesktopSel() {
  desktopSel.forEach(d => d.classList.remove('selected'));
  desktopSel.clear();
}

function canDeleteDesktopSystemIcon(ic) {
  return !!ic && !ic.custom && String(ic.name || '').toLowerCase() === 'void.tmp' && !daemonStory.endingReached;
}

function deleteDesktopSystemIcons(icons) {
  const targets = (icons || []).filter(canDeleteDesktopSystemIcon);
  if (!targets.length) return;
  const prompt = targets.length === 1 ? 'Delete "' + targets[0].name + '"?' : 'Delete ' + targets.length + ' selected items?';
  osConfirm(prompt, 'Delete', ok => {
    if (!ok) return;
    const blocked = [];
    let changed = false;
    targets.forEach(target => {
      const result = deleteVirtualPath(target.name);
      if (result.ok && result.deleted) changed = true;
      else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
    });
    if (blocked.length) osAlert(blocked[0], 'Delete', '⚠️');
    if (changed) clearDesktopSel();
  }, '🗑️');
}

function canDeleteDesktopFsEntry(ic) {
  return !!ic?.desktopEntry && !!ic?.target?.path;
}

function deleteDesktopFsEntries(icons) {
  const targets = (icons || []).filter(canDeleteDesktopFsEntry);
  if (!targets.length) return;
  const prompt = targets.length === 1 ? 'Delete "' + targets[0].name + '"?' : 'Delete ' + targets.length + ' selected files?';
  osConfirm(prompt, 'Delete', ok => {
    if (!ok) return;
    const blocked = [];
    let changed = false;
    targets.forEach(target => {
      const result = deleteVirtualPath(target.target.path);
      if (result.ok && result.deleted) changed = true;
      else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
    });
    if (blocked.length) osAlert(blocked[0], 'Delete', 'âš ï¸');
    if (changed) {
      clearDesktopSel();
      document.dispatchEvent(new CustomEvent('fs-changed'));
    }
  }, 'ðŸ-‘ï¸');
}

function recycleDesktopItemAtPath(path) {
  const result = recycleVirtualPath(path);
  if (!result.ok) osAlert([result.message, ...(result.details || [])].filter(Boolean).join('\n'), 'Recycle Bin', '⚠️');
  return result;
}

function makeDesktopIconEl(ic) {
  const div = document.createElement('div');
  div.className = 'desktop-icon';
  const displayName = ic.name === '?????.exe' ? getExeDisplayName() : ic.name;
  div.innerHTML = '<div class="di-img">' + ic.emoji + '</div><div class="di-name">' + iconLabel(displayName) + '</div>';
  div._ic = ic;
  function activate() {
    if (ic.action) window[ic.action]?.();
    else if (ic.target) openDesktopShortcutTarget(ic.target);
    else if (ic.openFn) ic.openFn();
  }
  let clicks = 0, clickT;
  function queueActivateClick() {
    clicks++;
    if (clicks === 1) {
      clickT = setTimeout(() => { clicks = 0; }, 380);
    } else {
      clearTimeout(clickT);
      clicks = 0;
      activate();
    }
  }
  div.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (e.button === 2) return; // let contextmenu handle right-clicks
    if (e.ctrlKey) {
      // Toggle this icon in the multi-selection
      if (desktopSel.has(div)) {
        div.classList.remove('selected');
        desktopSel.delete(div);
      } else {
        div.classList.add('selected');
        desktopSel.add(div);
      }
      clicks = 0;
      clearTimeout(clickT);
      return;
    }
    if (!desktopSel.has(div) || desktopSel.size <= 1) {
      clearDesktopSel();
      div.classList.add('selected');
      desktopSel.add(div);
    }

    // Drag-to-rearrange tracking
    const isMouse = e.pointerType === 'mouse';
    const dragThreshold = isMouse ? 5 : 12;
    const startClientX = e.clientX, startClientY = e.clientY;
    const layer   = document.getElementById('icons-layer');
    const lr      = layer.getBoundingClientRect();
    const draggedDivs = desktopSel.has(div) ? [...desktopSel] : [div];
    const dragStates = draggedDivs.map(el => {
      const rect = el.getBoundingClientRect();
      const iconState = el._ic;
      const currentPos = iconPositions[iconState.name];
      return {
        el,
        ic: iconState,
        startLeft: el.offsetLeft,
        startTop: el.offsetTop,
        offX: e.clientX - rect.left,
        offY: e.clientY - rect.top,
        startCell: currentPos
          ? { col: currentPos.col, row: currentPos.row }
          : iconPixelToCell(el.offsetLeft, el.offsetTop),
      };
    });
    const primaryState = dragStates.find(state => state.el === div) || dragStates[0];
    const draggedIcons = dragStates.map(state => state.ic);
    const draggedPayload = buildShellDragPayload(ic, 'DESKTOP', 'desktop', { items: draggedIcons });
    let dragging  = false;

    const onMove = mv => {
      if (!dragging) {
        if (Math.abs(mv.clientX - startClientX) > dragThreshold || Math.abs(mv.clientY - startClientY) > dragThreshold) {
          dragging = true;
          clicks = 0; clearTimeout(clickT);
          dragStates.forEach(state => {
            state.el.style.zIndex = '999';
            state.el.style.opacity = '0.75';
          });
        }
      }
      if (dragging) {
        mv.preventDefault();
        const dx = mv.clientX - startClientX;
        const dy = mv.clientY - startClientY;
        dragStates.forEach(state => {
          state.el.style.left = (state.startLeft + dx) + 'px';
          state.el.style.top  = (state.startTop + dy) + 'px';
        });
      }
    };
    const onUp = up => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      dragStates.forEach(state => {
        state.el.style.zIndex = '';
        state.el.style.opacity = '';
      });
      if (dragging) {
        const recycleEl = document.querySelector('[data-icon-key="' + CSS.escape(RECYCLE_BIN_NAME) + '"]');
        const canRecycleDragged = draggedIcons.length && draggedIcons.every(canDeleteDesktopFsEntry);
        if (canRecycleDragged && recycleEl && !draggedDivs.includes(recycleEl)) {
          const rr = recycleEl.getBoundingClientRect();
          const overRecycleBin = up.clientX >= rr.left && up.clientX <= rr.right && up.clientY >= rr.top && up.clientY <= rr.bottom;
          if (overRecycleBin) {
            const ok = draggedIcons.every(targetIcon => recycleDesktopItemAtPath(targetIcon.target.path).ok);
            if (ok) {
              clearDesktopSel();
              return;
            }
          }
        }
        const folderTarget = getDesktopFolderDropTarget(up.clientX, up.clientY, draggedIcons);
        if (folderTarget && moveShellPayloadToDir(draggedPayload, folderTarget.target.path)) {
          clearDesktopSel();
          return;
        }
        draggedDivs.forEach(stateEl => { stateEl.style.pointerEvents = 'none'; });
        const dropNode = document.elementFromPoint(up.clientX, up.clientY);
        draggedDivs.forEach(stateEl => { stateEl.style.pointerEvents = ''; });
        const explorerItemEl = dropNode?.closest?.('.exp-item,.exp-list-item,.exp-det-item');
        const explorerPaneEl = dropNode?.closest?.('.exp-body');
        const explorerDrop = explorerItemEl?._shellDropHandler || explorerPaneEl?._shellDropHandler;
        if (explorerDrop) {
          const ok = explorerDrop(draggedPayload);
          if (ok) {
            clearDesktopSel();
            return;
          }
        }
        if (dropNode?.closest?.('.os-window')) {
          dragStates.forEach(state => {
            const { left, top } = iconCellToPixel(state.startCell.col, state.startCell.row);
            state.el.style.left = left + 'px';
            state.el.style.top = top + 'px';
          });
          return;
        }
        // snap based on icon top-left corner position (Windows-style)
        const iconLeft = up.clientX - lr.left - primaryState.offX;
        const iconTop  = up.clientY - lr.top  - primaryState.offY;
        const { col: wc, row: wr } = iconPixelToCell(iconLeft, iconTop);
        dragStates.forEach(state => { delete iconPositions[state.ic.name]; });
        dragStates
          .slice()
          .sort((a, b) => a.startCell.col - b.startCell.col || a.startCell.row - b.startCell.row)
          .forEach(state => {
            const wantCol = wc + (state.startCell.col - primaryState.startCell.col);
            const wantRow = wr + (state.startCell.row - primaryState.startCell.row);
            const { col, row } = iconFindFreeCell(wantCol, wantRow, state.ic.name);
            iconPositions[state.ic.name] = { col, row, manual: true };
            const { left, top } = iconCellToPixel(col, row);
            state.el.style.left = left + 'px';
            state.el.style.top  = top  + 'px';
          });
        saveIconPositions();
      } else {
        if (isMouse) {
          queueActivateClick();
        } else if (!_longPressActive) {
          activate();
        }
        _longPressActive = false;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  });
  addLongPress(div);
  div.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    // If right-clicking outside current selection, replace it
    if (!desktopSel.has(div)) {
      clearDesktopSel();
      div.classList.add('selected');
      desktopSel.add(div);
    }
    const selDivs = [...desktopSel];
    const selIcs  = selDivs.map(d => d._ic);
    const multi   = selDivs.length > 1;
    const canDeleteSystemFiles = selIcs.some(canDeleteDesktopSystemIcon);
    const canDeleteDesktopFiles = selIcs.some(canDeleteDesktopFsEntry);
    const singleDesktopImage = !multi && selIcs[0]?.desktopEntry && selIcs[0]?.kind === 'image' ? selIcs[0] : null;
    const items   = [];
    if (multi) {
      items.push({ label: 'Open All (' + selDivs.length + ')', action: () => selIcs.forEach(i => {
        if (i.action) window[i.action]?.();
        else if (i.target) openDesktopShortcutTarget(i.target);
        else if (i.openFn) i.openFn();
      })});
    } else {
      items.push({ label: 'Open', action: activate });
      // Lore / decompiler shortcuts for single icons
      const icName = ic.name || '';
      if (['daemon.core','void.tmp'].includes(icName)) {
        items.push({ label: 'Open in Notepad', action: () => openNotepad(icName) });
      }
      if (icName.toLowerCase().endsWith('.exe') && !['NOTEPAD.exe','TERMINAL.exe','SYSMON.exe','BROWSER.exe','DEFRAG.exe','CALC.exe','REGEDIT.exe','EXPLORER.exe'].includes(icName)) {
        items.push({ label: 'Open in Decompiler', action: () => openDecompilerView(icName) });
      }
      if (singleDesktopImage) {
        items.push({ label: 'Set as Wallpaper', action: () => applyWallpaper(singleDesktopImage.target.path) });
      }
    }
    if (canDeleteSystemFiles) {
      items.push('-');
      items.push({ label: multi ? 'Delete Deletable Items' : 'Delete', action: () => deleteDesktopSystemIcons(selIcs) });
    }
    if (canDeleteDesktopFiles) {
      items.push('-');
      items.push({ label: multi ? 'Delete Files' : 'Delete', action: () => deleteDesktopFsEntries(selIcs) });
    }
    if (!multi && ic.recycleBin) {
      items.push('-');
      items.push({ label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin() });
    }
    if (selIcs.some(i => i.custom)) {
      items.push('-');
      items.push({ label: multi ? 'Delete Selected' : 'Delete', action: () => {
        selDivs.forEach(d => {
          if (!d._ic.custom) return;
          const idx = customDesktopIcons.indexOf(d._ic);
          if (idx > -1) customDesktopIcons.splice(idx, 1);
          delete iconPositions[d._ic.name];
          d.remove();
        });
        desktopSel.clear();
        saveDesktopShortcuts();
        saveIconPositions();
        document.dispatchEvent(new CustomEvent('fs-changed'));
      }});
    }
    showCtxMenu(e.clientX, e.clientY, items);
  });
  if (ic.recycleBin || (ic.desktopEntry && ic.kind === 'dir')) {
    const dropDirPath = ic.recycleBin ? null : ic.target.path;
    const setDropOutline = on => { div.style.outline = on ? '1px dotted #fff' : ''; };
    div.addEventListener('dragover', e => {
      const payload = getShellDragPayload();
      if (!payload || shellDragIncludesItem(payload, ic)) return;
      const accepts = ic.recycleBin
        ? canRecycleShellPayload(payload)
        : canMoveShellPayloadToDir(payload, dropDirPath);
      if (!accepts) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropOutline(true);
    });
    div.addEventListener('dragleave', () => setDropOutline(false));
    div.addEventListener('drop', e => {
      const payload = getShellDragPayload();
      setDropOutline(false);
      if (!payload || shellDragIncludesItem(payload, ic)) return;
      let ok = false;
      if (ic.recycleBin) {
        ok = recycleShellPayload(payload);
      } else {
        ok = moveShellPayloadToDir(payload, dropDirPath);
      }
      if (!ok) return;
      e.preventDefault();
      e.stopPropagation();
      clearShellDragPayload();
    });
  }
  return div;
}

function addDesktopShortcut(name, emoji, target, openFn, dirPath) {
  const ic = {
    name,
    emoji,
    target: target || null,
    openFn,
    custom: true,
    dirPath: normalizeDesktopContainerDir(dirPath || 'DESKTOP'),
  };
  customDesktopIcons.push(ic);
  saveDesktopShortcuts();
  if (ic.dirPath !== 'DESKTOP') {
    document.dispatchEvent(new CustomEvent('fs-changed'));
    return;
  }
  // Find a free cell (prefer column-first after existing icons)
  const allIcons = [...getVisibleDesktopIcons(), ...getDesktopFsIcons(), ...getDesktopShortcutsForDir('DESKTOP')];
  const defaults = iconDefaultPositions(allIcons);
  const { col: dc, row: dr } = defaults[ic.name] || { col: 0, row: 0 };
  const { col, row } = iconFindFreeCell(dc, dr, ic.name);
  iconPositions[ic.name] = { col, row };
  saveIconPositions();
  document.dispatchEvent(new CustomEvent('fs-changed'));
}

let _desktopInteractionsBound = false;
function setupIcons() {
  clearDesktopSel();
  const layer = document.getElementById('icons-layer');
  layer.innerHTML = '';

  const allIcons = [...getVisibleDesktopIcons(), ...getDesktopFsIcons(), ...getDesktopShortcutsForDir('DESKTOP')];
  const recycleIcon = allIcons.find(ic => ic.recycleBin);
  const saved    = (() => { try { return JSON.parse(localStorage.getItem(ICON_POS_KEY) || '{}'); } catch { return {}; } })();
  const defaults = iconDefaultPositions(allIcons.filter(ic => !ic.recycleBin));
  if (recycleIcon) defaults[recycleIcon.name] = iconRecycleBinCell();
  const hasSavedPosition = ic => {
    const entry = saved[ic.name];
    if (!entry || !Number.isFinite(entry.col) || !Number.isFinite(entry.row)) return false;
    return ic.recycleBin || !isDesktopBuiltInIcon(ic) || entry.manual === true;
  };
  const assignPosition = ic => {
    const isAutoRecycleBin = ic.recycleBin && saved[ic.name]?.manual !== true;
    const preferred = isAutoRecycleBin ? iconRecycleBinCell() : (hasSavedPosition(ic) ? saved[ic.name] : (defaults[ic.name] || { col: 0, row: 0 }));
    const { col, row } = iconFindFreeCell(preferred.col, preferred.row, ic.name);
    iconPositions[ic.name] = saved[ic.name]?.manual === true ? { col, row, manual: true } : { col, row };
  };
  iconPositions  = {};
  // Place non-recycle-bin icons first so the recycle bin can always claim the bottom-right cell
  const nonBinIcons = allIcons.filter(ic => !ic.recycleBin);
  nonBinIcons.filter(hasSavedPosition).forEach(assignPosition);
  nonBinIcons.filter(ic => !hasSavedPosition(ic)).forEach(assignPosition);
  if (recycleIcon) assignPosition(recycleIcon);
  saveIconPositions();

  allIcons.forEach(ic => {
    const el = makeDesktopIconEl(ic);
    el.setAttribute('data-icon-key', ic.name);
    el.style.position = 'absolute';
    const { left, top } = iconCellToPixel(iconPositions[ic.name].col, iconPositions[ic.name].row);
    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
    layer.appendChild(el);
  });

  if (_desktopInteractionsBound) return;
  _desktopInteractionsBound = true;

  // Rubber-band selection on empty desktop space
  layer.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.desktop-icon') || e.target.closest('.os-window')) return;
    if (!e.ctrlKey) clearDesktopSel();
    document.body.style.userSelect = 'none';
    // layer is position:fixed inset:0 so offsetLeft/Top of icons === clientX/Y coords
    const sx = e.clientX, sy = e.clientY;
    let didDrag = false;
    const selDiv = document.createElement('div');
    selDiv.className = 'sel-rect';
    selDiv.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:0;height:0;';
    layer.appendChild(selDiv);
    const onMove = mv => {
      didDrag = true;
      const cx = mv.clientX, cy = mv.clientY;
      const left = Math.min(sx, cx), top = Math.min(sy, cy);
      const w = Math.abs(cx - sx),   h   = Math.abs(cy - sy);
      selDiv.style.left = left + 'px'; selDiv.style.top  = top  + 'px';
      selDiv.style.width = w   + 'px'; selDiv.style.height = h  + 'px';
      const sr = { left, top, right: left + w, bottom: top + h };
      // icons are absolutely positioned in layer - offsetLeft/Top are in layer (= client) coords
      layer.querySelectorAll('.desktop-icon').forEach(el => {
        const elL = el.offsetLeft, elT = el.offsetTop;
        const elR = elL + el.offsetWidth, elB = elT + el.offsetHeight;
        const hit = sr.left < elR && sr.right > elL && sr.top < elB && sr.bottom > elT;
        if (hit) { desktopSel.add(el); el.classList.add('selected'); }
        else if (!e.ctrlKey) { desktopSel.delete(el); el.classList.remove('selected'); }
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      document.body.style.userSelect = '';
      selDiv.remove();
      // suppress the click that fires after mouseup so it doesn't clear selection
      if (didDrag) window.addEventListener('click', e2 => e2.stopPropagation(), { once: true, capture: true });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });

  layer.addEventListener('dragover', e => {
    if (e.target.closest('.desktop-icon')) return;
    const payload = getShellDragPayload();
    if (!payload || isDesktopSurfaceTransferBlocked(payload, 'DESKTOP') || !canMoveShellPayloadToDir(payload, 'DESKTOP')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  layer.addEventListener('drop', e => {
    if (e.target.closest('.desktop-icon')) return;
    const payload = getShellDragPayload();
    if (!payload || isDesktopSurfaceTransferBlocked(payload, 'DESKTOP') || !canMoveShellPayloadToDir(payload, 'DESKTOP')) return;
    e.preventDefault();
    e.stopPropagation();
    if (moveShellPayloadToDir(payload, 'DESKTOP')) clearShellDragPayload();
  });

  // Desktop background right-click / long-press
  addLongPress(document.getElementById('desktop'));
  document.getElementById('desktop').addEventListener('contextmenu', e => {
    if (e.target.closest('.desktop-icon') || e.target.closest('.os-window')) return;
    e.preventDefault();
    clearDesktopSel();
    showCtxMenu(e.clientX, e.clientY, [
      { label: '💻 Open Terminal',    action: openTerminal },
      { label: '🗂️ Open Explorer',    action: openExplorer },
      { label: '📝 Open Notepad',     action: openNotepad },
      { label: '🌐 Open Browser',     action: openBrowser },
      '-',
      { label: '📋 Paste', disabled: !_expClipboard, action: () => pasteClipboardInto('DESKTOP') },
      '-',
      { label: '📁 New Folder',      action: () => promptCreateFolderAt('DESKTOP') },
      { label: '📤 Upload File...',  action: () => triggerUpload('DESKTOP') },
      { label: '🖼️ Change Wallpaper', action: openAppearance },
      '-',
      { label: 'ℹ️ Properties', action: () => osAlert('sleepOS v0.9β\nBuild: 2024.11.13-EXPERIMENTAL\nSOMATIC KERNEL 686', 'Properties', 'ℹ️') },
    ]);
  });

  document.getElementById('desktop').addEventListener('click', e => {
    if (!e.target.closest('.desktop-icon') && !e.target.closest('.os-window'))
      clearDesktopSel();
  });
}

document.addEventListener('fs-changed', () => {
  if (typeof setupIcons === 'function') setupIcons();
});

// Reflow icons on orientation change (mobile)
window.addEventListener('orientationchange', () => {
  setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
});

// Reflow icons when window is resized
let _iconResizeTimer;
window.addEventListener('resize', () => {
  const desktop = document.getElementById('desktop');
  // The desktop is hidden by CSS during boot, not by an inline style, so
  // `desktop.style.display` is '' at that point. Checking the inline style
  // let this handler run over the BIOS screen. Use the computed value.
  if (!desktop || getComputedStyle(desktop).display === 'none') return;
  clearTimeout(_iconResizeTimer);
  _iconResizeTimer = setTimeout(() => {
    // Re-lay out through setupIcons rather than reflowing here. It honours
    // manually placed icons, recomputes defaults for the new grid size, and
    // places via iconFindFreeCell, which is bounded.
    //
    // This replaced a hand-rolled placement loop that could not terminate:
    // it clamped with `if (col >= cols) col = cols - 1` instead of advancing,
    // so once the last column filled it cycled the same occupied cells
    // forever. Shrinking the window below the icon count hung the page.
    if (typeof setupIcons === 'function') setupIcons();
  }, 150);
});

// ─────────────────────────────────────────────────────────────────
// WINDOW CONTENT
// ─────────────────────────────────────────────────────────────────


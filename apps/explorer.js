function openExplorer(startPath) {
  const id = nextExplorerWinId();
  if (!mkWin({ id, title:'FILE EXPLORER \u2014 C:\\sleepOS', icon:'\u{1F5C2}\uFE0F', w:560, h:400, x:110, y:65 })) return;
  const body = document.getElementById('wb-' + id);
  const ws   = document.getElementById('ws-' + id);
  const mb   = document.getElementById('mb-' + id);
  body.style.cssText = 'padding:0;display:flex;flex-direction:column;overflow:hidden;';

  let cwd = (startPath || '').toUpperCase();

  const toolbar = document.createElement('div');
  toolbar.className = 'exp-toolbar';
  const upBtn      = document.createElement('button'); upBtn.textContent = '\u2B06 Up';
  const refreshBtn = document.createElement('button'); refreshBtn.textContent = '\u21BB Refresh';
  const addrEl     = document.createElement('input'); addrEl.className = 'exp-addr';
  addrEl.title = 'Type a path and press Enter to navigate';
  addrEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = addrEl.value.trim();
      const normalized = fsNormalizeDir(raw);
      if (normalized === '') {
        cwd = '';
        render();
        addrEl.blur();
      } else if (normalized === 'PROJECTS' || fsGetDir(normalized)) {
        cwd = normalized;
        render();
        addrEl.blur();
      } else {
        addrEl.style.background = 'rgba(180,0,0,0.25)';
        setTimeout(() => { addrEl.style.background = ''; }, 600);
        const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
        addrEl.value = fullPath;
        addrEl.blur();
      }
    } else if (e.key === 'Escape') {
      const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
      addrEl.value = fullPath;
      addrEl.blur();
    }
  });
  addrEl.addEventListener('blur', () => {
    const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
    addrEl.value = fullPath;
  });
  addrEl.addEventListener('focus', () => addrEl.select());
  toolbar.appendChild(upBtn); toolbar.appendChild(refreshBtn); toolbar.appendChild(addrEl);
  body.appendChild(toolbar);

  const pane = document.createElement('div');
  pane.className = 'exp-body';
  pane.style.position = 'relative';
  body.appendChild(pane);

  // Rubber-band selection on empty pane space
  pane.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const ITEM_SEL = '.exp-item,.exp-list-item,.exp-det-item';
    if (e.target.closest(ITEM_SEL)) return;
    if (!e.ctrlKey) clearSelection();
    document.body.style.userSelect = 'none';
    const pr0  = pane.getBoundingClientRect();
    const st0  = pane.scrollTop;
    const sx   = e.clientX - pr0.left + st0;
    const sy   = e.clientY - pr0.top  + st0;
    let didDrag = false;
    const selDiv = document.createElement('div');
    selDiv.className = 'sel-rect';
    selDiv.style.cssText = 'left:' + sx + 'px;top:' + sy + 'px;width:0;height:0;';
    pane.appendChild(selDiv);
    const onMove = mv => {
      didDrag = true;
      const pr  = pane.getBoundingClientRect();
      const st  = pane.scrollTop;
      const cx  = mv.clientX - pr.left + st;
      const cy  = mv.clientY - pr.top  + st;
      const left = Math.min(sx, cx), top = Math.min(sy, cy);
      const w    = Math.abs(cx - sx),  h  = Math.abs(cy - sy);
      selDiv.style.left = left + 'px'; selDiv.style.top  = top  + 'px';
      selDiv.style.width = w   + 'px'; selDiv.style.height = h  + 'px';
      const sr = { left, top, right: left + w, bottom: top + h };
      let changed = false;
      pane.querySelectorAll(ITEM_SEL).forEach(el => {
        const key = el._selKey;
        if (!key) return;
        const er = el.getBoundingClientRect();
        const el_l = er.left   - pr.left + st;
        const el_t = er.top    - pr.top  + st;
        const el_r = er.right  - pr.left + st;
        const el_b = er.bottom - pr.top  + st;
        const hit = sr.left < el_r && sr.right > el_l && sr.top < el_b && sr.bottom > el_t;
        if (hit && !selectedKeys.has(key)) { selectedKeys.add(key); changed = true; }
        else if (!hit && !e.ctrlKey && selectedKeys.has(key)) { selectedKeys.delete(key); changed = true; }
      });
      if (changed) syncSelectionUi();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      document.body.style.userSelect = '';
      selDiv.remove();
      if (didDrag) window.addEventListener('click', e2 => e2.stopPropagation(), { once: true, capture: true });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });

  let selected = null;
  let viewMode = 'icons';
  let selectedKeys = new Set();
  let selectionItems = new Map();
  let selectionNodes = new Map();
  let emptyStatusText = '';

  function doMoveItem(srcItem, srcCwd, dstDirPath) {
    return moveShellItemToDir(srcItem, srcCwd, dstDirPath);
  }
  function doRecycleItem(srcItem, srcCwd) {
    return recycleShellItem(srcItem, srcCwd);
  }
  function doMovePayload(payload, dstDirPath) {
    return moveShellPayloadToDir(payload, dstDirPath);
  }
  function doRecyclePayload(payload) {
    return recycleShellPayload(payload);
  }
  function setExplorerStatus(text) {
    if (ws) ws.textContent = text;
  }
  const ITEM_SELECTOR = '.exp-item,.exp-list-item,.exp-det-item';

  function getIcon(name, kind) {
    return resolveFsIcon(name, kind);
  }

  function selectionKey(item) {
    const recyclePart = item._recycle?.id ? '|recycle|' + item._recycle.id : '';
    const shortcutPart = item._shortcut?.target?.path ? '|shortcut|' + normalizeShortcutPath(item._shortcut.target.path) : '';
    const projectPart = item._proj?.file ? '|project|' + item._proj.file : '';
    return (item.sysfile ? '1' : '0') + '|' + item.kind + '|' + item.name + recyclePart + shortcutPart + projectPart;
  }

  function registerSelectionNode(el, item) {
    const key = selectionKey(item);
    selectionItems.set(key, item);
    selectionNodes.set(key, el);
    el._selKey = key;
  }

  function getSelectedItems() {
    return Array.from(selectedKeys).map(key => selectionItems.get(key)).filter(Boolean);
  }

  function getSingleSelectedItem() {
    const items = getSelectedItems();
    return items.length === 1 ? items[0] : null;
  }

  function getDeletableSelectedItems() {
    if (cwd === 'RECYCLE') return getSelectedItems().filter(item => !!item._recycle);
    return getSelectedItems().filter(item => !item._proj && canAttemptDeleteItem(makeFsPath(item.name), cwd, item));
  }

  function makeFsPath(name) {
    return cwd ? cwd + '\\' + name : name;
  }

  function getSelectedNamesText() {
    return getSelectedItems().map(item => item.name).join('\n');
  }

  function getSelectedPathsText() {
    return getSelectedItems().map(item => {
      if (item._recycle) return 'C:\\sleepOS\\' + recycleEntryOriginalPath(item._recycle);
      return 'C:\\sleepOS\\' + (cwd ? cwd + '\\' : '') + item.name;
    }).join('\n');
  }

  function updateSelectionStatus() {
    if (!ws) return;
    const items = getSelectedItems();
    if (!items.length) {
      ws.textContent = emptyStatusText;
      return;
    }
    if (items.length === 1) {
      ws.textContent = items[0]._proj ? items[0].name + '  \u2014  double-click to open' : items[0].name;
      return;
    }
    ws.textContent = items.length + ' objects selected';
  }

  function syncSelectionUi() {
    selectionNodes.forEach((node, key) => node.classList.toggle('selected', selectedKeys.has(key)));
    const items = getSelectedItems();
    if (selected && !selectedKeys.has(selectionKey(selected))) selected = null;
    if (!selected && items.length) selected = items[items.length - 1];
    updateSelectionStatus();
  }

  function clearSelection() {
    selectedKeys = new Set();
    selected = null;
    syncSelectionUi();
  }

  function replaceSelection(item) {
    selectedKeys = new Set([selectionKey(item)]);
    selected = item;
    syncSelectionUi();
  }

  function toggleSelection(item) {
    const key = selectionKey(item);
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
      if (selected && selectionKey(selected) === key) selected = null;
    } else {
      next.add(key);
      selected = item;
    }
    selectedKeys = next;
    if (!selected && selectedKeys.size) {
      const items = getSelectedItems();
      selected = items[items.length - 1] || null;
    }
    syncSelectionUi();
  }

  function selectAllVisibleItems() {
    selectedKeys = new Set(selectionItems.keys());
    selected = getSelectedItems()[0] || null;
    syncSelectionUi();
  }

  function invertSelection() {
    const next = new Set();
    selectionItems.forEach((_, key) => {
      if (!selectedKeys.has(key)) next.add(key);
    });
    selectedKeys = next;
    selected = getSelectedItems()[0] || null;
    syncSelectionUi();
  }

  function ensureContextSelection(item) {
    const key = selectionKey(item);
    if (!selectedKeys.has(key) || selectedKeys.size <= 1) replaceSelection(item);
    else {
      selected = item;
      syncSelectionUi();
    }
  }

  function renameItem(item) {
    if (!item || item.sysfile || item._proj) return;
    osPrompt('Rename to:', item.name, 'Rename', nextName => {
      if (!nextName || nextName === item.name) return;
      const dir = fsGetDir(cwd);
      if (!dir) return;
      if (item.kind === 'dir') {
        dir.dirs.delete(item.name);
        const sub = dir.subdirs?.get(item.name);
        dir.dirs.add(nextName.toUpperCase());
        if (!dir.subdirs) dir.subdirs = new Map();
        if (sub) dir.subdirs.set(nextName.toUpperCase(), sub);
        dir.subdirs.delete(item.name);
      } else if (dir.blobs.has(item.name)) {
        const blob = dir.blobs.get(item.name);
        dir.blobs.delete(item.name);
        dir.blobs.set(nextName, blob);
        renameBlobEntry(cwd, item.name, nextName);
        if (blob?.kind === 'image') handleWallpaperFileRename(cwd, item.name, nextName);
      } else {
        const content = dir.files.get(item.name);
        dir.files.delete(item.name);
        dir.files.set(nextName, content ?? '');
      }
      increaseDriveFragmentation(item.kind === 'dir' ? 0.006 : 0.008);
      schedSave();
      document.dispatchEvent(new CustomEvent('fs-changed'));
      render();
    });
  }

  function getSelectedRecycleEntries() {
    return getSelectedItems().map(item => normalizeRecycleEntry(item._recycle)).filter(Boolean);
  }

  function restoreSelectedRecycleEntries() {
    const entries = getSelectedRecycleEntries();
    if (!entries.length) return;
    const blocked = [];
    let restoredCount = 0;
    entries.forEach(entry => {
      const result = restoreRecycleEntry(entry);
      if (result.ok && result.restored) restoredCount++;
      else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
    });
    if (blocked.length) osAlert(blocked[0], 'Recycle Bin', '⚠️');
    if (restoredCount && ws) ws.textContent = restoredCount === 1 ? '1 item restored' : restoredCount + ' items restored';
    if (restoredCount || blocked.length) render();
  }

  function openItem(name, kind, sysfile) {
    const item = name && typeof name === 'object' ? name : { name, kind, sysfile };
    name = item.name;
    kind = item.kind;
    sysfile = item.sysfile;
    if (item._recycle) {
      const result = restoreRecycleEntry(item._recycle);
      if (!result.ok) osAlert([result.message, ...(result.details || [])].filter(Boolean).join('\n'), 'Recycle Bin', '⚠️');
      else if (ws) ws.textContent = 'Restored: ' + result.name;
      render();
      return;
    }
    if (isRecycleBinItemName(name)) {
      openRecycleBin();
      return;
    }
    if (item._shortcut) {
      openDesktopShortcutTarget(item._shortcut.target);
      return;
    }
    if (kind === 'dir') {
      cwd = makeFsPath(name);
      render();
      return;
    }
    if (cwd === 'PROJECTS') {
      const project = PROJECTS.find(p => p.name === name);
      if (project) {
        const url = /^https?:\/\//.test(project.file) ? project.file : 'https://' + project.file;
        window.open(url, '_blank');
      }
      return;
    }
    if (cwd === 'DESKTOP') {
      if (item._shortcut) {
        openDesktopShortcutTarget(item._shortcut.target);
        return;
      }
      if (sysfile) {
        openSystemFile(name);
        return;
      }
    }
    if (sysfile) {
      openSystemFile(name);
      return;
    }
    const dir = fsGetDir(cwd);
    if (!dir) return;
    if (dir.blobs.has(name)) openMediaFile(name, cwd);
    else if (dir.files.has(name)) openNotepad(name, cwd);
  }

  function deleteSelected() {
    const items = getDeletableSelectedItems();
    if (!items.length) return;
    const recycleView = cwd === 'RECYCLE';
    const prompt = recycleView
      ? (items.length === 1 ? 'Permanently delete "' + items[0].name + '"?' : 'Permanently delete ' + items.length + ' selected items?')
      : (items.length === 1 ? 'Delete "' + items[0].name + '"?' : 'Delete ' + items.length + ' selected items?');
    osConfirm(prompt, recycleView ? 'Delete Permanently' : 'Delete', ok => {
      if (!ok) return;
      const blocked = [];
      let changed = false;
      if (recycleView) {
        items.forEach(item => {
          const result = purgeRecycleEntry(item._recycle);
          if (result.ok && result.deleted) changed = true;
          else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
        });
        if (blocked.length) osAlert(blocked[0], 'Recycle Bin', '⚠️');
        if (changed && ws) ws.textContent = items.length === 1 ? '1 item deleted permanently' : items.length + ' items deleted permanently';
        if (changed || blocked.length) render();
        return;
      }
      items.forEach(item => {
        if (item._shortcut) {
          const scIdx = customDesktopIcons.indexOf(item._shortcut);
          if (scIdx > -1) {
            customDesktopIcons.splice(scIdx, 1);
            saveDesktopShortcuts();
            delete iconPositions[item.name];
            saveIconPositions();
            changed = true;
            return;
          }
        }
        const result = deleteVirtualPath(makeFsPath(item.name), cwd);
        if (result.ok && result.deleted) changed = true;
        else if (!result.ok) blocked.push([result.message, ...(result.details || [])].filter(Boolean).join('\n'));
      });
      if (blocked.length) osAlert(blocked[0], 'Delete', '⚠️');
      if (changed || blocked.length) document.dispatchEvent(new CustomEvent('fs-changed'));
      render();
    }, '\u{1F5D1}\uFE0F');
  }

  function typeLabel(kind) {
    return kind === 'dir' ? 'File Folder' : kind === 'image' ? 'Image File' :
           kind === 'video' ? 'Video File' : kind === 'audio' ? 'Audio File' :
           kind === 'binary' ? 'Binary File' : 'Text File';
  }

  function makeItem(name, kind, sysfile, meta) {
    const item = { name, kind, sysfile, ...(meta || {}) };
    const icon = getIcon(name, kind);
    const isRecycleEntry = !!item._recycle;
    const isRecycleBin = !!item.recycleBin || isRecycleBinItemName(name);
    const isDesktopRootDir = !cwd && kind === 'dir' && sysfile && name === 'DESKTOP';
    let el;
    if (viewMode === 'list') {
      el = document.createElement('div');
      el.className = 'exp-list-item' + (sysfile ? ' exp-sysfile' : '');
      el.innerHTML = '<span style="font-size:14px;width:18px;flex-shrink:0;text-align:center;">' + icon + '</span><span>' + iconLabel(name) + '</span>';
    } else if (viewMode === 'details') {
      el = document.createElement('tr');
      el.className = 'exp-det-item' + (sysfile ? ' exp-sysfile' : '');
      el.innerHTML = '<td style="font-size:12px;width:22px;">' + icon + '</td><td>' + iconLabel(name) + '</td><td>' + typeLabel(kind) + '</td>';
    } else {
      el = document.createElement('div');
      el.className = 'exp-item' + (sysfile ? ' exp-sysfile' : '');
      el.innerHTML = '<div class="exp-icon">' + icon + '</div><span>' + iconLabel(name) + '</span>';
    }
    registerSelectionNode(el, item);
    el.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey) toggleSelection(item);
      else replaceSelection(item);
    });
    el.addEventListener('dblclick', () => openItem(item));
    // Touch: single tap opens, long-press shows context menu
    addLongPress(el);
    let _tapX, _tapY, _tapT;
    el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { _tapX = e.clientX; _tapY = e.clientY; _tapT = Date.now(); } });
    el.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse' && !_longPressActive && Date.now() - _tapT < 400 && Math.abs(e.clientX - _tapX) < 10 && Math.abs(e.clientY - _tapY) < 10) openItem(item);
      _longPressActive = false;
    });

    // ── Drag source ──────────────────────────────────────────────
    const canDragItem = !isRecycleEntry && !item._proj && (!sysfile || isDesktopVirtualItem(item, cwd) || !!item._shortcut);
    if (canDragItem) {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', e => {
        const key = selectionKey(item);
        const dragItems = selectedKeys.has(key) ? getSelectedItems() : [item];
        if (!selectedKeys.has(key) || dragItems.length <= 1) replaceSelection(item);
        setShellDragPayload(buildShellDragPayload(item, cwd, 'explorer', { sourceId: id, items: dragItems }));
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', name);
        el.style.opacity = '0.5';
      });
      el.addEventListener('dragend', () => {
        clearShellDragPayload();
        el.style.opacity = '';
        pane.querySelectorAll('.exp-drop-target').forEach(n => n.classList.remove('exp-drop-target'));
      });
    }
    // ── Drag target (folders + recycle bin) ─────────────────────
    if ((kind === 'dir' && (!sysfile || isDesktopRootDir)) || isRecycleBin) {
      el._shellDropHandler = payload => {
        if (!payload || shellDragIncludesItem(payload, item)) return false;
        if (isRecycleBin) {
          const ok = doRecyclePayload(payload);
          if (!ok) setExplorerStatus('Move failed.');
          if (ok) render();
          return ok;
        }
        if (isDesktopRootDir && fsNormalizeDir(payload.srcCwd) === 'DESKTOP') return false;
        const dstPath = isDesktopRootDir ? 'DESKTOP' : (cwd ? cwd + '\\' + name : name);
        if (!canMoveShellPayloadToDir(payload, dstPath)) return false;
        const ok = doMovePayload(payload, dstPath);
        if (!ok) setExplorerStatus('Move failed.');
        if (ok) render();
        return ok;
      };
      el.addEventListener('dragover', e => {
        const payload = getShellDragPayload();
        if (!payload || shellDragIncludesItem(payload, item)) return;
        const dstPath = isDesktopRootDir ? 'DESKTOP' : (cwd ? cwd + '\\' + name : name);
        const canDrop = isRecycleBin
          ? canRecycleShellPayload(payload)
          : fsNormalizeDir(payload.srcCwd) === dstPath ? false : canMoveShellPayloadToDir(payload, dstPath);
        if (!canDrop) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('exp-drop-target');
      });
      el.addEventListener('dragleave', () => el.classList.remove('exp-drop-target'));
      el.addEventListener('drop', e => {
        el.classList.remove('exp-drop-target');
        const payload = getShellDragPayload();
        if (!payload || shellDragIncludesItem(payload, item)) return;
        e.preventDefault();
        e.stopPropagation();
        if (el._shellDropHandler(payload)) clearShellDragPayload();
      });
    }

    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      ensureContextSelection(item);
      const allSelected = getSelectedItems();
      const singleSelected = getSingleSelectedItem();
      const recycleSelected = getSelectedRecycleEntries();
      const multi = allSelected.length > 1;
      const canDelete = getDeletableSelectedItems().length > 0;
      const mutableSelected = allSelected.filter(i => !i.sysfile && !i._recycle && !i._shortcut);
      const isScript = !!singleSelected && !singleSelected.sysfile && !singleSelected._recycle && !singleSelected._shortcut && singleSelected.name.toLowerCase().endsWith('.script');
      const canSetWallpaper = !!singleSelected && !singleSelected.sysfile && !singleSelected._recycle && !singleSelected._shortcut && singleSelected.kind === 'image';
      const isLoreFile = !!singleSelected && !singleSelected._recycle && ['daemon.core','void.tmp'].includes(singleSelected.name);
      const isExeFile  = !!singleSelected && !singleSelected._recycle && !singleSelected._shortcut && singleSelected.name.toLowerCase().endsWith('.exe');
      if (singleSelected && !multi && (singleSelected.recycleBin || isRecycleBinItemName(singleSelected.name)) && !singleSelected._recycle) {
        showCtxMenu(e.clientX, e.clientY, [
          { label: 'Open', action: openRecycleBin },
          '-',
          { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
          '-',
          { label: 'Copy Name', action: () => navigator.clipboard?.writeText(singleSelected.name) },
        ]);
        return;
      }
      if (recycleSelected.length && allSelected.every(i => i._recycle)) {
        showCtxMenu(e.clientX, e.clientY, [
          { label: multi ? 'Restore Selected' : 'Restore', action: restoreSelectedRecycleEntries },
          { label: multi ? 'Delete Permanently' : 'Delete Permanently', action: deleteSelected },
          '-',
          { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
          '-',
          { label: 'Copy Name', action: () => navigator.clipboard?.writeText(getSelectedNamesText() || name) },
        ]);
        return;
      }
      showCtxMenu(e.clientX, e.clientY, [
        multi
          ? { label: 'Open All (' + allSelected.length + ')', action: () => allSelected.forEach(openItem) }
          : { label: kind === 'dir' ? 'Open Folder' : 'Open', action: () => openItem(item) },
        ...(isLoreFile ? [{ label: 'Open in Notepad', action: () => openNotepad(singleSelected.name) }] : []),
        ...(isExeFile  ? [{ label: 'Open in Decompiler', action: () => openDecompilerView(singleSelected.name) }] : []),
        ...(canSetWallpaper ? [{ label: 'Set as Wallpaper', action: () => applyWallpaper(makeFsPath(singleSelected.name)) }] : []),
        ...(isScript ? [{ label: 'Run Script', action: () => {
          runScriptInTerminal(singleSelected.name, cwd);
        }}] : []),
        '-',
        { label: 'Cut',   disabled: !mutableSelected.length || cwd === 'RECYCLE', action: () => { if (mutableSelected.length) { _expClipboard = { items: mutableSelected.map(i => ({ name:i.name, kind:i.kind, srcCwd:cwd })), cut:true }; if (ws) ws.textContent = mutableSelected.length + ' item(s) cut'; } } },
        { label: 'Copy',  disabled: !mutableSelected.length || cwd === 'RECYCLE', action: () => { if (mutableSelected.length) { _expClipboard = { items: mutableSelected.map(i => ({ name:i.name, kind:i.kind, srcCwd:cwd })), cut:false }; if (ws) ws.textContent = mutableSelected.length + ' item(s) copied'; } } },
        '-',
        { label: 'Rename', disabled: !singleSelected || !!singleSelected.sysfile || !!singleSelected._recycle || !!singleSelected._shortcut || cwd === 'RECYCLE', action: () => renameItem(singleSelected) },
        { label: 'Delete', disabled: !canDelete, action: deleteSelected },
        '-',
        { label: 'Copy Name', action: () => navigator.clipboard?.writeText(getSelectedNamesText() || name) },
      ]);
    });
    return el;
  }

  function makeProjectItem(project) {
    const item = { name: project.name, kind: 'file', sysfile: true, _proj: project };
    const openProject = () => window.open(/^https?:\/\//.test(project.file) ? project.file : 'https://' + project.file, '_blank');
    let el;
    if (viewMode === 'details') {
      el = document.createElement('tr');
      el.className = 'exp-det-item';
      el.innerHTML = '<td style="font-size:12px;width:22px;">' + project.emoji + '</td><td>' + project.name + '</td><td>HTML Application</td>';
    } else if (viewMode === 'list') {
      el = document.createElement('div');
      el.className = 'exp-list-item';
      el.innerHTML = '<span style="font-size:14px;width:18px;flex-shrink:0;text-align:center;">' + project.emoji + '</span><span>' + project.name + '</span>';
    } else {
      el = document.createElement('div');
      el.className = 'exp-item';
      el.innerHTML = '<div class="exp-icon">' + project.emoji + '</div><span>' + project.name + '</span>';
    }
    registerSelectionNode(el, item);
    el.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey) toggleSelection(item);
      else replaceSelection(item);
    });
    el.addEventListener('dblclick', openProject);
    el.addEventListener('touchend', e => { e.preventDefault(); openProject(); }, { passive: false });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      ensureContextSelection(item);
      showCtxMenu(e.clientX, e.clientY, [
        { label: 'Open', action: openProject },
        '-',
        { label: 'Properties', action: () => osAlert('Name:\t' + project.name + '\nFile:\t' + project.file + '\nType:\tHTML Application\nLocation:\tC:\\sleepOS\\PROJECTS\\', 'Properties', '??') },
        '-',
        { label: 'Copy Name', action: () => navigator.clipboard?.writeText(getSelectedNamesText() || project.name) },
      ]);
    });
    return el;
  }

  function render() {
    pane.innerHTML = '';
    selected = null;
    selectedKeys = new Set();
    selectionItems = new Map();
    selectionNodes = new Map();
    const fullPath = cwd ? 'C:\\sleepOS\\' + cwd : 'C:\\sleepOS';
    addrEl.value = fullPath;
    const titleEl = document.getElementById('wtitle-' + id);
    if (titleEl) titleEl.textContent = 'FILE EXPLORER ? ' + fullPath;

    if (cwd === 'PROJECTS') {
      const build = fn => {
        if (viewMode === 'details') {
          const tbl = document.createElement('table');
          tbl.className = 'exp-det-tbl';
          tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
          const tbody = document.createElement('tbody');
          PROJECTS.forEach(project => tbody.appendChild(fn(project)));
          tbl.appendChild(tbody);
          pane.appendChild(tbl);
        } else if (viewMode === 'list') {
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;';
          PROJECTS.forEach(project => list.appendChild(fn(project)));
          pane.appendChild(list);
        } else {
          const grid = document.createElement('div');
          grid.className = 'exp-grid';
          PROJECTS.forEach(project => grid.appendChild(fn(project)));
          pane.appendChild(grid);
        }
      };
      build(makeProjectItem);
      emptyStatusText = PROJECTS.length + ' objects';
      updateSelectionStatus();
      return;
    }

    if (cwd === 'RECYCLE') {
      const recycleItems = recycleBinEntries.map(entry => ({
        name: entry.name,
        kind: entry.kind,
        sysfile: false,
        _recycle: entry,
      }));
      const build = items => {
        if (viewMode === 'details') {
          const tbl = document.createElement('table');
          tbl.className = 'exp-det-tbl';
          tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
          const tbody = document.createElement('tbody');
          items.forEach(item => tbody.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          tbl.appendChild(tbody);
          pane.appendChild(tbl);
        } else if (viewMode === 'list') {
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;';
          items.forEach(item => list.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(list);
        } else {
          const grid = document.createElement('div');
          grid.className = 'exp-grid';
          items.forEach(item => grid.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(grid);
        }
        if (!items.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:12px;font-size:11px;color:#444;';
          empty.textContent = 'Recycle Bin is empty.';
          pane.appendChild(empty);
        }
      };
      build(recycleItems);
      emptyStatusText = recycleItems.length ? recycleItems.length + ' objects' : 'Recycle Bin is empty';
      updateSelectionStatus();
      return;
    }

    if (cwd === 'DESKTOP') {
      const desktopItems = getVisibleDesktopIcons().map(ic => ({
        name: ic.name,
        kind: ic.recycleBin ? 'dir' : 'file',
        sysfile: true,
        recycleBin: !!ic.recycleBin,
      }));
      getDesktopShortcutsForDir('DESKTOP').forEach(ic => desktopItems.push({
        name: ic.name,
        kind: ic.target.kind === 'dir' ? 'dir' : 'file',
        sysfile: false,
        _shortcut: ic,
      }));
      const desktopDir = fsGetDir('DESKTOP');
      if (desktopDir) {
        desktopDir.dirs.forEach(name => desktopItems.push({ name, kind: 'dir', sysfile: false }));
        desktopDir.files.forEach((_, name) => desktopItems.push({ name, kind: 'file', sysfile: false }));
        desktopDir.blobs.forEach((blob, name) => desktopItems.push({ name, kind: blob.kind || inferBlobKindFromName(name), sysfile: false }));
      }
      const build = items => {
        if (viewMode === 'details') {
          const tbl = document.createElement('table');
          tbl.className = 'exp-det-tbl';
          tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
          const tbody = document.createElement('tbody');
          items.forEach(item => tbody.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          tbl.appendChild(tbody);
          pane.appendChild(tbl);
        } else if (viewMode === 'list') {
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;';
          items.forEach(item => list.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(list);
        } else {
          const grid = document.createElement('div');
          grid.className = 'exp-grid';
          items.forEach(item => grid.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
          pane.appendChild(grid);
        }
      };
      build(desktopItems);
      emptyStatusText = desktopItems.length + ' objects';
      updateSelectionStatus();
      return;
    }

    const items = [];
    if (!cwd) {
      items.push({ name:'DESKTOP', kind:'dir', sysfile:true });
      items.push({ name:'PROJECTS', kind:'dir', sysfile:true });
      ['DOCS', ...termFS.dirs].filter((value, index, array) => array.indexOf(value) === index).forEach(dirName => {
        if (dirName !== 'PROJECTS' && dirName !== 'DESKTOP') items.push({ name:dirName, kind:'dir', sysfile:false });
      });
      termFS.files.forEach((_, name) => items.push({ name, kind:'file', sysfile:false }));
      termFS.blobs.forEach((blob, name) => items.push({ name, kind:blob.kind, sysfile:false }));
    } else {
      const dir = fsGetDir(cwd);
      if (!dir) {
        cwd = '';
        render();
        return;
      }
      if (cwd.startsWith('DESKTOP\\')) {
        getDesktopSystemIconsForDir(cwd).forEach(ic => items.push({
          name: ic.name,
          kind: ic.recycleBin ? 'dir' : 'file',
          sysfile: true,
          recycleBin: !!ic.recycleBin,
        }));
        getDesktopShortcutsForDir(cwd).forEach(ic => items.push({
          name: ic.name,
          kind: ic.target.kind === 'dir' ? 'dir' : 'file',
          sysfile: false,
          _shortcut: ic,
        }));
      }
      dir.dirs.forEach(name => {
        if (cwd === 'CACHE' && name === 'RECYCLE_BIN') return;
        items.push({ name, kind:'dir', sysfile:false });
      });
      dir.files.forEach((_, name) => items.push({ name, kind:'file', sysfile:false }));
      dir.blobs.forEach((blob, name) => items.push({ name, kind:blob.kind, sysfile:false }));
    }

    if (viewMode === 'details') {
      const tbl = document.createElement('table');
      tbl.className = 'exp-det-tbl';
      tbl.innerHTML = '<thead><tr><th style="width:22px"></th><th>Name</th><th>Type</th></tr></thead>';
      const tbody = document.createElement('tbody');
      items.forEach(item => tbody.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
      tbl.appendChild(tbody);
      pane.appendChild(tbl);
    } else if (viewMode === 'list') {
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;';
      items.forEach(item => list.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
      pane.appendChild(list);
    } else {
      const grid = document.createElement('div');
      grid.className = 'exp-grid';
      items.forEach(item => grid.appendChild(makeItem(item.name, item.kind, item.sysfile, item)));
      pane.appendChild(grid);
    }
    emptyStatusText = items.length + ' objects';
    updateSelectionStatus();
  }

  upBtn.addEventListener('click', () => {
    const i = cwd.lastIndexOf('\\');
    cwd = i >= 0 ? cwd.slice(0, i) : '';
    render();
  });
  refreshBtn.addEventListener('click', () => render());

  pane.addEventListener('click', e => {
    if (e.target.closest(ITEM_SELECTOR)) return;
    clearSelection();
  });
  pane._shellDropHandler = payload => {
    if (!payload || cwd === 'PROJECTS' || cwd === 'RECYCLE') return false;
    if (isDesktopSurfaceTransferBlocked(payload, cwd)) return false;
    if (!canMoveShellPayloadToDir(payload, cwd)) return false;
    const ok = doMovePayload(payload, cwd);
    if (!ok) setExplorerStatus('Move failed.');
    if (ok) render();
    return ok;
  };

  addLongPress(pane);
  pane.addEventListener('contextmenu', e => {
    if (e.target.closest(ITEM_SELECTOR)) return;
    e.preventDefault();
    clearSelection();
    const inProjects = cwd === 'PROJECTS';
    const inRecycle = cwd === 'RECYCLE';
    showCtxMenu(e.clientX, e.clientY, inProjects ? [
      { label: 'Refresh', action: render },
    ] : inRecycle ? [
      { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
      '-',
      { label: 'Refresh', action: render },
    ] : [
      { label: 'Open Terminal Here', action: () => openTerminal(cwd) },
      '-',
      { label: 'Paste', disabled: !_expClipboard, action: pasteClipboard },
      '-',
      { label: 'New Folder', action: () => promptCreateFolderAt(cwd, () => render()) },
      { label: 'New Text File', action: () => osPrompt('File name:', 'untitled.txt', 'New Text File', name => { if (name) { const saved = fsWriteTextFile(name, '', cwd); if (saved) { document.dispatchEvent(new CustomEvent('fs-changed')); openNotepad(name, cwd); render(); } } }) },
      '-',
      { label: 'Upload File...', action: () => triggerUpload(cwd) },
      '-',
      { label: 'Refresh', action: render },
    ]);
  });

  // ── External file drag-and-drop onto the pane ─────────────────
  let dropOverlay = null;
  pane.addEventListener('dragenter', e => {
    if (getShellDragPayload()) return;
    if (cwd === 'PROJECTS' || cwd === 'RECYCLE') return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      if (!dropOverlay) {
        dropOverlay = document.createElement('div');
        dropOverlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,128,0.12);border:2px dashed #000080;pointer-events:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#000080;font-weight:bold;z-index:10;';
        dropOverlay.textContent = 'Drop files to upload';
        pane.appendChild(dropOverlay);
      }
    }
  });
  pane.addEventListener('dragover', e => {
    if (!e.target.closest(ITEM_SELECTOR)) {
      const payload = getShellDragPayload();
      if (payload && pane._shellDropHandler && !isDesktopSurfaceTransferBlocked(payload, cwd) && canMoveShellPayloadToDir(payload, cwd)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        return;
      }
    }
    if (cwd === 'PROJECTS' || cwd === 'RECYCLE') return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  pane.addEventListener('dragleave', e => {
    if (!pane.contains(e.relatedTarget)) {
      dropOverlay?.remove(); dropOverlay = null;
    }
  });
  pane.addEventListener('drop', e => {
    dropOverlay?.remove(); dropOverlay = null;
    const payload = getShellDragPayload();
    if (payload && !e.target.closest(ITEM_SELECTOR)) {
      e.preventDefault();
      e.stopPropagation();
      if (pane._shellDropHandler(payload)) clearShellDragPayload();
      return;
    }
    if (e.dataTransfer.files?.length) {
      if (cwd === 'PROJECTS' || cwd === 'RECYCLE') return;
      e.preventDefault();
      e.stopPropagation();
      _uploadCwd = cwd;
      handleFileUpload(e.dataTransfer.files);
      render();
      return;
    }
    if (e.target.closest(ITEM_SELECTOR)) return;
  });

  mb.innerHTML = '';
  [
    { label: 'File', items: () => cwd === 'PROJECTS' ? [
      { label: 'Open', disabled: !selected, action: () => { if (selected?._proj) window.open(selected._proj.file, '_blank'); } },
      '-',
      { label: 'Close', action: () => closeWin(id) },
    ] : cwd === 'RECYCLE' ? [
      { label: 'Restore', disabled: !getSelectedRecycleEntries().length, action: restoreSelectedRecycleEntries },
      { label: 'Delete Permanently', disabled: !getSelectedRecycleEntries().length, action: deleteSelected },
      '-',
      { label: 'Empty Recycle Bin', disabled: !recycleBinEntries.length, action: () => confirmEmptyRecycleBin(() => render()) },
      '-',
      { label: 'Close', action: () => closeWin(id) },
    ] : [
      { label: 'New Folder', action: () => promptCreateFolderAt(cwd, () => render()) },
      { label: 'New Text File', action: () => osPrompt('File name:', 'untitled.txt', 'New Text File', name => { if (name) { const saved = fsWriteTextFile(name, '', cwd); if (saved) { document.dispatchEvent(new CustomEvent('fs-changed')); openNotepad(name, cwd); render(); } } }) },
      '-',
      { label: 'Open', disabled: !selected, action: () => { if (selected) openItem(selected); } },
      { label: 'Delete', disabled: !getDeletableSelectedItems().length, action: deleteSelected },
      '-',
      { label: 'Upload File...', action: () => triggerUpload(cwd) },
      '-',
      { label: 'Close', action: () => closeWin(id) },
    ]},
    { label: 'Edit', items: () => [
      { label: 'Cut',   disabled: !getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut).length || cwd==='PROJECTS' || cwd==='RECYCLE', action: () => { const its=getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut); _expClipboard={items:its.map(i=>({name:i.name,kind:i.kind,srcCwd:cwd})),cut:true}; if(ws) ws.textContent=its.length+' item(s) cut'; } },
      { label: 'Copy',  disabled: !getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut).length || cwd==='RECYCLE', action: () => { const its=getSelectedItems().filter(i=>!i.sysfile && !i._recycle && !i._shortcut); _expClipboard={items:its.map(i=>({name:i.name,kind:i.kind,srcCwd:cwd})),cut:false}; if(ws) ws.textContent=its.length+' item(s) copied'; } },
      { label: 'Paste', disabled: !_expClipboard || cwd==='PROJECTS' || cwd==='RECYCLE', action: pasteClipboard },
      '-',
      { label: 'Select All', action: () => selectAllVisibleItems() },
      { label: 'Invert Selection', action: () => invertSelection() },
      '-',
      { label: 'Copy Name', disabled: !getSelectedItems().length, action: () => {
        const text = getSelectedNamesText();
        if (!text) return;
        navigator.clipboard?.writeText(text);
        if (ws) ws.textContent = 'Copied';
      }},
      { label: 'Copy Path', disabled: !getSelectedItems().length, action: () => {
        const text = getSelectedPathsText();
        if (!text) return;
        navigator.clipboard?.writeText(text);
        if (ws) ws.textContent = 'Copied';
      }},
      '-',
      { label: 'Rename', disabled: !getSingleSelectedItem() || getSingleSelectedItem()?.sysfile || getSingleSelectedItem()?._recycle || getSingleSelectedItem()?._shortcut || cwd === 'PROJECTS' || cwd === 'RECYCLE', action: () => renameItem(getSingleSelectedItem()) },
      { label: 'Delete', disabled: !getDeletableSelectedItems().length || cwd === 'PROJECTS', action: deleteSelected },
    ]},
    { label: 'View', items: () => [
      { label: (viewMode === 'icons' ? '* ' : '  ') + 'Large Icons', action: () => { viewMode = 'icons'; render(); } },
      { label: (viewMode === 'list' ? '* ' : '  ') + 'List', action: () => { viewMode = 'list'; render(); } },
      { label: (viewMode === 'details' ? '* ' : '  ') + 'Details', action: () => { viewMode = 'details'; render(); } },
      '-',
      { label: 'Refresh', action: render },
    ]},
  ].forEach(({ label, items }) => {
    const span = document.createElement('span');
    span.className = 'menu-item';
    span.textContent = label;
    span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, items()); });
    mb.appendChild(span);
  });

  // ── Paste helper ─────────────────────────────────────────────
  // Shared with the desktop; see pasteClipboardInto in os/fs-core.js.
  function pasteClipboard() {
    if (pasteClipboardInto(cwd)) render();
  }

  // ── Explorer keyboard shortcuts ───────────────────────────────
  pane.setAttribute('tabindex', '-1');
  pane.style.outline = 'none';
  const winEl = document.getElementById('win-' + id);
  winEl?.addEventListener('keydown', e => {
    if (!wins[id]) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const items = getSelectedItems().filter(i => !i.sysfile && !i._proj && !i._recycle && !i._shortcut);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      if (cwd === 'RECYCLE') return;
      if (!items.length) return;
      _expClipboard = { items: items.map(i => ({ name: i.name, kind: i.kind, sysfile: i.sysfile, srcCwd: cwd })), cut: false };
      if (ws) ws.textContent = items.length === 1 ? '"' + items[0].name + '" copied' : items.length + ' items copied';
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      if (cwd === 'RECYCLE') return;
      if (!items.length) return;
      _expClipboard = { items: items.map(i => ({ name: i.name, kind: i.kind, sysfile: i.sysfile, srcCwd: cwd })), cut: true };
      if (ws) ws.textContent = items.length === 1 ? '"' + items[0].name + '" cut' : items.length + ' items cut';
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteClipboard();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAllVisibleItems();
    } else if (e.key === 'Delete' || e.key === 'Backspace' && e.altKey) {
      e.preventDefault();
      if (getDeletableSelectedItems().length) deleteSelected();
    } else if (e.key === 'F2') {
      e.preventDefault();
      const single = getSingleSelectedItem();
      if (single && !single.sysfile && !single._recycle && !single._shortcut && cwd !== 'RECYCLE') renameItem(single);
    } else if (e.key === 'F5') {
      e.preventDefault();
      render();
    } else if (e.key === 'Escape') {
      clearSelection();
    }
  });

  render();

  function onFsChanged() {
    if (wins[id]) render();
    else document.removeEventListener('fs-changed', onFsChanged);
  }
  document.addEventListener('fs-changed', onFsChanged);
}

function openFiles() { openExplorer('PROJECTS'); }


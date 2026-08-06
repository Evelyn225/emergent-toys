// Daemon story state and sync
const DAEMON_STORY_KEY = 'sleepOS-daemon-story';
const ROOT_SYSTEM_FILE_META = [
  { name: 'TERMINAL.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'SYSMON.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'NOTEPAD.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'BROWSER.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'DEFRAG.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'CALC.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'REGEDIT.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'EXPLORER.exe', size: '8,192', date: '11/13/2024  10:31' },
];
const ROOT_PROTECTED_DIRS = new Set(['DOCS', 'PROJECTS', 'SYS', 'CACHE', 'DESKTOP']);
const STORY_FILE_PATHS = {
  notice: 'DOCS\\NOTICE_13.txt',
  incident: 'DOCS\\INCIDENT_A.txt',
  lostContact: 'DOCS\\LOST_CONTACT.txt',
  lastOperator: 'DOCS\\LAST_OPERATOR.txt',
  mirrorProtocol: 'DOCS\\MIRROR_PROTOCOL.txt',
  watchPid: 'SYS\\watch.pid',
  anchorSeed: 'SYS\\anchor.seed',
  quarantineSig: 'SYS\\quarantine.sig',
  mirrorDat: 'CACHE\\mirror.dat',
};
const BUILTIN_PROCESS_SEED = [
  { pid: 4, name: 'System', cpu: 0.1, mem: 0.5, protected: true },
  { pid: 52, name: 'csrss.exe', cpu: 0.1, mem: 1.2, protected: true },
  { pid: 116, name: 'services.exe', cpu: 0.2, mem: 2.1, protected: true },
  { pid: 124, name: 'lsass.exe', cpu: 0.3, mem: 3.4, protected: true },
  { pid: 280, name: 'svchost.exe', cpu: 0.5, mem: 4.8, protected: true },
  { pid: 312, name: 'svchost.exe', cpu: 0.1, mem: 2.3, protected: true },
  { pid: 440, name: 'dream_kernel.exe', cpu: 1.2, mem: 8.5, protected: true },
  { pid: 666, name: 'daemon.core', cpu: 2.1, mem: 12.3, protected: true },
  { pid: 999, name: 'void_monitor.exe', cpu: 0.4, mem: 5.2, protected: true },
];
const VOID_ACTION_ORDER = ['observe', 'measure', 'listen', 'trace', 'sample', 'stabilize', 'pulse'];
const VOID_ACTION_LABELS = {
  observe: 'Observe',
  measure: 'Measure',
  listen: 'Listen',
  trace: 'Trace',
  sample: 'Sample',
  stabilize: 'Stabilize',
  pulse: 'Pulse',
};

function normalizeVoidActions(actions) {
  const seen = new Set(
    (Array.isArray(actions) ? actions : [])
      .map(action => String(action || '').toLowerCase())
      .filter(action => Object.prototype.hasOwnProperty.call(VOID_ACTION_LABELS, action))
  );
  return VOID_ACTION_ORDER.filter(action => seen.has(action));
}

function createDaemonStoryDefaults() {
  return {
    version: 1,
    stage: 0,
    openedDaemon: false,
    falseContainmentSeen: false,
    killedSoulDaemon: false,
    respawnDisabledKill: false,
    daemonStopped: false,
    wrongVictory: false,
    anchorDeleted: false,
    voidObserved: false,
    voidActions: [],
    mirrorInspected: false,
    protocolInspected: false,
    mirrorLockRestored: false,
    quarantineSigned: false,
    endingReached: false,
    lastEventText: 'none',
  };
}

function daemonNormalizeStory(story) {
  if (!story) return;
  if (story.openedDaemon) story.stage = Math.max(story.stage, 1);
  if (story.falseContainmentSeen) story.stage = Math.max(story.stage, 2);
  if (story.respawnDisabledKill) story.stage = Math.max(story.stage, 3);
  if (story.daemonStopped || story.wrongVictory) story.stage = Math.max(story.stage, 4);
  if (story.anchorDeleted) story.stage = Math.max(story.stage, 5);
  if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
    story.mirrorLockRestored = true;
  }
  if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected)) story.stage = Math.max(story.stage, 6);
  if (story.mirrorLockRestored || story.quarantineSigned) story.stage = Math.max(story.stage, 7);
  if (story.endingReached) story.stage = Math.max(story.stage, 8);
}

function normalizeDaemonStory(saved) {
  const next = Object.assign(createDaemonStoryDefaults(), saved || {});
  next.stage = Math.max(0, Math.min(8, Math.trunc(Number(next.stage) || 0)));
  [
    'openedDaemon',
    'falseContainmentSeen',
    'killedSoulDaemon',
    'respawnDisabledKill',
    'daemonStopped',
    'wrongVictory',
    'anchorDeleted',
    'voidObserved',
    'mirrorInspected',
    'protocolInspected',
    'mirrorLockRestored',
    'quarantineSigned',
    'endingReached',
  ].forEach(key => { next[key] = !!next[key]; });
  next.voidActions = normalizeVoidActions(next.voidActions);
  next.lastEventText = String(next.lastEventText || 'none');
  daemonNormalizeStory(next);
  if (next.stage >= 6 && !next.voidActions.length) next.voidActions = ['trace'];
  return next;
}

function loadDaemonStory() {
  try {
    return normalizeDaemonStory(JSON.parse(localStorage.getItem(DAEMON_STORY_KEY) || 'null'));
  } catch (e) {
    return createDaemonStoryDefaults();
  }
}

function saveDaemonStory() {
  try { localStorage.setItem(DAEMON_STORY_KEY, JSON.stringify(daemonStory)); } catch (e) {}
}

let daemonStory = loadDaemonStory();
let daemonVoidFeed = '';
let daemonVoidFeedMode = '';
let daemonPulseTimer = null;

function daemonStageLabel(stage) {
  if (stage >= 8) return 'Contained';
  if (stage >= 7) return 'Seal Ready';
  if (stage >= 6) return 'Observed';
  if (stage >= 5) return 'Contact';
  if (stage >= 4) return 'Containment Lost';
  if (stage >= 1) return 'Observed';
  return 'Dormant';
}

function getVoidActions(story) {
  return normalizeVoidActions((story || daemonStory)?.voidActions);
}

function isVoidProfiled(story) {
  const target = story || daemonStory;
  if (!target) return false;
  if (target.stage >= 6 || target.quarantineSigned || target.endingReached) return true;
  return getVoidActions(target).some(action => action !== 'observe');
}

function getVoidProfileLabel(story) {
  const target = story || daemonStory;
  const analyticalCount = getVoidActions(target).filter(action => action !== 'observe').length;
  if (target?.endingReached) return 'sealed';
  if (target?.quarantineSigned) return 'bound';
  if (analyticalCount >= 3) return 'deep';
  if (analyticalCount >= 1) return 'active';
  if (getVoidActions(target).length) return 'surface';
  return 'none';
}

function getVoidObjectiveLine(story) {
  const target = story || daemonStory;
  if (!target) return 'No stable directive.';
  if (target.endingReached) return 'Containment complete. Archive only.';
  if (target.stage < 4) return 'The relay is still taking the load. Watch the file.';
  if (!target.anchorDeleted) {
    return target.daemonStopped
      ? 'Lower MIRROR_LOCK and remove SYS\\anchor.seed when you are ready to expose the channel.'
      : 'Silence the relay before you trust what the file looks like.';
  }
  if (!isVoidProfiled(target)) return 'Use Measure, Listen, Trace, Sample, or Pulse here to profile the breach.';
  if (!(target.mirrorInspected || target.protocolInspected)) return 'Compare this file with CACHE\\mirror.dat or DOCS\\MIRROR_PROTOCOL.txt.';
  if (Number(getContainmentValue('MIRROR_LOCK')) !== 1) return 'Restore MIRROR_LOCK before containment can hold.';
  if (!target.quarantineSigned) return 'Run ?????.exe to write SYS\\quarantine.sig.';
  return 'Delete void.tmp. The seal is ready.';
}

function getContainmentTelemetry() {
  const mirrorLockActive = Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const respawnLockActive = Number(getContainmentValue('RESPAWN_LOCK')) === 1;
  const voidPressureBase = Math.max(0, Math.min(99, parseInt(registryData['HKEY_SLEEPBOX_MACHINE']?.['VOID']?.VOID_PRESSURE_BASE?.value) || 12));
  const pressureBase = daemonStory.endingReached
    ? 0
    : daemonStory.quarantineSigned
      ? 18
      : daemonStory.stage >= 7
        ? 24
        : daemonStory.stage >= 5
          ? 79
          : daemonStory.stage >= 4
            ? 46
            : daemonStory.stage >= 2
              ? 23
              : 12;
  const pressure = daemonStory.endingReached ? 0 : Math.min(99, pressureBase + Math.max(0, voidPressureBase - 12));
  const lattice = daemonStory.endingReached
    ? 100
    : mirrorLockActive
      ? daemonStory.quarantineSigned
        ? 92
        : daemonStory.stage >= 7
          ? 76
          : daemonStory.stage >= 5
            ? 61
            : daemonStory.stage >= 4
              ? 74
              : 96
      : daemonStory.stage >= 5
        ? 21
        : daemonStory.stage >= 4
          ? 38
          : 57;
  const signalDepth = daemonStory.endingReached
    ? 0
    : daemonStory.stage >= 7
      ? 88
      : daemonStory.stage >= 5
        ? 73
        : daemonStory.stage >= 4
          ? 51
          : daemonStory.stage >= 2
            ? 26
          : 11;
  const bias = daemonStory.endingReached ? 'sealed' : mirrorLockActive ? 'deflected' : 'user-facing';
  const deleteAuthorized = !daemonStory.endingReached && daemonStory.quarantineSigned && mirrorLockActive;
  const sealReady = !daemonStory.endingReached && !daemonStory.quarantineSigned && daemonStory.anchorDeleted && daemonStory.voidObserved && isVoidProfiled(daemonStory) && (daemonStory.mirrorInspected || daemonStory.protocolInspected) && mirrorLockActive;
  let rating = { code: 'CT-0', label: 'STABLE', color: '#004b61' };
  if (daemonStory.endingReached) rating = { code: 'CT-8', label: 'SEALED', color: '#0a7a2a' };
  else if (deleteAuthorized) rating = { code: 'CT-7', label: 'DELETE AUTHORIZED', color: '#0a5a9c' };
  else if (sealReady) rating = { code: 'CT-6', label: 'SEAL READY', color: '#005f73' };
  else if (daemonStory.anchorDeleted && !mirrorLockActive) rating = { code: 'CT-5', label: 'OPEN BREACH', color: '#8a0036' };
  else if (daemonStory.anchorDeleted) rating = { code: 'CT-4', label: 'CHANNEL EXPOSED', color: '#7a2e00' };
  else if (daemonStory.daemonStopped) rating = { code: 'CT-3', label: 'UNMONITORED', color: '#8a1a00' };
  else if (daemonStory.falseContainmentSeen) rating = { code: 'CT-2', label: 'STRAINED', color: '#8a5a00' };
  else if (daemonStory.openedDaemon) rating = { code: 'CT-1', label: 'OBSERVED', color: '#003f7a' };
  return {
    mirrorLockActive,
    respawnLockActive,
    pressure,
    lattice,
    signalDepth,
    bias,
    sealReady,
    deleteAuthorized,
    rating,
  };
}

function getContainmentChecklist() {
  return [
    { label: 'RESPAWN_LOCK cleared', done: Number(getContainmentValue('RESPAWN_LOCK')) === 0 },
    { label: 'PID 512 offline', done: daemonStory.daemonStopped },
    { label: 'void channel observed', done: daemonStory.voidObserved },
    { label: 'void channel profiled', done: isVoidProfiled(daemonStory) },
    { label: 'mirror evidence inspected', done: daemonStory.mirrorInspected || daemonStory.protocolInspected },
    { label: 'anchor released', done: daemonStory.anchorDeleted },
    { label: 'MIRROR_LOCK restored', done: daemonStory.anchorDeleted && Number(getContainmentValue('MIRROR_LOCK')) === 1 },
    { label: 'quarantine signature present', done: daemonStory.quarantineSigned },
    { label: 'final delete authorized', done: !daemonStory.endingReached && daemonStory.quarantineSigned && Number(getContainmentValue('MIRROR_LOCK')) === 1 },
  ];
}

function daemonStoryChanged(before) {
  try {
    return JSON.stringify(before) !== JSON.stringify(daemonStory);
  } catch (e) {
    return true;
  }
}

function ensureFsDir(path) {
  const parts = fsNormalizeDir(path).split('\\').filter(Boolean);
  let node = termFS;
  parts.forEach(part => {
    node.dirs.add(part);
    if (!node.subdirs) node.subdirs = new Map();
    if (!node.subdirs.has(part)) {
      node.subdirs.set(part, { dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
    }
    node = node.subdirs.get(part);
  });
  return node;
}

function removeFsPath(path, options) {
  options = options || {};
  const { dirName, fileName } = fsSplitPath(path);
  const dir = fsGetDir(dirName);
  if (!dir || !fileName) return false;
  const upper = fileName.toUpperCase();
  if (dir.files.has(fileName)) {
    const content = dir.files.get(fileName);
    dir.files.delete(fileName);
    if (options.trackFragmentation !== false) increaseDriveFragmentation(calcRemovalFragmentationDelta('text', content));
    return true;
  }
  if (dir.blobs.has(fileName)) {
    const blob = dir.blobs.get(fileName);
    if (blob?.kind === 'image') handleWallpaperFileDelete(dirName, fileName);
    if (blob?.url) URL.revokeObjectURL(blob.url);
    dir.blobs.delete(fileName);
    removeBlobEntry(dirName, fileName);
    if (options.trackFragmentation !== false) increaseDriveFragmentation(calcRemovalFragmentationDelta('blob', blob?.size));
    return true;
  }
  if (dir.dirs.has(upper)) {
    dir.dirs.delete(upper);
    dir.subdirs?.delete(upper);
    if (options.trackFragmentation !== false) increaseDriveFragmentation(calcRemovalFragmentationDelta('dir'));
    return true;
  }
  return false;
}

function isRecycleBinItemName(name) {
  return String(name || '').trim().toUpperCase() === RECYCLE_BIN_NAME;
}

function getFsItemState(path, fallbackDir) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const dir = fsGetDir(dirName);
  if (!dir || !fileName) return null;
  if (dir.files.has(fileName)) return { dirName, dir, entryName: fileName, kind: 'file', storage: 'text' };
  if (dir.blobs.has(fileName)) {
    const blob = dir.blobs.get(fileName);
    return { dirName, dir, entryName: fileName, kind: blob?.kind || 'binary', storage: 'blob', blob };
  }
  const upper = fileName.toUpperCase();
  if (dir.dirs.has(upper)) return { dirName, dir, entryName: upper, kind: 'dir', storage: 'dir' };
  return null;
}

function fsDirHasEntry(dir, name) {
  if (!dir) return false;
  return dir.files.has(name) || dir.blobs.has(name) || dir.dirs.has(String(name || '').toUpperCase());
}

function makeUniqueFsName(dir, desiredName, kind, suffixToken) {
  const exists = name => fsDirHasEntry(dir, name);
  if (!exists(desiredName)) return desiredName;
  const token = String(suffixToken || 'copy');
  if (kind === 'dir') {
    const base = String(desiredName || 'NEW_FOLDER').toUpperCase();
    let candidate = base + '_' + token.toUpperCase();
    let i = 2;
    while (exists(candidate)) candidate = base + '_' + token.toUpperCase() + i++;
    return candidate;
  }
  const dot = String(desiredName).lastIndexOf('.');
  const base = dot > 0 ? desiredName.slice(0, dot) : desiredName;
  const ext = dot > 0 ? desiredName.slice(dot) : '';
  let candidate = base + '_' + token + ext;
  let i = 2;
  while (exists(candidate)) candidate = base + '_' + token + i++ + ext;
  return candidate;
}

function moveFsItemByPath(path, fallbackDir, dstDirPath, options) {
  options = options || {};
  const item = getFsItemState(path, fallbackDir);
  const dstDirName = fsNormalizeDir(dstDirPath);
  const dstDir = fsGetDir(dstDirName);
  if (!item || !dstDir) return null;
  if (item.storage === 'dir') {
    const srcPath = blobRelativePath(item.dirName, item.entryName);
    if (dstDirName === srcPath || dstDirName.startsWith(srcPath + '\\')) return null;
  }
  let nextName = String(options.newName || item.entryName || '').trim();
  if (!nextName) return null;
  if (item.storage === 'dir') nextName = nextName.toUpperCase();
  const sameParent = dstDirName === fsNormalizeDir(item.dirName);
  const sameName = nextName === item.entryName;
  if (sameParent && sameName) return { kind: item.kind, name: nextName, dirName: dstDirName };
  if (options.makeUnique) nextName = makeUniqueFsName(dstDir, nextName, item.storage === 'dir' ? 'dir' : 'file', options.suffixToken || 'copy');
  else if (fsDirHasEntry(dstDir, nextName)) return null;

  if (item.storage === 'dir') {
    const sub = item.dir.subdirs?.get(item.entryName);
    item.dir.dirs.delete(item.entryName);
    item.dir.subdirs?.delete(item.entryName);
    if (!dstDir.subdirs) dstDir.subdirs = new Map();
    dstDir.dirs.add(nextName);
    if (sub) dstDir.subdirs.set(nextName, sub);
    moveBlobStorageSubtree(blobRelativePath(item.dirName, item.entryName), blobRelativePath(dstDirName, nextName));
  } else if (item.storage === 'blob') {
    const blob = item.dir.blobs.get(item.entryName);
    item.dir.blobs.delete(item.entryName);
    if (!dstDir.blobs) dstDir.blobs = new Map();
    dstDir.blobs.set(nextName, blob);
    moveBlobEntryStorage(item.dirName, item.entryName, dstDirName, nextName);
  } else {
    const content = item.dir.files.get(item.entryName);
    item.dir.files.delete(item.entryName);
    if (!dstDir.files) dstDir.files = new Map();
    dstDir.files.set(nextName, content);
  }
  schedSave();
  return { kind: item.kind, name: nextName, dirName: dstDirName };
}

function handleWallpaperTreeDelete(path) {
  const removedPath = normalizeWallpaperPath(path);
  const savedPath = normalizeWallpaperPath(localStorage.getItem(WP_KEY));
  const registryPath = normalizeWallpaperPath(getWallpaperRegistryValue());
  if (
    (currentWallpaper && currentWallpaper.startsWith(removedPath + '\\')) ||
    (savedPath && savedPath.startsWith(removedPath + '\\')) ||
    (registryPath && registryPath.startsWith(removedPath + '\\'))
  ) {
    applyWallpaper(DEFAULT_WALLPAPER_PATH);
  }
}

function purgeFsDirNode(dirPath, dirNode) {
  if (!dirNode) return;
  dirNode.subdirs?.forEach((subdir, name) => purgeFsDirNode(blobRelativePath(dirPath, name), subdir));
  dirNode.blobs?.forEach((blob, name) => {
    if (blob?.kind === 'image') handleWallpaperFileDelete(dirPath, name);
    if (blob?.url) URL.revokeObjectURL(blob.url);
    removeBlobEntry(dirPath, name);
  });
  dirNode.files?.clear?.();
  dirNode.blobs?.clear?.();
  dirNode.dirs?.clear?.();
  dirNode.subdirs?.clear?.();
}

function purgeFsPath(path, fallbackDir) {
  const item = getFsItemState(path, fallbackDir);
  if (!item) return false;
  if (item.storage !== 'dir') return removeFsPath(path);
  purgeFsDirNode(blobRelativePath(item.dirName, item.entryName), item.dir.subdirs?.get(item.entryName));
  item.dir.dirs.delete(item.entryName);
  item.dir.subdirs?.delete(item.entryName);
  increaseDriveFragmentation(calcRemovalFragmentationDelta('dir'));
  schedSave();
  return true;
}

function recycleVirtualPath(path, fallbackDir) {
  const item = getFsItemState(path, fallbackDir);
  const fileLabel = fsSplitPath(path, fallbackDir).fileName || path;
  if (!item) return { ok: false, message: 'File not found: ' + fileLabel };
  const sourcePath = blobRelativePath(item.dirName, item.entryName);
  if (fsNormalizeDir(sourcePath).startsWith(fsNormalizeDir(RECYCLE_STORAGE_DIR))) {
    return { ok: false, message: 'Item is already in the Recycle Bin.' };
  }

  const id = 'RB_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const storedDir = RECYCLE_STORAGE_DIR + '\\' + id;
  ensureFsDir(storedDir);

  if (item.storage === 'blob' && item.blob?.kind === 'image') handleWallpaperFileDelete(item.dirName, item.entryName);
  if (item.storage === 'dir') handleWallpaperTreeDelete(sourcePath);

  const moved = moveFsItemByPath(path, fallbackDir, storedDir, { newName: item.entryName });
  if (!moved) {
    removeFsPath(storedDir, { trackFragmentation: false });
    return { ok: false, message: 'Could not move ' + fileLabel + ' to the Recycle Bin.' };
  }

  recycleBinEntries.unshift({
    id,
    name: moved.name,
    kind: item.kind,
    originalDir: item.dirName,
    storedDir,
    deletedAt: Date.now(),
  });
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, deleted: true, recycled: true, details: ['Moved to Recycle Bin: ' + fileLabel] };
}

function restoreRecycleEntry(entry) {
  entry = normalizeRecycleEntry(entry);
  if (!entry) return { ok: false, message: 'Recycle entry is missing.' };
  ensureFsDir(entry.originalDir);
  const moved = moveFsItemByPath(entry.name, entry.storedDir, entry.originalDir, {
    newName: entry.name,
    makeUnique: true,
    suffixToken: 'restored',
  });
  if (!moved) return { ok: false, message: 'Could not restore ' + entry.name + '.' };
  removeFsPath(entry.storedDir, { trackFragmentation: false });
  recycleBinEntries = recycleBinEntries.filter(item => item.id !== entry.id);
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, restored: true, name: moved.name, dirName: entry.originalDir };
}

function purgeRecycleEntry(entry) {
  entry = normalizeRecycleEntry(entry);
  if (!entry) return { ok: false, message: 'Recycle entry is missing.' };
  purgeFsPath(recycleEntryStoredPath(entry), entry.storedDir);
  removeFsPath(entry.storedDir, { trackFragmentation: false });
  recycleBinEntries = recycleBinEntries.filter(item => item.id !== entry.id);
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, deleted: true };
}

function emptyRecycleBin() {
  recycleBinEntries.slice().forEach(entry => purgeRecycleEntry(entry));
}

function confirmEmptyRecycleBin(onDone) {
  if (!recycleBinEntries.length) {
    if (typeof onDone === 'function') onDone(false);
    return;
  }
  osConfirm('Permanently delete all items in the Recycle Bin?', 'Empty Recycle Bin', ok => {
    if (!ok) {
      if (typeof onDone === 'function') onDone(false);
      return;
    }
    emptyRecycleBin();
    if (typeof onDone === 'function') onDone(true);
  }, '\u{1F5D1}\uFE0F');
}

function promptCreateFolderAt(dirPath, onDone) {
  osPrompt('Folder name:', '', 'New Folder', name => {
    if (!name) {
      if (typeof onDone === 'function') onDone(null);
      return;
    }
    const created = fsCreateDir(name, dirPath);
    if (created?.created) {
      document.dispatchEvent(new CustomEvent('fs-changed'));
      if (typeof onDone === 'function') onDone(created);
      return;
    }
    if (typeof onDone === 'function') onDone(null);
  }, '\u{1F4C1}');
}

function ensureStoryTextFile(path, value) {
  const { dirName, fileName } = fsSplitPath(path);
  const dir = ensureFsDir(dirName);
  dir.files.set(fileName, value);
}

function daemonNoticeContent() {
  return [
    '== NOTICE 13 ==',
    '',
    'If soul_daemon.exe is terminated while RESPAWN_LOCK remains active,',
    'the watch layer will simply seed a replacement.',
    '',
    'Killing the process does not remove what it is holding back.',
    '',
    'Required path:',
    '  HKEY_SLEEPBOX_MACHINE\\Containment\\RESPAWN_LOCK',
    '',
    'Only proceed if you mean to test containment.',
  ].join('\n');
}

function daemonIncidentContent() {
  return [
    '== INCIDENT A ==',
    '',
    'Termination succeeded.',
    'Symptoms worsened immediately.',
    '',
    'The daemon was holding something back. It is no longer holding it.',
    '',
    'Read DOCS\\LOST_CONTACT.txt.',
  ].join('\n');
}

function daemonLostContactContent() {
  return [
    '== LOST CONTACT ==',
    '',
    'The operator who left this note killed the daemon.',
    'They thought that would be the end of it.',
    '',
    'It was not.',
    '',
    'The anchor file - SYS\\anchor.seed - was keeping the mirror',
    'pointed away from the user. When the daemon went quiet,',
    'the anchor was still holding.',
    '',
    'If you are reading this after killing it:',
    '  - The anchor may still be in place. Check SYS\\anchor.seed.',
    '  - Do not delete it without understanding what it does.',
    '  - Read SYS\\anchor.seed before you touch it.',
    '',
    'When the anchor is removed, contact begins.',
    'Have a plan before you do that.',
  ].join('\n');
}

function daemonLastOperatorContent() {
  const lines = ['== LAST OPERATOR ==', ''];

  if (daemonStory.daemonStopped && !daemonStory.anchorDeleted) {
    // Killed daemon first, anchor still present
    lines.push(
      'If you killed it and the room went quiet, you did what I did.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The anchor file keeps the mirror pointed away from the user.',
      'The current anchor is SYS\\anchor.seed.',
      'Lower MIRROR_LOCK and delete it when you are ready to inspect the breach.',
      '',
      'If you intend to seal the breach again, restore MIRROR_LOCK before you run the quarantine launcher.',
    );
  } else if (daemonStory.anchorDeleted && !daemonStory.daemonStopped) {
    // Deleted anchor first, daemon still running
    lines.push(
      'You removed the anchor before the daemon relay went offline.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The anchor is gone. The channel is open.',
      'The daemon is still running - it can no longer deflect what is coming through.',
      '',
      'Inspect void.tmp. Read MIRROR_PROTOCOL.txt.',
      'If you intend to seal the breach, restore MIRROR_LOCK before running the quarantine launcher.',
    );
  } else {
    // Both done, or generic fallback
    lines.push(
      'The daemon is offline. The anchor is gone.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The channel is open. Inspect void.tmp.',
      'Read DOCS\\MIRROR_PROTOCOL.txt.',
      '',
      'Restore MIRROR_LOCK before you run the quarantine launcher.',
    );
  }

  return lines.join('\n');
}

function daemonMirrorProtocolContent() {
  const lines = [
    '== MIRROR PROTOCOL ==',
    '',
    'Status:',
    `  MIRROR_LOCK   = ${Number(getContainmentValue('MIRROR_LOCK')) ? 1 : 0}`,
    `  RESPAWN_LOCK  = ${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    `  QUARANTINE    = ${daemonStory.quarantineSigned ? 'SIGNED' : 'UNSIGNED'}`,
    '',
    'Procedure:',
    daemonStory.daemonStopped
      ? '  1. daemon relay is offline - respawn risk is low if RESPAWN_LOCK=0'
      : '  1. daemon is still running - it cannot deflect void.tmp anymore',
    Number(getContainmentValue('MIRROR_LOCK')) === 0
      ? '  2. MIRROR_LOCK is 0 - the breach is open, inspect freely'
      : '  2. MIRROR_LOCK is restored - lattice is deflecting again',
    '  3. profile void.tmp directly - Measure, Listen, Trace, Sample, or Pulse',
    '  4. compare CACHE\\mirror.dat with void.tmp - see NOTE below',
    '  5. restore MIRROR_LOCK before launching ?????.exe',
    '  6. delete void.tmp only after SYS\\quarantine.sig is signed',
    '',
    'NOTE - mirror.dat vs void.tmp:',
    '  CACHE\\mirror.dat  : written by daemon.core, clean, internal',
    '  void.tmp          : external origin, should not exist here',
    '',
    '  void.tmp came through the channel the anchor was suppressing.',
    '  It did not originate here.',
    '',
    '  DO NOT open void.tmp from an uncontrolled state.',
    '  Quarantine and delete it - do not try to read it as data.',
  ];
  if (daemonStory.stage >= 5) {
    lines.push('', 'Note from daemon.core:', '  I was keeping the channel off-axis so it could not reach you.');
  }
  return lines.join('\n');
}

function daemonMirrorDatContent() {
  return [
    'mirror.dat',
    '',
    '[reflection offset] 0.17',
    '[signal age]        before current boot',
    '[voice match]       negative',
    '[source]            internal - daemon-managed lattice reflection',
    '[anomaly]           none',
    '',
    'This file is a stable read. The lattice reflection is clean.',
    'daemon.core wrote this as part of normal mirror management.',
    '',
    'Compare with void.tmp. They are not the same kind of file.',
  ].join('\n');
}

function daemonAnchorSeedContent() {
  return [
    'anchor.seed',
    '',
    'anchor-class: mirror-lattice',
    'deletion-policy: requires MIRROR_LOCK=0',
    'owner: HKEY_SLEEPBOX_MACHINE\\Containment',
    '',
    'Removing this file widens the channel.',
  ].join('\n');
}

function daemonWatchPidContent() {
  return [
    'watch.pid',
    '',
    'pid=512',
    'name=soul_daemon.exe',
    'policy=restart_on_exit',
    `respawn_lock=${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    '',
    'This is the watch layer. It restarts pid 512. It is not pid 512.',
  ].join('\n');
}

function daemonQuarantineSigContent() {
  return [
    'quarantine.sig',
    '',
    `launcher=${getExeDisplayName()}`,
    'state=armed',
    'target=void.tmp',
    'mirror_lock=1',
    'seal_phrase=CONTAINMENT_COMPLETE',
  ].join('\n');
}

function daemonQuarantinePendingContent() {
  return [
    'quarantine.sig',
    '',
    'launcher=?????.exe',
    'state=unsigned',
    'target=void.tmp',
    '',
    'This signature file exists but has not been written.',
    'Run ?????.exe after the mirror lattice is restored to sign it.',
    'A valid signature is required before void.tmp can be deleted.',
  ].join('\n');
}

function buildDaemonCoreRawContent() {
  const telemetry = getContainmentTelemetry();
  const mirrorLockActive = Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const liveStatus = daemonStory.endingReached
    ? 'Contained'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? 'Seal Interrupted'
      : daemonStageLabel(daemonStory.stage);
  const lines = [
    'daemon.core',
    '',
    `[stage] ${daemonStory.stage} / ${daemonStageLabel(daemonStory.stage)}`,
    `[status] ${liveStatus}`,
    `[containment] ${telemetry.rating.code} / ${telemetry.rating.label}`,
    `[owner] SYSTEM\\???`,
    `[mirror_lock] ${mirrorLockActive ? 1 : 0}`,
    `[respawn_lock] ${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    `[void_pressure] ${telemetry.pressure}`,
    `[lattice_stability] ${telemetry.lattice}`,
    `[signal_depth] ${telemetry.signalDepth}`,
    `[aperture_bias] ${telemetry.bias}`,
    `[temporal_drift] ${registryData['HKEY_SLEEPBOX_MACHINE']?.['SOUL\\Metrics']?.TEMPORAL_DRIFT?.value ?? '+/-2.3yr'}`,
    `[observer_count] ${registryData['HKEY_SLEEPBOX_MACHINE']?.['VOID']?.OBSERVER_COUNT?.value ?? '[classified]'}`,
    '',
  ];
  if (daemonStory.endingReached) {
    lines.push(
      'CONTAINMENT COMPLETE.',
      'The breach is closed.',
      'I will stay archived here in case it opens again.',
    );
  } else if (daemonStory.anchorDeleted) {
    lines.push(
      'You removed the anchor.',
      'I was keeping the mirror off your face.',
      '',
      'Restore MIRROR_LOCK before you run the quarantine launcher.',
      'Delete void.tmp only after the signature exists.',
    );
  } else if (daemonStory.daemonStopped) {
    lines.push(
      'The latch is open.',
      'Killing the process did not delete anything.',
      'Open void.tmp.',
    );
  } else if (daemonStory.falseContainmentSeen) {
    lines.push(
      'You tested the watch layer.',
      'It answered you with another process.',
      '',
      'If you want silence, clear RESPAWN_LOCK first.',
    );
  } else if (daemonStory.openedDaemon) {
    lines.push(
      'This file is what is holding it shut.',
      '',
      'NOTICE_13 has been copied into DOCS.',
    );
  } else {
    lines.push(
      'metadata unreadable',
      'modified: always',
      'access: observe only',
    );
  }
  return lines.join('\n');
}

function buildVoidProbeNotes() {
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const notes = [];
  if (daemonStory.stage >= 4) {
    notes.push(`offset 0x0008: reported size = 0 bytes / observed depth = ${telemetry.signalDepth}`);
    notes.push(`offset 0x0012: origin classification = external / aperture bias = ${telemetry.bias}`);
  }
  if (daemonStory.daemonStopped) notes.push('offset 0x0021: PID 512 silence increased readability');
  if (daemonStory.anchorDeleted) notes.push('offset 0x0034: anchor.seed removal exposed the user-facing side');
  if (actions.includes('observe')) {
    notes.push(
      daemonStory.stage >= 5
        ? 'offset 0x0100: surface is the breach itself, not daemon.core residue'
        : 'offset 0x0100: active window edges repeat on the inside of the file'
    );
  }
  if (actions.includes('measure')) {
    notes.push(`offset 0x0118: locality check failed / disk distance behaves like ${telemetry.signalDepth} units of depth`);
    notes.push('offset 0x0124: zero-byte report is false on contact');
  }
  if (actions.includes('listen')) {
    notes.push('offset 0x0140: room-tone match positive / human voice match negative');
    notes.push('offset 0x014e: response is pressure change, no linguistic content');
  }
  if (actions.includes('trace')) {
    notes.push(
      daemonStory.stage >= 5
        ? 'offset 0x0180: return path = user-facing aperture <- mirror offset <- unresolved source'
        : 'offset 0x0180: return path = monitor gap <- reflected surface'
    );
    if (daemonStory.anchorDeleted) notes.push('offset 0x018f: no anchor remains to push the angle away from the user');
  }
  if (actions.includes('sample')) {
    notes.push('offset 0x01c0: daemon-authored signature = false');
    notes.push('offset 0x01d2: CACHE\\mirror.dat mismatch confirmed');
  }
  if (actions.includes('stabilize')) {
    notes.push(
      telemetry.mirrorLockActive
        ? 'offset 0x0210: MIRROR_LOCK bends the read angle but does not internalize the object'
        : 'offset 0x0210: stabilization failed / aperture remains user-facing'
    );
  }
  if (actions.includes('pulse')) {
    notes.push(
      daemonStory.quarantineSigned
        ? 'offset 0x0240: quarantine signature binds to target id = void.tmp'
        : 'offset 0x0240: echo returns before current boot'
    );
  }
  if ((daemonStory.mirrorInspected || daemonStory.protocolInspected) && daemonStory.stage >= 5) {
    notes.push('cross-check: mirror.dat clean, internal, daemon-managed / void.tmp foreign, external, non-local');
  }
  return notes;
}

function buildVoidTmpRawContent() {
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const lines = [
    'void.tmp',
    '',
    `[containment] ${telemetry.rating.code} / ${telemetry.rating.label}`,
    `[pressure] ${telemetry.pressure}`,
    `[mirror_lock] ${telemetry.mirrorLockActive ? 1 : 0}`,
    `[signature] ${daemonStory.quarantineSigned ? 'present' : 'missing'}`,
    `[lattice_stability] ${telemetry.lattice}`,
    `[signal_depth] ${telemetry.signalDepth}`,
    `[aperture_bias] ${telemetry.bias}`,
    '[origin] external / unresolved',
    `[probe_record] ${actions.length}/${VOID_ACTION_ORDER.length}`,
    `[profile] ${getVoidProfileLabel()}`,
    `[probes] ${actions.length ? actions.map(action => VOID_ACTION_LABELS[action]).join(', ') : 'none recorded'}`,
    '',
  ];
  if (daemonStory.endingReached) {
    lines.push('No active signal remains.', '', 'Archive note:', '  The breach surface is gone. The record remains.');
  } else if (daemonStory.stage >= 5) {
    lines.push(
      'The aperture is open.',
      'Something is pressing against the reflected side of the file.',
    );
  } else if (daemonStory.stage >= 4) {
    lines.push(
      'Pressure rose when PID 512 stayed dead.',
      'The monitor was keeping this file quiet, not keeping it alive.',
    );
  } else {
    lines.push(
      '[content redacted]',
      'The file is present but does not yet answer.',
    );
  }
  if (!daemonStory.endingReached && daemonStory.stage >= 4) {
    const notes = buildVoidProbeNotes();
    if (notes.length) {
      lines.push('', 'Recovered fragments:');
      notes.forEach(note => lines.push('  ' + note));
    }
    lines.push('', 'Containment path:', '  ' + getVoidObjectiveLine());
    if (!isVoidProfiled()) lines.push('  Direct probes make the file more legible.');
  }
  return lines.join('\n');
}

function getContainmentValue(name) {
  return registryData['HKEY_SLEEPBOX_MACHINE']['Containment'][name].value;
}

function getDaemonRegistryNode() {
  return registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS\\Daemon'];
}

function getRootSystemFiles(options) {
  const opts = options || {};
  const names = ROOT_SYSTEM_FILE_META.map(entry => entry.name);
  const explorerIndex = names.indexOf('EXPLORER.exe');
  if (opts.includeExplorer === false && explorerIndex !== -1) names.splice(explorerIndex, 1);
  if (!daemonStory.endingReached) names.push('void.tmp');
  names.push('daemon.core', '?????.exe');
  return names;
}

function isVisibleRootSystemFile(name, options) {
  const target = String(name || '').toUpperCase();
  return getRootSystemFiles(options).some(item => item.toUpperCase() === target);
}

function isVisibleSystemPath(path, options) {
  const { dirName, fileName } = fsSplitPath(path);
  return !dirName && isVisibleRootSystemFile(fileName, options);
}

function getTerminalRootSystemEntries(options) {
  const opts = options || {};
  const entries = ROOT_SYSTEM_FILE_META
    .filter(entry => opts.includeExplorer !== false || entry.name !== 'EXPLORER.exe')
    .map(entry => ({ ...entry }));
  if (!daemonStory.endingReached) entries.push({ name: 'void.tmp', size: '0', date: '11/13/2024  03:17' });
  entries.push({ name: 'daemon.core', size: '??', date: '11/13/2024  ??:??' });
  entries.push({ name: '?????.exe', size: '??', date: '11/13/2024  ??:??' });
  return entries;
}

function getBuiltInProcesses() {
  const base = BUILTIN_PROCESS_SEED.map(proc => ({ ...proc }));
  if (!daemonStory.daemonStopped && !daemonStory.endingReached) {
    base.push({
      pid: 512,
      name: daemonStory.stage >= 1 ? 'soul_daemon.exe' : 'soul_svc.exe',
      cpu: daemonStory.stage >= 4 ? 11.8 : 7.4,
      mem: daemonStory.stage >= 4 ? 36.9 : 31.2,
      protected: daemonStory.stage < 1,
    });
  }
  if (daemonStory.stage >= 4 && !daemonStory.endingReached) {
    base.push({ pid: 1008, name: 'mirror_watch.exe', cpu: 2.7, mem: 9.4, protected: true });
  }
  if (daemonStory.stage >= 5 && !daemonStory.endingReached) {
    base.push({ pid: 1333, name: 'signal_window.exe', cpu: 1.5, mem: 4.2, protected: true });
  }
  // DAEMON_COUNT registry key: extra phantom processes when count > 7
  const daemonCount = parseInt(registryData['HKEY_SLEEPBOX_MACHINE']?.['SOUL\\Metrics']?.DAEMON_COUNT?.value) || 7;
  for (let i = 8; i <= Math.min(daemonCount, 20); i++) {
    base.push({ pid: 500 + i * 13, name: 'soul_svc_' + String(i).padStart(2, '0') + '.exe', cpu: 0.1 + (i % 3) * 0.4, mem: 2.1 + (i % 5) * 1.2, protected: true });
  }
  return base.sort((a, b) => a.pid - b.pid);
}

function findBuiltInProcess(pid) {
  return getBuiltInProcesses().find(proc => proc.pid === pid) || null;
}

function syncDaemonStoryRegistry() {
  const daemonReg = getDaemonRegistryNode();
  daemonReg.STATUS.value = daemonStageLabel(daemonStory.stage);
  daemonReg.LAST_EVENT.value = daemonStory.lastEventText || 'none';
  daemonReg.OBSERVED.value = daemonStory.openedDaemon ? 1 : 0;
  registryData['HKEY_SLEEPBOX_MACHINE']['Containment'].ANCHOR_FILE.value = 'SYS\\anchor.seed';
  saveRegistry();
}

function syncDaemonStoryFiles() {
  ensureFsDir('DOCS');
  ensureFsDir('SYS');
  ensureFsDir('CACHE');
  if (daemonStory.openedDaemon) ensureStoryTextFile(STORY_FILE_PATHS.notice, daemonNoticeContent());
  else removeFsPath(STORY_FILE_PATHS.notice, { trackFragmentation: false });
  if (daemonStory.daemonStopped) ensureStoryTextFile(STORY_FILE_PATHS.incident, daemonIncidentContent());
  else removeFsPath(STORY_FILE_PATHS.incident, { trackFragmentation: false });
  if (daemonStory.daemonStopped) ensureStoryTextFile(STORY_FILE_PATHS.lostContact, daemonLostContactContent());
  else removeFsPath(STORY_FILE_PATHS.lostContact, { trackFragmentation: false });
  if (daemonStory.stage >= 4) {
    ensureStoryTextFile(STORY_FILE_PATHS.lastOperator, daemonLastOperatorContent());
    if (!daemonStory.endingReached) ensureStoryTextFile(STORY_FILE_PATHS.mirrorDat, daemonMirrorDatContent());
  } else {
    removeFsPath(STORY_FILE_PATHS.lastOperator, { trackFragmentation: false });
    removeFsPath(STORY_FILE_PATHS.mirrorDat, { trackFragmentation: false });
  }
  if (daemonStory.anchorDeleted) ensureStoryTextFile(STORY_FILE_PATHS.mirrorProtocol, daemonMirrorProtocolContent());
  else removeFsPath(STORY_FILE_PATHS.mirrorProtocol, { trackFragmentation: false });
  if (!daemonStory.anchorDeleted) ensureStoryTextFile(STORY_FILE_PATHS.anchorSeed, daemonAnchorSeedContent());
  else removeFsPath(STORY_FILE_PATHS.anchorSeed, { trackFragmentation: false });
  if (daemonStory.falseContainmentSeen && !daemonStory.daemonStopped && !daemonStory.endingReached) ensureStoryTextFile(STORY_FILE_PATHS.watchPid, daemonWatchPidContent());
  else removeFsPath(STORY_FILE_PATHS.watchPid, { trackFragmentation: false });
  if (daemonStory.quarantineSigned) ensureStoryTextFile(STORY_FILE_PATHS.quarantineSig, daemonQuarantineSigContent());
  else if (daemonStory.stage >= 4) ensureStoryTextFile(STORY_FILE_PATHS.quarantineSig, daemonQuarantinePendingContent());
  else removeFsPath(STORY_FILE_PATHS.quarantineSig, { trackFragmentation: false });
  if (daemonStory.endingReached) {
    removeFsPath(STORY_FILE_PATHS.mirrorDat, { trackFragmentation: false });
    removeFsPath(STORY_FILE_PATHS.watchPid, { trackFragmentation: false });
  }
}

function refreshDaemonStoryViews() {
  document.dispatchEvent(new CustomEvent('fs-changed'));
  applyDaemonVisualState();
  applyDaemonWindowState();
  if (typeof renderDaemonPanel === 'function' && document.getElementById('wb-daemon')) renderDaemonPanel();
  if (typeof renderVoid === 'function' && document.getElementById('wb-void')) renderVoid();
  // Reveal quarantine.exe name on desktop icon when signed
  const exeIconLabel = document.querySelector('[data-icon-key="?????.exe"] .di-name');
  if (exeIconLabel) exeIconLabel.textContent = iconLabel(getExeDisplayName());
}

function getDaemonVisualStage() {
  if (daemonStory.endingReached) return 0;
  if (daemonStory.stage >= 7) return 7;
  if (daemonStory.stage >= 5) return 5;
  if (daemonStory.stage >= 4) return 4;
  return 0;
}

function getDriveFragmentationVisualLevel() {
  if (daemonStory.endingReached) return 0;
  const visualStage = getDaemonVisualStage();
  if (visualStage < 4) return 0;
  const fragLevel = getDriveFragmentationLevel();
  if (fragLevel < 0.22) return 0;
  if (visualStage >= 7 && fragLevel >= 0.62) return 3;
  if (visualStage >= 5 && fragLevel >= 0.42) return 2;
  return 1;
}

function scheduleDaemonPulse() {
  clearTimeout(daemonPulseTimer);
  daemonPulseTimer = null;
  const visualStage = getDaemonVisualStage();
  if (!visualStage) return;
  const fragLevel = getDriveFragmentationLevel();
  const fragFactor = Math.max(0, Math.min(1, (fragLevel - 0.02) / 0.9));
  const delayScale = 1.7 - fragFactor * 0.7;
  const baseMinDelay = visualStage >= 7 ? 3800 : visualStage >= 5 ? 6200 : 9800;
  const baseMaxDelay = visualStage >= 7 ? 7200 : visualStage >= 5 ? 10800 : 14800;
  const minDelay = Math.round(baseMinDelay * delayScale);
  const maxDelay = Math.round(baseMaxDelay * delayScale);
  const pulseIntensity = Math.max(1, Math.round(visualStage * (0.55 + fragFactor * 0.45)));
  const nextDelay = minDelay + Math.random() * (maxDelay - minDelay);
  daemonPulseTimer = setTimeout(() => {
    triggerGlitch({ intensity: pulseIntensity, subtle: true });
    scheduleDaemonPulse();
  }, nextDelay);
}

function applyDaemonVisualState() {
  const body = document.body;
  if (!body) return;
  body.classList.remove('daemon-visual-4', 'daemon-visual-5', 'daemon-visual-7', 'frag-visual-1', 'frag-visual-2', 'frag-visual-3');
  const visualStage = getDaemonVisualStage();
  const fragVisualLevel = getDriveFragmentationVisualLevel();
  if (visualStage) body.classList.add(`daemon-visual-${visualStage}`);
  if (fragVisualLevel) body.classList.add(`frag-visual-${fragVisualLevel}`);
  scheduleDaemonPulse();
}

function applyDaemonWindowState() {
  const daemonWin = wins['daemon']?.el;
  const voidWin = wins['void']?.el;
  if (daemonWin) daemonWin.classList.add('daemon-surface');
  if (voidWin) voidWin.classList.add('void-surface');
}

function pulseDaemonWindows(intensity, options) {
  const subtle = !!options?.subtle;
  ['daemon', 'void'].forEach(id => {
    const el = wins[id]?.el;
    if (!el) return;
    const x = subtle
      ? (Math.random() < 0.5 ? -0.75 : 0.75)
      : intensity >= 7
        ? (Math.random() < 0.5 ? -2 : 2)
        : (Math.random() < 0.5 ? -1 : 1);
    const y = subtle
      ? 0
      : intensity >= 7
        ? (Math.random() < 0.5 ? -1 : 1)
        : 0;
    el.style.setProperty('--pulse-x', x + 'px');
    el.style.setProperty('--pulse-y', y + 'px');
    el.classList.add('window-afterimage');
    setTimeout(() => {
      const current = wins[id]?.el;
      if (!current || current !== el) return;
      el.classList.remove('window-afterimage');
      el.style.removeProperty('--pulse-x');
      el.style.removeProperty('--pulse-y');
    }, subtle ? 150 : intensity >= 7 ? 260 : 180);
  });
}

function syncDaemonStory(options) {
  const opts = options || {};
  daemonNormalizeStory(daemonStory);
  saveDaemonStory();
  syncDaemonStoryRegistry();
  syncDaemonStoryFiles();
  schedSave();
  if (!opts.silent) refreshDaemonStoryViews();
}

function updateDaemonStory(mutator, options) {
  const before = normalizeDaemonStory(daemonStory);
  mutator(daemonStory);
  daemonNormalizeStory(daemonStory);
  if (!daemonStoryChanged(before) && !options?.forceSync) return false;
  syncDaemonStory(options);
  if (options?.glitch) triggerGlitch();
  if (options?.notice) {
    const info = typeof options.notice === 'string'
      ? { message: options.notice, title: 'Containment Notice', icon: '👁️' }
      : options.notice;
    osAlert(info.message, info.title || 'Containment Notice', info.icon || '👁️');
  }
  return true;
}

function daemonActivate(trigger) {
  return updateDaemonStory(story => {
    if (!story.openedDaemon) {
      story.openedDaemon = true;
      story.lastEventText = 'daemon.core observed';
    } else if (trigger === 'raw' && story.lastEventText === 'none') {
      story.lastEventText = 'daemon.core observed';
    }
  }, { forceSync: true });
}

function daemonRecordInvestigation(kind) {
  return updateDaemonStory(story => {
    if (kind === 'void') story.voidObserved = true;
    if (kind === 'mirror') story.mirrorInspected = true;
    if (kind === 'protocol') story.protocolInspected = true;
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
      story.mirrorLockRestored = true;
      story.lastEventText = 'mirror lattice restored';
      return;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && story.stage < 6) {
      story.lastEventText = 'void channel profiled';
    }
  });
}

function daemonRecordVoidAction(mode) {
  return updateDaemonStory(story => {
    story.voidObserved = true;
    story.voidActions = normalizeVoidActions([...(Array.isArray(story.voidActions) ? story.voidActions : []), mode]);
    if (mode === 'observe') {
      if (story.lastEventText === 'none') story.lastEventText = 'void surface observed';
    } else if (story.stage < 6 || story.lastEventText === 'none') {
      story.lastEventText = `void probe recorded: ${mode}`;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
      story.mirrorLockRestored = true;
      story.lastEventText = 'mirror lattice restored';
      return;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && story.stage < 6) {
      story.lastEventText = 'void channel profiled';
    }
  }, { forceSync: true });
}

function getVoidMeasureEntries(telemetry) {
  return [
    ['Containment', `${telemetry.rating.code} / ${telemetry.rating.label}`],
    ['Void Pressure', String(telemetry.pressure)],
    ['Lattice Stability', String(telemetry.lattice)],
    ['Signal Depth', String(telemetry.signalDepth)],
    ['Aperture Bias', telemetry.bias],
    ['Disk Locality', 'negative'],
  ];
}

function renderVoidReadout(out, content, telemetry) {
  if (!out) return;
  if (daemonVoidFeedMode === 'measure') {
    const cards = getVoidMeasureEntries(telemetry).map(([label, value]) => `
      <div style="border:1px solid #123512;background:#061006;padding:6px;min-width:0;">
        <div style="color:#8db98d;text-transform:uppercase;font-size:9px;letter-spacing:0.03em;margin-bottom:3px;">${escHtml(label)}</div>
        <div style="color:#b8efb8;font-size:11px;line-height:1.35;word-break:break-word;">${escHtml(value)}</div>
      </div>
    `).join('');
    out.style.whiteSpace = 'normal';
    out.style.padding = '8px';
    out.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-content:start;">${cards}</div>`;
    return;
  }
  out.style.whiteSpace = 'pre-wrap';
  out.style.padding = '10px';
  out.textContent = content;
}

function canDeleteAnchorSeed() {
  return Number(getContainmentValue('MIRROR_LOCK')) === 0;
}

function canAttemptDeleteItem(path, fallbackDir, meta) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
  if (upperPath === 'VOID.TMP') return true;
  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) return false;
  if (meta?.sysfile) return false;
  return true;
}

function deleteVirtualPath(path, fallbackDir) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
  const fileLabel = fileName || path;
  if (!fileName) return { ok: false, message: 'Usage: DEL <file>' };

  if (upperPath === 'VOID.TMP') {
    if (daemonStory.endingReached) return { ok: false, message: 'File not found: void.tmp' };
    if (!daemonStory.quarantineSigned) {
      return {
        ok: false,
        message: 'void.tmp refuses to go quietly.',
        details: ['A quarantine signature is required before deletion will hold.'],
      };
    }
    if (Number(getContainmentValue('MIRROR_LOCK')) !== 1) {
      return {
        ok: false,
        message: 'void.tmp remains unstable.',
        details: ['Restore HKEY_SLEEPBOX_MACHINE\\Containment\\MIRROR_LOCK to 1 before the final delete.'],
      };
    }
    updateDaemonStory(story => {
      story.endingReached = true;
      story.lastEventText = 'containment complete';
    });
    if (wins['void']) closeWin('void');
    if (typeof setupIcons === 'function') setupIcons();
    setTimeout(playContainmentEndingReboot, 140);
    return {
      ok: true,
      deleted: true,
      details: ['Deleted: void.tmp', 'SYS\\quarantine.sig holds.', 'Containment complete.'],
    };
  }

  if (upperPath === 'DAEMON.CORE') {
    return {
      ok: false,
      message: 'Access denied.',
      details: ['daemon.core is not removable.', 'It remains in archive even when it is no longer active.'],
    };
  }

  if (upperPath === '?????.EXE') {
    return {
      ok: false,
      message: 'The launcher refuses deletion.',
      details: ['If you need it quiet, leave it unopened.'],
    };
  }

  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['Core directories are protected.'],
    };
  }

  if (upperPath === STORY_FILE_PATHS.anchorSeed.toUpperCase()) {
    if (!canDeleteAnchorSeed()) {
      return {
        ok: false,
        message: 'anchor.seed will not release.',
        details: ['Lower HKEY_SLEEPBOX_MACHINE\\Containment\\MIRROR_LOCK to 0 first.'],
      };
    }
    if (!removeFsPath(STORY_FILE_PATHS.anchorSeed)) {
      return { ok: false, message: 'File not found: ' + fileLabel };
    }
    updateDaemonStory(story => {
      story.anchorDeleted = true;
      story.lastEventText = 'anchor released';
      daemonVoidFeed = 'The aperture widens. Something on the reflected side notices the room.';
      daemonVoidFeedMode = '';
    }, {
      glitch: true,
      notice: {
        title: 'Anchor Lost',
        icon: '⬛',
        message: 'The mirror anchor is gone.\n\nKeep daemon.core and void.tmp isolated from your active work while you inspect the breach.',
      },
    });
    return {
      ok: true,
      deleted: true,
      details: ['Deleted: anchor.seed', 'Mirror anchor released.', 'The channel is no longer deflected.'],
    };
  }

  if (isVisibleSystemPath(path, { includeExplorer: true })) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['System files are protected.'],
    };
  }

  const deleted = recycleVirtualPath(path, fallbackDir);
  if (!deleted.ok) return deleted;
  syncDaemonStory({ silent: false });
  return deleted;
}

// Testing helper: prime the endgame state, then run the real final delete.
function forceDeleteVoidTmp() {
  if (daemonStory.endingReached) {
    return { ok: false, message: 'void.tmp is no longer present.' };
  }
  const containment = registryData['HKEY_SLEEPBOX_MACHINE']?.['Containment'];
  if (containment?.MIRROR_LOCK) containment.MIRROR_LOCK.value = 1;
  saveRegistry();
  updateDaemonStory(story => {
    story.openedDaemon = true;
    story.falseContainmentSeen = true;
    story.daemonStopped = true;
    story.anchorDeleted = true;
    story.voidObserved = true;
    story.voidActions = VOID_ACTION_ORDER.slice();
    story.mirrorInspected = true;
    story.protocolInspected = true;
    story.mirrorLockRestored = true;
    story.quarantineSigned = true;
    story.lastEventText = 'debug skip armed';
  }, { forceSync: true });
  return deleteVirtualPath('void.tmp');
}
window.forceDeleteVoidTmp = forceDeleteVoidTmp;

function killSoulDaemonProcess() {
  if (daemonStory.stage < 1) {
    return {
      ok: false,
      message: 'ERROR: Access is denied. (PID 512)',
      details: ['soul_svc.exe is still registered as a protected service.'],
    };
  }
  if (daemonStory.daemonStopped || daemonStory.endingReached) {
    return { ok: false, message: 'ERROR: The process with PID 512 was not found.' };
  }
  if (Number(getContainmentValue('RESPAWN_LOCK')) !== 0) {
    updateDaemonStory(story => {
      story.killedSoulDaemon = true;
      story.falseContainmentSeen = true;
      story.lastEventText = 'respawn loop observed';
    }, { glitch: true });
    return {
      ok: false,
      respawned: true,
      message: 'soul_daemon.exe terminated.',
      details: [
        'watch.pid restored the process before the table settled.',
        'RESPAWN_LOCK is still active.',
      ],
    };
  }
  updateDaemonStory(story => {
    story.killedSoulDaemon = true;
    story.falseContainmentSeen = true;
    story.respawnDisabledKill = true;
    story.daemonStopped = true;
    story.wrongVictory = true;
    story.lastEventText = 'daemon relay offline';
    daemonVoidFeed = 'The monitor goes missing. The pressure does not.';
    daemonVoidFeedMode = '';
  }, {
    glitch: true,
    notice: {
      title: 'Monitor Link Lost',
      icon: '⚠️',
      message: 'PID 512 stayed dead.\n\nvoid.tmp and CACHE\\mirror.dat should now be treated as active evidence.',
    },
  });
  return {
    ok: true,
    stopped: true,
    message: 'SUCCESS: soul_daemon.exe terminated.',
    details: [
      'The process does not respawn.',
      'Void pressure begins to climb in its absence.',
    ],
  };
}

syncDaemonStory({ silent: true });


// ─────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────
const PROJECTS = [
  { name: 'sand playground',    emoji: '⏳', file: 'evenet.fun/Sands.html' },
  { name: 'bug hotline',        emoji: '🐛', file: 'evenet.fun/critters.html' },
  { name: 'fireworks',          emoji: '🎆', file: 'evenet.fun/fireworks.html' },
  { name: 'pixel splatter',     emoji: '🔮', file: 'pixel-splatter.html' },
  { name: 'anime hell',         emoji: '🔥', file: 'evenet.fun/hell.html' },
  { name: 'fluid',              emoji: '💧', file: 'evenet.fun/fluido.html' },
  { name: 'web wizard casino',  emoji: '🎰', file: 'evenet.fun/webwizardcasino.html' },
  { name: 'automata garden',    emoji: '🌱', file: 'evenet.fun/automata-garden.html' },
  { name: 'erosion toy',        emoji: '🏔️',  file: 'evenet.fun/erosion.html' },
  { name: 'wave collapse',      emoji: '🌊', file: 'evenet.fun/wave-collapse.html' },
  { name: 'tentacle catch',     emoji: '🦑', file: 'evenet.fun/catch.html' },
  { name: 'reaction diffusion', emoji: '⚗️',  file: 'evenet.fun/philosophers-stone.html' },
  { name: 'voronoi',            emoji: '🔬', file: 'evenet.fun/vornoi.html' },
  { name: 'morse code',         emoji: '📡', file: 'evenet.fun/morse.html' },
  { name: 'lissajous',          emoji: '〰️', file: 'evenet.fun/lissajous.html' },
  { name: 'net sanctuary',      emoji: '🌐', file: 'evenet.fun/net-sanctuary-project.html' },
  { name: 'ascii render',       emoji: '💻', file: 'evenet.fun/ascii-render.html' },
  { name: 'tablecloth',         emoji: '🧶', file: 'evenet.fun/tablecloth.html' },
  { name: 'corridor crawler',   emoji: '🚪', file: 'evenet.fun/corridor.html' },
  { name: 'patch synth',        emoji: '🎛️',  file: 'evenet.fun/synth.html' },
  { name: 'turtle',             emoji: '🐢', file: 'evenet.fun/turtle.html' },
  { name: 'ball like',          emoji: '⚪', file: 'evenet.fun/ball-like.html' },
  { name: 'magnetic pendulum',  emoji: '🧲', file: 'evenet.fun/magnetic-pendulum.html' },
  { name: 'physarum',           emoji: '🍄', file: 'evenet.fun/physarum.html' },
  { name: 'dla crystal',        emoji: '❄️', file: 'evenet.fun/dla-crystal.html' },
];
const RECYCLE_BIN_NAME = 'RECYCLE BIN';
const RECYCLE_STORAGE_DIR = 'CACHE\\RECYCLE_BIN';
const RECYCLE_BIN_KEY = 'sleepOS-recycle-bin';

const DESKTOP_ICONS = [
  { name: 'WELCOME.README', emoji: '📄', action: 'openWelcome' },
  { name: 'NOTEPAD.exe',    emoji: '📝', action: 'openNotepad' },
  { name: 'EXPLORER.exe',   emoji: '🗂️', action: 'openExplorer' },
  { name: 'TERMINAL.exe',   emoji: '💻', action: 'openTerminal' },
  { name: 'SYSMON.exe',     emoji: '📊', action: 'openSysmon' },
  { name: 'BROWSER.exe',    emoji: '🌐', action: 'openBrowser' },
  { name: 'DEFRAG.exe',     emoji: '🧩', action: 'openDefrag' },
  { name: 'CALC.exe',       emoji: '🔢', action: 'openCalculator' },
  { name: 'REGEDIT.exe',    emoji: '🗝️', action: 'openRegedit' },
  { name: 'daemon.core',    emoji: '👁️',  action: 'openDaemon' },
  { name: 'void.tmp',       emoji: '⬛', action: 'openVoid' },
  { name: RECYCLE_BIN_NAME, emoji: '\u{1F5D1}\uFE0F', action: 'openRecycleBin', recycleBin: true },
];
function getExeDisplayName() {
  return daemonStory.quarantineSigned ? 'quarantine.exe' : '?????.exe';
}

const DESKTOP_ICON_DIRS_KEY = 'sleepOS-desktop-icon-dirs';
function normalizeDesktopContainerDir(dirPath) {
  const normalized = fsNormalizeDir(dirPath || 'DESKTOP');
  if (!normalized || normalized === 'DESKTOP' || normalized.startsWith('DESKTOP\\')) return normalized || 'DESKTOP';
  return 'DESKTOP';
}
function loadDesktopIconDirs() {
  try {
    const raw = JSON.parse(localStorage.getItem(DESKTOP_ICON_DIRS_KEY) || '{}') || {};
    const out = {};
    Object.entries(raw).forEach(([name, dirPath]) => {
      const icon = DESKTOP_ICONS.find(item => item.name === name && !item.recycleBin);
      if (!icon) return;
      const normalized = normalizeDesktopContainerDir(dirPath);
      if (normalized !== 'DESKTOP') out[name] = normalized;
    });
    return out;
  } catch (e) {
    return {};
  }
}
function saveDesktopIconDirs() {
  try { localStorage.setItem(DESKTOP_ICON_DIRS_KEY, JSON.stringify(desktopIconDirs)); } catch (e) {}
}
let desktopIconDirs = loadDesktopIconDirs();
function getDesktopSystemIconDir(name) {
  if (isRecycleBinItemName(name)) return 'DESKTOP';
  const normalized = normalizeDesktopContainerDir(desktopIconDirs[name] || 'DESKTOP');
  return normalized !== 'DESKTOP' && !vfsDirExistsSync(normalized) ? 'DESKTOP' : normalized;
}
function setDesktopSystemIconDir(name, dirPath) {
  if (isRecycleBinItemName(name)) return;
  const normalized = normalizeDesktopContainerDir(dirPath);
  if (normalized === 'DESKTOP') delete desktopIconDirs[name];
  else desktopIconDirs[name] = normalized;
  saveDesktopIconDirs();
}
function getDesktopSystemIconsForDir(dirPath) {
  const normalized = normalizeDesktopContainerDir(dirPath);
  return DESKTOP_ICONS.filter(icon => {
    if (icon.name === 'void.tmp' && daemonStory.endingReached) return false;
    if (icon.recycleBin) return normalized === 'DESKTOP';
    return getDesktopSystemIconDir(icon.name) === normalized;
  });
}
function getVisibleDesktopIcons() {
  return getDesktopSystemIconsForDir('DESKTOP');
}
function isDesktopContainerPath(dirPath) {
  const normalized = fsNormalizeDir(dirPath);
  return normalized === 'DESKTOP' || normalized.startsWith('DESKTOP\\');
}
function isDesktopVirtualItem(item, srcDirPath) {
  if (!item || !isDesktopContainerPath(srcDirPath)) return false;
  if (item._shortcut || item.custom) return true;
  return !!item.sysfile && !item.recycleBin && !isRecycleBinItemName(item.name);
}
function clearDesktopRootIconPosition(name) {
  if (!Object.prototype.hasOwnProperty.call(iconPositions, name)) return;
  delete iconPositions[name];
  saveIconPositions();
}
function canMoveDesktopVirtualItem(item, srcDirPath, dstDirPath) {
  const srcDir = fsNormalizeDir(srcDirPath);
  const dstDir = fsNormalizeDir(dstDirPath);
  if (!isDesktopVirtualItem(item, srcDir)) return false;
  if (!isDesktopContainerPath(dstDir)) return false;
  return dstDir === 'DESKTOP' || vfsDirExistsSync(dstDir);
}
function moveDesktopVirtualItem(item, srcDirPath, dstDirPath) {
  const srcDir = fsNormalizeDir(srcDirPath);
  const dstDir = fsNormalizeDir(dstDirPath);
  if (!canMoveDesktopVirtualItem(item, srcDirPath, dstDir)) return false;
  if (srcDir === dstDir) return true;
  if (item._shortcut || item.custom) {
    const shortcut = item._shortcut || item;
    shortcut.dirPath = normalizeDesktopContainerDir(dstDir);
    saveDesktopShortcuts();
  } else {
    setDesktopSystemIconDir(item.name, dstDir);
  }
  clearDesktopRootIconPosition(item.name);
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return true;
}
function canMoveShellItemToDir(item, srcDirPath, dstDirPath) {
  const dstDir = fsNormalizeDir(dstDirPath);
  if (!item || item._proj || item._recycle) return false;
  if (isDesktopVirtualItem(item, srcDirPath)) return canMoveDesktopVirtualItem(item, srcDirPath, dstDir);
  if (item.sysfile || item._shortcut) return false;
  return dstDir === '' || vfsDirExistsSync(dstDir);
}
function moveShellItemToDir(item, srcDirPath, dstDirPath) {
  const srcDir = fsNormalizeDir(srcDirPath);
  const dstDir = fsNormalizeDir(dstDirPath);
  if (isDesktopVirtualItem(item, srcDirPath)) return moveDesktopVirtualItem(item, srcDirPath, dstDir);
  if (!canMoveShellItemToDir(item, srcDirPath, dstDir)) return false;
  if (srcDir === dstDir) return true;
  const oldPath = srcDir ? srcDir + '\\' + item.name : item.name;
  const moved = moveFsItemByPath(item.name, srcDirPath, dstDir);
  if (!moved) return false;
  const newPath = moved.dirName ? moved.dirName + '\\' + moved.name : moved.name;
  retargetDesktopShortcutsForMove(oldPath, newPath, item.kind);
  if (isDesktopContainerPath(srcDirPath) || isDesktopContainerPath(dstDir)) clearDesktopRootIconPosition(item.name);
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return true;
}
function canRecycleShellItem(item, srcDirPath) {
  return !!item && !item._proj && !item._recycle && !item._shortcut && !item.sysfile && !isDesktopVirtualItem(item, srcDirPath);
}
function recycleShellItem(item, srcDirPath) {
  if (!canRecycleShellItem(item, srcDirPath)) return { ok: false, message: 'Move failed.' };
  const result = recycleVirtualPath(item.name, srcDirPath);
  if (result.ok) {
    if (isDesktopContainerPath(srcDirPath)) clearDesktopRootIconPosition(item.name);
    document.dispatchEvent(new CustomEvent('fs-changed'));
  }
  return result;
}
function setShellDragPayload(payload) {
  _shellDragPayload = payload || null;
}
function getShellDragPayload() {
  return _shellDragPayload;
}
function clearShellDragPayload() {
  _shellDragPayload = null;
}
function isDesktopSurfaceTransferBlocked(payload, dstDirPath) {
  if (!payload) return false;
  return fsNormalizeDir(payload.srcCwd) === 'DESKTOP' && fsNormalizeDir(dstDirPath) === 'DESKTOP';
}
function buildShellDragPayload(item, srcCwd, source, extra) {
  const raw = Array.isArray(extra?.items) && extra.items.length ? extra.items : [item];
  const items = [];
  raw.forEach(candidate => {
    if (candidate && !items.includes(candidate)) items.push(candidate);
  });
  return {
    ...(extra || {}),
    item: item || items[0] || null,
    items,
    srcCwd,
    source,
  };
}
function getShellDragItems(payload) {
  if (!payload) return [];
  const raw = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload.item];
  return raw.filter((item, index) => item && raw.indexOf(item) === index);
}
function shellDragIncludesItem(payload, item) {
  return !!item && getShellDragItems(payload).includes(item);
}
function canMoveShellPayloadToDir(payload, dstDirPath) {
  const items = getShellDragItems(payload);
  return !!items.length && items.every(item => canMoveShellItemToDir(item, payload.srcCwd, dstDirPath));
}
function moveShellPayloadToDir(payload, dstDirPath) {
  const items = getShellDragItems(payload);
  if (!items.length || !canMoveShellPayloadToDir(payload, dstDirPath)) return false;
  let moved = 0;
  items.forEach(item => { if (moveShellItemToDir(item, payload.srcCwd, dstDirPath)) moved++; });
  return moved === items.length;
}
function canRecycleShellPayload(payload) {
  const items = getShellDragItems(payload);
  return !!items.length && items.every(item => canRecycleShellItem(item, payload.srcCwd));
}
function recycleShellPayload(payload) {
  const items = getShellDragItems(payload);
  if (!items.length || !canRecycleShellPayload(payload)) return false;
  let recycled = 0;
  items.forEach(item => {
    const result = recycleShellItem(item, payload.srcCwd);
    if (result.ok) recycled++;
  });
  return recycled === items.length;
}
const SYSTEM_FILE_ICONS = DESKTOP_ICONS.reduce((icons, { name, emoji }) => {
  icons[name.toUpperCase()] = emoji;
  return icons;
}, Object.create(null));

const DESKTOP_SHORTCUTS_KEY = 'sleepOS-desktop-shortcuts';
const customDesktopIcons = [];
function normalizeShortcutPath(path) {
  return String(path || '')
    .trim()
    .replace(/^C:\\sleepOS\\?/i, '')
    .replace(/\//g, '\\')
    .replace(/^\\+|\\+$/g, '');
}
function normalizeDesktopShortcut(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const target = entry.target && typeof entry.target === 'object' ? entry.target : null;
  if (!target) return null;
  const kind = target.kind === 'dir' ? 'dir' : 'file';
  const path = normalizeShortcutPath(target.path);
  const name = String(entry.name || target.name || path.split('\\').pop() || '').trim();
  const emoji = String(entry.emoji || '').trim();
  if (!name || !emoji) return null;
  if (!path && !target.sysfile) return null;
  const dirPath = normalizeDesktopContainerDir(entry.dirPath || 'DESKTOP');
  return {
    name,
    emoji,
    custom: true,
    dirPath,
    target: {
      name,
      path,
      kind,
      sysfile: !!target.sysfile,
    },
  };
}
function saveDesktopShortcuts() {
  try {
    localStorage.setItem(DESKTOP_SHORTCUTS_KEY, JSON.stringify(customDesktopIcons.map(({ name, emoji, dirPath, target }) => ({
      name,
      emoji,
      dirPath: normalizeDesktopContainerDir(dirPath || 'DESKTOP'),
      target,
    }))));
  } catch (e) {}
}
function loadDesktopShortcuts() {
  customDesktopIcons.length = 0;
  try {
    const raw = JSON.parse(localStorage.getItem(DESKTOP_SHORTCUTS_KEY) || '[]');
    raw.map(normalizeDesktopShortcut).filter(Boolean).forEach(icon => customDesktopIcons.push(icon));
  } catch (e) {}
}
function getDesktopShortcutsForDir(dirPath) {
  const normalized = normalizeDesktopContainerDir(dirPath);
  return customDesktopIcons.filter(icon => {
    const iconDir = normalizeDesktopContainerDir(icon.dirPath || 'DESKTOP');
    const resolvedDir = iconDir !== 'DESKTOP' && !vfsDirExistsSync(iconDir) ? 'DESKTOP' : iconDir;
    return resolvedDir === normalized;
  });
}
function retargetDesktopShortcutsForMove(oldPath, newPath, kind) {
  const from = normalizeShortcutPath(oldPath);
  const to = normalizeShortcutPath(newPath);
  if (!from || !to) return false;
  let changed = false;
  customDesktopIcons.forEach(icon => {
    const target = icon?.target;
    if (!target || target.sysfile) return;
    const targetPath = normalizeShortcutPath(target.path);
    if (!targetPath) return;
    if (kind === 'dir') {
      if (targetPath === from || targetPath.startsWith(from + '\\')) {
        target.path = to + targetPath.slice(from.length);
        changed = true;
      }
      return;
    }
    if (targetPath === from) {
      target.path = to;
      changed = true;
    }
  });
  if (changed) saveDesktopShortcuts();
  return changed;
}
loadDesktopShortcuts();
function openSystemFile(name) {
  const key = String(name || '').trim();
  if (!key) return false;
  if (key.toLowerCase() === 'void.tmp' && daemonStory.endingReached) {
    osAlert('void.tmp is no longer present.', 'void.tmp', '⬛');
    return true;
  }
  const SYS = {
    'WELCOME.README': openWelcome,
    'TERMINAL.exe': openTerminal,
    'SYSMON.exe': openSysmon,
    'NOTEPAD.exe': openNotepad,
    'BROWSER.exe': openBrowser,
    'DEFRAG.exe': openDefrag,
    'CALC.exe': openCalculator,
    'REGEDIT.exe': openRegedit,
    'EXPLORER.exe': openExplorer,
    'void.tmp': openVoid,
    'daemon.core': openDaemon,
    '?????.exe': openUnknown,
    [RECYCLE_BIN_NAME]: openRecycleBin,
  };
  const resolvedKey = Object.keys(SYS).find(entry => entry.toLowerCase() === key.toLowerCase());
  if (!resolvedKey) return false;
  SYS[resolvedKey]();
  return true;
}
function openDesktopShortcutTarget(target) {
  if (!target || typeof target !== 'object') return;
  const path = normalizeShortcutPath(target.path);
  const name = String(target.name || path.split('\\').pop() || '').trim();
  if (target.sysfile) {
    if (!openSystemFile(name || path)) {
      osAlert('Shortcut target not found:\n' + (name || path || 'Unknown target'), 'Missing Shortcut', 'X');
    }
    return;
  }
  if (target.kind === 'dir') {
    openExplorer(path);
    return;
  }
  const st = vfsStatSync(path);
  if (!st) {
    osAlert('Shortcut target not found:\n' + (path || name || 'Unknown target'), 'Missing Shortcut', 'X');
    return;
  }
  if (openWithAssociation(st.name, st.dirName)) return;
  if (st.kind === 'blob') openMediaFile(st.name, st.dirName);
  else openNotepad(st.name, st.dirName);
}

function openRecycleBin() {
  openExplorer('RECYCLE');
}

const DEFAULT_BROWSER_FAVORITES = [
  { title: 'Wikipedia: Random', url: 'https://en.wikipedia.org/wiki/Special:Random', homeIcon: '&#128214;' },
  { title: 'Internet Archive',  url: 'https://archive.org', homeIcon: '&#128230;' },
  { title: 'Poolsuite FM',      url: 'https://poolsuite.net', homeIcon: '&#128251;' },
];
const DEFAULT_BROWSER_FAVORITE_URLS = new Set(DEFAULT_BROWSER_FAVORITES.map(fav => fav.url.toLowerCase()));
function normalizeFavoriteEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const url = String(entry.url || '').trim();
  if (!url) return null;
  const title = String(entry.title || url).trim() || url;
  return { title, url };
}
function dedupeFavorites(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map(normalizeFavoriteEntry)
    .filter(entry => {
      if (!entry) return false;
      const key = entry.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
let browserFavorites = [];
try {
  browserFavorites = dedupeFavorites(JSON.parse(localStorage.getItem('sleepOS-favorites') || '[]'));
} catch {
  browserFavorites = [];
}
function saveFavorites() {
  browserFavorites = dedupeFavorites(browserFavorites);
  localStorage.setItem('sleepOS-favorites', JSON.stringify(browserFavorites));
}
if (localStorage.getItem('sleepOS-favorites-seeded') !== '1') {
  browserFavorites = dedupeFavorites([...DEFAULT_BROWSER_FAVORITES, ...browserFavorites]);
  saveFavorites();
  localStorage.setItem('sleepOS-favorites-seeded', '1');
}


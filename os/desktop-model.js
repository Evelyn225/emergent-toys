// ─────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────
const PROJECTS = [
  { name: 'sand playground',    emoji: '⏳', file: 'evenet.fun/Sands.html' },
  { name: 'bug hotline',        emoji: '🐛', file: 'evenet.fun/critters.html' },
  { name: 'fireworks',          emoji: '🎆', file: 'evenet.fun/fireworks.html' },
  { name: 'pixel splatter',     emoji: '🔮', file: 'pixel-splatter.html' },
  { name: 'fluid',              emoji: '💧', file: 'evenet.fun/fluido.html' },
  { name: 'web wizard casino',  emoji: '🎰', file: 'evenet.fun/webwizardcasino.html' },
  { name: 'automata garden',    emoji: '🌱', file: 'evenet.fun/automata-garden.html' },
  { name: 'erosion toy',        emoji: '🏔️',  file: 'evenet.fun/erosion.html' },
  { name: 'wave collapse',      emoji: '🌊', file: 'evenet.fun/wave-collapse.html' },
  { name: 'tentacle catch',     emoji: '🦑', file: 'evenet.fun/catch.html' },
  { name: 'reaction diffusion', emoji: '⚗️',  file: 'evenet.fun/philosophers-stone.html' },
  { name: 'voronoi',            emoji: '🔬', file: 'evenet.fun/vornoi.html' },
  { name: 'morse code',         emoji: '📡', file: 'evenet.fun/morse.html' },
  { name: 'ascii render',       emoji: '💻', file: 'evenet.fun/ascii-render.html' },
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
  { name: 'WELCOME.README', emoji: 'icon:text',     action: 'openWelcome' },
  // No PROJECTS icon. The art toys are `window.open` links that
  // eject the visitor from the OS entirely, and the folder they sat in was a
  // synthetic one - Explorer special-cased it, nothing on disk. BROWSER.exe's
  // home page lists all of them and keeps the visitor inside, so it is the
  // one place they live now.
  { name: 'NOTEPAD.exe',    emoji: 'icon:notepad',  action: 'openNotepad' },
  { name: 'EXPLORER.exe',   emoji: 'icon:explorer', action: 'openExplorer' },
  { name: 'TERMINAL.exe',   emoji: 'icon:terminal', action: 'openTerminal' },
  { name: 'SYSMON.exe',     emoji: 'icon:sysmon',   action: 'openSysmon' },
  { name: 'BROWSER.exe',    emoji: 'icon:browser',  action: 'openBrowser' },
  { name: 'DEFRAG.exe',     emoji: 'icon:defrag',   action: 'openDefrag' },
  { name: 'CALC.exe',       emoji: 'icon:calc',     action: 'openCalculator' },
  { name: 'MINESWEEPER.exe', emoji: 'icon:minesweeper', action: 'openMinesweeper' },
  { name: 'REGEDIT.exe',    emoji: 'icon:regedit',  action: 'openRegedit' },
  { name: 'daemon.core',    emoji: 'icon:daemon',   action: 'openDaemon' },
  { name: 'void.tmp',       emoji: 'icon:void',     action: 'openVoid' },
  // Not in the static map alone: the bin's icon depends on whether it holds
  // anything, so resolveFsIcon picks between empty and full at render time.
  { name: RECYCLE_BIN_NAME, emoji: 'icon:recycle-empty', action: 'openRecycleBin', recycleBin: true },
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
  if (!item || item._recycle) return false;
  if (isDesktopVirtualItem(item, srcDirPath)) return canMoveDesktopVirtualItem(item, srcDirPath, dstDir);
  if (item.sysfile || item._shortcut) return false;
  return dstDir === '' || vfsDirExistsSync(dstDir);
}
async function moveShellItemToDir(item, srcDirPath, dstDirPath) {
  const srcDir = fsNormalizeDir(srcDirPath);
  const dstDir = fsNormalizeDir(dstDirPath);
  if (isDesktopVirtualItem(item, srcDirPath)) return moveDesktopVirtualItem(item, srcDirPath, dstDir);
  if (!canMoveShellItemToDir(item, srcDirPath, dstDir)) return false;
  if (srcDir === dstDir) return true;
  const oldPath = srcDir ? srcDir + '\\' + item.name : item.name;
  const moved = await moveFsItemByPath(item.name, srcDirPath, dstDir);
  if (!moved) return false;
  const newPath = moved.dirName ? moved.dirName + '\\' + moved.name : moved.name;
  retargetDesktopShortcutsForMove(oldPath, newPath, item.kind);
  if (isDesktopContainerPath(srcDirPath) || isDesktopContainerPath(dstDir)) clearDesktopRootIconPosition(item.name);
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return true;
}
function canRecycleShellItem(item, srcDirPath) {
  return !!item && !item._recycle && !item._shortcut && !item.sysfile && !isDesktopVirtualItem(item, srcDirPath);
}
async function recycleShellItem(item, srcDirPath) {
  if (!canRecycleShellItem(item, srcDirPath)) return { ok: false, message: 'Move failed.' };
  const result = await recycleVirtualPath(item.name, srcDirPath);
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
// Sequential, not Promise.all: two concurrent moves into the same directory
// would resolve their unique-name checks against the same pre-move listing.
async function moveShellPayloadToDir(payload, dstDirPath) {
  const items = getShellDragItems(payload);
  if (!items.length || !canMoveShellPayloadToDir(payload, dstDirPath)) return false;
  let moved = 0;
  for (const item of items) {
    if (await moveShellItemToDir(item, payload.srcCwd, dstDirPath)) moved++;
  }
  return moved === items.length;
}
function canRecycleShellPayload(payload) {
  const items = getShellDragItems(payload);
  return !!items.length && items.every(item => canRecycleShellItem(item, payload.srcCwd));
}
async function recycleShellPayload(payload) {
  const items = getShellDragItems(payload);
  if (!items.length || !canRecycleShellPayload(payload)) return false;
  let recycled = 0;
  for (const item of items) {
    const result = await recycleShellItem(item, payload.srcCwd);
    if (result.ok) recycled++;
  }
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
    osAlert('void.tmp is no longer present.', 'void.tmp', 'icon:void');
    return true;
  }
  // The Recycle Bin is a desktop object rather than a program, so it stays
  // here rather than going in the registry - it has no directory, cannot be
  // typed at the terminal, and must never resolve on PATH.
  if (key.toLowerCase() === String(RECYCLE_BIN_NAME).toLowerCase()) {
    openRecycleBin();
    return true;
  }
  // A GUI launch does not consult PATH. Explorer and the desktop already know
  // where the thing is, and this is what keeps a player who breaks PATH from
  // also losing their desktop icons. Same reason Windows launches a
  // double-clicked file without searching.
  //
  // Two constraints on this call, both correct today only because of what
  // programsInDir('') currently returns:
  //
  // 1. Phase 6 added a vfsListSync pass to programsInDir, so real VFS `.exe`
  //    files show up alongside built-ins. That pass (programVfsExecutables in
  //    os/programs.js) already filters to `kind === 'text' && /\.exe$/i`
  //    before an entry ever reaches programsInDir(''), so nothing
  //    non-launchable can reach this line today - the executables-only
  //    filter below (programIsExecutableEntry) is defence in depth, not
  //    load-bearing. It stays because this call site's failure mode is
  //    silent: Explorer's double-click ignores the return value, so a wrong
  //    `true` here would just quietly do nothing useful, and the terminal's
  //    OPEN command would report success for a file it did not actually
  //    open. It would become load-bearing again the moment programsInDir
  //    gains any entry source that does not already filter for
  //    executability itself.
  //
  // 2. This only ever searches '' (the root). Explorer calls openSystemFile
  //    with a bare name from whatever directory it is currently showing, not
  //    necessarily the root - correct today only because programsInDir has
  //    built-in programs solely at the root. If a future directory ever gains
  //    launchable entries, this needs the caller's directory, not a
  //    hardcoded ''.
  //
  // The match below is exact name only - no alias, no optional .exe suffix
  // the way programMatches gives programResolve. That is deliberate, not an
  // oversight: every caller already hands over a fully-qualified name -
  // Explorer passes what its own listing displayed, a desktop shortcut
  // replays the exact target it was created with, and the terminal's OPEN
  // only reaches this function once isVisibleSystemPath has confirmed an
  // exact (case-insensitive) match itself. There is no path that lets a
  // bare or aliased name arrive here today; if one is added, match through
  // programFindIn instead of duplicating programMatches by hand.
  const program = programsInDir('').find(entry =>
    entry.name.toLowerCase() === key.toLowerCase());
  if (!programIsExecutableEntry(program)) return false;
  program.open({ cwd: '' });
  return true;
}
function openDesktopShortcutTarget(target) {
  if (!target || typeof target !== 'object') return;
  const path = normalizeShortcutPath(target.path);
  const name = String(target.name || path.split('\\').pop() || '').trim();
  if (target.sysfile) {
    if (!openSystemFile(name || path)) {
      osAlert('Shortcut target not found:\n' + (name || path || 'Unknown target'), 'Missing Shortcut', 'icon:error');
    }
    return;
  }
  if (target.kind === 'dir') {
    openExplorer(path);
    return;
  }
  // `!st` alone is not enough: fsGetEntry returned null for a directory but
  // vfsStatSync returns a full stat for one, and a shortcut whose persisted
  // kind is not literally 'dir' reaches here with a directory path. Falling
  // through would open Notepad on a directory, whose save then puts the same
  // name in both files and dirs and makes the directory unreachable.
  const st = vfsStatSync(path);
  if (!st || st.type !== 'file') {
    osAlert('Shortcut target not found:\n' + (path || name || 'Unknown target'), 'Missing Shortcut', 'icon:error');
    return;
  }
  if (openWithAssociation(st.name, st.dirName)) return;
  if (st.kind === 'blob') openMediaFile(st.name, st.dirName);
  // A .exe the user wrote runs; a system binary opens its decompiler view
  // through openNotepad instead. See programIsSpawnableExe (os/programs.js)
  // for why this test lives there rather than here. programSpawnOrAlert
  // (also os/programs.js) is what turns a spawn failure - the file vanished
  // between the shortcut being created and being clicked - into an osAlert
  // instead of a silent unhandled rejection.
  else if (programIsSpawnableExe(st.name)) {
    void programSpawnOrAlert(st.name, st.dirName);
  }
  else openNotepad(st.name, st.dirName);
}

function openRecycleBin() {
  openExplorer('RECYCLE');
}

// `homeIcon` is an icon token rather than an HTML entity now, and buildHome
// (apps/browser.js) runs it through iconMarkup. It stays a per-entry field
// rather than being derived from the URL because these are the only favourites
// that get branded art: one a player adds themselves has no icon to use, and
// falls back to the same star the project links carry.
const DEFAULT_BROWSER_FAVORITES = [
  { title: 'Wikipedia: Random', url: 'https://en.wikipedia.org/wiki/Special:Random', homeIcon: 'icon:wikipedia' },
  { title: 'Internet Archive',  url: 'https://archive.org', homeIcon: 'icon:internet-archive' },
  { title: 'Poolsuite FM',      url: 'https://poolsuite.net', homeIcon: 'icon:poolsuite' },
  { title: 'Win98 Icons',       url: 'https://win98icons.alexmeub.com', homeIcon: 'icon:win-icons' },
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


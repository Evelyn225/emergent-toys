// ── Settings bootstrap (must be early so BIOS skip works) ────────
const SETTINGS_KEY = 'sleepOS-settings';
const FORCE_BOOT_SESSION_KEY = 'sleepOS-force-boot';
const osSettings = { crtScanlines: true, videoDither: true, clock12h: false, skipBoot: false, sounds: true, soundVolume: 0.6 };
try { Object.assign(osSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch(e) {}

// ── Registry data ─────────────────────────────────────────────────
const REG_KEY = 'sleepOS-registry';
const SYSTEM_WALLPAPER_DIR = 'SYS\\WALLPAPERS';
const DEFAULT_WALLPAPER_PATH = SYSTEM_WALLPAPER_DIR + '\\DEFAULT.JPG';
const USER_VIDEO_DIR = 'VIDEOS';
const USER_MUSIC_DIR = 'MUSIC';
const PRELOADED_MEDIA_BASE_URL = 'https://pub-1e78b32b6c14474da39103ed015fc3c9.r2.dev';
function encodeAssetPath(path) {
  return String(path || '')
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}
function getPreloadedAssetUrl(objectName, fallbackLocalPath) {
  if (PRELOADED_MEDIA_BASE_URL) {
    return PRELOADED_MEDIA_BASE_URL.replace(/\/+$/, '') + '/' + encodeAssetPath(objectName);
  }
  return encodeAssetPath(fallbackLocalPath || objectName);
}
const SEEDED_HOME_MEDIA = [
  { path: USER_VIDEO_DIR + '\\bunnies and furry friends.mp4', assetUrl: getPreloadedAssetUrl('bunnies and furry friends.mp4', 'videos/bunnies and furry friends.mp4'), kind: 'video', mime: 'video/mp4', size: 421218044 },
  { path: USER_VIDEO_DIR + '\\Dragonball_HG_EP01.mp4', assetUrl: getPreloadedAssetUrl('Dragonball_HG_EP01.mp4', 'videos/Dragonball_HG_EP01.mp4'), kind: 'video', mime: 'video/mp4', size: 306739027 },
  { path: USER_VIDEO_DIR + '\\lain.mp4', assetUrl: getPreloadedAssetUrl('lain-web.mp4', 'videos/lain-web.mp4'), kind: 'video', mime: 'video/mp4', size: 269121971 },
  { path: USER_VIDEO_DIR + '\\Tcz62PMls-I.webm', assetUrl: getPreloadedAssetUrl('Tcz62PMls-I.webm', 'videos/Tcz62PMls-I.webm'), kind: 'video', mime: 'video/webm', size: 2295519 },
  { path: USER_VIDEO_DIR + '\\Theory Of Angel.mkv', assetUrl: getPreloadedAssetUrl('Theory Of Angel.mkv', 'videos/Theory Of Angel.mkv'), kind: 'video', mime: 'video/x-matroska', size: 31040788 },
  { path: USER_MUSIC_DIR + '\\hum.wav', assetUrl: getPreloadedAssetUrl('hum.wav', 'audio/hum.wav'), kind: 'audio', mime: 'audio/wav', size: 12815618, author: 'Alex McCulloch' },
  { path: USER_MUSIC_DIR + '\\Hello There.mp3', assetUrl: getPreloadedAssetUrl('Hello There.mp3', 'audio/Hello there.mp3'), kind: 'audio', mime: 'audio/mpeg', size: 735225, author: 'Alex McCulloch' },
  { path: USER_MUSIC_DIR + '\\Space++.mp3', assetUrl: getPreloadedAssetUrl('Space++.mp3', 'audio/Space++.mp3'), kind: 'audio', mime: 'audio/mpeg', size: 5753711, author: 'Alex McCulloch' },
];
const LEGACY_BUILTIN_WALLPAPER_IDS = new Set(['default', 'magicant', 'hills', 'battle', 'summers', 'saturn', 'cave']);
const SEEDED_WALLPAPERS = [
  { path: DEFAULT_WALLPAPER_PATH, label: 'Default', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/default.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\CITY.JPG', label: 'City', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/city.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\CRAFT.PNG', label: 'Craft', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/craft.png', mime: 'image/png' },
  { path: SYSTEM_WALLPAPER_DIR + '\\DARK.JPG', label: 'Dark', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/dark.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\FOREST.PNG', label: 'Forest', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/forest.png', mime: 'image/png' },
  { path: SYSTEM_WALLPAPER_DIR + '\\HILLS.JPG', label: 'Hills', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/hills.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\OCEAN.GIF', label: 'Ocean', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/ocean.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\POWERLINES.JPG', label: 'Powerlines', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/powerlines.jpg', mime: 'image/jpeg' },
  { path: SYSTEM_WALLPAPER_DIR + '\\REBIRTH.GIF', label: 'Rebirth', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/rebirth.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\SPACE.PNG', label: 'Space', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/space.png', mime: 'image/png' },
  { path: SYSTEM_WALLPAPER_DIR + '\\STATIC.GIF', label: 'Static', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/static.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\WATCHING.GIF', label: 'Watching', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/watching.gif', mime: 'image/gif' },
  { path: SYSTEM_WALLPAPER_DIR + '\\WAVES.GIF', label: 'Waves', assetUrl: 'https://raw.githubusercontent.com/evelyn225/emergent-toys/main/images/wallpapers/waves.gif', mime: 'image/gif' },
];
const SEEDED_WALLPAPER_MAP = new Map(SEEDED_WALLPAPERS.map(item => [item.path, item]));
const registryData = {
  'HKEY_CLASSES_ROOT': {
    'Associations\\Text': {
      '.txt':    { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.md':     { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.json':   { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.js':     { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.css':    { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.html':   { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.log':    { type:'REG_SZ', value:'NOTEPAD.exe' },
      '.script': { type:'REG_SZ', value:'NOTEPAD.exe' },
    },
    'Associations\\Media': {
      '.png':  { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.jpg':  { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.jpeg': { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.gif':  { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.webp': { type:'REG_SZ', value:'IMAGEVIEW.exe' },
      '.mp3':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.wav':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.mp4':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.webm': { type:'REG_SZ', value:'MEDIAPLAY.exe' },
      '.mkv':  { type:'REG_SZ', value:'MEDIAPLAY.exe' },
    },
  },
  'HKEY_SLEEPBOX_MACHINE': {
    'SYSTEM\\CurrentConfig': {
      CRT_SCANLINES:      { type:'REG_DWORD', value: 1 },
      VIDEO_DITHER:       { type:'REG_DWORD', value: 1 },
      CLOCK_FORMAT:       { type:'REG_SZ',    value: '24h' },
    },
    'SOUL\\Metrics': {
      SOUL_INTEGRITY:     { type:'REG_DWORD', value: 87 },
      DAEMON_COUNT:       { type:'REG_DWORD', value: 7  },
      TEMPORAL_DRIFT:     { type:'REG_SZ',    value: '+/-2.3yr' },
    },
    'VOID': {
      VOID_PRESSURE_BASE: { type:'REG_DWORD', value: 12 },
      OBSERVER_COUNT:     { type:'REG_SZ',    value: '[classified]' },
    },
    'Containment': {
      RESPAWN_LOCK:       { type:'REG_DWORD', value: 1 },
      MIRROR_LOCK:        { type:'REG_DWORD', value: 1 },
      ANCHOR_FILE:        { type:'REG_SZ',    value: 'SYS\\anchor.seed' },
    },
  },
  'HKEY_CURRENT_USER': {
    'Desktop': {
      Wallpaper:          { type:'REG_SZ',    value: DEFAULT_WALLPAPER_PATH },
    },
    'SOFTWARE\\sleepOS': {
      SkipBoot:           { type:'REG_DWORD', value: 0 },
      IdleSleepMinutes:   { type:'REG_DWORD', value: 10 },
      SoundEnabled:       { type:'REG_DWORD', value: 1 },
      SoundVolume:        { type:'REG_DWORD', value: 60 },
    },
    'SOFTWARE\\sleepOS\\Daemon': {
      STATUS:             { type:'REG_SZ',    value: 'Dormant' },
      LAST_EVENT:         { type:'REG_SZ',    value: 'none' },
      OBSERVED:           { type:'REG_DWORD', value: 0 },
    },
  },
};

// ── File associations ─────────────────────────────────────────────
// Which app opens a file type is read from HKEY_CLASSES_ROOT at open time,
// so editing the value in REGEDIT.exe actually changes the behaviour. The
// defaults below reproduce what was previously hardcoded, so nothing changes
// until someone edits the registry.
// Deliberately unchecked: any handler may be pointed at any file type. Opening
// a video in NOTEPAD.exe is allowed, the same way a real OS lets you. The only
// thing guarded is the destructive part -- see the blob check in
// vfsWriteFile, which throws EEXIST rather than letting a save shadow the
// binary.
const FILE_HANDLERS = {
  'NOTEPAD.exe':   (name, dir) => openNotepad(name, dir),
  'IMAGEVIEW.exe': (name, dir) => openImageViewer(name, dir),
  'MEDIAPLAY.exe': (name, dir) => {
    // Blob metadata only, so this stays synchronous.
    const st = vfsStatSync(name, dir);
    const kind = st?.blob?.kind || inferBlobKindFromName(name);
    if (kind === 'video') openVideoPlayer(name, dir);
    else openAudioPlayer(name, dir);
  },
  'TERMINAL.exe':  (name, dir) => runScriptInTerminal(name, dir),
  'BROWSER.exe':   () => openBrowser(),
};

// Returns the configured app for a filename's extension, or '' if unassociated.
function getFileAssociation(fileName) {
  const dot = String(fileName || '').lastIndexOf('.');
  if (dot < 0) return '';
  const ext = String(fileName).slice(dot).toLowerCase();
  const hive = registryData['HKEY_CLASSES_ROOT'];
  if (!hive) return '';
  for (const keyPath of Object.keys(hive)) {
    const entry = hive[keyPath][ext];
    if (entry && entry.value) return String(entry.value);
  }
  return '';
}

// Open a file through its registry association. Returns false when there is no
// association or the named app is unknown, so callers keep their own fallback.
function openWithAssociation(fileName, dirName) {
  const app = getFileAssociation(fileName);
  if (!app) return false;
  const key = Object.keys(FILE_HANDLERS).find(k => k.toLowerCase() === app.toLowerCase());
  if (!key) return false;
  FILE_HANDLERS[key](fileName, dirName);
  return true;
}

try {
  const saved = JSON.parse(localStorage.getItem(REG_KEY) || 'null');
  if (saved) {
    Object.keys(saved).forEach(hive => {
      if (!registryData[hive]) return;
      Object.keys(saved[hive]).forEach(path => {
        if (!registryData[hive][path]) return;
        Object.keys(saved[hive][path]).forEach(key => {
          if (registryData[hive][path][key]) registryData[hive][path][key].value = saved[hive][path][key].value;
        });
      });
    });
  }
} catch(e) {}
const DEFAULT_IDLE_SLEEP_MINUTES = 10;
const MIN_IDLE_SLEEP_MINUTES = 1;
function normalizeIdleSleepMinutes(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_IDLE_SLEEP_MINUTES;
  return Math.max(MIN_IDLE_SLEEP_MINUTES, parsed);
}
function getIdleSleepMinutes() {
  return normalizeIdleSleepMinutes(registryData['HKEY_CURRENT_USER']?.['SOFTWARE\\sleepOS']?.IdleSleepMinutes?.value);
}
function getIdleSleepMs() {
  return getIdleSleepMinutes() * 60 * 1000;
}
// Stored as a REG_DWORD percentage because that is what a registry value looks
// like; osSettings.soundVolume carries the 0..1 the gain node wants. REGEDIT
// can be pointed at this key by hand, so anything out of range is clamped
// rather than trusted. DEFAULT_SOUND_VOLUME lives in os/audio.js, which the
// bundle reaches after this file - safe here because nothing calls this during
// evaluation, only from applyRegistrySettings and the Settings window.
function normalizeSoundVolumePercent(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return Math.round(DEFAULT_SOUND_VOLUME * 100);
  return Math.max(0, Math.min(100, parsed));
}
registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS'].IdleSleepMinutes.value = getIdleSleepMinutes();
function saveRegistry() {
  const out = {};
  Object.keys(registryData).forEach(hive => {
    out[hive] = {};
    Object.keys(registryData[hive]).forEach(path => {
      out[hive][path] = {};
      Object.keys(registryData[hive][path]).forEach(key => {
        out[hive][path][key] = { value: registryData[hive][path][key].value };
      });
    });
  });
  try { localStorage.setItem(REG_KEY, JSON.stringify(out)); } catch(e) {}
}
function applyRegistrySettings() {
  const cc = registryData['HKEY_SLEEPBOX_MACHINE']['SYSTEM\\CurrentConfig'];
  const cu = registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS'];
  osSettings.crtScanlines = !!cc.CRT_SCANLINES.value;
  osSettings.videoDither   = !!cc.VIDEO_DITHER.value;
  osSettings.clock12h      = cc.CLOCK_FORMAT.value === '12h';
  osSettings.skipBoot      = !!cu.SkipBoot.value;
  osSettings.sounds        = !!cu.SoundEnabled.value;
  osSettings.soundVolume   = normalizeSoundVolumePercent(cu.SoundVolume.value) / 100;
  cu.IdleSleepMinutes.value = getIdleSleepMinutes();
  saveSettings();
  applySettings();
}

// WALLPAPERS

const WALLPAPER_FILE_PREFIX = 'FILE:';
let currentWallpaper = DEFAULT_WALLPAPER_PATH;

function isWallpaperFileId(id) {
  return typeof id === 'string' && id.startsWith(WALLPAPER_FILE_PREFIX);
}

function normalizeWallpaperPath(path, fallbackDir) {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  if (isWallpaperFileId(raw)) return normalizeWallpaperPath(raw.slice(WALLPAPER_FILE_PREFIX.length), fallbackDir);
  if (LEGACY_BUILTIN_WALLPAPER_IDS.has(raw.toLowerCase())) return DEFAULT_WALLPAPER_PATH;
  const { dirName, fileName } = fsSplitPath(raw, fallbackDir);
  return fileName ? blobRelativePath(dirName, fileName) : '';
}

function isSystemWallpaperPath(path) {
  const normalized = normalizeWallpaperPath(path);
  return normalized === SYSTEM_WALLPAPER_DIR || normalized.startsWith(SYSTEM_WALLPAPER_DIR + '\\');
}

// Wallpaper paths come from the registry and from localStorage, so their case
// may not match the tree. vfsStatSync is case-sensitive for files and blobs, so
// the fallback scan stays - exact hit first, then a case-insensitive sweep.
function findBlobEntryInsensitive(dirName, fileName) {
  if (!fileName) return null;
  const entries = vfsListSync(dirName).filter(entry => entry.kind === 'blob');
  const exact = entries.find(entry => entry.name === fileName);
  if (exact) return exact;
  const target = String(fileName).toUpperCase();
  return entries.find(entry => String(entry.name).toUpperCase() === target) || null;
}

function resolveWallpaperEntry(path, fallbackDir) {
  const normalized = normalizeWallpaperPath(path, fallbackDir);
  if (!normalized) return null;
  const { dirName, fileName } = vfsSplitPath(normalized);
  const entry = findBlobEntryInsensitive(dirName, fileName);
  if (!entry || entry.blob?.kind !== 'image') return null;
  return { dirName, fileName: entry.name, path: blobRelativePath(dirName, entry.name), blob: entry.blob };
}

function getWallpaperRegistryValue() {
  return registryData['HKEY_CURRENT_USER']?.Desktop?.Wallpaper?.value || '';
}

function setWallpaperRegistryValue(path) {
  const entry = registryData['HKEY_CURRENT_USER']?.Desktop?.Wallpaper;
  if (!entry) return;
  entry.value = path;
  saveRegistry();
}

function syncWallpaperSwatches() {
  document.querySelectorAll('.wp-swatch').forEach(swatch => {
    swatch.classList.toggle('wp-selected', swatch.dataset.id === currentWallpaper);
  });
}

function getInitialWallpaperPath() {
  const rawRegistry = String(getWallpaperRegistryValue() || '').trim();
  const rawSaved = String(localStorage.getItem(WP_KEY) || '').trim();
  const registryPath = normalizeWallpaperPath(rawRegistry);
  const savedPath = normalizeWallpaperPath(rawSaved);
  const registryWasLegacyDefault = rawRegistry && LEGACY_BUILTIN_WALLPAPER_IDS.has(rawRegistry.toLowerCase());
  if (savedPath && (!registryPath || registryWasLegacyDefault)) return savedPath;
  return registryPath || savedPath || DEFAULT_WALLPAPER_PATH;
}

function wallpaperFileId(path, fallbackDir) {
  const normalized = normalizeWallpaperPath(path, fallbackDir);
  return normalized ? WALLPAPER_FILE_PREFIX + normalized : '';
}

function wallpaperFilePath(id) {
  return normalizeWallpaperPath(id);
}

function getUploadedWallpaperChoices() {
  const items = [];
  // The final sort below is total, so traversal order does not matter; the
  // directories are still visited in name order to keep the walk stable.
  function walk(dirPath) {
    const entries = vfsListSync(dirPath);
    entries.forEach(entry => {
      if (entry.kind !== 'blob' || entry.blob?.kind !== 'image') return;
      const relPath = blobRelativePath(dirPath, entry.name);
      items.push({
        id: relPath,
        name: (SEEDED_WALLPAPER_MAP.get(relPath) || {}).label || entry.name.replace(/\.[^.]+$/, ''),
        path: relPath,
        url: entry.blob.url,
        system: isSystemWallpaperPath(relPath),
      });
    });
    entries
      .filter(entry => entry.kind === 'dir')
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b))
      .forEach(subName => walk(dirPath ? dirPath + '\\' + subName : subName));
  }
  walk('');
  return items.sort((a, b) => {
    if (a.system !== b.system) return a.system ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
}

function renderWallpaperSwatch(grid, choice) {
  const item = document.createElement('div');
  item.dataset.id = choice.id;
  item.className = 'wp-swatch' + (choice.id === currentWallpaper ? ' wp-selected' : '');
  item.title = `C:\\sleepOS\\${choice.path}`;
  item.style.cssText = 'cursor:default;display:flex;flex-direction:column;align-items:center;gap:3px;';

  const thumb = document.createElement('div');
  thumb.className = 'wp-thumb';
  thumb.style.cssText = 'width:72px;height:50px;box-sizing:border-box;overflow:hidden;flex-shrink:0;background:#c0c0c0;';

  const img = document.createElement('img');
  img.src = choice.url;
  img.alt = choice.name;
  img.draggable = false;
  thumb.appendChild(img);

  const label = document.createElement('div');
  label.style.cssText = 'font-size:10px;text-align:center;line-height:1.25;max-width:84px;word-break:break-word;';
  label.textContent = choice.name;
  item.appendChild(thumb);
  item.appendChild(label);

  const meta = document.createElement('div');
  meta.textContent = choice.path.replace(/\\[^\\]+$/, '') || 'Root';
  meta.style.cssText = 'font-size:9px;color:#555;text-align:center;line-height:1.1;max-width:84px;word-break:break-word;';
  item.appendChild(meta);

  item.addEventListener('click', () => applyWallpaper(choice.path));
  grid.appendChild(item);
}

function renderWallpaperSection(gridId, choices, emptyText) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (!choices.length) {
    grid.innerHTML = `<div style="grid-column:1 / -1;padding:8px 10px;border:2px solid;border-color:#808080 #fff #fff #808080;background:#d4d0c8;font-size:10px;line-height:1.4;">${emptyText}</div>`;
    return;
  }
  choices.forEach(choice => renderWallpaperSwatch(grid, choice));
}

function renderAppearanceWindow() {
  const body = document.getElementById('wb-appearance');
  if (!body) return;
  const choices = getUploadedWallpaperChoices();
  const systemWallpapers = choices.filter(choice => choice.system);
  const otherWallpapers = choices.filter(choice => !choice.system);
  body.style.cssText = 'padding:10px;overflow:auto;';
  body.innerHTML = `
    <div style="font-size:11px;margin-bottom:8px;">Wallpaper</div>
    <div style="font-size:10px;font-weight:bold;margin-bottom:4px;">SYS\\WALLPAPERS</div>
    <div id="wp-grid-system" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;"></div>
    <div style="font-size:10px;font-weight:bold;margin-bottom:4px;">Other Image Files</div>
    <div id="wp-grid-uploaded" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;"></div>
    <div id="wp-upload-note" style="font-size:10px;line-height:1.4;margin-top:10px;color:#333;"></div>`;

  renderWallpaperSection('wp-grid-system', systemWallpapers, 'System wallpaper files will appear here.');
  renderWallpaperSection('wp-grid-uploaded', otherWallpapers, 'Upload an image anywhere in File Explorer, or add more files under SYS\\WALLPAPERS.');
  const note = document.getElementById('wp-upload-note');
  note.textContent = 'Right-click any image to set it as your wallpaper.';
}

function refreshAppearanceWindow() {
  if (document.getElementById('wb-appearance')) renderAppearanceWindow();
}

function applyWallpaperColorFallback() {
  const bg = document.getElementById('desktop-bg');
  if (!bg) return false;
  currentWallpaper = '';
  bg.style.cssText = 'background:#008080;';
  syncWallpaperSwatches();
  return false;
}

function applyWallpaper(path, options = {}) {
  const { deferMissing = false, updateRegistry = true } = options;
  const bg = document.getElementById('desktop-bg');
  if (!bg) return false;

  const resolved = resolveWallpaperEntry(path);
  if (resolved) {
    currentWallpaper = resolved.path;
    bg.style.cssText = `background-color:#c0c0c0;background-image:url("${resolved.blob.url}");background-position:center;background-size:cover;background-repeat:no-repeat;`;
    try { localStorage.setItem(WP_KEY, resolved.path); } catch (e) {}
    if (updateRegistry) setWallpaperRegistryValue(resolved.path);
    syncWallpaperSwatches();
    return true;
  }

  return applyWallpaperColorFallback();
}

function handleWallpaperFileRename(dirPath, oldName, newName) {
  const oldPath = normalizeWallpaperPath(blobRelativePath(dirPath, oldName));
  const newPath = normalizeWallpaperPath(blobRelativePath(dirPath, newName));
  const savedPath = normalizeWallpaperPath(localStorage.getItem(WP_KEY));
  const registryPath = normalizeWallpaperPath(getWallpaperRegistryValue());
  if (currentWallpaper === oldPath || savedPath === oldPath || registryPath === oldPath) {
    applyWallpaper(newPath);
  } else {
    refreshAppearanceWindow();
  }
}

function handleWallpaperFileDelete(dirPath, name) {
  const deletedPath = normalizeWallpaperPath(blobRelativePath(dirPath, name));
  const savedPath = normalizeWallpaperPath(localStorage.getItem(WP_KEY));
  const registryPath = normalizeWallpaperPath(getWallpaperRegistryValue());
  if (currentWallpaper === deletedPath || savedPath === deletedPath || registryPath === deletedPath) {
    applyWallpaper(DEFAULT_WALLPAPER_PATH);
  } else {
    refreshAppearanceWindow();
  }
}

function openAppearance() {
  if (!mkWin({ id:'appearance', title:'Appearance', icon:'\u{1F5BC}\uFE0F', w:410, h:360, x:130, y:90, menubar:false, statusbar:false }) && !document.getElementById('wb-appearance')) return;
  renderAppearanceWindow();
}

function openSettings() {
  // 316 = 18px titlebar + 4px borders + the panel's exact content height. The
  // old 294 already left ~70px of dead space below the footer; adding the
  // Sound section without re-measuring would have kept it.
  if (!mkWin({ id:'settings', title:'Settings', icon:'\u2699\uFE0F', w:390, h:316, x:145, y:95, menubar:false, statusbar:false })) return;
  const body = document.getElementById('wb-settings');
  body.className = 'win-body st-panel';

  body.innerHTML =     `<div class="st-section">Display</div>
     <div class="st-row"><div class="st-label">CRT scan lines</div><button class="st-toggle" data-setting="crtScanlines"></button></div>
     <div class="st-row"><div class="st-label">Video dithering</div><button class="st-toggle" data-setting="videoDither"></button></div>
     <div class="st-section">Sound</div>
     <div class="st-row"><div class="st-label">System sounds</div><button class="st-toggle" data-setting="sounds"></button></div>
     <div class="st-row"><div class="st-label">Volume</div><div class="st-vol vp-vol-blocks" id="settings-volume" role="slider" tabindex="0" aria-label="System volume" aria-valuemin="0" aria-valuemax="100" title="System volume"></div></div>
     <div class="st-section">System</div>
     <div class="st-row"><div class="st-label">12-hour clock</div><button class="st-toggle" data-setting="clock12h"></button></div>

     <div class="st-row"><div class="st-label">Skip boot screen</div><button class="st-toggle" data-setting="skipBoot"></button></div>
     <div class="st-footer">
       <button class="dlg-btn primary" id="settings-open-appearance">Open Appearance</button>
       <button class="dlg-btn" id="settings-close">Close</button>
     </div>`;

  // \u2500\u2500 Volume, drawn as the media player's block meter \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const VOL_BLOCKS = 10;
  const volEl = document.getElementById('settings-volume');
  let volDragging = false;

  function renderVolume() {
    const filled = osSettings.sounds ? Math.round(getSystemVolume() * VOL_BLOCKS) : 0;
    volEl.innerHTML =
      `<span style="color:#000080">${'&#9632;'.repeat(filled)}</span>` +
      `<span style="color:#6a6a6a">${'&#9643;'.repeat(VOL_BLOCKS - filled)}</span>`;
    volEl.classList.toggle('off', !osSettings.sounds);
    volEl.setAttribute('aria-valuenow', String(Math.round(getSystemVolume() * 100)));
  }

  // Quantised to the blocks that are actually drawn: clicking a block should
  // land on that block, not on a continuous value that rounds to its neighbour.
  function setVolumeStep(step) {
    const clamped = Math.max(0, Math.min(VOL_BLOCKS, step));
    osSettings.soundVolume = clamped / VOL_BLOCKS;
    // Dragging a muted slider upwards unmutes, the way every OS mixer does.
    if (clamped > 0 && !osSettings.sounds) osSettings.sounds = true;
  }

  // Live during a drag, but nothing is written to disk until the pointer is
  // released - saveSettings and saveRegistry both hit localStorage, and
  // pointermove fires at frame rate.
  function previewVolume(clientX) {
    // Measured against the content box, not the border box: the blocks are
    // drawn inside 2px of bevel and 6px of padding, and mapping the pointer
    // across the full width would land a click a block away from the one it
    // was aimed at near either end.
    const r = volEl.getBoundingClientRect();
    const cs = getComputedStyle(volEl);
    const inset = n => parseFloat(cs.getPropertyValue(n)) || 0;
    const left = r.left + inset('border-left-width') + inset('padding-left');
    const width = Math.max(1, r.width - inset('border-left-width') - inset('border-right-width')
                                      - inset('padding-left') - inset('padding-right'));
    setVolumeStep(Math.round(((clientX - left) / width) * VOL_BLOCKS));
    applySystemAudioSettings();
    renderVolume();
  }

  function commitVolume() {
    saveSettings();
    applySettings();
    refresh();
    playSound('click');
  }

  // Pointer capture instead of document-level move/up listeners: those would
  // outlive the window and stack up one pair per Settings open.
  volEl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    volDragging = true;
    try { volEl.setPointerCapture(e.pointerId); } catch (err) {}
    previewVolume(e.clientX);
  });
  volEl.addEventListener('pointermove', e => { if (volDragging) previewVolume(e.clientX); });
  volEl.addEventListener('pointerup', e => {
    if (!volDragging) return;
    volDragging = false;
    try { volEl.releasePointerCapture(e.pointerId); } catch (err) {}
    commitVolume();
  });
  volEl.addEventListener('pointercancel', () => {
    if (!volDragging) return;
    volDragging = false;
    commitVolume();
  });
  volEl.addEventListener('keydown', e => {
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1
              : (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    setVolumeStep(Math.round(getSystemVolume() * VOL_BLOCKS) + dir);
    commitVolume();
  });

  function refresh() {
    body.querySelectorAll('[data-setting]').forEach(btn => {
      const key = btn.dataset.setting;
      const enabled = !!osSettings[key];
      btn.classList.toggle('on', enabled);
      btn.textContent = enabled ? 'ON' : 'OFF';
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    });
    renderVolume();
  }

  body.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.setting;
      osSettings[key] = !osSettings[key];
      saveSettings();
      applySettings();
      refresh();
      // The click feedback on this button fires at pointerdown, while sound is
      // still off, so switching it on would otherwise be silent - the one
      // control whose effect you most want to hear.
      if (key === 'sounds' && osSettings.sounds) playSound('click');
    });
  });

  document.getElementById('settings-open-appearance').addEventListener('click', openAppearance);
  document.getElementById('settings-close').addEventListener('click', () => closeWin('settings'));
  refresh();
}

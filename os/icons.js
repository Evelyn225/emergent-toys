// ─────────────────────────────────────────────────────────────────
// ICON REGISTRY
// ─────────────────────────────────────────────────────────────────
// Icon values travel through the OS as opaque strings: DESKTOP_ICONS entries
// carry one, mkWin takes one, osAlert takes one, resolveFsIcon returns one, and
// desktop shortcuts persist one into localStorage. Every one of those strings
// used to be an emoji, injected straight into innerHTML.
//
// A token ('icon:notepad') names a PNG in os/icons/. Anything else is still
// rendered as text, so the twenty-five PROJECTS emoji, the Start button, and
// any shortcut already persisted under the old scheme keep working untouched -
// and an unmapped emoji upgrades to art the moment a key is added below.
//
// ALWAYS render an icon value through iconMarkup(). Assigning one to
// textContent prints the raw token.
const OS_ICON_BASE = 'os/icons/';
const OS_ICON_TOKEN = 'icon:';
const OS_ICONS = {
  // ── Programs ──────────────────────────────────────────────────
  terminal:      'console_prompt-0.png',
  notepad:       'notepad-1.png',
  browser:       'browser.png',
  calc:          'calculator-0.png',
  sysmon:        'chart1-4.png',
  regedit:       'regedit-0.png',
  defrag:        'clean_drive.png',
  explorer:      'directory_open_file_mydocs-0.png',
  settings:      'settings.png',
  daemon:        'daemon_eye.png',
  void:          'void.png',
  // ── Filesystem ────────────────────────────────────────────────
  folder:        'directory_closed-0.png',
  'folder-open': 'directory_open_file_mydocs-0.png',
  text:          'file_lines-0.png',
  script:        'executable_script-1.png',
  exe:           'executable_script-1.png',
  image:         'image.png',
  video:         'media.png',
  audio:         'music.png',
  unknown:       'unknown-file.png',
  // The bare drive, as opposed to `defrag`'s drive-being-cleaned.
  disk:          'hard_disk_drive-0.png',
  lock:          'key_padlock-0.png',
  upload:        'upload.png',
  // ── Shell ─────────────────────────────────────────────────────
  'recycle-empty': 'recycle_bin_empty-0.png',
  'recycle-full':  'recycle_bin_full-0.png',
  home:          'homepage_alt.png',
  star:          'star.png',
  network:       'network.png',
  standby:       'standby_icon.png',
  // ── Dialogs ───────────────────────────────────────────────────
  warning:       'warning.png',
  error:         'restricted.png',
  // `info` is the identity of a thing (Properties, About); `tip` is advice, and
  // is what a bare osAlert falls back to.
  info:          'info.png',
  tip:           'tip.png',
  success:       'checkmark.png',
};

function osIconKey(value) {
  const s = String(value == null ? '' : value);
  if (!s.startsWith(OS_ICON_TOKEN)) return '';
  const key = s.slice(OS_ICON_TOKEN.length);
  return Object.prototype.hasOwnProperty.call(OS_ICONS, key) ? key : '';
}
function isOsIcon(value) {
  return !!osIconKey(value);
}
function osIconSrc(value) {
  const key = osIconKey(value);
  return key ? OS_ICON_BASE + OS_ICONS[key] : '';
}
// The `alt` is deliberately empty: every icon in this OS sits beside a text
// label that already names the thing, so alt text would only double it up.
function iconMarkup(value) {
  const key = osIconKey(value);
  if (key) return '<img class="os-icon" src="' + OS_ICON_BASE + OS_ICONS[key] + '" alt="" draggable="false">';
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// For the callers that build DOM nodes instead of HTML strings.
function setIconContent(el, value) {
  if (!el) return el;
  el.innerHTML = iconMarkup(value);
  return el;
}

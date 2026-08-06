// ── Wallpaper persistence ─────────────────────────────────────────
const WP_KEY = 'sleepOS-wallpaper';

// ── Settings helpers ──────────────────────────────────────────────
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(osSettings)); } catch(e) {}
}

function applySettings() {
  const crt = document.getElementById('crt');
  if (crt) crt.style.display = osSettings.crtScanlines ? '' : 'none';
  document.querySelectorAll('.vp-dither').forEach(d => d.style.display = osSettings.videoDither ? '' : 'none');
  updateClock();
  // Keep registry in sync with settings
  if (typeof registryData !== 'undefined') {
    const cc = registryData['HKEY_SLEEPBOX_MACHINE']['SYSTEM\\CurrentConfig'];
    const cu = registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS'];
    if (cc) {
      cc.CRT_SCANLINES.value = osSettings.crtScanlines ? 1 : 0;
      cc.VIDEO_DITHER.value  = osSettings.videoDither  ? 1 : 0;
      cc.CLOCK_FORMAT.value  = osSettings.clock12h ? '12h' : '24h';
    }
    if (cu) {
      cu.SkipBoot.value = osSettings.skipBoot ? 1 : 0;
      cu.IdleSleepMinutes.value = getIdleSleepMinutes();
    }
    saveRegistry();
  }
}

document.addEventListener('fs-changed', refreshAppearanceWindow);


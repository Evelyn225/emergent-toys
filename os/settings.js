// ── Wallpaper persistence ─────────────────────────────────────────
const WP_KEY = 'sleepOS-wallpaper';

// ── Settings helpers ──────────────────────────────────────────────
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(osSettings)); } catch(e) {}
}

function applySettings() {
  crtApply(osSettings.crtEffect);
  document.querySelectorAll('.vp-dither').forEach(d => d.style.display = osSettings.videoDither ? '' : 'none');
  updateClock();
  // Keep registry in sync with settings
  if (typeof registryData !== 'undefined') {
    const cc = registryData['HKEY_SLEEPBOX_MACHINE']['SYSTEM\\CurrentConfig'];
    const cu = registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS'];
    if (cc) {
      cc.CRT_EFFECT.value    = osSettings.crtEffect    ? 1 : 0;
      cc.VIDEO_DITHER.value  = osSettings.videoDither  ? 1 : 0;
      cc.CLOCK_FORMAT.value  = osSettings.clock12h ? '12h' : '24h';
    }
    if (cu) {
      cu.SkipBoot.value = osSettings.skipBoot ? 1 : 0;
      cu.IdleSleepMinutes.value = getIdleSleepMinutes();
      cu.SoundEnabled.value = osSettings.sounds ? 1 : 0;
      cu.SoundVolume.value = Math.round(getSystemVolume() * 100);
    }
    saveRegistry();
  }
  applySystemAudioSettings();
  renderTraySound();
  // The single funnel every settings change already runs through - the Settings
  // window, REGEDIT, and the tray mixer all end here - so it is the one place
  // that can tell an open window its controls are stale. Any listener must only
  // read osSettings and redraw; calling back into applySettings would recurse.
  document.dispatchEvent(new CustomEvent('os-settings-changed'));
}

document.addEventListener('fs-changed', refreshAppearanceWindow);


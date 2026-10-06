// Check quietly at launch. Downloads are an explicit pause-menu action; the game also works offline.
let desktopUpdate = null, desktopUpdateState = 'idle';
function showDesktopUpdate(el) {
  const button = el.querySelector('[data-act="update"]'), status = el.querySelector('[data-update-status]');
  button.disabled = desktopUpdateState === 'checking';
  button.textContent = 'Check for updates';
  if (desktopUpdate) button.textContent = `Download Glyphport ${desktopUpdate.version}`;
  else if (desktopUpdateState === 'checking') button.textContent = 'Checking for updates...';
  const installed = window.__GLYPHPORT_VERSION__;
  status.textContent = '';
  if (desktopUpdateState === 'download-failed') status.textContent = 'Could not open the download. Try again.';
  else if (desktopUpdate) status.textContent = `Version ${desktopUpdate.version} is available. Run the downloaded installer to update.`;
  else if (desktopUpdateState === 'current') status.textContent = `Glyphport ${installed} is up to date.`;
  else if (desktopUpdateState === 'unavailable') status.textContent = 'Could not check for updates. Try again when online.';
}
async function checkDesktopUpdates() {
  if (!GLYPHPORT_DESKTOP_APP || desktopUpdateState === 'checking') return;
  desktopUpdateState = 'checking';
  if (pauseEl) pauseEl.show();
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.github.com/repos/Evelyn225/emergent-toys/releases?per_page=100', {
      headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal
    });
    if (!response.ok) throw new Error('Release check failed');
    desktopUpdate = desktopReleaseUpdate(await response.json(), window.__GLYPHPORT_VERSION__);
    desktopUpdateState = desktopUpdate ? 'available' : 'current';
    if (desktopUpdate) say(`Glyphport ${desktopUpdate.version} is available. Open the pause menu to download it.`, 8);
  } catch (error) {
    desktopUpdateState = 'unavailable';
  } finally {
    clearTimeout(timeout);
    if (pauseEl) pauseEl.show();
  }
}
async function desktopUpdateAction() {
  if (!desktopUpdate) return checkDesktopUpdates();
  try {
    await window.__TAURI__.core.invoke('open_game_update', { version: desktopUpdate.version });
  } catch (error) {
    desktopUpdateState = 'download-failed';
    if (pauseEl) pauseEl.show();
  }
}
if (GLYPHPORT_DESKTOP_APP) Promise.resolve().then(checkDesktopUpdates);

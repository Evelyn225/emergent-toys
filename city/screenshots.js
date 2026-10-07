// Capture the rendered game, including the HUD, without DOM menus or OS dialogs.
let screenshotBusy = false, screenshotNotice = null, screenshotNoticeTimer = null;
function showScreenshotNotice(text) {
  if (!screenshotNotice) {
    screenshotNotice = document.createElement('div');
    screenshotNotice.setAttribute('role', 'status');
    screenshotNotice.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:1000;max-width:calc(100vw - 48px);padding:10px 14px;background:#101018;color:#fff;border:1px solid #777;font:13px monospace;overflow-wrap:anywhere;pointer-events:none';
    document.body.appendChild(screenshotNotice);
  }
  screenshotNotice.textContent = text;
  screenshotNotice.hidden = false;
  clearTimeout(screenshotNoticeTimer);
  screenshotNoticeTimer = setTimeout(() => screenshotNotice.hidden = true, 6000);
}
async function takeScreenshot() {
  if (screenshotBusy) return;
  screenshotBusy = true;
  try {
    const blob = await new Promise((resolve, reject) => {
      cv.toBlob(value => {
        if (value) resolve(value);
        else reject(new Error('Could not capture the game view.'));
      }, 'image/png');
    });
    if (GLYPHPORT_DESKTOP_APP) {
      if (!window.__TAURI__?.core?.invoke) throw new Error('Please update the desktop app to save screenshots.');
      const png = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const path = await window.__TAURI__.core.invoke('save_screenshot', { png });
      showScreenshotNotice(`Screenshot saved: ${path}`);
    } else {
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url;
      link.download = `Glyphport-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      document.body.appendChild(link);
      link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      showScreenshotNotice('Screenshot downloaded.');
    }
  } catch (error) {
    showScreenshotNotice(`Screenshot could not be saved. ${error.message || error}`);
  } finally {
    screenshotBusy = false;
  }
}
// Capture phase also works while a dev-tool text field owns keyboard input.
document.addEventListener('keydown', e => {
  if (e.code !== 'F12') return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (!e.repeat) takeScreenshot();
}, true);

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const PAGE = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser.close(); });
async function withDesktop(fn, { offline = false, version = '1.0.4' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__GLYPHPORT_DESKTOP__ = true;
    window.__GLYPHPORT_VERSION__ = '1.0.3';
    window.nativeCalls = [];
    window.__TAURI__ = {
      core: { invoke: async (command, args) => {
        window.nativeCalls.push({ command, ...args });
        if (command === 'set_game_mouse_capture' && args.active && window.deferCapture) return new Promise(resolve => { window.resolveCapture = resolve; });
        return command === 'set_game_mouse_capture' ? !window.failCapture : true;
      } },
      event: { listen: async (event, callback) => { window.nativeMouse = callback; return () => {}; } }
    };
  });
  await page.route('https://api.github.com/repos/Evelyn225/emergent-toys/releases?per_page=100', route => offline ? route.abort() : route.fulfill({
    json: [{ tag_name: 'ascii-city-v' + version, assets: [{ name: 'Glyphport-Setup.exe', browser_download_url: `https://github.com/Evelyn225/emergent-toys/releases/download/ascii-city-v${version}/Glyphport-Setup.exe` }] }]
  }));
  try {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof lockMouse === 'function' && desktopUpdateState !== 'checking');
    await fn(page);
    assert.deepEqual(errors, [], 'the desktop flow has no runtime errors');
  } finally { await context.close(); }
}
test('Escape resumes native capture and raw mouse motion turns the player; pausing and blur release it', () => withDesktop(async page => {
  await page.evaluate(() => openPause());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => desktopMouseCaptured && !paused);
  const motion = await page.evaluate(() => {
    const before = a;
    window.nativeMouse({ payload: [140, 0] });
    return { turn: a - before, cursor: cv.style.cursor, pointer: document.pointerLockElement === null };
  });
  assert.ok(Math.abs(motion.turn) > .1);
  assert.equal(motion.cursor, 'none');
  assert.equal(motion.pointer, true, 'Escape capture does not depend on browser pointer lock');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => paused && !desktopMouseCaptured && window.nativeCalls.at(-1)?.active === false);
  assert.equal(await page.evaluate(() => cv.style.cursor), '');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => desktopMouseCaptured);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => paused && !desktopMouseCaptured && window.nativeCalls.at(-1)?.active === false);
}));
test('a pending native capture cannot recapture the mouse after a rapid Escape pause', () => withDesktop(async page => {
  await page.evaluate(() => { openPause(); window.deferCapture = true; });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => typeof window.resolveCapture === 'function');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.resolveCapture(true));
  await page.waitForFunction(() => window.nativeCalls.at(-1)?.active === false);
  assert.deepEqual(await page.evaluate(() => [paused, desktopMouseCaptured, desktopMouseWanted, cv.style.cursor]), [true, false, false, '']);
}));
test('failed native capture tries browser pointer lock rather than silently accepting bounded movement', () => withDesktop(async page => {
  await page.evaluate(() => {
    openPause(); window.failCapture = true; window.pointerAttempts = 0;
    cv.requestPointerLock = () => { window.pointerAttempts++; return Promise.reject(Error('unavailable')); };
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.pointerAttempts > 0 && desktopMouseFallback);
  assert.match(await page.evaluate(() => msgText), /Click the game to retry/);
}));
test('launch update check offers the official newer installer through native IPC', () => withDesktop(async page => {
  assert.equal(await page.evaluate(() => desktopUpdate.version), '1.0.4');
  await page.evaluate(() => openPause());
  assert.equal(await page.locator('[data-act="update"]').textContent(), 'Download Glyphport 1.0.4');
  await page.click('[data-act="update"]');
  await page.waitForFunction(() => window.nativeCalls.some(call => call.command === 'open_game_update' && call.version === '1.0.4'));
}));
test('offline update checks allow play and can be retried in the pause menu', () => withDesktop(async page => {
  assert.equal(await page.evaluate(() => desktopUpdateState), 'unavailable');
  await page.evaluate(() => openPause());
  assert.match(await page.locator('[data-update-status]').textContent(), /Try again when online/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => desktopMouseCaptured && !paused);
}, { offline: true }));
test('an installed current desktop version does not offer an older download', () => withDesktop(async page => {
  await page.evaluate(() => openPause());
  assert.match(await page.locator('[data-update-status]').textContent(), /1.0.3 is up to date/);
  assert.equal(await page.locator('[data-act="update"]').textContent(), 'Check for updates');
}, { version: '1.0.2' }));

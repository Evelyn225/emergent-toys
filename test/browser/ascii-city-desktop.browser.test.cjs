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
        if (command === 'save_screenshot') {
          if (window.failScreenshot) throw new Error('The Screenshots folder is not writable.');
          if (window.deferScreenshot) return new Promise(resolve => { window.resolveScreenshot = resolve; });
          return 'C:\\Games\\Glyphport\\Screenshots\\Glyphport-test.png';
        }
        if (command === 'open_screenshot_folder' && window.failOpenFolder) throw new Error('Windows could not open the folder.');
        if (command === 'set_game_mouse_capture' && args.active && window.deferCapture) return new Promise(resolve => { window.resolveCapture = resolve; });
        return command === 'set_game_mouse_capture' ? !window.failCapture : true;
      } },
      event: { listen: async (event, callback) => {
        if (event === 'desktop-mouse-delta') window.nativeMouse = callback;
        if (event === 'desktop-mouse-released') window.nativeMouseReleased = callback;
        return () => {};
      } }
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
test('F12 saves a PNG through native IPC in freecam without releasing capture or downloading', () => withDesktop(async page => {
  const downloads = [];
  page.on('download', download => downloads.push(download));
  await page.evaluate(async () => { toggleFreecam(); await lockMouse(); window.deferScreenshot = true; });
  await page.waitForFunction(() => desktopMouseCaptured);
  await page.keyboard.down('F12');
  await page.waitForFunction(() => typeof window.resolveScreenshot === 'function');
  await page.keyboard.down('F12'); // key repeat cannot save another copy
  await page.keyboard.up('F12');
  await page.evaluate(() => takeScreenshot()); // concurrent capture is ignored too
  const image = await page.evaluate(async () => {
    const calls = window.nativeCalls.filter(call => call.command === 'save_screenshot');
    const bytes = new Uint8Array(calls[0].png);
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    return { count: calls.length, signature: Array.from(bytes.slice(0, 8)), width: image.width, height: image.height,
      canvas: [cv.width, cv.height], captured: desktopMouseCaptured, paused, freecam: !!freecam };
  });
  assert.equal(image.count, 1);
  assert.deepEqual(image.signature, [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual([image.width, image.height], image.canvas);
  assert.equal(image.captured, true);
  assert.equal(image.paused, false);
  assert.equal(image.freecam, true);
  await page.evaluate(() => window.resolveScreenshot('C:\\Games\\Glyphport\\Screenshots\\photo.png'));
  await page.waitForFunction(() => !screenshotBusy);
  assert.match(await page.locator('[role="status"]').textContent(), /Screenshots\\photo\.png/);
  assert.equal(downloads.length, 0);
}));

test('pause button and focused dev tools capture screenshots; save errors stay in the game and can be retried', () => withDesktop(async page => {
  await page.evaluate(() => { openPause(); window.failScreenshot = true; });
  await page.click('[data-act="screenshot"]');
  await page.waitForFunction(() => !screenshotBusy && screenshotNotice?.textContent.includes('not writable'));
  assert.equal(await page.evaluate(() => paused), true);
  await page.evaluate(() => window.failScreenshot = false);
  await page.click('[data-act="screenshot"]');
  await page.waitForFunction(() => !screenshotBusy && screenshotNotice?.textContent.includes('Screenshot saved:'));
  await page.keyboard.press('F2');
  await page.locator('#dev .search').focus();
  const before = await page.evaluate(() => window.nativeCalls.filter(call => call.command === 'save_screenshot').length);
  await page.keyboard.press('F12');
  await page.waitForFunction(count => !screenshotBusy && window.nativeCalls.filter(call => call.command === 'save_screenshot').length === count + 1, before);
  assert.equal(await page.evaluate(() => devOpen()), true);
}));

test('browser screenshot downloads a real PNG with F12 and the pause menu button', async () => {
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
  try {
    const page = await context.newPage();
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof takeScreenshot === 'function');
    await page.evaluate(() => openPause());
    assert.equal(await page.locator('[data-act="screenshot-folder"]').isVisible(), false);
    await page.evaluate(() => closePause(false));
    for (const trigger of [() => page.keyboard.press('F12'), async () => {
      await page.evaluate(() => openPause());
      await page.click('[data-act="screenshot"]');
    }]) {
      const downloadPromise = page.waitForEvent('download');
      await trigger();
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(), /^Glyphport-.*\.png$/);
      assert.equal(await download.failure(), null);
      const bytes = require('node:fs').readFileSync(await download.path());
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(bytes.readUInt32BE(16), 960);
      assert.equal(bytes.readUInt32BE(20), 640);
      await page.waitForFunction(() => !screenshotBusy);
    }
  } finally { await context.close(); }
});

test('desktop folder button sits beside screenshot and opens the fixed native folder while remaining paused', () => withDesktop(async page => {
  await page.evaluate(() => openPause());
  const screenshot = await page.locator('[data-act="screenshot"]').boundingBox();
  const folder = await page.locator('[data-act="screenshot-folder"]').boundingBox();
  assert.ok(folder.x > screenshot.x + screenshot.width - 1);
  assert.ok(Math.abs(folder.y - screenshot.y) < 3, 'the buttons share a row');
  await page.click('[data-act="screenshot-folder"]');
  await page.waitForFunction(() => !screenshotFolderBusy && window.nativeCalls.some(call => call.command === 'open_screenshot_folder'));
  assert.deepEqual(await page.evaluate(() => window.nativeCalls.find(call => call.command === 'open_screenshot_folder')), { command: 'open_screenshot_folder' });
  assert.equal(await page.evaluate(() => paused && !desktopMouseCaptured), true);
  await page.evaluate(() => window.failOpenFolder = true);
  await page.click('[data-act="screenshot-folder"]');
  await page.waitForFunction(() => !screenshotFolderBusy && screenshotNotice?.textContent.includes('Could not open'));
  assert.equal(await page.locator('[data-act="screenshot-folder"]').isEnabled(), true, 'an opener failure allows retry');
}));

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
  assert.equal(await page.evaluate(() => 'confined' in window.nativeCalls.at(-1)), false, 'pausing never requests continued window confinement');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => desktopMouseCaptured);
  await page.evaluate(() => window.nativeMouseReleased());
  await page.waitForFunction(() => paused && !desktopMouseCaptured && window.nativeCalls.at(-1)?.active === false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => desktopMouseCaptured);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => paused && !desktopMouseCaptured);
}));

test('desktop Quit game saves before closing the native app and releases capture first', () => withDesktop(async page => {
  await page.evaluate(() => { money=4321; openPause(); });
  assert.equal(await page.locator('[data-act="quit"]').textContent(), 'Quit game');
  assert.equal(await page.locator('#pause a[href="index.html"]').count(), 0);
  await page.click('[data-act="quit"]');
  await page.waitForFunction(() => window.nativeCalls.some(c=>c.command==='quit_game'));
  const result = await page.evaluate(() => ({
    money:JSON.parse(localStorage.getItem(SAVE_KEY)).money,
    calls:window.nativeCalls.slice(-2),captured:desktopMouseCaptured
  }));
  assert.equal(result.money,4321);
  assert.deepEqual(result.calls,[{command:'set_game_mouse_capture',active:false},{command:'quit_game'}]);
  assert.equal(result.captured,false);
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

test('desktop freecam uses native mouse look and releases capture on Escape', () => withDesktop(async page => {
  await page.keyboard.press('F2');
  await page.click('#dev [data-tab="camera"]');
  await page.getByRole('switch', { name: 'Freecam: off' }).click();
  await page.waitForFunction(() => !!freecam && desktopMouseCaptured && !paused);
  const result = await page.evaluate(() => {
    const before = [px, py, a, pitch], camera = { ...freecam };
    window.nativeMouse({ payload: [120, -140] });
    return { before, after: [px, py, a, pitch], yaw: freecam.yaw - camera.yaw, pitch: freecam.pitch - camera.pitch };
  });
  assert.deepEqual(result.before, result.after);
  assert.ok(result.yaw > .3 && result.pitch > .2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => paused && !desktopMouseCaptured);
  assert.ok(await page.evaluate(() => !!freecam));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !paused && desktopMouseCaptured);
  await page.keyboard.press('F2');
  await page.getByRole('switch', { name: 'Freecam: on' }).click();
  await page.waitForFunction(() => !freecam && !paused && desktopMouseCaptured);
}));

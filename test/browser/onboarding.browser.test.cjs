'use strict';
// Browser coverage for the things a first-time visitor meets: whether anything
// tells them what this is, whether they can turn the sound off, whether the OS
// remembers where they put a window, and whether they can start over.
//
// None of it is reachable from the node suite. Every one of these depends on a
// real boot sequence, a real localStorage that survives a reload, or a real
// click landing on a real element - the three things test/*.cjs cannot see.
const test = require('node:test');
const assert = require('node:assert');
const {
  startHarness, openDesktop, openWindow, rebootDesktop, factoryReset, rectOf, stateOf,
} = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

async function withDesktop(opts, fn) {
  const { context, page } = await openDesktop(harness.browser, opts);
  try { await fn(page); } finally { await context.close(); }
}

const winTitles = page => page.evaluate(() => Object.values(wins).map(w => w.title));

// ── First run ────────────────────────────────────────────────────

test('the first boot of a fresh install opens WELCOME.README by itself', async () => {
  await withDesktop({ firstRun: true }, async page => {
    const titles = await winTitles(page);
    assert.ok(titles.some(t => /WELCOME\.README/.test(t)),
      'a stranger gets a desktop of unlabelled icons and no explanation; open windows were: ' + titles.join(', '));
  });
});

test('the welcome does not reopen on the next boot', async () => {
  await withDesktop({ firstRun: true }, async page => {
    assert.ok((await winTitles(page)).some(t => /WELCOME\.README/.test(t)), 'precondition: it opened the first time');
    await rebootDesktop(page);
    // Reopening over a returning player's session every time is how a welcome
    // becomes the thing you close rather than the thing you read.
    assert.deepStrictEqual(await winTitles(page), [],
      'the welcome must not reopen once it has been seen');
  });
});

test('the welcome is still reachable by hand after it has been dismissed', async () => {
  await withDesktop({}, async page => {
    assert.deepStrictEqual(await winTitles(page), [], 'precondition: suppressed for this context');
    const id = await openWindow(page, 'openWelcome');
    assert.match(await page.evaluate(w => wins[w].title, id), /WELCOME\.README/);
  });
});

// WELCOME.README told players to double-click PROJECTS.DIR on the desktop, and
// there was no such icon: the twenty-five art toys were reachable only from the
// Start menu.
test('the desktop has a PROJECTS icon and it opens the projects folder', async () => {
  await withDesktop({}, async page => {
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('#icons-layer .desktop-icon .di-name')].map(n => n.textContent.trim()));
    assert.ok(labels.includes('PROJECTS'), 'desktop icons were: ' + labels.join(', '));

    const id = await openWindow(page, 'openFiles');
    assert.match(await page.evaluate(w => wins[w].title, id), /PROJECTS/i);
  });
});

test('the welcome text does not promise anything the desktop does not have', async () => {
  await withDesktop({}, async page => {
    const body = await page.evaluate(() => WELCOME_DEFAULT);
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('#icons-layer .desktop-icon .di-name')].map(n => n.textContent.trim()));
    // Every all-caps token in the welcome that looks like a desktop item must
    // actually be one. This is the check that would have caught PROJECTS.DIR.
    const named = [...body.matchAll(/^\s{2}([A-Z][A-Z0-9?]*(?:\.[A-Za-z]+)?)\s{2,}-/gm)].map(m => m[1]);
    assert.ok(named.length >= 5, 'expected to find the program list; found ' + named.join(', '));
    const missing = named.filter(n => !labels.includes(n));
    assert.deepStrictEqual(missing, [],
      'WELCOME.README names these as things to look for, but they are not on the desktop: ' + missing.join(', '));
  });
});

// ── The tray mute ────────────────────────────────────────────────

const trayIcon = page => page.evaluate(() => {
  const img = document.querySelector('#tray-sound img');
  return img ? img.getAttribute('src') : null;
});

test('one click on the tray speaker mutes, and the icon says so', async () => {
  await withDesktop({}, async page => {
    assert.strictEqual(await page.evaluate(() => systemAudioEnabled()), true, 'precondition: sound starts on');
    assert.match(await trayIcon(page), /sound\.png$/);

    await page.click('#tray-sound');
    assert.strictEqual(await page.evaluate(() => systemAudioEnabled()), false);
    assert.match(await trayIcon(page), /sound_mute\.png$/, 'a mute with no visible state is a button that looks broken');

    await page.click('#tray-sound');
    assert.strictEqual(await page.evaluate(() => systemAudioEnabled()), true);
    assert.match(await trayIcon(page), /sound\.png$/);
  });
});

test('muting from the tray survives a reload', async () => {
  await withDesktop({}, async page => {
    await page.click('#tray-sound');
    await rebootDesktop(page);
    assert.strictEqual(await page.evaluate(() => systemAudioEnabled()), false,
      'a visitor who muted once should not be greeted by ambience again');
    assert.match(await trayIcon(page), /sound_mute\.png$/);
  });
});

test('right-clicking the tray speaker opens a volume slider, and dragging it unmutes', async () => {
  await withDesktop({}, async page => {
    await page.click('#tray-sound');   // mute first
    assert.strictEqual(await page.evaluate(() => systemAudioEnabled()), false);

    await page.click('#tray-sound', { button: 'right' });
    await page.waitForSelector('#tray-volume.open', { timeout: 5000 });

    // The flyout must sit above the taskbar it hangs off, not under it.
    const { flyout, bar } = await page.evaluate(() => ({
      flyout: document.getElementById('tray-volume').getBoundingClientRect().toJSON(),
      bar: document.getElementById('taskbar').getBoundingClientRect().toJSON(),
    }));
    assert.ok(flyout.bottom <= bar.top + 1, 'the flyout overlaps the taskbar it is anchored to');
    assert.ok(flyout.left >= 0 && flyout.right <= 1280, 'the flyout runs off the edge of the screen');

    // Clicking the right-hand end of the meter is how every OS mixer un-mutes.
    const blocks = await page.evaluate(() =>
      document.getElementById('tray-volume-blocks').getBoundingClientRect().toJSON());
    await page.mouse.click(blocks.right - 6, blocks.y + blocks.height / 2);
    assert.strictEqual(await page.evaluate(() => systemAudioEnabled()), true,
      'dragging a muted slider up must unmute');
  });
});

test('the Settings window and the tray agree about the same setting', async () => {
  await withDesktop({}, async page => {
    await openWindow(page, 'openSettings');
    const soundToggle = '#wb-settings [data-setting="sounds"]';
    assert.strictEqual(await page.textContent(soundToggle), 'ON');

    await page.click('#tray-sound');
    // Without the os-settings-changed listener this still reads ON while the
    // tray, the registry and the audio graph all say otherwise.
    assert.strictEqual(await page.textContent(soundToggle), 'OFF',
      'Settings kept showing the old value after the tray changed it');
  });
});

// ── Remembered window geometry ───────────────────────────────────

test('a window comes back where it was left', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openTerminal');
    // Middle of the desktop, well clear of every snap zone.
    await page.evaluate(w => {
      wins[w].el.style.left = '300px';
      wins[w].el.style.top = '220px';
      wins[w].el.style.width = '640px';
      wins[w].el.style.height = '400px';
    }, id);
    await page.evaluate(w => closeWin(w), id);
    const before = { x: 300, y: 220, w: 640, h: 400 };

    await rebootDesktop(page);
    const reopened = await openWindow(page, 'openTerminal');
    assert.deepStrictEqual(await rectOf(page, reopened), before,
      'window position has never survived a reload; this is the fix for that');
  });
});

test('a maximized window comes back maximized, and unmaximizes to its own size', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openTerminal');
    await page.evaluate(w => {
      wins[w].el.style.left = '120px';
      wins[w].el.style.top = '90px';
      wins[w].el.style.width = '500px';
      wins[w].el.style.height = '300px';
      maxWin(w);
    }, id);
    await page.evaluate(w => closeWin(w), id);

    await rebootDesktop(page);
    const reopened = await openWindow(page, 'openTerminal');
    assert.strictEqual((await stateOf(page, reopened)).maximized, true);
    const bounds = await page.evaluate(() => desktopBounds());
    assert.deepStrictEqual(await rectOf(page, reopened), { x: 0, y: 0, w: bounds.w, h: bounds.h });

    // The point of restoring through maxWin rather than by setting the flag:
    // origStyle has to hold the remembered size, not the app's default.
    await page.evaluate(w => maxWin(w), reopened);
    assert.deepStrictEqual(await rectOf(page, reopened), { x: 120, y: 90, w: 500, h: 300 },
      'unmaximizing after a reload must land on the size the player chose');
  });
});

test('a snapped window comes back snapped to the same half', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openTerminal');
    await page.evaluate(w => wmApplySnap(w, 'right'), id);
    await page.evaluate(w => closeWin(w), id);

    await rebootDesktop(page);
    const reopened = await openWindow(page, 'openTerminal');
    assert.strictEqual((await stateOf(page, reopened)).snap, 'right');
    const bounds = await page.evaluate(() => desktopBounds());
    const r = await rectOf(page, reopened);
    assert.strictEqual(r.x, Math.floor(bounds.w / 2));
    assert.strictEqual(r.w, bounds.w - Math.floor(bounds.w / 2));
  });
});

// A dialog's id carries a Date.now(), so a remembered one could never match
// again and the store would grow forever.
test('dialogs are not remembered', async () => {
  await withDesktop({}, async page => {
    await page.evaluate(() => osAlert('hello', 'Properties', 'icon:info'));
    const id = await page.evaluate(() => Object.keys(wins).find(k => k.startsWith('os-alert-')));
    assert.ok(id, 'the alert should have opened');
    await page.evaluate(w => closeWin(w), id);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('sleepOS-window-geometry') || '{}'));
    assert.deepStrictEqual(Object.keys(stored).filter(k => k.startsWith('os-alert-')), []);
  });
});

test('closing a minimized window does not file it away at zero size', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openTerminal');
    await page.evaluate(w => {
      wins[w].el.style.left = '200px';
      wins[w].el.style.top = '150px';
      wins[w].el.style.width = '700px';
      wins[w].el.style.height = '450px';
      wmRememberGeometry(w);
      minWin(w);
      closeWin(w);
      // The write is debounced by 250ms and this reads it back immediately.
      wmFlushGeometry();
    }, id);

    // A minimized window is display:none and every offset reads 0. Recording
    // that would restore it at 0,0 at the minimum size.
    const stored = await page.evaluate(w =>
      JSON.parse(localStorage.getItem('sleepOS-window-geometry') || '{}')[w], id);
    assert.deepStrictEqual(
      { left: stored.left, top: stored.top, width: stored.width, height: stored.height },
      { left: 200, top: 150, width: 700, height: 450 });
  });
});

// ── The Start menu ───────────────────────────────────────────────

test('every app on the desktop is also in the Start menu', async () => {
  await withDesktop({}, async page => {
    const items = await page.evaluate(() =>
      [...document.querySelectorAll('#sm-items .sm-item')].map(i => i.textContent.trim()));
    // Browser and Defrag were on the desktop and in Run... but missing here,
    // which is the one menu a non-technical visitor opens first.
    for (const expected of ['Welcome', 'Browser', 'Defragmenter', 'System Monitor', 'Projects', 'Settings']) {
      assert.ok(items.includes(expected), 'Start menu is missing ' + expected + '; it has: ' + items.join(', '));
    }
  });
});

test('the Start menu cannot run off the top of a short screen', async () => {
  await withDesktop({ width: 420, height: 640 }, async page => {
    await page.click('#start-btn');
    await page.waitForSelector('#start-menu', { state: 'visible', timeout: 5000 });
    const menu = await page.evaluate(() =>
      document.getElementById('start-menu').getBoundingClientRect().toJSON());
    assert.ok(menu.top >= 0,
      'the menu grew to fourteen items and its top is now off screen at ' + menu.top);
  });
});

// ── Reset ────────────────────────────────────────────────────────

test('Reset erases the session and boots a fresh install', async () => {
  await withDesktop({}, async page => {
    // A session with something in every store the reset has to clear.
    await page.evaluate(async () => {
      await vfsWriteFile('MYNOTES.txt', 'do not lose me', '');
      await vfsFlush();
      osSettings.clock12h = true;
      saveSettings();
    });
    await page.evaluate(w => { wins[w] && closeWin(w); }, 'settings');
    assert.strictEqual(await page.evaluate(() => vfsExistsSync('MYNOTES.txt', '')), true);

    await factoryReset(page);

    assert.strictEqual(await page.evaluate(() => vfsExistsSync('MYNOTES.txt', '')), false,
      'the user file survived a reset - the unload flush wrote the old filesystem back');
    assert.strictEqual(await page.evaluate(() => osSettings.clock12h), false,
      'settings survived a reset');
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('sleepOS-') && k !== 'sleepOS-welcome-seen'
        && k !== 'sleepOS-settings' && k !== 'sleepOS-registry'));
    assert.deepStrictEqual(keys.filter(k => k === 'sleepOS-window-geometry'), [],
      'remembered window geometry survived a reset');
  });
});

test('a reset brings the welcome back, because it is a fresh install', async () => {
  await withDesktop({ firstRun: true }, async page => {
    await page.evaluate(() => Object.keys(wins).forEach(w => closeWin(w)));
    assert.deepStrictEqual(await winTitles(page), []);

    await factoryReset(page);

    assert.ok((await winTitles(page)).some(t => /WELCOME\.README/.test(t)),
      'a player who reset the OS asked to see it from the beginning');
  });
});

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

// The PROJECTS folder is gone, and it was synthetic all along - Explorer
// special-cased the name, nothing was ever on disk. The art toys
// are `window.open` links that eject the visitor from the OS, so they now live
// in exactly one place: BROWSER.exe's home page, which keeps them inside it.
//
// This asserts the removal from every surface at once, because a launcher left
// behind in one of the four registries is precisely the failure mode
// test/launcher-map-coverage.test.cjs exists for.
test('nothing offers a PROJECTS folder any more', async () => {
  await withDesktop({}, async page => {
    const state = await page.evaluate(() => ({
      icons: [...document.querySelectorAll('#icons-layer .desktop-icon .di-name')].map(n => n.textContent.trim()),
      start: [...document.querySelectorAll('#sm-items .sm-item')].map(i => i.textContent.trim()),
      openFiles: typeof globalThis.openFiles,
      launcher: typeof PROGRAM_LAUNCHERS.FILES,
    }));
    assert.ok(!state.icons.includes('PROJECTS'), 'desktop icons were: ' + state.icons.join(', '));
    assert.ok(!state.start.includes('Projects'), 'Start menu was: ' + state.start.join(', '));
    assert.strictEqual(state.openFiles, 'undefined', 'openFiles is still defined');
    assert.strictEqual(state.launcher, 'undefined', 'PROGRAM_LAUNCHERS still has a FILES entry');

    // scriptOpenSystemProgram is async, so this has to be awaited on the page
    // side or the promise comes back as an opaque {} and the assertion below
    // passes on nothing.
    const viaScript = await page.evaluate(() => scriptOpenSystemProgram('files', ''));
    assert.strictEqual(viaScript, false, "a script's START files still opens something");

    // RUN_MAP is function-scoped inside openRunDialog, so this drives the real
    // dialog rather than reading the table - which is the better test anyway.
    for (const typed of ['projects', 'files', 'sand playground']) {
      await page.evaluate(() => openRunDialog());
      await page.waitForSelector('#win-run-dialog');
      await page.fill('#run-input', typed);
      await page.click('#win-run-dialog .dlg-btn.primary');
      await page.waitForTimeout(250);
      const alerted = await page.evaluate(() =>
        Object.keys(wins).some(k => /alert|dialog/i.test(k) && !/run-dialog/.test(k)));
      assert.ok(alerted, 'Run... of "' + typed + '" did not report an unknown program');
      await page.evaluate(() => { Object.keys(wins).forEach(k => closeWin(k)); });
      await page.waitForTimeout(150);
    }

    // And Explorer's own root listing, which is where the folder was drawn from
    // a hardcoded push rather than from anything on disk.
    const explorerId = await openWindow(page, 'openExplorer');
    await page.waitForTimeout(300);
    const rootNames = await page.evaluate(w =>
      [...wins[w].el.querySelectorAll('.exp-item span,.exp-list-item span,.exp-det-item td')]
        .map(n => n.textContent.trim()), explorerId);
    assert.ok(!rootNames.includes('PROJECTS'),
      'Explorer still shows a PROJECTS folder at the root: ' + rootNames.join(', '));
    assert.ok(rootNames.includes('DOCS'), 'sanity: the root listing did not render at all');
  });
});

// The other half of the same change: removing the folder must not have taken
// the art toys with it.
test('the browser home page still lists every art toy', async () => {
  await withDesktop({}, async page => {
    await openWindow(page, 'openBrowser');
    await page.waitForTimeout(400);
    const links = await page.evaluate(() => {
      const frame = wins['browser'].el.querySelector('iframe');
      const doc = frame.contentDocument;
      return [...doc.querySelectorAll('a.lnk[data-nav-url]')].map(a => a.getAttribute('data-nav-title'));
    });
    const expected = await page.evaluate(() => PROJECTS.map(p => p.name));
    const missing = expected.filter(n => !links.includes(n));
    assert.deepStrictEqual(missing, [],
      'the home page is the only route to these now, and it is missing: ' + missing.join(', '));
    assert.ok(expected.length >= 20, 'the PROJECTS list looks truncated: ' + expected.length);
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

// The menu is deliberately NOT a mirror of the desktop. It briefly was, and a
// menu that repeats every icon already on screen is a second copy of the
// desktop rather than a way to get anywhere. Asserted as an exact list, in
// order, because "contains" would not catch the drift this is guarding against
// - the failure mode here is items creeping back in, not going missing.
test('the Start menu holds the essentials and nothing else', async () => {
  await withDesktop({}, async page => {
    const items = await page.evaluate(() =>
      [...document.querySelectorAll('#sm-items .sm-item')].map(i => i.textContent.trim()));
    assert.deepStrictEqual(items, [
      'Welcome',
      'File Explorer', 'System Monitor', 'Registry Editor', 'Settings',
      'Run...',
      'Return to Eve Net',
      'Shut Down...',
    ]);
  });
});

// The other half: trimming the menu must not have stranded anything. Every app
// that came out of it has to still be one double-click away on the desktop, and
// still resolvable from Run... - which is the whole reason it was safe to cut.
test('every app dropped from the Start menu is still on the desktop and in Run...', async () => {
  await withDesktop({}, async page => {
    const dropped = [
      { label: 'NOTEPAD.exe', run: 'notepad', win: /notepad/i },
      { label: 'TERMINAL.exe', run: 'terminal', win: /terminal/i },
      { label: 'BROWSER.exe', run: 'browser', win: /browser/i },
      { label: 'DEFRAG.exe', run: 'defrag', win: /defrag/i },
      { label: 'CALC.exe', run: 'calc', win: /calc/i },
      { label: 'MINESWEEPER.exe', run: 'minesweeper', win: /minesweeper/i },
    ];
    const icons = await page.evaluate(() =>
      [...document.querySelectorAll('#icons-layer .desktop-icon .di-name')].map(n => n.textContent.trim()));
    for (const app of dropped) {
      assert.ok(icons.includes(app.label),
        app.label + ' left the Start menu and is not on the desktop either; icons: ' + icons.join(', '));
    }
    for (const app of dropped) {
      await page.evaluate(() => { Object.keys(wins).forEach(k => closeWin(k)); });
      await page.evaluate(() => openRunDialog());
      await page.waitForSelector('#win-run-dialog');
      await page.fill('#run-input', app.run);
      await page.click('#win-run-dialog .dlg-btn.primary');
      await page.waitForTimeout(400);
      const opened = await page.evaluate(() => Object.keys(wins));
      assert.ok(opened.some(k => app.win.test(k)),
        'Run... of "' + app.run + '" opened nothing; windows: ' + opened.join(', '));
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

// Writes sit behind a 400ms debounce, and an in-flight commit holds an
// IndexedDB transaction that deleteDatabase does not fail against - it fires
// onblocked and waits forever. Resetting right after touching a file used to
// abort the whole thing with "sleepOS is open in another tab", which is both
// wrong and unactionable. It surfaced as a 30s timeout that only appeared when
// the browser files ran in parallel and everything got slower.
test('resetting immediately after a write still resets', async () => {
  await withDesktop({}, async page => {
    await page.evaluate(() => vfsWriteFile('RACE.txt', 'written just now', ''));
    // Deliberately NOT awaiting vfsFlush here: the commit must still be in
    // flight when the reset starts, which is the whole point.
    await factoryReset(page);
    assert.strictEqual(await page.evaluate(() => vfsExistsSync('RACE.txt', '')), false,
      'the file survived, so the reset did not actually run');
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

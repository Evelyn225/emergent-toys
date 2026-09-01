'use strict';
// Browser regression suite for the window manager.
//
// Every test here exists because a real defect got past the node suite. The
// node tests cover the layout maths as pure functions and are good at it; none
// of them can see a paint order, a measured rectangle, or a mouse button. The
// comment on each test names the defect it would have caught.
const test = require('node:test');
const assert = require('node:assert');
const {
  startHarness, openDesktop, openWindow,
  rectOf, stateOf, previewDisplay, dragTitlebarTo, patchChangesWhen,
} = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

// Each test gets a fresh context so one test's IndexedDB writes cannot reach
// the next - sleepOS persists its filesystem there.
async function withDesktop(opts, fn) {
  const { context, page } = await openDesktop(harness.browser, opts);
  try { await fn(page); } finally { await context.close(); }
}

test('dragging into the left zone previews the left half, and releasing snaps to it', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openNotepad');
    const bounds = await page.evaluate(() => desktopBounds());

    await dragTitlebarTo(page, id, 40, 400);
    const during = await previewDisplay(page);
    const previewRect = await page.evaluate(() => {
      const r = document.getElementById('snap-preview').getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    await page.mouse.up();

    assert.strictEqual(during, 'block', 'the preview must be visible BEFORE release - it is the only warning the window is about to resize');
    assert.deepStrictEqual(previewRect, { x: 0, y: 0, w: Math.floor(bounds.w / 2), h: bounds.h },
      'the preview must show the exact rectangle the window will take');
    assert.deepStrictEqual(await rectOf(page, id), previewRect,
      'the window must land on the rectangle the preview promised');
    assert.strictEqual((await stateOf(page, id)).snap, 'left');
    assert.strictEqual(await previewDisplay(page), 'none', 'the preview must be gone after release');
  });
});

// The snap preview shipped at z-index 99998, which painted it OVER the window
// being dragged: the window got a translucent navy wash and read as a rendering
// fault. elementFromPoint cannot catch this - the preview is pointer-events:none,
// so it looks straight through - which is why this samples pixels.
test('the preview paints under the windows, not over them', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openNotepad');
    await dragTitlebarTo(page, id, 40, 300);

    const overlap = await page.evaluate(w => {
      const p = document.getElementById('snap-preview').getBoundingClientRect();
      const r = wins[w].el.getBoundingClientRect();
      return { x: Math.round(Math.max(p.left, r.left) + 40), y: Math.round(Math.max(p.top, r.top) + 80) };
    }, id);
    const bare = await page.evaluate(w => {
      const r = wins[w].el.getBoundingClientRect();
      return { x: 300, y: Math.round(r.bottom + 30) };
    }, id);
    const hide = () => page.evaluate(() => { document.getElementById('snap-preview').style.visibility = 'hidden'; });
    const show = () => page.evaluate(() => { document.getElementById('snap-preview').style.visibility = ''; });

    const tintsWindow = await patchChangesWhen(page, overlap, hide);
    await show();
    const tintsDesktop = await patchChangesWhen(page, bare, hide);
    await show();
    await page.mouse.up();

    assert.strictEqual(tintsWindow, false,
      'hiding the preview changed a pixel inside the dragged window, so the preview is painting over it');
    assert.strictEqual(tintsDesktop, true,
      'hiding the preview changed nothing on bare desktop either, so it is not being drawn at all - the test above would pass vacuously');
  });
});

// Closing ANY window used to call wmSnapPreviewHide() unscoped, which cancelled
// the preview for a live drag on a different window. Because onMove only
// repaints on a zone TRANSITION, the warning stayed gone and the window still
// snapped on release - a window resizing itself with no warning at all.
test('closing an unrelated window leaves a live drag preview alone', async () => {
  await withDesktop({}, async page => {
    const dragged = await openWindow(page, 'openNotepad');
    const other = await openWindow(page, 'openTerminal');
    await page.evaluate(w => focusWin(w), dragged);

    await dragTitlebarTo(page, dragged, 8, 400);
    assert.strictEqual(await previewDisplay(page), 'block', 'precondition: the preview is showing');

    await page.evaluate(w => closeWin(w), other);
    const survived = await previewDisplay(page);
    await page.mouse.move(10, 420, { steps: 4 });   // dwell in the same zone, no transition
    const stillThere = await previewDisplay(page);
    await page.mouse.up();

    assert.strictEqual(survived, 'block', 'an unrelated close cancelled the warning for this drag');
    assert.strictEqual(stillThere, 'block', 'the warning did not come back, because onMove only repaints on a zone change');
    assert.strictEqual((await stateOf(page, dragged)).snap, 'left');
  });
});

// A drag whose own window died mid-drag left ownership claimed, so a later zone
// crossing resurrected an overlay with no window behind it, and the stale
// pendingZone could snap whatever window next occupied that id.
test('a window closed mid-drag takes its preview with it and cannot snap its successor', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openTerminal');
    await dragTitlebarTo(page, id, 8, 400);
    assert.strictEqual(await previewDisplay(page), 'block', 'precondition: the preview is showing');

    await page.evaluate(w => closeWin(w), id);
    await page.mouse.move(600, 400, { steps: 6 });   // leave the zone
    await page.mouse.move(8, 400, { steps: 6 });     // and cross back in
    const resurrected = await previewDisplay(page);

    // A new window reusing the same id must not inherit the dead drag's zone.
    const reopened = await openWindow(page, 'openTerminal');
    const before = await rectOf(page, reopened);
    await page.mouse.up();
    const after = await rectOf(page, reopened);

    assert.strictEqual(resurrected, 'none', 'a dead drag repainted the overlay on the next zone crossing');
    assert.deepStrictEqual(after, before, 'the dead drag snapped a window that was never dragged');
    assert.strictEqual((await stateOf(page, reopened)).snap, null);
  });
});

// makeDraggable filtered clicks on a BUTTON but never checked e.button, so a
// right-press on the titlebar - the natural thing to try when looking for a
// window menu - started a real drag and an edge zone snapped it.
test('only the left button drags a window', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openNotepad');
    const before = await rectOf(page, id);

    for (const button of ['right', 'middle']) {
      await dragTitlebarTo(page, id, 40, 400, { button });
      const preview = await previewDisplay(page);
      await page.mouse.up({ button });
      assert.strictEqual(preview, 'absent',
        button + '-button drag created a snap preview, so it started a real drag');
      assert.deepStrictEqual(await rectOf(page, id), before, button + '-button drag moved the window');
    }

    // and the left button still works, so the guard did not over-block
    await dragTitlebarTo(page, id, 40, 400);
    await page.mouse.up();
    assert.strictEqual((await stateOf(page, id)).snap, 'left', 'the left button must still snap');
  });
});

// The menu anchored to e.clientY and covered the top of the taskbar by however
// far into the bar you clicked. The first fix leaned on showCtxMenu's viewport
// overflow clamp, which only fires when the menu is TALLER than the bar - true
// for the 98px desktop menu over a 28px bar, false for the 53px mobile menu
// over a 56px bar, where it then covered the bar almost entirely.
for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 600, height: 800 }]]) {
  test('the taskbar menu sits flush on the bar at ' + label + ' size', async () => {
    await withDesktop(viewport, async page => {
      await openWindow(page, 'openNotepad');
      const bar = await page.evaluate(() => document.getElementById('taskbar').getBoundingClientRect().toJSON());

      // Click near the BOTTOM of the bar: anchoring to the cursor shows up here.
      await page.mouse.click(Math.round(bar.width * 0.7), bar.y + bar.height - 2, { button: 'right' });
      await page.waitForSelector('#active-dropdown', { timeout: 5000 });
      const m = await page.evaluate(() => {
        const dd = document.getElementById('active-dropdown');
        const r = dd.getBoundingClientRect();
        const b = document.getElementById('taskbar').getBoundingClientRect();
        return { bottom: Math.round(r.bottom), barTop: Math.round(b.top),
          items: [...dd.children].map(c => c.className.includes('sep') ? '-' : c.textContent) };
      });

      assert.strictEqual(m.bottom, m.barTop,
        'the menu must sit flush on the taskbar, not over it: bottom ' + m.bottom + ' vs bar top ' + m.barTop);
      // Mobile has nothing to arrange, so the arrange items are absent rather
      // than shipped disabled.
      const expected = label === 'mobile'
        ? ['Minimize All', '-', 'System Monitor']
        : ['Cascade Windows', 'Tile Windows', '-', 'Minimize All', '-', 'System Monitor'];
      assert.deepStrictEqual(m.items, expected);
    });
  });
}

// unminWin, reflowWindows and makeResizable all special-cased `maximized` and
// ignored `snap`, so a snapped window could be resized by its own handles while
// still claiming to be snapped, and kept a stale half-width across a viewport
// change. apps/daemon-ui.js had the same gap and was found last.
test('a snapped window refuses its resize handles and re-fits when the viewport changes', async () => {
  await withDesktop({}, async page => {
    const id = await openWindow(page, 'openNotepad');
    await dragTitlebarTo(page, id, 40, 400);
    await page.mouse.up();
    const snapped = await rectOf(page, id);

    const handle = await page.evaluate(w => wins[w].el.querySelector('.win-rz-e').getBoundingClientRect().toJSON(), id);
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(1000, 400, { steps: 6 });
    await page.mouse.up();
    assert.deepStrictEqual(await rectOf(page, id), snapped, 'a snapped window was resized by its own handle');

    // The resize listener is rAF-coalesced (os/wm.js), so desktopBounds()
    // reports the new size a frame before reflowWindows has re-fitted anything.
    // Waiting on the bounds alone measures too early - that is what this test
    // did on its first run, and it read as a product bug rather than a race.
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.waitForFunction(() => desktopBounds().w === 1000, null, { timeout: 5000 });
    await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
    const bounds = await page.evaluate(() => desktopBounds());
    const refit = await rectOf(page, id);
    assert.strictEqual(refit.w, Math.floor(bounds.w / 2), 'a snapped window kept a stale width after a viewport change');
    assert.strictEqual(refit.h, bounds.h);
    assert.strictEqual((await stateOf(page, id)).snap, 'left', 'it must still be snapped after re-fitting');
  });
});

// mkWin already fills the desktop below 700px, so there is nothing to snap and
// the zones would be dead controls. Snap detection is skipped entirely rather
// than shipped inert - the preview element must never even be created.
test('no snapping happens at mobile width', async () => {
  await withDesktop({ width: 600, height: 800 }, async page => {
    const id = await openWindow(page, 'openNotepad');
    const before = await rectOf(page, id);
    await dragTitlebarTo(page, id, 5, 400);
    const during = await previewDisplay(page);
    await page.mouse.up();

    assert.strictEqual(during, 'absent', 'a snap preview was created on a mobile-width desktop');
    assert.strictEqual((await stateOf(page, id)).snap, null);
    assert.deepStrictEqual(await rectOf(page, id), before, 'the window should already fill the desktop and stay put');
  });
});

// Tile must cover the desktop exactly. Three windows is the case that exposed
// the ragged-last-row bug: a 2-column grid whose last row holds one cell that
// has to stretch to the full width.
test('Tile from the taskbar menu covers the desktop exactly and skips minimized windows', async () => {
  await withDesktop({}, async page => {
    const a = await openWindow(page, 'openNotepad');
    const b = await openWindow(page, 'openTerminal');
    const c = await openWindow(page, 'openFiles');
    await page.evaluate(w => minWin(w), b);

    const bar = await page.evaluate(() => document.getElementById('taskbar').getBoundingClientRect().toJSON());
    await page.mouse.click(Math.round(bar.width * 0.7), bar.y + bar.height / 2, { button: 'right' });
    await page.waitForSelector('#active-dropdown', { timeout: 5000 });
    await page.evaluate(() => {
      const dd = document.getElementById('active-dropdown');
      [...dd.children].find(x => x.textContent.includes('Tile'))
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await page.waitForFunction(() => !document.getElementById('active-dropdown'), null, { timeout: 5000 });

    const bounds = await page.evaluate(() => desktopBounds());
    const ra = await rectOf(page, a), rc = await rectOf(page, c);
    assert.strictEqual((await stateOf(page, b)).minimized, true, 'Tile un-minimized a window the player put away');
    assert.strictEqual(ra.w + rc.w, bounds.w, 'the two visible windows must split the width with no gap or overlap');
    assert.strictEqual(ra.h, bounds.h);
    assert.strictEqual((await stateOf(page, a)).snap, null, 'a tiled window must not still claim to be snapped');
    assert.strictEqual((await stateOf(page, a)).maximized, false);
  });
});

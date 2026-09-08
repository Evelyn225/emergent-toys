'use strict';
// PAINT.exe in a real browser.
//
// test/paint-core.test.cjs proves the brushes, the fill and the undo ring as
// pure functions. This file covers what that cannot see: whether the canvas is
// scaled by a whole number and centred, whether a real drag reaches the right
// canvas pixel, whether the options bar rebuilds when the tool changes, and
// whether a saved painting actually lands in the filesystem.
const test = require('node:test');
const assert = require('node:assert');
const { startHarness, openDesktop, openWindow } = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

async function withPaint(fn, opts) {
  const { context, page } = await openDesktop(harness.browser, opts || {});
  try {
    await openWindow(page, 'openPaint');
    await page.waitForSelector('#paint-canvas');
    await fn(page);
  } finally {
    await context.close();
  }
}

// Reads a canvas pixel back as [r,g,b,a]. Asserting on real pixels is the only
// honest way to know a stroke landed - a spy on the renderer would pass just as
// happily with the transform wrong.
const pixelAt = (page, x, y) => page.evaluate(([px, py]) => {
  const d = paintState.ctx.getImageData(px, py, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}, [x, y]);

// A cheap whole-canvas fingerprint. Comparing this instead of transferring the
// full pixel buffer catches ANY stray mark - including a dashed marquee, whose
// exact pixels depend on dash phase and are not worth predicting - without
// shipping 690KB of pixel data across the page boundary per check.
const canvasChecksum = page => page.evaluate(() => {
  const d = paintState.ctx.getImageData(0, 0, paintState.canvas.width, paintState.canvas.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0;
  return h;
});

// Drags in CANVAS coordinates, converting through the live scale the way a real
// pointer would arrive.
async function dragCanvas(page, x0, y0, x1, y1) {
  const box = await page.evaluate(() => {
    const r = document.getElementById('paint-canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, scale: paintState.scale };
  });
  await page.mouse.move(box.left + x0 * box.scale, box.top + y0 * box.scale);
  await page.mouse.down();
  await page.mouse.move(box.left + x1 * box.scale, box.top + y1 * box.scale, { steps: 8 });
  await page.mouse.up();
}

test('it opens with a white 480x360 canvas', async () => {
  await withPaint(async page => {
    const dims = await page.evaluate(() => ({
      w: paintState.canvas.width, h: paintState.canvas.height,
    }));
    assert.deepStrictEqual(dims, { w: 480, h: 360 });
    assert.deepStrictEqual(await pixelAt(page, 240, 180), [255, 255, 255, 255]);
  });
});

test('the canvas is scaled by a whole number and centred', async () => {
  await withPaint(async page => {
    const m = await page.evaluate(() => {
      const c = document.getElementById('paint-canvas');
      const stage = c.parentElement;
      const cr = c.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      return {
        scale: paintState.scale,
        renderedW: Math.round(cr.width),
        leftGap: Math.round(cr.left - sr.left),
        rightGap: Math.round(sr.right - cr.right),
      };
    });
    assert.strictEqual(m.scale, Math.floor(m.scale), 'scale is fractional on a desktop viewport: ' + m.scale);
    assert.ok(m.scale >= 1, 'scale below 1 on a desktop viewport');
    assert.strictEqual(m.renderedW, 480 * m.scale, 'rendered width does not match the scale');
    assert.ok(Math.abs(m.leftGap - m.rightGap) <= 1, 'canvas is not centred: ' + m.leftGap + ' vs ' + m.rightGap);
  }, { width: 1280, height: 900 });
});

test('a drag with the pencil changes the pixels it crossed and leaves the rest white', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('pencil'); paintSelectVariant('p5'); paintSetColor('#000000'); });
    await dragCanvas(page, 100, 100, 200, 100);
    const on = await pixelAt(page, 150, 100);
    assert.deepStrictEqual(on, [0, 0, 0, 255], 'the stroke did not land on the path');
    const off = await pixelAt(page, 150, 300);
    assert.deepStrictEqual(off, [255, 255, 255, 255], 'the stroke painted somewhere it should not have');
  });
});

test('a click without a drag still makes a mark', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('pencil'); paintSelectVariant('p5'); paintSetColor('#000000'); });
    await dragCanvas(page, 60, 60, 60, 60);
    assert.deepStrictEqual(await pixelAt(page, 60, 60), [0, 0, 0, 255], 'a click drew nothing');
  });
});

// A shape drag restores the pre-drag canvas on every move and redraws the
// whole shape from the drag origin - see paintExtendStroke. This is the one
// thing node cannot see: real pointermoves, in real sequence, against a real
// canvas. Node can prove the generator's geometry; only a browser can prove
// the live preview actually erases what an earlier, bigger frame drew.
test('a rect drag previews live and leaves no residue outside the final shape', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('rect'); paintSelectVariant('filled'); paintSetColor('#000000'); });
    const box = await page.evaluate(() => {
      const r = document.getElementById('paint-canvas').getBoundingClientRect();
      return { left: r.left, top: r.top, scale: paintState.scale };
    });
    const toPage = (x, y) => [box.left + x * box.scale, box.top + y * box.scale];

    // Drag out to a large box first, then back in to a small one before
    // releasing. If paintRestore ever stopped firing on each move, the ink
    // from the large intermediate frame would survive past the smaller,
    // final committed shape.
    let [px, py] = toPage(50, 50);
    await page.mouse.move(px, py);
    await page.mouse.down();
    [px, py] = toPage(400, 300);
    await page.mouse.move(px, py, { steps: 4 });
    // Mid-drag: the large box should already be previewed onto the canvas.
    assert.deepStrictEqual(await pixelAt(page, 350, 250), [0, 0, 0, 255],
      'the large intermediate box did not preview');

    [px, py] = toPage(120, 90);
    await page.mouse.move(px, py, { steps: 4 });
    await page.mouse.up();

    // Only covered by the large intermediate frame, and outside the final
    // rectangle - must be back to white once the drag settles.
    assert.deepStrictEqual(await pixelAt(page, 350, 250), [255, 255, 255, 255],
      'ink from an intermediate preview frame survived past the final shape');
    // The final rectangle itself must still be inked.
    assert.deepStrictEqual(await pixelAt(page, 80, 70), [0, 0, 0, 255],
      'the final committed rectangle did not land');
  });
});

test('the toolbox lists every tool and marks exactly one selected', async () => {
  await withPaint(async page => {
    const m = await page.evaluate(() => ({
      buttons: document.querySelectorAll('.paint-tool').length,
      tools: paintTools().length,
      selected: document.querySelectorAll('.paint-tool.sel').length,
      selectedId: document.querySelector('.paint-tool.sel').dataset.tool,
    }));
    assert.strictEqual(m.buttons, m.tools, 'a tool is missing a button');
    assert.strictEqual(m.selected, 1, 'expected exactly one selected tool, got ' + m.selected);
    assert.strictEqual(m.selectedId, 'pencil');
  });
});

test('the options bar rebuilds with the right count when the tool changes', async () => {
  await withPaint(async page => {
    // Asserting the COUNT against the core's own table, not a hardcoded number:
    // adding a variant must not silently stop being rendered.
    const check = tool => page.evaluate(t => {
      paintSelectTool(t);
      return {
        rendered: document.querySelectorAll('.paint-opt').length,
        expected: paintVariantsFor(t).length,
        selected: document.querySelectorAll('.paint-opt.sel').length,
      };
    }, tool);

    let m = await check('pencil');
    assert.strictEqual(m.rendered, m.expected, 'pencil variant count wrong');
    assert.strictEqual(m.selected, 1);

    m = await check('wacky');
    assert.strictEqual(m.rendered, m.expected, 'wacky variant count wrong');
    assert.strictEqual(m.rendered, 15, 'expected 15 wacky brushes');

    m = await check('eyedropper');
    assert.strictEqual(m.rendered, 0, 'the eyedropper has no variants and should show none');
  });
});

test('every option button previews itself by running its own generator', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('wacky'); });
    // wacky/scatter previews a sticker sprite, and that atlas image loads
    // asynchronously - wait for it before reading pixels, or its button can
    // still be mid-flight (and correctly blank) through no fault of the
    // generator or the app's own onload redraw.
    await page.waitForFunction(() => {
      const img = paintStickerImage();
      return img.complete && img.naturalWidth > 0;
    });
    const inked = await page.evaluate(() => {
      // A preview that renders nothing is the failure mode here - a blank row of
      // buttons looks deliberate and tells you nothing is wrong. The preview's
      // background is an opaque white fill, so alpha is 255 everywhere even when
      // nothing was drawn - count pixels that differ from white instead.
      return [...document.querySelectorAll('.paint-opt canvas')].map(c => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
        }
        return n;
      });
    });
    assert.ok(inked.length > 0, 'no preview canvases were rendered');
    inked.forEach((n, i) => assert.ok(n > 0, 'option button ' + i + ' previewed nothing'));
  });
});

test('the palette shows all 28 colours and clicking one selects it', async () => {
  await withPaint(async page => {
    const count = await page.evaluate(() => document.querySelectorAll('.paint-swatch').length);
    assert.strictEqual(count, 28);
    const picked = await page.evaluate(() => {
      const sw = document.querySelectorAll('.paint-swatch')[3];
      sw.click();
      return { color: paintState.color, hex: sw.dataset.hex,
               selected: document.querySelectorAll('.paint-swatch.sel').length };
    });
    assert.strictEqual(picked.color, picked.hex);
    assert.strictEqual(picked.selected, 1);
  });
});

test('undo takes back a whole stroke, not one mouse twitch', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('pencil'); paintSelectVariant('p5'); paintSetColor('#000000'); });
    await dragCanvas(page, 100, 100, 200, 100);
    assert.deepStrictEqual(await pixelAt(page, 150, 100), [0, 0, 0, 255]);

    await page.click('#paint-undo-guy');
    assert.deepStrictEqual(await pixelAt(page, 150, 100), [255, 255, 255, 255],
      'undo did not clear the stroke');

    // One undo, one stroke. A per-segment push would need eight more clicks.
    const depth = await page.evaluate(() => paintState.ring.items.length);
    assert.strictEqual(depth, 2, 'expected blank + one stroke in the ring, got ' + depth);
  });
});

test('Ctrl+Z undoes and Ctrl+Y redoes', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('pencil'); paintSelectVariant('p5'); paintSetColor('#000000'); });
    await dragCanvas(page, 100, 100, 200, 100);
    // The window's own procSetTimeout focus lands 40ms after open. Without
    // waiting for it, Ctrl+Z can fire before the window is focused and land on
    // nothing - it happened to pass only because the preceding round-trips
    // above took longer than 40ms, which is timing-incidental, not
    // deterministic.
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'win-paint');
    await page.keyboard.press('Control+z');
    assert.deepStrictEqual(await pixelAt(page, 150, 100), [255, 255, 255, 255], 'Ctrl+Z did nothing');
    await page.keyboard.press('Control+y');
    assert.deepStrictEqual(await pixelAt(page, 150, 100), [0, 0, 0, 255], 'Ctrl+Y did not restore');
  });
});

test('undo on a blank canvas is a no-op rather than an error', async () => {
  await withPaint(async page => {
    const before = await page.evaluate(() => paintState.ring.index);
    await page.click('#paint-undo-guy');
    await page.click('#paint-undo-guy');
    const after = await page.evaluate(() => paintState.ring.index);
    assert.strictEqual(before, 0);
    assert.strictEqual(after, 0, 'undo walked past the initial blank state');
  });
});

test('the menubar carries File, Edit and Goodies', async () => {
  await withPaint(async page => {
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('#mb-paint .menu-item')].map(s => s.textContent));
    assert.deepStrictEqual(labels, ['File', 'Edit', 'Goodies']);
  });
});

test('PICTURES exists at the root', async () => {
  await withPaint(async page => {
    assert.ok(await page.evaluate(() => vfsDirExistsSync('PICTURES')),
      'PAINT saves into PICTURES and the directory was never created');
  });
});

test('saving writes a real PNG blob that the filesystem can see', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('pencil'); paintSelectVariant('p5'); paintSetColor('#000000'); });
    await dragCanvas(page, 40, 40, 300, 300);
    const st = await page.evaluate(async () => {
      await paintWriteAndSync('scribble.png', 'PICTURES');
      const s = vfsStatSync('scribble.png', 'PICTURES');
      return s && { kind: s.kind, blobKind: s.blob.kind, mime: s.blob.mime, size: s.blob.size };
    });
    assert.ok(st, 'no filesystem entry after save');
    assert.strictEqual(st.kind, 'blob');
    assert.strictEqual(st.blobKind, 'image');
    assert.strictEqual(st.mime, 'image/png');
    assert.ok(st.size > 0, 'the saved blob is empty');
  });
});

test('a successful save renames the window and clears the dirty flag', async () => {
  await withPaint(async page => {
    await dragCanvas(page, 40, 40, 100, 100);
    const after = await page.evaluate(async () => {
      await paintWriteAndSync('titled.png', 'PICTURES');
      return {
        title: document.querySelector('#win-paint .win-title-text')?.textContent
            || document.querySelector('#win-paint .win-title')?.textContent,
        dirty: paintState.dirty, file: paintState.file, dir: paintState.dir,
      };
    });
    assert.match(after.title, /titled\.png/);
    assert.strictEqual(after.dirty, false);
    assert.strictEqual(after.file, 'titled.png');
    assert.strictEqual(after.dir, 'PICTURES');
  });
});

test('a save that collides with a text file reports it and does not claim success', async () => {
  await withPaint(async page => {
    const r = await page.evaluate(async () => {
      await vfsWriteFile('taken.png', 'not an image', 'PICTURES');
      const ok = await paintWriteAndSync('taken.png', 'PICTURES');
      return { ok, file: paintState.file };
    });
    assert.strictEqual(r.ok, false, 'a refused save reported success');
    assert.strictEqual(r.file, null, 'a refused save still renamed the document');
  });
});

// Drives the real Save As dialog end to end rather than calling
// paintWriteAndSync directly - the four tests above all pass an explicit
// 'PICTURES' and so cannot see whether the dialog itself starts out pointed
// at PICTURES. openSaveDialog defaults to the filesystem root, and PAINT's
// paintState.dir ('PICTURES') was not being threaded into it - a real Save As
// silently wrote to the root.
test('Save As through the real dialog lands the file in PICTURES, not the root', async () => {
  await withPaint(async page => {
    await dragCanvas(page, 40, 40, 100, 100);
    await page.evaluate(() => paintSaveAs());
    await page.waitForSelector('[id^="win-saveas-"]');

    const savedIn = await page.evaluate(() => {
      const dlg = document.querySelector('[id^="win-saveas-"]');
      const locRow = dlg.querySelector('.win-body > div');
      return locRow ? locRow.lastElementChild.textContent : null;
    });
    assert.strictEqual(savedIn, 'C:\\sleepOS\\PICTURES',
      'the Save As dialog did not open in PICTURES: ' + savedIn);

    await page.evaluate(() => {
      const dlg = document.querySelector('[id^="win-saveas-"]');
      const nameInput = dlg.querySelector('input[type="text"]');
      nameInput.value = 'dialog-save.png';
      const saveBtn = [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Save');
      saveBtn.click();
    });
    await page.waitForFunction(() => paintState.file === 'dialog-save.png');

    const result = await page.evaluate(() => ({
      inPictures: vfsStatSync('dialog-save.png', 'PICTURES'),
      atRoot: vfsStatSync('dialog-save.png', ''),
    }));
    assert.ok(result.inPictures, 'the file did not land in PICTURES');
    assert.strictEqual(result.inPictures.kind, 'blob');
    assert.strictEqual(result.atRoot, null, 'the file leaked into the filesystem root');
  });
});

test('an existing image loads onto the canvas, letterboxed on white', async () => {
  await withPaint(async page => {
    const r = await page.evaluate(async () => {
      // A 4x4 all-red PNG, written the way an upload would write it.
      const c = document.createElement('canvas');
      c.width = 4; c.height = 4;
      const g = c.getContext('2d');
      g.fillStyle = '#ff0000';
      g.fillRect(0, 0, 4, 4);
      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      await vfsWriteBlob('red.png', { url: URL.createObjectURL(blob), kind: 'image', size: blob.size, mime: 'image/png' }, 'PICTURES');
      await paintLoadImage('red.png', 'PICTURES');
      const d = paintState.ctx.getImageData(240, 180, 1, 1).data;
      return { centre: [d[0], d[1], d[2]], file: paintState.file, dir: paintState.dir };
    });
    assert.deepStrictEqual(r.centre, [255, 0, 0], 'the loaded image is not on the canvas');
    assert.strictEqual(r.file, 'red.png');
    assert.strictEqual(r.dir, 'PICTURES');
  });
});

test('loading an image resets undo so you cannot undo back past it', async () => {
  await withPaint(async page => {
    const depth = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 8; c.height = 8;
      c.getContext('2d').fillRect(0, 0, 8, 8);
      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      await vfsWriteBlob('b.png', { url: URL.createObjectURL(blob), kind: 'image', size: blob.size, mime: 'image/png' }, 'PICTURES');
      await paintLoadImage('b.png', 'PICTURES');
      return paintState.ring.items.length;
    });
    assert.strictEqual(depth, 1, 'the pre-load canvas is still in the undo ring');
  });
});

test('PAINT.exe is a registered file handler but is not the default for png', async () => {
  await withPaint(async page => {
    const r = await page.evaluate(() => ({
      registered: Object.keys(FILE_HANDLERS).includes('PAINT.exe'),
      pngDefault: getFileAssociation('x.png'),
    }));
    assert.ok(r.registered, 'PAINT.exe is not in FILE_HANDLERS, so REGEDIT cannot point .png at it');
    assert.strictEqual(r.pngDefault, 'IMAGEVIEW.exe',
      'double-clicking an image must keep opening the viewer; PAINT is opt-in');
  });
});

test('the save dialog defaults are unchanged for notepad', async () => {
  const { context, page } = await openDesktop(harness.browser, {});
  try {
    await openWindow(page, 'openNotepad');
    const r = await page.evaluate(() => {
      let got = null;
      openSaveDialog('untitled.txt', (f, d) => { got = [f, d]; });
      const win = [...document.querySelectorAll('.os-window')].find(w => w.id.startsWith('win-saveas-'));
      return { opened: !!win, title: win && win.textContent.includes('Save As') };
    });
    assert.ok(r.opened, 'the generalised dialog stopped opening in save mode');
    assert.ok(r.title, 'the save dialog lost its title');
  } finally {
    await context.close();
  }
});

// The Open dialog's file entries used to carry two separate dblclick
// listeners (one shared with Save mode that fills the name box and clicks
// Save, one added for Open mode that closes the dialog and calls back
// directly). A real double-click fires every listener bound to the element,
// so both ran, and the Save listener's own click on the Save button invoked
// the callback too - two calls to paintLoadImage per double-click. Harmless
// only because loading an image happens to be idempotent; a landmine for
// anything added later that isn't. Exercises the real DOM dialog, not
// paintLoadImage called directly, because that is exactly the path the bug
// lived on and a direct call could never see it.
test('a double-click in the Open dialog loads the image exactly once', async () => {
  await withPaint(async page => {
    const calls = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 4;
      c.getContext('2d').fillRect(0, 0, 4, 4);
      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      await vfsWriteBlob('dbl.png', { url: URL.createObjectURL(blob), kind: 'image', size: blob.size, mime: 'image/png' }, 'PICTURES');

      // Count calls without breaking the real load path underneath - a
      // double-click that fires the callback twice is only meaningful if
      // paintLoadImage itself still runs correctly each time it's counted.
      let count = 0;
      const real = paintLoadImage;
      paintLoadImage = (name, dir) => { count++; return real(name, dir); };

      paintOpenDialog();
      const dlg = document.querySelector('[id^="win-openfile-"]');
      const span = [...dlg.querySelectorAll('span')].find(s => s.textContent === 'dbl.png');
      const entry = span.parentElement;
      entry.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));

      // paintLoadImage resolves via an Image() load; give it a tick.
      await new Promise(r => setTimeout(r, 100));

      paintLoadImage = real;
      return count;
    });
    assert.strictEqual(calls, 1, `a single double-click invoked the open callback ${calls} times`);
  });
});

test('the sticker pager shows one page of 14 and the arrows change it', async () => {
  await withPaint(async page => {
    const first = await page.evaluate(() => {
      paintSelectTool('sticker');
      return {
        thumbs: document.querySelectorAll('.paint-sticker').length,
        page: paintState.stickerPage,
        pager: !!document.querySelector('.paint-pager'),
      };
    });
    // Asserting the rendered COUNT, not a pixel width. This is the minesweeper
    // lesson: a grid sized by CSS width laid 480 cells out 29 columns wide,
    // every node test passed, and it looked very nearly right.
    assert.strictEqual(first.thumbs, 14, 'expected 14 stickers on a page');
    assert.strictEqual(first.page, 0);
    assert.ok(first.pager, 'no page arrows');

    const next = await page.evaluate(() => {
      document.querySelector('.paint-pager-next').click();
      return {
        page: paintState.stickerPage,
        firstIdx: Number(document.querySelector('.paint-sticker').dataset.idx),
        thumbs: document.querySelectorAll('.paint-sticker').length,
      };
    });
    assert.strictEqual(next.page, 1);
    assert.strictEqual(next.firstIdx, 14, 'page 2 does not start at sticker 14');
    assert.strictEqual(next.thumbs, 14);
  });
});

test('the pager wraps rather than dead-ending at either edge', async () => {
  await withPaint(async page => {
    const r = await page.evaluate(() => {
      paintSelectTool('sticker');
      document.querySelector('.paint-pager-prev').click();
      const backFromZero = paintState.stickerPage;
      paintSetStickerPage(paintStickerPages() - 1);
      document.querySelector('.paint-pager-next').click();
      return { backFromZero, forwardFromLast: paintState.stickerPage };
    });
    assert.strictEqual(r.backFromZero, 7, 'going back from page 1 should wrap to the last page');
    assert.strictEqual(r.forwardFromLast, 0, 'going forward from the last page should wrap to the first');
  });
});

test('clicking the canvas with a sticker selected stamps it', async () => {
  await withPaint(async page => {
    await page.evaluate(() => { paintSelectTool('sticker'); paintSelectVariant('large'); });
    await page.evaluate(() => { paintState.stickerIndex = 0; });
    await dragCanvas(page, 240, 180, 240, 180);
    const inked = await page.evaluate(() => {
      const d = paintState.ctx.getImageData(220, 160, 40, 40).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
      return n;
    });
    assert.ok(inked > 0, 'the sticker stamped nothing onto the canvas');
  });
});

test('the sticker size-variant previews redraw once the atlas image finishes loading', async () => {
  await withPaint(async page => {
    // Selecting the tool is what first constructs and kicks off the atlas
    // Image - the previews it renders in that same tick are necessarily drawn
    // before the image can have decoded.
    await page.evaluate(() => { paintSelectTool('sticker'); });
    await page.waitForFunction(() => {
      const img = paintStickerImage();
      return img.complete && img.naturalWidth > 0;
    });
    // Counting pixels that differ from white RGB, not alpha - the preview
    // canvas is filled opaque white first, so an alpha-only check would pass
    // on a canvas that never got a sticker drawn onto it at all.
    const nonWhiteCounts = await page.evaluate(() => {
      const canvases = [...document.querySelectorAll('.paint-opt canvas')];
      return canvases.map(c => {
        const g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
        return n;
      });
    });
    assert.strictEqual(nonWhiteCounts.length, 3, 'expected small/medium/large previews');
    nonWhiteCounts.forEach((n, i) => assert.ok(n > 0, `preview ${i} is still blank even though the atlas has loaded`));
  });
});

test('every fill variant previews itself instead of rendering a blank button', async () => {
  await withPaint(async page => {
    // Sibling to the pencil-only preview test above, added because the same
    // "runs its own generator" contract silently fails for a tool with no
    // generator registered at all - PAINT_GENERATORS.fill would be undefined,
    // paintGenerate would return [], and every fill button would render as a
    // blank white square. Counting pixels that differ from white RGB, not
    // alpha, for the same reason as the sticker previews above.
    const inked = await page.evaluate(() => {
      paintSelectTool('fill');
      return [...document.querySelectorAll('.paint-opt canvas')].map(c => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
        }
        return n;
      });
    });
    assert.strictEqual(inked.length, 9, 'expected nine fill variant previews');
    inked.forEach((n, i) => assert.ok(n > 0, 'fill option button ' + i + ' previewed nothing'));
  });
});

test('fill floods an enclosed region and stops at the outline', async () => {
  await withPaint(async page => {
    await page.evaluate(() => {
      // A black box outline, drawn straight onto the context so the test is
      // about the fill and not about the rectangle tool.
      const g = paintState.ctx;
      g.strokeStyle = '#000000'; g.lineWidth = 4;
      g.strokeRect(100, 100, 200, 150);
      paintSelectTool('fill'); paintSelectVariant('solid'); paintSetColor('#ff0000');
    });
    await dragCanvas(page, 200, 175, 200, 175);
    const inside = await pixelAt(page, 200, 175);
    const outside = await pixelAt(page, 50, 50);
    assert.deepStrictEqual(inside, [255, 0, 0, 255], 'the fill did not land inside the box');
    assert.deepStrictEqual(outside, [255, 255, 255, 255], 'the fill escaped the box');
  });
});

test('the eyedropper picks the colour under the pointer', async () => {
  await withPaint(async page => {
    await page.evaluate(() => {
      paintState.ctx.fillStyle = '#00ff00';
      paintState.ctx.fillRect(50, 50, 40, 40);
      paintSelectTool('eyedropper');
    });
    await dragCanvas(page, 70, 70, 70, 70);
    const picked = await page.evaluate(() => paintState.color);
    assert.strictEqual(picked, '#00ff00');
  });
});

test('the eyedropper switches back to the pencil so you can use what you picked', async () => {
  await withPaint(async page => {
    const tool = await page.evaluate(() => { paintSelectTool('eyedropper'); return paintState.tool; });
    assert.strictEqual(tool, 'eyedropper');
    await dragCanvas(page, 70, 70, 70, 70);
    assert.strictEqual(await page.evaluate(() => paintState.tool), 'pencil',
      'staying on the eyedropper after a pick means a second click to draw');
  });
});

test('the text tool draws typed text at the click point', async () => {
  await withPaint(async page => {
    const inked = await page.evaluate(() => {
      paintSelectTool('text'); paintSelectVariant('t20'); paintSetColor('#000000');
      // Drive the drawing directly rather than through osPrompt, which is a
      // modal this test has no business opening.
      paintDrawText({ x: 100, y: 200 }, 'HI', 20);
      const d = paintState.ctx.getImageData(95, 175, 90, 40).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++;
      return n;
    });
    assert.ok(inked > 20, 'no text landed on the canvas');
  });
});

test('the alphabet stamp draws one big letter per click', async () => {
  await withPaint(async page => {
    const { stampCount, smallCount, countI, countW } = await page.evaluate(() => {
      paintSelectTool('text'); paintSelectVariant('stamp'); paintSetColor('#000000');
      const region = () => {
        const d = paintState.ctx.getImageData(200, 130, 90, 90).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++;
        return n;
      };

      // Size proof: drive the real path end to end - paintBeginStroke's text
      // route into paintDoText's stamp branch, which is what actually reads
      // paintState.variant and paintState.stampLetter. No osPrompt modal opens
      // for the stamp branch, so unlike the size variants this is safe to
      // drive as a real click rather than calling paintDrawText directly.
      paintState.stampLetter = 'A';
      paintBeginStroke({ x: 240, y: 180 });
      const stampCount = region();

      // Undo the stamp, then draw the same letter at the smallest text size in
      // the same spot - proving the stamp is actually BIG, not merely
      // non-blank. paintDrawText is called directly here, bypassing
      // paintBeginStroke, for the same reason the size-variant test does: the
      // t8 branch of paintDoText opens an osPrompt modal this test has no
      // business driving.
      paintUndo();
      paintDrawText({ x: 240, y: 180 }, 'A', paintTextSize('t8'));
      const smallCount = region();
      paintUndo();

      // Letter-identity proof: 'A' is also paintDoText's hardcoded fallback
      // (`s.stampLetter || 'A'`), so a stamp branch that ignored
      // paintState.stampLetter entirely would still draw 'A' and pass every
      // assertion above unnoticed. Stamp two letters with very different ink
      // at 64px - I and W - through the same real click path, and require the
      // results to actually differ, which only happens if stampLetter is read.
      paintState.stampLetter = 'I';
      paintBeginStroke({ x: 240, y: 180 });
      const countI = region();
      paintUndo();

      paintState.stampLetter = 'W';
      paintBeginStroke({ x: 240, y: 180 });
      const countW = region();
      paintUndo();

      return { stampCount, smallCount, countI, countW };
    });
    assert.ok(stampCount > 100, 'the alphabet stamp drew nothing at stamp size');
    assert.ok(smallCount > 0, 'the small comparison letter did not draw either - the harness is broken, not just the stamp');
    assert.ok(stampCount > smallCount * 3,
      `the alphabet stamp (${stampCount}px) is not meaningfully bigger than a small text letter (${smallCount}px)`);
    assert.ok(countI > 0 && countW > 0, 'neither stamped letter drew anything');
    assert.ok(Math.abs(countW - countI) > 200,
      `stamping 'I' (${countI}px) and 'W' (${countW}px) produced results too close to prove stampLetter is actually read`);
  });
});

test('the firecracker punches holes and one undo puts the whole picture back', async () => {
  await withPaint(async page => {
    await page.evaluate(() => {
      paintState.ctx.fillStyle = '#000000';
      paintState.ctx.fillRect(0, 0, 480, 360);
      paintCommitUndo();
      paintSelectTool('eraser'); paintSelectVariant('firecracker');
    });
    await dragCanvas(page, 240, 180, 240, 180);
    const holed = await page.evaluate(() => {
      const d = paintState.ctx.getImageData(0, 0, 480, 360).data;
      let white = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] === 255) white++;
      return white;
    });
    assert.ok(holed > 100, 'the firecracker blew no holes');

    await page.click('#paint-undo-guy');
    const restored = await page.evaluate(() => {
      const d = paintState.ctx.getImageData(0, 0, 480, 360).data;
      let white = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] === 255) white++;
      return white;
    });
    assert.strictEqual(restored, 0, 'one undo did not restore the whole picture');
  });
});

test('every destructive eraser leaves the canvas different and undoable', async () => {
  await withPaint(async page => {
    for (const variant of ['blackhole', 'dissolve', 'fade', 'blinds', 'melt']) {
      const r = await page.evaluate(async v => {
        const g = paintState.ctx;
        g.fillStyle = '#000000';
        g.fillRect(0, 0, 480, 360);
        paintCommitUndo();
        const before = paintState.ring.items.length;
        paintSelectTool('eraser'); paintSelectVariant(v);
        paintBeginStroke({ x: 240, y: 180 });
        paintEndStroke();
        const d = g.getImageData(0, 0, 480, 360).data;
        let changed = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] !== 0) changed++;
        return { changed, pushed: paintState.ring.items.length - before };
      }, variant);
      assert.ok(r.changed > 0, variant + ' changed nothing');
      assert.ok(r.pushed >= 1, variant + ' pushed no undo state, so it cannot be taken back');
    }
  });
});

test('the move tool lifts a region and drops it somewhere else', async () => {
  await withPaint(async page => {
    await page.evaluate(() => {
      paintState.ctx.fillStyle = '#0000ff';
      paintState.ctx.fillRect(50, 50, 60, 60);
      paintSelectTool('select');
    });
    // Mark the region.
    await dragCanvas(page, 40, 40, 120, 120);
    // Move it right and down.
    await dragCanvas(page, 80, 80, 280, 240);

    const moved = await pixelAt(page, 280, 240);
    const vacated = await pixelAt(page, 80, 80);
    assert.deepStrictEqual(moved, [0, 0, 255, 255], 'the region did not arrive at the drop point');
    assert.deepStrictEqual(vacated, [255, 255, 255, 255], 'the region left a copy behind');
  });
});

test('a move is one undo step', async () => {
  await withPaint(async page => {
    const r = await page.evaluate(() => {
      paintState.ctx.fillStyle = '#0000ff';
      paintState.ctx.fillRect(50, 50, 60, 60);
      paintCommitUndo();
      const before = paintState.ring.items.length;
      paintSelectTool('select');
      paintSelectBegin({ x: 40, y: 40 });
      paintSelectDrag({ x: 120, y: 120 });
      paintSelectEnd();
      paintSelectBegin({ x: 80, y: 80 });
      paintSelectDrag({ x: 280, y: 240 });
      paintSelectEnd();
      return paintState.ring.items.length - before;
    });
    assert.strictEqual(r, 1, 'a mark-then-move should push exactly one undo state, got ' + r);
  });
});

test('saving an idle mark does not bake the marquee into the canvas', async () => {
  await withPaint(async page => {
    await page.evaluate(() => {
      paintState.ctx.fillStyle = '#0000ff';
      paintState.ctx.fillRect(50, 50, 60, 60);
      paintSelectTool('select');
    });
    const clean = await canvasChecksum(page);
    // Mark a region and leave it idle - no move, no tool switch.
    await dragCanvas(page, 40, 40, 120, 120);
    const withMarquee = await canvasChecksum(page);
    assert.notStrictEqual(withMarquee, clean, 'the marquee should be visible while a mark sits idle');
    // What File > Save actually calls.
    await page.evaluate(() => paintCanvasBlob());
    const afterSave = await canvasChecksum(page);
    assert.strictEqual(afterSave, clean, 'the marquee survived into what a save would encode');
  });
});

test('marking a second region outside the first does not bake the old marquee into the canvas', async () => {
  await withPaint(async page => {
    const clean = await canvasChecksum(page);
    await page.evaluate(() => paintSelectTool('select'));
    // Mark region A and leave it idle.
    await dragCanvas(page, 20, 20, 100, 100);
    // Mark a second, non-overlapping region B - this must not be taking a
    // "clean" snapshot with A's marquee still on it.
    await dragCanvas(page, 200, 200, 260, 260);
    // Switching tools restores from whatever base marking B just captured. If
    // that base has A's marquee baked in, this reproduces it permanently.
    await page.evaluate(() => paintSelectTool('pencil'));
    const after = await canvasChecksum(page);
    assert.strictEqual(after, clean, 'the first marquee survived into the canvas after marking a second region');
  });
});

test('on a phone the canvas fits the width and nothing scrolls sideways', async () => {
  await withPaint(async page => {
    const m = await page.evaluate(() => {
      const root = document.querySelector('.paint-root');
      const c = document.getElementById('paint-canvas');
      return {
        scale: paintState.scale,
        canvasW: c.getBoundingClientRect().width,
        rootW: root.clientWidth,
        scrollW: root.scrollWidth,
      };
    });
    assert.ok(m.canvasW <= m.rootW + 1, 'the canvas is wider than the window on a phone');
    assert.ok(m.scrollW <= m.rootW + 1, 'the paint window scrolls sideways on a phone');
  }, { width: 390, height: 780 });
});

test('the toolbox and options bar stay reachable on a phone', async () => {
  await withPaint(async page => {
    const m = await page.evaluate(() => {
      const tools = [...document.querySelectorAll('.paint-tool')];
      const bar = document.getElementById('paint-options');
      return {
        smallest: Math.min(...tools.map(b => b.getBoundingClientRect().width)),
        // Real overflow, not just the static declaration: .paint-options has
        // carried overflow-x:auto unconditionally since Task 5, desktop
        // included, so checking for that property alone would pass even if a
        // regression removed the actual scrolling behaviour.
        barScrolls: bar.scrollWidth > bar.clientWidth,
      };
    });
    assert.ok(m.smallest >= 30, 'tool buttons are under 30px on touch: ' + m.smallest);
    assert.ok(m.barScrolls, 'the options bar does not actually overflow, so variants are unreachable');
  }, { width: 390, height: 780 });
});

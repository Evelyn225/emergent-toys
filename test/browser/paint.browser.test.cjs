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
    const inked = await page.evaluate(() => {
      paintSelectTool('pencil');
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

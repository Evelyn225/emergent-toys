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

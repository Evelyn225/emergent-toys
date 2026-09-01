'use strict';
// The CRT effect, which is two independent subsystems that fail independently:
//
//   scanlines   a <canvas> of bowed lines over everything (os/crt.js)
//   halation    an SVG filter graph applied to the desktop surfaces
//
// Both are invisible to the node suite, and both can fail SILENTLY - the
// filter can be present, referenced, and resolvable while painting nothing,
// which is exactly what a report of "halation doesn't work in Firefox" looks
// like from the outside. Every check here therefore measures PIXELS rather
// than asserting that some style string is set.
const test = require('node:test');
const assert = require('node:assert');
const { startHarness, openDesktop } = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

// A hard white block on a near-black desktop, with the scanline canvas hidden,
// so the ONLY thing that can change these pixels is the halation filter.
async function withProbe(fn) {
  const { context, page } = await openDesktop(harness.browser, { width: 900, height: 600 });
  try {
    await page.evaluate(() => {
      Object.keys(wins).forEach(id => closeWin(id));
      document.getElementById('icons-layer').style.display = 'none';
      document.getElementById('desktop-bg').style.background = '#101010';
      osSettings.crtEffect = true;
      applySettings();
      document.querySelectorAll('.crt-lines').forEach(c => { c.style.display = 'none'; });
      const box = document.createElement('div');
      box.id = 'halo-probe';
      box.style.cssText = 'position:absolute;left:400px;top:200px;width:200px;height:120px;background:#fff';
      document.getElementById('windows-layer').appendChild(box);
    });
    await page.waitForTimeout(400);
    await fn(page);
  } finally {
    await context.close();
  }
}

// One row of pixels running from open desktop into the white block, decoded
// from a screenshot. The glow lives in the last few px before the edge.
async function scanline(page) {
  const buf = await page.screenshot({ clip: { x: 340, y: 255, width: 70, height: 6 } });
  return page.evaluate(async d => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + d; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    const out = [];
    for (let i = 0; i < c.width; i++) {
      const o = (3 * c.width + i) * 4;
      out.push([px[o], px[o + 1], px[o + 2]]);
    }
    return out;
  }, buf.toString('base64'));
}

test('the halation filter is wired up and resolvable', async () => {
  await withProbe(async page => {
    const state = await page.evaluate(() => ({
      crtOn: document.body.classList.contains('crt-on'),
      filterEl: !!document.getElementById('crt-halation'),
      primitives: (document.getElementById('crt-halation') || { children: [] }).children.length,
      applied: getComputedStyle(document.getElementById('desktop')).filter,
    }));
    assert.strictEqual(state.crtOn, true);
    assert.strictEqual(state.filterEl, true, 'the #crt-halation filter was never built');
    assert.ok(state.primitives >= 10, 'the filter graph is truncated: ' + state.primitives + ' primitives');
    assert.match(state.applied, /crt-halation/, 'the filter is not applied to #desktop');
  });
});

// The one that matters, and the one every "is it set?" assertion above would
// pass while the screen showed nothing.
test('halation actually paints: the filter changes pixels', async () => {
  await withProbe(async page => {
    const on = await page.screenshot({ clip: { x: 340, y: 250, width: 70, height: 20 } });
    await page.evaluate(() => { document.getElementById('desktop').style.filter = 'none'; });
    await page.waitForTimeout(250);
    const off = await page.screenshot({ clip: { x: 340, y: 250, width: 70, height: 20 } });
    assert.ok(!on.equals(off),
      'the halation filter is applied but renders identically to no filter at all');
  });
});

test('the glow sits outside the bright edge and is warm, not grey', async () => {
  await withProbe(async page => {
    const row = await scanline(page);
    const bg = row[0];
    assert.ok(bg[0] < 40 && bg[1] < 40 && bg[2] < 40,
      'the far end of the scan should still be dark desktop, got ' + bg.join(','));

    // The pixel immediately before the block's left edge (x=400, index 60).
    const glow = row[59];
    assert.ok(glow[0] > bg[0] + 10,
      'no glow outside the bright block: background ' + bg.join(',') + ' vs edge ' + glow.join(','));
    // Halation is the glass, not the phosphor, so it is warm: CRT.warmth pulls
    // green and blue down relative to red. A grey lift means the tint matrix
    // dropped out of the graph.
    assert.ok(glow[0] > glow[2],
      'the glow is not warm (R must exceed B), got ' + glow.join(','));
    assert.ok(glow[1] > glow[2],
      'the glow tint is wrong (G must exceed B), got ' + glow.join(','));
  });
});

// Regression guard for the alpha bug this file was written after.
//
// The three channel copies of the chromatic-aberration split each carry alpha
// 1, and they used to be recombined by SUMMING them with feComposite arithmetic
// (k2=1 k3=1), which produces alpha 3. That is out of range in premultiplied
// space, and what happens next is whatever the engine's clamp happens to do -
// Chromium's produced the intended picture, which is not something the spec
// promises. feBlend mode="screen" is arithmetic addition on channels that never
// overlap, so the colour is identical, but alpha comes out 1-(1-1)(1-1) = 1.
test('the channel split recombines without driving alpha out of range', async () => {
  await withProbe(async page => {
    const graph = await page.evaluate(() =>
      [...document.getElementById('crt-halation').children]
        .map(n => n.nodeName + (n.getAttribute('mode') ? '[' + n.getAttribute('mode') + ']' : '')
                 + (n.getAttribute('operator') ? '[' + n.getAttribute('operator') + ']' : '')));
    const summed = graph.filter(n => n === 'feComposite[arithmetic]');
    // One arithmetic composite is legitimate and still there: the glow/shadow
    // gate, which multiplies via k1 and is documented in os/crt.js. The two that
    // recombined the split channels are the ones that must not come back.
    assert.ok(summed.length <= 1,
      'more than one feComposite[arithmetic]: the channel split looks like it is summing alpha again - ' + graph.join(' '));
    assert.ok(graph.filter(n => n === 'feBlend[screen]').length >= 2,
      'the split should recombine with feBlend screen: ' + graph.join(' '));
  });
});

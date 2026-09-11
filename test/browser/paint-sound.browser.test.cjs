'use strict';
// PAINT.exe's drawing sounds, metered.
//
// These bugs were invisible to every other kind of test: the right functions
// were called with the right names, and the loop still did not play. What was
// wrong was WHEN it was audible, so these tests listen - an AnalyserNode on the
// drawing loop's own gain node - while strokes are driven by in-page pointer
// events at a
// steady 16ms, the cadence a real mouse delivers. Playwright's own mouse is not
// used for the strokes: its per-move round trip is long and uneven enough to
// open and close the motion gate by itself, which would test the harness.
//
// Thresholds are deliberately loose. The failures they guard against were
// gross: a quick pencil stroke making no sound at all, and 188ms dropouts once
// a second mid-drag.
const test = require('node:test');
const assert = require('node:assert');
const { startHarness, openDesktop, openWindow } = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

// Opens Paint with audio unlocked and a meter on the master bus. The click is
// the user gesture Web Audio needs before it will run at all.
async function withMeteredPaint(fn) {
  const { context, page } = await openDesktop(harness.browser, { width: 1400, height: 900 });
  try {
    await page.mouse.click(700, 450);
    await openWindow(page, 'openPaint');
    await page.waitForSelector('#paint-canvas');
    await page.waitForFunction(() => typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'running');
    await page.evaluate(() => {
      osSettings.sounds = true;
      // The meter taps the drawing loop's OWN gain node, never the master bus.
      // An earlier version metered the master and passed against the broken
      // code: the boot chime was still playing under the first strokes and
      // filled every gap it was meant to catch. Tapping the loop's node means
      // no other sound in the OS can reach the measurement. The node is created
      // when the loop first primes, so it is picked up as soon as it exists.
      const an = audioCtx.createAnalyser();
      an.fftSize = 256;
      const buf = new Float32Array(an.fftSize);
      let tapped = null;
      window.__meterLoop = null;
      window.__meterLog = [];
      setInterval(() => {
        const entry = __meterLoop && audioLoops.get(__meterLoop);
        const node = entry && entry.gain;
        if (node !== tapped) {
          if (tapped) tapped.disconnect(an);
          if (node) node.connect(an);
          tapped = node || null;
        }
        if (!tapped) { __meterLog.push([performance.now(), -200]); return; }
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        __meterLog.push([performance.now(), 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-9)]);
      }, 4);
      // A stroke as a real mouse makes one: down, a move every 16ms, up.
      window.__stroke = async (tool, moveMs) => {
        paintSelectTool(tool);
        __meterLoop = tool === 'pencil' ? 'paint-pencil' : 'paint-brush';
        // Let Paint's preload decode the loop, and the boot chime fade, first.
        await new Promise(r => setTimeout(r, 400));
        const canvas = document.getElementById('paint-canvas');
        const rect = canvas.getBoundingClientRect();
        const fire = (type, x) => canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0,
          buttons: type === 'pointerup' ? 0 : 1, clientX: rect.left + x, clientY: rect.top + 120,
        }));
        let x = 40;
        fire('pointerdown', x);
        const firstMove = performance.now();
        const end = firstMove + moveMs;
        while (performance.now() < end) {
          x += 3;
          fire('pointermove', x);
          await new Promise(r => setTimeout(r, 16));
        }
        const lastMove = performance.now();
        fire('pointerup', x);
        await new Promise(r => setTimeout(r, 150));
        const log = __meterLog.filter(e => e[0] >= firstMove);
        const firstAudible = log.find(e => e[1] > -60);
        // Longest run of silence while the pointer was moving, after the first
        // 60ms - the attack is allowed that long.
        let longest = 0, runStart = null;
        log.filter(e => e[0] >= firstMove + 60 && e[0] < lastMove).forEach(e => {
          if (e[1] < -60) { if (runStart === null) runStart = e[0]; longest = Math.max(longest, e[0] - runStart); }
          else runStart = null;
        });
        return { firstSoundMs: firstAudible ? firstAudible[0] - firstMove : null, longestSilenceMs: longest };
      };
    });
    await fn(page);
  } finally {
    await context.close();
  }
}

// Records every sound Paint asks for, with a timestamp. For behaviour that is
// about WHICH sound and WHEN it is asked for, not how it comes out - no meter
// needed, and nothing else in the OS can leak into it.
async function withSoundSpy(fn) {
  const { context, page } = await openDesktop(harness.browser, { width: 1400, height: 900 });
  try {
    await openWindow(page, 'openPaint');
    await page.waitForSelector('#paint-canvas');
    await page.evaluate(() => {
      window.__played = [];
      const real = playSound;
      window.playSound = (name, opts) => { __played.push([performance.now(), name]); return real(name, opts); };
    });
    await fn(page);
  } finally {
    await context.close();
  }
}

test('clicking a tool, a variant, a sticker or an arrow plays the select sound; code does not', async () => {
  await withSoundSpy(async page => {
    const r = await page.evaluate(() => {
      const heard = () => __played.map(p => p[1]);
      const out = {};
      // Switching tools from code - the eyedropper does this after every pick -
      // must stay silent.
      __played.length = 0;
      paintSelectTool('wacky');
      out.fromCode = heard();
      __played.length = 0;
      document.querySelector('.paint-tool[data-tool="pencil"]').click();
      out.tool = heard();
      __played.length = 0;
      document.querySelectorAll('.paint-opt')[2].click();
      out.variant = heard();
      document.querySelector('.paint-tool[data-tool="sticker"]').click();
      __played.length = 0;
      document.querySelectorAll('.paint-sticker')[3].click();
      out.sticker = heard();
      __played.length = 0;
      document.querySelector('.paint-pager-next').click();
      out.arrow = heard();
      __played.length = 0;
      document.querySelector('.paint-swatch').click();
      out.swatch = heard();
      return out;
    });
    assert.deepStrictEqual(r.fromCode, [], 'a tool change made by code played a sound');
    assert.deepStrictEqual(r.tool, ['paint-select']);
    assert.deepStrictEqual(r.variant, ['paint-select']);
    assert.deepStrictEqual(r.sticker, ['paint-select']);
    assert.deepStrictEqual(r.arrow, ['paint-select']);
    assert.deepStrictEqual(r.swatch, ['paint-palette'], 'a colour swatch should keep its own click');
  });
});

// The rub is audible for ~350ms. At a 160ms floor two or three overlapped on
// any real scrub and smeared into one noise.
test('a fast eraser scrub spaces its rubs at least a clip-length apart', async () => {
  await withSoundSpy(async page => {
    const gaps = await page.evaluate(async () => {
      paintSelectTool('eraser');
      paintSelectVariant('e10');
      const canvas = document.getElementById('paint-canvas');
      const rect = canvas.getBoundingClientRect();
      const fire = (type, x) => canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0,
        buttons: type === 'pointerup' ? 0 : 1, clientX: rect.left + x, clientY: rect.top + 150,
      }));
      __played.length = 0;
      // A hard scrub: 12px per 16ms frame, back and forth, for 2 seconds.
      let x = 100, dir = 1;
      fire('pointerdown', x);
      const end = performance.now() + 2000;
      while (performance.now() < end) {
        x += 12 * dir;
        if (x > 380 || x < 100) dir = -dir;
        fire('pointermove', x);
        await new Promise(r => setTimeout(r, 16));
      }
      fire('pointerup', x);
      const rubs = __played.filter(p => p[1] === 'paint-eraser').map(p => p[0]);
      return rubs.slice(1).map((t, i) => t - rubs[i]);
    });
    assert.ok(gaps.length >= 3, 'a 2s scrub should rub several times, got ' + (gaps.length + 1));
    gaps.forEach(g => assert.ok(g >= 349, 'two rubs only ' + Math.round(g) + 'ms apart'));
  });
});

// The opening pass of a crossfaded loop used to fade in over the whole
// crossfade - 250ms on the pencil - so a stroke shorter than that was silent.
test('a quick pencil stroke is heard, and promptly', async () => {
  await withMeteredPaint(async page => {
    const r = await page.evaluate(() => __stroke('pencil', 120));
    assert.notStrictEqual(r.firstSoundMs, null, 'a 120ms pencil stroke made no sound at all');
    assert.ok(r.firstSoundMs < 100, 'the pencil took ' + Math.round(r.firstSoundMs) + 'ms to be heard');
  });
});

// Exponential crossfade ramps sank both passes to ~-40dB mid-seam: 100-190ms
// of near-silence once a second. And the old gate re-issued its fade on every
// move, which could hold the level down for as long as the pointer moved.
test('the drawing loops play without dropouts for as long as the pointer moves', async () => {
  await withMeteredPaint(async page => {
    for (const tool of ['pencil', 'wacky']) {
      const r = await page.evaluate(t => __stroke(t, 2200), tool);
      assert.notStrictEqual(r.firstSoundMs, null, tool + ' made no sound');
      assert.ok(r.longestSilenceMs < 60,
        tool + ' went silent for ' + Math.round(r.longestSilenceMs) + 'ms while the pointer was moving');
    }
  });
});

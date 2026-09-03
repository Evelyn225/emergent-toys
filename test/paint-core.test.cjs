'use strict';
// PAINT.exe's logic, proved in node.
//
// apps/paint-core.js is pure by construction - no DOM, no canvas, no globals -
// so everything here runs with nothing but node. That split is the whole point
// of the file: a wacky brush that emits ops off the canvas, a flood fill that
// leaks diagonally, an undo ring that loses its redo tail are all logic bugs,
// and none of them are visible in a screenshot.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function coreCtx() {
  return loadOsSources(makeOsContext({}), ['apps/paint-core.js']);
}

test('the canvas is a fixed 480x360', () => {
  const ctx = coreCtx();
  assert.strictEqual(ctx.paintCanvasWidth(), 480);
  assert.strictEqual(ctx.paintCanvasHeight(), 360);
});

test('display scale is an integer whenever 1x fits, and never below 1', () => {
  const ctx = coreCtx();
  assert.strictEqual(ctx.paintDisplayScale(480, 360), 1);
  assert.strictEqual(ctx.paintDisplayScale(1000, 800), 2);
  assert.strictEqual(ctx.paintDisplayScale(1500, 1100), 3);
  // Wide but short: the limiting axis wins.
  assert.strictEqual(ctx.paintDisplayScale(2000, 400), 1);
});

test('display scale goes fractional only when 1x genuinely does not fit', () => {
  const ctx = coreCtx();
  const s = ctx.paintDisplayScale(390, 700);
  assert.ok(s < 1 && s > 0, 'expected a fractional scale on a phone-width viewport, got ' + s);
  assert.ok(Math.abs(s - 390 / 480) < 1e-9);
});

test('the palette is 28 distinct colours', () => {
  const ctx = coreCtx();
  const pal = ctx.paintPalette();
  assert.strictEqual(pal.length, 28);
  const hexes = pal.map(c => c.hex);
  assert.strictEqual(new Set(hexes).size, 28, 'palette has duplicate colours');
  hexes.forEach(h => assert.match(h, /^#[0-9a-f]{6}$/, 'not a lowercase 6-digit hex: ' + h));
  assert.strictEqual(new Set(pal.map(c => c.id)).size, 28, 'palette has duplicate ids');
});

test('the palette contains black and white', () => {
  const ctx = coreCtx();
  const hexes = ctx.paintPalette().map(c => c.hex);
  assert.ok(hexes.includes('#000000'), 'no black in the palette');
  assert.ok(hexes.includes('#ffffff'), 'no white in the palette');
});

test('every tool declares at least one variant, except the eyedropper', () => {
  const ctx = coreCtx();
  const tools = ctx.paintTools();
  assert.ok(tools.length >= 11, 'expected at least 11 tools, got ' + tools.length);
  tools.forEach(t => {
    const vs = ctx.paintVariantsFor(t.id);
    assert.ok(Array.isArray(vs), t.id + ' has no variant array');
    if (t.id === 'eyedropper') assert.strictEqual(vs.length, 0);
    else assert.ok(vs.length >= 1, t.id + ' has no variants');
    assert.strictEqual(new Set(vs.map(v => v.id)).size, vs.length, t.id + ' has duplicate variant ids');
  });
});

test('paintVariantsFor rejects an unknown tool with an empty list, not a throw', () => {
  const ctx = coreCtx();
  assert.deepStrictEqual(plain(ctx.paintVariantsFor('no-such-tool')), []);
});

test('the rng is deterministic for a seed and differs between seeds', () => {
  const ctx = coreCtx();
  const a = ctx.paintRng(12345);
  const b = ctx.paintRng(12345);
  const c = ctx.paintRng(999);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  const seqC = [c(), c(), c(), c(), c()];
  assert.deepStrictEqual(seqA, seqB, 'same seed produced different sequences');
  assert.notDeepStrictEqual(seqA, seqC, 'different seeds produced the same sequence');
  seqA.forEach(v => assert.ok(v >= 0 && v < 1, 'rng out of range: ' + v));
});

// ── undo ring ────────────────────────────────────────────────────

test('a fresh ring is empty and has nothing to undo', () => {
  const ctx = coreCtx();
  const r = ctx.paintUndoInit(20);
  assert.strictEqual(r.cap, 20);
  assert.strictEqual(r.index, -1);
  assert.deepStrictEqual(plain(r.items), []);
  assert.strictEqual(ctx.paintUndoUndo(r), null);
  assert.strictEqual(ctx.paintUndoRedo(r), null);
});

test('undo walks back through pushed states and redo walks forward', () => {
  const ctx = coreCtx();
  const r = ctx.paintUndoInit(20);
  ['a', 'b', 'c'].forEach(s => ctx.paintUndoPush(r, s));
  assert.strictEqual(r.index, 2);
  assert.strictEqual(ctx.paintUndoUndo(r), 'b');
  assert.strictEqual(ctx.paintUndoUndo(r), 'a');
  assert.strictEqual(ctx.paintUndoUndo(r), null, 'walked back past the first state');
  assert.strictEqual(ctx.paintUndoRedo(r), 'b');
  assert.strictEqual(ctx.paintUndoRedo(r), 'c');
  assert.strictEqual(ctx.paintUndoRedo(r), null, 'walked forward past the last state');
});

test('pushing after an undo truncates the redo tail', () => {
  const ctx = coreCtx();
  const r = ctx.paintUndoInit(20);
  ['a', 'b', 'c'].forEach(s => ctx.paintUndoPush(r, s));
  ctx.paintUndoUndo(r);              // now at 'b'
  ctx.paintUndoPush(r, 'd');
  assert.deepStrictEqual(plain(r.items), ['a', 'b', 'd'], 'c survived a divergent push');
  assert.strictEqual(ctx.paintUndoRedo(r), null, 'redo still offered the abandoned branch');
});

test('pushing past capacity drops the oldest state and keeps the index in range', () => {
  const ctx = coreCtx();
  const r = ctx.paintUndoInit(3);
  ['a', 'b', 'c', 'd', 'e'].forEach(s => ctx.paintUndoPush(r, s));
  assert.deepStrictEqual(plain(r.items), ['c', 'd', 'e']);
  assert.strictEqual(r.index, 2);
  assert.strictEqual(ctx.paintUndoUndo(r), 'd');
  assert.strictEqual(ctx.paintUndoUndo(r), 'c');
  assert.strictEqual(ctx.paintUndoUndo(r), null);
});

test('a capacity of one means every push replaces the only state', () => {
  const ctx = coreCtx();
  const r = ctx.paintUndoInit(1);
  ctx.paintUndoPush(r, 'a');
  ctx.paintUndoPush(r, 'b');
  assert.deepStrictEqual(plain(r.items), ['b']);
  assert.strictEqual(ctx.paintUndoUndo(r), null);
});

// ── flood fill ───────────────────────────────────────────────────

// A tiny helper so the fill tests read as pictures rather than as index maths.
// '.' is white, '#' is black, 'r' is pure red.
const FILL_COLORS = { '.': [255, 255, 255, 255], '#': [0, 0, 0, 255], r: [255, 0, 0, 255] };
function grid(rows) {
  const h = rows.length, w = rows[0].length;
  const px = new Uint8ClampedArray(w * h * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = FILL_COLORS[ch];
      const i = (y * w + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
    });
  });
  return { px, w, h };
}
function render(px, w, h) {
  const out = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const key = Object.keys(FILL_COLORS).find(k => {
        const c = FILL_COLORS[k];
        return px[i] === c[0] && px[i + 1] === c[1] && px[i + 2] === c[2];
      });
      line += key || '?';
    }
    out.push(line);
  }
  return out;
}

test('fill spreads through a connected region and stops at a colour edge', () => {
  const ctx = coreCtx();
  const g = grid([
    '#####',
    '#...#',
    '#...#',
    '#####',
  ]);
  const n = ctx.paintFloodFill(g.px, g.w, g.h, 2, 2, [255, 0, 0, 255], 0);
  assert.strictEqual(n, 6);
  assert.deepStrictEqual(render(g.px, g.w, g.h), [
    '#####',
    '#rrr#',
    '#rrr#',
    '#####',
  ]);
});

test('fill is 4-connected and does not leak through a diagonal gap', () => {
  const ctx = coreCtx();
  // The two white regions touch only at a corner. A careless 8-connected fill
  // floods both and the leak is invisible until someone fills a real drawing.
  const g = grid([
    '..##',
    '..##',
    '##..',
    '##..',
  ]);
  const n = ctx.paintFloodFill(g.px, g.w, g.h, 0, 0, [255, 0, 0, 255], 0);
  assert.strictEqual(n, 4, 'fill leaked diagonally into the second region');
  assert.deepStrictEqual(render(g.px, g.w, g.h), [
    'rr##',
    'rr##',
    '##..',
    '##..',
  ]);
});

test('fill reaches the canvas edges and corners', () => {
  const ctx = coreCtx();
  const g = grid([
    '...',
    '.#.',
    '...',
  ]);
  const n = ctx.paintFloodFill(g.px, g.w, g.h, 0, 0, [255, 0, 0, 255], 0);
  assert.strictEqual(n, 8, 'the ring around the centre pixel should all fill');
  assert.deepStrictEqual(render(g.px, g.w, g.h), ['rrr', 'r#r', 'rrr']);
});

test('filling a pixel that is already the target colour is a no-op, not a hang', () => {
  const ctx = coreCtx();
  const g = grid(['rr', 'rr']);
  const n = ctx.paintFloodFill(g.px, g.w, g.h, 0, 0, [255, 0, 0, 255], 0);
  assert.strictEqual(n, 0, 'refilling the same colour must terminate immediately');
  assert.deepStrictEqual(render(g.px, g.w, g.h), ['rr', 'rr']);
});

test('tolerance widens what counts as the same colour', () => {
  const ctx = coreCtx();
  const g = grid(['..', '..']);
  // Nudge one pixel slightly off white.
  g.px[4] = 250; g.px[5] = 250; g.px[6] = 250;
  const strict = ctx.paintFloodFill(g.px.slice(), g.w, g.h, 0, 0, [255, 0, 0, 255], 0);
  assert.strictEqual(strict, 3, 'a zero tolerance should skip the off-white pixel');
  const loose = ctx.paintFloodFill(g.px, g.w, g.h, 0, 0, [255, 0, 0, 255], 16);
  assert.strictEqual(loose, 4, 'a tolerance of 16 should absorb a 5-level difference');
});

test('a fill started outside the canvas does nothing', () => {
  const ctx = coreCtx();
  const g = grid(['..', '..']);
  assert.strictEqual(ctx.paintFloodFill(g.px, g.w, g.h, -1, 0, [255, 0, 0, 255], 0), 0);
  assert.strictEqual(ctx.paintFloodFill(g.px, g.w, g.h, 0, 9, [255, 0, 0, 255], 0), 0);
  assert.deepStrictEqual(render(g.px, g.w, g.h), ['..', '..']);
});

test('fill covers a full 480x360 canvas without blowing the stack', () => {
  const ctx = coreCtx();
  const w = ctx.paintCanvasWidth(), h = ctx.paintCanvasHeight();
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  const n = ctx.paintFloodFill(px, w, h, 0, 0, [0, 0, 0, 255], 0);
  assert.strictEqual(n, w * h);
});

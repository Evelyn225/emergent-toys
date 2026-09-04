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

// Tools whose generators land in a later task. The list SHRINKS to empty as
// the build order completes - it is a scaffold, not a permanent exemption, and
// leaving an entry here once its task is done is a bug this comment exists to
// make obvious.
const NOT_YET_IMPLEMENTED = new Set(['line', 'rect', 'oval', 'fill', 'eyedropper',
                                     'text', 'sticker', 'wacky', 'eraser', 'select']);

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
// Implementation note: uses scanline run-based seeding, not per-pixel seeding.
// When processing a run [left, right] in row py, the stack seeding for rows
// py-1 and py+1 detects runs (contiguous matching sequences) and pushes only
// the start of each run. This bounds stack depth to O(runs per row) rather than
// O(pixels), keeping a 480x360 fill fast. The 4-connectivity test verifies that
// run detection respects column adjacency only (no diagonal shortcuts).

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

// ── brush generators ─────────────────────────────────────────────

function stroke(x0, y0, x1, y1, index) {
  return { x0, y0, x1, y1, index: index || 0 };
}
function stateFor(ctx, over) {
  return Object.assign({
    color: '#ff0000',
    size: 3,
    rng: ctx.paintRng(42),
    points: [],
    stickerIndex: 0,
  }, over || {});
}

test('a zero-length segment still emits at least one op', () => {
  const ctx = coreCtx();
  // A click without a drag is a real gesture, and "tapping does nothing" is the
  // classic failure of a generator written only for the drag case.
  ctx.paintTools().forEach(tool => {
    if (NOT_YET_IMPLEMENTED.has(tool.id)) return;
    ctx.paintVariantsFor(tool.id).forEach(v => {
      const ops = ctx.paintGenerate(tool.id, v.id, stroke(100, 100, 100, 100), stateFor(ctx));
      assert.ok(Array.isArray(ops), tool.id + '/' + v.id + ' did not return an array');
      if (tool.id === 'select') return;   // move is handled by the UI, not by ops
      assert.ok(ops.length >= 1, tool.id + '/' + v.id + ' emitted nothing for a click');
    });
  });
});

test('generators are deterministic for a seed', () => {
  const ctx = coreCtx();
  const a = ctx.paintGenerate('pencil', 'sketchy', stroke(10, 10, 40, 40), stateFor(ctx, { rng: ctx.paintRng(7) }));
  const b = ctx.paintGenerate('pencil', 'sketchy', stroke(10, 10, 40, 40), stateFor(ctx, { rng: ctx.paintRng(7) }));
  assert.deepStrictEqual(a, b, 'the same seed produced different ops');
});

test('every emitted op carries the fields its renderer reads', () => {
  const ctx = coreCtx();
  const KNOWN = { dab: ['x','y','r','color'], line: ['x0','y0','x1','y1','w','color'],
                  rect: ['x','y','w','h','color'], sprite: ['idx','x','y','size','rot'],
                  erase: ['x','y','r'] };
  ctx.paintTools().forEach(tool => {
    if (NOT_YET_IMPLEMENTED.has(tool.id)) return;
    ctx.paintVariantsFor(tool.id).forEach(v => {
      ctx.paintGenerate(tool.id, v.id, stroke(50, 50, 120, 90), stateFor(ctx)).forEach(op => {
        const fields = KNOWN[op.op];
        assert.ok(fields, tool.id + '/' + v.id + ' emitted an unknown op: ' + op.op);
        fields.forEach(f => {
          assert.ok(op[f] !== undefined, tool.id + '/' + v.id + ' ' + op.op + ' is missing ' + f);
          if (f !== 'color') assert.ok(Number.isFinite(op[f]), tool.id + '/' + v.id + ' ' + op.op + '.' + f + ' is not finite');
        });
      });
    });
  });
});

test('a pencil segment emits a line of the variant width', () => {
  const ctx = coreCtx();
  const ops = ctx.paintGenerate('pencil', 'p5', stroke(10, 10, 30, 10), stateFor(ctx));
  const line = ops.find(o => o.op === 'line');
  assert.ok(line, 'no line op from the pencil');
  assert.strictEqual(line.w, 5);
  assert.strictEqual(line.color, '#ff0000');
});

test('an unknown tool or variant returns an empty list rather than throwing', () => {
  const ctx = coreCtx();
  // plain() strips the vm realm's Array prototype so deepStrictEqual can compare
  // against a host [] literal - see the note on other tests in this file.
  assert.deepStrictEqual(plain(ctx.paintGenerate('nope', 'nope', stroke(0, 0, 1, 1), stateFor(ctx))), []);
  assert.deepStrictEqual(plain(ctx.paintGenerate('pencil', 'nope', stroke(0, 0, 1, 1), stateFor(ctx))), []);
});

// ── sticker atlas geometry ───────────────────────────────────────

test('the atlas holds 112 stickers over 8 pages of 14', () => {
  const ctx = coreCtx();
  assert.strictEqual(ctx.paintStickerCount(), 112);
  assert.strictEqual(ctx.paintStickerPages(), 8);
  assert.strictEqual(ctx.paintStickerPerPage(), 14);
  assert.strictEqual(ctx.paintStickerPages() * ctx.paintStickerPerPage(), ctx.paintStickerCount());
});

test('the first and last sticker map to in-bounds source rects', () => {
  const ctx = coreCtx();
  const cell = ctx.paintStickerCell();
  // plain() strips the vm realm's Object prototype - see the note above on
  // other tests in this file - so deepStrictEqual can compare against a host
  // {} literal instead of reporting "same structure but not reference-equal".
  const first = plain(ctx.paintStickerRect(0));
  assert.deepStrictEqual(first, { sx: 0, sy: 0, sw: cell, sh: cell });
  const last = plain(ctx.paintStickerRect(111));
  assert.deepStrictEqual(last, { sx: 13 * cell, sy: 7 * cell, sw: cell, sh: cell });
  // The atlas is 14 wide by 8 tall with no gutter, so the last cell must end
  // exactly on the image edge. An off-by-one here samples a neighbour's pixels.
  assert.strictEqual(last.sx + last.sw, 14 * cell);
  assert.strictEqual(last.sy + last.sh, 8 * cell);
});

test('a sticker index off either end of the sheet is rejected', () => {
  const ctx = coreCtx();
  assert.strictEqual(ctx.paintStickerRect(112), null, 'index 112 is past the end of a 112-sticker sheet');
  assert.strictEqual(ctx.paintStickerRect(-1), null);
  assert.strictEqual(ctx.paintStickerRect(1.5), null);
});

test('sticker indices run left to right then top to bottom', () => {
  const ctx = coreCtx();
  const cell = ctx.paintStickerCell();
  // Index 14 is the first sticker of the second row, not the second column.
  assert.deepStrictEqual(plain(ctx.paintStickerRect(14)), { sx: 0, sy: cell, sw: cell, sh: cell });
  assert.deepStrictEqual(plain(ctx.paintStickerRect(13)), { sx: 13 * cell, sy: 0, sw: cell, sh: cell });
});

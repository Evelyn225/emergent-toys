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
const NOT_YET_IMPLEMENTED = new Set(['eraser', 'select']);

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
      // select, fill and eyedropper are exempted for different reasons. select
      // moves pixels rather than emitting ops, so an empty list is correct.
      // fill and eyedropper are handled by paintDoFill/paintDoEyedropper in the
      // UI rather than through a click here, so what paintGenerate returns for
      // them is irrelevant to real drawing - fill's registered generators
      // exist only to paint the options-bar preview button and deliberately
      // are NOT empty, which is exactly why this assertion does not apply.
      if (tool.id === 'select' || tool.id === 'fill' || tool.id === 'eyedropper') return;
      assert.ok(ops.length >= 1, tool.id + '/' + v.id + ' emitted nothing for a click');
    });
  });
});

test('generators are deterministic for a seed', () => {
  const ctx = coreCtx();
  const a = ctx.paintGenerate('wacky', 'spray', stroke(10, 10, 40, 40), stateFor(ctx, { rng: ctx.paintRng(7) }));
  const b = ctx.paintGenerate('wacky', 'spray', stroke(10, 10, 40, 40), stateFor(ctx, { rng: ctx.paintRng(7) }));
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

test('a sticker click emits one sprite op at the click, sized by the variant', () => {
  const ctx = coreCtx();
  const st = stateFor(ctx, { stickerIndex: 5 });
  const small = ctx.paintGenerate('sticker', 'small', stroke(100, 80, 100, 80), st);
  assert.strictEqual(small.length, 1);
  assert.strictEqual(small[0].op, 'sprite');
  assert.strictEqual(small[0].idx, 5);
  assert.strictEqual(small[0].x, 100);
  assert.strictEqual(small[0].y, 80);

  const large = ctx.paintGenerate('sticker', 'large', stroke(100, 80, 100, 80), stateFor(ctx, { stickerIndex: 5 }));
  assert.ok(large[0].size > small[0].size, 'large stickers are not larger than small ones');
});

test('dragging with the sticker tool spaces stamps out rather than smearing', () => {
  const ctx = coreCtx();
  const ops = ctx.paintGenerate('sticker', 'medium', stroke(0, 0, 200, 0), stateFor(ctx, { stickerIndex: 1 }));
  assert.ok(ops.length >= 2, 'a long drag should lay down more than one stamp');
  // Neighbouring stamps must not overlap into a solid bar.
  for (let i = 1; i < ops.length; i++) {
    assert.ok(Math.abs(ops[i].x - ops[i - 1].x) >= ops[i].size * 0.75,
      'stamps are too close together and will read as a smear');
  }
});

// ── shapes ───────────────────────────────────────────────────────

test('a line variant emits one line at the drag ends with the right width', () => {
  const ctx = coreCtx();
  const ops = ctx.paintGenerate('line', 'l6', stroke(10, 20, 90, 40), stateFor(ctx));
  const line = ops.find(o => o.op === 'line');
  assert.ok(line);
  assert.deepStrictEqual([line.x0, line.y0, line.x1, line.y1], [10, 20, 90, 40]);
  assert.strictEqual(line.w, 6);
});

test('an arrow line adds a head at the far end and nothing at the near end', () => {
  const ctx = coreCtx();
  const ops = ctx.paintGenerate('line', 'arrow', stroke(0, 0, 100, 0), stateFor(ctx));
  assert.ok(ops.length >= 3, 'an arrow is a shaft plus two head strokes');
  const nearEnd = ops.filter(o => o.op === 'line' && (o.x0 < 20 && o.x1 < 20));
  assert.strictEqual(nearEnd.length, 0, 'the arrowhead is on the wrong end');
});

test('a filled rectangle covers the drag box and an outline does not fill it', () => {
  const ctx = coreCtx();
  const filled = ctx.paintGenerate('rect', 'filled', stroke(10, 10, 50, 30), stateFor(ctx));
  const r = filled.find(o => o.op === 'rect');
  assert.deepStrictEqual([r.x, r.y, r.w, r.h], [10, 10, 40, 20]);
  const outline = ctx.paintGenerate('rect', 'outline', stroke(10, 10, 50, 30), stateFor(ctx));
  assert.strictEqual(outline.filter(o => o.op === 'rect' && o.w > 5 && o.h > 5).length, 0,
    'the outline variant emitted a solid block');
  assert.ok(outline.length >= 4, 'an outline needs four sides');
});

test('a rectangle dragged up and to the left still has positive dimensions', () => {
  const ctx = coreCtx();
  // Dragging from bottom-right to top-left is a normal gesture, and a negative
  // width silently draws nothing on a canvas.
  const ops = ctx.paintGenerate('rect', 'filled', stroke(80, 60, 20, 10), stateFor(ctx));
  const r = ops.find(o => o.op === 'rect');
  assert.deepStrictEqual([r.x, r.y, r.w, r.h], [20, 10, 60, 50]);
});

test('a rounded rectangle covers all four corners with same-radius dabs and gapless spans', () => {
  const ctx = coreCtx();
  // A rounded rect is a plus-shaped pair of full-span rects (one inset in
  // width, one inset in height) plus a corner dab at each of the four
  // corners it leaves bare. Assert the seams line up rather than rasterising.
  const ops = ctx.paintGenerate('rect', 'round', stroke(10, 10, 50, 50), stateFor(ctx));
  const b = { x: 10, y: 10, w: 40, h: 40 };
  const r = 8; // Math.min(8, b.w / 2, b.h / 2)

  const dabs = ops.filter(o => o.op === 'dab');
  assert.strictEqual(dabs.length, 4, 'a rounded rect needs one dab per corner');
  const corners = [
    [b.x + r, b.y + r], [b.x + b.w - r, b.y + r],
    [b.x + r, b.y + b.h - r], [b.x + b.w - r, b.y + b.h - r],
  ];
  corners.forEach(([cx, cy]) => {
    const hit = dabs.find(d => d.x === cx && d.y === cy);
    assert.ok(hit, `missing a corner dab at (${cx},${cy})`);
    assert.strictEqual(hit.r, r, 'corner dab radius does not match the rounding radius');
  });

  const rects = ops.filter(o => o.op === 'rect');
  assert.strictEqual(rects.length, 2, 'a rounded rect needs exactly two spanning rects');
  const horiz = rects.find(o => o.w === b.w - r * 2);
  const vert = rects.find(o => o.h === b.h - r * 2);
  assert.ok(horiz && horiz.h === b.h, 'the horizontal span does not run the full height');
  assert.ok(vert && vert.w === b.w, 'the vertical span does not run the full width');
  // Gapless: each span's inset edge must land exactly on the corner dabs'
  // centre line, or a seam opens between the flat spans and the corner circles.
  assert.strictEqual(horiz.x, b.x + r);
  assert.strictEqual(horiz.x + horiz.w, b.x + b.w - r);
  assert.strictEqual(vert.y, b.y + r);
  assert.strictEqual(vert.y + vert.h, b.y + b.h - r);
});

test('an oval is drawn as dabs along an ellipse, inside the drag box', () => {
  const ctx = coreCtx();
  const ops = ctx.paintGenerate('oval', 'outline', stroke(0, 0, 100, 60), stateFor(ctx));
  assert.ok(ops.length > 8, 'too few dabs to read as a curve');
  ops.forEach(o => {
    assert.ok(o.x >= -1 && o.x <= 101, 'oval dab escaped the drag box on x: ' + o.x);
    assert.ok(o.y >= -1 && o.y <= 61, 'oval dab escaped the drag box on y: ' + o.y);
  });
});

// ── patterns and colour conversion ───────────────────────────────

test('hex and rgba convert both ways without drift', () => {
  const ctx = coreCtx();
  // plain() strips the vm realm's Array prototype - see the note above on
  // paintGenerate's empty-list assertions. Without it deepStrictEqual reports
  // "same structure but not reference-equal" against a host-realm array
  // literal, which is not the bug this test is trying to catch.
  assert.deepStrictEqual(plain(ctx.paintHexToRgba('#ff8000')), [255, 128, 0, 255]);
  assert.strictEqual(ctx.paintRgbaToHex(255, 128, 0), '#ff8000');
  ctx.paintPalette().forEach(c => {
    const [r, g, b] = ctx.paintHexToRgba(c.hex);
    assert.strictEqual(ctx.paintRgbaToHex(r, g, b), c.hex, 'round trip lost ' + c.hex);
  });
});

test('the solid pattern inks every pixel and the others do not', () => {
  const ctx = coreCtx();
  const rng = ctx.paintRng(1);
  let solidOn = 0, checkOn = 0, total = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      total++;
      if (ctx.paintPatternAt('solid', x, y, rng)) solidOn++;
      if (ctx.paintPatternAt('check', x, y, rng)) checkOn++;
    }
  }
  assert.strictEqual(solidOn, total, 'solid left gaps');
  assert.ok(checkOn > 0 && checkOn < total, 'checks are either solid or empty: ' + checkOn);
});

test('every fill variant has a pattern function and none throws', () => {
  const ctx = coreCtx();
  ctx.paintVariantsFor('fill').forEach(v => {
    const rng = ctx.paintRng(3);
    let on = 0;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (ctx.paintPatternAt(v.id, x, y, rng)) on++;
    assert.ok(on > 0, 'pattern ' + v.id + ' inks nothing, so a fill with it does nothing');
  });
});

test('geometric patterns are position-dependent, not random', () => {
  const ctx = coreCtx();
  // A stripe at (4,4) must read the same every time or a fill will shimmer.
  ['check', 'stripe', 'diag', 'dots', 'grid'].forEach(id => {
    const a = ctx.paintPatternAt(id, 4, 4, ctx.paintRng(1));
    const b = ctx.paintPatternAt(id, 4, 4, ctx.paintRng(99));
    assert.strictEqual(a, b, 'pattern ' + id + ' depends on the rng and will shimmer');
  });
});

// ── wacky brushes ────────────────────────────────────────────────

test('all fifteen wacky brushes are registered and draw something', () => {
  const ctx = coreCtx();
  const variants = ctx.paintVariantsFor('wacky');
  assert.strictEqual(variants.length, 15);
  variants.forEach(v => {
    const ops = ctx.paintGenerate('wacky', v.id, stroke(40, 40, 120, 90), stateFor(ctx));
    assert.ok(ops.length > 0, 'wacky/' + v.id + ' drew nothing on a drag');
  });
});

test('every wacky brush is deterministic for a seed', () => {
  const ctx = coreCtx();
  ctx.paintVariantsFor('wacky').forEach(v => {
    const a = ctx.paintGenerate('wacky', v.id, stroke(10, 10, 80, 60), stateFor(ctx, { rng: ctx.paintRng(5) }));
    const b = ctx.paintGenerate('wacky', v.id, stroke(10, 10, 80, 60), stateFor(ctx, { rng: ctx.paintRng(5) }));
    assert.deepStrictEqual(a, b, 'wacky/' + v.id + ' is not reproducible from its seed');
  });
});

test('no wacky brush throws ops off the canvas', () => {
  const ctx = coreCtx();
  const W = ctx.paintCanvasWidth(), H = ctx.paintCanvasHeight();
  // Dragging near an edge is the case that catches a brush which scatters
  // outward without clamping - kaleidoscope and splatter both can.
  const edges = [stroke(2, 2, 8, 8), stroke(W - 3, H - 3, W - 9, H - 9), stroke(W / 2, 1, W / 2, 6)];
  ctx.paintVariantsFor('wacky').forEach(v => {
    edges.forEach(seg => {
      ctx.paintGenerate('wacky', v.id, seg, stateFor(ctx)).forEach(op => {
        const x = op.x !== undefined ? op.x : op.x0;
        const y = op.y !== undefined ? op.y : op.y0;
        assert.ok(x >= -64 && x <= W + 64, 'wacky/' + v.id + ' emitted x=' + x + ', far off canvas');
        assert.ok(y >= -64 && y <= H + 64, 'wacky/' + v.id + ' emitted y=' + y + ', far off canvas');
      });
    });
  });
});

test('the kaleidoscope mirrors its dabs about both axes', () => {
  const ctx = coreCtx();
  const W = ctx.paintCanvasWidth(), H = ctx.paintCanvasHeight();
  const ops = ctx.paintGenerate('wacky', 'kaleido', stroke(100, 80, 100, 80), stateFor(ctx));
  assert.strictEqual(ops.length % 4, 0, 'a four-fold mirror should emit a multiple of four');
  const xs = ops.map(o => o.x);
  assert.ok(xs.some(x => Math.abs(x - (W - 100)) < 1), 'no horizontal mirror');
  const ys = ops.map(o => o.y);
  assert.ok(ys.some(y => Math.abs(y - (H - 80)) < 1), 'no vertical mirror');
});

test('the rainbow ribbon changes colour along the stroke', () => {
  const ctx = coreCtx();
  const ops = ctx.paintGenerate('wacky', 'rainbow', stroke(0, 0, 200, 0), stateFor(ctx, { color: '#ff0000' }));
  const colors = new Set(ops.map(o => o.color));
  assert.ok(colors.size > 2, 'the rainbow brush painted in one colour');
});

test('sticker scatter only ever emits valid sticker indices', () => {
  const ctx = coreCtx();
  const count = ctx.paintStickerCount();
  const ops = ctx.paintGenerate('wacky', 'scatter', stroke(20, 20, 300, 200), stateFor(ctx));
  assert.ok(ops.length > 0);
  ops.forEach(o => {
    assert.strictEqual(o.op, 'sprite');
    assert.ok(Number.isInteger(o.idx) && o.idx >= 0 && o.idx < count,
      'scatter emitted sticker index ' + o.idx + ', outside 0..' + (count - 1));
  });
});

test('connect the dots draws back to earlier points in the stroke', () => {
  const ctx = coreCtx();
  const st = stateFor(ctx, { points: [{ x: 10, y: 10 }, { x: 50, y: 50 }, { x: 90, y: 20 }] });
  const ops = ctx.paintGenerate('wacky', 'connect', stroke(90, 20, 120, 60), st);
  const lines = ops.filter(o => o.op === 'line');
  assert.ok(lines.length >= 2, 'connect the dots drew no chords back to earlier points');
});

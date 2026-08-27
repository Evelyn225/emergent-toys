'use strict';
// The window layout maths, deliberately written as pure functions of numbers
// so it can be tested here rather than only in a browser. os/wm.js is otherwise
// DOM-bound; these four functions are the part that can be proved.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

// os/wm.js runs updateClock() at parse time, which reads osSettings, and
// declares helpers that reference recycleBinEntries. Stub what it touches at
// load time so the pure functions can be reached.
//
// updateClock() also does document.getElementById('clock').textContent = ...
// synchronously at parse time, and further down os/wm.js registers a
// document-level mousedown listener the same way. The shared document
// stub's getElementById always returns null and has no
// addEventListener/removeEventListener at all, so both lines throw before
// os/wm.js finishes loading. Overriding document here (rather than in the
// shared helper) keeps this fix scoped to this file, which is the only one
// that loads a source touching the DOM at parse time this way.
//
// os/wm.js also calls setInterval(updateClock, 1000) at parse time. The
// shared context aliases the real Node setInterval, so left alone that
// timer keeps firing forever and keeps the process's event loop alive -
// `node --test` prints results and then hangs rather than exiting. Stubbing
// setInterval to a no-op avoids arming a real timer at all.
function wmCtx() {
  const ctx = makeOsContext({
    osSettings: { clock12h: false },
    recycleBinEntries: [],
    isRecycleBinItemName: () => false,
    SYSTEM_FILE_ICONS: {},
    wins: {},
    zTop: 100,
    document: {
      getElementById: () => ({ textContent: '' }),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    setInterval: () => {},
  });
  return loadOsSources(ctx, ['os/wm.js']);
}

const BOUNDS = { w: 1000, h: 600 };
const EDGE = 20;

test('a cursor in the left strip is the left zone', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(5, 300, BOUNDS, EDGE), 'left');
  assert.strictEqual(ctx.wmSnapZoneAt(19, 300, BOUNDS, EDGE), 'left');
});

test('a cursor in the right strip is the right zone', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(995, 300, BOUNDS, EDGE), 'right');
});

test('a cursor in the top strip is the top zone', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(500, 5, BOUNDS, EDGE), 'top');
});

test('the middle of the desktop is no zone', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(500, 300, BOUNDS, EDGE), null);
});

// The bottom edge belongs to the taskbar, which desktopBounds already excludes.
// A cursor below the desktop is outside it, not "the bottom zone" - there is no
// bottom zone at all.
test('there is no bottom zone', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(500, 599, BOUNDS, EDGE), null);
  assert.strictEqual(ctx.wmSnapZoneAt(500, 620, BOUNDS, EDGE), null);
});

// Top wins in the corner: dragging into a corner is far more often an attempt
// to maximize than to half-snap, and picking one deterministically beats
// whichever branch happens to be tested first.
test('a corner resolves to top, deterministically', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(3, 3, BOUNDS, EDGE), 'top');
  assert.strictEqual(ctx.wmSnapZoneAt(997, 3, BOUNDS, EDGE), 'top');
});

test('a cursor outside the desktop is no zone', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(-5, 300, BOUNDS, EDGE), null);
  assert.strictEqual(ctx.wmSnapZoneAt(1005, 300, BOUNDS, EDGE), null);
});

test('the left snap rect is exactly half width and full height', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmSnapRect('left', BOUNDS)),
    { left: 0, top: 0, width: 500, height: 600 });
});

test('the right snap rect starts at the midpoint', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmSnapRect('right', BOUNDS)),
    { left: 500, top: 0, width: 500, height: 600 });
});

test('the top snap rect fills the desktop', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmSnapRect('top', BOUNDS)),
    { left: 0, top: 0, width: 1000, height: 600 });
});

test('an odd width splits without leaving a gap', () => {
  const ctx = wmCtx();
  const b = { w: 1001, h: 600 };
  const l = plain(ctx.wmSnapRect('left', b));
  const r = plain(ctx.wmSnapRect('right', b));
  assert.strictEqual(l.width + r.width, 1001, 'halves must cover the full width');
  assert.strictEqual(r.left, l.width, 'the right half must start where the left ends');
});

test('an unknown zone has no rect', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapRect(null, BOUNDS), null);
  assert.strictEqual(ctx.wmSnapRect('bottom', BOUNDS), null);
});

test('cascade steps each window down and right', () => {
  const ctx = wmCtx();
  const rects = plain(ctx.wmCascadeRects(3, BOUNDS, 24));
  assert.strictEqual(rects.length, 3);
  assert.strictEqual(rects[0].left, 0);
  assert.strictEqual(rects[0].top, 0);
  assert.strictEqual(rects[1].left, 24);
  assert.strictEqual(rects[1].top, 24);
  assert.strictEqual(rects[2].left, 48);
});

test('every cascaded window stays inside the desktop', () => {
  const ctx = wmCtx();
  plain(ctx.wmCascadeRects(40, BOUNDS, 24)).forEach((r, i) => {
    assert.ok(r.left >= 0 && r.top >= 0, 'window ' + i + ' is off the top-left');
    assert.ok(r.left + r.width <= BOUNDS.w, 'window ' + i + ' overflows the right edge');
    assert.ok(r.top + r.height <= BOUNDS.h, 'window ' + i + ' overflows the bottom edge');
  });
});

test('cascade of nothing is an empty list, not a crash', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmCascadeRects(0, BOUNDS, 24)), []);
});

// wmSnapZoneAt and wmSnapRect both guard a falsy bounds and return null.
// wmCascadeRects and wmTileRects are the array-returning half of the same
// four-function contract, so a falsy bounds must degrade the same way -
// an empty array, not a thrown TypeError from dereferencing bounds.w/h.
test('cascade with no bounds is an empty list, not a crash', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmCascadeRects(3, null, 24)), []);
});

test('one tiled window fills the desktop', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmTileRects(1, BOUNDS)),
    [{ left: 0, top: 0, width: 1000, height: 600 }]);
});

test('two tiled windows split into columns with no gap or overlap', () => {
  const ctx = wmCtx();
  const r = plain(ctx.wmTileRects(2, BOUNDS));
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].left + r[0].width, r[1].left, 'a gap or overlap between columns');
  assert.strictEqual(r[1].left + r[1].width, BOUNDS.w, 'the grid must reach the right edge');
});

test('four tiled windows make a 2x2 grid covering the desktop', () => {
  const ctx = wmCtx();
  const r = plain(ctx.wmTileRects(4, BOUNDS));
  assert.strictEqual(r.length, 4);
  const area = r.reduce((sum, x) => sum + x.width * x.height, 0);
  assert.strictEqual(area, BOUNDS.w * BOUNDS.h, 'tiles must exactly cover the desktop');

  // The area check alone would pass a gap and an overlap of equal area
  // undetected - exactly the shape of bug the ragged-last-row test below
  // exists to catch. Assert actual coverage: two columns sharing an edge,
  // two rows sharing an edge, and the grid's outer edges landing exactly on
  // the desktop bounds.
  const tops = [...new Set(r.map(x => x.top))].sort((a, b) => a - b);
  const lefts = [...new Set(r.map(x => x.left))].sort((a, b) => a - b);
  assert.strictEqual(tops.length, 2, 'expected exactly two distinct row tops');
  assert.strictEqual(lefts.length, 2, 'expected exactly two distinct column lefts');
  assert.strictEqual(tops[0], 0, 'the top row must start at the desktop top edge');
  assert.strictEqual(lefts[0], 0, 'the left column must start at the desktop left edge');
  r.forEach(x => {
    const right = x.left + x.width;
    const bottom = x.top + x.height;
    assert.ok(right === lefts[1] || right === BOUNDS.w,
      'a tile\'s right edge must meet the column seam or the desktop edge, got ' + right);
    assert.ok(bottom === tops[1] || bottom === BOUNDS.h,
      'a tile\'s bottom edge must meet the row seam or the desktop edge, got ' + bottom);
  });
  // The seam and the outer edge must each actually occur, not just be
  // allowed - otherwise every tile could land on the outer edge alone and
  // still pass the check above.
  assert.ok(r.some(x => x.left + x.width === lefts[1]), 'no tile meets the column seam');
  assert.ok(r.some(x => x.left + x.width === BOUNDS.w), 'no tile reaches the right edge');
  assert.ok(r.some(x => x.top + x.height === tops[1]), 'no tile meets the row seam');
  assert.ok(r.some(x => x.top + x.height === BOUNDS.h), 'no tile reaches the bottom edge');

  // Every check above is aggregate or existence-based, so a duplicated tile
  // sitting on top of an already-covered cell - while some other cell is
  // never covered at all - can satisfy every one of them: the area still
  // sums right if the duplicate's area equals the missing cell's, the two
  // tops/lefts still both appear, and every edge the duplicate has was
  // already a legal value. Pin down that the four tiles are four DISTINCT
  // cells: exactly the 2x2 cross product of lefts and tops, no repeats.
  const pairs = r.map(x => x.left + ',' + x.top);
  assert.strictEqual(new Set(pairs).size, 4,
    'expected four distinct tile positions, got ' + JSON.stringify(pairs));
  const expected = new Set();
  lefts.forEach(l => tops.forEach(t => expected.add(l + ',' + t)));
  assert.deepStrictEqual([...new Set(pairs)].sort(), [...expected].sort(),
    'tile positions must be exactly the 2x2 cross product of the two lefts and two tops');
});

// The interesting case: the last row of a 5-window grid is not full. It must
// still cover the width rather than leaving a ragged edge.
test('five tiled windows leave no ragged edge on the last row', () => {
  const ctx = wmCtx();
  const r = plain(ctx.wmTileRects(5, BOUNDS));
  assert.strictEqual(r.length, 5);
  r.forEach((x, i) => {
    assert.ok(x.left + x.width <= BOUNDS.w + 1, 'tile ' + i + ' overflows the right edge');
    assert.ok(x.top + x.height <= BOUNDS.h + 1, 'tile ' + i + ' overflows the bottom edge');
  });
  const bottomRow = r.filter(x => x.top + x.height >= BOUNDS.h - 1);
  const covered = bottomRow.reduce((s, x) => s + x.width, 0);
  assert.strictEqual(covered, BOUNDS.w, 'the last row must span the full width');
});

// Ten windows on this desktop would each be under WIN_MIN_W. The layout clamps
// to the minimum and accepts overlap rather than producing windows too small to
// have a usable titlebar.
test('a crowded tile clamps to the minimum window size instead of going smaller', () => {
  const ctx = wmCtx();
  const tiny = { w: 400, h: 300 };
  plain(ctx.wmTileRects(12, tiny)).forEach((r, i) => {
    assert.ok(r.width >= 180, 'tile ' + i + ' is narrower than WIN_MIN_W: ' + r.width);
    assert.ok(r.height >= 80, 'tile ' + i + ' is shorter than WIN_MIN_H: ' + r.height);
  });
});

test('tile of nothing is an empty list, not a crash', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmTileRects(0, BOUNDS)), []);
});

test('tile with no bounds is an empty list, not a crash', () => {
  const ctx = wmCtx();
  assert.deepStrictEqual(plain(ctx.wmTileRects(4, null)), []);
});

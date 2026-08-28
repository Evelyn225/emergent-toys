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
      // style: {} lets wmSnapPreviewHide's `el.style.display = 'none'` write
      // land on a real object instead of throwing - needed once the ownership
      // tests below call wmSnapPreviewRelease, which touches the DOM on the
      // owner path.
      getElementById: () => ({ textContent: '', style: {} }),
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

// The production defaults (no edge args at all): side zones are wider than
// the top zone, since only the top zone maximizes the window.
test('with no edge argument, the default side zone is 48px', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(40, 300, BOUNDS), 'left');
  assert.strictEqual(ctx.wmSnapZoneAt(60, 300, BOUNDS), null);
});

// topEdge falls back to `edge`, not to WM_SNAP_EDGE_TOP - so omitting BOTH
// arguments does NOT give a narrower top zone; y=40 still resolves 'top'
// because te falls back to the 48px side default, same as e.
test('with no edge argument at all, the top zone is NOT narrowed - it matches the side default', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(500, 40, BOUNDS), 'top');
});

// The narrower top zone is a property of the PRODUCTION call site passing
// WM_SNAP_EDGE and WM_SNAP_EDGE_TOP explicitly, not of any built-in default -
// reproduced here by passing both, exactly as makeDraggable's onMove does.
test('with edge=48 and topEdge=32 passed explicitly (as production does), the top zone is narrower than the side zone', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(500, 40, BOUNDS, 48, 32), null);
  assert.strictEqual(ctx.wmSnapZoneAt(500, 20, BOUNDS, 48, 32), 'top');
});

// topEdge falls back to `edge` when only `edge` is passed, so every existing
// test above - which passes EDGE and expects the top strip to match it -
// keeps meaning what it says.
test('topEdge falls back to edge when only edge is passed', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(500, 25, BOUNDS, 20), null);
});

test('an explicit topEdge is honoured', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapZoneAt(500, 25, BOUNDS, 48, 32), 'top');
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

  // Earlier versions of this test added one targeted assertion per
  // counterexample found (area alone missed a gap balanced by an equal-area
  // overlap; edge-membership alone missed a duplicated cell; existence
  // checks alone missed a duplicated cell paired with an uncovered one).
  // Each fix closed exactly the shape it was aimed at and left the next one
  // open. Pinning position AND size together instead leaves no room for a
  // counterexample to exist: with two column lefts and two row tops fixed,
  // and every tile's width/height required to equal ITS OWN column/row
  // size, all four rectangles are uniquely determined. A gap, an overlap, a
  // duplicate, or a mis-sized sliver all show up as a wrong width or height
  // on some specific tile - there's no remaining degree of freedom for a
  // wrong grid to hide in.
  const tops = [...new Set(r.map(x => x.top))].sort((a, b) => a - b);
  const lefts = [...new Set(r.map(x => x.left))].sort((a, b) => a - b);
  assert.strictEqual(tops.length, 2, 'expected exactly two distinct row tops');
  assert.strictEqual(lefts.length, 2, 'expected exactly two distinct column lefts');
  assert.strictEqual(tops[0], 0, 'the top row must start at the desktop top edge');
  assert.strictEqual(lefts[0], 0, 'the left column must start at the desktop left edge');
  assert.ok(lefts[1] > 0 && lefts[1] < BOUNDS.w,
    'the column seam must fall strictly inside the desktop width, got ' + lefts[1]);
  assert.ok(tops[1] > 0 && tops[1] < BOUNDS.h,
    'the row seam must fall strictly inside the desktop height, got ' + tops[1]);

  // Positions must be exactly the 2x2 cross product of those lefts and
  // tops, with no repeats - a duplicated position sorts differently from
  // four distinct ones.
  const expected = [];
  lefts.forEach(l => tops.forEach(t => expected.push(l + ',' + t)));
  const actual = r.map(x => x.left + ',' + x.top);
  assert.deepStrictEqual(actual.slice().sort(), expected.slice().sort(),
    'tile positions must be exactly the 2x2 cross product of the two lefts and two tops, with no repeats');

  // Each tile's size must exactly equal the column/row it sits in - not
  // merely land on some legal edge value. This is what a sliver-plus-
  // oversized-neighbor pair fails: both edges are individually legal, but
  // neither tile's size matches the column it claims to occupy.
  const colWidth = { [lefts[0]]: lefts[1] - lefts[0], [lefts[1]]: BOUNDS.w - lefts[1] };
  const rowHeight = { [tops[0]]: tops[1] - tops[0], [tops[1]]: BOUNDS.h - tops[1] };
  r.forEach(x => {
    assert.strictEqual(x.width, colWidth[x.left],
      'tile at left=' + x.left + ' must span its own column width, got ' + x.width);
    assert.strictEqual(x.height, rowHeight[x.top],
      'tile at top=' + x.top + ' must span its own row height, got ' + x.height);
  });
  // The area check from earlier rounds is now redundant: pinning every
  // tile's position to the cross product AND its size to that position's
  // column/row width and height already forces the total area to
  // lefts-span * tops-span === BOUNDS.w * BOUNDS.h. Nothing above can pass
  // while area is wrong.
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

// ── snap state ───────────────────────────────────────────────────
// A window is normal, maximized, OR snapped - never two at once. All three
// transitions out of normal capture origStyle, and all three restore from it,
// so there is exactly one save/restore path rather than two that can disagree.

test('wmIsFilled is true for a maximized or snapped window, false otherwise', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmIsFilled({ maximized: false, snap: null }), false);
  assert.strictEqual(ctx.wmIsFilled({ maximized: true,  snap: null }), true);
  assert.strictEqual(ctx.wmIsFilled({ maximized: false, snap: 'left' }), true);
  assert.strictEqual(ctx.wmIsFilled(null), false);
});

// ── snap preview ownership ──────────────────────────────────────────
// The preview element is global state shared by whichever drag is running, so
// it needs an owner. Closing a window that does NOT own the preview (an
// unrelated window closed mid-drag by a script, SYSMON, or a process exiting)
// must never touch a live drag's preview or its ownership - that is the exact
// bug a bare `wmActiveDragId = null` assignment reintroduces, since it would
// clear ownership regardless of whose id was passed in.

test('with no active drag, nothing owns the preview', () => {
  const ctx = wmCtx();
  assert.strictEqual(ctx.wmSnapPreviewOwnedBy('anything'), false);
});

test('releasing the preview for a non-owner id leaves the real owner untouched', () => {
  const ctx = wmCtx();
  ctx.wmSetActiveDragId('owner-1');
  ctx.wmSnapPreviewRelease('someone-else');
  assert.strictEqual(ctx.wmSnapPreviewOwnedBy('owner-1'), true,
    'releasing for a window that is not the owner must not clear the real owner');
});

test('releasing the preview for the actual owner clears ownership', () => {
  const ctx = wmCtx();
  ctx.wmSetActiveDragId('owner-1');
  ctx.wmSnapPreviewRelease('owner-1');
  assert.strictEqual(ctx.wmSnapPreviewOwnedBy('owner-1'), false,
    'the owner releasing its own preview must actually clear ownership');
});

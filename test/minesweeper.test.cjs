'use strict';
// MINESWEEPER.exe's rules, proved in node.
//
// apps/minesweeper.js is split so everything above openMinesweeper is a pure
// function over a plain board object - the same split os/wm.js uses for its
// layout maths, and for the same reason: the interesting mistakes here are all
// logic. A flood fill that tears through a flag, a "safe" first click that can
// still be a mine, a chord that fires on an unsatisfied number - none of those
// need a browser to catch, and none of them are visible in a screenshot.
//
// The file's UI half touches mkWin, playSound and the registry at load time, so
// the source is loaded into a vm with those stubbed; nothing below calls into
// that half.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function msCtx() {
  const ctx = loadOsSources(makeOsContext({
    wins: {},
    registryData: { HKEY_CURRENT_USER: {} },
    saveRegistry: () => {},
    playSound: () => {},
    document: {
      getElementById: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  }), ['apps/minesweeper.js']);
  // Function declarations become context properties; `const` does not (see the
  // loader's header). Rather than demote the app's constants to `var` purely so
  // a test can read them, one assignment inside the context copies them out -
  // and it reads the REAL constants, so a renamed or retyped one fails here
  // instead of silently comparing undefined to undefined.
  ctx.__evalSource(
    'var __ms = { HIDDEN: MS_HIDDEN, REVEALED: MS_REVEALED, FLAG: MS_FLAG,'
    + ' QUESTION: MS_QUESTION, LEVELS: MS_LEVELS, MAX_TIME: MS_MAX_TIME };',
    'minesweeper-constants');
  assert.ok(ctx.__ms && ctx.__ms.LEVELS, 'could not reach the app constants');
  return ctx;
}

// A deterministic stand-in for Math.random that walks a fixed sequence, so a
// test can say exactly where the mines land.
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

// Mines at known indices on a 5x5, by seeding with an rng that always picks
// slot 0 of the remaining candidates. Simpler than reasoning about
// Fisher-Yates: with rng()=0 every draw takes the first unshuffled candidate,
// so mines land on the lowest free indices in order.
function boardWithMinesAt(ctx, cols, rows, indices) {
  const b = ctx.msCreateBoard(cols, rows, 0);
  indices.forEach(i => { b.mine[i] = true; });
  const n = cols * rows;
  for (let i = 0; i < n; i++) {
    b.adj[i] = ctx.msNeighbours(b, i).reduce((s, j) => s + (b.mine[j] ? 1 : 0), 0);
  }
  b.mines = indices.length;
  b.seeded = true;
  return b;
}

// ── geometry ─────────────────────────────────────────────────────

test('a corner has three neighbours, an edge five, the middle eight', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(5, 5, 0);
  assert.strictEqual(ctx.msNeighbours(b, 0).length, 3);
  assert.strictEqual(ctx.msNeighbours(b, 4).length, 3);
  assert.strictEqual(ctx.msNeighbours(b, 24).length, 3);
  assert.strictEqual(ctx.msNeighbours(b, 2).length, 5);
  assert.strictEqual(ctx.msNeighbours(b, 12).length, 8);
});

// A board is a flat array, so the only thing stopping row 0's left edge being
// "adjacent" to row 1's right edge is the column check.
test('neighbours do not wrap around a row edge', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(5, 5, 0);
  assert.deepStrictEqual(plain(ctx.msNeighbours(b, 5)).sort((x, y) => x - y), [0, 1, 6, 10, 11]);
});

// ── the first click ──────────────────────────────────────────────

test('the first click and all eight of its neighbours are always clear', () => {
  const ctx = msCtx();
  // Every level, and a deliberately cramped board, against a real rng.
  [[9, 9, 10], [16, 16, 40], [30, 16, 99], [5, 5, 15]].forEach(([cols, rows, mines]) => {
    for (let trial = 0; trial < 40; trial++) {
      const b = ctx.msCreateBoard(cols, rows, mines);
      const safe = Math.floor(Math.random() * cols * rows);
      ctx.msSeed(b, safe);
      const clear = [safe].concat(plain(ctx.msNeighbours(b, safe)));
      clear.forEach(i => assert.strictEqual(b.mine[i], false,
        cols + 'x' + rows + '/' + mines + ': mine at ' + i + ' inside the safe area around ' + safe));
    }
  });
});

test('the first click always opens an area, never a bare number', () => {
  const ctx = msCtx();
  for (let trial = 0; trial < 40; trial++) {
    const b = ctx.msCreateBoard(9, 9, 10);
    const safe = Math.floor(Math.random() * 81);
    ctx.msSeed(b, safe);
    assert.strictEqual(b.adj[safe], 0, 'first click at ' + safe + ' landed on a ' + b.adj[safe]);
    assert.ok(ctx.msReveal(b, safe).length > 1, 'the first reveal opened a single cell');
  }
});

test('exactly the requested number of mines is placed', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(30, 16, 99);
  ctx.msSeed(b, 0);
  assert.strictEqual(b.mine.filter(Boolean).length, 99);
});

// On a board too dense to keep a whole 3x3 clear, insisting on it would loop
// forever looking for a placement that cannot exist. Winmine's weaker rule -
// the clicked cell only - is the fallback.
test('a board too dense for a clear 3x3 still seeds, keeping only the clicked cell safe', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(4, 4, 15);   // 16 cells, 15 mines
  ctx.msSeed(b, 5);
  assert.strictEqual(b.mine[5], false, 'the clicked cell must still be safe');
  assert.strictEqual(b.mine.filter(Boolean).length, 15);
});

test('mine placement is a function of the rng, so it is reproducible', () => {
  const ctx = msCtx();
  const layout = () => {
    const b = ctx.msCreateBoard(9, 9, 10);
    ctx.msSeed(b, 40, seqRng([0.1, 0.7, 0.3, 0.9, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05]));
    return b.mine.map(Boolean);
  };
  assert.deepStrictEqual(plain(layout()), plain(layout()));
});

// ── revealing ────────────────────────────────────────────────────

test('revealing a numbered cell opens only that cell', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  assert.deepStrictEqual(plain(ctx.msReveal(b, 6)), [6]);
  assert.strictEqual(b.adj[6], 1);
});

test('revealing an empty cell floods out to the numbers that bound it', () => {
  const ctx = msCtx();
  // One mine in the top-left corner: everything except its three neighbours
  // is reachable from the far corner.
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  const opened = plain(ctx.msReveal(b, 24));
  assert.strictEqual(opened.length, 24, 'every cell but the mine should open');
  assert.ok(!opened.includes(0), 'the mine must not be opened');
});

test('flood fill stops at a flag rather than tearing through it', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  b.state[12] = ctx.__ms.FLAG;
  const opened = plain(ctx.msReveal(b, 24));
  assert.ok(!opened.includes(12), 'a flagged cell was opened by the flood fill');
  assert.strictEqual(b.state[12], ctx.__ms.FLAG, 'the flag was cleared');
});

test('revealing an already revealed or flagged cell does nothing', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  ctx.msReveal(b, 6);
  assert.deepStrictEqual(plain(ctx.msReveal(b, 6)), []);
  b.state[7] = ctx.__ms.FLAG;
  assert.deepStrictEqual(plain(ctx.msReveal(b, 7)), []);
});

test('a question mark does not protect a cell from being revealed', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  b.state[6] = ctx.__ms.QUESTION;
  assert.deepStrictEqual(plain(ctx.msReveal(b, 6)), [6]);
});

// ── chording ─────────────────────────────────────────────────────

test('chording a satisfied number returns its unopened neighbours', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  ctx.msReveal(b, 6);            // the "1" touching the corner mine
  b.state[0] = ctx.__ms.FLAG;
  const targets = plain(ctx.msChordTargets(b, 6)).sort((x, y) => x - y);
  assert.deepStrictEqual(targets, [1, 2, 5, 7, 10, 11, 12]);
});

test('chording does nothing when the flags do not match the number', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  ctx.msReveal(b, 6);
  assert.deepStrictEqual(plain(ctx.msChordTargets(b, 6)), [], 'no flags placed yet');
  b.state[1] = ctx.__ms.FLAG;
  b.state[5] = ctx.__ms.FLAG;
  assert.deepStrictEqual(plain(ctx.msChordTargets(b, 6)), [], 'two flags on a 1');
});

// A chord on a wrongly-flagged number opens a mine. That is the player's
// mistake to make and Winmine lets them make it - but only when the count
// actually matches, which is what the test above pins down.
test('chording a wrongly flagged number still returns targets, including the mine', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  ctx.msReveal(b, 6);
  b.state[1] = ctx.__ms.FLAG;      // wrong: the mine is at 0
  assert.ok(plain(ctx.msChordTargets(b, 6)).includes(0));
});

test('chording an unrevealed cell or a zero does nothing', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  assert.deepStrictEqual(plain(ctx.msChordTargets(b, 6)), [], 'not revealed yet');
  ctx.msReveal(b, 24);
  assert.deepStrictEqual(plain(ctx.msChordTargets(b, 24)), [], 'a zero has nothing to chord');
});

// ── marks, counters, win ─────────────────────────────────────────

test('marks cycle hidden to flag to question to hidden', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(5, 5, 1);
  assert.strictEqual(ctx.msCycleMark(b, 0, true), ctx.__ms.FLAG);
  assert.strictEqual(ctx.msCycleMark(b, 0, true), ctx.__ms.QUESTION);
  assert.strictEqual(ctx.msCycleMark(b, 0, true), ctx.__ms.HIDDEN);
});

test('with marks off, a flag clears straight back to hidden', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(5, 5, 1);
  assert.strictEqual(ctx.msCycleMark(b, 0, false), ctx.__ms.FLAG);
  assert.strictEqual(ctx.msCycleMark(b, 0, false), ctx.__ms.HIDDEN);
});

test('a revealed cell cannot be marked', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  ctx.msReveal(b, 6);
  assert.strictEqual(ctx.msCycleMark(b, 6, true), ctx.__ms.REVEALED);
});

test('the counter is mines minus flags, and may go negative', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(5, 5, 2);
  assert.strictEqual(ctx.msRemaining(b), 2);
  b.state[0] = ctx.__ms.FLAG;
  b.state[1] = ctx.__ms.FLAG;
  b.state[2] = ctx.__ms.FLAG;
  assert.strictEqual(ctx.msRemaining(b), -1);
});

test('a question mark is not a flag and does not move the counter', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(5, 5, 2);
  b.state[0] = ctx.__ms.QUESTION;
  assert.strictEqual(ctx.msRemaining(b), 2);
});

// Winmine does not make you mark the mines, and requiring it would mean a
// fully solved board that still says you are playing.
test('the game is won when every safe cell is open, flags or not', () => {
  const ctx = msCtx();
  const b = boardWithMinesAt(ctx, 5, 5, [0]);
  assert.strictEqual(ctx.msIsWon(b), false);
  ctx.msReveal(b, 24);
  assert.strictEqual(ctx.msIsWon(b), true, 'all 24 safe cells are open');
  assert.strictEqual(b.state[0], ctx.__ms.HIDDEN, 'and the mine was never flagged');
});

test('an untouched board is not already won', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(5, 5, 0);
  // 0 mines means every cell is safe and none is revealed, but the board has
  // not been seeded, so no first click has happened. Reporting a win here
  // would open the game on the victory dialog.
  assert.strictEqual(ctx.msIsWon(b), false);
});

// ── the LED panel ────────────────────────────────────────────────

test('the LED panel pads to three digits', () => {
  const ctx = msCtx();
  assert.strictEqual(ctx.msLedText(0), '000');
  assert.strictEqual(ctx.msLedText(7), '007');
  assert.strictEqual(ctx.msLedText(99), '099');
  assert.strictEqual(ctx.msLedText(999), '999');
});

test('the LED panel shows a negative count the way Winmine does', () => {
  const ctx = msCtx();
  assert.strictEqual(ctx.msLedText(-1), '-01');
  assert.strictEqual(ctx.msLedText(-99), '-99');
});

// The panel is three cells wide and the sprite row has no fourth digit, so a
// value past either end has to clamp rather than render as four characters.
test('the LED panel clamps rather than overflowing its three cells', () => {
  const ctx = msCtx();
  assert.strictEqual(ctx.msLedText(1000).length, 3);
  assert.strictEqual(ctx.msLedText(-500).length, 3);
  assert.strictEqual(ctx.msLedText(1000), '999');
  assert.strictEqual(ctx.msLedText(-500), '-99');
});

test('the LED panel survives rubbish rather than rendering NaN', () => {
  const ctx = msCtx();
  assert.strictEqual(ctx.msLedText(undefined), '000');
  assert.strictEqual(ctx.msLedText(NaN), '000');
  assert.strictEqual(ctx.msLedText('12'), '012');
});

// ── levels ───────────────────────────────────────────────────────

test('the three levels are Winmine\'s own', () => {
  const ctx = msCtx();
  assert.deepStrictEqual(plain(ctx.__ms.LEVELS.beginner), { cols: 9, rows: 9, mines: 10, label: 'Beginner' });
  assert.deepStrictEqual(plain(ctx.__ms.LEVELS.intermediate), { cols: 16, rows: 16, mines: 40, label: 'Intermediate' });
  // Expert is 30 wide by 16 tall, not 16 by 30.
  assert.deepStrictEqual(plain(ctx.__ms.LEVELS.expert), { cols: 30, rows: 16, mines: 99, label: 'Expert' });
});

test('a board can never be all mines - there has to be a first click', () => {
  const ctx = msCtx();
  const b = ctx.msCreateBoard(3, 3, 99);
  assert.strictEqual(b.mines, 8);
});

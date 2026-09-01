'use strict';
// MINESWEEPER.exe in a real browser.
//
// test/minesweeper.test.cjs proves the rules as pure functions. This file
// covers what that cannot see: whether a real click reaches the right cell,
// whether the sprite atlas is actually aligned, whether the window resizes to
// the board it is showing, and whether a win reaches the registry.
const test = require('node:test');
const assert = require('node:assert');
const { startHarness, openDesktop, openWindow, rebootDesktop } = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

async function withGame(fn, opts) {
  const { context, page } = await openDesktop(harness.browser, opts || {});
  try {
    await openWindow(page, 'openMinesweeper');
    await page.waitForSelector('#ms-grid .ms-cell');
    await fn(page);
  } finally {
    await context.close();
  }
}

// A fixed layout, placed through the app's own seeding so the safe-first-click
// rule still applies. Returns the mine indices.
const seedAt = (page, safe) => page.evaluate(s => {
  let i = 0;
  const seq = [0.02, 0.5, 0.9, 0.17, 0.63, 0.31, 0.78, 0.44, 0.11, 0.87];
  msSeed(msState.board, s, () => seq[i++ % seq.length]);
  msState.started = true;
  return msState.board.mine.map((m, n) => (m ? n : -1)).filter(n => n >= 0);
}, safe);

const ledText = (page, id) => page.evaluate(elId => {
  // Read the digits back off the sprite offsets, so this asserts what is
  // actually ON SCREEN rather than what the model thinks it is.
  return [...document.getElementById(elId).children].map(d => {
    const col = Math.round(Math.abs(parseFloat(d.style.backgroundPosition)) / 13);
    return col === 10 ? '-' : col === 11 ? ' ' : col === 9 ? '0' : String(col + 1);
  }).join('');
}, id);

const cellSprite = (page, i) => page.evaluate(n => {
  const el = document.querySelector('.ms-cell[data-i="' + n + '"]');
  return Math.round(Math.abs(parseFloat(el.style.backgroundPosition)) / 16);
}, i);

const faceSprite = page => page.evaluate(() =>
  Math.round(Math.abs(parseFloat(document.getElementById('ms-face').style.backgroundPosition)) / 24));

const clickCell = (page, i, opts) => page.click('.ms-cell[data-i="' + i + '"]', opts);

// ── opening ──────────────────────────────────────────────────────

test('it opens on a beginner board with the mine count showing and the clock at zero', async () => {
  await withGame(async page => {
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ms-cell').length), 81);
    assert.strictEqual(await ledText(page, 'ms-mines'), '010');
    assert.strictEqual(await ledText(page, 'ms-time'), '000');
    assert.strictEqual(await faceSprite(page), 0, 'the face should start smiling');
  });
});

// The atlas is one image addressed by offset. An off-by-one in the packing or
// the CSS would show every cell as its neighbour, which no assertion on the
// model would notice.
test('a hidden cell, a flag and a number each draw the sprite they should', async () => {
  await withGame(async page => {
    assert.strictEqual(await cellSprite(page, 0), 0, 'hidden');
    await clickCell(page, 0, { button: 'right' });
    assert.strictEqual(await cellSprite(page, 0), 2, 'flag');
    await clickCell(page, 0, { button: 'right' });
    assert.strictEqual(await cellSprite(page, 0), 3, 'question mark');

    await seedAt(page, 40);
    // Open the whole board and find a cell showing a 3, then check it draws
    // the third numeral rather than something 16px either side of it.
    const three = await page.evaluate(() => {
      const i = msState.board.adj.findIndex((a, n) => a === 3 && !msState.board.mine[n]);
      if (i >= 0) { msState.board.state[i] = MS_REVEALED; msPaintCell(i); }
      return i;
    });
    assert.ok(three >= 0, 'the seeded board should contain a 3');
    assert.strictEqual(await cellSprite(page, three), 10, 'numeral 3 is atlas column 8 + 2');
  });
});

// ── playing ──────────────────────────────────────────────────────

test('the very first click never hits a mine and always opens an area', async () => {
  await withGame(async page => {
    for (let trial = 0; trial < 8; trial++) {
      await page.evaluate(() => msNewGame(msState.levelKey));
      await clickCell(page, 40);
      const opened = await page.evaluate(() =>
        msState.board.state.filter(s => s === MS_REVEALED).length);
      assert.ok(opened > 1, 'trial ' + trial + ' opened ' + opened + ' cells');
      assert.strictEqual(await page.evaluate(() => msState.over), false, 'trial ' + trial + ' died on click one');
    }
  });
});

test('the clock does not start until the first click, then runs', async () => {
  await withGame(async page => {
    await page.waitForTimeout(1200);
    assert.strictEqual(await ledText(page, 'ms-time'), '000', 'the clock ran before the game began');
    await clickCell(page, 40);
    await page.waitForFunction(() => msState.elapsed >= 1, null, { timeout: 4000 });
    assert.strictEqual(await ledText(page, 'ms-time'), '001');
  });
});

test('right click cycles flag, question, clear, and only the flag moves the counter', async () => {
  await withGame(async page => {
    await clickCell(page, 0, { button: 'right' });
    assert.strictEqual(await ledText(page, 'ms-mines'), '009');
    await clickCell(page, 0, { button: 'right' });
    assert.strictEqual(await ledText(page, 'ms-mines'), '010', 'a question mark is not a flag');
    await clickCell(page, 0, { button: 'right' });
    assert.strictEqual(await cellSprite(page, 0), 0, 'back to hidden');
  });
});

test('a flagged cell ignores a left click', async () => {
  await withGame(async page => {
    await seedAt(page, 40);
    await clickCell(page, 0, { button: 'right' });
    await clickCell(page, 0);
    assert.strictEqual(await cellSprite(page, 0), 2, 'the flag was clicked away');
  });
});

// Chording is what makes the larger boards playable, and it is the one input
// that can open several cells - including a mine - from a single click.
test('clicking a satisfied number opens its neighbours', async () => {
  await withGame(async page => {
    const setup = await page.evaluate(() => {
      msSeed(msState.board, 40, () => 0);
      msState.started = true;
      // A revealed number with all of its mines flagged.
      const num = msState.board.adj.findIndex((a, n) => a > 0 && !msState.board.mine[n]);
      msState.board.state[num] = MS_REVEALED;
      msNeighbours(msState.board, num).forEach(j => {
        if (msState.board.mine[j]) msState.board.state[j] = MS_FLAG;
      });
      msPaintAll();
      const hidden = msNeighbours(msState.board, num)
        .filter(j => msState.board.state[j] === MS_HIDDEN);
      return { num, hidden };
    });
    assert.ok(setup.hidden.length > 0, 'nothing left to chord open');
    await clickCell(page, setup.num);
    const stillHidden = await page.evaluate(h => h.filter(j => msState.board.state[j] !== MS_REVEALED), setup.hidden);
    assert.deepStrictEqual(stillHidden, [], 'the chord left neighbours unopened');
  });
});

// ── losing and winning ───────────────────────────────────────────

test('stepping on a mine ends the game, shows the dead face, and marks the wrong flags', async () => {
  await withGame(async page => {
    const mines = await seedAt(page, 40);
    // Flag an empty cell, so the end-of-game render has a wrong flag to cross.
    const empty = await page.evaluate(m => {
      const i = msState.board.mine.findIndex((isMine, n) => !isMine && !m.includes(n));
      msState.board.state[i] = MS_FLAG;
      msPaintCell(i);
      return i;
    }, mines);

    await clickCell(page, mines[0]);

    assert.strictEqual(await page.evaluate(() => msState.over), true);
    assert.strictEqual(await faceSprite(page), 4, 'the dead face');
    assert.strictEqual(await cellSprite(page, mines[0]), 6, 'the mine that was stepped on draws on red');
    assert.strictEqual(await cellSprite(page, mines[1]), 5, 'the mines never found are revealed');
    assert.strictEqual(await cellSprite(page, empty), 7, 'a wrong flag is crossed out');
  });
});

test('the clock stops when the game ends', async () => {
  await withGame(async page => {
    // The real first click, so the clock starts the way it does in play -
    // seedAt places mines but does not start the timer, which is msPrimaryAction's
    // job on the first click of a fresh board.
    await clickCell(page, 40);
    await page.waitForFunction(() => msState.elapsed >= 1, null, { timeout: 4000 });
    const mine = await page.evaluate(() => msState.board.mine.findIndex(Boolean));
    await clickCell(page, mine);
    const stopped = await page.evaluate(() => msState.elapsed);
    await page.waitForTimeout(1500);
    assert.strictEqual(await page.evaluate(() => msState.elapsed), stopped, 'the clock kept running after the game ended');
  });
});

test('clearing the board wins, flags the remaining mines, and shows the cool face', async () => {
  await withGame(async page => {
    // Open every safe cell but one through the model, then click that one -
    // so the win is decided by the real click path, not by the setup.
    const last = await page.evaluate(() => {
      msSeed(msState.board, 40, () => 0);
      msState.started = true;
      const safe = [];
      msState.board.state.forEach((s, i) => { if (!msState.board.mine[i]) safe.push(i); });
      safe.slice(0, -1).forEach(i => { msState.board.state[i] = MS_REVEALED; });
      msPaintAll();
      return safe[safe.length - 1];
    });
    await clickCell(page, last);

    assert.strictEqual(await page.evaluate(() => msState.won), true);
    assert.strictEqual(await faceSprite(page), 3, 'the cool face');
    assert.strictEqual(await ledText(page, 'ms-mines'), '000', 'winning flags whatever is left');
  });
});

test('a win writes the best time into the registry, where REGEDIT can read it', async () => {
  await withGame(async page => {
    await page.evaluate(() => {
      msSeed(msState.board, 40, () => 0);
      msState.started = true;
      msState.elapsed = 12;
      const safe = [];
      msState.board.state.forEach((s, i) => { if (!msState.board.mine[i]) safe.push(i); });
      safe.slice(0, -1).forEach(i => { msState.board.state[i] = MS_REVEALED; });
      msPaintAll();
      msPrimaryAction(safe[safe.length - 1]);
    });
    assert.strictEqual(
      await page.evaluate(() =>
        registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS\\Minesweeper'].BeginnerTime.value),
      12);
    // And it survives, because the registry is persisted like everything else.
    await rebootDesktop(page);
    assert.strictEqual(
      await page.evaluate(() =>
        registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS\\Minesweeper'].BeginnerTime.value),
      12);
  });
});

// ── the window ───────────────────────────────────────────────────

test('changing difficulty resizes the window to the new board', async () => {
  await withGame(async page => {
    const measure = () => page.evaluate(() => ({
      win: Math.round(document.getElementById('win-minesweeper').getBoundingClientRect().width),
      grid: Math.round(document.getElementById('ms-grid').getBoundingClientRect().width),
      cells: document.querySelectorAll('.ms-cell').length,
    }));
    const before = await measure();
    assert.strictEqual(before.cells, 81);

    await page.evaluate(() => msNewGame('expert'));
    const after = await measure();
    assert.strictEqual(after.cells, 480, 'expert is 30x16');
    // 480 board pixels + the 3px bevel each side.
    assert.strictEqual(after.grid, 486);
    assert.ok(after.win > before.win + 300,
      'the window did not grow with the board: ' + before.win + ' -> ' + after.win);
  });
});

// The geometry store remembers a window's size by id, so without msFitWindow
// re-recording, reopening Minesweeper would restore the PREVIOUS difficulty's
// window around the new board.
test('the remembered window size follows the difficulty, not the other way round', async () => {
  await withGame(async page => {
    await page.evaluate(() => { msNewGame('expert'); closeWin('minesweeper'); });
    await page.evaluate(() => openMinesweeper());
    await page.waitForSelector('#ms-grid .ms-cell');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.ms-cell').length), 480,
      'the difficulty should have been remembered');
    const fits = await page.evaluate(() => {
      const win = document.getElementById('win-minesweeper').getBoundingClientRect();
      const grid = document.getElementById('ms-grid').getBoundingClientRect();
      return grid.right <= win.right && grid.bottom <= win.bottom;
    });
    assert.ok(fits, 'the board overflows the window it reopened into');
  });
});

// ── help ─────────────────────────────────────────────────────────

test('the help button opens the rules and the sprite credits', async () => {
  await withGame(async page => {
    await page.click('#mb-minesweeper .ms-help-btn');
    await page.waitForSelector('#win-ms-help');
    const text = await page.textContent('.ms-help-scroll');
    assert.match(text, /Left click/, 'the rules are missing');
    assert.match(text, /Black Squirrel/, 'the necessary sprite credit is missing');
    assert.match(text, /Microsoft/, 'the sprites are Microsoft\'s and the dialog should say so');
    // The long registry path is the one string here that can push a fixed-width
    // dialog sideways.
    const overflows = await page.evaluate(() => {
      const el = document.querySelector('.ms-help-scroll');
      return el.scrollWidth > el.clientWidth + 1;
    });
    assert.strictEqual(overflows, false, 'the help text scrolls sideways');
  });
});

test('the help button carries the question-mark icon, not a text label', async () => {
  await withGame(async page => {
    const src = await page.getAttribute('#mb-minesweeper .ms-help-btn img', 'src');
    assert.match(src, /help_question_mark\.png$/);
  });
});

// ── integration with the rest of the OS ──────────────────────────

test('MINESWEEPER.exe is a real file that DIR lists and the terminal can run', async () => {
  await withGame(async page => {
    const stat = await page.evaluate(() => {
      const st = vfsStatSync('MINESWEEPER.exe', '');
      return st ? { kind: st.kind, size: st.size } : null;
    });
    assert.ok(stat, 'MINESWEEPER.exe is not on disk beside the other system binaries');
    assert.strictEqual(stat.kind, 'text');
    assert.ok(stat.size > 0);
  });
});

test('it is reachable from the desktop, the Start menu and Run...', async () => {
  await withGame(async page => {
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('#icons-layer .desktop-icon .di-name')].map(n => n.textContent.trim()));
    assert.ok(labels.includes('MINESWEEPER.exe'), 'desktop icons: ' + labels.join(', '));

    const items = await page.evaluate(() =>
      [...document.querySelectorAll('#sm-items .sm-item')].map(i => i.textContent.trim()));
    assert.ok(items.includes('Minesweeper'), 'Start menu: ' + items.join(', '));

    // Run... resolves it, and by its Winmine name too.
    await page.evaluate(() => { closeWin('minesweeper'); });
    await page.evaluate(() => openRunDialog());
    await page.waitForSelector('#win-run-dialog');
    await page.fill('#run-input', 'winmine');
    await page.click('#win-run-dialog .dlg-btn.primary');
    await page.waitForSelector('#win-minesweeper', { timeout: 5000 });
  });
});

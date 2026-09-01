// ─────────────────────────────────────────────────────────────────
// MINESWEEPER.exe
// ─────────────────────────────────────────────────────────────────
// The first thing in sleepOS that is content rather than a utility. Every
// other app here inspects something - files, processes, the registry, the
// disk - and the 25 entries in PROJECTS are `window.open` links that take the
// visitor OUT of the OS entirely (os/programs.js, programProjectEntry). This
// is the only thing to actually do without leaving.
//
// The half above openMinesweeper is pure: functions over a plain board object,
// no DOM and no globals, so `npm test` can prove the rules in node. That is the
// same split os/wm.js uses for its layout maths, and for the same reason - the
// interesting mistakes here (flood fill tearing through a flag, a first click
// that can still be a mine, chording on an unsatisfied number) are all logic,
// and none of them need a browser to catch.

const MS_HIDDEN = 0, MS_REVEALED = 1, MS_FLAG = 2, MS_QUESTION = 3;

// Winmine's own three. Expert is 30x16 and not 16x30 - it is a wide board.
const MS_LEVELS = {
  beginner:     { cols: 9,  rows: 9,  mines: 10, label: 'Beginner' },
  intermediate: { cols: 16, rows: 16, mines: 40, label: 'Intermediate' },
  expert:       { cols: 30, rows: 16, mines: 99, label: 'Expert' },
};
const MS_LEVEL_ORDER = ['beginner', 'intermediate', 'expert'];

// Winmine's own ceiling: the timer is three digits and stops climbing there.
const MS_MAX_TIME = 999;

function msCreateBoard(cols, rows, mines) {
  const n = cols * rows;
  return {
    cols, rows,
    // At least one cell has to stay clear or there is no first click to make.
    mines: Math.max(0, Math.min(mines, n - 1)),
    mine: new Array(n).fill(false),
    adj: new Array(n).fill(0),
    state: new Array(n).fill(MS_HIDDEN),
    // Mines are not placed until the first click - see msSeed.
    seeded: false,
    dead: false,
    hitIndex: -1,
  };
}

function msCol(board, i) { return i % board.cols; }
function msRow(board, i) { return Math.floor(i / board.cols); }

function msNeighbours(board, i) {
  const c = msCol(board, i), r = msRow(board, i), out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= board.cols || nr >= board.rows) continue;
      out.push(nr * board.cols + nc);
    }
  }
  return out;
}

// Mines are placed on the FIRST CLICK, not at construction, which is what lets
// that click be safe.
//
// Deviation from Winmine, deliberately: the clicked cell and all eight of its
// neighbours are kept clear, so the first reveal always opens an area. Real
// Winmine only guaranteed the clicked cell itself - it relocated that one mine
// to the first free cell scanning from the top-left - so your opening move
// could be a "3" with nothing around it and no information to act on. That is
// a coin flip, not a puzzle.
//
// `rng` is injectable so the tests can place mines deterministically.
function msSeed(board, safeIndex, rng) {
  rng = rng || Math.random;
  const n = board.cols * board.rows;
  let forbidden = new Set([safeIndex].concat(msNeighbours(board, safeIndex)));
  // A board too dense to keep a whole 3x3 clear falls back to the original
  // rule rather than looping forever looking for a placement that cannot
  // exist. Unreachable at the three shipped levels - Expert is 99 mines in
  // 480 cells - but msCreateBoard accepts any counts.
  if (n - forbidden.size < board.mines) forbidden = new Set([safeIndex]);

  const candidates = [];
  for (let i = 0; i < n; i++) if (!forbidden.has(i)) candidates.push(i);
  // Partial Fisher-Yates. Only the first `mines` slots need to be settled, and
  // sampling with rejection instead would get slower the denser the board gets
  // - which is exactly where it would be used.
  for (let k = 0; k < board.mines; k++) {
    const j = k + Math.floor(rng() * (candidates.length - k));
    const tmp = candidates[k]; candidates[k] = candidates[j]; candidates[j] = tmp;
    board.mine[candidates[k]] = true;
  }
  for (let i = 0; i < n; i++) {
    board.adj[i] = msNeighbours(board, i).reduce((sum, j) => sum + (board.mine[j] ? 1 : 0), 0);
  }
  board.seeded = true;
  return board;
}

// Reveals `i`, flood filling outwards while cells have no adjacent mines.
// Returns the indices actually opened, so the renderer can repaint just those.
function msReveal(board, i) {
  if (board.state[i] === MS_REVEALED || board.state[i] === MS_FLAG) return [];
  const opened = [];
  const stack = [i];
  const seen = new Set(stack);
  while (stack.length) {
    const cur = stack.pop();
    // A flag is a deliberate mark. Flood fill stops at one rather than tearing
    // through it, even when the player has flagged a cell that holds nothing -
    // being wrong is their business, and silently un-marking it would hide the
    // mistake rather than let them find it.
    if (board.state[cur] === MS_REVEALED || board.state[cur] === MS_FLAG) continue;
    board.state[cur] = MS_REVEALED;
    opened.push(cur);
    if (board.mine[cur] || board.adj[cur] !== 0) continue;
    msNeighbours(board, cur).forEach(nb => {
      if (seen.has(nb)) return;
      seen.add(nb);
      stack.push(nb);
    });
  }
  return opened;
}

// Chording: clicking a revealed number whose flags already account for all its
// mines opens everything else around it. Expert is not realistically playable
// without it, and every Minesweeper player expects it.
//
// Returns [] when the flag count does not match, so a mis-flagged number does
// nothing rather than opening a mine the player never chose to open.
function msChordTargets(board, i) {
  if (board.state[i] !== MS_REVEALED || board.adj[i] === 0) return [];
  const nbs = msNeighbours(board, i);
  let flags = 0;
  nbs.forEach(j => { if (board.state[j] === MS_FLAG) flags++; });
  if (flags !== board.adj[i]) return [];
  return nbs.filter(j => board.state[j] === MS_HIDDEN || board.state[j] === MS_QUESTION);
}

function msFlagCount(board) {
  let n = 0;
  board.state.forEach(s => { if (s === MS_FLAG) n++; });
  return n;
}

// Can go negative - Winmine's counter does too, and a negative reading is
// useful information: you have flagged more cells than there are mines.
function msRemaining(board) {
  return board.mines - msFlagCount(board);
}

// Won when every cell that is not a mine has been revealed. Flags are
// deliberately not part of this: Winmine does not make you mark the mines, and
// requiring it would mean a fully solved board that still says you are playing.
function msIsWon(board) {
  if (!board.seeded) return false;
  const n = board.cols * board.rows;
  for (let i = 0; i < n; i++) {
    if (!board.mine[i] && board.state[i] !== MS_REVEALED) return false;
  }
  return true;
}

// hidden -> flag -> question -> hidden, or hidden -> flag -> hidden with marks
// off. Returns the new state.
function msCycleMark(board, i, marksEnabled) {
  const s = board.state[i];
  if (s === MS_REVEALED) return s;
  if (s === MS_HIDDEN) board.state[i] = MS_FLAG;
  else if (s === MS_FLAG) board.state[i] = marksEnabled ? MS_QUESTION : MS_HIDDEN;
  else board.state[i] = MS_HIDDEN;
  return board.state[i];
}

// The three characters a 3-digit LED panel shows for a value. Clamped rather
// than widened: the panel is three digits and a four-digit reading would
// overflow the sprite row it is drawn from.
function msLedText(value) {
  const v = Math.max(-99, Math.min(999, Math.trunc(Number(value) || 0)));
  if (v < 0) return '-' + String(-v).padStart(2, '0');
  return String(v).padStart(3, '0');
}

// ─────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────

const MS_WIN_ID = 'minesweeper';
const MS_REG_PATH = 'SOFTWARE\\sleepOS\\Minesweeper';

// Sprite columns in os/sprites/minesweeper.png, row 0. Kept as names because
// "tile 6" is meaningless at the call site and the atlas order is arbitrary.
const MS_TILE = {
  hidden: 0, open: 1, flag: 2, question: 3, questionDown: 4,
  mine: 5, mineHit: 6, mineWrong: 7,
};
// The eight numerals share row 0, starting where the tiles end.
const MS_NUMBER_BASE = 8;
// Row 1: smile, smile-pressed, surprised, cool, dead.
const MS_FACE = { smile: 0, smileDown: 1, surprised: 2, win: 3, dead: 4 };

let msState = null;

function msRegValue(name, fallback) {
  const key = registryData['HKEY_CURRENT_USER'] && registryData['HKEY_CURRENT_USER'][MS_REG_PATH];
  const entry = key && key[name];
  return entry ? entry.value : fallback;
}
function msSetRegValue(name, value) {
  const key = registryData['HKEY_CURRENT_USER'] && registryData['HKEY_CURRENT_USER'][MS_REG_PATH];
  if (!key || !key[name]) return;
  key[name].value = value;
  saveRegistry();
}

function msLevelKey() {
  const stored = String(msRegValue('Difficulty', 'beginner'));
  return MS_LEVELS[stored] ? stored : 'beginner';
}
function msMarksEnabled() {
  return Number(msRegValue('Marks', 1)) !== 0;
}
// Winmine's own key names: Time1/Name1 in win.ini. Spelled out here because a
// player poking at this in REGEDIT should be able to read it.
function msBestTimeKeys(levelKey) {
  const proper = levelKey.charAt(0).toUpperCase() + levelKey.slice(1);
  return { time: proper + 'Time', name: proper + 'Name' };
}

function msSetCellSprite(el, col) {
  el.style.backgroundPosition = (-col * 16) + 'px 0';
}

function msCellSpriteFor(board, i, revealAll) {
  const st = board.state[i];
  if (revealAll) {
    // End of game. A flag on an empty cell is crossed out, a mine that was
    // never found is shown, and the one that was stepped on is shown on red -
    // the three things a player wants to see when they lose.
    if (st === MS_FLAG && !board.mine[i]) return MS_TILE.mineWrong;
    if (board.mine[i] && st === MS_FLAG) return MS_TILE.flag;
    if (board.mine[i]) return i === board.hitIndex ? MS_TILE.mineHit : MS_TILE.mine;
  }
  if (st === MS_FLAG) return MS_TILE.flag;
  if (st === MS_QUESTION) return MS_TILE.question;
  if (st !== MS_REVEALED) return MS_TILE.hidden;
  if (board.mine[i]) return i === board.hitIndex ? MS_TILE.mineHit : MS_TILE.mine;
  return board.adj[i] === 0 ? MS_TILE.open : MS_NUMBER_BASE + board.adj[i] - 1;
}

function msPaintCell(i) {
  const s = msState;
  if (!s || !s.cells[i]) return;
  msSetCellSprite(s.cells[i], msCellSpriteFor(s.board, i, s.over));
}
function msPaintAll() {
  const s = msState;
  if (!s) return;
  for (let i = 0; i < s.cells.length; i++) msPaintCell(i);
}

function msPaintLeds(el, value) {
  const text = msLedText(value);
  [...el.children].forEach((digit, n) => {
    const ch = text[n];
    // Atlas row 2 order: 1-9, then 0, then minus, then blank.
    const col = ch === '-' ? 10 : ch === '0' ? 9 : (Number(ch) - 1);
    digit.style.backgroundPosition = (-col * 13) + 'px -40px';
  });
}

function msSetFace(which) {
  const s = msState;
  if (!s || !s.faceEl) return;
  s.faceEl.style.backgroundPosition = (-which * 24) + 'px -16px';
}

function msRefreshCounters() {
  const s = msState;
  if (!s) return;
  msPaintLeds(s.mineLeds, msRemaining(s.board));
  msPaintLeds(s.timeLeds, s.elapsed);
}

function msStopTimer() {
  const w = wins[MS_WIN_ID];
  if (w && w._interval) { clearInterval(w._interval); w._interval = null; }
}

// procSetInterval, not setInterval: sleepOS accounts app CPU per window
// (os/instrument.js) and SYSMON reads it, so a raw timer would run this game's
// once-a-second tick as unattributed work.
function msStartTimer() {
  const s = msState;
  const w = wins[MS_WIN_ID];
  if (!s || !w || w._interval) return;
  w._interval = procSetInterval(MS_WIN_ID, () => {
    if (!msState || msState.over || !msState.started) return;
    if (msState.elapsed >= MS_MAX_TIME) return;
    msState.elapsed++;
    msRefreshCounters();
  }, 1000);
}

function msEndGame(won) {
  const s = msState;
  if (!s || s.over) return;
  s.over = true;
  s.won = won;
  msStopTimer();
  if (won) {
    // Winmine flags whatever is left when you win: the board is solved, so the
    // remaining hidden cells can only be mines, and leaving them blank reads as
    // unfinished.
    s.board.state.forEach((st, i) => { if (s.board.mine[i]) s.board.state[i] = MS_FLAG; });
  }
  msPaintAll();
  msRefreshCounters();
  msSetFace(won ? MS_FACE.win : MS_FACE.dead);
  // Losing gets the error buzz; winning gets nothing, because there is no win
  // sound in SOUND_FILES and test/sound-assets.test.cjs fails the build on a
  // name that has no file behind it. The cool face and the best-time dialog
  // carry the win instead.
  if (!won) playSound('error');
  if (won) msRecordBestTime();
}

function msRecordBestTime() {
  const s = msState;
  const keys = msBestTimeKeys(s.levelKey);
  const best = Number(msRegValue(keys.time, MS_MAX_TIME));
  if (!(s.elapsed < best)) return;
  msSetRegValue(keys.time, s.elapsed);
  osAlert('You have the fastest time for ' + MS_LEVELS[s.levelKey].label + '.\n\n'
        + s.elapsed + ' seconds.\n\nBest times are kept in the registry, under\n'
        + 'HKEY_CURRENT_USER\\' + MS_REG_PATH,
    'New Best Time', 'icon:success');
}

function msOpenCells(indices) {
  const s = msState;
  let hitMine = -1;
  indices.forEach(start => {
    msReveal(s.board, start).forEach(i => {
      msPaintCell(i);
      if (s.board.mine[i] && hitMine < 0) hitMine = i;
    });
  });
  return hitMine;
}

function msPrimaryAction(i) {
  const s = msState;
  if (!s || s.over) return;
  const st = s.board.state[i];
  if (st === MS_FLAG) return;   // a flag protects its cell from a careless click

  if (!s.board.seeded) {
    msSeed(s.board, i);
    s.started = true;
    msStartTimer();
  }

  // A click on an already-revealed number is a chord attempt, not a no-op.
  const targets = st === MS_REVEALED ? msChordTargets(s.board, i) : [i];
  if (!targets.length) return;

  const hit = msOpenCells(targets);
  if (hit >= 0) {
    s.board.hitIndex = hit;
    s.board.dead = true;
    msEndGame(false);
    return;
  }
  playSound('click');
  msRefreshCounters();
  if (msIsWon(s.board)) msEndGame(true);
}

function msSecondaryAction(i) {
  const s = msState;
  if (!s || s.over) return;
  if (s.board.state[i] === MS_REVEALED) return;
  msCycleMark(s.board, i, msMarksEnabled());
  msPaintCell(i);
  msRefreshCounters();
  playSound('click');
}

// Sizes the window to the board it is actually showing.
//
// The chrome is MEASURED rather than assumed: the titlebar, menubar, borders
// and body padding are all CSS and have all changed before. Skipped while the
// window is maximized or snapped, where the player has asked for a size, and on
// mobile, where mkWin makes every window fill the desktop anyway - the board
// just centres itself in whatever it gets.
function msFitWindow() {
  const w = wins[MS_WIN_ID];
  if (!w || isMobileLayout() || wmIsFilled(w)) return;
  const body = document.getElementById('wb-' + MS_WIN_ID);
  const root = body && body.querySelector('.ms-root');
  if (!root) return;
  const chromeW = w.el.offsetWidth - body.clientWidth;
  const chromeH = w.el.offsetHeight - body.clientHeight;
  w.el.style.width = (root.offsetWidth + chromeW) + 'px';
  w.el.style.height = (root.offsetHeight + chromeH) + 'px';
  clampWinGeometry(w.el);
  // The geometry store would otherwise keep handing back the PREVIOUS
  // difficulty's window size every time this one is reopened.
  wmRememberGeometry(MS_WIN_ID);
}

function msNewGame(levelKey) {
  const s = msState;
  if (!s) return;
  const key = MS_LEVELS[levelKey] ? levelKey : s.levelKey;
  const level = MS_LEVELS[key];
  const sizeChanged = key !== s.levelKey || !s.cells.length;

  msStopTimer();
  s.levelKey = key;
  s.board = msCreateBoard(level.cols, level.rows, level.mines);
  s.over = false;
  s.won = false;
  s.started = false;
  s.elapsed = 0;
  msSetRegValue('Difficulty', key);

  if (sizeChanged) msBuildGrid();
  msPaintAll();
  msRefreshCounters();
  msSetFace(MS_FACE.smile);
  if (sizeChanged) msFitWindow();
}

function msBuildGrid() {
  const s = msState;
  const grid = s.gridEl;
  grid.innerHTML = '';
  // The column count is stated, not derived from a width. It used to be
  // `auto-fill` against `width: cols*16`, and the OS reset makes every box a
  // border box - so the 3px bevel came out of the content width and Expert
  // silently laid 480 cells out 29 columns wide, with the last 16 orphaned
  // onto a row of their own. It looked very nearly right.
  grid.style.gridTemplateColumns = 'repeat(' + s.board.cols + ', 16px)';
  s.cells = [];
  const total = s.board.cols * s.board.rows;
  for (let i = 0; i < total; i++) {
    const cell = document.createElement('div');
    cell.className = 'ms-cell';
    cell.dataset.i = String(i);
    grid.appendChild(cell);
    s.cells.push(cell);
  }
}

function msOpenHelp() {
  const id = 'ms-help';
  const p = { x: Math.max(20, Math.floor(window.innerWidth / 2) - 190),
              y: Math.max(20, Math.floor(window.innerHeight / 2) - 195) };
  // 390 = measured: the content is 306px tall in a 246px viewport at h:320, so
  // the credits sat below the fold. A help dialog this short should not need
  // scrolling to reach its last line.
  if (!mkWin({ id, title: 'Minesweeper Help', icon: 'icon:help', w: 380, h: 390,
               x: p.x, y: p.y, menubar: false, statusbar: false, popup: true })) return;
  const body = document.getElementById('wb-' + id);
  body.className = 'win-body ms-help';
  // Deliberately short. A player opening Help wants the rules, not a tour of
  // where the scores are stored - the registry key is a thing to FIND in
  // REGEDIT, and saying so here spoils it.
  //
  // The credits are the two the sprite sheet actually requires for the band
  // used: Black Squirrel for the 31/NT4/2000+ rip, Inky for the score-display
  // sprites. TCRF and DaSpriter121 are credited on the sheet for bands this
  // game does not use.
  body.innerHTML = `
    <div class="ms-help-scroll">
      <h3>How to play</h3>
      <p>Uncover every square that is not a mine. A number says how many mines
         touch that square.</p>
      <ul>
        <li><b>Left click</b> uncovers a square.</li>
        <li><b>Right click</b> flags a mine. Again for a question mark, again
            to clear. On touch, press and hold.</li>
        <li><b>Left click a number</b> you have fully flagged to open the rest
            around it.</li>
      </ul>
      <p>Left counter: mines left. Right counter: seconds. Your first click is
         always safe.</p>
      <h3>Credits</h3>
      <p>Sprites are Microsoft <i>Winmine</i>, ripped by <b>Black Squirrel</b>,
         with score-display sprites by <b>Inky</b>. A tribute, not the original.</p>
    </div>
    <div class="dlg-btns"><button class="dlg-btn primary" id="${id}-ok">OK</button></div>`;
  const ok = document.getElementById(id + '-ok');
  ok.addEventListener('click', () => closeWin(id));
  procSetTimeout(id, () => ok.focus(), 40);
}

function msOpenBestTimes() {
  const rows = MS_LEVEL_ORDER.map(key => {
    const t = Number(msRegValue(msBestTimeKeys(key).time, MS_MAX_TIME));
    const label = MS_LEVELS[key].label.padEnd(14, ' ');
    return '  ' + label + (t >= MS_MAX_TIME ? '---' : String(t) + ' seconds');
  }).join('\n');
  osAlert('Fastest Mine Sweepers\n\n' + rows, 'Best Times', 'icon:info');
}

function msResetBestTimes() {
  osConfirm('Reset the best time for all three difficulties?', 'Reset Best Times', ok => {
    if (!ok) return;
    MS_LEVEL_ORDER.forEach(key => msSetRegValue(msBestTimeKeys(key).time, MS_MAX_TIME));
    msOpenBestTimes();
  }, 'icon:warning');
}

function msBuildMenu(mb) {
  mb.innerHTML = '';
  const gameItems = () => [
    { label: 'New', action: () => msNewGame(msState.levelKey) },
    '-',
  ].concat(MS_LEVEL_ORDER.map(key => ({
    label: MS_LEVELS[key].label + (msState.levelKey === key ? '  ✓' : ''),
    action: () => msNewGame(key),
  }))).concat([
    '-',
    { label: 'Marks (?)' + (msMarksEnabled() ? '  ✓' : ''), action: () => {
      msSetRegValue('Marks', msMarksEnabled() ? 0 : 1);
      // A question mark already on the board would otherwise be unreachable by
      // the cycle that no longer produces it.
      if (!msMarksEnabled()) {
        msState.board.state.forEach((st, i) => {
          if (st === MS_QUESTION) { msState.board.state[i] = MS_HIDDEN; msPaintCell(i); }
        });
      }
    } },
    '-',
    { label: 'Best Times...', action: msOpenBestTimes },
    { label: 'Reset Best Times', action: msResetBestTimes },
    '-',
    { label: 'Exit', action: () => closeWin(MS_WIN_ID) },
  ]);

  const game = document.createElement('span');
  game.className = 'menu-item';
  game.textContent = 'Game';
  // Rebuilt per open rather than captured: the tick marks track difficulty and
  // the Marks setting, both of which the menu itself changes.
  game.addEventListener('click', e => { e.stopPropagation(); showDropdown(game, gameItems()); });
  mb.appendChild(game);

  // The help button, right-aligned, using the question-mark icon rather than a
  // "Help" text menu - it is one action, not a menu, and an icon says so.
  const help = document.createElement('button');
  help.className = 'ms-help-btn';
  help.type = 'button';
  help.title = 'Help and credits';
  help.setAttribute('aria-label', 'Help and credits');
  help.innerHTML = iconMarkup('icon:help');
  help.addEventListener('click', e => { e.stopPropagation(); msOpenHelp(); });
  mb.appendChild(help);
}

function openMinesweeper() {
  const levelKey = msLevelKey();
  const level = MS_LEVELS[levelKey];
  // A first guess at the size; msFitWindow measures and corrects it once the
  // board is in the document.
  if (!mkWin({ id: MS_WIN_ID, title: 'Minesweeper', icon: 'icon:minesweeper',
               w: level.cols * 16 + 26, h: level.rows * 16 + 108,
               menubar: true, statusbar: false })) return;

  const body = document.getElementById('wb-' + MS_WIN_ID);
  body.className = 'win-body ms-body';
  body.innerHTML = `
    <div class="ms-root">
      <div class="ms-header">
        <div class="ms-leds" id="ms-mines"><i></i><i></i><i></i></div>
        <button class="ms-face" id="ms-face" type="button" title="New game" aria-label="New game"></button>
        <div class="ms-leds" id="ms-time"><i></i><i></i><i></i></div>
      </div>
      <div class="ms-grid" id="ms-grid"></div>
    </div>`;

  msState = {
    levelKey,
    board: msCreateBoard(level.cols, level.rows, level.mines),
    cells: [],
    over: false, won: false, started: false, elapsed: 0,
    gridEl: document.getElementById('ms-grid'),
    faceEl: document.getElementById('ms-face'),
    mineLeds: document.getElementById('ms-mines'),
    timeLeds: document.getElementById('ms-time'),
  };

  msBuildMenu(document.getElementById('mb-' + MS_WIN_ID));

  const grid = msState.gridEl;
  const cellIndex = target => {
    const el = target instanceof Element ? target.closest('.ms-cell') : null;
    return el ? Number(el.dataset.i) : -1;
  };

  // The surprised face is Winmine's, and it is genuinely useful feedback: it
  // says the click registered on a board where most clicks change nothing
  // visible.
  grid.addEventListener('mousedown', e => {
    if (msState.over) return;
    if (e.button === 0 && cellIndex(e.target) >= 0) msSetFace(MS_FACE.surprised);
  });
  // On the window, not the grid: releasing outside the board still ends the
  // press, and a face left surprised forever reads as a hung game.
  document.getElementById('win-' + MS_WIN_ID).addEventListener('mouseup', () => {
    if (msState && !msState.over) msSetFace(MS_FACE.smile);
  });

  grid.addEventListener('click', e => {
    const i = cellIndex(e.target);
    if (i < 0) return;
    // A long press has already flagged this cell and a touch still emits its
    // click afterwards, which would then uncover it - the exact opposite of
    // what the player asked for. Same guard the desktop icons use.
    if (_longPressActive) { _longPressActive = false; return; }
    msPrimaryAction(i);
  });
  grid.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    const i = cellIndex(e.target);
    if (i >= 0) msSecondaryAction(i);
  });
  addLongPress(grid);

  // Middle click is the other traditional chord binding, and some mice make it
  // easier than holding both buttons.
  grid.addEventListener('auxclick', e => {
    if (e.button !== 1) return;
    e.preventDefault();
    const i = cellIndex(e.target);
    if (i >= 0) msPrimaryAction(i);
  });

  msState.faceEl.addEventListener('mousedown', () => msSetFace(MS_FACE.smileDown));
  msState.faceEl.addEventListener('click', () => msNewGame(msState.levelKey));

  wins[MS_WIN_ID]._onclose = () => { msStopTimer(); msState = null; };

  msBuildGrid();
  msPaintAll();
  msRefreshCounters();
  msSetFace(MS_FACE.smile);
  msFitWindow();
}

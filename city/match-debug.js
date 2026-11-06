// ===== a top-down view of a simulated match (Dev tools > Other > Watch a match): the engine (match-engine.js) drawn
// plainly on a canvas, to watch the football itself before there's a stadium round it. Players are discs in their
// kits with their numbers, the keepers in their own colour; the ball is white with its shadow, further apart the
// higher it is; the referee in black. The game is paused underneath while it's open.
const MATCH_DEBUG_KIT = { RED: '#d8352f', WHITE: '#f2f2ee', BLUE: '#2f5bd8', GREEN: '#2e9a4a', YEL: '#e8c62b', BRICK: '#9a3b22', CYAN: '#2fb9d0', MAG: '#c9389c', GRAY: '#8a8d92', BLACK: '#18181a' };
let matchDebugEl = null, matchDebug = null;
function openMatchDebug() {
  if (!matchDebugEl) {
    matchDebugEl = menuEl('matchdebug', 1100, `<div class="panel" role="dialog" aria-label="Simulated match" style="width:min(980px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto">
      <style>#matchdebug canvas{position:static;inset:auto;width:100%;height:auto;display:block;border-radius:4px;background:#2f7a3a}
      #matchdebug .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}#matchdebug select{font:inherit;background:#222;color:#eee;border:1px solid #555;padding:2px 4px}
      #matchdebug .score{font-size:1.4em;letter-spacing:.04em}#matchdebug .log{font-size:.85em;opacity:.85;min-height:9.5em;white-space:pre-line}
      #matchdebug .stats{font-size:.85em;opacity:.85;white-space:pre}#matchdebug .tab.on{text-decoration:underline}#matchdebug .tab{background:none;border:0;color:inherit;font:inherit;cursor:pointer;opacity:.8}</style>
      <div class="row"><span class="score"></span><span style="flex:1"></span><button class="tab" data-md="close">close</button></div>
      <canvas width="1060" height="700"></canvas>
      <div class="row"><span>speed</span>${[1, 4, 16, 64].map(s => `<button class="tab" data-md-speed="${s}">${s}x</button>`).join('')}<button class="tab" data-md="pause">pause</button>
        <span style="flex:1"></span><select data-md-team="0"></select><span>v</span><select data-md-team="1"></select><button class="tab" data-md="new">new match</button></div>
      <div class="row" style="align-items:flex-start;gap:24px"><div class="log" style="flex:1"></div><div class="stats"></div></div>
    </div>`);
    const opts = MatchEngine.CLUBS.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    for (const s of matchDebugEl.querySelectorAll('select')) s.innerHTML = opts;
    matchDebugEl.querySelector('[data-md-team="1"]').value = 'docks';
    matchDebugEl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.md === 'close') return closeMatchDebug();
      if (b.dataset.md === 'pause') matchDebug.paused = !matchDebug.paused;
      if (b.dataset.mdSpeed) { matchDebug.speed = +b.dataset.mdSpeed; matchDebug.paused = false; }
      if (b.dataset.md === 'new') newMatchDebug();
      matchDebugButtons();
    });
    addEventListener('keydown', e => { if (e.key === 'Escape' && matchDebugOpen()) { e.stopPropagation(); closeMatchDebug(); } }, true);
  }
  matchDebugEl.style.display = 'flex'; paused = true; releaseMouse?.();
  if (!matchDebug) newMatchDebug();
  matchDebugButtons();
  matchDebug.last = performance.now();
  requestAnimationFrame(matchDebugFrame);
}
function closeMatchDebug() { if (matchDebugEl) matchDebugEl.style.display = 'none'; paused = false; }
const matchDebugOpen = () => matchDebugEl?.style.display === 'flex';
function newMatchDebug() {
  const home = matchDebugEl.querySelector('[data-md-team="0"]').value, away = matchDebugEl.querySelector('[data-md-team="1"]').value;
  matchDebug = { m: MatchEngine.create({ home, away, seed: Math.random() * 1e9 | 0 }), speed: matchDebug?.speed || 1, paused: false, last: performance.now() };
}
function matchDebugButtons() {
  for (const b of matchDebugEl.querySelectorAll('[data-md-speed]')) b.classList.toggle('on', +b.dataset.mdSpeed === matchDebug.speed && !matchDebug.paused);
  matchDebugEl.querySelector('[data-md="pause"]').classList.toggle('on', matchDebug.paused);
}
function matchDebugFrame(now) {
  if (!matchDebugOpen()) return;
  const md = matchDebug, dt = Math.min(.1, (now - md.last) / 1000); md.last = now;
  if (!md.paused) MatchEngine.step(md.m, dt * md.speed);
  drawMatchDebug(md.m);
  requestAnimationFrame(matchDebugFrame);
}
function drawMatchDebug(m) {
  const cv = matchDebugEl.querySelector('canvas'), g = cv.getContext('2d'), P = MatchEngine.PITCH;
  const pad = 30, sc = (cv.width - pad * 2) / (P.hl * 2), X = x => pad + (x + P.hl) * sc, Y = y => cv.height / 2 + y * sc;
  // the grass, mown in stripes, and the markings
  for (let k = 0; k < 20; k++) { g.fillStyle = k & 1 ? '#2c7537' : '#317f3d'; g.fillRect(pad + k * (P.hl * 2 * sc / 20), 0, P.hl * 2 * sc / 20 + 1, cv.height); }
  g.fillStyle = '#245f2e'; g.fillRect(0, 0, pad, cv.height); g.fillRect(cv.width - pad, 0, pad, cv.height);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
  g.strokeRect(X(-P.hl), Y(-P.hw), P.hl * 2 * sc, P.hw * 2 * sc);
  g.beginPath(); g.moveTo(X(0), Y(-P.hw)); g.lineTo(X(0), Y(P.hw)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), P.circle * sc, 0, Math.PI * 2); g.stroke();
  for (const e of [-1, 1]) {
    const gx = e * P.hl;
    g.strokeRect(Math.min(X(gx), X(gx - e * P.boxD)), Y(-P.boxHW), P.boxD * sc, P.boxHW * 2 * sc);
    g.strokeRect(Math.min(X(gx), X(gx - e * P.sixD)), Y(-P.sixHW), P.sixD * sc, P.sixHW * 2 * sc);
    g.beginPath(); g.arc(X(gx - e * P.spot), Y(0), 2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(e < 0 ? X(gx) - 8 : X(gx), Y(-P.goalHW), 8, P.goalHW * 2 * sc); // the goal
  }
  // the players
  const draw = (x, y, fill, ring, label, r = 9) => {
    g.beginPath(); g.arc(X(x), Y(y), r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = ring; g.stroke();
    if (label) { g.fillStyle = fill === MATCH_DEBUG_KIT.WHITE || fill === MATCH_DEBUG_KIT.YEL || fill === MATCH_DEBUG_KIT.CYAN ? '#111' : '#fff'; g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, X(x), Y(y) + .5); }
  };
  for (const t of m.teams) for (const p of t.players) {
    if (p.off && !p.leaving) continue;
    const [kit, trim] = t.kit, gk = p.role === 'GK';
    draw(p.pos[0], p.pos[1], gk ? (t.side ? '#e07b1f' : '#7a2fc0') : MATCH_DEBUG_KIT[kit] || '#ccc', p === m.ball.owner ? '#ffe14a' : MATCH_DEBUG_KIT[trim] || '#000', String(p.number));
    g.beginPath(); g.moveTo(X(p.pos[0]), Y(p.pos[1])); g.lineTo(X(p.pos[0] + p.face[0] * 1.6), Y(p.pos[1] + p.face[1] * 1.6)); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.stroke();
  }
  draw(m.ref.pos[0], m.ref.pos[1], MATCH_DEBUG_KIT.BLACK, '#e8c62b', '', 7);
  // the ball: its shadow on the grass, the ball above it by its height
  const b = m.ball.p;
  g.beginPath(); g.ellipse(X(b[0]), Y(b[1]), 5, 3, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill();
  g.beginPath(); g.arc(X(b[0]), Y(b[1]) - b[2] * sc * .6, 4.5 + Math.min(4, b[2] * .8), 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1.5; g.stroke();
  // the scoreboard, the commentary, the numbers
  const [h, a] = m.teams, min = MatchEngine.minute(m), ph = { ht: 'HALF TIME', ft: 'FULL TIME', goal: 'GOAL!' }[m.phase] || (m.phase === 'restart' ? m.restart.type.toUpperCase() : '');
  const clock = m.phase === 'ft' ? 'FT' : m.phase === 'ht' ? 'HT' : `${Math.floor(Math.min(min, m.period === 1 ? 45 : 90))}'` + (min > (m.period === 1 ? 45 : 90) ? `+${Math.ceil(min - (m.period === 1 ? 45 : 90))}` : '');
  matchDebugEl.querySelector('.score').textContent = `${h.name} ${h.score} - ${a.score} ${a.name}   ${clock}   ${ph}`;
  const words = { goal: e => `GOAL! ${e.player}${e.og ? ' (own goal)' : ''} ${e.score.join('-')}`, shot: e => `${e.player} shoots${e.header ? ' (header)' : e.penalty ? ' (penalty)' : e.freekick ? ' (free kick)' : ''}`,
    save: e => `Saved by ${e.player}`, miss: e => `${e.player}: wide`, block: e => `Blocked by ${e.player}`, woodwork: e => `Off the woodwork! (${e.player})`, corner: () => 'Corner', foul: e => `Foul by ${e.player}`,
    yellow: e => `Yellow card: ${e.player}`, red: e => `RED CARD: ${e.player}`, offside: e => `Offside: ${e.player}`, penalty: () => 'PENALTY!', sub: e => `Sub: ${e.on} on for ${e.off}`,
    ht: e => `Half time ${e.score.join('-')}`, ft: e => `Full time ${e.score.join('-')}`, added: e => `${e.mins} minutes added`, kickoff: () => 'Kick-off', advantage: () => 'Advantage played' };
  matchDebugEl.querySelector('.log').textContent = m.events.slice(-8).reverse().map(e => `${Math.ceil(e.min)}' ${['ht', 'ft', 'added', 'kickoff'].includes(e.kind) ? '   ' : m.teams[e.side]?.short || ''}  ${(words[e.kind] || (() => e.kind))(e)}`).join('\n');
  const st = m.stats, tot = st[0].poss + st[1].poss || 1, row = (l, k, f = v => v) => `${l.padEnd(11)}${String(f(st[0][k], 0)).padStart(4)}  ${String(f(st[1][k], 1)).padStart(4)}`;
  matchDebugEl.querySelector('.stats').textContent = [`${''.padEnd(11)}${h.short.padStart(4)}  ${a.short.padStart(4)}`, row('possession', 'poss', v => Math.round(v / tot * 100) + '%'), row('shots', 'shots'), row('on target', 'onTarget'),
    row('passes', 'passes'), row('completed', 'passesDone'), row('corners', 'corners'), row('fouls', 'fouls'), row('cards', 'yellow')].join('\n');
}

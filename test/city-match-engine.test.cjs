'use strict';
// ASCII City: the football match engine (city/match-engine.js, STADIUM_PLAN.md). Headless in a vm: a match is
// deterministic for its seed, plays out to full time by the rules, keeps its invariants every tick, and over many
// matches looks like football (the targets set for a 12-minute match: lively, a little higher-scoring than real).
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const { ev } = loadCity();
const j = expr => JSON.parse(ev(`JSON.stringify(${expr})`));

test('a match is the same every time for its seed, and different for another', () => {
  const run = seed => j(`(() => { const m = MatchEngine.create({ home: 'yards', away: 'docks', seed: ${seed} }); MatchEngine.simulate(m);
    return m.events.map(e => e.kind + ':' + e.side + ':' + (e.player || '') + ':' + e.min.toFixed(3)); })()`);
  const a = run(7), b = run(7), c = run(8);
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
});

test('a match plays out to full time: two halves, stoppage time, the score matching its goals', () => {
  const r = j(`(() => { const m = MatchEngine.create({ home: 'midtown', away: 'chinatown', seed: 3 }); MatchEngine.simulate(m);
    const kinds = m.events.map(e => e.kind), goals = m.events.filter(e => e.kind === 'goal');
    return { phase: m.phase, minute: MatchEngine.minute(m), ht: kinds.indexOf('ht'), ft: kinds.indexOf('ft'), kickoffs: kinds.filter(k => k === 'kickoff').length,
      added: kinds.filter(k => k === 'added').length, score: [m.teams[0].score, m.teams[1].score], goals: [goals.filter(g => g.side === 0).length, goals.filter(g => g.side === 1).length],
      scorersNamed: goals.every(g => typeof g.player === 'string'), result: MatchEngine.result(m) }; })()`);
  assert.strictEqual(r.phase, 'ft');
  assert.ok(r.minute >= 90 && r.minute < 100, `ended at ${r.minute.toFixed(1)}'`);
  assert.ok(r.ht > 0 && r.ft > r.ht, 'half time, then full time');
  assert.ok(r.kickoffs >= 2, 'kick-off both halves');
  assert.strictEqual(r.added, 2, 'time added on, each half');
  assert.deepStrictEqual(r.score, r.goals);
  assert.ok(r.scorersNamed);
  assert.deepStrictEqual(r.result.score, r.score);
});

test('every tick: eleven or fewer on the pitch, everyone on the field of play, the ball in bounds or a restart called', () => {
  const bad = j(`(() => { const bad = [], E = MatchEngine, P = E.PITCH;
    for (const seed of [11, 12, 13]) {
      const m = E.create({ home: 'downtown', away: 'shotengai', seed });
      while (m.phase !== 'ft') {
        E.tick(m);
        for (const t of m.teams) {
          if (t.players.filter(p => !p.off).length > 11) bad.push(['too many', seed]);
          if (t.subsLeft < 0) bad.push(['subs', seed]);
          for (const p of t.players) if (!p.off && (Math.abs(p.pos[0]) > P.hl + 6 || Math.abs(p.pos[1]) > P.hw + 6)) bad.push(['off the field', seed, p.pos.map(v => +v.toFixed(1))]);
        }
        const b = m.ball.p;
        if (m.phase === 'play' && !m.ball.owner && (Math.abs(b[1]) > P.hw + 2 || Math.abs(b[0]) > P.hl + 2)) bad.push(['ball out, no restart', seed]);
        if (bad.length > 5) return bad;
      }
    } return bad; })()`);
  assert.deepStrictEqual(bad, []);
});

test('the rules: offside at the moment of the pass, throw-ins and corners to the side that did not touch it last, a goal in the mouth', () => {
  const r = j(`(() => { const E = MatchEngine, P = E.PITCH, out = {};
    // a line-up we place by hand: the home side attacks +x in the first half
    const m = E.create({ home: 'yards', away: 'docks', seed: 2 }); m.phase = 'play'; m.restart = null;
    const [home, away] = m.teams, at = (p, x, y) => { p.pos = [x, y]; p.vel = [0, 0]; };
    away.players.forEach((p, k) => at(p, k === 0 ? 50 : 20, -30 + k * 6)); // their keeper on his line, the rest at x = 20
    home.players.forEach((p, k) => at(p, -10, -30 + k * 6));
    const passer = home.players[6], runner = home.players[9], onside = home.players[10];
    at(passer, 0, 0); at(runner, 30, 5); at(onside, 18, -5);
    m.ball.p = [0.5, 0, 0.11]; m.ball.owner = null; m.ball.lastTouch = passer;
    out.offsideNames = [...E.offsideSet(m, passer)].map(p => p.name); // (who'd be offside if the pass went now)
    out.runner = runner.name; out.onside = onside.name;
    // over the touchline off a home player: an away throw
    m.ball.p = [10, P.hw + 0.5, 0.11]; m.ball.v = [0, 3, 0]; m.ball.lastTouch = passer; m.phase = 'play';
    E.tick(m); out.throw = m.restart && [m.restart.type, m.restart.side];
    // over the away goal line, last off an away defender: a home corner
    m.phase = 'play'; m.restart = null; m.ball.owner = null; m.ball.p = [P.hl + 0.3, 12, 0.11]; m.ball.v = [4, 0, 0]; m.ball.lastTouch = away.players[3]; m.ball.lastKick = null;
    E.tick(m); out.corner = m.restart && [m.restart.type, m.restart.side];
    // the same, last off a home attacker: an away goal kick
    m.phase = 'play'; m.restart = null; m.ball.p = [P.hl + 0.3, 12, 0.11]; m.ball.v = [4, 0, 0]; m.ball.lastTouch = home.players[9];
    E.tick(m); out.goalkick = m.restart && [m.restart.type, m.restart.side];
    // into the away goal, under the bar
    m.phase = 'play'; m.restart = null; m.ball.p = [P.hl + 0.3, 1, 1]; m.ball.v = [6, 0, 0]; m.ball.lastTouch = home.players[9]; m.ball.lastKick = { by: home.players[9], t: m.t, shot: true };
    const before = home.score; E.tick(m); out.goal = [m.phase, home.score - before];
    return out; })()`);
  assert.deepStrictEqual(r.offsideNames, [r.runner], 'the runner beyond the last defender is offside, the one level with the ball is not');
  assert.deepStrictEqual(r.throw, ['throwin', 1]);
  assert.deepStrictEqual(r.corner, ['corner', 0]);
  assert.deepStrictEqual(r.goalkick, ['goalkick', 1]);
  assert.deepStrictEqual(r.goal, ['goal', 1]);
});

test('over many matches it looks like football: goals, passing, shots, corners, cards, home advantage', () => {
  const r = j(`(() => { const E = MatchEngine, n = 60, s = { goals: 0, shots: 0, on: 0, passes: 0, done: 0, corners: 0, fouls: 0, red: 0, home: 0, draw: 0, poss: 0 };
    const club = { id: 'a', name: 'A', short: 'A', kit: ['RED', 'WHITE'], rating: .58, formation: '442' };
    for (let k = 0; k < n; k++) {
      const m = E.create({ home: club, away: { ...club, id: 'b' }, seed: 100 + k }); E.simulate(m);
      const [h, a] = [m.teams[0].score, m.teams[1].score]; s.goals += h + a; if (h > a) s.home++; else if (h === a) s.draw++;
      for (const st of m.stats) { s.shots += st.shots; s.on += st.onTarget; s.passes += st.passes; s.done += st.passesDone; s.corners += st.corners; s.fouls += st.fouls; s.red += st.red; }
      s.poss += m.stats[0].poss / (m.stats[0].poss + m.stats[1].poss);
    }
    return { goals: s.goals / n, shots: s.shots / n / 2, onTarget: s.on / s.shots, completion: s.done / s.passes, corners: s.corners / n / 2, fouls: s.fouls / n / 2,
      red: s.red / n, home: s.home / n, poss: s.poss / n }; })()`);
  const within = (k, lo, hi) => assert.ok(r[k] >= lo && r[k] <= hi, `${k} ${r[k].toFixed(3)} not in ${lo}..${hi}: ${JSON.stringify(r)}`);
  within('goals', 2.6, 4.2);
  within('shots', 10, 22);
  within('onTarget', .35, .6);
  within('completion', .7, .86);
  within('corners', 1.5, 6);
  within('fouls', 4, 11);
  within('red', 0, .35);
  within('home', .3, .6); // (real football: about 45%)
  within('poss', .4, .6);
});

test('a cup tie level at full time goes to penalties: five each, then sudden death, until one side is ahead', () => {
  const r = j(`(() => { const out = []; for (let s = 1; s <= 120 && out.length < 20; s++) {
    const m = MatchEngine.create({ home: 'yards', away: 'docks', seed: s, knockout: true }); MatchEngine.simulate(m);
    const res = MatchEngine.result(m), level = res.score[0] === res.score[1];
    out.push({ level, pens: res.pens, kicks: m.shoot ? m.shoot.kicks.length : 0, taken: m.shoot ? m.shoot.taken : null, kinds: m.events.slice(-2).map(e => e.kind), phase: m.phase }); }
    return out; })()`);
  assert.ok(r.some(x => x.level), 'some ties level after ninety minutes');
  for (const x of r) {
    assert.equal(x.phase, 'ft');
    if (!x.level) { assert.equal(x.pens, null); continue; }
    assert.ok(x.pens && x.pens[0] !== x.pens[1], 'decided on penalties: ' + JSON.stringify(x));
    assert.deepEqual(x.kinds, ['shootout', 'ft']);
    const [a, b] = x.taken; assert.ok(Math.abs(a - b) <= 1 && a + b === x.kicks);
    if (a > 5 || b > 5) assert.equal(a, b, 'sudden death goes in pairs');
  }
  const league = j(`(() => { const m = MatchEngine.create({ home: 'yards', away: 'docks', seed: 3 }); MatchEngine.simulate(m); return { pens: MatchEngine.result(m).pens, shoot: !!m.shoot }; })()`);
  assert.deepEqual(league, { pens: null, shoot: false }, 'a league match can end level');
});

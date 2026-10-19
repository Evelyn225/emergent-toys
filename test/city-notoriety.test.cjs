'use strict';
// ASCII City: being known (city/notoriety.js): what puts you in the papers, how it fades, what changing your look does,
// people knowing your face, and the papers themselves. Run headless in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

// a fresh city with you on a street corner, nobody about
function scene() {
  const { ev } = loadCity();
  ev(`mode = 'walk'; px = 5 * 8 + 1; py = 9 * 8 + 1;
      for (const p of people) { p.x = mod(px + 120, N); p.y = py; } for (const c of cars) if (c.patrol) { c.x = mod(px + 120, N); c.ex = c.x; } for (const c of footCops) { c.x = mod(px + 120, N); c.y = py; }
      var nextDay = () => { dayNum++; stepNotoriety(); }`);
  return { ev };
}

test('the odd slip barely registers; a run of serious crimes gets you known', () => {
  const { ev } = scene();
  ev("addWanted('redlight', px, py, true); addWanted('crash', px, py, true); clearWanted()");
  assert.ok(ev('noto.level') <= 2, `a red light and a bump: ${ev('noto.level')}`);
  ev("for (let k = 0; k < 3; k++) addWanted('hit', px, py, true); addWanted('bankjob', px, py, true); clearWanted()");
  assert.ok(ev('noto.level') >= NOTO_KNOWN_VAL(ev), `known now: ${ev('noto.level')}`);
});
const NOTO_KNOWN_VAL = ev => ev('NOTO_KNOWN');

test('a crime a passer-by calls in still makes the papers, even with no unit to send', () => {
  const { ev } = scene();
  ev("people[0].x = px + 2; people[0].y = py; people[0].hidden = false; crime('steal'); for (let t = 0; t < 8; t += 0.1) { T += 0.1; stepCrime(0.1); }");
  assert.strictEqual(ev('wanted.stars'), 0, 'no unit anywhere near');
  assert.strictEqual(ev("noto.log.filter(e => e.kind === 'steal').length"), 1);
});

test('it fades by half each morning, and the papers run a day behind', () => {
  const { ev } = scene();
  ev("addWanted('bankjob', px, py, true); addWanted('hitcop', px, py, true); clearWanted(); var l0 = noto.level");
  assert.strictEqual(ev('newsLines().length'), 0, 'not in today\'s paper: it went to print before');
  assert.ok(ev('newsLines(true).length') >= 2, 'but it\'s on the telly tonight');
  ev('nextDay()');
  assert.ok(Math.abs(ev('noto.level') - ev('l0') / 2) < 1e-9, 'half gone by morning');
  assert.match(ev('newsLines()[0]'), /^Bank robbed in .+\. The bank reminds customers/, 'the biggest story leads');
  ev('nextDay(); nextDay(); nextDay()');
  assert.strictEqual(ev('newsLines(true).length'), 0, 'old news');
  assert.ok(ev('noto.level') < ev('l0') / 8 + 1e-9, 'and mostly forgotten');
});

test('a spree in one place is one story, counted', () => {
  const { ev } = scene();
  ev("for (let k = 0; k < 3; k++) addWanted('steal', px, py, true); clearWanted(); nextDay()");
  assert.match(ev('newsLines()[0]'), /^Three cars stolen in .+ in one day\. Police say they are aware of the pattern\.$/);
});

test('a haircut, a coat or new ink knocks it down: each kind once a day', () => {
  const { ev } = scene();
  ev("noto.level = 80; money = 1000");
  ev("var r1 = buy('haircut')");
  assert.ok(ev('r1[0]') && /Nobody is going to match you to a description now/.test(ev('r1[1]')), ev('r1[1]'));
  assert.strictEqual(ev('noto.level'), 40);
  ev("buy('haircut')");
  assert.strictEqual(ev('noto.level'), 40, 'a second haircut fools nobody');
  ev("buy('coat')");
  assert.strictEqual(ev('noto.level'), 20, 'a different coat does');
  ev("var r3 = buy('tattoo_swallow')");
  assert.ok(ev('r3[0]') && Math.abs(ev('noto.level') - 12) < 1e-9, 'and so does new ink');
  assert.ok(ev("!inv.some(it => it.id === 'haircut' || it.id === 'coat')"), 'nothing to carry');
  assert.ok(ev("!stealable(['coat', 'haircut', 'book']).includes('coat')"), 'and nothing to shoplift');
});

test('known, a passer-by close by sometimes stares; infamous, now and then one calls it in, and never twice in a row', () => {
  const { ev } = scene();
  ev("people[0].x = px + 1; people[0].y = py; people[0].hidden = false; people[0].talk = 0; noto.level = 20");
  assert.strictEqual(ev('recognise(1, () => 0)'), null, 'not known: nobody looks twice');
  ev('noto.level = 40; noto.scanT = 0');
  ev('var r = recognise(1, () => 0)');
  assert.ok(ev('r && r.who === people[0] && !r.called'), 'known: a stare, no call');
  assert.ok(ev('people[0].gawk === YOU_SPOT && people[0].talk > 0'), 'stopped, looking at you');
  ev('noto.scanT = 0; people[0].talk = 0');
  assert.strictEqual(ev('recognise(1, () => 0)'), null, 'once a day each');
  ev("people[1].x = px + 1; people[1].y = py + 0.3; people[1].hidden = false; people[1].talk = 0; noto.level = 90; noto.scanT = 0; var r2 = recognise(1, () => 0)");
  assert.ok(ev('r2.called') && ev("reports.some(q => q.kind === 'spotted')"), 'infamous: they call it in');
  ev("people[2].x = px - 1; people[2].y = py; people[2].hidden = false; people[2].talk = 0; noto.scanT = 0; var r3 = recognise(1, () => 0)");
  assert.ok(ev('r3 && !r3.called'), 'but not another call straight after');
  ev("for (let t = 0; t < 8; t += 0.1) { T += 0.1; stepCrime(0.1); }");
  assert.ok(ev("!noto.log.some(e => e.kind === 'spotted')"), 'being recognised is not itself news');
});

test('the better known you are, the further off police see you (a quarter further at most)', () => {
  const { ev } = scene();
  assert.strictEqual(ev('copSight()'), ev('COP_SIGHT'));
  ev('noto.level = 100');
  assert.strictEqual(ev('copSight()'), ev('COP_SIGHT') * 1.25);
  ev("footCops[0].x = px + COP_SIGHT * 1.1; footCops[0].y = py");
  assert.strictEqual(ev("crime('hit')"), 'cop', 'spotted from past the usual range');
});

test('the papers: every story reads flat, and the gossip repeats it', () => {
  const { ev } = scene();
  const kinds = ev('Object.keys(NEWS)');
  ev(`for (const k of ${JSON.stringify(kinds)}) newsEvent(k, px, py, { who: 'Kid Mercury', crime: 'car theft' }); nextDay()`);
  const lines = ev('newsLines()');
  assert.ok(lines.length >= kinds.length, 'a line for every story');
  for (const l of lines) {
    assert.ok(!/!|\?|—|undefined|NaN/.test(l), `dry, and complete: ${l}`);
    assert.ok(/^[A-Z0-9].*\.("?)$/.test(l), `a sentence: ${l}`);
  }
  assert.ok(ev("newsGossip().some(l => l.startsWith('Did you see the paper?'))"));
});


'use strict';
// ASCII City: fishing (city/fishing.js). What water is where, a cast from wind-up to the fish in your bag, striking too
// soon or too late, what bites where (the golden koi only in the Gardens' lake, and its wish), what the hut pays, and
// what's kept. Run headless in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

// on the sea wall west of the hut, a rod in hand, facing out over the bay
function angler(rod = 'rod') {
  const { ev } = loadCity();
  ev(`mode = 'walk'; tod = 11; rain = 0; px = FISH_HUT.x - 3; py = shoreS(px) - 0.25; a = Math.PI / 2;
      clearInventory(); carryItem({ id: '${rod}', uses: 0 }); fishing = null;
      var steps = (s, n = 20) => { for (let k = 0; k < n; k++) { T += s / n; stepFishing(s / n); } };
      var cast = (power = 0.5) => { useHeld({ indoors: false }); K.KeyQ = 1; steps(power * 1.1); K.KeyQ = 0; steps(0.05, 1); steps(fishing.dur + 0.05); };`);
  return { ev };
}
const j = (ev, expr) => JSON.parse(ev(`JSON.stringify(${expr})`)); // (arrays out of the vm aren't this realm's)
const park = ev => ev(`(() => { for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) if (blockKind(bx, by) === 'park') return [bx * 8 + POND[0], by * 8 + POND[1]]; })()`);

test('the water kinds: the bay, open water far out, the marina, a park pond (ice in winter), the gardens\' lake, and dry land', () => {
  const { ev } = loadCity();
  assert.strictEqual(ev('waterKind(FISH_HUT.x - 3, shoreS(FISH_HUT.x - 3) + 1.5)'), 'sea');
  assert.strictEqual(ev('waterKind(FAIR.x1 + 0.5, FAIR.y1 - 0.5)'), 'deep', 'off the end of the Sunset Pier');
  assert.strictEqual(ev('waterKind(MARINA.x + 1.5, MARINA.fingers[0] + 0.6)'), 'marina');
  assert.strictEqual(ev('waterKind(FAIR.cx, FAIR.y0 + 3)'), null, 'the pier itself');
  assert.strictEqual(ev('waterKind(FISH_HUT.x, FISH_HUT.y - 1)'), null, 'the promenade');
  const [x, y] = park(ev);
  assert.strictEqual(ev(`waterKind(${x}, ${y})`), 'pond');
  assert.strictEqual(ev(`seasonShift = 3 - seasonIdx(); waterKind(${x}, ${y})`), 'ice');
  assert.strictEqual(ev('waterKind(GARDEN.x0 + LAKE.x, GARDEN.y0 + LAKE.y)'), 'lake');
});

test('a cast: wind up, let go, it lands out on the water; something comes for it, takes it, Q strikes, and it\'s in your bag', () => {
  const { ev } = angler();
  ev('cast(1)');
  assert.strictEqual(ev('fishing.st'), 'wait');
  assert.strictEqual(ev('fishing.water'), 'sea');
  const out = ev('Math.hypot(rel(fishing.x - px), rel(fishing.y - py))');
  assert.ok(out > 1.7 && out < 2, `full wind-up: as far as it goes (${out})`);
  ev('fishing.next = 0; steps(0.05, 1)');
  assert.strictEqual(ev('fishing.st'), 'lure');
  ev('steps(fishing.dur + 0.02)');
  assert.strictEqual(ev('fishing.st'), 'bite');
  assert.match(ev("useHeld({ indoors: false })[0]"), /Fish on|Got it|Something/);
  assert.strictEqual(ev('fishing.st'), 'reel');
  ev('steps(fishing.dur + 0.05)');
  assert.strictEqual(ev('fishing.st'), 'landed');
  const got = ev('inv[1]'), d = ev(`ITEMS['${got.id}']`);
  assert.ok(ev(`WATERS.sea.fish.concat(WATERS.sea.junk, WATERS.sea.treasure).some(e => e[0] === '${got.id}')`), `from the bay's table: ${got.id}`);
  if (d.kg) assert.ok(got.kg >= d.kg[0] && got.kg <= d.kg[1], `a weight it comes in: ${got.kg}`);
  assert.strictEqual(ev('heldItem().id'), 'rod', 'the rod stays in your hand');
  ev('steps(2)');
  assert.strictEqual(ev('fishing'), null, 'and the line\'s ready again');
});

test('too soon and it bolts; too late and it\'s away (and something else comes along); a short cast lands short', () => {
  const { ev } = angler();
  ev('cast(0.3); fishing.next = 0; steps(0.05, 1); steps(0.3)');
  assert.strictEqual(ev('fishing.st'), 'lure');
  assert.match(ev("useHeld({ indoors: false })[0]"), /Too soon/);
  ev('steps(3)');
  assert.strictEqual(ev('inv.length'), 1, 'nothing on the hook');
  ev('cast(0); fishing.next = 0; steps(0.05, 1); steps(fishing.dur + 0.02)');
  assert.ok(ev('Math.hypot(rel(fishing.x - px), rel(fishing.y - py))') < 0.5, 'no wind-up: a little plop out in front');
  ev('steps(1.2)');
  assert.strictEqual(ev('fishing.st'), 'wait', 'missed the strike');
  assert.match(ev('msgText'), /got away|Missed|Gone/);
  assert.ok(ev('fishing.next') < 10, 'and the next one along sooner');
});

test('cast at dry land and nothing bites; at a frozen pond it skitters across the ice; walk off and the line comes in', () => {
  const { ev } = angler();
  ev('a = -Math.PI / 2; fishSfx.length = 0; cast(0.5)');
  assert.strictEqual(ev('fishSfx.join()'), 'whoosh,ground', 'it lands with a thud on the ground');
  assert.strictEqual(ev('fishing.st'), 'land');
  ev('steps(30)');
  assert.strictEqual(ev('fishing.st'), 'land', 'never a bite');
  const [x, y] = park(ev);
  ev(`seasonShift = 3 - seasonIdx(); px = ${x} - 1.2; py = ${y}; a = 0; fishing = null; cast(0.2)`);
  assert.strictEqual(ev('fishing.st'), 'land');
  assert.match(ev('msgText'), /frozen/);
  assert.strictEqual(ev('fishSfx.at(-1)'), 'skitter', 'and skitters on the ice');
  ev(`seasonShift++; fishing = null; cast(0.2)`);
  assert.strictEqual(ev('fishing.water'), 'pond', 'thawed');
  ev('py += 3; steps(0.05, 1)');
  assert.strictEqual(ev('fishing.st'), 'reel', 'walked away: it reels itself in');
  ev('fishing = null; steps(0.05, 1); held = -1; useHeld({ indoors: false }); fishing = { st: "wait", t: 0, rod: "rod", x: px, y: py, d: 1 }; steps(0.05, 1)');
  assert.strictEqual(ev('fishing'), null, 'and putting the rod away takes the line with it');
});

test('every water has its own fish; night fish only at night; the golden koi lives only in the gardens\' lake; a better rod finds more treasure', () => {
  const { ev } = loadCity();
  const waters = j(ev, 'Object.keys(WATERS)');
  assert.deepStrictEqual([...waters].sort(), ['deep', 'lake', 'marina', 'pond', 'sea']);
  for (const w of waters) for (const cat of ['fish', 'junk', 'treasure']) assert.ok(ev(`WATERS.${w}.${cat}.every(([id]) => ITEMS[id])`), `${w} ${cat}`);
  assert.deepStrictEqual(j(ev, "Object.keys(WATERS).filter(w => WATERS[w].fish.some(e => e[0] === 'goldkoi'))"), ['lake']);
  assert.notDeepStrictEqual(ev("WATERS.pond.fish.map(e => e[0]).sort().join()"), ev("WATERS.sea.fish.map(e => e[0]).sort().join()"));
  const roll = (w, rod, n, when) => ev(`tod = ${when}; (() => { const r = {}; for (let k = 0; k < ${n}; k++) { const c = rollCatch('${w}', '${rod}'); r[c.id] = (r[c.id] || 0) + 1; } return r; })()`);
  const day = roll('sea', 'rod', 3000, 12), nite = roll('sea', 'rod', 3000, 23);
  assert.ok(!day.squid && !day.conger, 'no squid by day');
  assert.ok(nite.squid > 0 && nite.conger > 0, 'they come out at night');
  const lake = roll('lake', 'rod', 6000, 12), koi = lake.goldkoi || 0;
  assert.ok(koi > 10 && koi < 160, `rare: ${koi} in 6000`);
  const treasure = r => Object.entries(r).filter(([id]) => ev(`!!ITEMS['${id}'].fished || '${id}' === 'wishcoins'`)).reduce((t, [, n]) => t + n, 0);
  assert.ok(treasure(roll('sea', 'carbonrod', 4000, 12)) > treasure(roll('sea', 'rod', 4000, 12)) * 1.2, 'the carbon rod');
});

test('the golden koi: Q makes a wish, something small comes true right away, and the koi is gone', () => {
  const { ev } = loadCity();
  ev(`mode = 'walk'; clearInventory(); money = 100; weather = 'rain'; needs.health = 40`);
  const wishes = [];
  for (const r of [0, 0.5, 0.99]) {
    ev(`carryItem({ id: 'goldkoi', uses: 0, kg: 2.1 }); weather = 'rain'; needs.health = 40; money = 100;
        var rnd0 = Math.random; Math.random = () => ${r}; var w = useHeld({ indoors: false }); Math.random = rnd0`);
    assert.match(ev('w[0]'), /wish/);
    assert.ok(ev("!inv.some(it => it.id === 'goldkoi')"), 'it swims off');
    wishes.push(ev(`needs.health === maxHealth() ? 'heal' : money > 100 ? 'cash' : weather === 'clear' ? 'clear' : 'none'`));
  }
  assert.deepStrictEqual(wishes, ['heal', 'cash', 'clear']);
  ev(`carryItem({ id: 'goldkoi', uses: 0, kg: 2 }); needs.health = maxHealth(); weather = 'clear'; money = 100; useHeld({ indoors: false })`);
  assert.ok(ev('money > 100'), 'nothing to heal and the sky is already clear: the cash');
});

test('the hut buys your catch: fish by weight, junk binned for nothing, treasure at the pawn shop\'s rate; not your skateboard', () => {
  const { ev } = loadCity();
  ev(`clearInventory(); money = 0;
      for (const it of [{ id: 'cod', kg: 1.2 }, { id: 'cod', kg: 6.5 }, { id: 'oldboot' }, { id: 'goldring' }, { id: 'skateboard' }]) carryItem({ uses: 0, ...it });`);
  const rate = "SELL_RATE['BAIT & TACKLE']";
  assert.ok(ev(`sellPrice(inv[1], ${rate}) > sellPrice(inv[0], ${rate}) * 4`), 'the big one');
  assert.strictEqual(ev(`sellPrice(inv[3], ${rate})`), ev(`sellPrice(inv[3], SELL_RATE.PAWN)`));
  assert.strictEqual(ev(`sellPrice(inv[0], SELL_RATE.PAWN)`), 0, 'the pawn shop doesn\'t want your fish');
  assert.match(ev(`sellSlot(1, ${rate})[1]`), /^You sell the 6.5kg cod for \$/);
  assert.deepStrictEqual(j(ev, `sellSlot(1, ${rate})`), [true, 'They take the old boot off your hands and drop it in the bin.']);
  assert.deepStrictEqual(j(ev, `sellSlot(2, ${rate})`), [false, '"We don\'t take skateboard."']);
  assert.ok(ev('money') > 10);
});

test('the hut: at its hatch on the promenade, open early till eight; a big fish makes the paper without making you known', () => {
  const { ev } = loadCity();
  ev('mode = "walk"; px = FISH_HUT.x + FISH_HUT.hatch; py = FISH_HUT.y - FISH_HUT.hw - 0.2');
  assert.ok(ev('nearHut()'));
  assert.ok(ev('!solidAt(px, py, 0.02)'), 'standing room at the hatch');
  assert.ok(ev('solidAt(FISH_HUT.x, FISH_HUT.y, 0)'), 'the hut is solid');
  assert.ok(ev('hutOpen(5.5) && hutOpen(19.5) && !hutOpen(20.5) && !hutOpen(3)'));
  ev(`noto.level = 0; noto.log.length = 0; fishLog.caught = 0; fishLog.best = null; clearInventory(); carryItem({ id: 'rod', uses: 0 });
      fishing = { st: 'reel', t: 0, catch: { id: 'tuna', kg: 31.5 }, rod: 'rod' }; landCatch(fishing); dayNum++; stepNotoriety()`);
  assert.match(ev('newsLines()[0]'), /^A 31.5kg bluefin tuna was landed in .+ by a member of the public\. The fish was not available for comment\.$/);
  assert.strictEqual(ev('noto.level'), 0);
  assert.deepStrictEqual(j(ev, '[fishLog.caught, fishLog.best.kg]'), [1, 31.5]);
  assert.match(ev('hutPrompt()'), /your best: 31.5kg bluefin tuna/);
});

test('the sushi bars buy sea fish for more than the hut does, and turn pond fish away', () => {
  const { ev } = loadCity();
  ev(`clearInventory(); money = 0; carryItem({ id: 'mackerel', uses: 0, kg: 0.7 }); carryItem({ id: 'carp', uses: 0, kg: 4 }); carryItem({ id: 'oldboot', uses: 0 })`);
  const hut = ev("sellPrice(inv[0], SELL_RATE['BAIT & TACKLE'])"), sushi = ev('sellPrice(inv[0], SELL_RATE.SUSHI)');
  assert.ok(sushi > hut, `the sushi bar pays more: ${sushi} against ${hut}`);
  assert.ok(Math.abs(sushi - hut * ev('SUSHI_PAYS')) <= 0.25);
  assert.deepStrictEqual(j(ev, 'sellSlot(1, SELL_RATE.SUSHI)'), [false, '"Fish from the sea only. Not carp."']);
  assert.deepStrictEqual(j(ev, 'sellSlot(2, SELL_RATE.SUSHI)'), [false, '"We don\'t take old boot."'], 'and they don\'t bin your junk');
  assert.match(ev('sellSlot(0, SELL_RATE.SUSHI)[1]'), /^You sell the 0.7kg mackerel for \$/);
  assert.strictEqual(ev('money'), sushi);
});

test('the regulars: each stood on dry ground, facing water, their bobber out on it; now and then one lands something', () => {
  const { ev } = loadCity();
  const anglers = j(ev, 'ANGLERS.map(o => ({ dry: !waterKind(o.x, o.y) && !map[idx(Math.floor(o.x), Math.floor(o.y))], wet: waterKind(o.x + Math.cos(o.a) * o.cast, o.y + Math.sin(o.a) * o.cast) }))');
  assert.ok(anglers.length >= 8, `${anglers.length} of them`);
  for (const [k, o] of anglers.entries()) { assert.ok(o.dry, `angler ${k} on dry ground`); assert.ok(o.wet && o.wet !== 'ice', `angler ${k}'s bobber on the water`); }
  assert.ok(ev("ANGLERS.some(o => waterKind(o.x + Math.cos(o.a) * o.cast, o.y + Math.sin(o.a) * o.cast) === 'pond') && ANGLERS.some(o => waterKind(o.x + Math.cos(o.a) * o.cast, o.y + Math.sin(o.a) * o.cast) === 'lake')"), 'a pond and the lake too');
  const phases = j(ev, '(() => { const o = ANGLERS[0], seen = {}; for (let t = 0; t < 400; t += 0.5) seen[anglerPhase(o, t).st] = 1; return Object.keys(seen).sort(); })()');
  assert.deepStrictEqual(phases, ['catch', 'wait']);
  ev('mode = "walk"; px = ANGLERS[0].x + 0.1; py = ANGLERS[0].y');
  assert.ok(ev('nearAngler() === ANGLERS[0]'));
});

test('from a boat: sit still and Q puts you in your seat with the rod; it casts over the side; get under way and the line comes in', () => {
  const { ev } = loadCity();
  ev(`tod = 11; rain = 0; clearInventory(); carryItem({ id: 'rod', uses: 0 }); boardBoat(fleet.find(b => b.deal === 'rent'));
      sea.x = px = MARINA.x + 1; sea.y = py = MARINA.end + 1.6; a = Math.PI / 2; sea.hx = 0; sea.hy = 1; third = true; fishing = null;
      var steps = (s, n = 20) => { for (let k = 0; k < n; k++) { T += s / n; stepFishing(s / n); } };`);
  ev('sea.v = 0.5');
  assert.match(ev('useHeld({ indoors: false })[0]'), /moving/);
  ev('sea.v = 0');
  assert.match(ev('useHeld({ indoors: false })[0]'), /settle in/);
  assert.strictEqual(ev('third'), false, 'the view from your seat');
  ev('useHeld({ indoors: false }); K.KeyQ = 1; steps(0.6); K.KeyQ = 0; steps(0.05, 1); steps(fishing.dur + 0.05)');
  assert.strictEqual(ev('fishing.st'), 'wait');
  assert.ok(['deep', 'sea', 'marina'].includes(ev('fishing.water')));
  ev('sea.v = 0.6; steps(0.05, 1)');
  assert.strictEqual(ev('fishing.st'), 'reel');
  assert.match(ev('msgText'), /trolling/);
  ev('sea.v = 0; third = true; steps(0.05, 1)');
  assert.strictEqual(ev('fishing'), null, 'the view from behind again: the line comes in');
});

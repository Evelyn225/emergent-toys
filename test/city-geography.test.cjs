'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');
const { ev } = loadCity();
const json = expression => JSON.parse(ev(`JSON.stringify(${expression})`));

test('every occupied shop lot has one identity independent of the particular occupied cell', () => {
  assert.equal(ev(`SHOP.every((shop, cell) => !shop || !map[cell] ||
    cityPlaceAtCell(cell)?.shop === shop && cityPlaceCell(cityPlaceAtCell(cell).id, cell) === cell)`), true);
  assert.equal(ev('CITY_PLACES.size'), ev('new Set(SHOP.filter((shop, cell) => shop && map[cell])).size'));
  assert.equal(ev('cityPlaceAtCell(-1)'), null);
  assert.equal(ev('cityPlaceAtCell(N * N)'), null);
  assert.equal(ev('cityPlaceCell("unknown")'), -1);
});

test('home restoration follows the place identity when its stored cell points at a different building', () => {
  assert.equal(ev(`(() => {
    const home = freeHomeNear(41, 73), place = cityPlaceAtCell(home);
    const different = Array.from(CITY_PLACES.values()).find(p => p.shop !== place.shop);
    return cityPlaceAtCell(restoreHomeCell(different.cell, place.id)) === place;
  })()`), true);
  assert.equal(ev('restoreHomeCell(freeHomeNear(41,73), "missing-place")'), -1);
});

test('the proposed cut clears every recorded footprint and keeps the courier and railway groups together', () => {
  const inventory = json('cityLayoutInventory()');
  assert.equal(inventory.splitY, 72);
  assert.ok(inventory.counts.places > 2500);
  assert.ok(inventory.counts.apartmentLots > 800);
  assert.deepEqual(inventory.conflicts, []);
  for (const p of [...inventory.fixed, ...inventory.places, ...inventory.infrastructure]) {
    assert.ok([p.x0, p.y0, p.x1, p.y1].every(Number.isFinite), p.id);
    assert.ok(p.x1 > p.x0 && p.y1 > p.y0, p.id);
  }
  for (const id of ['courier-cluster', 'elevated-railway', 'gardens', 'casino', 'exchange', 'museum'])
    assert.equal(inventory.fixed.find(p => p.id === id).island, 'south', id);
  assert.equal(inventory.fixed.find(p => p.id === 'grand-hotel').island, 'north');
  assert.equal(inventory.infrastructure.filter(p => p.id.startsWith('subway:')).length, ev('stations.length'));
  assert.equal(inventory.infrastructure.filter(p => p.id.startsWith('pier:')).length, ev('PIERS.length'));
  assert.ok(inventory.infrastructure.some(p => p.kind === 'landing' && p.y0 < 0 && p.island === 'north'));
  assert.ok(json('cityLayoutInventory(103).conflicts').some(p => p.id === 'courier-cluster'));
});

test('legacy save upgrade retains progress, adds stable home/waypoint identities, and is idempotent', () => {
  ev(`globalThis.legacy = {
    v: 1, money: 18543, day: 12, tod: 3.5, inv: [{id:'weed',uses:4}], closet: [{id:'neon',uses:5}],
    homes: [{cell:freeHomeNear(41,73),kind:'home_studio',decor:[{id:'lava'}],fridge:[{id:'pizza',uses:2}],
      workshop:{supplies:7,upgrades:{controller:true},racks:[{progress:.5}],batch:{progress:.25}}}],
    cars:[{model:'car_hatch',x:41,y:73}],boats:[{kind:'speedboat',x:100,y:225}],planes:[{id:'test',x:33,y:220}],
    tags:[{x:4,y:5,design:2}],courier:{job:{id:'garden',took:31},records:{best:{garden:42}}},
    drugContacts:{supplierOrders:8,buyers:{kit:{deals:3,trust:2,spent:72}}}
  };legacy.waypoint={id:'home:'+legacy.homes[0].cell,name:'Home',x:41,y:73};
  globalThis.original = JSON.stringify(legacy);globalThis.upgrade = prepareCitySave(legacy);`);
  assert.equal(ev('JSON.stringify(legacy)'), ev('original'));
  assert.equal(ev('upgrade.upgraded'), true);
  assert.equal(ev('upgrade.data.v'), 2);
  assert.equal(ev('upgrade.data.world.layout'), 'coastal-v1');
  assert.equal(ev('upgrade.data.homes[0].placeId'), ev('cityPlaceAtCell(legacy.homes[0].cell).id'));
  assert.equal(ev('upgrade.data.waypoint.id'), ev('cityHomeId(legacy.homes[0])'));
  for (const key of ['money', 'day', 'tod', 'inv', 'closet', 'cars', 'boats', 'planes', 'tags', 'courier', 'drugContacts'])
    assert.deepEqual(json(`upgrade.data.${key}`), json(`legacy.${key}`), key);
  assert.deepEqual(json('upgrade.data.homes[0].workshop'), json('legacy.homes[0].workshop'));
  assert.equal(ev('prepareCitySave(upgrade.data).upgraded'), false);
  assert.equal(ev('prepareCitySave(upgrade.data).data === upgrade.data'), true);
});

test('unknown save schemas and layouts are never interpreted as current grid cells', () => {
  for (const value of ['null', '[]', '{}', '{v:99}', '{v:2}', '{v:2,world:{layout:"archipelago-future"}}'])
    assert.equal(ev(`prepareCitySave(${value})`), null);
});

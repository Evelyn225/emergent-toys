'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

test('garden surface index preserves exact ground boundaries and priorities', () => {
  const { ev } = loadCity();
  const errors = ev(`(() => {
    const bad = [];
    for (let k = 0; k < 12000; k++) {
      const x = hash(k, 1, 987) * GARDEN.w, y = hash(k, 2, 987) * GARDEN.h;
      const edge = gardenLakeEdge(x, y), pen = inPen(x, y), bed = inBed(x, y);
      const expected = onJetty(x, y) ? 'jetty' : edge > 0 ? 'lake' : edge > -0.18 ? 'reeds' : pen ? pen.kind : gardenPathDist(x, y) < 0.25 ? 'gravel' : bed >= 0 ? 'bed' : 'lawn';
      const hit = gardenSurface(x, y);
      if (hit.kind !== expected || hit.kind === 'bed' && hit.bed !== bed) bad.push([x, y, expected, hit.kind]);
      if (bad.length > 5) break;
    }
    return JSON.stringify(bad);
  })()`);
  assert.deepEqual(JSON.parse(errors), []);
  assert.ok(ev('GARDEN_GROUND.every(c => c.paths.length < GARDEN_SEGMENTS.length / 2)'), 'each cell only checks nearby segments');
});

test('Belle buildings have shaped footprints while public roofs stay flat and usable', () => {
  const { ev } = loadCity();
  assert.ok(ev('BELLE_BUILDINGS.some(b => !b.access && !map[idx(b.x0, b.y0)])'), 'recessed building corners');
  assert.ok(ev('BELLE_BUILDINGS.some(b => b.ivy) && BELLE_BUILDINGS.some(b => b.balconies)'), 'vines and balconies are part of the district');
  assert.ok(ev('BELLE_BUILDINGS.filter(b => b.access).every(b => { for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) if (SHOP[idx(x,y)] === b.sh && map[idx(x,y)] !== b.h) return false; return true; })'));
  assert.ok(ev('BELLE_BUILDINGS.some(b => !b.access && belleRoofHeight(b.x, b.y) > b.h)'), 'mansards rise above the wall');
  assert.doesNotThrow(() => ev('JSON.stringify(SHOP.filter(Boolean))'), 'shop metadata stays serializable');
});

test('the luxury home is sold in Belle Époque and older clipped home cells are repaired', () => {
  const { ev } = loadCity();
  ev("money = 20000; var bought = buyProperty('home_belle', 0.3, 4)");
  assert.equal(ev('bought[0]'), true);
  assert.equal(ev('money'), 4000);
  assert.equal(ev('districtAt(owned.homes[0].cell % N, Math.floor(owned.homes[0].cell / N))'), 'belle');
  assert.equal(ev('homeRoomKind(owned.homes[0].kind)'), 'bellehome');
  assert.ok(ev('(() => { const b = SHOP[owned.homes[0].cell].belle; for (let y=b.y0;y<b.y1;y++) if(map[idx(b.x1,y)]) return false; return true; })()'), 'private balcony faces the street');
  assert.equal(ev('ITEMS.home_loft.price'), 7000);
  assert.ok(ev('(() => { const b = BELLE_BUILDINGS.find(b => !b.access); const cell = restoreHomeCell(idx(b.x0, b.y0)); return cell >= 0 && !!SHOP[cell] && !!map[cell]; })()'));
});

test('emergency parking stays by its own entrance and leaves hospital exits clear', () => {
  const { ev } = loadCity();
  assert.ok(ev('SERVICES.every(b => near(b.x, b.y, ...b.door) < 1.5)'), 'parked by the actual lot');
  assert.ok(ev("SERVICES.filter(b => b.kind === 'amb').every(b => Math.abs(rel(b.x - b.door[0])) >= 0.8)"));
  assert.ok(ev('SERVICES.every(b => !lamps.some(l => Math.abs(rel(l.x - b.x)) < 0.45 && Math.abs(rel(l.y - b.y)) < 0.2))'));
});

test('car footprint catches a rear corner during a sideways drift', () => {
  const { ev } = loadCity();
  ev('for (let y = 70; y < 76; y++) for (let x = 40; x < 47; x++) map[idx(x,y)] = 0; map[idx(42,72)] = 3');
  assert.equal(ev('carBodyClear(42.15, 73.16, 0, 1)'), false, 'rear intersects the building, front points away');
  assert.equal(ev('carBodyClear(42.15, 73.3, 0, 1)'), true);
  assert.equal(ev('carBodyClear(41.84, 71.84, Math.SQRT1_2, Math.SQRT1_2)'), false, 'rotated corner intersects');
});

test('nearby pursuit cruisers reverse tightly rather than queuing behind traffic', () => {
  const { ev } = loadCity();
  ev(`px = 41; py = 73; mode = 'walk'; cars.length = 0; people.length = 0;
    for (let y = 71; y < 76; y++) for (let x = 36; x < 49; x++) map[idx(x,y)] = 0;
    var cruiser = addCar({x:43, y:73, hx:1, hy:0, patrol:true, pursuit:true, kind:'police', dest:[41,73], cruise:2.5});
    addCar({x:43.3,y:73,hx:1,hy:0,parked:true});
    for (let k = 0; k < 22; k++) stepTraffic(0.05, T += 0.05, true)`);
  assert.ok(ev('cruiser.hx < -0.9'), 'turned around inside 1.1 seconds');
  assert.ok(ev('cruiser.x < 43'), 'moves back toward the target');
});

test('police follow a known roof entry and never path across a gap', () => {
  const { ev } = loadCity();
  ev(`for (let y = 78; y < 86; y++) for (let x = 38; x < 47; x++) { map[idx(x,y)] = 0; SHOP[idx(x,y)] = null; }
    for (let y = 81; y < 84; y++) for (let x = 40; x < 45; x++) map[idx(x,y)] = 3;
    mode = 'roof'; px = 43.5; py = 82.5; roofH = 3; wanted.stars = 1; wanted.seen = true;
    notePoliceRoofEntry(40.5,82.5,[40.5,80.5]);`);
  assert.equal(ev('roofSearchLead(0.1); roofCops.length'), 0, 'stairs take time');
  const result = ev(`(() => { let r; for (let k = 0; k < 180; k++) { T += 0.05; r = stepCrime(0.05); if (r === 'busted') break; } return r; })()`);
  assert.equal(result, 'busted');
  assert.ok(ev('roofCops.length > 0 && roofCops.every(c => policeRoofHeight(c.x,c.y) > 0)'));
  ev('for (let y = 81; y < 84; y++) map[idx(42,y)] = 0');
  assert.equal(ev('policeRoofPath(40.5,82.5,43.5,82.5).length'), 0, 'cannot walk across empty space');
});

test('an officer gains on a diagonal caffeinated sprint after the initial burst', () => {
  const { ev } = loadCity();
  const gain = ev(`(() => {
    for(let y=70;y<83;y++) for(let x=38;x<50;x++) map[idx(x,y)]=0;
    px=41;py=73;const c={x:39.5,y:71.5,ph:0,burst:0}, initial=near(c.x,c.y,px,py);
    for(let k=0;k<80;k++) { T+=.05;px+=.05;py+=.05;chaseStep(c,px,py,.05); }
    return initial-near(c.x,c.y,px,py);
  })()`);
  assert.ok(gain > 0.2, `closed ${gain} cells while the player ran diagonally at full coffee speed`);
});

test('a returning cruiser finds a real road from the Gardens and routes around intervening walls', () => {
  const { ev } = loadCity();
  assert.ok(ev('(() => { const l=policeReturnLane({x:GARDEN.x0+11,y:GARDEN.y0+6}); return !!ROAD[idx(Math.floor(l.x),Math.floor(l.y))]; })()'), 'no imaginary lanes inside the Gardens');
  const trip = JSON.parse(ev(`JSON.stringify((() => {
    cars.length=0;people.length=0;px=41;py=73;mode='walk';
    for(let y=70;y<77;y++)for(let x=38;x<47;x++)map[idx(x,y)]=0;
    map[idx(42,72)]=map[idx(42,73)]=3;
    const c=addCar({x:43.5,y:73.5,hx:-1,hy:0,kind:'police',returning:true,merging:{x:41.5,y:73.4,hx:1,hy:0}});
    let clear=true;
    for(let k=0;k<500&&c.merging;k++) {T+=.05;stepTraffic(.05,T,true);clear &&= carBodyClear(c.x,c.y,c.hx,c.hy);}
    return {clear,merged:!c.merging,nearRoad:near(c.x,c.y,41.5,73.4)<.15};
  })())`));
  assert.deepEqual(trip, {clear:true,merged:true,nearRoad:true});
});

test('officers walk back to the cruiser after the $50 fine and its return trip is quiet', () => {
  const { ev } = loadCity();
  ev(`px=41; py=73; mode='walk'; money=200; cars.length=0; footCops.length=0;
    var cruiser=addCar({x:41,y:73,hx:1,hy:0,patrol:true,pursuit:true,kind:'police'});
    footCops.push({x:42.5,y:73,car:cruiser,chase:true,extra:true,ph:0});
    wanted.stars=1; payFine();`);
  assert.equal(ev('money'), 150);
  assert.equal(ev('cars.includes(cruiser) && footCops.length === 1 && cruiser.waitingCrew'), true, 'both stay visible');
  assert.equal(ev('code(cruiser) || lightsOn_(cruiser)'), false);
  ev('for (let k=0;k<20;k++) { T+=0.05; stepCrime(0.05); }');
  assert.ok(ev('footCops.length === 1 && footCops[0].x < 42.5 && cruiser.waitingCrew'));
  ev('for (let k=0;k<100;k++) { T+=0.05; stepCrime(0.05); }');
  assert.equal(ev('footCops.length'), 0, 'boards the car after walking to it');
  assert.equal(ev('cruiser.waitingCrew'), false);
  assert.equal(ev('code({state:"back",pursuit:true}) || lightsOn_({state:"back",pursuit:true})'), false, 'all returning calls stay quiet');
  const trip = JSON.parse(ev(`JSON.stringify((() => {
    cars.length=0;footCops.length=0;people.length=0;
    const base=SERVICES.find(b=>b.kind==='police'), lane=laneNear(base.x,base.lane);
    px=lane.x;py=lane.y-3;
    const c=addCar({...lane,x:lane.x+lane.hx*4,y:lane.y+lane.hy*4,base,kind:'police',ev:true,patrol:true,pursuit:true});
    footCops.push({x:c.x-c.hx*.8,y:c.y-c.hy*.8,car:c,chase:true,extra:true,ph:0});
    wanted.stars=1;clearWanted();
    const start=[c.x,c.y];let moved=false,quiet=true;
    for(let k=0;k<2400&&cars.includes(c);k++) {
      T+=.05;stepCrime(.05);stepTraffic(.05,T,true);
      moved ||= near(c.x,c.y,...start)>.5;quiet &&= !code(c)&&!lightsOn_(c);
    }
    return {moved,quiet,home:!cars.includes(c)&&!base.out,nearStation:near(c.x,c.y,base.x,base.lane)<1.3};
  })())`));
  assert.deepEqual(trip, {moved:true,quiet:true,home:true,nearStation:true}, 'boards, drives back, and parks at the station');
});

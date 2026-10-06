'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadCity } = require('./helpers/load-city.cjs');
const { readCityManifest } = require('../tools/build-city.cjs');

test('building compositions retain every ground footprint, shop identity and public roof', () => {
  const baseline = vm.createContext({ console });
  for (const file of readCityManifest().pure) {
    if (file === 'city/architecture.js') break;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), baseline, { filename: file });
  }
  const { ev } = loadCity();
  const oldGround = Array.from(vm.runInContext('map', baseline), h => h > 0);
  const newGround = Array.from(ev('map'), h => h > 0);
  assert.deepEqual(newGround, oldGround, 'road, sidewalk and building boundaries remain stable');
  const shops = context => vm.runInContext('JSON.stringify(SHOP.map(sh => sh ? [sh.word,sh.kind] : null))', context);
  const newShops = ev('JSON.stringify(SHOP.map(sh => sh ? [sh.word,sh.kind] : null))');
  assert.equal(newShops, shops(baseline), 'saved apartment cells and shops keep their identities');
  assert.ok(ev(`ARCH_BUILDINGS.filter(b=>b.access).every(b=>{
    for(let y=b.y0;y<b.y1;y++) for(let x=b.x0;x<b.x1;x++) if(SHOP[idx(x,y)]===b.sh && map[idx(x,y)]!==b.h) return false;
    return !b.crown;
  })`), 'public roof surfaces stay flat');
  assert.doesNotThrow(() => ev('JSON.stringify(SHOP.filter(Boolean))'), 'no cyclic shop metadata');
});

test('downtown has distinct real setbacks and rooftop clutter follows the new surfaces', () => {
  const { ev } = loadCity();
  const forms = JSON.parse(ev(`JSON.stringify([...new Set(ARCH_BUILDINGS.filter(b=>b.region==='downtown'&&!b.access).map(b=>b.form))])`));
  assert.ok(forms.length >= 3, JSON.stringify(forms));
  assert.ok(ev(`ARCH_BUILDINGS.filter(b=>b.region==='downtown'&&!b.access).every(b=>{
    const heights=new Set();
    for(let y=b.y0;y<b.y1;y++) for(let x=b.x0;x<b.x1;x++) if(SHOP[idx(x,y)]===b.sh) heights.add(map[idx(x,y)]);
    return heights.size>1 && Math.max(...heights)===b.h && Math.min(...heights)>0;
  })`), 'setbacks change the map, not just the facade texture');
  assert.ok(ev('roofs.filter(o=>SHOP[idx(Math.floor(o.x),Math.floor(o.y))]?.architecture).every(o=>Math.abs(o.z-Math.max(map[idx(Math.floor(o.x),Math.floor(o.y))],architectureRoofHeight(o.x,o.y)))<1e-6)'));
});

test('brownstone stairs raise the ground, leave the doorway walkable and stop rotated cars', () => {
  const { ev } = loadCity();
  ev("var step=ARCH_STEPS.find(o=>o.z1===0.024), rail=ARCH_BLOCKERS.find(o=>o.kind==='rail')");
  assert.ok(ev('architectureGroundHeight(step.x,step.y)>0'));
  assert.equal(ev('architectureBlocked(step.x,step.y)'), false, 'walk onto the steps');
  assert.equal(ev('architectureCarClear(step.x,step.y,Math.SQRT1_2,Math.SQRT1_2,0.015,0.015)'), false);
  assert.equal(ev('architectureBlocked(rail.x,rail.y)'), true, 'walk around the stair railing');
  assert.equal(ev('architectureGroundHeight(step.x+N,step.y-N)'), ev('architectureGroundHeight(step.x,step.y)'), 'torus copies agree');
  ev('map[step.ownerCell]=0');
  assert.equal(ev('architectureGroundHeight(step.x,step.y)'), 0, 'removed buildings do not leave floating steps');
});

test('sloping tower crowns agree with roof and police height queries', () => {
  const { ev } = loadCity();
  ev('var crown=ARCH_BUILDINGS.find(b=>b.crown).crown');
  assert.ok(Math.abs(ev('architectureRoofHeight(crown.x,crown.y)') - ev('crown.z1')) < 1e-6);
  assert.ok(Math.abs(ev('policeRoofHeight(crown.x,crown.y)') - ev('crown.z1')) < 1e-6);
  assert.ok(ev('architectureRoofHeight(crown.x+crown.hl-0.05,crown.y)>crown.z0 && architectureRoofHeight(crown.x+crown.hl-0.05,crown.y)<crown.z1'));
  assert.equal(ev('architectureRoofHeight(crown.x+crown.hl+0.01,crown.y)'), 0);
  assert.equal(ev('architectureRoofHeight(crown.x+N,crown.y-N)'), ev('architectureRoofHeight(crown.x,crown.y)'));
});

test('beveled bay corners are genuinely cut away and their angled glass faces intersect from every orientation', () => {
  const { ev } = loadCity();
  const errors = JSON.parse(ev(`JSON.stringify((() => {
    const errors=[];
    for(const o of ARCH_DETAILS.filter(o=>o.kind==='bay')) {
      const point=(u,v,z)=>[o.x+u*o.c-v*o.s,o.y+u*o.s+v*o.c,z];
      const cut=point(o.hl-0.01,o.outSign*(o.hw-0.01),o.z1+1);
      if(rayBox(...cut,0,0,-1,o)<0 || rayBeveledBay(...cut,0,0,-1,o)>=0) errors.push('uncut corner');
      for(const sign of [-1,1]) {
        const length=Math.hypot(o.bevelD,o.bevelW), nu=sign*o.bevelD/length, nv=o.outSign*o.bevelW/length;
        const u=sign*(o.hl-o.bevelW/2),v=o.outSign*(o.hw-o.bevelD/2);
        const start=point(u+nu,v+nv,(o.z0+o.z1)/2), rx=-nu*o.c+nv*o.s,ry=-nu*o.s-nv*o.c;
        const t=rayBeveledBay(...start,rx,ry,0,o);
        if(Math.abs(t-1)>1e-7 || HIT.face!==(sign>0?7:8)) errors.push('wrong bevel face');
      }
      if(errors.length>4) break;
    }
    return errors;
  })())`));
  assert.deepEqual(errors, []);
  assert.ok(ev("new Set(ARCH_DETAILS.filter(o=>o.kind==='bay').map(o=>[o.nx,o.ny].join(','))).size>=3"), 'the intersection covers rotated and reversed facades');
});

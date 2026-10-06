'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');
const { ev } = loadCity();

test('glasshouse roof surfaces match their geometry and police height queries, including wrapped copies', () => {
  assert.ok(ev(`GLASSHOUSES.filter(gh=>gh.sty===18).every(gh=>{
    const roofs=PAVILION_SOLIDS.filter(o=>o.gh===gh&&o.walkRoof);
    return roofs.length && roofs.every(o=>{
      const height=pavilionRoofHeight(o.x,o.y);
      return height>=o.z1-1e-6 && policeRoofHeight(o.x,o.y)>=height &&
        pavilionRoofHeight(o.x+N,o.y-N)===height;
    });
  })`));
  assert.equal(ev('pavilionRoofHeight(10000.5,10000.5)'),0);
});

test('merchant window bays leave masonry at every corner and below the roof, and public apartment roofs stay flat', () => {
  assert.ok(ev(`MERCHANT_BUILDINGS.every(b=>b.faces.every(f=>{
    const half=f.spacing*.34,first=.08+f.spacing*.5,last=.08+(f.units-.5)*f.spacing;
    const windowTop=.45+(f.floors-1)*f.fh+f.fh*.78;
    return first-half>.08 && last+half<f.end-f.start-.08 && windowTop<f.height-.1;
  }))`));
  assert.ok(ev(`MERCHANT_BUILDINGS.filter(b=>b.sh.kind===SHOP_APTS||['HOTEL','MOTEL'].includes(b.sh.word)).every(b=>
    !PAVILION_SOLIDS.some(o=>o.b===b&&o.walkRoof)&&map[idx(b.x,b.y)]===b.h)`));
  assert.ok(ev(`MERCHANT_BUILDINGS.every(b=>b.faces.filter(f=>f.front).every(f=>
    PAVILION_SOLIDS.filter(o=>o.b===b&&o.f===f&&o.kind==='blade').length===1))`));
});

test('roof overhang heights remain correct on block borders and storefront details clear a standing player', () => {
  assert.ok(ev(`PAVILION_SOLIDS.filter(o=>o.b&&o.walkRoof).every(o=>{
    const x=o.x+o.hl-.005,y=o.y;
    return pavilionRoofHeight(x,y)>=landmarkSurfaceHeight(o,x,y)-1e-6;
  })`));
  assert.ok(ev('PAVILION_SOLIDS.filter(o=>o.b).every(o=>o.z0>.27)'));
  assert.ok(ev('PAVILION_SOLIDS.filter(o=>o.kind===\'blade\').every(o=>o.z1-o.z0<=.55+1e-6&&o.hw<=.085)'));
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');
const { ev } = loadCity();

test('terrain has real relief, bounded triangle slopes, and no raised ocean', () => {
  const result = ev(`(() => {
    let slope = 0, max = 0, ocean = 0;
    for (let y = 0; y < TERRAIN_N; y++) for (let x = 0; x < TERRAIN_N; x++) {
      const a = terrainVertex(x,y), b = terrainVertex(x+1,y), c = terrainVertex(x,y+1), d = terrainVertex(x+1,y+1);
      max = Math.max(max,a);
      slope = Math.max(slope,Math.hypot(b-a,d-b)*TERRAIN_SCALE,Math.hypot(d-c,c-a)*TERRAIN_SCALE);
      for (const [u,v] of [[.2,.7],[.8,.1]]) {
        const wx=(x+u)/TERRAIN_SCALE,wy=(y+v)/TERRAIN_SCALE;
        if (seaAt(wx,wy)) ocean=Math.max(ocean,terrainHeight(wx,wy));
      }
    }
    return {max,slope,ocean};
  })()`);
  assert.ok(result.max > .2, JSON.stringify(result));
  assert.ok(result.slope <= ev('TERRAIN_GRADE') + 1e-6, JSON.stringify(result));
  assert.equal(result.ocean, 0);
});

test('roads, shop entrances, furniture and the lighthouse approach remain level', () => {
  const raised = ev(`(() => {
    const bad=[];
    for (let y=0;y<N;y++) for(let x=0;x<N;x++) if(ROAD[idx(x,y)]||map[idx(x,y)]) {
      if(terrainHeight(x+.1,y+.1)||terrainHeight(x+.9,y+.9))bad.push(['lot',x,y]);
    }
    for(const o of [...benches,...lamps,...extras,...ANGLERS,...solids.filter(s=>s.z0<=0)])
      if(terrainHeight(o.x,o.y)>.00001)bad.push(['prop',o.x,o.y]);
    for(let t=0;t<=1;t+=.02) {
      const x=FOOTBRIDGE.x+(LIGHTHOUSE.x-FOOTBRIDGE.x)*t,y=FOOTBRIDGE.y1+(LIGHTHOUSE.y-FOOTBRIDGE.y1)*t;
      if(terrainHeight(x,y)>.001)bad.push(['path',x,y]);
    }
    return JSON.stringify(bad.slice(0,10));
  })()`);
  assert.deepEqual(JSON.parse(raised), []);
});

test('terrain height is the same plane on both sides of every shared edge', () => {
  const error = ev(`(() => {
    let error=0;
    for(let y=0;y<TERRAIN_N;y++)for(let x=0;x<TERRAIN_N;x++){
      if(!terrainVertex(x,y))continue;
      const wx=x/TERRAIN_SCALE,wy=y/TERRAIN_SCALE;
      for(const [dx,dy]of[[1e-7,0],[0,1e-7],[1e-7,1e-7]])
        error=Math.max(error,Math.abs(terrainHeight(wx-dx,wy-dy)-terrainHeight(wx+dx,wy+dy)));
    }
    return error;
  })()`);
  assert.ok(error < 1e-6, String(error));
});

test('aircraft hit terrain and shoreline landings do not step onto a high ledge', () => {
  assert.ok(ev('terrainHeight(132,235)') > .15);
  assert.equal(ev('builtHeight(132,235,0)'), ev('terrainHeight(132,235)'));
  assert.equal(ev('dryLand(132,235)'), false);
  assert.equal(ev('terrainHeight((RUNWAY.x0+RUNWAY.x1)/2,RUNWAY.y)'), 0);
  assert.equal(ev('onFootbridge(FAIR.cx,FAIR.y1)'), false);
  assert.ok(ev('Math.abs(FOOTBRIDGE.x-FAIR.cx)>FAIR.x1-FAIR.x0'));
});

test('shots hit a hillside and the fishing rod starts above raised ground', () => {
  const hit = ev('traceShot(132,238.1,.05,0,-1,0)');
  assert.equal(hit.what, 'ground');
  assert.ok(hit.d > 0 && hit.d < 4, JSON.stringify(hit));
  assert.ok(Math.abs(hit.z - ev(`terrainHeight(${hit.x},${hit.y})`)) < 1e-5);
  const cast = ev(`(() => {
    mode='walk';px=132;py=235;a=Math.PI/2;
    fishing={st:'wind',t:0,power:.2,rod:'rod'};castLine();
    return {z:fishing.oz,ground:outdoorGroundHeight(px,py),tip:ROD_Z};
  })()`);
  assert.ok(cast.ground > .15);
  assert.ok(Math.abs(cast.z - cast.ground - cast.tip) < 1e-9);
});

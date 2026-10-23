'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { loadCity } = require('./helpers/load-city.cjs');

test('side-on sunrise and sunset discs stay bounded even beyond integer precision',()=>{
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/core.js'),'utf8'),ctx);
  const source=fs.readFileSync(path.join(__dirname,'../city/city-render.js'),'utf8');
  const disc=source.slice(source.indexOf('function disc('),source.indexOf('// lightning:'));
  vm.runInContext(`let cols=64,rows=48,cw=8,projX=32,projY=24,hor=24,a=0,overcast=0;
    FOV=Math.PI/2;
    const ZB=new Float64Array(cols*rows).fill(Infinity),BG=new Uint8Array(cols*rows);let painted=0;
    const set=(i)=>{if(i<0||i>=cols*rows)throw Error('off-screen write');painted++;};
    ${disc}
    for(const az of [-Math.PI/2,Math.PI/2,-Math.PI/2+1e-15,Math.PI/2-1e-15,0,Math.PI/4])disc(az,0,15,11,2.2,false);
    if(!painted||painted>cols*rows)throw Error('invalid visible disc');`,ctx,{timeout:250});
});

test('column clipping preserves all visible depths, faces and texture coordinates', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../city/core.js'), 'utf8'), ctx);
  vm.runInContext(`let mode='walk',room=null,cols=64,rows=48,dx=1,dy=0,tf=.7,projX=cols/2/tf,projY=26,hor=24,eye=.5,vis=40,amb=1;
    const ZB=new Float64Array(cols*rows),ZBG=new Float64Array(cols*rows),BG=new Uint8Array(cols*rows),FL=new Uint8Array(cols*rows);`, ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../city/render.js'), 'utf8'), ctx);
  const result = vm.runInContext(`(() => {
    let seed=17,errors=0,painted=0;
    const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    for(let n=0;n<400;n++) {
      const angle=random()*Math.PI*2,yaw=random()*Math.PI*2;
      dx=Math.cos(yaw);dy=Math.sin(yaw);eye=random()*4;
      const b={x:random()*10-5,y:random()*10-5,c:Math.cos(angle),s:Math.sin(angle),hl:.1+random()*3,hw:.1+random()*2,z0:-1,z1:random()*4};
      if(n===0) {
        dx=1;dy=0;
        Object.assign(b,{x:.02,y:0,c:1,s:0,hl:.1,hw:.5,z0:eye+.005,z1:eye+.02});
      }
      const draw=intersect=>{
        ZB.fill(Infinity);ZBG.fill(20);BG.fill(NONE);FL.fill(1);
        const hits=[];
        drawBox(b,(i,t)=>{hits.push([i,t,HIT.face,HIT.u,HIT.v,HIT.w]);return true;},intersect);
        return hits;
      };
      const fast=draw(rayBox),reference=draw((...args)=>rayBox(...args));
      if(JSON.stringify(fast)!==JSON.stringify(reference))errors++;
      painted+=fast.length;
    }
    return {errors,painted};
  })()`, ctx);
  assert.equal(result.errors, 0, JSON.stringify(result));
  assert.ok(result.painted > 1000, JSON.stringify(result));
});

test('packed terrain planes preserve exact slopes and lighting across copies and rebuilds', () => {
  const { ev } = loadCity();
  const result = ev(`(() => {
    let errors=0,raised=0;
    function check(x,y) {
      const a=terrainVertex(x,y),b=terrainVertex(x+1,y),c=terrainVertex(x,y+1),d=terrainVertex(x+1,y+1);
      const at=terrainPatch(x,y),values=terrainPatchData;
      if(at<0) { if(Math.max(a,b,c,d)>.00001)errors++; return; }
      const sx0=(b-a)*2,sy0=(d-b)*2,sx1=(d-c)*2,sy1=(c-a)*2;
      const light=(sx,sy)=>clamp((.85-sx*.9+sy*.6)/Math.sqrt(1+sx*sx+sy*sy),.5,1.2);
      const expected=[a,sx0,sy0,sx1,sy1,light(sx0,sy0),light(sx1,sy1),Math.max(a,b,c,d)>.00001?1:0];
      if(expected.some((v,i)=>v!==values[at+i]))errors++;
      if(values[at+7])raised++;
    }
    for(let y=0;y<TERRAIN_N;y+=3)for(let x=0;x<TERRAIN_N;x+=3) {
      check(x,y);check(x+TERRAIN_N,y-TERRAIN_N);
    }
    const before=terrainPatchData;buildTerrain();
    const rebuilt=terrainPatchData!==before;
    check(264,470);
    const cells=terrainCells.reduce((n,v)=>n+(v?1:0),0);
    return {errors,raised,rebuilt,packed:terrainPatchData.length===cells*4*8,indexed:terrainPatchIndex.length===terrainCells.length};
  })()`);
  assert.equal(result.errors, 0);
  assert.ok(result.raised > 100);
  for (const key of ['rebuilt','packed','indexed']) assert.equal(result[key], true, key);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

test('Belle roofs bridge enclosed middle gaps while retaining street recesses and sheltering the ground below', () => {
  for (const seed of [1, 17, 91]) {
    const { ev } = loadCity(seed);
    const result = JSON.parse(ev(`JSON.stringify((() => {
      let covered=0, open=0; const errors=[];
      for (const b of BELLE_BUILDINGS) {
        for (let y=b.y0;y<b.y1;y++) for (let x=b.x0;x<b.x1;x++) {
          const k=idx(x,y), h=belleRoofHeight(x+.5,y+.5);
          if (b.access) { if(h!==0 || map[k]!==b.h)errors.push('public roof changed'); continue; }
          if (SHOP[k]===b.sh || map[k]) continue;
          if (BELLE_ROOF_INFILL[k]) {
            covered++;
            if(h<=b.h || !BELLE_ROOF_CELLS[k] || snowExposed(x+.5,y+.5,0))errors.push('uncovered middle gap');
          } else {
            open++;
            if(h!==0)errors.push('street recess filled');
          }
        }
      }
      return {covered,open,errors};
    })())`));
    assert.ok(result.covered > 20 && result.open > 20, JSON.stringify(result));
    assert.deepEqual(result.errors, [], `seed ${seed}: ${JSON.stringify(result)}`);
  }
});

test('Belle signs and trim fit continuous exposed faces around cut corners and recessed courts', () => {
  for (const seed of [1, 17, 91]) {
    const { ev } = loadCity(seed);
    const result = JSON.parse(ev(`JSON.stringify((() => {
      let signs=0, shortFaces=0, cutLots=0; const errors=[];
      for (const b of BELLE_BUILDINGS) {
        if (!b.access) cutLots++;
        for (const f of b.faces) {
          if (f.end-f.start<=2) shortFaces++;
          for (let along=f.start+.5;along<f.end;along++) {
            const x=(f.side?along:f.line)-f.nx*.1,y=(f.side?f.line:along)-f.ny*.1,k=idx(x,y);
            if (SHOP[k]!==b.sh || map[k]!==f.height || map[idx(x+f.nx,y+f.ny)]!==f.low || BELLE_FACES[f.dir][k]!==f) errors.push('hidden wall in face');
          }
          if (f.sign) {
            signs++;
            const half=(b.sh.word.length/2+1)*f.sign.letterW;
            if (f.sign.center-half<f.start+.15-1e-8 || f.sign.center+half>f.end-.15+1e-8 || f.low) errors.push('sign exceeds exposed face');
          }
        }
        if (!b.faces.some(f=>f.sign)) errors.push('shop without sign');
        if (b.access && b.faces.some(f=>f.height!==b.h)) errors.push('public roof height changed');
      }
      return {signs,shortFaces,cutLots,errors};
    })())`));
    assert.deepEqual(result.errors, [], `seed ${seed}: ${JSON.stringify(result)}`);
    assert.ok(result.signs > 50 && result.shortFaces > 50 && result.cutLots > 20, JSON.stringify(result));
  }
});

test('Belle paired-globe geometry follows the curb and clears buildings with the actual rendered parts', () => {
  const { ev } = loadCity();
  assert.equal(ev(`lamps.filter(l=>districtAt(l.x,l.y)==='belle').every(l=>{
    const parts=belleLampParts(l.x,l.y,l.ax,l.ay),globes=parts.filter(o=>o.kind==='globe');
    return globes.length===2 && parts.every(o=>!streetGeometryCollision(o))
      && Math.abs((globes[1].x-globes[0].x)*l.ax+(globes[1].y-globes[0].y)*l.ay)<1e-8
      && Math.abs(Math.hypot(globes[1].x-globes[0].x,globes[1].y-globes[0].y)-.22)<1e-8;
  })`), true);
  assert.ok(ev("lamps.filter(l=>districtAt(l.x,l.y)==='belle').length>50"));
});

test('removing neighboring buildings resolves newly exposed Belle faces without missing render metadata', () => {
  const { ev } = loadCity();
  const result = JSON.parse(ev(`JSON.stringify((() => {
    for(let y=70;y<77;y++)for(let x=38;x<46;x++)map[idx(x,y)]=0;
    let missing=0;const errors=[];
    for(let k=0;k<map.length;k++)if(map[k]&&STY[k]===24)for(let dir=0;dir<4;dir++) {
      const [nx,ny]=ARCH_DIRECTIONS[dir],x=k%N,y=Math.floor(k/N);
      if(map[idx(x+nx,y+ny)]>=map[k] || BELLE_FACES[dir][k])continue;
      missing++;const f=belleFaceAt(x,y,dir);
      if(f.low!==0 || f.end-f.start<1 || belleFaceAt(x+N,y-N,dir)!==f)errors.push('invalid resolved face');
      for(let along=f.start+.5;along<f.end;along++) {
        const xx=(f.side?along:f.line)-f.nx*.1,yy=(f.side?f.line:along)-f.ny*.1;
        if(SHOP[idx(xx,yy)]!==SHOP[k] || map[idx(xx,yy)]!==f.height || map[idx(xx+nx,yy+ny)]!==f.low)errors.push('discontinuous resolved face');
      }
    }
    return {missing,errors};
  })())`));
  assert.ok(result.missing>0,'the cleared test arena exposes previously hidden Belle walls');
  assert.deepEqual(result.errors,[]);
});

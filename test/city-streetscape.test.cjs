'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity();

test('street fixtures clear every new building family and retain their spatial and lighting indices',()=>{
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    const groups=[[lamps,lampsB,'lamp'],[lights,lightsB,'signal'],[machines,machinesB,'machine'],[benches,benchesB,'bench'],[trees,treesB,'tree'],[subwayBlades,bucketed(subwayBlades),'blade'],[elStairs,bucketed(elStairs),'el-stairs']];
    const clear=groups.every(([items,,kind])=>items.every(o=>streetFixtureClear(o,kind)));
    const indexed=groups.every(([items,buckets])=>buckets.flat().length===items.length&&items.every(o=>buckets[bi(Math.floor(o.x/8),Math.floor(o.y/8))].includes(o)));
    return {clear,indexed,lit:lamps.every(l=>glow(l.gx,l.gy)>.99),report:STREET_CLEARANCE};
  })())`));
  assert.equal(result.clear,true);
  assert.equal(result.indexed,true);
  assert.equal(result.lit,true,'ground light follows the fitted lamps');
  assert.ok(result.report.moved.lamp>0&&result.report.moved.signal>0&&result.report.moved.machine>0);
  assert.ok(result.report.moved.blade>0&&result.report.moved['el-stairs']>0,'fixed subway entries and el stairs receive clearance too');
  assert.ok(result.report.conflicts.awning>0&&result.report.conflicts['balcony-slab']>0,'the audit finds projecting awnings and balconies');
  assert.ok(ev("['awning','balcony-slab','escape-rail','bay'].every(kind=>STREET_GEOMETRY.some(o=>o.kind===kind))"),'the clearance index includes all building families');
  assert.ok(Object.values(result.report.removed).every(n=>n===0),'fixtures fit without disappearing');
});

test('lamps fit below the Shotengai roof while full-height lamps remain below the elevated deck',()=>{
  assert.ok(ev('lamps.some(l=>arcadeAt(l.x,l.y))'));
  assert.equal(ev('lamps.filter(l=>arcadeAt(l.x,l.y)).every(l=>l.top+NECK+.008<ARCADE_Z)'),true);
  assert.equal(ev('lamps.filter(l=>underEl(l.y)&&!arcadeAt(l.x,l.y)).every(l=>l.top+NECK+.008<EL_BOT)'),true);
  assert.equal(ev('lamps.some(l=>l.top===LAMP_TOP)'),true);
});

test('snow distinguishes sheltered ground and lower balconies from their exposed upper surfaces',()=>{
  assert.equal(ev('snowExposed(41,EL_Y+1,0)'),false);
  assert.equal(ev('snowExposed(41,EL_Y+1,EL_TOP+.05)'),true);
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    const awning=PAVILION_SOLIDS.find(o=>o.kind==='awning'&&!underEl(o.y));
    const exposed=ARCH_DETAILS.find(o=>o.kind==='balcony-slab'&&snowExposed(o.x,o.y,o.z1));
    const covered=ARCH_DETAILS.find(o=>o.kind==='balcony-slab'&&!snowExposed(o.x,o.y,o.z1));
    return {underAwning:!snowExposed(awning.x,awning.y,0),awningTop:snowExposed(awning.x,awning.y,awning.z1),exposed:!!exposed,covered:!!covered};
  })())`));
  assert.deepEqual(result,{underAwning:true,awningTop:true,exposed:true,covered:true});
});

test('cached ground shelters agree with full geometry at rotated shapes, edges and removed owners',()=>{
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    let tested=0,errors=0;
    const roofs=belleBuildingsB.flat().flatMap(b=>b.roofParts);
    const check=(x,y)=>{
      const cell=idx(Math.floor(x),Math.floor(y)),cx=cell%N+.5,cy=Math.floor(cell/N)+.5;
      // New roof canopies cover empty cells; compare their full rendered rectangles with the cached cell lookup.
      const canopy=!map[cell]&&roofs.some(r=>Math.abs(rel(cx-r.x))<r.hl&&Math.abs(rel(cy-r.y))<r.hw);
      const sheltered=underEl(y)||arcadeAt(x,y)||canopy,overhead=streetGeometryCells[cell];
      const expected=!sheltered&&geometrySnowExposed(x,y,0,overhead);
      if(snowExposed(x,y)!==expected)errors++;
      tested++;
    };
    for(let n=0;n<STREET_GEOMETRY.length;n+=5) {
      const o=STREET_GEOMETRY[n],[ex,ey]=geometryBounds(o);
      for(const offset of [-1e-7,0,1e-7]) {
        check(o.x-ex+offset,o.y);check(o.x+ex+offset,o.y);
        check(o.x,o.y-ey+offset);check(o.x,o.y+ey+offset);
      }
      check(o.x+N,o.y-N);
    }
    const slab=ARCH_DETAILS.find(o=>o.kind==='balcony-slab'),h=map[slab.ownerCell];
    check(slab.x,slab.y);map[slab.ownerCell]=0;check(slab.x,slab.y);map[slab.ownerCell]=h;
    return{tested,errors};
  })())`));
  assert.ok(result.tested>100000);
  assert.equal(result.errors,0,JSON.stringify(result));
});

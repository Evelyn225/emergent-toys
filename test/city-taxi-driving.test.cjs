'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

function street(dt = .05, vertical = false, seam = false, rush = false) {
  const { ev } = loadCity();
  ev(`cars.length=people.length=footCops.length=0;evTimer=1000;mode='taxi';T=10;
    var tick=${dt}, vertical=${vertical}, seam=${seam}, rush=${rush};
    var start=seam?N-2:34, lane=72.6;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){map[idx(x,y)]=0;ROAD[idx(x,y)]=1;}
    var cab=addCar({x:vertical?lane:start,y:vertical?start:lane,hx:vertical?0:1,hy:vertical?1:0,
      body:TAXI,cruise:1.2,v:1.2,rider:true,fare:0,rush,dest:vertical?[lane,mod(start+25,N)]:[mod(start+25,N),lane]});
    px=cab.x;py=cab.y;cab.nh=[cab.hx,cab.hy];cab.B=start+6;cab.left=8;
    var obstacle=addCar({x:vertical?lane:mod(start+2,N),y:vertical?mod(start+2,N):lane,hx:cab.hx,hy:cab.hy,parked:!rush,v:rush?.3:0,cruise:.3});`);
  return ev;
}

test('taxi passes curve gently around parked and slow cars, clear both bodies, and merge after passing', () => {
  for (const [dt, vertical, seam, rush] of [[.05,false,false,false],[1/60,true,false,false],[.05,false,true,false],[.05,false,false,true]]) {
    const ev = street(dt, vertical, seam, rush);
    const r = JSON.parse(ev(`JSON.stringify((()=>{
      let overlap=false,maxShift=0,maxYaw=0,held=true,out=0;
      for(let k=0;k<Math.ceil((rush?5.5:4.5)/tick);k++){
        const old=cab.off;stepTraffic(tick,T+=tick,true);
        maxShift=Math.max(maxShift,Math.abs(cab.off-old)/tick);
        const yaw=carYaw(cab);maxYaw=Math.max(maxYaw,Math.abs(mod(yaw-Math.atan2(cab.hy,cab.hx)+Math.PI,Math.PI*2)-Math.PI));
        overlap ||= !!carContact({...cab,hx:Math.cos(yaw),hy:Math.sin(yaw)},obstacle);
        const al=rel(obstacle.ex-cab.x)*cab.hx+rel(obstacle.ey-cab.y)*cab.hy;
        if(Math.abs(al)<.4)held &&= cab.off<-.3;
        out=Math.min(out,cab.off);
      }
      return {overlap,maxShift,maxYaw,held,out,off:cab.off,passed:rel(cab.x-obstacle.ex)*cab.hx+rel(cab.y-obstacle.ey)*cab.hy};
    })())`));
    assert.equal(r.overlap,false,JSON.stringify(r));
    assert.ok(r.maxShift<=.40001 && r.maxYaw>.1 && r.maxYaw<.6,JSON.stringify(r));
    assert.ok(r.held && r.out<-.35 && r.passed>3 && Math.abs(r.off)<.08,JSON.stringify(r));
  }
});

test('rushing taxis wait when an approaching car would meet them during the pass', () => {
  const ev = street();
  ev(`cab.rush=true;obstacle.parked=false;obstacle.v=.3;obstacle.cruise=.3;
    var coming=addCar({x:45,y:73.4,hx:-1,hy:0,v:1.2,cruise:1.2});
    cab.near=[obstacle,coming];`);
  assert.equal(ev('taxiLaneTarget(cab,6)'),0);
  assert.equal(ev('cab.pass'),undefined);
  ev('cars.splice(cars.indexOf(coming),1);cab.near=[obstacle]');
  ev('taxiLaneTarget(cab,6)');
  assert.equal(ev('cab.pass.car === obstacle && cab.pass.offset === -.8'),true);
  ev('cab.x=obstacle.ex+.4');
  assert.equal(ev('taxiLaneTarget(cab,4)'),-.8,'holds the passing lane until both bumpers have cleared');
});

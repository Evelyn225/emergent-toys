'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
async function withCity(fn) {
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'../../ascii-city.html')).href);
    await page.waitForFunction(()=>typeof courierUse==='function'&&Number.isFinite(eye));
    await page.evaluate(()=>{paused=true;clearWanted();cars.length=people.length=footCops.length=0;actx=null;});
    await fn(page);assert.deepEqual(errors,[]);
  } finally {await browser.close();}
}

test('enter the depot, take a parcel, walk every safe crossing, and deliver once',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    mode='walk';room=null;[px,py]=COURIER_DEPOT.door;a=0;pitch=0;render();interact();
    const entered=room?.kind;
    px=10.3;py=4.9;interact();const accepted=courierJob?.id;
    px=4;py=1.5;interact();const stairs={mode,x:px,y:py};
    needs.health=100;
    const points=[[179.5,106.5],[182.4,107.35],[183.5,107.35],[186.5,107.35],[188.2,106.85],
      [189.4,106.85],[190.3,106.85],[190.8,107.4],[191.4,107.4],[191.4,106.85],[191.4,102.35],
      [194.35,102.4],[195.4,102.4],[196.4,102.4],[197.5,102.4],[198.5,102.4],[199,102.1]];
    const legs=[];
    for(const [x,y] of points) {
      let n=0;while(near(px,py,x,y)>.01&&n++<800) {
        a=Math.atan2(y-py,x-px);const step=Math.min(.01,near(px,py,x,y));
        body.mx=Math.cos(a)*.5;body.my=Math.sin(a)*.5;
        move(Math.cos(a)*step,Math.sin(a)*step);stepBody(.02);stepRoof();stepCourier(.02);T+=.02;
        if(mode!=='roof')break;
      }
      legs.push({reached:near(px,py,x,y)<.011,mode,health:needs.health});
      if(mode!=='roof'||n>=800)break;
    }
    render();hud();const prompt=promptText(),before=money;
    interact();const paid=money-before;interact();
    return {entered,accepted,stairs,legs,prompt,paid,twice:money-before,active:courierJob,
      saved:JSON.parse(localStorage.getItem(SAVE_KEY)).courier,map:bigMapLabels().some(p=>p[2]===COURIER_COMPANY)};
  });
  assert.equal(r.entered,'courier');assert.equal(r.accepted,'garden');assert.equal(r.stairs.mode,'roof');
  assert.equal(r.stairs.x,179.5);assert.equal(r.stairs.y,102.5);assert.equal(r.legs.length,17,JSON.stringify(r.legs));
  for(const leg of r.legs)assert.deepEqual(leg,{reached:true,mode:'roof',health:100});
  assert.match(r.prompt,/deliver/);assert.equal(r.paid,120);assert.equal(r.twice,120);assert.equal(r.active,null);
  assert.equal(r.saved.records.trips,1);assert.equal(r.saved.job,null);assert.equal(r.map,true);
}));

test('both optional courier gaps are reachable with an ordinary sprint jump',()=>withCity(async page=>{
  const r=await page.evaluate(()=>[[184.68,108.52,185.5],[192.88,101.27,193.65]].map(([x,y,end])=>{
    mode='roof';room=null;px=x;py=y;a=0;roofH=roofHeightAt(px,py);roofLot=new Set();needs.health=100;
    body.z=body.vz=body.peak=0;body.hop=1;body.groundMode=null;body.mx=.8;body.my=0;jump();
    let n=0,minHeight=Infinity;
    while(px<end&&n++<200){T+=.01;move(.008,0);stepBody(.01);stepRoof();minHeight=Math.min(minHeight,mode==='roof'?roofH+body.z/10:body.z/10);}
    for(let k=0;k<150;k++){T+=.01;stepBody(.01);stepRoof();}
    return {reached:px>=end,mode,z:body.z,health:needs.health,minHeight};
  }));
  for(const jump of r){assert.equal(jump.reached,true,JSON.stringify(r));assert.equal(jump.mode,'roof',JSON.stringify(r));assert.equal(jump.z,0);assert.ok(jump.health>90);assert.ok(jump.minHeight>1.3);}
}));

test('courier stairs, bridges and their supports clear existing walls and facade details',()=>withCity(async page=>{
  const conflicts=await page.evaluate(()=>{
    const conflicts=[],fixtures=[...ARCH_DETAILS,...LANDMARK_SOLIDS,...PAVILION_SOLIDS,...belleDetails,...solids];
    function verticalInterval(o,x,y) {
      const rx=rel(x-o.x),ry=rel(y-o.y),u=rx*o.c+ry*o.s,v=-rx*o.s+ry*o.c;
      if(Math.abs(u)>o.hl+1e-9||Math.abs(v)>o.hw+1e-9)return null;
      let bottom=o.z0,top=o.z1;
      for(const [nx,ny,nz,limit] of o.planes||[]) {
        const distance=limit-nx*u-ny*v;
        if(!nz){if(distance< -1e-9)return null;}
        else if(nz>0)top=Math.min(top,distance/nz);
        else bottom=Math.max(bottom,distance/nz);
      }
      return top>=bottom?[bottom,top]:null;
    }
    const structure=[...COURIER_SURFACES,...COURIER_SCENERY.filter(o=>['post','rail','beam','bearing','stringer'].includes(o.kind))];
    for(const deck of structure) {
      const nearby=fixtures.filter(o=>streetBoxesOverlap(deck,o,0)&&!(o.ownerCell!=null&&map[o.ownerCell]!==o.ownerHeight));
      const samplesX=Math.max(2,Math.ceil(deck.hl*2/.025)),samplesY=Math.max(2,Math.ceil(deck.hw*2/.025));
      for(let ix=0;ix<=samplesX;ix++)for(let iy=0;iy<=samplesY;iy++) {
        const x=deck.x-deck.hl+deck.hl*2*ix/samplesX,y=deck.y-deck.hw+deck.hw*2*iy/samplesY;
        const d=verticalInterval(deck,x,y);if(!d||d[1]-d[0]<1e-6)continue;
        if(courierMapHeight(x,y)>d[0]+1e-6)conflicts.push({kind:'wall',deck:deck.kind,x,y});
        for(const o of nearby) {
          const f=verticalInterval(o,x,y);
          if(f&&Math.min(d[1],f[1])>Math.max(d[0],f[0])+1e-6)conflicts.push({kind:o.kind,deck:deck.kind,x,y});
        }
      }
    }
    return conflicts;
  });
  assert.deepEqual(conflicts,[]);
}));

test('the first route uses existing building entrances for recovery without redundant ladders',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    startCourier();needs.health=100;
    const ladders=COURIER_LADDERS.length,recovery=[];
    // A surviving fall keeps the parcel, and each building can get you back to the route.
    mode='walk';room=null;px=177.72;py=102.5;body.z=2.7;body.vz=0;body.peak=body.z;
    for(let n=0;n<200;n++)stepBody(.01);
    const survived={active:!!courierJob,health:needs.health,z:body.z};
    for(const [x,y,yaw,kind] of [[177.72,102.5,0,'courier'],[183.8,105.7,Math.PI/2,'apts'],[199.4,104.28,-Math.PI/2,'apts']]) {
      mode='walk';room=null;px=x;py=y;a=yaw;pitch=0;body.z=body.vz=body.peak=0;render();interact();
      const entered=room?.kind;
      if(entered!==kind){recovery.push({entered});continue;}
      px=room.def.ex;py=1.7;interact();
      const up={mode,free:roofFree(px,py),active:!!courierJob};
      interact();const down={mode,kind:room?.kind};
      recovery.push({entered,up,down});
    }
    return {ladders,recovery,survived};
  });
  assert.equal(r.ladders,0);assert.equal(r.recovery.length,3);
  assert.deepEqual(r.survived,{active:true,health:100,z:0});
  for(const [i,entry] of r.recovery.entries()) {
    const kind=i===0?'courier':'apts';
    assert.deepEqual(entry,{entered:kind,up:{mode:'roof',free:true,active:true},down:{mode:'room',kind}});
  }
}));

test('the ladder mechanic remains usable for future roofs without indoor access',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    courierLadder('test-only',[177.75,103.45,0],[178.35,103.45,COURIER_DEPOT.h],[177.97,103.45,0]);
    startCourier();const ladders=[];
    for(const ladder of COURIER_LADDERS) {
      mode='walk';room=null;[px,py]=ladder.bottom;body.z=body.vz=body.peak=0;
      const available=!!courierLadderNear();interact();const grabbed=mode;
      K.KeyW=true;for(let n=0;n<150&&climbing;n++){stepCourierLadder(.05);stepBody(.05);}K.KeyW=false;
      const up={mode,x:px,y:py,h:roofH,free:roofFree(px,py)};
      interact();K.KeyS=true;for(let n=0;n<150&&climbing;n++)stepCourierLadder(.05);K.KeyS=false;
      ladders.push({available,grabbed,up,down:mode,active:!!courierJob});
    }
    const l=COURIER_LADDERS[0];grabCourierLadder({ladder:l,end:'bottom'});K.KeyW=true;stepCourierLadder(1);K.KeyW=false;
    leaveCourierLadder();const released={mode,z:body.z};needs.health=100;
    for(let n=0;n<200;n++)stepBody(.01);
    const survived={active:!!courierJob,health:needs.health,z:body.z};
    return {ladders,released,survived};
  });
  assert.equal(r.ladders.length,1);
  for(const l of r.ladders){assert.ok(l.available);assert.equal(l.grabbed,'ladder');assert.equal(l.up.mode,'roof');assert.equal(l.up.free,true);assert.equal(l.down,'walk');assert.equal(l.active,true);}
  assert.equal(r.released.mode,'walk');assert.ok(r.released.z>0);assert.equal(r.survived.active,true);assert.ok(r.survived.health>0);assert.equal(r.survived.z,0);
}));

test('courier timer survives reload; hospital and arrests fail it even if the fine is paid',()=>withCity(async page=>{
  await page.evaluate(()=>{startCourier();stepCourier(111);saveGame();});
  await page.reload();await page.waitForFunction(()=>typeof failCourier==='function'&&Number.isFinite(eye));
  const r=await page.evaluate(()=>{
    paused=true;const restored={...courierJob};passOut('A bad fall.');
    const hospital={active:courierJob,kind:room.kind,saved:JSON.parse(localStorage.getItem(SAVE_KEY)).courier.job};
    wakeT=0;startCourier();mode='walk';room=null;wanted.stars=1;money=500;openBusted();
    const confiscated=bustedEl.textContent.includes('parcel has been confiscated');bustedChoice('fine');
    const fine={active:courierJob,failed:courierRecords.failed,stars:wanted.stars};
    courierLadder('test-only',[177.75,103.45,0],[178.35,103.45,COURIER_DEPOT.h],[177.97,103.45,0]);
    startCourier();grabCourierLadder({ladder:COURIER_LADDERS[0],end:'bottom'});stepCourierLadder(1);
    wanted.stars=1;openBusted();const caughtOnLadder={mode,climbing,active:courierJob};bustedChoice('jail');
    const jail={active:courierJob,kind:room.kind,failed:courierRecords.failed};
    return {restored,hospital,confiscated,fine,caughtOnLadder,jail};
  });
  assert.equal(r.restored.id,'garden');assert.ok(r.restored.took>=111);
  assert.deepEqual(r.hospital,{active:null,kind:'hospital',saved:null});assert.equal(r.confiscated,true);
  assert.deepEqual(r.fine,{active:null,failed:2,stars:0});assert.deepEqual(r.caughtOnLadder,{mode:'walk',climbing:null,active:null});
  assert.deepEqual(r.jail,{active:null,kind:'jail',failed:3});
}));

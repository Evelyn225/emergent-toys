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
    await page.waitForFunction(()=>typeof stepElImpact==='function'&&Number.isFinite(eye));
    await page.evaluate(()=>{paused=true;clearWanted();cars.length=people.length=footCops.length=0;actx=null;});
    await fn(page);assert.deepEqual(errors,[]);
  } finally {await browser.close();}
}

test('jump from a roof onto the el, board at the station, and take its stairs down',()=>withCity(async page=>{
  const result=await page.evaluate(()=>{
    room=null;mode='roof';px=EL_STATIONS[0].x;py=EL_Y0-.05;roofH=1.6;roofLot=new Set();needs.health=100;
    body.z=body.vz=body.peak=0;a=Math.PI/2;jump();
    let n=0;
    while(py<EL_PLAT[0]&&n++<100){move(0,.008);stepBody(.01);stepRoof();}
    for(let i=0;i<200;i++){stepBody(.01);stepRoof();}
    render();const landed={mode,height:roofH,z:body.z,health:needs.health,eye};
    T=1;interact();const boarded=mode;elGetOff();T=15;interact();
    const stairs={mode,z:body.z,near:!!nearElStairs()};
    // A jump from the street cannot teleport up onto the deck.
    mode='walk';room=null;px=40;py=EL_TRACK[0];body.z=body.vz=body.peak=0;jump();
    for(let i=0;i<100;i++){stepBody(.01);stepRoof();}
    return {landed,boarded,stairs,street:{mode,z:body.z}};
  });
  assert.equal(result.landed.mode,'elplat');assert.equal(result.landed.height,1.27);
  assert.equal(result.landed.z,0);assert.ok(result.landed.health>90);assert.ok(Math.abs(result.landed.eye-1.44)<1e-8);
  assert.equal(result.boarded,'el');assert.deepEqual(result.stairs,{mode:'walk',z:0,near:true});
  assert.deepEqual(result.street,{mode:'walk',z:0});
}));

test('walking off the el edge falls, and stepping onto its tracks allows free movement',()=>withCity(async page=>{
  const result=await page.evaluate(()=>{
    elUp({s:EL_STATIONS[0],tr:0});
    for(let i=0;i<45;i++){move(0,.008);stepBody(.01);stepRoof();}
    const tracks={mode,height:roofH,free:free(px+.1,py)};
    py=EL_Y1+.02;stepRoof();const leaving={mode,z:body.z};
    for(let i=0;i<300;i++){stepBody(.01);stepRoof();}
    const landed={mode,z:body.z};
    elUp({s:EL_STATIONS[0],tr:0});py=EL_Y0-.02;stepRoof();
    return {tracks,leaving,landed,platformEdge:{mode,z:body.z}};
  });
  assert.deepEqual(result.tracks,{mode:'roof',height:1.27,free:true});
  assert.equal(result.leaving.mode,'walk');assert.ok(result.leaving.z>12);
  assert.equal(result.landed.z,0);
  assert.equal(result.platformEdge.mode,'walk');assert.ok(result.platformEdge.z>12);
}));

test('a moving el train hospitalises the player through the actual frame loop and fails a courier job',()=>withCity(async page=>{
  const result=await page.evaluate(()=>{
    requestAnimationFrame=()=>0;render=hud=()=>{};
    mode='roof';room=null;roofH=EL_TOP;roofLot=new Set();body.z=body.vz=body.peak=0;
    T=15;const train=elTrain(0,0,T);px=train.x;py=EL_TRACK[0];needs.health=100;money=500;
    startCourier();paused=false;t0=performance.now();loop(t0+50);paused=true;
    return {mode,kind:room?.kind,wake:wakeT,message:msgText,courier:courierJob,failed:courierRecords.failed,health:needs.health};
  });
  assert.equal(result.mode,'room');assert.equal(result.kind,'hospital');assert.ok(result.wake>0);
  assert.match(result.message,/hit by an elevated train/);assert.equal(result.courier,null);assert.equal(result.failed,1);
}));

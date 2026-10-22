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
    mode='walk';room=null;px=40+CITY_LAYOUT.cityX;py=EL_TRACK[0];body.z=body.vz=body.peak=0;jump();
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
    elUp({s:EL_STATIONS[0],tr:0});px=EL_STATIONS[0].x+2;py=EL_Y0-.02;stepRoof(); // (off the edge clear of the stairs)
    const platformEdge={mode,z:body.z};
    const st=EL_STATIONS[0].stairs[0];elUp({s:EL_STATIONS[0],tr:0});px=st.ox+st.c*(st.off+(ELS.u3+ELS.u4)/2);py=EL_Y0-.02;stepRoof(); // (off it onto the stairs' top landing)
    return {tracks,leaving,landed,platformEdge,stairsTop:{mode,z:body.z,ground:walkGround(px,py)}};
  });
  assert.deepEqual(result.tracks,{mode:'roof',height:1.27,free:true});
  assert.equal(result.leaving.mode,'walk');assert.ok(result.leaving.z>12);
  assert.equal(result.landed.z,0);
  assert.equal(result.platformEdge.mode,'walk');assert.ok(result.platformEdge.z>12);
  assert.equal(result.stairsTop.mode,'walk');assert.ok(result.stairsTop.z<0.01,'onto the top of the el stairs: no drop');assert.equal(result.stairsTop.ground,1.27);
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

test('walk beneath either stair flight without being lifted, then swipe and climb onto its platform',()=>withCity(async page=>{
  const result=await page.evaluate(()=>EL_STATIONS.flatMap(s=>s.stairs.map(st=>{
    const at=(u,v)=>[st.ox+st.c*(st.off+u)+st.ax*v,st.oy+st.s*(st.off+u)+st.ay*v],vm=(ELS.v0+ELS.v1)/2;
    mode='walk';room=null;elPass=null;elStairOn=null;body.z=body.vz=body.peak=body.crouch=0;
    [px,py]=at(.25,.44);
    let highest=0;
    for(let i=0;i<55;i++){move(-st.ax*.005,-st.ay*.005);stepBody(.01);stepRoof();highest=Math.max(highest,walkGround(px,py)-Math.max(roadGroundHeight(px,py),architectureGroundHeight(px,py)));}
    const under={mode,highest,v:st.ax*rel(px-st.ox)+st.ay*rel(py-st.oy),z:body.z};
    [px,py]=at(ELS.u0-.08,vm);elStairOn=null;elPass={st};body.z=body.vz=body.peak=0;
    for(let i=0;i<265;i++){move(st.c*.01,st.s*.01);stepBody(.01);stepRoof();}
    const top={mode,ground:walkGround(px,py)};
    for(let i=0;i<30;i++){move(st.ax*.006,st.ay*.006);stepBody(.01);stepRoof();}
    const platform=mode;
    for(let i=0;i<30;i++){move(-st.ax*.006,-st.ay*.006);stepBody(.01);stepRoof();}
    for(let i=0;i<265;i++){move(-st.c*.01,-st.s*.01);stepBody(.01);stepRoof();}
    return {under,top,platform,down:{mode,ground:elWalkGround(px,py),z:body.z,u:st.c*rel(px-st.ox)-st.off}};
  })));
  assert.equal(result.length,8);
  for(const r of result){assert.equal(r.under.mode,'walk');assert.equal(r.under.highest,0);assert.equal(r.under.z,0);assert.ok(r.under.v<.19);assert.equal(r.top.ground,1.27);assert.equal(r.platform,'elplat');assert.equal(r.down.mode,'walk');assert.equal(r.down.ground,0);assert.equal(r.down.z,0);assert.ok(r.down.u< -1.3);}
}));

test('el riders are inside a rotating 3D carriage with the moving live city visible through its windows',()=>withCity(async page=>{
  const result=await page.evaluate(()=>{
    requestAnimationFrame=()=>0;env(0);T=1;elUp({s:EL_STATIONS[0],tr:0});elBoard();
    const original=elFrame;let before,after;
    elFrame=()=>{before=Array.from(ZB);original();after=Array.from(ZB);};
    try {
      const sample=(time,angle)=>{
        T=time;px=worldCoord(elRiding().x+ride.off);a=angle;pitch=0;render(0);
        return {depth:after.slice(),world:Array.from(BG,(bg,i)=>before[i]===after[i]?bg:-1),
          interior:after.filter((z,i)=>z<before[i]).length,windows:after.filter((z,i)=>z===before[i]).length};
      };
      const first=sample(20,-Math.PI/2),next=sample(24,-Math.PI/2),aisle=sample(24,0),back=sample(24,Math.PI);
      return {mode,inside:Math.abs(py-EL_TRACK[ride.tr])<.01,eye,expectedEye:EL_TOP+.19,cells:CH.length,
        interior:first.interior,windows:first.windows,movingWindows:first.world.filter((bg,i)=>bg>=0&&next.world[i]>=0&&bg!==next.world[i]).length,
        rotated:aisle.depth.some((z,i)=>Math.abs(z-back.depth[i])>.01),validDepth:after.every(z=>z>=0&&!Number.isNaN(z))};
    }finally{elFrame=original;}
  });
  assert.equal(result.mode,'el');assert.equal(result.inside,true);assert.equal(result.eye,result.expectedEye);
  assert.ok(result.interior>result.cells*.1,'visible carriage surrounds the rider');
  assert.ok(result.windows>result.cells*.1,'window rays preserve the live world depth');
  assert.ok(result.movingWindows>20,'the real city changes as the train travels');
  assert.equal(result.rotated,true);assert.equal(result.validDepth,true);
}));

test('actual movement is stopped at station guardrails and passes through stair and boarding openings',()=>withCity(async page=>{
  const result=await page.evaluate(()=>EL_STATIONS.flatMap(s=>s.stairs.map(st=>{
    const tr=st.tr,sign=tr?1:-1,rails=elPlatformRails(s,tr),outer=rails.filter(r=>Math.abs(r[2]-r[0])>.1).sort((a,b)=>(b[2]-b[0])-(a[2]-a[0]))[0];
    elUp({s,tr});px=(outer[0]+outer[2])/2;
    for(let i=0;i<35;i++){move(0,sign*.006);stepBody(.01);stepRoof();}
    const edge={mode,inside:py>EL_Y0&&py<EL_Y1};
    elUp({s,tr});px=s.x0+.09;
    for(let i=0;i<30;i++){move(-.006,0);stepBody(.01);stepRoof();}
    const end=px>=s.x0;
    elUp({s,tr});for(let i=0;i<45;i++){move(0,-sign*.008);stepBody(.01);stepRoof();}
    const boarding=mode==='roof'&&Math.abs(py-EL_TRACK[tr])<.15;
    elUp({s,tr});px=st.ox+st.c*(st.off+(ELS.u3+ELS.u4)/2);
    for(let i=0;i<35;i++){move(0,sign*.006);stepBody(.01);stepRoof();}
    return {edge,end,boarding,stairs:mode==='walk'&&walkGround(px,py)===EL_TOP&&body.z<.01};
  })));
  for(const r of result)assert.deepEqual(r,{edge:{mode:'elplat',inside:true},end:true,boarding:true,stairs:true});
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run,phone=false) {
  const page=await browser.newPage({viewport:phone?{width:390,height:844}:{width:1280,height:720},hasTouch:phone}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;let seed=1;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(()=>{paused=false;mode='walk';room=me=null;body.z=body.vz=body.crouch=0;body.seat=null;dayNum=4;tod=12;T=10;rain=wet=snowCover=0;weather='clear';env(0);});
    await run(page);assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

test('all three street stories occupy dry finished-city sites with reachable map destinations and clear existing doors',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const places=mapDirectory().filter(p=>p.id.startsWith('street-scene:')),errors=[];
    for(const p of places) {
      if(!free(p.x,p.y)||isWater(p.x,p.y)||terrainHeight(p.x,p.y)>.005)errors.push([p.id,'blocked target']);
      if(!findMapRoute({x:p.x+2,y:p.y+2},p,MAP_WORLD))errors.push([p.id,'no route']);
    }
    const m=STREET_SCENES.moving;
    for(const door of doors.filter(d=>d.sh===m.b.sh))if(!free(door.x,door.y))errors.push(['door',door.x,door.y]);
    const r=STREET_SCENES.railway;
    return {count:places.length,errors,shop:r.b.sh.word,boxes:STREET_SCENES.boxes.length};
  });
  assert.equal(result.count,3);assert.equal(result.shop,'TOYS');assert.ok(result.boxes>15);assert.deepEqual(result.errors,[]);
}));

test('the miniature animates inside the real window with scenery parallax and foreground wall occlusion',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const s=STREET_SCENES.railway,images=[];
    const original=windowRailwayCell;
    function picture(time,offset) {
      const p=scenePoint(s,offset,.3);px=p.x;py=p.y;a=Math.atan2(s.y-py,s.x-px);pitch=.04;T=time;
      const cells=[];
      windowRailwayCell=(...args)=>{const drawn=original(...args);if(drawn)cells.push(args[0]);return drawn;};
      try{render(0);}finally{windowRailwayCell=original;}
      return {cells:cells.length,ink:cells.map(i=>[i,CH[i],COL[i],BG[i]]),train:RAILWAY_TRAIN.map(o=>[o.x,o.y]),finite:Array.from(ZB).every(d=>Number.isFinite(d)||d===Infinity)};
    }
    const first=picture(1,0),next=picture(10,0),side=picture(10,.18);
    const engine=RAILWAY_TRAIN[0];
    // The hill is in front of a train in the rear tunnel; the river deck is
    // under the raised front track, shared with the train's path height.
    let hill=false;
    const target=railwayPoint(Math.PI/2),slope=(target.z+.01-.17)/target.y;
    for(const o of RAILWAY_MODELS.filter(o=>o.kind==='hill'))if(rayBox(0,0,.17,0,1,slope,o)>0)hill=true;
    return {first,next,side,hill,pieces:RAILWAY_PIECES.length};
  });
  assert.ok(result.first.cells>500&&result.next.cells>500);assert.ok(result.first.finite&&result.next.finite&&result.side.finite);
  assert.notDeepEqual(result.first.ink,result.next.ink);assert.notDeepEqual(result.next.ink,result.side.ink);
  assert.notDeepEqual(result.first.train,result.next.train);assert.ok(result.hill);assert.ok(result.pieces>=35);
}));

test('the railway button runs an after-hours demonstration without entering or buying from the shop',()=>fixture(async page=>{
  await page.evaluate(()=>{const s=STREET_SCENES.railway,p=scenePoint(s,0,.18);px=p.x;py=p.y;a=Math.atan2(-s.ny,-s.nx);tod=23;env(0);render(0);});
  assert.match(await page.evaluate(()=>promptText()),/railway button/);
  assert.equal(await page.evaluate(()=>railwayClock().running),false);
  await page.keyboard.press('KeyE');
  const r=await page.evaluate(()=>({running:railwayClock().running,until:streetSceneState.demoUntil,now:T,mode,money,text:msgText}));
  assert.ok(r.running&&r.until>r.now+40);assert.equal(r.mode,'walk');assert.equal(r.money,100);assert.match(r.text,/Little Loop/);
}));

test('chalk appears in ordered stages, washes away in rain, persists after drying and reloads correctly',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const c=STREET_SCENES.chalk;
    function count(hour) {
      tod=hour;env(0);px=c.x;py=c.y+1.1;a=-Math.PI/2;pitch=-.2;render(0);
      let ink=0;
      for(let y=0;y<CHALK_H;y++)for(let x=0;x<CHALK_W;x++) {
        const at=y*CHALK_W+x;
        if(CHALK_INK[at]&&CHALK_ORDER[at]<=chalkProgress()&&hash(x,y,2011)>=chalkWash())ink++;
      }
      return ink;
    }
    loadStreetScenes(null);const empty=count(8),early=count(10),late=count(16);
    rain=1;stepStreetScenes(60);const washed=count(16),saved=streetSceneState.wash;
    rain=0;stepStreetScenes(1);const dry=count(16);
    saveGame();return {empty,early,late,washed,dry,saved};
  });
  assert.equal(result.empty,0);assert.ok(result.early>0&&result.late>result.early*2);assert.equal(result.washed,0);assert.equal(result.dry,0);
  await page.reload();assert.equal(await page.evaluate(()=>chalkWash()),result.saved);
  const next=await page.evaluate(()=>{dayNum++;tod=12;stepStreetScenes(.1);return {wash:chalkWash(),progress:chalkProgress()};});
  assert.equal(next.wash,0);assert.ok(next.progress>0);
}));

test('moving-day props share walking, car and shot geometry, then clear when the van leaves',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const s=STREET_SCENES.moving,o=STREET_SCENES.boxes.find(o=>o.kind==='van'),p=scenePoint(s,-.5,.24);
    px=p.x;py=p.y;a=Math.atan2(-s.ny,-s.nx);render(0);
    const loading={blocked:!free(o.x,o.y),height:builtHeight(o.x,o.y),car:carBodyClear(o.x,o.y,o.c,o.s,.1,.08)};
    const shot=traceShot(o.x+o.s*.13,o.y-o.c*.13,.15,-o.s,o.c,0);
    tod=18;render(0);const after={clear:free(o.x,o.y),height:streetSceneHeight(o.x,o.y)};
    return {loading,shot:shot.what,after,quiet:(dayNum=5,movingPhase())};
  });
  assert.ok(result.loading.blocked&&result.loading.height>=.24);assert.equal(result.loading.car,false);assert.equal(result.shot,'wall');
  assert.ok(result.after.clear);assert.equal(result.after.height,0);assert.equal(result.quiet,'quiet');
}));

test('the free lamp requires bag space, can be kept on a shelf, and cannot be taken twice after reload',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const s=STREET_SCENES.moving,p=scenePoint(s,.46,.19);px=p.x;py=p.y;tod=18;env(0);render(0);
    const count=inv.length;while(inv.length<INV_SIZE)inv.push({id:'book',uses:0});
    interact();const full=msgText,untaken=streetSceneState.lampWeek;
    inv.length=count;interact();const lamp=inv.find(i=>i.id==='movinglamp');
    saveGame();return {full,untaken,taken:!!lamp,decor:isHomeDecor(lamp),week:movingWeek(),claimed:streetSceneState.lampWeek};
  });
  assert.match(result.full,/bag is full/);assert.equal(result.untaken,-1);assert.ok(result.taken&&result.decor);assert.equal(result.claimed,result.week);
  await page.reload();
  const restored=await page.evaluate(()=>{mode='walk';return {count:inv.filter(i=>i.id==='movinglamp').length,claimed:streetSceneState.lampWeek,handled:streetSceneUse()};});
  assert.equal(restored.count,1);assert.equal(restored.claimed,result.week);assert.equal(restored.handled,false,'the cleared scene leaves normal nearby interactions available');
}));

test('ordinary traffic passes the parked van and a hailed taxi cannot pull through its solid body',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const s=STREET_SCENES.moving,sign=s.f.side?s.ny:-s.nx,p=scenePoint(s,-sign*1.6,.6);
    cars.length=people.length=footCops.length=0;evTimer=Infinity;px=py=250;
    const c=addCar({x:p.x,y:p.y,hx:s.c*sign,hy:s.s*sign,body:TAXI});
    c.cruise=.7;const start=[c.x,c.y];let collision=false;
    for(let k=0;k<60;k++){T+=.1;stepTraffic(.1,T,true);if(!streetSceneCarClear(c.ex,c.ey,c.hx,c.hy,...carFootprint(c)))collision=true;}
    const passed=near(start[0],start[1],c.x,c.y)>2;
    const next=scenePoint(s,.55,.6);Object.assign(c,{x:next.x,y:next.y,ex:next.x,ey:next.y,off:0,offV:0,hx:s.c*sign,hy:s.s*sign,hail:true,v:0});plan(c);
    const person=scenePoint(s,.55,.25);px=person.x;py=person.y;
    for(let k=0;k<30;k++){T+=.1;stepTraffic(.1,T,true);if(!streetSceneCarClear(c.ex,c.ey,c.hx,c.hy,...carFootprint(c)))collision=true;}
    return {passed,collision};
  });
  assert.ok(result.passed,JSON.stringify(result));assert.equal(result.collision,false);
}));

test('phone controls expose Run train, Look and Take lamp actions and render a readable miniature',()=>fixture(async page=>{
  await page.evaluate(()=>{const s=STREET_SCENES.railway,p=scenePoint(s,0,.22);px=p.x;py=p.y;a=Math.atan2(-s.ny,-s.nx);tod=23;env(0);render(0);showTouch();});
  const button=page.locator('#touch .pad [data-key="KeyE"]');
  assert.equal(await button.textContent(),'Run train');await button.tap();
  assert.equal(await page.evaluate(()=>railwayClock().running),true);
  await page.evaluate(()=>{const c=STREET_SCENES.chalk;px=c.x;py=c.y+.6;tod=12;env(0);render(0);showTouch();});
  assert.equal(await button.textContent(),'Look');await button.tap();assert.match(await page.evaluate(()=>msgText),/chalk whale/);
  await page.evaluate(()=>{const p=scenePoint(STREET_SCENES.moving,.46,.19);px=p.x;py=p.y;tod=18;env(0);render(0);showTouch();});
  assert.equal(await button.textContent(),'Take lamp');await button.tap();
  assert.equal(await page.evaluate(()=>inv.some(i=>i.id==='movinglamp')),true);
},true));

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {timeCourierRuns,timeSiteRuns,timeNightRuns}=require('./helpers/courier-runs.cjs');
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
    const points=[[179.5,106.5],[182.5,107.4],[183.5,108.1],[183.5,109.5],[186.5,109.5],[186.5,107.35],[188.2,106.85],
      [189.4,106.85],[190.3,106.85],[190.8,107.4],[191.4,107.4],[191.4,106.85],[191.4,102.35],
      [191.4,101.25],[194.35,101.25],[194.35,102.4],[195.4,102.4],[196.4,102.4],[197.5,102.4],[198.5,102.4],[199,102.1]];
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
    render();hud();const prompt=promptText(),before=money,expected=80+courierBonus(courierRoute(),courierJob.took);
    interact();const paid=money-before;interact();
    return {entered,accepted,stairs,legs,prompt,paid,expected,twice:money-before,active:courierJob,
      saved:JSON.parse(localStorage.getItem(SAVE_KEY)).courier,map:bigMapLabels().some(p=>p[2]===COURIER_COMPANY)};
  });
  assert.equal(r.entered,'courier');assert.equal(r.accepted,'garden');assert.equal(r.stairs.mode,'roof');
  assert.equal(r.stairs.x,179.5);assert.equal(r.stairs.y,102.5);assert.equal(r.legs.length,21,JSON.stringify(r.legs));
  for(const leg of r.legs)assert.deepEqual(leg,{reached:true,mode:'roof',health:100});
  assert.match(r.prompt,/deliver/);assert.equal(r.paid,r.expected);assert.equal(r.twice,r.expected);assert.equal(r.active,null);
  assert.equal(r.saved.records.trips,1);assert.equal(r.saved.job,null);assert.equal(r.map,true);
}));

test('both optional courier gaps are reachable with an ordinary sprint jump',()=>withCity(async page=>{
  const r=await page.evaluate(()=>[[184.68,106.52,185.5],[192.88,102.35,193.65]].map(([x,y,end])=>{
    mode='roof';room=null;px=x;py=y;a=0;roofH=roofHeightAt(px,py);roofLot=new Set();needs.health=100;
    body.z=body.vz=body.peak=0;body.hop=1;body.groundMode=null;body.mx=.8;body.my=0;jump();
    let n=0,minHeight=Infinity;
    while(px<end&&n++<200){T+=.01;move(.008,0);stepBody(.01);stepRoof();minHeight=Math.min(minHeight,mode==='roof'?roofH+body.z/10:body.z/10);}
    for(let k=0;k<150;k++){T+=.01;stepBody(.01);stepRoof();}
    return {reached:px>=end,mode,z:body.z,health:needs.health,minHeight};
  }));
  for(const jump of r){assert.equal(jump.reached,true,JSON.stringify(r));assert.equal(jump.mode,'roof',JSON.stringify(r));assert.equal(jump.z,0);assert.ok(jump.health>90);assert.ok(jump.minHeight>1.3);}
}));

test('each courier shortcut saves real sprint time; a clean run with both earns the full bonus',()=>withCity(async page=>{
  const runs=await page.evaluate(timeCourierRuns);
  for(const run of runs) {
    assert.ok(run.legs.every(leg=>leg.reached),JSON.stringify(run));
    assert.equal(run.recipient,true,JSON.stringify(run));assert.equal(run.health,100);
  }
  const [safe,first,second,both]=runs;
  assert.ok(safe.seconds-first.seconds>3,JSON.stringify(runs));
  assert.ok(safe.seconds-second.seconds>3,JSON.stringify(runs));
  assert.ok(safe.seconds-both.seconds>7,JSON.stringify(runs));
  assert.ok(both.seconds<both.fullUntil,JSON.stringify(runs));assert.equal(both.bonus,40);
  assert.ok(safe.seconds>safe.fullUntil,JSON.stringify(runs));assert.ok(safe.bonus<40);
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
    const structure=[...COURIER_SURFACES,...COURIER_LATTICE,...COURIER_SCENERY.filter(o=>['post','rail','knee','beam','bearing','stringer','footing','turntable','cab','counterweight','trolley','hook','formwork','skip','rebar','pallet','bags','cabin','arch-sign','arcade-sign','crate','pole'].includes(o.kind))];
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
    // Tubes, cables and brackets: sampled along their length against walls and facade details.
    for(const rod of COURIER_RODS) {
      const n=Math.ceil(Math.hypot(rod.b[0]-rod.a[0],rod.b[1]-rod.a[1],rod.b[2]-rod.a[2])/.01);
      for(let k=0;k<=n;k++) {
        const x=rod.a[0]+(rod.b[0]-rod.a[0])*k/n,y=rod.a[1]+(rod.b[1]-rod.a[1])*k/n,z=rod.a[2]+(rod.b[2]-rod.a[2])*k/n;
        if(courierMapHeight(x,y)>z+1e-6)conflicts.push({kind:'wall',deck:rod.kind,x,y});
        for(const o of fixtures){const f=streetBoxesOverlap({...rod,hl:.01,hw:.01,c:1,s:0},o,0)&&verticalInterval(o,x,y);if(f&&z>f[0]+1e-6&&z<f[1]-1e-6)conflicts.push({kind:o.kind,deck:rod.kind,x,y});}
      }
    }
    return conflicts;
  });
  assert.deepEqual(conflicts,[]);
}));

test('the first route uses existing building entrances for recovery without redundant ladders',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    startCourier();needs.health=100;
    const ladders=COURIER_LADDERS.filter(l=>l.route==='garden').length,recovery=[];
    // A surviving fall keeps the parcel, but not the speed bonus, and the depot and apartments get you back up.
    mode='walk';room=null;px=177.72;py=102.5;body.z=2.7;body.vz=0;body.peak=body.z;
    for(let n=0;n<200;n++){stepBody(.01);stepCourier(.01);}
    const survived={active:!!courierJob,health:needs.health,z:body.z,street:courierJob.street,hud:courierText().includes('speed bonus lost')};
    for(const [x,y,yaw,kind] of [[177.72,102.5,0,'courier'],[183.8,105.7,Math.PI/2,'apts']]) {
      mode='walk';room=null;px=x;py=y;a=yaw;pitch=0;body.z=body.vz=body.peak=0;render();interact();
      const entered=room?.kind;
      if(entered!==kind){recovery.push({entered});continue;}
      px=room.def.ex;py=1.7;interact();
      const up={mode,free:roofFree(px,py),active:!!courierJob};
      interact();const down={mode,kind:room?.kind};
      recovery.push({entered,up,down});
    }
    // Mara's building is her grocery now: no elevator up to the garden.
    mode='walk';room=null;px=199.4;py=104.28;a=-Math.PI/2;pitch=0;render();interact();
    const garden={entered:room?.kind,word:room?.word,elevator:!!room?.def.ex};
    return {ladders,recovery,survived,garden};
  });
  assert.equal(r.ladders,0);assert.equal(r.recovery.length,2);
  assert.deepEqual(r.survived,{active:true,health:100,z:0,street:true,hud:true});
  for(const [i,entry] of r.recovery.entries()) {
    const kind=i===0?'courier':'apts';
    assert.deepEqual(entry,{entered:kind,up:{mode:'roof',free:true,active:true},down:{mode:'room',kind}});
  }
  assert.deepEqual(r.garden,{entered:'grocer',word:'GROCERY',elevator:false});
}));

test('a street run to a mid-route elevator still delivers, for base pay only',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    const draw=render;window.requestAnimationFrame=()=>0;render=()=>{};hud=()=>{};
    for(const key of Object.keys(K))K[key]=false;K.KeyW=K.ShiftLeft=true;
    courierRecords.best.garden=50;startCourier();needs.health=needs.food=needs.drink=100;
    body.z=body.vz=body.peak=body.crouch=0;body.hop=1;body.buf=body.landedAt=-9;body.seat=null;body.groundMode=null;
    mode='walk';room=null;[px,py]=COURIER_DEPOT.door;paused=false;
    const legs=[],go=(x,y)=>{let n=0;while(near(px,py,x,y)>.018&&n++<3000){a=Math.atan2(y-py,x-px);loop(t0+10);}legs.push(near(px,py,x,y)<=.018);};
    // Round to No.793, across the last bridge from the garden: the quickest elevator left on the route.
    for(const [x,y] of [[177.2,102.5],[177.4,104.7],[188.3,104.7],[188.6,104.2]])go(x,y);
    a=-Math.PI/2;pitch=0;render=draw;render();interact();render=()=>{};
    const lobby=room?.word;go(room.def.ex,1.7);interact();
    for(const [x,y] of [[189.6,102.3],[190.6,102.3],[191.4,101.25],[194.35,101.25],[194.35,102.4],[195.4,102.4],
      [196.4,102.4],[197.5,102.4],[198.5,102.4],[199,102.1]])go(x,y);
    K.KeyW=false;paused=true;
    const seconds=courierJob.took,before=money;interact();
    return {legs,lobby,seconds,paid:money-before,best:courierRecords.best.garden,health:needs.health};
  });
  assert.ok(r.legs.every(Boolean),JSON.stringify(r));assert.equal(r.lobby,'No.793');assert.equal(r.health,100);
  assert.ok(r.seconds<40,'faster than any roof run: the rule, not the time, keeps it honest');
  assert.equal(r.paid,80);assert.equal(r.best,50);
}));

test('elevators ride up their own building, and the site deck cannot be stepped onto through its rails',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    // No.756's east cell used to send riders to the 3-cell grid's middle: the steel frame's deck, past the ladder.
    const flats=SHOP[idx(181,115)];
    enterRoom('apts',{...flats,cell:[181,115],ret:[181.5,113.2,Math.PI/2]},[0,0,-Math.PI/2]);
    px=room.def.ex;py=1.7;interact();
    const ride={mode,building:SHOP[idx(Math.floor(px),Math.floor(py))]===flats,height:roofH,own:map[idx(181,115)]};
    // The roof south of the frame is a walkable 3m below the deck; the edge protection stops you at the top.
    mode='roof';room=null;roofH=map[idx(183,117)];roofLot=new Set();px=183.5;py=117.45;body.z=body.vz=0;
    for(let n=0;n<200;n++){a=-Math.PI/2;move(0,-.005);stepBody(.01);stepRoof();}
    return {ride,deck:{y:py,height:roofH,below:map[idx(183,117)]}};
  });
  assert.deepEqual(r.ride,{mode:'roof',building:true,height:r.ride.own,own:r.ride.own});
  assert.ok(r.deck.y>116.95,JSON.stringify(r.deck));assert.equal(r.deck.height,r.deck.below);
}));

test('the ladder mechanic remains usable for future roofs without indoor access',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    courierLadder('test-only',[177.75,103.45,0],[178.35,103.45,COURIER_DEPOT.h],[177.97,103.45,0]);
    startCourier();const ladders=[];
    for(const ladder of COURIER_LADDERS) {
      mode=ladder.bottom[2]?'roof':'walk';roofH=ladder.bottom[2];roofLot=new Set();room=null;[px,py]=ladder.bottom;body.z=body.vz=body.peak=0;
      const available=!!courierLadderNear(),prompt=courierPrompt();interact();const grabbed=mode;
      K.KeyW=true;for(let n=0;n<150&&climbing;n++){stepCourierLadder(.05);stepBody(.05);}K.KeyW=false;
      const up={mode,x:px,y:py,h:roofH,free:roofFree(px,py)};
      interact();K.KeyS=true;for(let n=0;n<150&&climbing;n++)stepCourierLadder(.05);K.KeyS=false;
      ladders.push({available,prompt,grabbed,up,down:mode,expectedDown:ladder.bottom[2]?'roof':'walk',active:!!courierJob});
    }
    const l=COURIER_LADDERS.find(l=>l.route==='test-only');grabCourierLadder({ladder:l,end:'bottom'});K.KeyW=true;stepCourierLadder(1);K.KeyW=false;
    leaveCourierLadder();const released={mode,z:body.z};needs.health=100;
    for(let n=0;n<200;n++)stepBody(.01);
    const survived={active:!!courierJob,health:needs.health,z:body.z};
    return {ladders,released,survived};
  });
  assert.equal(r.ladders.length,2,'the site ladder and the test ladder');
  for(const l of r.ladders){assert.ok(l.available,JSON.stringify(r.ladders));assert.match(l.prompt,l.expectedDown==='roof'?/grab the ladder \(climb up\)/:/grab the ladder \(up to the roof\)/);assert.equal(l.grabbed,'ladder');assert.equal(l.up.mode,'roof');assert.equal(l.up.free,true);assert.equal(l.down,l.expectedDown);assert.equal(l.active,true);}
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
    startCourier();grabCourierLadder({ladder:COURIER_LADDERS.find(l=>l.route==='test-only'),end:'bottom'});stepCourierLadder(1);
    wanted.stars=1;openBusted();const caughtOnLadder={mode,climbing,active:courierJob};bustedChoice('jail');
    const jail={active:courierJob,kind:room.kind,failed:courierRecords.failed};
    return {restored,hospital,confiscated,fine,caughtOnLadder,jail};
  });
  assert.equal(r.restored.id,'garden');assert.ok(r.restored.took>=111);
  assert.deepEqual(r.hospital,{active:null,kind:'hospital',saved:null});assert.equal(r.confiscated,true);
  assert.deepEqual(r.fine,{active:null,failed:2,stars:0});assert.deepEqual(r.caughtOnLadder,{mode:'walk',climbing:null,active:null});
  assert.deepEqual(r.jail,{active:null,kind:'jail',failed:3});
}));

test('a garden delivery opens the dispatch board, which hands out the site rush',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    mode='walk';room=null;[px,py]=COURIER_DEPOT.door;a=0;pitch=0;render();interact();
    px=10.3;py=4.9;
    loadCourier();const firstPrompt=promptText();chooseCourier('site');const locked=courierJob;
    courierRecords.best.garden=41;render();hud();const prompt=promptText();interact();
    const board={open:courierBoardEl.style.display,text:courierBoardEl.textContent,job:courierJob};
    courierBoardKey({code:'Digit2'});
    const result={firstPrompt,locked,prompt,board,job:courierJob,closed:courierBoardEl.style.display,paused,
      saved:JSON.parse(localStorage.getItem(SAVE_KEY)).courier.job};
    // Taking it with a click closes the board too, and must take the mouse back.
    courierJob=null;let relocked=0;lockMouse=()=>relocked++;interact();
    courierBoardEl.querySelector('[data-route="site"]').click();
    result.click={job:courierJob?.id,closed:courierBoardEl.style.display,relocked};
    return result;
  });
  assert.match(r.firstPrompt,/take a rooftop delivery \(\$80/);assert.equal(r.locked,null,'the rush stays locked on a fresh save');
  assert.match(r.prompt,/dispatch board/);assert.equal(r.board.open,'flex');assert.equal(r.board.job,null);
  assert.match(r.board.text,/Topping Out: stamped drawings for Teo/);assert.match(r.board.text,/best 41\.0s/);
  assert.deepEqual(r.job,{id:'site',took:0});assert.equal(r.closed,'none');assert.equal(r.paused,false);
  assert.deepEqual(r.saved,{id:'site',took:0});
  assert.deepEqual(r.click,{job:'site',closed:'none',relocked:1});
}));

test('every site crossing works with real movement; the strafe off the hoist bay saves time and earns the full bonus',()=>withCity(async page=>{
  const runs=await page.evaluate(timeSiteRuns);
  for(const run of runs) {
    assert.ok(run.legs.every(leg=>leg.reached),JSON.stringify(run));
    assert.equal(run.recipient,true,JSON.stringify(run));assert.equal(run.health,100);
  }
  const [safe,shortcut]=runs;
  assert.ok(safe.seconds-shortcut.seconds>3,JSON.stringify(runs));
  assert.ok(shortcut.seconds<shortcut.fullUntil,JSON.stringify(runs));assert.equal(shortcut.bonus,50);
  assert.ok(safe.seconds>safe.fullUntil,JSON.stringify(runs));assert.ok(safe.bonus<50);
  const garden=(await page.evaluate(timeCourierRuns))[0].seconds;
  assert.ok(safe.seconds<garden-10,'the rush is the shorter route');
}));

test('off the hoist bay a straight jump falls into the street; strafing right lands on the office roof',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    window.requestAnimationFrame=()=>0;render=()=>{};hud=()=>{};
    const bay=courierHoistBay,x0=bay.x+bay.hl-.02,out=[];
    for(const y of [bay.y-bay.hw+.03,bay.y,bay.y+bay.hw-.03])for(const strafe of [false,true]) {
      for(const key of Object.keys(K))K[key]=false;
      mode='roof';room=null;roofH=courierHang;roofLot=new Set();needs.health=100;
      body.z=body.vz=body.peak=body.crouch=0;body.hop=1;body.buf=body.landedAt=-9;body.seat=null;body.groundMode=null;
      px=x0-.3;py=y;a=0;K.KeyW=K.ShiftLeft=true;paused=false;
      let n=0;while(px<x0&&n++<300)loop(t0+10);
      jump();if(strafe){K.KeyW=false;K.KeyD=true;}
      while(n++<800){loop(t0+10);if(mode==='walk'&&body.z<14||!(body.z>0||body.vz>0))break;}
      paused=true;
      out.push({strafe,mode,height:roofH,y:py});
    }
    return {out,office:courierOfficeRoof};
  });
  for(const t of r.out) {
    if(t.strafe){assert.equal(t.mode,'roof',JSON.stringify(r));assert.equal(t.height,r.office);assert.ok(t.y>113.95,'with room to spare');}
    else assert.equal(t.mode,'walk',JSON.stringify(r));
  }
}));

test('the site has no indoor access: its ladder works both ways and the next-door roof leads back onto the scaffold',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    startCourier();courierJob=null;courierRecords.best.garden=40;startCourier('site');
    const site=SHOP[idx(183,115)];
    // Back on the route from the apartments next door, whose elevator a fallen courier can use.
    mode='roof';room=null;roofH=map[idx(181,115)];roofLot=new Set();px=180.9;py=115.5;a=0;body.z=body.vz=0;
    const legs=[];
    for(const [x,y] of [[181.9,114.06],[182.1,113.88],[183.55,113.86]]) {
      for(let n=0;n<400&&near(px,py,x,y)>.01;n++){a=Math.atan2(y-py,x-px);move(Math.cos(a)*.005,Math.sin(a)*.005);stepBody(.01);stepRoof();}
      legs.push({reached:near(px,py,x,y)<=.011,mode,height:+roofH.toFixed(3)});
    }
    const ladder=COURIER_LADDERS.find(l=>l.route==='site');
    interact();K.KeyW=true;for(let n=0;n<300&&climbing;n++)stepCourierLadder(.05);K.KeyW=false;
    const up={mode,height:roofH,free:roofFree(px,py)};
    interact();K.KeyS=true;for(let n=0;n<300&&climbing;n++)stepCourierLadder(.05);K.KeyS=false;
    const down={mode,height:roofH};
    return {site,legs,up,down,hang:courierHang,deck:COURIER_SITE.h,active:courierJob?.id};
  });
  assert.equal(r.site,null);
  for(const leg of r.legs)assert.equal(leg.reached,true,JSON.stringify(r.legs));
  assert.deepEqual(r.legs.at(-1),{reached:true,mode:'roof',height:+r.hang.toFixed(3)});
  assert.deepEqual(r.up,{mode:'roof',height:r.deck,free:true});assert.deepEqual(r.down,{mode:'roof',height:r.hang});
  assert.equal(r.active,'site');
}));

test('every night crossing works with real movement; leaping the side street saves time and earns the full bonus',()=>withCity(async page=>{
  const runs=await page.evaluate(timeNightRuns);
  for(const run of runs) {
    assert.ok(run.legs.every(leg=>leg.reached),JSON.stringify(run));
    assert.equal(run.recipient,true,JSON.stringify(run));assert.equal(run.street,false);
  }
  const [safe,leap]=runs;
  assert.equal(safe.health,100);assert.ok(leap.health>80,'the drop onto the bar roof only stings');
  assert.ok(safe.seconds-leap.seconds>5,JSON.stringify(runs));
  assert.ok(leap.seconds<leap.fullUntil);assert.equal(leap.bonus,60);
  assert.ok(safe.seconds>safe.fullUntil);assert.ok(safe.bonus<60);
}));

test('off the condenser, too slow drops into the side street outside the bar; fast enough lands on its roof, never inside it',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    window.requestAnimationFrame=()=>0;render=()=>{};hud=()=>{};
    const out=[];
    for(const x of [180.35,180.55,180.75])for(const hop of [1.3,1.5,1.6,1.65,1.7,1.75,1.85]) {
      for(const k of Object.keys(K))K[k]=false;
      mode='roof';room=null;roofH=map[idx(Math.floor(x),118)];roofLot=new Set();needs.health=100;
      body.z=body.vz=body.peak=body.crouch=0;body.buf=body.landedAt=-9;body.seat=null;body.groundMode=null;
      px=x;py=118.3;a=Math.PI/2;K.KeyW=K.ShiftLeft=true;paused=false;
      let n=0;while(py<119.9&&n++<400){body.hop=hop;loop(t0+10);}
      jump();
      while(n++<900){body.hop=Math.max(body.hop,hop);loop(t0+10);if(!(body.z>0||body.vz>0))break;}
      paused=true;
      out.push({x,hop,mode,y:py,height:roofH});
    }
    return {out,bar:COURIER_NICO.z};
  });
  for(const t of r.out) {
    if(t.mode==='roof')assert.equal(t.height,r.bar,JSON.stringify(t));
    else assert.ok(t.y<122,'fell outside the wall, not into the building: '+JSON.stringify(t));
    if(t.hop>=1.75)assert.equal(t.mode,'roof',JSON.stringify(t));
    if(t.hop<=1.5)assert.equal(t.mode,'walk',JSON.stringify(t));
  }
}));

test('the board holds the night run until 8pm; Nico plays after his delivery, heard across the roofs but not indoors, until morning',()=>withCity(async page=>{
  const r=await page.evaluate(()=>{
    courierRecords.best.garden=40;courierRecords.best.site=29;(0,eval)('tod=13');
    mode='walk';room=null;[px,py]=COURIER_DEPOT.door;a=0;pitch=0;render();interact();px=10.3;py=4.9;interact();
    const day={text:courierBoardEl.textContent};courierBoardKey({code:'Digit3'});day.job=courierJob;day.open=courierBoardEl.style.display;
    courierBoardKey({code:'Escape'});(0,eval)('tod=22');interact();courierBoardKey({code:'Digit3'});
    const job={...courierJob},bag=COURIER_BAG_ART.night.join('');
    const route=courierRoute();mode='roof';room=null;body.z=0;[px,py,roofH]=[route.recipient.x,route.recipient.y,route.recipient.z];
    const before=courierSerenade();interact();
    const close=courierSerenade();
    px+=2;const across=courierSerenade();px+=2;const far=courierSerenade();
    mode='room';room={kind:'bar'};const indoors=courierSerenade();mode='roof';room=null;
    (0,eval)('tod=3');stepCourierEncore();const late=courierEncore;(0,eval)('tod=5');stepCourierEncore();
    return {day,job,bag,before,close,across,far,indoors,late,morning:courierEncore};
  });
  assert.match(r.day.text,/Last Set: repaired guitar for Nico/);assert.match(r.day.text,/after 8pm/);
  assert.equal(r.day.job,null,'not offered by day');assert.equal(r.day.open,'flex');
  assert.deepEqual(r.job,{id:'night',took:0});assert.match(r.bag,/FRAGILE/);
  assert.equal(r.before,0);assert.ok(r.close>.9);assert.ok(r.across>0&&r.across<r.close);assert.equal(r.far,0);
  assert.equal(r.indoors,0);assert.equal(r.late,true);assert.equal(r.morning,false);
}));

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('courier contracts keep base pay, taper only the optional bonus, and pay once',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const route=COURIER_ROUTES[0],before=money;
    const bonuses=[0,42,66,90,10000].map(t=>courierBonus(route,t));
    mode='room'; // (taken at the dispatcher's counter)
    const invalid=startCourier('missing'),started=startCourier(),duplicate=startCourier();
    stepCourier(66);stepCourier(-10);
    const early=finishCourier();
    mode='roof';px=route.recipient.x;py=route.recipient.y;roofH=route.recipient.z;
    const completed=finishCourier(),again=finishCourier();
    return {bonuses,invalid,started,duplicate,early,completed,again,paid:money-before,records:courierRecords};
  })())`));
  assert.deepEqual(r.bonuses,[40,40,20,0,0]);
  assert.equal(r.invalid,false);assert.equal(r.started,true);assert.equal(r.duplicate,false);
  assert.equal(r.early,null);assert.equal(r.completed.pay,100);assert.equal(r.completed.seconds,66);
  assert.equal(r.again,null);assert.equal(r.paid,100);
  assert.deepEqual(r.records,{trips:1,earned:100,best:{garden:66},failed:0});
});

test('courier saves preserve elapsed time and validate routes, times and records',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    loadCourier({job:{id:'garden',took:123.5},records:{trips:2,earned:205,best:76.2,failed:1}});
    const good={job:{...courierJob},records:{...courierRecords}};
    const invalid=[{id:'missing',took:0},{id:'garden',took:-1},{id:'garden',took:Infinity}].map(job=>{loadCourier({job,records:{trips:-1,earned:NaN,best:-20,failed:'3'}});return courierJob;});
    loadCourier();const oldSave={job:courierJob,records:{...courierRecords}};
    startCourier();const failed=failCourier(),twice=failCourier();
    return {good,invalid,oldSave,failed,twice,count:courierRecords.failed};
  })())`));
  assert.deepEqual(r.good,{job:{id:'garden',took:123.5},records:{trips:2,earned:205,best:{garden:76.2},failed:1}},'an old single best time belongs to the garden route');
  assert.deepEqual(r.invalid,[null,null,null]);
  assert.deepEqual(r.oldSave,{job:null,records:{trips:0,earned:0,best:{},failed:0}});
  assert.equal(r.failed,true);assert.equal(r.twice,false);assert.equal(r.count,1);
});

test('courier decks and treads share their geometry with shelter and retain genuine jump gaps',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const surfaces=COURIER_SURFACES.map(o=>({kind:o.kind,x:o.x,y:o.y,height:courierSurfaceTop(o,o.x,o.y),
      collision:courierRoofHeight(o.x,o.y),geometry:geometrySurfaceHeight(o,o.x,o.y),
      topExposed:snowExposed(o.x,o.y,o.z1),groundExposed:snowExposed(o.x,o.y)}));
    return {surfaces,gaps:[[184.9,106.52],[193.1,102.35]].map(([x,y])=>courierRoofHeight(x,y)),
      wrapped:courierRoofHeight(179.5+N,105-N),base:courierRoofHeight(179.5,105),police:policeRoofHeight(184.5,109.5)};
  })())`));
  for(const o of r.surfaces){
    assert.ok(Math.abs(o.height-o.geometry)<1e-8,JSON.stringify(o));
    assert.ok(o.collision>=o.height-1e-8);
    assert.equal(o.groundExposed,false,JSON.stringify(o));
  }
  assert.ok(r.surfaces.filter(o=>o.topExposed).length>=8,'decks and treads are exposed to snow');
  assert.deepEqual(r.gaps,[0,0]);assert.equal(r.wrapped,r.base);
  assert.ok(r.police>1.4,'police roof navigation includes the narrow crossing at the edge of a cell');
});

test('courier bridges are level, steps have small risers, and the garden drop has no ramp',()=>{
  const {ev}=loadCity();
  assert.equal(ev('COURIER_SURFACES.filter(o=>o.kind==="bridge").length'),5);
  assert.equal(ev('COURIER_SURFACES.every(o=>o.h0===o.h1)'),true);
  assert.equal(ev('COURIER_SURFACES.some(o=>courierContains(o,198,102.4))'),false);
  const flights=JSON.parse(ev('JSON.stringify(COURIER_STAIRS.map(o=>({rise:Math.abs(o.h1-o.h0),length:2*(o.axis==="y"?o.hw:o.hl)})))'));
  for(const flight of flights)assert.ok(flight.length/flight.rise>3,'the rise fits a plausible stair flight');
  const steps=JSON.parse(ev('JSON.stringify(COURIER_SURFACES.filter(o=>o.kind==="step").map(o=>o.z1-o.z0))'));
  for(const height of steps)assert.ok(height<=.034+1e-9,'each tread covers a small riser and its thickness');
});

test('courier corner decks meet continuously and the garden shortcut shares its stair landing',()=>{
  const {ev}=loadCity();
  assert.equal(ev(`Array.from({length:44},(_,i)=>courierRoofHeight(183.4+i*.01,109.5))
    .every(h=>Math.abs(h-courierLaundryDeck)<1e-9)`),true,'the laundry elbow has no break in its deck');
  const join=JSON.parse(ev(`JSON.stringify((()=>{
    const bridge=COURIER_SURFACES.find(o=>o.kind==='shortcut'&&o.x>193);
    const stairs=COURIER_STAIRS.find(o=>o.axis==='x'&&o.x>194);
    return {bridgeEnd:bridge.x+bridge.hl,stairStart:stairs.x-stairs.hl,
      bridgeHeight:bridge.h1,stairHeight:stairs.h0,bridgeY:bridge.y,stairY:stairs.y,
      bridgeWidth:bridge.hw,stairWidth:stairs.hw};
  })())`));
  assert.ok(Math.abs(join.bridgeEnd-join.stairStart)<1e-9);
  assert.equal(join.bridgeHeight,join.stairHeight);
  assert.ok(Math.abs(join.bridgeY-join.stairY)<1e-9);
  assert.ok(Math.abs(join.bridgeWidth-join.stairWidth)<1e-9,'both railings line up at the join');
});

test('the site rush unlocks after a garden delivery, and saves keep a best time per route',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    loadCourier();const locked=startCourier('site');
    loadCourier({records:{trips:1,earned:120,best:{garden:44.5,site:-3,ghost:9},failed:0}});
    const started=startCourier('site'),job={...courierJob};
    const route=courierRoute();mode='roof';[px,py,roofH]=[route.recipient.x,route.recipient.y,route.recipient.z];
    stepCourier(30);const done=finishCourier();
    return {locked,started,job,pay:done.pay,best:courierRecords.best,
      bonuses:[0,28,44,60].map(t=>courierBonus(route,t))};
  })())`));
  assert.equal(r.locked,false,'nothing but the garden run is open on a fresh save');
  assert.equal(r.started,true);assert.deepEqual(r.job,{id:'site',took:0});
  assert.deepEqual(r.best,{garden:44.5,site:30},'invalid and unknown best times are dropped');
  assert.deepEqual(r.bonuses,[50,50,25,0]);assert.equal(r.pay,100+47);
});

test('reaching the street forfeits the speed bonus and the best time, but the parcel still pays and the loss is saved',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    loadCourier({records:{trips:1,earned:120,best:{garden:44.5},failed:0}});
    mode='room';startCourier();const indoors=stepCourier(1);
    mode='walk';body.z=9;const midJump=stepCourier(1);body.z=0;const landed=stepCourier(1),again=stepCourier(1);
    const saved=JSON.parse(JSON.stringify(courierJob));loadCourier({job:saved,records:courierRecords});
    const restored={...courierJob};loadCourier({job:{id:'garden',took:3,street:'yes'}});const forged={...courierJob};
    loadCourier({job:saved,records:{trips:1,earned:120,best:{garden:44.5},failed:0}});
    const route=courierRoute();mode='roof';body.z=0;[px,py,roofH]=[route.recipient.x,route.recipient.y,route.recipient.z];
    const done=finishCourier();
    return {indoors,midJump,landed,again,restored,forged,pay:done.pay,bonus:done.bonus,street:done.street,best:courierRecords.best,trips:courierRecords.trips};
  })())`));
  assert.deepEqual([r.indoors,r.midJump,r.landed,r.again],[false,false,true,false],'only touching down counts, once');
  assert.deepEqual(r.restored,{id:'garden',took:4,street:true});assert.deepEqual(r.forged,{id:'garden',took:3});
  assert.equal(r.pay,80);assert.equal(r.bonus,0);assert.equal(r.street,true);
  assert.deepEqual(r.best,{garden:44.5},'a street run is no record');assert.equal(r.trips,2);
});

test('the HUD arrow points at the recipient on the roofs and back to the depot door from the street',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    loadCourier();startCourier('garden');const route=courierRoute();
    mode='roof';body.z=0;[px,py,roofH]=[179.5,102.5,COURIER_DEPOT.h];const roof=courierGuide();
    mode='walk';[px,py]=[185,110];const street=courierGuide();
    mode='drive';const driving=courierGuide();
    return {roof:[roof[0]===route.recipient,roof[1].stop],street,driving,door:COURIER_DEPOT.door};
  })())`));
  assert.deepEqual(r.roof,[true,'CLIMB UP']);
  assert.deepEqual(r.street,[{x:r.door[0],y:r.door[1]},{label:'ROOFTOP COURIERS',radius:.3,stop:'GO IN'}]);
  assert.deepEqual(r.driving,r.street);
});

test("no building in a recipient's block has roof access, and every elevator rides up its own building",()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const access=sh=>sh.kind===SHOP_APTS||sh.word==='HOTEL'||sh.word==='MOTEL',blocks={};
    for(const route of COURIER_ROUTES) {
      // The block as built: every building whose roof adjoins the recipient's, out to the streets and alleys.
      const start=idx(Math.floor(route.recipient.x),Math.floor(route.recipient.y)),seen=new Set([start]),todo=[start],found=new Set();
      while(todo.length&&seen.size<400){const k=todo.pop(),x=k%N,y=Math.floor(k/N);if(access(SHOP[k]))found.add(SHOP[k].word);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=idx(x+dx,y+dy);if(!seen.has(n)&&map[n]&&SHOP[n]){seen.add(n);todo.push(n);}}}
      blocks[route.id]={size:seen.size,access:[...found]};
    }
    let elevators=0;const strays=[];
    for(let k=0;k<N*N;k++){const sh=SHOP[k];if(!sh||!map[k]||!access(sh))continue;elevators++;
      const [x,y]=buildingMiddle(k%N,Math.floor(k/N));if(SHOP[idx(x,y)]!==sh)strays.push([k%N,Math.floor(k/N),x,y]);}
    const home=restoreHomeCell(idx(COURIER_GARDEN.x,COURIER_GARDEN.y));
    return {blocks,elevators,strays,garden:SHOP[idx(COURIER_GARDEN.x,COURIER_GARDEN.y)].word,office:SHOP[idx(COURIER_FOREMAN.x,COURIER_FOREMAN.y)].word,
      home:home>=0&&SHOP[home].kind===SHOP_APTS};
  })())`));
  for(const id of ['garden','site']){assert.deepEqual(r.blocks[id].access,[]);assert.ok(r.blocks[id].size>=20&&r.blocks[id].size<60,JSON.stringify(r.blocks));}
  assert.equal(r.garden,'GROCERY');assert.equal(r.office,'HARDWARE');
  assert.ok(r.elevators>1000);assert.deepEqual(r.strays,[],'the old 3-cell grid put riders on the next building, even on the site deck');
  assert.equal(r.home,true,'a saved flat in a converted building moves to an apartment');
});

test('the site route is a walking-jump crossing on level platforms, with no surface stacked over another',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const [p1,p2]=COURIER_PLATFORMS,s=courierScaffold,cornice=112.085;
    const gaps=[p1.y-p1.hw-cornice,(p2.y-p2.hw)-(p1.y+p1.hw),(s.y-s.hw)-(p2.y+p2.hw)];
    const open=[112.2,112.98,113.62].map(y=>courierRoofHeight(182.55,y)+map[idx(182,Math.floor(y))]);
    const heights=[p1,p2,s,courierHoistBay].map(o=>o.h0-courierMapHeight(182.5,111.5));
    // Movement keeps one height per point: overlapping surfaces must agree, or you'd pop up onto the upper one.
    const stacked=[];
    for(const a of COURIER_SURFACES)for(const b of COURIER_SURFACES) {
      if(a===b)continue;
      const ox=Math.min(a.x+a.hl,b.x+b.hl)-Math.max(a.x-a.hl,b.x-b.hl),oy=Math.min(a.y+a.hw,b.y+b.hw)-Math.max(a.y-a.hw,b.y-b.hw);
      if(ox>1e-6&&oy>1e-6&&(a.h0!==b.h0||a.h1!==b.h1))stacked.push([a.kind,a.x,a.y,b.kind,b.x,b.y]);
    }
    const ladder=COURIER_LADDERS.find(l=>l.route==='site');
    const site=[];for(let y=114;y<117;y++)for(let x=182;x<185;x++)site.push([map[idx(x,y)],STY[idx(x,y)],SHOP[idx(x,y)]]);
    return {gaps,open,heights,stacked,site,
      details:ARCH_DETAILS.filter(o=>o.x>182&&o.x<185&&o.y>113.8&&o.y<117.2&&map[o.ownerCell]===o.ownerHeight).length,
      ladder:{bottom:courierRoofHeight(ladder.bottom[0],ladder.bottom[1])-ladder.bottom[2],top:map[idx(Math.floor(ladder.top[0]),Math.floor(ladder.top[1]))]-ladder.top[2]},
      plank:2*courierPlank.hw,landing:courierOfficeLanding.h0===courierPlank.h0};
  })())`));
  for(const gap of r.gaps)assert.ok(gap>.15&&gap<=.25,'each required jump is a real gap no wider than a walking jump: '+JSON.stringify(r.gaps));
  assert.deepEqual(r.open,[0,0,0],'nothing to stand on in the gaps');
  for(const h of r.heights)assert.ok(Math.abs(h)<1e-9,'the crossing is level with the staging roof');
  assert.deepEqual(r.stacked,[]);
  for(const [h,sty,shop] of r.site)assert.deepEqual([h,sty,shop],[2,6,null],'the lot is a bare steel frame');
  assert.equal(r.details,0,'no stoop, bay or cornice was generated for the old brownstone');
  assert.deepEqual(r.ladder,{bottom:0,top:0},'the ladder runs from the scaffold to the deck');
  assert.ok(r.plank<=.12+1e-9,'the walkway is a narrow crossing');assert.equal(r.landing,true);
});

test('jumping straight off the hoist bay finds nothing: the office roof is only reached by strafing',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const b=courierHoistBay,straight=[];
    for(let y=b.y-b.hw;y<=b.y+b.hw+1e-9;y+=.01)for(let x=b.x+b.hl+.005;x<187;x+=.01)
      straight.push(Math.max(map[idx(Math.floor(x),Math.floor(y))],courierRoofHeight(x,y),architectureRoofHeight(x,y)));
    return {straight:Math.max(...straight),office:courierMapHeight(186.5,115.5),recipient:COURIER_FOREMAN.z};
  })())`));
  assert.equal(r.straight,0,'east of the bay, at the bay\'s own latitude, there is only street');
  assert.equal(r.recipient,r.office);
});

test('the night run opens after the site rush, only from 8pm to 4am, and a parcel taken at night can be finished by day',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const route=COURIER_ROUTES.find(r=>r.id==='night');
    loadCourier({records:{trips:2,earned:200,best:{garden:40},failed:0}});tod=22;const locked=startCourier('night');
    courierRecords.best.site=29;
    const offered=[12,19.9,20,23.5,0,3.9,4].map(t=>{tod=t;return courierInHours(route);});
    tod=12;const noon=startCourier('night');tod=23;const night=startCourier('night');
    tod=6;mode='roof';body.z=0;[px,py,roofH]=[route.recipient.x,route.recipient.y,route.recipient.z];stepCourier(31);
    const done=finishCourier();
    return {locked,offered,noon,night,pay:done&&done.pay,best:courierRecords.best.night,recipient:route.recipient.name};
  })())`));
  assert.equal(r.locked,false,'not before the site rush');
  assert.deepEqual(r.offered,[false,false,true,true,true,true,false]);
  assert.equal(r.noon,false);assert.equal(r.night,true);
  assert.equal(r.pay,120+58);assert.equal(r.best,31);assert.equal(r.recipient,'Nico');
});

test('the night route rises before each taller roof, its truss clears both cornices, and the leap has nothing to land on',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const A=COURIER_ARCH,under=[];
    for(const o of STREET_GEOMETRY)if(/cornice/.test(o.kind)&&Math.abs(o.x-A.x)<o.hl+.07&&o.y+o.hw>A.y0&&o.y-o.hw<A.y1)under.push(o.z1);
    const street=[];for(let y=119.95;y<121.99;y+=.01)street.push(courierRoofHeight(180.55,y));
    return {truss:A.z0,cornices:under,deck:courierArchDeck,walk:courierArchWalk.h0,
      landing:courierRoofHeight(178.5,117),back:courierBackDeck,roof425:courierMapHeight(178.5,118),
      sign:COURIER_ARCADE_SIGN.z0,catwalk:courierSignWalk.h0,condenser:courierCondenser.h0-courierMapHeight(180.5,118.5),
      street:Math.max(...street),bar:courierMapHeight(180.5,122.5),nico:COURIER_NICO.z};
  })())`));
  assert.equal(r.cornices.length,2,'one cornice at each end');
  for(const top of r.cornices)assert.ok(r.truss>top,JSON.stringify(r));
  assert.equal(r.walk,r.deck);assert.equal(r.landing,r.back);assert.ok(Math.abs(r.back-r.roof425-.06)<1e-9);
  assert.equal(r.catwalk,r.back);assert.equal(r.sign,r.back,'the letters stand on the catwalk level');
  assert.ok(Math.abs(r.condenser-.15)<1e-9,'a step up, walkable');
  assert.equal(r.street,0,'nothing in the side street under the leap');assert.equal(r.nico,r.bar);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium,firefox}=require('playwright');
const {flyFernRoundTrip,sailFernRoundTrip}=require('./helpers/island-runs.cjs');
let browser;
test.before(async()=>{browser=await(process.env.CITY_TEST_BROWSER==='firefox'?firefox:chromium).launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run,mobile=false) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=12;env(0);});
    await run(page);assert.deepEqual(errors,[]);
  } finally {await page.close();}
}

test('Shotengai is painted in the fitted chart and its search result reaches the real covered streets',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    openBigMap();bigMapFit();const ctx=bigMapCv.getContext('2d'),draw=ctx.fillText,text=[];
    ctx.fillText=function(t,...args){text.push(t);return draw.call(this,t,...args);};
    try{bigMapDraw();}finally{ctx.fillText=draw;}
    BIGMAP.query='shotengai';const found=mapFilteredPlaces().find(p=>p.category==='area');
    const path=findMapRoute({x:MARINA.x,y:MARINA.y0-.5},found);
    return {painted:text.some(t=>t.includes('SHOTENGAI')),found:!!found,district:districtAt(found.x,found.y),covered:path?.some(p=>arcadeAt(p.x,p.y))};
  });
  assert.deepEqual(result,{painted:true,found:true,district:'shotengai',covered:true});
}));

test('every island has a usable boat landing, walking access and fishing water beside it',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    fleet.length=boats.length=0;
    return WILD_ISLANDS.map(island=>{
      const b={id:'test',kind:'speedboat',name:'Test',deal:'mine',x:island.dock[0]+1,y:island.dock[1]-.3,hx:1,hy:0,v:0};
      fleet.push(b);const clear=waterClear(b,b.x,b.y,b.hx,b.hy);boardBoat(b);leaveBoat();
      const off=mode==='walk',landing=[px,py],fish=waterKind(b.x,b.y);
      for(let n=0;n<1500&&px<island.landing[0]-.02;n++)move(Math.min(.03,island.landing[0]-px),0);
      const walked=px>=island.landing[0]-.03;
      for(let n=0;n<1500&&px>landing[0]+.02;n++)move(-Math.min(.03,px-landing[0]),0);
      a=Math.atan2(b.y-py,b.x-px);const reboard=nearBoat()===b;if(reboard)useMarina();
      fleet.length=0;sea=null;mode='walk';return {name:island.name,clear,off,walked,reboard,fish};
    });
  });
  for(const island of result) {
    for(const key of ['clear','off','walked','reboard'])assert.equal(island[key],true,JSON.stringify(island));
    assert.match(island.fish,/sea|deep/);
  }
}));

test('a speedboat sails from its marina slip to Fern Island, lands and completes the return rental',()=>fixture(async page=>{
  const result=await page.evaluate(sailFernRoundTrip);
  assert.equal(result.exit.error,undefined,JSON.stringify(result));assert.equal(result.out.error,undefined,JSON.stringify(result));
  assert.equal(result.disembarked,true);assert.equal(result.reboard,true,JSON.stringify(result));
  assert.equal(result.back.error,undefined,JSON.stringify(result));assert.equal(result.returned,true,JSON.stringify(result));
  const arrival=result.exit.seconds+result.out.seconds;
  assert.ok(arrival>=60&&arrival<=125,`Fern arrival ${arrival.toFixed(1)} seconds`);
  assert.ok(result.back.seconds>=60&&result.back.seconds<=125,`Marina return ${result.back.seconds.toFixed(1)} seconds`);
  assert.equal(result.out.peak,4.8);
}));

test('keyboard cruise reaches open-water speed and releasing Shift preserves momentum',()=>fixture(async page=>{
  await page.evaluate(()=>{
    boats.length=0;const b=fleet.find(b=>b.kind==='speedboat');Object.assign(b,{x:450,y:450,hx:1,hy:0});boardBoat(b);
  });
  await page.keyboard.down('KeyW');
  assert.equal(await page.evaluate(()=>{for(let n=0;n<120;n++)stepSea(.05);return sea.v;}),1.8);
  await page.keyboard.down('ShiftLeft');
  assert.equal(await page.evaluate(()=>{for(let n=0;n<120;n++)stepSea(.05);return sea.v;}),4.8);
  assert.match(await page.evaluate(()=>marinaPrompt()),/cruising/);
  await page.keyboard.up('ShiftLeft');
  assert.ok(await page.evaluate(()=>{stepSea(.05);return sea.v>4.7&&sea.v<4.8;}));
  await page.keyboard.up('KeyW');await page.keyboard.down('KeyS');
  assert.ok(await page.evaluate(()=>{for(let n=0;n<100&&sea.v>.02;n++)stepSea(.05);return sea.v<=.02;}));
  await page.keyboard.up('KeyS');
}));

test('a phone stick cruises at full forward, returns to normal throttle and brakes when pulled back',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    boats.length=0;const b=fleet.find(b=>b.kind==='speedboat');Object.assign(b,{x:450,y:450,hx:1,hy:0});boardBoat(b);
    setStick(0,-30);for(let n=0;n<120;n++)stepSea(.05);const normal=sea.v;
    setStick(0,-50);for(let n=0;n<120;n++)stepSea(.05);const fast=sea.v,hint=marinaPrompt();
    setStick(0,-30);stepSea(.05);const eased=sea.v;
    setStick(0,50);for(let n=0;n<100&&sea.v>.02;n++)stepSea(.05);const stopped=sea.v;
    setStick(0,0);env(0);render(0);return {touch:TOUCH,normal,fast,eased,stopped,hint,keys:[K.KeyW,K.KeyS,K.ShiftLeft].some(Boolean)};
  });
  assert.equal(result.touch,true);assert.equal(result.normal,1.8);assert.equal(result.fast,4.8);
  assert.ok(result.eased>4.7&&result.eased<4.8);assert.ok(result.stopped<=.02);
  assert.match(result.hint,/full forward: cruise/);assert.equal(result.keys,false);
},true));

test('marked trails physically reach the house, airstrip and falls on ground with bounded grades',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const walks=[];
    for(const trail of FERN_TRAILS) {
      mode='walk';room=me=null;[px,py]=trail[0];body.z=body.vz=0;
      for(const [x,y]of trail.slice(1)) {
        for(let n=0;n<4000&&near(px,py,x,y)>.02;n++) {
          const d=near(px,py,x,y),step=Math.min(.025,d);move((x-px)/d*step,(y-py)/d*step);
        }
        walks.push(near(px,py,x,y)<.03);
      }
    }
    let steepest=0;
    for(let y=75;y<425;y+=.5)for(let x=465;x<820;x+=.5)if(wildIslandAt(x,y)) {
      const gx=x*TERRAIN_SCALE,gy=y*TERRAIN_SCALE,a=terrainVertex(gx,gy),b=terrainVertex(gx+1,gy),c=terrainVertex(gx,gy+1),d=terrainVertex(gx+1,gy+1);
      steepest=Math.max(steepest,Math.hypot(b-a,d-b)*2,Math.hypot(d-c,c-a)*2);
    }
    return {walks,steepest,fall:terrainHeight(627,187)-terrainHeight(627,190)};
  });
  assert.ok(result.walks.every(Boolean),JSON.stringify(result));assert.ok(result.steepest<=.281,JSON.stringify(result));assert.ok(result.fall>.2);
}));

test('a prop flies airport to rough strip, lands, takes off again and returns to the airport without damage',()=>fixture(async page=>{
  const result=await page.evaluate(flyFernRoundTrip);
  assert.ok(result.legs.every(leg=>!leg.error),JSON.stringify(result));
  assert.ok(result.legs[3].landed&&result.legs[3].x>=551&&result.legs[3].x<=617,JSON.stringify(result));
  assert.ok(result.legs[7].landed&&result.legs[7].x>=142&&result.legs[7].x<=194,JSON.stringify(result));
  assert.equal(result.craft.dmg,0);assert.equal(!!result.craft.wrecked,false);assert.equal(!!result.craft.ditched,false);
}));

test('Cabin Cove shelter is reachable from its landing, furnished, usable and saves at its real island door',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const cabin=ISLAND_CABINS.find(c=>c.id==='cabin-cove'),island=WILD_ISLANDS.find(i=>i.id==='cabin');
    const walks=[];
    function walkTo(x,y) {
      const world=mode==='room'?{width:room.W,height:room.H,wrap:false}:MAP_WORLD;
      const pass=mode==='room'?(x,y)=>room.grid[y]?.[x]==='.'&&!room.props.some(o=>o.box&&!o.walk&&inBox(o.box,x+.5,y+.5,.15)):mapWalkableCell;
      const path=findMapRoute({x:px,y:py},{x,y},world,pass);if(!path)return false;
      path.push({x,y});
      for(const target of path) {
        for(let n=0;n<1500&&near(px,py,target.x,target.y)>.025;n++) {
          const d=near(px,py,target.x,target.y),step=Math.min(mode==='room'?.08:.025,d);
          move((target.x-px)/d*step,(target.y-py)/d*step);
        }
        if(near(px,py,target.x,target.y)>.04)return false;
      }
      return true;
    }
    [px,py]=island.landing;body.z=body.vz=0;walks.push(walkTo(...cabin.door));
    const doorClear=free(...cabin.door),prompt=promptText();interact();
    const entered=room?.kind==='islandshelter',furnished=room.props.some(p=>p.draw)&&room.props.filter(p=>p.bench).length===2;
    saveGame();const saved=JSON.parse(localStorage.getItem(SAVE_KEY)).at;
    walks.push(walkTo(4,4.5));interact();const log=msgText;
    walks.push(walkTo(2.6,6));const sat=sitDown();standUp();
    walks.push(walkTo(...ROOM_DEFS.islandshelter.entry));const canLeave=nearExit();interact();
    const outside=mode==='walk'&&near(px,py,...cabin.door)<.01;
    const listing=mapDirectory().find(p=>p.id==='cabin-cove');
    return {walks,doorClear,prompt,entered,furnished,saved,log,sat,canLeave,outside,listing,home:owned.homes.length};
  });
  assert.ok(result.walks.every(Boolean),JSON.stringify(result));assert.equal(result.doorClear,true);
  assert.match(result.prompt,/enter the fishing shelter/);assert.equal(result.entered,true);assert.equal(result.furnished,true);
  assert.deepEqual([result.saved.x,result.saved.y],[492,392.2]);assert.match(result.log,/VISITORS' LOG/);
  assert.equal(result.sat,true);assert.equal(result.canLeave,true);assert.equal(result.outside,true);assert.equal(result.home,0);
  assert.equal(result.listing.kind,'shelter');assert.equal(result.listing.category,'activities');
  await page.reload();assert.equal(await page.evaluate(()=>mode==='walk'&&near(px,py,492,392.2)<.01),true);
}));

test('Juniper House offers a knock with no answer and island walls never enter a generic business',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const cabin=ISLAND_CABINS.find(c=>c.id==='juniper-house'),checks=[];
    for(const time of [12,23]) {
      tod=time;T+=2;[px,py]=cabin.door;a=-Math.PI/2;env(0);render(0);
      const prompt=promptText();interact();checks.push({prompt,msg:msgText,walk:mode==='walk',clear:free(px,py)});
    }
    const walls=[];
    for(const building of ISLAND_CABINS) {
      px=(building.x0+building.x1)/2;py=building.y0-.2;a=Math.PI/2;render(0);
      const prompt=promptText();interact();walls.push({prompt,walk:mode==='walk',msg:msgText});
    }
    return {checks,walls};
  });
  for(const r of result.checks){assert.match(r.prompt,/knock on the door/);assert.match(r.msg,/No answer/);assert.ok(r.walk&&r.clear);}
  for(const r of result.walls){assert.equal(r.walk,true);assert.doesNotMatch(r.prompt,/enter|LEASE|closed down/i);assert.doesNotMatch(r.msg,/LEASE|closed down/i);}
}));

test('phone interaction buttons say Knock at the private house and Read beside the shelter log',()=>fixture(async page=>{
  await page.evaluate(()=>{[px,py]=ISLAND_CABINS.find(c=>c.id==='juniper-house').door;a=-Math.PI/2;render(0);showTouch();});
  const button=page.locator('#touch .pad [data-key="KeyE"]');
  assert.equal(await button.textContent(),'Knock');await button.tap();
  assert.match(await page.evaluate(()=>msgText),/No answer/);
  await page.evaluate(()=>{[px,py]=ISLAND_CABINS.find(c=>c.id==='cabin-cove').door;interact();px=4;py=4.3;render(0);showTouch();});
  assert.equal(await button.textContent(),'Read');await button.tap();
  assert.match(await page.evaluate(()=>msgText),/VISITORS' LOG/);
},true));

test('Fern House has a separate reachable interior, workshop, storage, front entry and persistent contents',()=>fixture(async page=>{
  const expected=await page.evaluate(()=>{
    money=10000;[px,py]=FERN_HOUSE.door;interact();
    const bought=buyProperty('home_island',px,py);closeShop();interact();
    const home=homeRecord(),rooms=ROOM_DEFS.islandhome,reachable={};
    saveGame();const insideSaved=JSON.parse(localStorage.getItem(SAVE_KEY)).at;
    const pass=(x,y)=>room.grid[y]?.[x]==='.'&&!room.props.some(o=>o.box&&!o.walk&&o.box.z0<1.3&&inBox(o.box,x+.5,y+.5,.1));
    for(const [name,[x,y]]of Object.entries(rooms.spots))reachable[name]=!!findMapRoute({x:px,y:py},{x,y},{width:24,height:24,wrap:false},pass);
    home.decor=[{id:'yoyo',uses:0}];home.fridge=[{id:'slice',uses:1}];closet.push({id:'weed',uses:8,q:'fine'});
    const w=workshopState(home);w.owned.bench=1;w.parts=[{id:'bench',key:1,x:18,y:20,a:0}];w.supplies=7;
    leaveRoom();const front=mode==='walk'&&near(px,py,...FERN_HOUSE.door)<.01;
    [px,py]=FERN_HOUSE.terrace;interact();const closedBack=mode==='walk';
    [px,py]=FERN_HOUSE.door;interact();const reentered=mode==='room'&&homeRecord()===home;leaveRoom();saveGame();
    return {bought:bought[0],reachable,front,closedBack,reentered,insideSaved,frontDoor:[...FERN_HOUSE.door],home:JSON.parse(JSON.stringify(home)),closet:JSON.parse(JSON.stringify(closet))};
  });
  assert.equal(expected.bought,true);assert.ok(Object.values(expected.reachable).every(Boolean),JSON.stringify(expected.reachable));
  assert.equal(expected.front,true);assert.equal(expected.closedBack,true);assert.equal(expected.reentered,true);
  assert.deepEqual([expected.insideSaved.x,expected.insideSaved.y],expected.frontDoor);
  await page.reload();
  const restored=await page.evaluate(()=>({home:owned.homes.find(h=>h.kind==='home_island'),closet}));
  assert.deepEqual(restored.home.decor,expected.home.decor);assert.deepEqual(restored.home.fridge,expected.home.fridge);
  assert.deepEqual(restored.home.workshop.parts,expected.home.workshop.parts);assert.deepEqual(restored.closet,expected.closet);
}));

test('schema 4 changes array stride once while retaining outdoor positions, home contents and backup bytes',()=>fixture(async page=>{
  const expected=await page.evaluate(()=>{
    money=10000;buy('home_studio');const h=owned.homes[0];h.door=buyerDoor(h);h.decor=[{id:'yoyo',uses:0}];h.pets=[];
    workshopState(h).seeds=7;[px,py]=h.door;saveGame();const current=JSON.parse(localStorage.getItem(SAVE_KEY));
    const old=JSON.parse(JSON.stringify(current));old.v=4;old.world.layout='archipelago-v2';
    for(const home of old.homes)home.cell=Math.floor(home.cell/N)*512+home.cell%N;
    const text=JSON.stringify(old);localStorage.setItem(SAVE_KEY,text);citySaveBlocked=true;return {text,current};
  });
  await page.reload();
  const result=await page.evaluate(()=>{saveGame();return {data:JSON.parse(localStorage.getItem(SAVE_KEY)),backup:localStorage.getItem(SAVE_BACKUP_KEY)};});
  assert.equal(result.backup,expected.text);assert.equal(result.data.v,5);assert.equal(result.data.world.layout,'archipelago-v3');
  assert.deepEqual(result.data.homes,expected.current.homes);assert.deepEqual(result.data.at,expected.current.at);
  await page.reload();assert.deepEqual(await page.evaluate(()=>savedCityHomes()),result.data.homes);
}));

test('ocean destinations give boat or aircraft guidance without a mainland walking route',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    [px,py]=[MARINA.x,MARINA.y0-.5];openBigMap();const place=BIGMAP.places.find(p=>p.id==='island:fern');setMapWaypoint(place);
    const offshore={path:MAP_NAV.path,status:bigMapEl.querySelector('.route-status').textContent};
    [px,py]=WILD_ISLANDS[0].landing;setMapWaypoint(BIGMAP.places.find(p=>p.name==='Fern Falls'));
    return {offshore,local:!!MAP_NAV.path};
  });
  assert.equal(result.offshore.path,null);assert.match(result.offshore.status,/boat \/ light aircraft/);assert.equal(result.local,true);
}));

test('saving at sea resumes the rental at its actual ocean location',()=>fixture(async page=>{
  const expected=await page.evaluate(()=>{
    const b=fleet.find(b=>b.kind==='speedboat'&&b.deal==='rent');Object.assign(b,{x:500,y:320,hx:1,hy:0,hired:true});boardBoat(b);saveGame();return {x:b.x,y:b.y,id:b.id};
  });
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>({x:px,y:py,id:sea?.id,mode})),{...expected,mode:'sea'});
}));

test('saving a flight preserves the plane and player together above the ocean',()=>fixture(async page=>{
  const expected=await page.evaluate(()=>{
    const c=aircraft.find(c=>c.type==='prop');Object.assign(c,{owned:true,state:'flown',ground:false,x:500,y:220,z:5,v:3.2,pitch:0,roll:0,throttle:.6});
    pilot=c;mode='air';px=c.x;py=c.y;saveGame();return {x:c.x,y:c.y,z:c.z,id:c.id};
  });
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>({x:px,y:py,z:pilot?.z,id:pilot?.id,mode})),{...expected,mode:'air'});
  assert.equal(await page.evaluate(()=>{flyStep(pilot,{throttle:0,pitch:0,turn:0,lift:0},.05);return !pilot.wrecked&&!pilot.ditched;}),true);
}));

test('a hovering helicopter reloads with its rotor running and retains altitude',()=>fixture(async page=>{
  await page.evaluate(()=>{
    const c=aircraft.find(c=>c.type==='heli');Object.assign(c,{owned:true,state:'flown',ground:false,x:500,y:220,z:3,v:0,pitch:0,roll:0,throttle:0,rotor:1,hvx:0,hvy:0});
    pilot=c;mode='air';px=c.x;py=c.y;saveGame();
  });
  await page.reload();
  const result=await page.evaluate(()=>{
    for(let n=0;n<60;n++)flyStep(pilot,{throttle:0,pitch:0,turn:0,lift:0},1/60);
    return {mode,z:pilot.z,rotor:pilot.rotor,ditched:!!pilot.ditched};
  });
  assert.equal(result.mode,'air');assert.ok(Math.abs(result.z-3)<.01);assert.equal(result.rotor,1);assert.equal(result.ditched,false);
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,firefox}=require('playwright');
const {timeCourierRuns,timeSiteRuns,timeNightRuns}=require('./helpers/courier-runs.cjs');
let browser;
test.before(async()=>{browser=await(process.env.CITY_TEST_BROWSER==='firefox'?firefox:chromium).launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run){
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await page.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=12;env(0);render(0);});
  await run(page);assert.deepEqual(errors,[]);
 }finally{await page.close();}
}

test('the live archipelago preserves all lots on dry land and has connected finite streets',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const wet=[],badFaces=[];
  for(const p of CITY_PLACES.values())for(const k of p.cells)if(seaAt(k%N+.5,Math.floor(k/N)+.5))wet.push(p.id);
  for(const b of ARCH_BUILDINGS)for(const f of b.faces){const y=f.side?f.line:(f.start+f.end)/2;if(y<b.y0-.01||y>b.y1+.01)badFaces.push(b.sh.word);}
  const zones=GAS_STATIONS.every(s=>GAS_ZONE[idx(s.x0+4,s.y0-1)]===s&&GAS_ZONE[idx(s.x0+3,s.y0+2)]===s);
  const seam=BACKROOMS_SEAM,entrance=!!seam&&map[idx(seam.x,seam.cy)]>0&&!map[idx(seam.x-1,seam.cy)];
  const alias=GAS_STATIONS.some(s=>gasStationAt(s.x0+N,s.y0));
  const cops=footCops.length>0&&footCops.every(c=>near(c.x,c.y,...cornerXY(c.corner))<.01&&near(c.x,c.y,c.base.x,c.base.y)<15&&!seaAt(c.x,c.y));
  const starts=footCops.map(c=>[c.x,c.y]);
  for(let n=0;n<120;n++)for(const c of footCops)patrolStep(c,.05);
  const patrol=footCops.every((c,i)=>near(c.x,c.y,...starts[i])>.1&&!seaAt(c.x,c.y));
  return {layout:CITY_LAYOUT_ID,counts:CITY_LAYOUT_CHECKPOINT,wet:wet.slice(0,10),badFaces:badFaces.slice(0,10),roads:streetProblems(),wrap:MAP_WORLD.wrap,repeat:map[idx(px+N,py)],ocean:seaAt(px+N,py),coordinate:worldCoord(800),N,zones,entrance,alias,cops,patrol};
 });
 assert.equal(result.layout,'archipelago-v3');assert.equal(result.counts.places,2770);assert.equal(result.counts.homes,911);assert.equal(result.counts.people,1100);
 assert.deepEqual(result.wet,[]);assert.deepEqual(result.badFaces,[]);assert.deepEqual(result.roads,[]);assert.equal(result.wrap,false);assert.equal(result.repeat,0);assert.equal(result.ocean,true);assert.equal(result.coordinate,800);assert.equal(result.N,1024);
 assert.equal(result.zones,true);assert.equal(result.entrance,true);assert.equal(result.alias,false);
 assert.equal(result.cops,true);assert.equal(result.patrol,true);
}));

test('the northern airport is walkable from the city without crossing its runway, and a prop takes off',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  px=CAUSEWAY.x;py=104.7;body.z=body.vz=0;
  const waypoints=[[CAUSEWAY.x,AIRPORT.y0+1],[TERMINAL.x,AIRPORT.y0+1],[TERMINAL.x,TERMINAL.y-TERMINAL.hw-.2]];
  let blocked=0,runway=0;
  for(const [x,y]of waypoints)for(let n=0;n<4000&&Math.hypot(px-x,py-y)>.02;n++){
   const d=Math.hypot(x-px,y-py),before=[px,py];move((x-px)/d*Math.min(.03,d),(y-py)/d*Math.min(.03,d));
   if(onRunway(px,py))runway++;
   if(Math.hypot(px-before[0],py-before[1])<.0001){blocked++;break;}
  }
  const door=terminalDoor(px,py),plane=aircraft.find(c=>c.type==='prop');
  Object.assign(plane,{x:RUNWAY.x0+2,y:RUNWAY.y,z:0,yaw:0,v:0,vz:0,pitch:0,roll:0,ground:true,throttle:1,state:'flown'});
  for(let n=0;n<800&&!plane.wrecked&&plane.z<2;n++)flyStep(plane,{throttle:1,pitch:plane.v>PLANE_TYPES.prop.vr?.6:0,turn:0,lift:0},.05);
  return {airportY:AIRPORT.y1,north:CITY_ISLANDS[0].y0,blocked,runway,door,airborne:!plane.ground,height:plane.z,wrecked:!!plane.wrecked};
 });
 assert.ok(result.airportY<result.north);assert.equal(result.blocked,0,JSON.stringify(result));assert.equal(result.runway,0);assert.ok(result.door>=0,JSON.stringify(result));assert.equal(result.airborne,true,JSON.stringify(result));assert.ok(result.height>1);assert.equal(result.wrecked,false);
}));

test('both bridges have graded walking surfaces and all hired boat types sail under the deck',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const problems=[];boats.length=0;const heights=[];
  for(const bridge of ROAD_BRIDGES){
   mode='walk';me=null;px=bridge.x-.4;py=bridge.y0;body.z=body.vz=0;
   for(let n=0;n<960;n++){const old=py;move(0,.05);if(py===old)problems.push('walk blocked');heights.push(walkGround(px,py));}
   if(Math.abs(py-bridge.y1)>.1)problems.push('walk incomplete');
   for(const kind of ['speedboat','cruiser','sailboat'])for(const cruise of [false,true]){
    const boat={kind,x:bridge.x-4,y:197.5,hx:1,hy:0,v:0,deal:'mine'};fleet.push(boat);boardBoat(boat);K.KeyW=true;K.ShiftLeft=cruise;
    for(let n=0;n<260;n++){stepSea(.05);T+=.05;}
    K.KeyW=K.ShiftLeft=false;if(boat.x<bridge.x+2)problems.push(kind+(cruise?' cruising':'')+' blocked');fleet.splice(fleet.indexOf(boat),1);
   }
   if(!roadBridgePierAt(bridge.x+1.25,bridge.y0+bridge.ramp+2))problems.push('missing support');
   if(dryLand(bridge.x,192))problems.push('boat can jump to bridge');
  }
  mode='walk';sea=null;render(0);
  return {problems,max:Math.max(...heights),min:Math.min(...heights),clearance:roadBridgeClearance(ROAD_BRIDGES[0].x,192)};
 });
 assert.deepEqual(result.problems,[]);assert.ok(result.max>1.6);assert.ok(result.min<.02);assert.ok(result.clearance>1.05);
}));

test('trains reverse at finite terminals and no deck or station repeats offshore',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  let min=Infinity,max=-Infinity,reversed=false,last=null;
  for(let t=0;t<450;t+=.5){const train=elTrain(0,0,t);min=Math.min(min,train.x);max=Math.max(max,train.x);if(last&&last.dir!==train.dir)reversed=true;last=train;}
  return {min,max,reversed,stations:EL_STATIONS.map(s=>s.x),outside:elDeckHeight(700,EL_Y+1),station:!!elStationAt(0),trains:elTrains(0).length};
 });
 assert.ok(result.reversed);assert.equal(result.min,Math.min(...result.stations));assert.equal(result.max,Math.max(...result.stations));assert.equal(result.outside,0);assert.equal(result.station,false);assert.equal(result.trains,2);
}));

test('a coastal save migrates once with property contents, vehicles and its original bytes preserved',()=>fixture(async page=>{
 const original=await page.evaluate(()=>{
  [px,py]=citySourcePoint(41,73);money=10000;buy('home_studio');buy('car_sedan');
  closet.push({id:'weed',uses:12,q:'perfect'});carryItem({id:'neon',uses:3,q:'fine'});
  const home=owned.homes[0],state=workshopState(home);state.supplies=9;state.seeds=4;state.upgrades={controller:true,lamp:true};
  const boat=fleet.find(b=>b.deal==='rent');boat.hired=true;boat.x=228;boat.y=364;
  const plane=aircraft.find(p=>p.type==='prop');plane.owned=true;plane.forSale=false;
  mapWaypoint={id:cityHomeId(home),name:'Home',x:home.cell%N,y:Math.floor(home.cell/N)};
  home.door=buyerDoor(home);saveGame();
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)),savedHome=data.homes[0],place=cityPlaceAtCell(savedHome.cell);
  const expected={money:data.money,placeId:place.id,workshop:savedHome.workshop,door:savedHome.door.slice(),boat:[228,364],plane:[plane.x,plane.y],closet:data.closet};
  savedHome.cell=place.legacyCells.find(k=>citySourceCell(k)===savedHome.cell);savedHome.door=cityWorldSourcePoint(...savedHome.door);
  data.at={x:41,y:73,a:.4};
  for(const c of data.cars)[c.x,c.y]=cityWorldSourcePoint(c.x,c.y);
  for(const b of data.boats){b.x-=128;b.y-=144;}
  for(const p of data.planes){p.x-=128;p.y+=160;}
  [data.waypoint.x,data.waypoint.y]=cityWorldSourcePoint(data.waypoint.x,data.waypoint.y);data.v=2;data.world={layout:'coastal-v1'};
  const text=JSON.stringify(data);localStorage.removeItem(SAVE_BACKUP_KEY);localStorage.setItem(SAVE_KEY,text);citySaveBlocked=true;
  return {text,expected};
 });
 await page.reload();
 const result=await page.evaluate(()=>{saveGame();return {backup:localStorage.getItem(SAVE_BACKUP_KEY),data:JSON.parse(localStorage.getItem(SAVE_KEY)),blocked:citySaveBlocked};});
 assert.equal(result.backup,original.text);assert.equal(result.blocked,false);assert.equal(result.data.v,5);assert.equal(result.data.world.layout,'archipelago-v3');assert.equal(result.data.homes[0].placeId,original.expected.placeId);assert.deepEqual(result.data.homes[0].workshop,original.expected.workshop);assert.deepEqual(result.data.homes[0].door,original.expected.door);assert.deepEqual(result.data.closet,original.expected.closet);assert.equal(result.data.money,original.expected.money);
 assert.equal(result.data.cars.length,1);assert.deepEqual([result.data.boats[0].x,result.data.boats[0].y],original.expected.boat);assert.deepEqual([result.data.planes[0].x,result.data.planes[0].y],original.expected.plane);
 await page.reload();
 const twice=await page.evaluate(()=>{saveGame();return JSON.parse(localStorage.getItem(SAVE_KEY));});
 assert.deepEqual(twice.homes,result.data.homes);assert.deepEqual(twice.at,result.data.at);assert.deepEqual(twice.boats,result.data.boats);assert.deepEqual(twice.planes,result.data.planes);
}));

test('far ocean uses empty bounded lookups and renders without repeating streets or buildings',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  px=900;py=-400;mode='walk';room=me=null;env(0);render(0);stepTraffic(.05,T);
  return {building:map[idx(px,py)],road:ROAD[idx(px,py)],district:districtAt(px,py),water:seaAt(px,py),outside:mapTile(900,-400),lighthouse:Math.hypot(rel(px-LIGHTHOUSE.x),rel(py-LIGHTHOUSE.y))};
 });
 assert.equal(result.building,0);assert.equal(result.road,0);assert.equal(result.district,'sea');assert.equal(result.water,true);assert.equal(result.outside,'#080b10');assert.ok(result.lighthouse>500);
}));

test('cars drive both bridge grades and the finite map routes to the airport and lighthouse',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  people.length=cars.length=footCops.length=0;const trips=[];
  for(const b of ROAD_BRIDGES)for(const dir of [1,-1]) {
   const c=spawnOwnedCar('car_sedan',b.x+dir*.4,dir>0?b.y0:b.y1,0,dir,true);
   me=c;c.player=true;mode='drive';px=c.x;py=c.y;a=dir*Math.PI/2;c.travelA=a;K.KeyW=true;
   let high=0;
   for(let n=0;n<650&&Math.abs(py-(dir>0?b.y1:b.y0))>.15;n++){drive(.05);high=Math.max(high,roadGroundHeight(px,py));T+=.05;}
   trips.push({distance:Math.abs(py-(dir>0?b.y1:b.y0)),high});K.KeyW=false;cars.splice(cars.indexOf(c),1);me=null;
  }
  mode='walk';const start={x:MARINA.x,y:MARINA.y0-.5};
  const north=findMapRoute(start,{x:TERMINAL.x,y:TERMINAL.y-TERMINAL.hw-.3});
  const light=findMapRoute(start,{x:LIGHTHOUSE.x-.5,y:LIGHTHOUSE.y});
  return {trips,north:!!north,light:!!light,thin:light?.some(p=>p.x===FOOTBRIDGE.x&&p.y>FOOTBRIDGE.y0+2),invalid:north?.filter(p=>!mapWalkableCell(Math.floor(p.x),Math.floor(p.y))).length};
 });
 assert.ok(result.trips.every(t=>t.distance<.2&&t.high>1.6),JSON.stringify(result));assert.equal(result.north,true);assert.equal(result.light,true);assert.equal(result.thin,true);assert.equal(result.invalid,0);
}));

test('the relocated courier routes retain their safe crossings and faster jump routes',()=>fixture(async page=>{
 for(const run of [timeCourierRuns,timeSiteRuns,timeNightRuns]) {
  const result=await page.evaluate(run);
  assert.ok(result.every(r=>r.recipient&&r.health>0),JSON.stringify(result));
  assert.ok(result.at(-1).seconds<result[0].seconds,JSON.stringify(result));
 }
}));

test('the city has varied inhabited edges, open coves and usable waterfront landings',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const widths=[[],[]],coast=[];
  for(let y=100;y<350;y+=8){
   const blocks=[];for(let x=0;x<N;x+=8)if(cityBlockAt(x+.5,y+.5))blocks.push(x);
   if(blocks.length)widths[y<192?0:1].push(Math.max(...blocks)-Math.min(...blocks)+8);
  }
  for(let x=176;x<320;x+=2){
   let edge=168;while(!seaAt(x,edge)&&edge<186)edge+=.25;coast.push(edge);
  }
  const landings=PIERS.filter(p=>p[3]-p[1]>2).map(p=>{
   const x=(p[0]+p[2])/2,mid=(p[1]+p[3])/2;
   // A pier has both a dry approach and adjacent water somewhere along its length.
   let wet=false,dry=false;
   for(let y=p[1];y<=p[3];y+=.25){wet ||= seaAt(p[0]-.2,y)||seaAt(p[2]+.2,y);dry ||= !seaAt(x,y);}
   return {wet,dry,mid};
  });
  const walks=[];
  for(const p of PIERS.filter(p=>p[2]-p[0]<=1&&p[3]-p[1]>2)){
   const x=(p[0]+p[2])/2,north=p[1]<192,from=north?p[3]-.1:p[1]+.1,to=north?p[1]+.1:p[3]-.1;
   mode='walk';room=me=null;px=x;py=from;body.z=body.vz=0;
   for(let n=0;n<600&&Math.abs(py-to)>.02;n++)move(0,Math.sign(to-py)*Math.min(.04,Math.abs(to-py)));
   walks.push(Math.abs(py-to)<.03);
  }
  return {variance:widths.map(a=>Math.max(...a)-Math.min(...a)),coast:Math.max(...coast)-Math.min(...coast),landings,walks,
   roads:streetProblems(),doors:doors.filter(d=>map[idx(d.x,d.y)]||seaAt(d.x,d.y)).map(d=>d.sh.word).slice(0,10)};
 });
 assert.ok(result.variance.every(v=>v>=80),JSON.stringify(result));assert.ok(result.coast>4);
 assert.ok(result.landings.every(p=>p.wet&&p.dry),JSON.stringify(result.landings));
 assert.ok(result.walks.every(Boolean),JSON.stringify(result.walks));
 assert.deepEqual(result.roads,[]);assert.deepEqual(result.doors,[]);
}));

test('the previous island layout upgrades once, preserving homes in every moved neighborhood and airport aircraft',()=>fixture(async page=>{
 const original=await page.evaluate(()=>{
  owned.homes.length=0;money=50000;
  for(const patch of CITY_EDGE_NEIGHBORHOODS){
   const place=[...CITY_PLACES.values()].find(p=>p.shop.kind===SHOP_APTS&&p.legacyCells.some(k=>{
    const x=k%256,y=Math.floor(k/256);return x>=patch.x0&&x<patch.x1&&y>=patch.y0&&y<patch.y1;
   }));
   const home={kind:'home_studio',cell:place.cell,placeId:place.id,decor:[{id:'yoyo',uses:0}],fridge:[{id:'slice',uses:1}],pets:[]};
   owned.homes.push(home);home.door=buyerDoor(home);workshopState(home).seeds=7;
  }
  [px,py]=citySourcePoint(1,9);buy('car_sedan');
  const plane=aircraft.find(p=>p.type==='prop');plane.owned=true;plane.forSale=false;
  closet.push({id:'weed',uses:12,q:'perfect'});saveGame();
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)),expected=JSON.parse(JSON.stringify(data));
  function previous(x,y){const [sx,sy]=cityWorldSourcePoint(x,y);return [sx+128,sy+(sy<72?96:144)];}
  for(const h of data.homes){const [x,y]=previous(h.cell%N,Math.floor(h.cell/N));h.cell=y*512+x;h.door=previous(...h.door);}
  [data.at.x,data.at.y]=previous(data.at.x,data.at.y);
  for(const c of data.cars)[c.x,c.y]=previous(c.x,c.y);
  data.v=3;data.world={layout:'archipelago-v1'};
  const text=JSON.stringify(data);localStorage.setItem('ascii-city-save-backup-v2-coastal-v1','older coastal backup');
  localStorage.setItem(SAVE_KEY,text);citySaveBlocked=true;
  return {text,expected};
 });
 await page.reload();
 const result=await page.evaluate(()=>{saveGame();return {data:JSON.parse(localStorage.getItem(SAVE_KEY)),backup:localStorage.getItem(SAVE_BACKUP_KEY),older:localStorage.getItem('ascii-city-save-backup-v2-coastal-v1'),blocked:citySaveBlocked};});
 assert.equal(result.data.v,5);assert.equal(result.data.world.layout,'archipelago-v3');assert.equal(result.blocked,false);
 assert.equal(result.backup,original.text);assert.equal(result.older,'older coastal backup');
 assert.deepEqual(result.data.homes,original.expected.homes);assert.deepEqual(result.data.cars,original.expected.cars);
 assert.deepEqual(result.data.planes,original.expected.planes);assert.deepEqual(result.data.closet,original.expected.closet);
 assert.deepEqual(result.data.at,original.expected.at);assert.equal(result.data.money,original.expected.money);
 await page.reload();
 const twice=await page.evaluate(()=>{saveGame();return {data:JSON.parse(localStorage.getItem(SAVE_KEY)),backup:localStorage.getItem(SAVE_BACKUP_KEY)};});
 assert.deepEqual(twice.data.homes,result.data.homes);assert.deepEqual(twice.data.at,result.data.at);assert.equal(twice.backup,original.text);
}));

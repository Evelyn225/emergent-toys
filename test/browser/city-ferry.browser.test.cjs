'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,firefox}=require('playwright');
const PAGE=pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href;
let browser;
test.before(async()=>{browser=await(process.env.CITY_TEST_BROWSER==='firefox'?firefox:chromium).launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run){
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});await page.goto(PAGE);
  await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=ferryClockOffset=0;tod=12;body.z=body.vz=body.crouch=0;rain=snow=snowCover=0;money=500;env(0);render(0);});
  await run(page);assert.deepEqual(errors,[]);
 }finally{await page.close();}
}

test('both ferries complete safe continuous loops and every terminal has a dry landing',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  let collisions=0,separation=Infinity,maxTurn=0,maxStep=0;const previous=[];
  for(let t=0;t<FERRY.cycle;t+=.25){
   const ships=Array.from({length:FERRY.count},(_,id)=>ferryShip(id,t));separation=Math.min(separation,Math.hypot(ships[0].x-ships[1].x,ships[0].y-ships[1].y));
   for(const ship of ships){
    const prev=previous[ship.id];if(prev){maxTurn=Math.max(maxTurn,Math.abs(mod(ship.yaw-prev.yaw+Math.PI,Math.PI*2)-Math.PI));maxStep=Math.max(maxStep,Math.hypot(ship.x-prev.x,ship.y-prev.y));}previous[ship.id]=ship;
    for(let u=-FERRY.hl;u<=FERRY.hl;u+=.3)for(const v of [-FERRY.hw,0,FERRY.hw]){const[x,y]=ferryPoint(ship,u,v);if(!seaAt(x,y)||onPier(x,y)||roadBridgePierAt(x,y)||roadBridgeClearance(x,y)<.65)collisions++;}
   }
  }
  return{collisions,separation,maxTurn,maxStep,stops:FERRY_STOPS.map(s=>({id:s.id,dry:dryLand(...s.land),dock:ferryShip(0,s.time+.1).stopped,wait:nextFerry(s).wait})),cycle:FERRY.cycle};
 });
 assert.equal(result.collisions,0,JSON.stringify(result));assert.ok(result.separation>5,JSON.stringify(result));
 assert.ok(result.maxTurn<.06,JSON.stringify(result));assert.ok(result.maxStep<.54,JSON.stringify(result));assert.equal(result.stops.length,6);
 for(const stop of result.stops){assert.equal(stop.dry,true,JSON.stringify(stop));assert.equal(stop.dock,true,JSON.stringify(stop));assert.ok(stop.wait>=0&&stop.wait<result.cycle/2,JSON.stringify(stop));}
}));

test('real keys board, walk through the lounge, stop at glass and furniture, sit and stand',()=>fixture(async page=>{
 await page.evaluate(()=>{[px,py]=FERRY_STOPS[0].land;a=Math.PI/2;});
 await page.keyboard.press('e');
 assert.deepEqual(await page.evaluate(()=>({mode,money})),{mode:'ferry',money:496});
 const walk=await page.evaluate(()=>{
  const press=(yaw,seconds)=>{a=ferryShip(ferryRide.id).yaw+yaw;K.KeyW=1;for(let t=0;t<seconds;t+=.05)stepFerryRide(.05);K.KeyW=0;};
  // Leave the boarding gate, use the aft doorway, then reach the port aisle.
  press(Math.PI,.3);press(Math.PI/2,1.6);press(0,1.25);const lounge=ferryRide.u>-.95&&Math.abs(ferryRide.v)<.12;
  press(-Math.PI/2,.6);press(0,1.7);const aisle={u:ferryRide.u,v:ferryRide.v};
  ferryRide.u=.2;ferryRide.v=-.22;ferrySync();
  press(-Math.PI/2,5);const glass=Math.abs(ferryRide.v)<.44;
  press(Math.PI/2,5);const counter=Math.abs(ferryRide.v)>.11;
  const k=FERRY_SEATS.findIndex((s,k)=>s.inside&&!ferrySeatOccupied(0,k));ferryRide.u=FERRY_SEATS[k].u;ferryRide.v=Math.sign(FERRY_SEATS[k].v)*.22;ferrySync();
  return{lounge,aisle,glass,counter,k};
 });
 for(const key of ['lounge','glass','counter'])assert.equal(walk[key],true,JSON.stringify(walk));
 await page.keyboard.press('c');assert.equal(await page.evaluate(()=>ferryRide.seat),walk.k);
 await page.keyboard.press('c');assert.equal(await page.evaluate(()=>ferryRide.seat),null);
 assert.equal(await page.evaluate(()=>ferryWalkClear(ferryRide.u,ferryRide.v)),true);
}));

test('café purchases can be eaten aboard and the window view changes during a voyage',()=>fixture(async page=>{
 await page.evaluate(()=>{[px,py]=FERRY_STOPS[0].land;useFerry();ferryRide.u=.5;ferryRide.v=-.22;ferrySync();});
 await page.keyboard.press('e');assert.equal(await page.evaluate(()=>shopCtx.title),'ISLAND FERRY CAFÉ');
 await page.click('[data-buy="sandwich"]');await page.keyboard.press('e');
 const before=await page.evaluate(()=>{held=inv.findIndex(i=>i.id==='sandwich');needs.food=40;return{food:needs.food,uses:heldItem().uses,money};});
 await page.keyboard.press('q');
 const after=await page.evaluate(()=>({food:needs.food,uses:heldItem().uses,money}));assert.ok(after.food>before.food);assert.ok(after.uses<before.uses);assert.equal(after.money,489);
 const views=await page.evaluate(()=>{
  ferryRide.u=-.7;ferryRide.v=-.22;a=-Math.PI/2;pitch=0;T=1;ferrySync();render(0);
  const snapshot=()=>{let sky=0,water=0;for(let i=0;i<CH.length;i++){if(FL[i]===3)water++;if(ZB[i]===Infinity)sky++;}return{sky,water,frame:CH.join('')+Array.from(COL).join(',')};};
  const first=snapshot();T=FERRY.dwell+65;ferrySync();render(0);const second=snapshot();return{first:{sky:first.sky,water:first.water},second:{sky:second.sky,water:second.water},changed:first.frame!==second.frame};
 });
 assert.ok(views.first.water>50,JSON.stringify(views));assert.ok(views.second.water>50,JSON.stringify(views));assert.equal(views.changed,true);
}));

test('a moving ferry journey and seat survive reload, then allow a dry island landing and return boarding',()=>fixture(async page=>{
 const saved=await page.evaluate(()=>{
  [px,py]=FERRY_STOPS[0].land;useFerry();T=FERRY.dwell+35;const k=FERRY_SEATS.findIndex((s,k)=>s.inside&&!ferrySeatOccupied(0,k));
  ferryRide.u=FERRY_SEATS[k].u;ferryRide.v=Math.sign(FERRY_SEATS[k].v)*.22;ferrySeatToggle();a+=.2;pitch=.12;ferrySync();saveGame();return {ship:ferryShip(ferryRide.id),seat:ferryRide.seat,u:ferryRide.u,v:ferryRide.v,a,pitch,money};
 });
 await page.reload();
 const loaded=await page.evaluate(()=>({mode,ship:ferryShip(ferryRide.id),seat:ferryRide.seat,u:ferryRide.u,v:ferryRide.v,a,pitch,money}));
 assert.equal(loaded.mode,'ferry');for(const key of ['seat','u','v','money'])assert.equal(loaded[key],saved[key],key);
 for(const key of ['x','y','yaw'])assert.ok(Math.abs(loaded.ship[key]-saved.ship[key])<1e-9,key);
 assert.ok(Math.abs(loaded.a-saved.a)<1e-9);assert.equal(loaded.pitch,saved.pitch);
 const landing=await page.evaluate(()=>{
  paused=false;const target=FERRY_STOPS[1];T=target.time-ferryClockOffset+.5;stepFerryRide(0);ferryRide.seat=null;ferryRide.u=-.98;ferryRide.v=-.51;ferrySync();useFerry();
  const landed=mode==='walk'&&dryLand(px,py),at=[px,py];useFerry();return{landed,at,reboard:mode==='ferry',stop:ferryShip(ferryRide.id).stop};
 });
 assert.equal(landing.landed,true,JSON.stringify(landing));assert.equal(landing.reboard,true);assert.equal(landing.stop,1);
}));

test('every island supports affordable return boarding, with bounded waiting time and map directions',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const rows=[];for(const stop of FERRY_STOPS){
   mode='walk';ferryRide=null;[px,py]=stop.land;T=stop.time+FERRY.dwell+1;ferryClockOffset=0;
   const before=T,cash=money;useFerry();const ship=ferryShip(ferryRide.id);
   const aboard=ship.stopped&&ship.stop===FERRY_STOPS.indexOf(stop),waited=T-before,paid=cash-money;
   useFerry();rows.push({id:stop.id,aboard,waited,paid,ashore:mode==='walk'&&dryLand(px,py)});
  }
  const stop=FERRY_STOPS[0];mode='walk';[px,py]=stop.land;money=0;const before=T;useFerry();
  return{rows,refused:mode==='walk'&&T===before,listed:mapDirectory().filter(p=>p.kind==='ferry').length};
 });
 for(const row of result.rows){assert.equal(row.aboard,true,JSON.stringify(row));assert.equal(row.ashore,true,JSON.stringify(row));assert.equal(row.paid,4);assert.ok(row.waited<=20.001,JSON.stringify(row));}
 assert.equal(result.refused,true);assert.equal(result.listed,6);
}));

test('phone actions expose ferry boarding, café and seating controls',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  [px,py]=FERRY_STOPS[0].land;const board=touchActions().some(a=>a[1]==='KeyE');useFerry();
  const seat=touchActions().some(a=>a[1]==='KeyC'),bag=touchActions().some(a=>a[1]==='KeyI');
  ferryRide.u=.5;ferryRide.v=-.22;ferrySync();const cafe=touchActions().find(a=>a[1]==='KeyE')?.[0];
  inv.length=0;carryItem({id:'water',uses:3});held=0;const drink=touchActions().some(a=>a[1]==='KeyQ');
  return{board,seat,bag,cafe,drink};
 });
 for(const key of ['board','seat','bag','drink'])assert.equal(result[key],true,JSON.stringify(result));assert.match(result.cafe,/caf/i);
}));

test('exiting freecam onto either ferry keeps the player aboard at that position',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const out=[];for(let id=0;id<FERRY.count;id++){
   const ship=ferryShip(id),[x,y]=ferryPoint(ship,-1.12,0);mode='walk';ferryRide=null;
   freecam={x,y,z:FERRY.deck+.17,yaw:ship.yaw+.3,pitch:.1};leaveFreecam();
   out.push({id,mode,ride:ferryRide?.id,error:Math.hypot(px-x,py-y),look:Math.abs(a-ship.yaw-.3)});
  }return out;
 });
 for(const row of result){assert.equal(row.mode,'ferry',JSON.stringify(row));assert.equal(row.ride,row.id);assert.ok(row.error<1e-8);assert.ok(row.look<1e-8);}
}));

test('a seated passenger can wait to each island without a long forced voyage',()=>fixture(async page=>{
 await page.evaluate(()=>{[px,py]=FERRY_STOPS[0].land;useFerry();const k=FERRY_SEATS.findIndex((s,k)=>s.inside&&!ferrySeatOccupied(0,k));ferryRide.u=FERRY_SEATS[k].u;ferryRide.v=Math.sign(FERRY_SEATS[k].v)*.22;ferrySeatToggle();});
 for(let stop=1;stop<=5;stop++){
  const before=await page.evaluate(()=>T);await page.keyboard.press('Space');
  const result=await page.evaluate(()=>({mode,ship:ferryShip(ferryRide.id),seated:ferryRide.seat!=null,time:T,button:touchActions().some(a=>a[1]==='Space')}));
  assert.equal(result.mode,'ferry');assert.equal(result.ship.stop,stop);assert.equal(result.ship.stopped,true);assert.equal(result.seated,true);assert.equal(result.button,true);assert.ok(result.time-before<=20.001);
 }
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch();});test.after(async()=>browser?.close());
async function fixture(fn){const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=true;actx=null;env(0);render(0);clearWanted();});await fn(page);assert.deepEqual(errors,[]);}finally{await page.close();}}

test('indoor deaths leave a rendered blood pool confined to the building',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('store',{word:'BODEGA',cell:[100,100],ret:[100,101,0]},[5,5,-Math.PI/2]);
  const p=room.props.find(p=>p.fig&&!p.still);p.x=5;p.y=2.4;killRoomFigure(p,0,-1);T+=4;
  let boxes=0;const original=drawBox;drawBox=(...args)=>{boxes++;return original(...args);};
  drawBlood();const indoor=boxes;mode='walk';drawBlood();const street=boxes-indoor;mode='room';room.cell=[101,100];drawBlood();drawBox=original;
  return {indoor,street,other:boxes-indoor-street,dead:p.dead,pose:downPose(p.down),pool:pools.at(-1)};
 });assert.equal(r.dead,true);assert.equal(r.pose,'dead');assert.equal(r.indoor,1);assert.equal(r.street,0);assert.equal(r.other,0);assert.equal(r.pool.scale,10);
}));

test('the el has physical walls, a walkable aisle, empty usable seats and changing passengers',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  room=null;mode='el';T=14;ride={tr:0,k:0,car:0,off:0,side:0};stepElRide(0);a=0;
  const start=ride.off;K.KeyW=true;for(let n=0;n<20;n++)stepElRide(.02);K.KeyW=false;const walked=ride.off>start+.04;
  K.KeyD=true;for(let n=0;n<200;n++)stepElRide(.02);K.KeyD=false;const walls=Math.abs(ride.side)<=EL_HW-.04+1e-9;
  const p1=elPassengerSet(0,0,14),p2=elPassengerSet(0,0,50),changes=p1.map(p=>p.seed).join()!==p2.map(p=>p.seed).join(),boarding=elPassengerSet(0,0,4).some(p=>p.boarding);
  T=14;const passengers=elPassengerSet(0,0,T);let seat;
  for(const u of [-.69,0,.69])for(const side of [-1,1])if(!passengers.some(p=>p.car===0&&p.seated&&p.u===u&&p.side===side))seat={u,side};
  ride.off=seat.u;ride.side=0;elSeatToggle();const seated=!!ride.seat;elSeatToggle();const standing=!ride.seat;const aisle=ride.side===0;const stoodAt=ride.off;a=0;K.KeyW=true;stepElRide(.1);K.KeyW=false;const walkedAfterStanding=ride.off>stoodAt;
  T=1;const train=elTrain(0,0,T);const hull=elTrainBodyAt(train.x,EL_TRACK[0],EL_TOP),below=elTrainBodyAt(train.x,EL_TRACK[0],0),platform=elTrainBodyAt(train.x,EL_PLAT[0],EL_TOP);
  return {walked,walls,changes,boarding,seated,standing,aisle,walkedAfterStanding,hull,below,platform};
 });assert.deepEqual(r,{walked:true,walls:true,changes:true,boarding:true,seated:true,standing:true,aisle:true,walkedAfterStanding:true,hull:true,below:false,platform:false});
}));

test('arrival displays follow the actual timetable and stair handrails meet the widened boarding deck',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const errors=[];
  for(const s of EL_STATIONS)for(const tr of [0,1]){
   const arrival=elNextArrival(s,tr,19),actual=elTrain(tr,arrival.k,19+arrival.seconds);
   if(!actual.stopped||EL_STATIONS[actual.station]!==s||actual.next!==arrival.next)errors.push('timetable');
   const st=s.stairs[tr],y=st.oy+st.ay*ELS.top,x=st.ox+st.c*(st.off+(ELS.u3+ELS.u4)/2);
   if(elDeckHeight(x,y)!==EL_TOP||!elPlatformAt(x,y)||Math.abs(y-(tr?EL_Y1+EL_PLATFORM_OUT:EL_Y0-EL_PLATFORM_OUT))>1e-8)errors.push('seam');
  }
  return {errors,here:elNextArrival(EL_STATIONS[0],0,1).seconds};
 });assert.deepEqual(r,{errors:[],here:0});
}));

test('hotel tiers have reachable bathrooms, usable sofas and TVs, with kitchens in paid hotel rooms',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const result=[];
  for(const tier of [0,1,2]){
   const def=tier===0?ROOM_DEFS.motelRoom:tier===1?ROOM_DEFS.hotelroom:ROOM_DEFS.hotelSuite;
   enterRoom('hotelroom',{suite:tier===2,lobby:{word:tier===0?'MOTEL':'HOTEL',ret:[100,100,0]}},def.entry);
   const seats=room.props.filter(p=>p.seat),seated=seats.length,amenities=def.hotelAmenities;[px,py]=[seats[0].x,seats[0].y+.65];const sitting=sitDown()&&!!body.seat;standUp();[px,py]=def.entry;
   const route=roomPath(px,py,room.W-2.5,3.5);
   [px,py]=amenities.tvApproach;a=Math.atan2(amenities.tv[1]-py,amenities.tv[0]-px);render(0);interact();const tv=room.tv===true;
   let cooking=false;if(amenities.stove){[px,py]=[amenities.stove[0]-1,amenities.stove[1]];a=Math.atan2(amenities.stove[1]-py,amenities.stove[0]-px);render(0);interact();cooking=cookCtx?.on==='stove';hidePanel(cookEl);}
   env(0);render(0);result.push({tier,w:room.W,h:room.H,seated,sitting,tv,cooking,bath:route.length>0,windows:!!room.exterior});
  }return result;
 });for(const o of r){assert.ok(o.seated>=3);assert.equal(o.sitting,true);assert.equal(o.tv,true);assert.equal(o.cooking,o.tier>0);assert.equal(o.bath,true);assert.equal(o.windows,true);}assert.ok(r[2].w*r[2].h>r[1].w*r[1].h);
}));

test('coastal gatherings and relocated cranes stay on clear dry ground, with night-only campfires',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[];for(const group of COAST_GATHERINGS){if(seaAt(group.x,group.y)||onPier(group.x,group.y)||ROAD[idx(group.x,group.y)]||map[idx(group.x,group.y)])bad.push([group.x,group.y]);}
  tod=14;rain=0;const day=coastFigureTargets().length;tod=23;const nightPeople=coastFigureTargets().length;
  return {groups:COAST_GATHERINGS.length,bad,day,nightPeople,fires:FIRES.filter(o=>o.nightOnly).length,flowers:ISLAND_FLOWERS.length,cranes:cranes.some(c=>onPier(c.x,c.y))};
 });assert.ok(r.groups>=12);assert.deepEqual(r.bad,[]);assert.ok(r.day>r.nightPeople&&r.nightPeople>0);assert.ok(r.fires>=4);assert.ok(r.flowers>50);assert.equal(r.cranes,false);
}));

test('boat side look leaves the hull heading unchanged, the telescope magnifies once, and freecam is faster',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  room=null;mode='sea';sea=fleet[0];a=0;look=0;paused=false;turnBy(350,0);const helm=seaCam(.1,false),hull=a;
  mode='walk';clearInventory();carryItem({id:'telescope',uses:0});held=0;fx.telescope=false;env(0);render(0);const base=projX;useHeldItem();render(0);const zoom=projX/base;useHeldItem();const lowered=!telescopeActive();
  freecam={x:0,y:0,z:1,yaw:0,pitch:0};K.KeyW=true;stepFreecam(1);const baseSpeed=freecam.x;K.ShiftLeft=true;stepFreecam(1);const sprintSpeed=freecam.x-baseSpeed;K.KeyW=K.ShiftLeft=false;freecam=null;return {helm:helm[2],hull,zoom,lowered,baseSpeed,sprintSpeed};
 });assert.ok(r.helm>.5);assert.equal(r.hull,0);assert.ok(r.zoom>5);assert.equal(r.lowered,true);assert.ok(Math.abs(r.baseSpeed-2.4)<1e-8);assert.ok(Math.abs(r.sprintSpeed-12)<1e-8);
}));

test('bridge decks accumulate snow and water beneath them stays water above and below the span',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  mode='roof';room=null;const b=ROAD_BRIDGES[0];roofH=2.2;px=b.x-1.4;py=b.y0+b.ramp+2;a=.6;pitch=-.4;snowCover=1;env(0);
  let snow=0;const original=paintSettledSnow;paintSettledSnow=(i,x,y,L,exposure,wear,z)=>{original(i,x,y,L,exposure,wear,z);if(roadBridgeAt(x,y)&&z>1&&(BG[i]>>4)===WHITE)snow++;};render(0);paintSettledSnow=original;
  const water=[];for(const z of [.17,3]){eye=z;const row=rows-3,d=eye*projY/(row-hor+.5),wx=b.x,wy=(b.y0+b.y1)/2;floorBaseCell(0,row,0,(wx-px)/d,(wy-py)/d);water.push(FL[0]>=3);}
  return {snow,water};
 });assert.ok(r.snow>20,JSON.stringify(r));assert.deepEqual(r.water,[true,true]);
}));

test('hotel and lighthouse windows use the actual exterior geometry and a station display renders its timetable',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  let calls=0;const original=homeCityView;homeCityView=(...args)=>{calls++;return original(...args);};
  enterRoom('lamproom',{ret:[LIGHTHOUSE.x,LIGHTHOUSE.y,0]},[2,4.4,-Math.PI/2]);env(0);render(0);const lighthouse=calls;
  enterRoom('hotelroom',{suite:true,lobby:{word:'GRAND HOTEL',ret:[200,248,0]}},[11,3,-Math.PI/2]);env(0);render(0);const hotel=calls-lighthouse;homeCityView=original;
  room=null;T=13;elUp({s:EL_STATIONS[0],tr:0});px=EL_STATIONS[0].x;py=EL_PLAT[0];a=-Math.PI/2;pitch=.35;env(0);render(0);
  const display=CH.filter((ch,i)=>ch!==' '&&COL[i]===C(YEL,15)&&ZB[i]<1).length;
  return {lighthouse,hotel,display};
 });assert.ok(r.lighthouse>100);assert.ok(r.hotel>100);assert.ok(r.display>10,JSON.stringify(r));
}));

test('getting off at either end of a carriage leaves room inside the platform railings',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const errors=[];
  for(const tr of [0,1])for(const car of [-1,1])for(const end of [-1,1]){
   T=tr?109:1;room=null;mode='el';ride={tr,k:0,car,off:car*EL_CAR_LEN+end*(EL_HL-.04),side:0};stepElRide(0);elGetOff();
   if(!elPlatformAt(px,py)||elPlatformRailAt(px,py,EL_TOP)||!free(px+(plat.s.x-px>0?.04:-.04),py))errors.push([tr,car,end,px,py]);
  }
  return errors;
 });assert.deepEqual(r,[]);
}));

test('passenger turnover reserves the player seat, and freecam keeps its own C key',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  room=null;mode='el';T=50;ride={tr:0,k:0,car:0,off:0,side:0};
  const p=elPassengerSet(0,0,T).find(p=>p.car===0&&p.seated);ride.seat={u:p.u,side:p.side};ride.off=p.u;ride.side=p.side*.1;
  const hasRider=()=>elPassengerSet(0,0,T).some(o=>o.car===0&&o.seated&&o.side===p.side&&o.u===p.u);
  const reserved=!hasRider(),seat=ride.seat;ride.seat=null;const remainsEmpty=!hasRider();ride.seat=seat;
  freecam={x:0,y:0,z:2,yaw:0,pitch:0};paused=false;audioStart=()=>{};onkeydown({code:'KeyC',repeat:false,preventDefault(){}});
  const camera=K.KeyC===1&&!!ride.seat;K.KeyC=0;freecam=null;return {reserved,remainsEmpty,camera};
 });assert.deepEqual(r,{reserved:true,remainsEmpty:true,camera:true});
}));

test('motel bathroom opens beside the shower and its television faces the bed and sofa',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  paused=false;
  enterRoom('hotelroom',{lobby:{word:'MOTEL',ret:[100,100,0]}},ROOM_DEFS.motelRoom.entry);
  const {tv,tvAngle,tvApproach}=room.def.hotelAmenities,bed=room.props.find(p=>p.furniture==='bed'),head=room.props.find(p=>p.furniture==='headboard'),seat=room.props.find(p=>p.seat);
  for(const d of room.bathroomDoors||[]){d.bathroomDoor.open=d.bathroomDoor.target=1;d.box=null;} // (the bathroom door starts shut: open it, as you would with E)
  const route=[[4.5,4.8],[5.5,4.8],[6.5,4.8],[6.5,3.5],[8.4,3.5],[8.4,5.4]];
  const clear=route.every(p=>free(...p))&&route.slice(1).every((p,k)=>roomWalkLine(...route[k],...p));
  const ahead=(tv[0]-bed.x)*(bed.x-head.x)+(tv[1]-bed.y)*(bed.y-head.y)>0;
  const normal=[-Math.sin(tvAngle),Math.cos(tvAngle)],screenFacesSeat=(seat.x-tv[0])*normal[0]+(seat.y-tv[1])*normal[1]>0;
  const seatFacesScreen=(tv[0]-seat.x)*seat.fx+(tv[1]-seat.y)*seat.fy>0;
  const approach=free(...tvApproach);[px,py]=tvApproach;a=Math.atan2(tv[1]-py,tv[0]-px);render(0);
  return{clear,ahead,screenFacesSeat,seatFacesScreen,approach};
 });
 for(const [k,v]of Object.entries(r))assert.ok(v,k+': '+JSON.stringify(r));
 await page.keyboard.press('e');assert.equal(await page.evaluate(()=>room.tv),true);
}));

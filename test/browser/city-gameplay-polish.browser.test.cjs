'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),path=require('node:path'),{pathToFileURL}=require('node:url');
let browser;test.before(async()=>{browser=await chromium.launch();});test.after(async()=>{await browser?.close();});
async function fixture(run){
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{lockMouse=()=>{};paused=false;mode='walk';room=me=null;clearWanted();sleep=game=null;clearInventory();T=10;tod=12;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
test('shots hit a real indoor clerk, stop at room furniture and leave the clerk unable to trade',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('pawn',{word:'PAWN',ret:[px,py,a]},[6,4,0]);paused=false;clearInventory();carryItem({id:'revolver',uses:6});
  const clerk=room.props.find(s=>s.fig&&Math.hypot(s.x-6,s.y-1.55)<.1);
  const clear=traceRoomShot(6,3.8,1.65,0,-1,0);
  room.props.push(BX(6,3,1,.1,0,2,solid(GRAY)));const blocked=traceRoomShot(6,3.8,1.65,0,-1,0);room.props.pop();
  const shot=fireGun(6,3.8,1.65,-Math.PI/2,0,true);px=6;py=3;
  render(0);return {clear:clear.who===clerk,blocked:blocked.what,dead:clerk.dead,shot:shot.what,indoors:shot.indoors,trade:!!nearKeeper(),talk:!!roomPerson()};
 });
 assert.equal(r.clear,true);assert.equal(r.blocked,'wall');assert.equal(r.dead,true);assert.equal(r.shot,'person');assert.equal(r.indoors,true);assert.equal(r.trade,false);
}));
test('stationary anglers are real gun targets and cannot keep fishing or talking after being hit',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  people.length=cars.length=footCops.length=0;
  const o=ANGLERS[0],x=o.x-.25,y=o.y,z=outdoorGroundHeight(o.x,o.y)+.14;
  px=x;py=y;mode='walk';clearInventory();carryItem({id:'revolver',uses:6});
  const hit=traceShot(x,y,z,1,0,0);const shot=fireGun(x,y,z,0,0);px=o.x;py=o.y;
  render(0);return {target:hit.who===o,shot:shot.what,dead:o.dead,talk:!!nearAngler()};
 });
 assert.equal(r.target,true);assert.equal(r.shot,'person');assert.equal(r.dead,true);assert.equal(r.talk,false);
}));
test('arrest closes dev tools and blocks trigger, reload and item use even if another UI resumes the world',()=>fixture(async p=>{
 await p.evaluate(()=>{carryItem({id:'revolver',uses:6});openDev();wanted.stars=1;money=1000;openBusted();paused=false;desktopMouseCaptured=true;});
 await p.mouse.click(900,500);await p.keyboard.press('KeyQ');await p.keyboard.press('KeyR');await p.keyboard.press('F2');
 const r=await p.evaluate(()=>{
  const rounds=heldItem().uses,shot=fireGun(px,py,eye,a,0),reload=reloadGun();
  clearInventory();carryItem({id:'coffee',uses:3});useHeldItem();useHeld({indoors:false});
  return {rounds,shot,reload,uses:heldItem().uses,dev:devOpen(),arrest:bustedEl.style.display};
 });
 assert.deepEqual(r,{rounds:6,shot:null,reload:null,uses:3,dev:false,arrest:'flex'});
}));
test('the dev catalogue covers live inventory items and spawns a loaded gun, weighed fish and cooked meals',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const entries=devItems(),missing=Object.values(ITEMS).filter(it=>!['car','home','tattoo','look'].includes(it.kind)&&!entries.some(e=>e[1]===it.name)).map(it=>it.name);
  devGive('revolver');devGive('cod');devGive('panfish');return {missing,inv:inv.map(it=>({...it}))};
 });
 assert.deepEqual(r.missing,[]);assert.equal(r.inv[0].uses,6);assert.ok(r.inv[1].kg>0);assert.equal(r.inv[2].q,'fine');
}));
test('keys, ordinary gear and drinks stay steady during use',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  money=10000;buy('car_sedan');const key=inv.find(it=>ITEMS[it.id].kind==='keys');
  animateHeldUse(key);T+=.2;const keys=heldGesture(key,16);
  const compass={id:'compass',uses:0};animateHeldUse(compass);T+=.2;const gear=heldGesture(compass,16);
  const drink={id:'coffee',uses:3};animateHeldUse(drink);T+=.2;return {keys,gear,drink:heldGesture(drink,16)};
 });
 const still={x:0,y:0,angle:0,sx:1,sy:1};assert.deepEqual(r.keys,still);assert.deepEqual(r.gear,still);assert.deepEqual(r.drink,still);
}));
test('a corpse lies flat, can be searched from either side, and pays once without a minigame or victim report',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const person=people[0];person.hidden=false;people.splice(1);killFigure(person,1,0);px=person.x+.1;py=person.y;mode='walk';clearWanted();reports.length=0;
  const before=money,target=pickTarget();pickpocket(person);const first=money;pickpocket(person);
  const body=figBody(streetLook(person),'dead'),zs=body.parts.map(q=>q.k===2?Math.max(q.a[2],q.b[2])+q.r:q.c[2]+(q.k===1?q.ax.reduce((n,ax,k)=>n+Math.abs(ax[2])*q.h[k],0):Math.hypot(...q.ax.map((ax,k)=>ax[2]*q.r[k]))));
  return {target:target===person,cash:first-before,again:money-first,game:!!game,reports:reports.length,stars:wanted.stars,height:Math.max(...zs),line:msgText};
 });
 assert.equal(r.target,true);assert.ok(r.cash>0);assert.equal(r.again,0);assert.equal(r.game,false);assert.equal(r.reports,0);assert.equal(r.stars,0);assert.ok(r.height<11);assert.match(r.line,/empty/);
}));

test('freecam resumes at the camera on foot, indoors and on a safe roof',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const road=ROAD.findIndex((r,k)=>r && !map[k] && !solidAt(k%N+.5,Math.floor(k/N)+.5,.1));
  const x=road%N+.5,y=Math.floor(road/N)+.5;
  body.ground=5;body.groundMode='walk';body.crouch=1;
  toggleFreecam();Object.assign(freecam,{x,y,z:walkGround(x,y)+.47,yaw:1.2,pitch:.3});toggleFreecam();
  const outside={x:px,y:py,z:body.z,yaw:a,pitch,mode};stepBody(.01);const stable=Math.abs(body.z-3)<.01&&body.crouch===0;
  enterRoom('home',{ret:[x,y,0]},ROOM_DEFS.home.entry);toggleFreecam();Object.assign(freecam,{x:10.5,y:10,z:2,yaw:.8,pitch:.2});toggleFreecam();
  const inside={x:px,y:py,z:body.z,mode,open:free(px,py)};
  toggleFreecam();Object.assign(freecam,{x:0,y:0});toggleFreecam();const wallEscape=free(px,py);
  devFree();const b=ARCH_BUILDINGS[0];toggleFreecam();Object.assign(freecam,{x:b.x0+.5,y:b.y0+.5,z:.2});toggleFreecam();
  return {x,y,outside,stable,inside,wallEscape,roof:{mode,open:free(px,py),height:roofH}};
 });
 assert.equal(r.outside.x,r.x);assert.equal(r.outside.y,r.y);assert.ok(Math.abs(r.outside.z-3)<1e-6);assert.equal(r.outside.yaw,1.2);assert.equal(r.outside.pitch,.3);assert.equal(r.outside.mode,'walk');assert.equal(r.stable,true);
 assert.deepEqual(r.inside,{x:10.5,y:10,z:2-1.7,mode:'room',open:true});assert.equal(r.wallEscape,true);assert.equal(r.roof.mode,'roof');assert.equal(r.roof.open,true);assert.ok(r.roof.height>0);
}));
test('each apartment has a wall shelf, reachable fixtures, clear bedside sleep and an open curved bath',()=>fixture(async p=>{
 const results=await p.evaluate(()=>{
  money=50000;buy('home_studio');const home=owned.homes[0];
  return ['home_studio','home_loft','home_belle'].map(id=>{
   home.kind=id;const kind=homeRoomKind(id),d=ROOM_DEFS[kind];
   enterRoom(kind,{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[px,py,0]},d.entry);
   const [bx,by,hx,hy]=d.bedBounds;px=bx+hx+.35;py=by;a=Math.PI;paused=false;
   const bedside={open:free(px,py),spot:homeSpot(),prompt:promptText(),path:roomPath(...d.entry.slice(0,2),px,py).length};interact();const sleeping=!!sleep?.home;sleep=null;
   const shelf=room.props.find(p=>p.box&&Math.hypot(p.box.x-d.home.shelf[0],p.box.y-d.home.shelf[1])<.01).box;
   const wc=d.wc,targets=[d.spots.shelf,d.spots.fridge,[wc.x0+.5,wc.y1-.5]];
   const reachable=targets.map(t=>roomPath(...d.entry.slice(0,2),...t).length>0);
   const toilet=room.props.find(p=>p.loo),bath=room.props.find(p=>p.bath),cistern=room.props.find(p=>p.box&&Math.abs(p.box.x-toilet.loo[0])<.01&&p.box.z1===.82);
   env(0);render(0);
   return {id,bedside,sleeping,shelf:{s:shelf.s,edge:shelf.x-shelf.hw},reachable,toilet:{y:toilet.loo[1],back:Math.sign(cistern.box.y-toilet.loo[1])},bath:!!bath,walls:wc.x1===room.W-1||!!ROOMW.cell(wc.x1,2)};
  });
 });
 for(const r of results){assert.equal(r.bedside.open,true,JSON.stringify(r));assert.equal(r.bedside.spot,'bed');assert.match(r.bedside.prompt,/sleep/);assert.ok(r.bedside.path>0);assert.equal(r.sleeping,true);assert.equal(r.shelf.s,1);assert.ok(Math.abs(r.shelf.edge-(r.id==='home_studio'?1:10))<1e-6);assert.ok(r.reachable.every(Boolean),JSON.stringify(r));assert.equal(r.toilet.back,-1);assert.ok(r.toilet.y<1.5);assert.equal(r.walls,true);assert.equal(r.bath,r.id!=='home_studio');}
}));
test('equipment snaps flush to all three workshop walls, survives reload and keeps the door aisle clear',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  money=5000;buy('home_studio');const home=owned.homes[0],d=ROOM_DEFS.home;
  enterRoom('home',{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[px,py,0]},d.entry);buyWorkshopKit(home);
  const sample=(x,y,yaw,angle)=>{px=x;py=y;a=yaw;beginWorkshopPlacement('bench');workshopPlacement.a=angle;const c=workshopCandidate();endWorkshopPlacement();return c;};
  const left=sample(3.25,10,Math.PI,Math.PI/2),right=sample(10.75,10,0,Math.PI/2),bottom=sample(4,11.75,Math.PI/2,0),aisle=sample(7,11.75,Math.PI/2,0),outside=sample(14,10,0,0);
  const restored=restoreWorkshop({...workshopState(home),parts:[{...left,key:1}],owned:{bench:1}},home.kind).parts;
  return {left,right,bottom,aisle,outside,restored};
 });
 for(const key of ['left','right','bottom'])assert.equal(r[key].ok,true,JSON.stringify(r));
 assert.ok(Math.abs(r.left.x-.48-1)<1e-6);assert.ok(Math.abs(r.right.x+.48-13)<1e-6);assert.ok(Math.abs(r.bottom.y+.48-14)<1e-6);assert.equal(r.aisle.ok,false);assert.equal(r.outside.ok,false);assert.equal(r.restored.length,1);
}));
test('the pawn counter keeps its interaction even with a nearby customer',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('pawn',{word:'PAWN',ret:[px,py,a]},[6,3.4,-Math.PI/2]);
  room.props.push(standing(5.5,3.3,BLUE));const customer=roomPerson();interact();
  const shop=shopEl?.style.display;closeShop();px=5.5;py=4.3;a=-Math.PI/2;
  return {customer:!!customer,shop,side:!!roomPerson()};
 });
 assert.equal(r.customer,false);assert.equal(r.shop,'flex');assert.equal(r.side,true);
}));
test('Shotengai canopy spans reach two real opposing facades and leave unsupported streets open',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  let count=0,unsupported=0,bad=0;const spans=[];
  for(let k=0;k<ROAD.length;k++)if(ROAD[k]&&districtAt(k%N,Math.floor(k/N))==='shotengai') {
   const x=k%N+.5,y=Math.floor(k/N)+.5,s=arcadeSpanAt(x,y);if(!s){unsupported++;continue;}count++;
   const cell=c=>s.ns?idx(c,s.along):idx(s.along,c);
   if(map[cell(s.lo-1)]<ARCADE_Z||map[cell(s.hi)]<ARCADE_Z)bad++;
   if(spans.length<5)spans.push(s);
  }
  const s=spans[0],x=s.ns?s.lo+.01:s.along+.5,y=s.ns?s.along+.5:s.lo+.01;
  px=s.ns?(s.lo+s.hi)/2:s.along+.5;py=s.ns?s.along+.5:(s.lo+s.hi)/2;eye=.17;
  const steel=arcadeRoofPart(x,y),sky=arcadeSky(0,0,0,1),dry=!snowExposed(px,py);
  return {count,unsupported,bad,steel,dry};
 });
 assert.ok(r.count>100,JSON.stringify(r));assert.ok(r.unsupported>0);assert.equal(r.bad,0);assert.equal(r.steel,'beam');assert.equal(r.dry,true);
}));
test('moving-day and chalk actors share visible positions with gun targets and stay down',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  dayNum=4;tod=12;rain=snow=snowCover=0;const targets=streetSceneTargets();
  const target=targets.find(p=>p.key==='mover'),o=target.who;killFigure(o,1,0,false,target);const before=[o.x,o.y];T+=30;
  const after=streetSceneTargets().find(p=>p.who===o);tod=23;const night=streetSceneTargets().some(p=>p.who===o);px=o.x+.1;py=o.y;
  drawStreetScenes();return {actors:targets.length,frozen:JSON.stringify(before)===JSON.stringify([after.x,after.y]),night,loot:pickTarget()===o,alive:gunSceneFigures().some(p=>p.who===o)};
 });
 assert.equal(r.actors,3);assert.equal(r.frozen,true);assert.equal(r.night,true);assert.equal(r.loot,true);assert.equal(r.alive,false);
}));

test('dev place links skip permanently shuttered branches even when they are closest',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const entry=[...CITY_PLACES.values()].find(p=>p.shop.kind===SHOP_SHUT && p.shop.word && [...CITY_PLACES.values()].some(q=>q.shop.kind!==SHOP_SHUT&&q.shop.kind!==SHOP_APTS&&q.shop.word===p.shop.word));
  if(!entry)throw new Error('Expected a shuttered branch with an active namesake.');
  const sh=entry.shop;px=entry.x0-.1;py=(entry.y0+entry.y1)/2;gotoShop(sh.word);
  const closedDistance=Math.hypot(px-(entry.x0+entry.x1)/2,py-(entry.y0+entry.y1)/2);
  const labels=devPlaces().filter(e=>e[0]==='Shops (nearest)').map(e=>e[1]);
  const onlyClosed=[...new Set(SHOP.filter(sh=>sh?.kind===SHOP_SHUT).map(sh=>sh.word))].filter(w=>!SHOP.some(sh=>sh?.word===w&&sh.kind!==SHOP_SHUT&&sh.kind!==SHOP_APTS));
  return {closedDistance,onlyClosed:onlyClosed.filter(w=>labels.some(l=>l.startsWith(w+' (')))};
 });
 assert.ok(r.closedDistance>2,JSON.stringify(r));assert.deepEqual(r.onlyClosed,[]);
}));
test('a taxi body really pitches on a bridge ramp and restores the shared renderer after drawing',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const b=ROAD_BRIDGES[0],x=b.x-.4,y=b.y0+b.ramp*.5;px=x-.75;py=y-.25;a=Math.atan2(.25,.75);env(0);render(0);eye=roadGroundHeight(x,y)+.24;
  const car={kind:'taxi',body:TAXI,v:.2,id:1234},saved=vehicleGroundFrame,savedEye=eye;
  const capture=()=>{CH.fill(' ');BG.fill(NONE);ZB.fill(Infinity);drawVehicle(car,x-px,y-py,0,1);return {bg:Array.from(BG),z:Array.from(ZB)};};
  let flat,tilted;
  try{vehicleGroundFrame=(...args)=>({...saved(...args),tilted:false});flat=capture();vehicleGroundFrame=saved;tilted=capture();}finally{vehicleGroundFrame=saved;}
  return {changed:tilted.bg.filter((v,k)=>v!==flat.bg[k]).length,pixels:tilted.z.filter(Number.isFinite).length,eye:eye===savedEye,frame:vehicleDrawFrame};
 });
 assert.ok(r.changed>40,JSON.stringify(r));assert.ok(r.pixels>100);assert.equal(r.eye,true);assert.equal(r.frame,null);
}));
test('indoor officers can be hit and stop seeing, firing and grabbing after death',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('home',{ret:[px,py,a]},[7,10,-Math.PI/2]);roomCops.length=0;
  const cop={x:7,y:7,sees:true,fireT:0,aimT:999,path:[]};roomCops.push(cop);
  carryItem({id:'revolver',uses:6});const shot=fireGun(7,10,1.5,-Math.PI/2,0,true);
  const target=traceRoomShot(7,10,1.5,0,-1,0);px=7;py=7;wanted.fired=true;
  render(0);return {shot:shot.what,dead:cop.dead,sees:cop.sees,fireT:cop.fireT??null,target:target.who===cop,loot:pickTarget()===cop,shooters:copsShoot(.1)};
 });
 assert.equal(r.shot,'cop');assert.equal(r.dead,true);assert.equal(r.sees,false);assert.equal(r.fireT,null);assert.equal(r.target,false);assert.equal(r.loot,true);assert.equal(r.shooters,null);
}));
test('bouncer, roof recipients, garden visitors and pump drivers expose the same actor used by their drawing',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  people.length=footCops.length=0;cars.length=0;day=1;tod=12;
  const bouncer=clubFigureTarget(),recipient=courierFigureTargets()[0],garden=gardenFigureTargets().find(p=>!p.paddler);
  const st=GAS_STATIONS[0],driver={id:222,pit:{st,lane:0,stage:'fill',until:T+5},x:st.x0+GAS.slotX,y:st.y0+GAS.lanes[0],v:0};cars.push(driver);
  const pump=gasFigureTargets()[0],all=gunSceneFigures();
  const hits=[bouncer,recipient,garden,pump].map(t=>{
   const found=all.some(p=>p.who===t.who&&p.x===t.x&&p.y===t.y);
   killFigure(t.who,1,0,false,t);return found;
  });
  const before={...recipient};T+=10;const after=courierFigureTargets()[0];stepPit(driver,.1);gasSprites();gardenSprites();clubSprites();
  return {hits,gone:gunSceneFigures().filter(p=>[bouncer,recipient,garden,pump].some(t=>t.who===p.who)).length,stopped:driver.v===0&&driver.pit.stage==='fill',frozen:before.x===after.x&&before.y===after.y};
 });
 assert.deepEqual(r.hits,[true,true,true,true]);assert.equal(r.gone,0);assert.equal(r.stopped,true);assert.equal(r.frozen,true);
}));

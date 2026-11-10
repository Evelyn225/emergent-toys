'use strict';
// The integration tour (WORLD_QUALITY.md, item 32): every interior opens and draws, without errors and in good time,
// and every shop's jump in dev tools puts you on the pavement outside it, never in a hydrant, a bin or a fire engine.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=13;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('every interior opens at its actual entry and draws',()=>city(async p=>{
 const r=await p.evaluate(()=>{const home=[px,py,a],bad=[];let n=0,worst=0,worstKind='';
  const spawnFor=kind=>{const special={train:[2,2.5,.25],jail:[11,3.2,Math.PI/2],lamproom:[1.6,4.4,-Math.PI/4]};if(special[kind])return special[kind];const d=ROOM_DEFS[kind];if(d.entry)return [d.entry[0],d.entry[1],d.entry[2]??0];const g=d.grid;
   for(let y=0;y<g.length;y++)for(let x=0;x<g[y].length;x++)if(g[y][x]==='D')for(const [dx,dy] of [[0,-1],[0,1],[1,0],[-1,0]])if(g[y+dy]?.[x+dx]==='.')return[x+dx+.5+dx*.3,y+dy+.5+dy*.3,Math.atan2(dy,dx)];
   return null;};
  for(const kind of Object.keys(ROOM_DEFS)){const at=spawnFor(kind);if(!at)continue;
   try{mode='walk';room=null;[px,py,a]=home;enterRoom(kind,{word:kind.toUpperCase(),ret:[...home],lobby:{word:'HOTEL',ret:[...home]},st:0,t0:T-12,opts:[1,2,3],dest:null,track:0,until:T+60,below:{word:'LIGHTHOUSE',ret:[...home]},cell:[Math.floor(home[0]),Math.floor(home[1])]},at);
    env(0);render(0);const t0=performance.now();T+=.05;render(0);const ms=performance.now()-t0;if(ms>worst){worst=ms;worstKind=kind;}n++;}
   catch(e){bad.push([kind,String(e.message).slice(0,100)]);}}
  mode='walk';room=null;[px,py,a]=home;return{n,bad,worst,worstKind};});
 console.info('final interior tour',JSON.stringify(r));assert.deepEqual(r.bad,[]);assert.equal(r.n,await p.evaluate(()=>Object.keys(ROOM_DEFS).length),`${r.n} interiors`);assert.ok(r.worst<150,`slowest ${r.worstKind} ${r.worst.toFixed(0)}ms`);
}));

test('every shop jump lands you on clear pavement outside it',()=>city(async p=>{
 const bad=await p.evaluate(()=>{const words=new Set();for(let k=0;k<N*N;k++){const sh=SHOP[k];if(sh?.word&&sh.kind!==SHOP_APTS&&sh.kind!==SHOP_SHUT)words.add(sh.word);}
  const bad=[];for(const w of words){devFree();gotoShop(w);if(mode==='walk'&&!free(px,py))bad.push(w);}return bad;});
 assert.deepEqual(bad,[]);
}));

test('all dev destinations and seasonal district/island views run the real frame loop with finite cameras',()=>city(async p=>{
 const r=await p.evaluate(()=>{const places=devPlaces(),bad=[],times=[];money=100000;let visited=0,seasonal=0,worstLabel='',labelNow='',peak=0,coldPeak=0,coldLabel='';
  // (the first frame somewhere new builds that place's caches: it gets its own, looser ceiling; every other frame is held to the tight one)
  const frame=(cold=false)=>{const start=performance.now();loop(t0+1000/60);const ms=performance.now()-start;if(cold){if(ms>coldPeak){coldPeak=ms;coldLabel=labelNow;}}else{times.push(ms);if(ms>peak){peak=ms;worstLabel=labelNow;}}if(![px,py,a,eye].every(Number.isFinite))throw Error('non-finite camera');};
  for(const[group,label,go]of places){try{labelNow=label;devFree();body.z=body.vz=body.crouch=0;clearWanted();needs.food=needs.drink=needs.health=100;setSeason(0);tod=14;weather='clear';env(0);go();paused=false;frame(true);frame();visited++;if(mode==='walk'&&!free(px,py))bad.push([label,'blocked spawn']);}catch(e){bad.push([label,e.message]);}}
  const sample=places.filter((p,i)=>p[0]==='Islands'||p[0]==='Districts'||i%11===0);for(const sn of [0,1,2,3])for(const state of ['day','night','rain','snow'])for(const[group,label,go]of sample){try{labelNow=[sn,state,label].join('/');devFree();body.z=body.vz=body.crouch=0;go();setSeason(sn);tod=state==='night'?23:14;weather=state==='rain'?'rain':'clear';env(0);rain=state==='rain'?.8:0;snow=state==='snow'?.6:0;snowCover=state==='snow'?1:0;paused=false;frame();seasonal++;}catch(e){bad.push([sn,state,label,e.message]);}}
  times.sort((a,b)=>a-b);return{visited,seasonal,bad,median:times[Math.floor(times.length/2)],worst:times.at(-1),worstLabel,coldWorst:coldPeak,coldLabel,cols,rows};});console.info('final destination/weather tour',JSON.stringify(r));assert.deepEqual(r.bad,[]);assert.ok(r.visited>=80&&r.seasonal>=160,JSON.stringify(r));assert.ok(r.worst<250,'a warm frame took too long: '+JSON.stringify(r));assert.ok(r.coldWorst<1000,'arriving somewhere hung: '+JSON.stringify(r));
}));

test('every playable car, service vehicle, aircraft and boat plus both railways and ferry render in their real modes',()=>city(async p=>{
 const r=await p.evaluate(()=>{const bad=[],seen=[];money=100000;const tick=name=>{try{paused=false;env(0);for(let k=0;k<3;k++)loop(t0+1000/60);if(![px,py,a,eye].every(Number.isFinite))throw Error('non-finite camera');seen.push(name);}catch(e){bad.push([name,e.message]);}};
  const at=laneNear(px,py);for(const model of Object.keys(CAR_MODELS)){devFree();const c=spawnOwnedCar(model,at.x,at.y,at.hx,at.hy);me=c;mode='drive';c.player=true;c.parked=false;px=c.x;py=c.y;c.travelA=a=Math.atan2(c.hy,c.hx);third=false;tick(model+' cabin');third=true;tick(model+' exterior');}
  for(const kind of ['amb','fire','police']){devFree();const d=kind==='fire'?doors.find(d=>!d.sh.base&&!d.sh.fee&&!d.sh.club):null,f=d?createCityFire([d.x,d.y],'building'):null;const c=spawnEmergency(kind,f?[f.x,f.y]:[at.x,at.y],f);if(!c){bad.push([kind,'no vehicle']);continue;}me=c;mode='drive';c.player=true;px=c.x;py=c.y;c.travelA=a=Math.atan2(c.hy,c.hx);third=false;tick(kind+' cabin');third=true;tick(kind+' exterior');}
  devFree();const taxi=addCar({x:at.x,y:at.y,hx:at.hx,hy:at.hy,body:TAXI,rider:true,fare:0,dest:null});me=taxi;mode='taxi';px=taxi.x;py=taxi.y;a=camYaw=carYaw(taxi);third=false;tick('taxi ride');
  for(const type of Object.keys(PLANE_TYPES)){devFree();const c=aircraft.find(c=>c.type===type);if(!c){bad.push([type,'no aircraft']);continue;}c.owned=true;enterAircraft(c);third=false;tick(type+' cockpit');third=true;tick(type+' exterior');pilot=null;mode='walk';}
  for(const kind of ['speedboat','sailboat','cruiser']){devFree();const b=fleet.find(b=>b.kind===kind);b.deal='mine';boardBoat(b);tick(kind);}
  devPlaces().find(p=>p[1]==='Island ferry (aboard)')[2]();tick('ferry');
  devFree();let train;for(let time=0;time<240;time+=.5){const t=elTrains(time).find(t=>t.stopped);if(t){T=time;train=t;break;}}if(!train)bad.push(['el','no stopped train']);else{plat={s:EL_STATIONS[train.station],tr:train.tr};mode='elplat';px=train.x;py=EL_PLAT[train.tr];if(!elBoard())bad.push(['el','boarding failed']);else tick('elevated carriage');}
  devFree();enterRoom('train',{st:0,t0:T,opts:[1,2,3,4,5],dest:null,track:0},[2,2.5,.25]);tick('subway carriage');
  return{seen,bad};});console.info('final vehicle tour',JSON.stringify(r));assert.deepEqual(r.bad,[]);assert.ok(r.seen.length>=26,JSON.stringify(r));
}));

test('inventory previews and owned property survive a real save/reload with needs, quick slots and item metadata',()=>city(async p=>{
 const expected=await p.evaluate(()=>{devFree();clearInventory();money=100000;[px,py]=FERN_HOUSE.door;if(!buyProperty('home_island',px,py)[0])throw Error('home purchase failed');closeShop();interact();const home=homeRecord();if(!home)throw Error('home entry failed');home.pets=['petcat'];home.decor=[{id:'yoyo',uses:0}];home.fridge=[{id:'slice',uses:1}];workshopState(home).supplies=7;env(0);render(0);leaveRoom();carryItem({id:'water',uses:1});carryItem({id:'programme',uses:7,of:'YAR v MID'});held=1;assignQuickSlot(1,5);const lane=laneNear(100,100);if(!buyProperty('car_sedan',lane.x,lane.y)[0])throw Error('car purchase failed');const boat=fleet.find(b=>b.kind==='speedboat');boat.deal='mine';const craft=aircraft.find(c=>c.type==='prop');buyAircraft(craft);if(!craft.owned)throw Error('aircraft purchase failed');
  money=321.75;tickets=6;dayNum=42;tod=19.5;setSeason(2);Object.assign(needs,{food:12,drink:7,health:84,bladder:31.5,fit:15,trained:2});devAt(...FERN_HOUSE.door,0);if(!saveGame())throw Error('save failed');const d=JSON.parse(localStorage.getItem(SAVE_KEY)),keys=['money','tickets','day','tod','held','quickSlots','inv','homes','cars','boats','planes','needs','season','at'];return Object.fromEntries(keys.map(k=>[k,d[k]]));});
 await p.reload();const actual=await p.evaluate(()=>{if(!saveGame())throw Error('restored save blocked');const d=JSON.parse(localStorage.getItem(SAVE_KEY));return Object.fromEntries(['money','tickets','day','tod','held','quickSlots','inv','homes','cars','boats','planes','needs','season','at'].map(k=>[k,d[k]]));});assert.deepEqual(actual,expected);
 await p.evaluate(()=>openInventory());await p.waitForFunction(()=>[...document.querySelectorAll('#inventory .item-picture img')].every(i=>i.complete&&i.naturalWidth===128),null,{polling:20});assert.equal(await p.locator('#inventory .item-picture img').count(),expected.inv.length);assert.match(await p.locator('#inventory').innerText(),/YAR v MID/);
}));

test('closed car, taxi and aircraft cabin views keep rain and snow outside while chase cameras stay exposed',()=>city(async p=>{
 const r=await p.evaluate(()=>{devFree();money=100000;const lane=laneNear(px,py),car=spawnOwnedCar('car_sedan',lane.x,lane.y,lane.hx,lane.hy),taxi=addCar({x:lane.x,y:lane.y,hx:lane.hx,hy:lane.hy,body:TAXI,rider:true,fare:0,dest:null}),craft=aircraft.find(c=>c.type==='heli'),old=rainFx,bad=[];let changed=-1,checks=0;
 try{rainFx=dt=>{const before=CH.slice();old(dt);changed=0;for(let k=0;k<CH.length;k++)if(CH[k]!==before[k])changed++;};for(const type of ['drive','taxi','air']){devFree();freecam=null;if(type==='air'){craft.owned=true;enterAircraft(craft);}else{me=type==='taxi'?taxi:car;mode=type;me.player=type==='drive';px=me.x;py=me.y;a=camYaw=carYaw(me);me.travelA=a;}for(const exterior of [false,true])for(const snowy of [false,true]){third=exterior;weather='rain';rain=snowy?0:1;snow=snowy?1:0;changed=-1;paused=false;loop(t0+1000/60);if(exterior?changed<100:changed!==0)bad.push([type,exterior,snowy,changed]);checks++;}if(type==='air'){pilot=null;mode='walk';}}}finally{rainFx=old;}return{bad,checks};});assert.deepEqual(r.bad,[]);assert.equal(r.checks,12);
}));

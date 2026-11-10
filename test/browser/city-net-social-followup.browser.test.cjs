'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const PAGE=pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href+'?net=local';
async function pair(run){
 const browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']}),errors=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1170,height:720}}),pages=[];
  for(const name of ['Ann','Bob']){
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(PAGE);
   await p.evaluate(()=>{lockMouse=()=>{};window.followupBackground=netBackgroundTick;netBackgroundTick=()=>netFrame(performance.now(),true);paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});pages.push(p);
  }
  const code='follow-'+Date.now();for(let i=0;i<2;i++)await pages[i].evaluate(([code,name])=>netJoin(code,name),[code,['Ann','Bob'][i]]);
  for(const p of pages)await p.waitForFunction(()=>[...net.peers.values()].some(p=>p.hello&&!p.mismatch),null,{timeout:10000,polling:100});
  await run(...pages);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
const until=(p,f)=>p.waitForFunction(f,null,{timeout:10000,polling:100});

test('players remain searchable on maps in cars and interiors; pause renders peers; chat and cash entry stay usable',()=>pair(async(A,B)=>{
 const car=await B.evaluate(()=>{const c=cars.find(c=>c.kind==='car'&&!c.patrol&&!c.ev);mode='drive';me=c;c.player=true;px=c.x;py=c.y;netSendTick(netNow());return {x:c.x,y:c.y};});
 await until(A,()=>netMapPlayers()[0]?.status==='Driving');
 await A.evaluate(()=>{openBigMap();bigMapFind('Bob',false);});
 assert.match(await A.locator('#bigmap .places').textContent(),/Bob/);assert.match(await A.locator('#bigmap .places').textContent(),/Driving/);
 assert.deepEqual(await A.evaluate(()=>{const p=netMapPlayers()[0];return {x:p.x,y:p.y};}),car);
 const site=await B.evaluate(()=>{me.player=false;me=null;const d=doors.find(d=>d.use==='shop'&&d.sh.word==='PAWN')||doors.find(d=>d.use==='shop');return {cell:SHOP.indexOf(d.sh),otherCell:SHOP.lastIndexOf(d.sh),word:d.sh.word,kind:ROOM_FOR[d.sh.word]||'store',x:d.x,y:d.y};});
 await B.evaluate(s=>{enterRoom(s.kind,{word:s.word,cell:[s.otherCell%N,Math.floor(s.otherCell/N)],ret:[s.x+.12,s.y,0]},[4,5,-Math.PI/2]);netSendTick(netNow());},site);
 await until(A,()=>netMapPlayers()[0]?.inside);
 await A.evaluate(()=>{netRefreshMapPlaces(true);mapDirectoryUI();});assert.match(await A.locator('#bigmap .places').textContent(),/Inside/);
 assert.ok(await A.evaluate(()=>netMapPlayers().length===1));
 await A.evaluate(s=>{closeBigMap();paused=false;enterRoom(s.kind,{word:s.word,cell:[s.cell%N,Math.floor(s.cell/N)],ret:[s.x-.12,s.y+.08,0]},[4,5.7,-Math.PI/2]);netSendTick(netNow());},site);
 await until(A,()=>netViewOf([...net.peers.values()][0])?.rk===netRoomKey());
 assert.equal(await A.evaluate(()=>netRoomKey()),await B.evaluate(()=>netRoomKey()),'different positions at one door share the same interior');
 const live=await A.evaluate(()=>{let frames=0;const original=renderView;renderView=dt=>{frames++;original(dt);};try{paused=true;loop(performance.now());return {frames,drawn:[...net.peers.values()][0].drawn};}finally{renderView=original;paused=false;}});
 assert.equal(live.frames,1);assert.equal(live.drawn,true);
 await A.evaluate(()=>{netOpenChat();});
 assert.deepEqual(await A.locator('#net-chat').evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopWidth,s.boxShadow];}),['rgba(0, 0, 0, 0)','0px','none']);
 await A.keyboard.type('hello Bob');await A.keyboard.press('Enter');await until(B,()=>net.chat.some(m=>m.text==='hello Bob'));
 await A.evaluate(()=>{money=123.45;openNetPlayers();});await A.locator('[data-np-act="cash"]').click();
 assert.match(await A.locator('[data-np="balance"]').textContent(),/123\.45/);await A.locator('[data-np="input"]').fill('12');
 await A.evaluate(()=>{money=100;netPlayersShow();});assert.match(await A.locator('[data-np="balance"]').textContent(),/100/);assert.equal(await A.locator('[data-np="input"]').inputValue(),'12');
 await A.setViewportSize({width:320,height:568});assert.equal(await A.locator('#netplayers .panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'the cash form fits a narrow phone');
}));

test('same subway station and train draw peers despite different entry times and positions',()=>pair(async(A,B)=>{
 for(const [i,p]of [A,B].entries())await p.evaluate(i=>{enterRoom('station',{st:2,t0:T-30,ret:[100+i*.12,101+i*.08,0]},[11.5,7.6+i*.5,Math.PI/2]);netSendTick(netNow());},i);
 await until(A,()=>netViewOf([...net.peers.values()][0])?.rk==='station:2');
 assert.equal(await A.evaluate(()=>{render(0);return [...net.peers.values()][0].drawn;}),true);
 const phases=await Promise.all([A,B].map(p=>p.evaluate(()=>trainPhase(room))));assert.ok(Math.abs(phases[0]-phases[1])<1,'one shared train timetable');
 const clock=await A.evaluate(()=>[dayNum,tod]);
 for(const [i,p]of [A,B].entries())await p.evaluate(([i,clock])=>{[dayNum,tod]=clock;enterRoom('train',{st:2,t0:T-10,opts:[],dest:null,track:0},[2,2.5+i*.6,Math.PI/2]);netSendTick(netNow());},[i,clock]);
 await until(A,()=>netViewOf([...net.peers.values()][0])?.rk===netRoomKey());
 assert.equal(await A.evaluate(()=>{render(0);return [...net.peers.values()][0].drawn;}),true);
 assert.equal(await B.evaluate(()=>{render(0);return [...net.peers.values()][0].drawn;}),true);
 await B.evaluate(()=>{room.netBoard++;netSendTick(netNow());});await until(A,()=>netViewOf([...net.peers.values()][0])?.rk!==netRoomKey());
 assert.equal(await A.evaluate(()=>{render(0);return [...net.peers.values()][0].drawn;}),false,'a different train remains separate');
}));

async function sharedHome(A,B){
 await A.evaluate(()=>{
  money=5000;buy('home_studio');const h=owned.homes[0],cell=[h.cell%N,Math.floor(h.cell/N)];
  const b={id:'bench',key:1,x:3.75,y:12,a:0},rack={id:'growrack',key:5,x:10,y:12,a:0,crop:{left:0,tended:true}};
  h.workshop={owned:{bench:1,processor:1,packer:1,fan:1,growrack:1},parts:[b,...['processor','packer','fan'].map((id,i)=>({...workshopAttachment(id,b),key:i+2})),rack],supplies:3,powered:true,next:6,seeds:2,upgrades:{}};
  enterRoom('home',{cell,ret:[h.cell%N+.5,Math.floor(h.cell/N)+.5,0]},ROOM_DEFS.home.entry);netInvite([...net.peers.values()][0]);netSendTick(netNow());
 });
 await until(B,()=>net.invites.size===1);
 await B.evaluate(()=>{const [from,v]=[...net.invites][0];netEnterAsGuest({...v,from});netSendTick(netNow());});
 await until(A,()=>netViewOf([...net.peers.values()][0])?.rk===netRoomKey());
}

test('invited guests share TV, cooking activity, workshop reserves and harvests with the owner',()=>pair(async(A,B)=>{
 await sharedHome(A,B);
 await B.evaluate(()=>netHomeTVToggle());await until(A,()=>room.tv===true);await until(B,()=>room.tv===true);
 assert.equal(await A.evaluate(()=>{const h=homeRecord(),cell=room.cell,ret=room.ret,kind=room.kind;leaveRoom();enterRoom(kind,{cell,ret},ROOM_DEFS[kind].entry);return room.tv;}),true,'returning owners retain the shared TV state');
 await A.evaluate(()=>netHomeTVToggle());await until(B,()=>room.tv===false);
 await B.evaluate(()=>{clearInventory();carryItem({id:'bread',uses:1});const p=room.def.spots.stove;[px,py]=p;interact();});
 assert.equal(await B.locator('#cooking').isVisible(),true);await B.evaluate(()=>startCooking(RECIPE.toast));
 await until(A,()=>netHomeCooking()&&cookingOn()==='stove');
 await B.evaluate(()=>{game.onDone('fine');game=null;});await until(A,()=>!netHomeCooking());
 assert.ok(await B.evaluate(()=>inv.some(it=>it.id==='toast')),'the dish is in the guest bag');assert.equal(await A.evaluate(()=>inv.some(it=>it.id==='toast')),false);
 await B.evaluate(()=>startGuestWorkshopBatch(workshopState(homeRecord()).parts.find(p=>p.id==='bench')));
 await until(B,()=>game?.kind==='workshop');await until(A,()=>netHomeJobs.size===1&&netHomeView()?.running.includes(1));
 assert.equal(await A.evaluate(()=>workshopState(homeRecord()).supplies),2,'one reserved cartridge');
 const display=await A.evaluate(()=>{const p=workshopState(homeRecord()).parts.find(p=>p.id==='processor');px=p.x;py=p.y+1.1;a=-Math.PI/2;pitch=-.15;render(0);const q=fishProj(p.x-px,p.y+.27-py,1.28),lines=[];for(let r=Math.max(0,Math.floor(q.r)-3);r<Math.min(rows,Math.floor(q.r)+4);r++){let word='';for(let c=Math.max(0,Math.floor(q.c)-23);c<Math.min(cols,Math.floor(q.c)+24);c++){const ch=CH[r*cols+c];if(/[A-Z]/.test(ch))word+=ch;}if(word)lines.push(word);}return lines;});
 assert.ok(display.includes('RUN'),'the host sees the guest running the native processor: '+JSON.stringify(display));
 assert.equal(await A.evaluate(()=>{startWorkshopBatch(workshopState(homeRecord()).parts.find(p=>p.id==='bench'));return game===null;}),true,'the owner cannot start a competing batch');
 await B.evaluate(()=>{game.onDone('perfect');game=null;});await until(B,()=>inv.some(it=>it.id==='neon'&&it.uses===6));
 assert.equal(await A.evaluate(()=>workshopState(homeRecord()).supplies),2,'completion does not consume a second cartridge');
 await B.evaluate(()=>{netHomeRequest('harvest',{bench:5});netHomeRequest('harvest',{bench:5});});
 await until(B,()=>inv.some(it=>it.id==='weed'));assert.equal(await B.evaluate(()=>inv.filter(it=>it.id==='weed').length),1,'one harvest despite competing requests');
 assert.equal(await A.evaluate(()=>!!workshopState(homeRecord()).parts.find(p=>p.key===5).crop),false);
 await B.evaluate(()=>netHomeRequest('power'));await until(A,()=>!workshopState(homeRecord()).powered);await until(B,()=>!workshopState(homeRecord()).powered);
 await B.evaluate(()=>netHomeRequest('power'));await until(A,()=>workshopState(homeRecord()).powered);
 await B.evaluate(()=>startGuestWorkshopBatch(workshopState(homeRecord()).parts.find(p=>p.id==='bench')));await until(B,()=>game?.kind==='workshop');
 await B.evaluate(()=>netLeave());await until(A,()=>netHomeJobs.size===0);assert.equal(await A.evaluate(()=>workshopState(homeRecord()).supplies),2,'disconnect returns a reserved cartridge');
}));

test('teleports in either direction require acceptance, support homes, decline and expiry',()=>pair(async(A,B)=>{
 const spot=await A.evaluate(()=>{const d=doors.find(d=>d.use==='shop');px=d.x;py=d.y;return {x:px,y:py};});
 await B.evaluate(s=>{px=worldCoord(s.x+4);py=s.y;},spot);
 const before=await A.evaluate(()=>[px,py]);
 await A.evaluate(()=>netTeleportRequest([...net.peers.values()][0],'to'));await until(B,()=>[...netTeleports.values()].some(r=>r.incoming));
 assert.deepEqual(await A.evaluate(()=>[px,py]),before,'a request alone never moves the requester');
 await B.evaluate(()=>{openNetPlayers();});assert.match(await B.locator('[data-np="requests"]').textContent(),/Ann wants to teleport to you/);
 await B.locator('[data-np-act="tp-no"]').click();await until(A,()=>netTeleports.size===0);assert.deepEqual(await A.evaluate(()=>[px,py]),before);
 await A.evaluate(()=>{net.peers.values().next().value.teleportBucket={};netTeleportRequest([...net.peers.values()][0],'here');});await until(B,()=>[...netTeleports.values()].some(r=>r.incoming));
 const beforeB=await B.evaluate(()=>[px,py]);assert.notDeepEqual(beforeB,before);
 await B.evaluate(()=>netTeleportAnswer([...netTeleports.keys()][0],true));await until(B,()=>netTeleports.size===0);
 assert.ok(await B.evaluate(s=>Math.hypot(rel(px-s.x),rel(py-s.y))<.6,spot));
 await B.evaluate(()=>{net.peers.values().next().value.teleportBucket={};});
 await A.evaluate(()=>{enterRoom('station',{st:1,ret:[100,100,0],t0:T-10},[11.5,7.6,Math.PI/2]);netTeleportRequest([...net.peers.values()][0],'here');});
 await until(B,()=>[...netTeleports.values()].some(r=>r.incoming));await B.evaluate(()=>netTeleportAnswer([...netTeleports.keys()][0],true));await until(B,()=>mode==='room'&&room.kind==='station');
 assert.equal(await A.evaluate(()=>netRoomKey()),await B.evaluate(()=>netRoomKey()),'teleport joins the actual public interior');
 await sharedHome(A,B);await B.evaluate(()=>{leaveRoom();netSendTick(netNow());netTeleportRequest([...net.peers.values()][0],'to');});
 await until(A,()=>[...netTeleports.values()].some(r=>r.incoming));await A.evaluate(()=>netTeleportAnswer([...netTeleports.keys()][0],true));
 await until(B,()=>mode==='room'&&!!room.guestHome);assert.equal(await A.evaluate(()=>netRoomKey()),await B.evaluate(()=>netRoomKey()));
 assert.deepEqual(await B.evaluate(()=>mapPlayerLocation()),await A.evaluate(()=>mapPlayerLocation()),'teleported guests map to the host building, not their departure point');
 await B.evaluate(()=>{netTeleportRequest([...net.peers.values()][0],'to');netTeleportFrame(netNow()+31);});assert.equal(await B.evaluate(()=>netTeleports.size),0);
}));

 test('multiplayer pause and background frames keep gravity running without accepting movement input',()=>pair(async(A,B)=>{
 const result=await A.evaluate(()=>{
  paused=true;mode='walk';room=me=null;fx.skating=false;clearWanted();cars.length=0;people.length=0;[px,py]=citySourcePoint(41,73);body.z=1.2;body.vz=body.mx=body.my=0;K.KeyW=1;const start=[px,py],time=T;
  for(let i=0;i<30;i++)loop(t0+50,false,false);
  const landed=body.z===0&&body.vz===0,inputBlocked=!K.KeyW&&Math.hypot(px-start[0],py-start[1])<.001,advanced=T>time;
  body.z=1;body.vz=0;net.frameT=performance.now()/1000-1;t0=performance.now()-250;window.followupBackground();const background=body.z<1&&body.vz<0;
  netLeave();paused=true;body.z=1;const before=T;loop(t0+50);return {landed,inputBlocked,advanced,background,singlePlayerFrozen:body.z===1&&T===before};
 });assert.deepEqual(result,{landed:true,inputBlocked:true,advanced:true,background:true,singlePlayerFrozen:true});
 }));

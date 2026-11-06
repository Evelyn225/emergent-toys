'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();let seed=17;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;T=10;mode='walk';room=me=freecam=null;body.seat=null;body.z=body.vz=0;clearWanted();money=2000;});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
async function sitIn(p,kind){
 await p.evaluate(kind=>{
  enterRoom(kind,{word:kind.toUpperCase(),neon:MAG,ret:[px,py,a]},[5,5,0]);
  let found=false;
  search:for(const s of room.props){if(!s.bench&&!s.seat&&!s.seatRow)continue;const r=s.seatRow,x=r?(r.x0+r.x1)/2:s.x,y=r?r.y:s.y;
   for(const d of [.65,.85,1])for(let j=0;j<8;j++){
    px=x+Math.cos(j*TAU/8)*d;py=y+Math.sin(j*TAU/8)*d;if(!roomOpen(px,py)||!nearSeat())continue;found=true;break search;
   }
  }
  if(!found)throw Error('missing usable native seat '+kind);render(0);
 },kind);
 await p.keyboard.press('KeyC');assert.ok(await p.evaluate(()=>!!body.seat));
}
for(const kind of ['cafe','bar','cinema'])test(`officers reach and arrest a seated player in ${kind}`,()=>fixture(async p=>{
 await sitIn(p,kind);
 const r=await p.evaluate(()=>{
  const seat=body.seat,from=seat.from;
  let start;for(let j=0;j<16;j++){const x=from[0]+Math.cos(j*TAU/16)*1.4,y=from[1]+Math.sin(j*TAU/16)*1.4;if(roomOpen(x,y)&&roomWalkLine(x,y,...from)){start=[x,y];break;}}
  if(!start)throw Error('missing walkable officer approach');
  cars.length=footCops.length=roomCops.length=reports.length=0;heli=null;searchedRoom=room;roomLead=null;
  wanted.stars=1;wanted.hideT=0;wanted.busted=false;wanted.roomX=px;wanted.roomY=py;
  roomCops.push({x:start[0],y:start[1],targetX:px,targetY:py,path:[],pathT:0,searchT:0,searchI:0,sees:false});
  let law='';for(let k=0;k<400&&!wanted.busted&&wanted.stars;k++){T+=.05;law=stepCrime(.05);}
  const stillSeated=!!body.seat;if(law==='busted')openBusted();
  return {law,stillSeated,target:roomCops[0]?[roomCops[0].targetX,roomCops[0].targetY]:null,standing:body.seat===null,open:bustedEl?.style.display,paused,from,distance:Math.hypot(px-from[0],py-from[1])};
 });assert.equal(r.law,'busted',JSON.stringify(r));assert.ok(r.stillSeated&&r.standing);assert.equal(r.open,'flex');assert.ok(r.paused&&r.distance<1e-8);assert.ok(Math.hypot(r.target[0]-r.from[0],r.target[1]-r.from[1])<1e-8,JSON.stringify(r));
}));
test('a tall barrier still prevents a seated player from being grabbed through it',()=>fixture(async p=>{
 await sitIn(p,'cafe');const r=await p.evaluate(()=>{
  const from=body.seat.from,c={x:from[0],y:from[1],targetX:px,targetY:py,path:[],pathT:0,searchT:0,searchI:0,sees:false};
  const vx=px-c.x,vy=py-c.y,d=Math.hypot(vx,vy);room.props.push({x:(px+c.x)/2,y:(py+c.y)/2,box:boxAt((px+c.x)/2,(py+c.y)/2,vx/d,vy/d,.14,.8,0,2.4)});
  cars.length=footCops.length=roomCops.length=reports.length=0;heli=null;searchedRoom=room;roomLead=null;wanted.stars=1;wanted.hideT=0;roomCops.push(c);
  const law=stepCrime(0);return {law,sees:c.sees,busted:wanted.busted};
 });assert.equal(r.sees,false);assert.equal(r.busted,false);assert.notEqual(r.law,'busted');
}));
test('helicopter light blends material detail with lamp falloff while retaining letters, fog, flags and depth',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  [px,py]=citySourcePoint(41.5,73.5);
  const pool=()=>{if(typeof drawChopperPool==='function')return drawChopperPool(1,0,0,1);const model=drawHeliModel;try{drawHeliModel=()=>{};heli={x:px+1,y:py,z:100,h:0,sx:px+1,sy:py};drawChopper();}finally{drawHeliModel=model;}};
  a=0;dx=1;dy=0;eye=.17;hor=rows/2;ZB.fill(Infinity);ZBG.fill(Infinity);FL.fill(1);FOGS.fill(2);FOGB.fill(3);
  for(let i=0;i<BG.length;i++){BG[i]=C(i%2?BRICK:BLUE,3+(Math.floor(i/cols)%3));CH[i]=i%7?' ':'A';COL[i]=C(WHITE,7);}
  const before={bg:[...BG],ch:[...CH],col:[...COL]};pool();
  let changed=0,darker=0,materials=new Set(),levels=new Set();for(let i=0;i<BG.length;i++)if(BG[i]!==before.bg[i]){changed++;if((BG[i]&15)<(before.bg[i]&15))darker++;materials.add(BG[i]>>4);levels.add(BG[i]&15);}
  const retained=CH.every((ch,i)=>ch===before.ch[i])&&COL.every((col,i)=>col===before.col[i])&&ZB.every(x=>x===Infinity)&&ZBG.every(x=>x===Infinity)&&FL.every(x=>x===1)&&FOGS.every(x=>x===2)&&FOGB.every(x=>x===3);
  ZB.fill(.01);ZBG.fill(.01);const occluded=[...BG];pool();const blocked=BG.every((b,i)=>b===occluded[i]);
  ZB.fill(10);ZBG.fill(10);const distant=[...BG];pool();const farUntouched=BG.every((b,i)=>b===distant[i]);
  const densities=typeof lightPoolColour==='function'?[0,.15,.4,1].map(k=>{let n=0;for(let r=0;r<4;r++)for(let c=0;c<4;c++)if((lightPoolColour(BLUE,3,k,r,c,WHITE)>>4)===WHITE)n++;return n;}):[];
  return{changed,darker,materials:[...materials],levels:levels.size,retained,blocked,farUntouched,densities,white:WHITE,blue:BLUE,brick:BRICK};
 });assert.equal(r.missing,undefined);assert.ok(r.changed>30&&r.levels>=3,JSON.stringify(r));assert.ok(r.materials.includes(r.white)&&r.materials.includes(r.blue)&&r.materials.includes(r.brick));assert.ok(r.retained&&r.blocked&&r.farUntouched,JSON.stringify(r));assert.equal(r.darker,0);assert.ok(r.densities[0]===0&&r.densities[1]<r.densities[2]&&r.densities[2]<r.densities[3]);
}));
test('native lamps and the helicopter call the same pool shader and the helicopter uses raised road height',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof lightPoolColour!=='function'||typeof drawChopperPool!=='function')return {missing:true};
  const colour=lightPoolColour,gl=glow,pool=drawChopperPool;let lamps=0,spot=0,ground;
  try{lightPoolColour=(...args)=>{if(args[5]===WHITE)spot++;else lamps++;return colour(...args);};glow=()=>.5;tod=23;env(0);[px,py]=citySourcePoint(41.5,73.5);a=0;pitch=-.2;render(0);
   const b=ROAD_BRIDGES[0];heli={x:b.x,y:(b.y0+b.y1)/2,z:4,h:0,sx:b.x,sy:(b.y0+b.y1)/2};px=heli.x-1;py=heli.y;a=0;pitch=-.2;render(0);
   drawChopperPool=(x,y,z,k)=>{ground=z;return pool(x,y,z,k);};drawChopper();
   return{lamps,spot,ground,expected:roadGroundHeight(heli.sx,heli.sy)};
  }finally{lightPoolColour=colour;glow=gl;drawChopperPool=pool;}
 });assert.equal(r.missing,undefined);assert.ok(r.lamps>0&&r.spot>0,JSON.stringify(r));assert.ok(r.expected>0&&Math.abs(r.ground-r.expected)<1e-8,JSON.stringify(r));
}));

test('a seated head is visible above a low chair back',()=>fixture(async p=>{
 await sitIn(p,'cafe');const r=await p.evaluate(()=>{
  let c;for(let j=0;j<16;j++){const x=px+Math.cos(j*TAU/16)*1.2,y=py+Math.sin(j*TAU/16)*1.2;if(roomOpen(x,y)&&roomPoliceSees({x,y})){c={x,y};break;}}
  if(!c)throw Error('missing visible chair approach');const dx=(c.x-px)/1.2,dy=(c.y-py)/1.2,head=(body.seat.h??.45)+.7;
  const x=px+dx*.1,y=py+dy*.1;room.props.push({x,y,box:boxAt(x,y,dx,dy,.1,.5,0,head-.02)});
  return {visible:roomPoliceSees(c),head};
 });assert.ok(r.visible,JSON.stringify(r));
}));
test('a park bench does not prevent arrest and the player is stood up for the arrest panel',()=>fixture(async p=>{
 await p.evaluate(()=>{let ready=false;for(const b of benches){px=b.x+.1;py=b.y;if(free(px,py)&&nearSeat()){ready=true;break;}}if(!ready)throw Error('missing usable park bench');a=0;render(0);});
 await p.keyboard.press('KeyC');assert.ok(await p.evaluate(()=>!!body.seat));
 const r=await p.evaluate(()=>{cars.length=footCops.length=reports.length=0;heli=null;wanted.stars=1;wanted.busted=false;wanted.hideT=0;wanted.lastX=px;wanted.lastY=py;
  footCops.push({x:px+.3,y:py,chase:true,ph:0,dir:0,goal:null,corner:null});let law;for(let k=0;k<80&&!wanted.busted;k++){T+=.05;law=stepCrime(.05);}if(law==='busted')openBusted();return {law,seat:body.seat,open:bustedEl?.style.display};
 });assert.equal(r.law,'busted');assert.equal(r.seat,null);assert.equal(r.open,'flex');
}));
test('police find a reachable cinema aisle when a crowded row moves the player away from their original standing point',()=>fixture(async p=>{
 await p.evaluate(()=>{enterRoom('cinema',{word:'CINEMA',ret:[px,py,a]},[4.2,4.35,0]);room.props=room.props.filter(p=>!p.fig);const r=room.props.find(p=>p.seatRow).seatRow;for(let k=0;k<5;k++)room.props.push(sitting(r.x0+.1+k*.55,r.y,GRAY,.45));px=(r.x0+r.x1)/2;py=r.y-.65;render(0);});
 await p.keyboard.press('KeyC');assert.ok(await p.evaluate(()=>!!body.seat));
 const r=await p.evaluate(()=>{const from=[...body.seat.from],seat=[px,py];cars.length=footCops.length=roomCops.length=reports.length=0;heli=null;searchedRoom=room;roomLead=null;wanted.stars=1;wanted.hideT=0;wanted.busted=false;wanted.roomX=px;wanted.roomY=py;
  roomCops.push({x:from[0],y:from[1],targetX:px,targetY:py,path:[],pathT:0,searchT:0,searchI:0,sees:false});let law;for(let k=0;k<400&&!wanted.busted&&wanted.stars;k++){T+=.05;law=stepCrime(.05);}const c=roomCops[0];return {law,displaced:Math.hypot(seat[0]-from[0],seat[1]-from[1]),target:[c.targetX,c.targetY],accessible:roomOpen(c.targetX,c.targetY),reach:Math.hypot(seat[0]-c.targetX,seat[1]-c.targetY)};
 });assert.ok(r.displaced>1.2,JSON.stringify(r));assert.equal(r.law,'busted',JSON.stringify(r));assert.ok(r.accessible&&r.reach<1.2,JSON.stringify(r));
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run){
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;let seed=1;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await page.evaluate(()=>{paused=false;clearWanted();mode='walk';room=me=null;body.z=body.vz=body.crouch=0;body.seat=null;tod=12;T=10;env(0);});
  await run(page);assert.deepEqual(errors,[]);
 }finally{await page.close();}
}

test('ramen and other back-counter staff retain their full heads from either side of the counter',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const results=[];
  for(const kind of ['noodle','store','bar','diner','petshop','florist','cafe','tea','deli','pharmacy','herbs','jeweler','fruitshop','drugstore','markethall']){
   enterRoom(kind,{word:kind==='noodle'?'RAMEN':'SHOP',neon:CYAN,ret:[px,py,a]},[6,4,0]);
   const keeper=room.def.keeper;
   const targets=room.props.filter(p=>p.fig&&!p.still&&(p.y<1.45||keeper&&Math.hypot(p.x-keeper[0],p.y-keeper[1])<.12));
   // Keep the real counters/walls, excluding patrons who can legitimately hide a clerk.
   room.props=room.props.filter(p=>!p.fig||targets.includes(p));
   for(const p of targets)for(const side of [-1,0,1]){
    px=p.x+side*1.2;py=3.4;a=Math.atan2(p.y-py,p.x-px);pitch=0;body.z=body.vz=0;render(0);
    const actual=Float32Array.from(ZB),depth=dx*(p.x-px)+dy*(p.y-py);
    ZB.fill(Infinity);drawFigProp(p,p.x-px,p.y-py);
    let expected=0,visible=0;
    for(let i=0;i<ZB.length;i++)if(Math.abs(ZB[i]-depth)<.0001){
     const z=eye+(hor-Math.floor(i/cols)-.5)*depth/projY;
     if(z<1.45||z>1.8)continue;
     expected++;if(Math.abs(actual[i]-depth)<.0001)visible++;
    }
    results.push({kind,side,x:p.x,expected,visible});
   }
  }
  return results;
 });
 assert.ok(result.length>=60,JSON.stringify(result));
 // A shelf can cover a couple of edge cells in an oblique shop view; a wall
 // must never remove a whole side of the head or the entire frontal figure.
 assert.ok(result.every(r=>r.expected>=5&&r.visible/r.expected>.95),JSON.stringify(result.filter(r=>r.expected<5||r.visible/r.expected<=.95)));
}));

test('merchant signs, roofs and projecting details stay attached across every moved neighborhood boundary',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const errors=[];let checked=0;
  for(const o of PAVILION_SOLIDS){
   if(!o.b)continue;checked++;
   const b=o.b;
   if(o.f){
    const f=o.f,along=f.side?o.x:o.y,depth=((f.side?o.y:o.x)-f.line)*(f.nx||f.ny);
    if(depth<0||depth>.23||along<f.start-.001||along>f.end+.001)errors.push([b.sh.word,o.kind,o.x,o.y]);
    const k=idx((f.side?along:f.line)-f.nx*.1,(f.side?f.line:along)-f.ny*.1);
    if(!map[k]||SHOP[k]!==b.sh)errors.push(['missing wall',b.sh.word,o.kind]);
   }else if(Math.abs(o.x-b.x)>.001||Math.abs(o.y-b.y)>.001)errors.push(['roof',b.sh.word]);
  }
  return {checked,errors:errors.slice(0,20)};
 });
 assert.ok(result.checked>1000);assert.deepEqual(result.errors,[]);
}));

test('Belle cornices and balconies keep a real owning wall after the archipelago transform',()=>fixture(async page=>{
 const result=await page.evaluate(()=>({count:belleDetails.length,errors:belleDetails.filter(o=>{
  const x=o.ownerCell%N+.5,y=Math.floor(o.ownerCell/N)+.5;
  return !map[o.ownerCell]||Math.abs(o.x-x)>1||Math.abs(o.y-y)>1;
 }).map(o=>[o.kind,o.x,o.y,o.ownerCell]).slice(0,10)}));
 assert.ok(result.count>1000);assert.deepEqual(result.errors,[]);
}));

test('bridge ramps and rails leave the waterfront junctions level and open to pedestrians and vehicles',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  cars.length=people.length=footCops.length=0;const errors=[];
  for(const b of ROAD_BRIDGES)for(const y of [169,217]){
   mode='walk';px=b.x-2.5;py=y;body.z=body.vz=0;body.ground=0;body.groundMode='walk';
   for(let n=0;n<100;n++)move(.05,0);
   if(Math.abs(px-(b.x+2.5))>.01)errors.push(['pedestrian blocked',b.id,y,px]);
   for(let x=b.x-2.5;x<=b.x+2.5;x+=.1){
    if(roadGroundHeight(x,y)>.0001||roadBridgeRailAt(x,y,0))errors.push(['raised junction',b.id,y,x]);
    if(!carBodyClear(x,y,1,0))errors.push(['vehicle blocked',b.id,y,x]);
   }
  }
  return errors.slice(0,10);
 });
 assert.deepEqual(result,[]);
}));

test('stealing a cruiser releases police control through driving, ending a chase, exiting and re-entry',()=>fixture(async page=>{
 for(const state of ['patrol','pursuit','returning']){
  await page.evaluate(state=>{
   clearWanted();mode='walk';room=me=null;third=false;
   const c=cars.find(c=>c.patrol&&ROAD[idx(c.x,c.y)]);
   if(!c)throw Error('Missing patrol car');
   window.stolenCruiser=c;cars.length=0;cars.push(c);people.length=footCops.length=0;
   Object.assign(c,{v:0,pursuit:state==='pursuit',returning:state==='returning',waitingCrew:state==='returning',extra:true});
   if(state==='pursuit'){wanted.stars=1;c.dest=[c.x,c.y];}
   // A returning officer must not try to climb into the stolen car later.
   footCops.push({x:c.x+2,y:c.y,car:c,returnCar:c,chase:false,extra:true,ph:0});
   px=c.x+c.hy*.3;py=c.y-c.hx*.3;a=Math.atan2(c.y-py,c.x-px);env(0);render(0);
  },state);
  await page.keyboard.press('KeyE');
  const result=await page.evaluate(()=>{
   const c=stolenCruiser,taken=mode==='drive'&&me===c;
   const police=c.patrol||c.pursuit||c.returning||c.waitingCrew||c.extra;
   const crew=footCops.some(p=>p.car===c||p.returnCar===c);
   const draw=render;render=()=>{};
   try{for(let n=0;n<30;n++){K.KeyW=1;K.KeyD=n<15;loop(t0+50);}}finally{render=draw;K.KeyW=K.KeyD=0;}
   clearWanted();stepReturningPolice(.05);
   const finite=[a,px,py,c.hx,c.hy].every(Number.isFinite),retained=cars.includes(c);
   c.v=0;leaveCar();const at=[c.x,c.y];stepTraffic(.1,T+.1);if(finite)render(0);
   const parked=c.parked&&c.x===at[0]&&c.y===at[1];
   interact();const reentered=me===c&&mode==='drive';
   c.v=0;leaveCar();
   // Restore another original cruiser for the next independent state.
   c.patrol=true;
   return {taken,police:!!police,crew,finite,retained,parked,reentered};
  });
  assert.deepEqual(result,{taken:true,police:false,crew:false,finite:true,retained:true,parked:true,reentered:true},state);
 }
}));

test('entering a wrecked cruiser cannot turn its steering or chase camera into NaN',()=>fixture(async page=>{
 const result=await page.evaluate(()=>{
  const c=cars.find(c=>c.patrol&&ROAD[idx(c.x,c.y)]);cars.length=0;cars.push(c);people.length=footCops.length=0;
  Object.assign(c,{v:0,wrecked:true,dmg:100});delete c.spunT;
  px=c.x+c.hy*.3;py=c.y-c.hx*.3;a=0;interact();
  if(me!==c)throw Error('Did not enter cruiser');
  const before=a;K.KeyW=K.KeyD=1;drive(.05);K.KeyW=K.KeyD=0;
  const camera=chaseCam(.05),finite=[a,px,py,c.hx,c.hy,...camera].every(Number.isFinite);
  if(finite)render(0);
  return {sameHeading:a===before,stopped:c.v===0,finite};
 });
 assert.deepEqual(result,{sameHeading:true,stopped:true,finite:true});
}));

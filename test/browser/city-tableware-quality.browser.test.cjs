'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);
 await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;clearWanted();mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('dishes have recessed floors, normalised lip surfaces and open cup handles; drinks sit below the rim',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  const draw=drawBox,capture=fn=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{fn();}finally{drawBox=draw;}return out;};
  const height=(shapes,x,y)=>Math.max(-Infinity,...shapes.map(q=>{const t=q.ray(x,y,2,0,0,-1,q.box);return t>0?2-t:-Infinity;}));
  projX=10000;dx=1;dy=0;
  const out={};
  for(const [kind,r]of [['plate',.124],['bowl',.106],['cup',.042]]){
   const shapes=capture(()=>kitchenVessel(0,0,.78,kind)),centre=height(shapes,0,0),rim=height(shapes,r,0);
   out[kind]={centre,rim,normal:Math.hypot(HIT.nx,HIT.ny,HIT.nz)};
  }
  const cup=capture(()=>kitchenCup(0,0,.78));
  const hits=(x,z)=>cup.some(q=>q.ray(x,-1,z,0,1,0,q.box)>0);
  out.cup.drink=height(cup,0,0);out.cup.hole=hits(.056,.837);out.cup.handle=hits(.072,.837);
  const pot=capture(()=>kitchenCookware(0,0,.45,1,0,{kind:'pot',scale:4.1,wide:2.7,filled:true}));
  out.pot={broth:height(pot,0,0),rim:height(pot,.295,0),left:Math.min(...pot.map(q=>q.box.x-q.box.hl)),right:Math.max(...pot.map(q=>q.box.x+q.box.hl))};
  return out;
 });
 for(const k of ['plate','bowl','cup']){const q=result[k];assert.ok(q.rim>q.centre+.01,JSON.stringify(result));assert.ok(Math.abs(q.normal-1)<1e-6);}
 assert.ok(result.cup.drink>result.cup.centre&&result.cup.drink<result.cup.rim-.01);assert.equal(result.cup.hole,false);assert.equal(result.cup.handle,true);
 assert.ok(result.pot.rim>result.pot.broth+.1);assert.ok(result.pot.left>-.4&&result.pot.right<.4,JSON.stringify(result.pot));
}));

test('all new table settings sit on real tabletop surfaces, including small round tables and occupied booths',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  projX=10000;dx=1;dy=0;
  const failures=[],counts={},draw=drawBox;
  const capture=fn=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{fn();}finally{drawBox=draw;}return out;};
  for(const kind of ['home','loft','bellehome','islandhome','pho','dumplings','dimsum','pizzeria','burgerjoint','kissaten','sushibar','bakery']){
   const random=Math.random;Math.random=()=>.25;
   try{enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},ROOM_DEFS[kind].entry||[5,6,-Math.PI/2]);}finally{Math.random=random;}
   const settings=room.props.filter(o=>o.tableware);counts[kind]=settings.length;
   for(const setting of settings){
    const z=setting.tableware.support;
    const hosts=room.props.filter(o=>o.box&&o.draw&&Math.abs(o.box.z1-z)<1e-6).flatMap(o=>capture(()=>o.draw(o.x,o.y)));
    const shapes=capture(()=>setting.draw(setting.x,setting.y));
    for(const q of shapes)for(let ix=0;ix<5;ix++)for(let iy=0;iy<5;iy++){
     const x=q.box.x+(ix/4*2-1)*q.box.hl,y=q.box.y+(iy/4*2-1)*q.box.hw;
     if(q.ray(x,y,2,0,0,-1,q.box)<0)continue;
     const supported=hosts.some(host=>{const t=host.ray(x,y,2,0,0,-1,host.box);return t>0&&Math.abs(2-t-z)<.025;});
     if(!supported){failures.push({kind,at:[setting.x,setting.y],point:[x,y]});break;}
    }
   }
  }
  return{failures,counts};
 });
 assert.deepEqual(result.failures,[]);for(const [kind,n]of Object.entries(result.counts))assert.ok(n>0,kind);
}));

test('restaurants keep their own meals through room changes, and moving sushi remains supported on the belt',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const meals={},random=Math.random;Math.random=()=>.25;
  try{for(const kind of ['pizzeria','pho','kissaten','burgerjoint','dumplings','home']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},ROOM_DEFS[kind].entry||[5,6,-Math.PI/2]);
   meals[kind]=[...new Set(room.props.filter(p=>p.tableware).map(p=>p.tableware.meal))];
  }}finally{Math.random=random;}
  enterRoom('sushibar',{word:'SUSHI',ret:[100,100,0]},[6,6.2,-Math.PI/2]);
  const draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});
  try{kitchenSushi(0,0,.95,1);}finally{drawBox=draw;}
  const floor=Math.min(...shapes.map(q=>q.box.z0)),roof=Math.max(...shapes.map(q=>q.box.z1));
  const belt=sushiBelt(),centres=[];
  drawBox=box=>{if(box.profile?.length===KITCHEN_VESSELS.plate.length)centres.push([box.x,box.y]);};
  let moving;
  try{T=10;belt.draw(0,0);const before=centres[0];centres.length=0;T=15;belt.draw(0,0);moving=[before,centres[0]];}finally{drawBox=draw;}
  return{meals,floor,roof,moving};
 });
 assert.deepEqual(r.meals,{pizzeria:['pizza'],pho:['soup'],kissaten:['coffee'],burgerjoint:['burger'],dumplings:['dumplings'],home:['coffee']});
 assert.ok(Math.abs(r.floor-.95)<1e-8&&r.roof<1.01);assert.ok(Math.abs(r.moving[1][0]-r.moving[0][0]-.9)<1e-8);
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('sushi chefs stand clear of the prep bench and belt, and the front chef still serves the counter',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('sushibar',{word:'SUSHI',ret:[100,100,0]},[6,5.7,-Math.PI/2]);
  const chefs=room.props.filter(o=>o.fig&&o.y>SUSHI_LOOP.y0&&o.y<SUSHI_LOOP.y1&&o.x>3.3&&o.x<8.7);
  const blocked=chefs.flatMap(o=>room.props.filter(q=>q.box&&q.box.z0<1&&q.box.z1>.2&&inBox(q.box,o.x,o.y,.18)).map(q=>[o.x,o.y,q.box.x,q.box.y]));
  a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);
  return{count:chefs.length,blocked,prompt:promptText(),keeper:room.def.keeper,front:chefs.some(o=>Math.hypot(o.x-room.def.keeper[0],o.y-room.def.keeper[1])<.01)};
 });
 assert.equal(r.count,2);assert.deepEqual(r.blocked,[]);assert.ok(r.front);assert.match(r.prompt,/E: shop$/);
 await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));
}));

test('an intentional delayed mouse release cannot reopen Pause after closing a menu; an actual loss still pauses',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const original=Object.getOwnPropertyDescriptor(document,'pointerLockElement'),exit=document.exitPointerLock,request=cv.requestPointerLock;
  let locked=cv,captures=0;
  Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>locked});
  document.exitPointerLock=()=>{locked=null;};cv.requestPointerLock=()=>{captures++;return Promise.resolve();};
  try{
   const el=panel('release-regression');showPanel(el,'<h1>Menu</h1>');hidePanel(el);lockMouse();
   const deferred=captures===0;document.dispatchEvent(new Event('pointerlockchange'));
   const resumed=!paused&&captures===1&&!browserMouseReleasePending;
   document.dispatchEvent(new Event('pointerlockchange'));const duplicateIgnored=!paused;
   locked=cv;document.dispatchEvent(new Event('pointerlockchange'));
   locked=null;document.dispatchEvent(new Event('pointerlockchange'));const escaped=paused&&pauseEl.style.display==='flex';
   return{deferred,resumed,duplicateIgnored,escaped};
  }finally{
   if(original)Object.defineProperty(document,'pointerLockElement',original);else delete document.pointerLockElement;
   document.exitPointerLock=exit;cv.requestPointerLock=request;browserMouseReleasePending=browserMouseRelockPending=browserMouseObservedLocked=false;
  }
 });assert.deepEqual(r,{deferred:true,resumed:true,duplicateIgnored:true,escaped:true});
}));

test('food is visible as geometry behind the front and side panes of every case',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],drawers={foodOval,counterPizza,counterPastry,counterDeli};
  for(const kind of ['pizzeria','bakery','icecream','deli']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},[5,5,0]);const model=room.props.find(o=>o.foodCase);room.props=[model];
   for(const side of ['front','end']){
    px=model.x+(side==='end'?model.foodCase.hl+.8:0);py=model.y+(side==='front'?1.15:0);a=side==='front'?-Math.PI/2:Math.PI;body.crouch=1;pitch=-.12;
    foodOval=counterPizza=counterPastry=counterDeli=()=>{};render(0);const empty=BG.slice();
    ({foodOval,counterPizza,counterPastry,counterDeli}=drawers);render(0);
    let changed=0;for(let k=0;k<BG.length;k++)if(empty[k]!==BG[k])changed++;
    out.push({kind,side,changed});
   }
  }
  return out;
 });for(const q of r)assert.ok(q.changed>8,JSON.stringify(q));
}));

test('case contents and preparation boards remain inside their shared footprints and below the glass',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,fail=[],capture=fn=>{const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{fn();}finally{drawBox=draw;}return shapes;};
  projX=10000;dx=1;dy=0;
  const tray=capture(()=>foodTray(0,0,.7,.2,.12,.05));
  const top=x=>Math.max(...tray.map(q=>{const t=q.ray(x,0,2,0,0,-1,q.box);return t>0?2-t:-Infinity;}));
  const floor=top(0),rim=top(.198),normal=Math.hypot(HIT.nx,HIT.ny,HIT.nz);
  if(Math.abs(floor-.708)>1e-8||rim<floor+.03||Math.abs(normal-1)>1e-8)fail.push({floor,rim,normal});
  for(const kind of ['pizzeria','bakery','icecream','deli','dumplings','noodlehouse']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},[5,6,0]);
   const model=room.props.find(o=>o.foodCase||o.prep),meta=model.foodCase||model.prep;
   const shapes=capture(()=>model.draw(0,0));
   for(const {box:b}of shapes){
    const ex=Math.abs(b.x)+Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,ey=Math.abs(b.y)+Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw;
    if(ex>meta.hl+.001||ey>meta.hw+.001||b.z0<-.001||model.foodCase&&b.z1>meta.height+.013)fail.push({kind,ex,ey,z:b.z1});
   }
  }
  return fail;
 });assert.deepEqual(r,[]);
}));

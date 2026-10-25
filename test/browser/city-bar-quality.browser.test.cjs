'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the back bar has supported closed bottles, hollow glassware and fitted brackets, with every drawn part inside its collision bounds',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=BAR_BACK_BAR(),draw=drawBox,shapes=[],bad=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;}
  const role=n=>shapes.filter(q=>q.box.barRole===n),cast=(q,x,y,z,rx,ry,rz)=>q.ray(x,y,z,rx,ry,rz,q.box),same=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
  for(const q of role('bottle').concat(role('tumbler'))){const b=q.box;
   const bottom=b.z0-.5+cast(q,b.x,b.y,b.z0-.5,0,0,1);
   const support=Math.max(...role('board').map(q=>{const t=cast(q,b.x,b.y,bottom+.1,0,0,-1);return t>0?bottom+.1-t:-Infinity;}));
   if(!same(bottom,support))bad.push(['support',b.barRole,bottom,support]);
   const top=b.z1+.5-cast(q,b.x,b.y,b.z1+.5,0,0,-1);
   if(b.barRole==='bottle'&&!same(top,b.z1))bad.push('open cap');
   if(b.barRole==='tumbler'&&!(top>bottom+.004&&top<bottom+.012))bad.push('closed glass mouth');
   if(b.barRole==='tumbler'){
    q.shade(0,1,6);const floor=BG[0]&15;
    const rim=cast(q,b.x+.035,b.y,b.z1+.5,0,0,-1);q.shade(0,rim,6);
    if(!(rim>0)||(BG[0]&15)<=floor+1)bad.push('unreadable glass interior');
   }
   const t=cast(q,b.x,b.y+1,(b.z0+b.z1)/2,0,-1,0);
   if(!(t>0)||![HIT.nx,HIT.ny,HIT.nz].every(Number.isFinite)||!same(Math.hypot(HIT.nx,HIT.ny,HIT.nz),1))bad.push('normal');
   if(b.barRole==='bottle'){q.shade(0,t,0);const dark=BG[0]&15;q.shade(0,t,12);if((BG[0]&15)<=dark)bad.push('emissive bottle');}
  }
  for(const q of role('bracket-arm')){const b=q.box,support=b.az+b.r;if(!BAR_BACK.levels.some(z=>same(z,support)))bad.push('bracket/board');}
  for(const q of role('guard-post')){const b=q.box;if(!model.backBar.levels.some(z=>same(b.az,z)))bad.push('post/board');if(!role('guard').some(q=>same(q.box.az,b.bz)))bad.push('post/rail');}
  const parent=model.box;
  for(const {box:b}of shapes)if(b.x-b.hl<parent.x-parent.hl-1e-7||b.x+b.hl>parent.x+parent.hl+1e-7||b.y-b.hw<parent.y-parent.hw-1e-7||b.y+b.hw>parent.y+parent.hw+1e-7||b.z0<parent.z0-1e-7||b.z1>parent.z1+1e-7)bad.push(['bounds',b.barRole]);
  if(!same(parent.y-parent.hw,1))bad.push('wall contact');
  const back=role('back')[0].box;if(!same(back.y-back.hw,1))bad.push('back panel/wall');
  return {bad,bottles:role('bottle').length,glasses:role('tumbler').length,boards:role('board').length};
 });assert.deepEqual(r.bad,[]);assert.equal(r.bottles,45);assert.equal(r.glasses,12);assert.equal(r.boards,3);
}));

test('the built back bar leaves staff and the sign clear and retains real E shopping',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('bar',{word:'BAR',neon:RED,ret:[100,100,0]},[6,3,-Math.PI/2]);const model=room.props.find(q=>q.backBar),k=room.def.keeper;
  room.props=room.props.filter(q=>!q.fig||Math.hypot(q.x-k[0],q.y-k[1])<.001);
  px=6;py=3.1;a=-Math.PI/2;pitch=-.05;env(0);render(0);
  return {built:!!model,painted:!!room.def.shelves,staffClear:!inBox(model.box,...k,.18),wallClear:model.box.y-model.box.hw>=1-1e-7,signClear:model.box.z1<2.3,prompt:promptText(),aisle:free(6,1.4)};
 });assert.ok(r.built&&!r.painted&&r.staffClear&&r.wallClear&&r.signClear&&r.aisle,JSON.stringify(r));assert.match(r.prompt,/E: shop/);
 await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
}));

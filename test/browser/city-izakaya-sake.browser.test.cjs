'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);enterRoom('izakaya',{word:'IZAKAYA',ret:[100,100,0]},[5.3,3.7,-Math.PI/2]);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('sake bottles have closed caps and stand apart on real boards; mounts and braces join the wall and shelf inside the rendered bounds',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=room.props.find(q=>q.sakeShelves),draw=drawBox,projection=projX,shapes=[],bad=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;projX=projection;}
  const role=s=>shapes.filter(q=>q.box.sakeRole===s),cast=(q,x,y,z,rx,ry,rz)=>q.ray(x,y,z,rx,ry,rz,q.box),same=(a,b)=>Math.abs(a-b)<1e-7;
  const bottles=role('bottle'),boards=role('board'),posts=role('guard-post');
  for(const q of bottles){const b=q.box,foot=SAKE_BOTTLES[b.sakeKind][1][1]*.99;
   const bottom=b.z0-.1+cast(q,b.x,b.y,b.z0-.1,0,0,1),top=b.z1+.1-cast(q,b.x,b.y,b.z1+.1,0,0,-1);
   if(!same(bottom,b.z0)||!same(top,b.z1)||![HIT.nx,HIT.ny,HIT.nz].every(Number.isFinite))bad.push('bottle cap/base');
   for(const [dx,dy]of [[0,0],[foot,0],[-foot,0],[0,foot],[0,-foot]])if(!boards.some(p=>same(cast(p,b.x+dx,b.y+dy,b.z0+.1,0,0,-1),.1)))bad.push('unsupported bottle');
   const above=boards.filter(p=>p.box.z0>b.z0);if(above.some(p=>p.box.z0<=b.z1))bad.push('bottle through next board');
   for(const other of bottles)if(q!==other&&same(b.z0,other.box.z0)&&Math.hypot(b.x-other.box.x,b.y-other.box.y)<b.hl+other.box.hl+.01)bad.push('bottles touch');
   const labelHit=cast(q,b.x,b.y+.5,b.z0+.14,0,-1,0);q.shade(0,labelHit,0);
   if((BG[0]&15)>7)bad.push('glowing label');
   if((BG[0]>>4)!==RED)bad.push('close label seal missing');
   q.shade(0,100,0);if((BG[0]>>4)!==WHITE)bad.push('distant ink not filtered');
  }
  for(const p of role('wall-plate')){const b=p.box,z=(b.z0+b.z1)/2;if(!same(.5+cast(p,b.x,.5,z,0,1,0),1))bad.push('floating wall plate');}
  for(const arm of role('bracket-arm')){const b=arm.box,x=(b.ax+b.bx)/2,y=(b.ay+b.by)/2;
   const z=b.z1+.1-cast(arm,x,y,b.z1+.1,0,0,-1);
   if(!boards.some(p=>same(p.box.z0,z)))bad.push('arm misses board');
   if(!role('bracket-brace').some(p=>same(p.box.bx,b.bx)&&same(p.box.by,b.by)&&same(p.box.bz,b.bz)))bad.push('brace misses arm');
   if(!role('wall-plate').some(p=>Math.abs(p.box.x-b.ax)<.001&&b.ay-b.r<=p.box.y+p.box.hw&&b.az>=p.box.z0&&b.az<=p.box.z1))bad.push('bracket misses mount');
  }
  for(const guard of role('guard'))for(const [x,y,z]of [[guard.box.ax,guard.box.ay,guard.box.az],[guard.box.bx,guard.box.by,guard.box.bz]])if(!posts.some(p=>same(p.box.bx,x)&&same(p.box.by,y)&&same(p.box.bz,z)))bad.push('guard endpoint');
  for(const p of posts)if(!boards.some(q=>same(q.box.z1,p.box.az)))bad.push('floating guard');
  for(const p of shapes){const b=p.box,m=model.box;if(b.x-b.hl<m.x-m.hl-1e-7||b.x+b.hl>m.x+m.hl+1e-7||b.y-b.hw<m.y-m.hw-1e-7||b.y+b.hw>m.y+m.hw+1e-7||b.z0<m.z0-1e-7||b.z1>m.z1+1e-7)bad.push(['bounds',b.sakeRole]);}
  return {bad,bottles:bottles.length,boards:boards.length,kinds:new Set(bottles.map(q=>q.box.sakeKind)).size};
 });assert.deepEqual(r.bad,[]);assert.equal(r.bottles,42);assert.equal(r.boards,2);assert.equal(r.kinds,4);
}));

test('izakaya shelves keep the bartender and staff aisle accessible, with real E service',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const q=room.props.find(q=>q.sakeShelves),k=room.def.keeper,bad=[];
  if(inBox(q.box,k[0],k[1],.18))bad.push('keeper blocked');
  for(let x=2.75;x<7.9;x+=.15)if(!free(x,1.7))bad.push(['staff aisle',x]);
  px=k[0];py=3.1;a=Math.atan2(k[1]-py,k[0]-px);env(0);render(0);
  return{bad,prompt:promptText()};
 });assert.deepEqual(r.bad,[]);assert.match(r.prompt,/E: shop$/);await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));
}));

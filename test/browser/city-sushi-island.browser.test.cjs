'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);enterRoom('sushibar',{word:'SUSHI',ret:[100,100,0]},[6,7.5,-Math.PI/2]);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the island\'s slabs never overlap, and its top is one surface all the way round the belt',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const sides=room.props.filter(o=>o.sushiIsland),all=sides.flatMap(o=>o.sushiIsland.parts),bad=[],eps=1e-9;
  for(let a=0;a<all.length;a++)for(let b=a+1;b<all.length;b++){
   const A=all[a],B=all[b],ox=Math.min(A.x1,B.x1)-Math.max(A.x0,B.x0),oy=Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0),oz=Math.min(A.z1,B.z1)-Math.max(A.z0,B.z0);
   if(ox>eps&&oy>eps&&oz>eps)bad.push(['overlap',A.role,B.role,+ox.toFixed(3),+oy.toFixed(3)]);
  }
  // every point of the band's footprint has exactly one piece on top, at the ledge, belt or rail height
  const {x0,x1,y0,y1}=SUSHI_LOOP,E=SUSHI_ISLAND.edge,tops=all.filter(q=>q.z1>=SUSHI_ISLAND.top-eps);let gaps=0,n=0;
  for(let x=x0-E+.004;x<x1+E;x+=.017)for(let y=y0-E+.004;y<y1+E;y+=.017){
   const band=!(x>x0+E&&x<x1-E&&y>y0+E&&y<y1-E);if(!band)continue;n++;
   const k=tops.filter(q=>x>q.x0&&x<q.x1&&y>q.y0&&y<q.y1).length;if(k!==1)gaps++;
  }
  // the same footprint as the four boxes it replaced
  const boxes=sides.map(o=>o.box).map(b=>[b.x,b.y,b.hl,b.hw].map(v=>+v.toFixed(3)));
  return{bad:bad.slice(0,6),gaps,n,sides:sides.length,boxes,painted:room.props.some(o=>o.shade&&o.box&&o.box.z1===.95)};
 });
 assert.deepEqual(r.bad,[]);assert.equal(r.gaps,0,`${r.gaps}/${r.n}`);assert.equal(r.sides,4);assert.equal(r.painted,false);
 assert.deepEqual(r.boxes,[[6,2.6,3.25,.25],[6,4.9,3.25,.25],[3,3.75,.25,.9],[9,3.75,.25,.9]]);
}));

test('plates ride on the belt all the way round; taps and tea canisters stand on the outer ledge in front of each seat',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const all=room.props.filter(o=>o.sushiIsland).flatMap(o=>o.sushiIsland.parts),bad=[];
  const on=(x,y,z,role)=>all.some(q=>q.role===role&&x>q.x0&&x<q.x1&&y>q.y0&&y<q.y1&&Math.abs(q.z1-z)<1e-9);
  const P=2*(SUSHI_LOOP.x1-SUSHI_LOOP.x0+SUSHI_LOOP.y1-SUSHI_LOOP.y0);
  for(let s=0;s<P;s+=.05){const [x,y]=sushiAt(s);if(!on(x,y,.95,'belt'))bad.push(['plate off the belt',s]);}
  const seats=room.props.find(o=>o.sushiFittings).sushiFittings.seats;
  for(const q of seats)for(const k of [-SUSHI_ISLAND.fitting,SUSHI_ISLAND.fitting]){const x=q.x+q.along[0]*k,y=q.y+q.along[1]*k;
   for(const [dx,dy] of [[.033,0],[-.033,0],[0,.033],[0,-.033]])if(!on(x+dx,y+dy,SUSHI_ISLAND.top,'outer-ledge'))bad.push(['fitting',x,y]);}
  // each seat's stool stands just outside, in front of its tap and canister
  const stools=room.props.filter(o=>o.seat&&o.h===.62);
  for(const q of seats)if(!stools.some(s=>Math.hypot(s.x-(q.x+q.fx*.375),s.y-(q.y+q.fy*.375))<.05))bad.push(['no stool',q.x,q.y]);
  // the stools stay reachable and the chefs still serve across the island
  let lane=true;for(let x=2.2;x<=9.8;x+=.05)lane&&=free(x,SUSHI_LOOP.y1+1.0);
  const k=room.def.keeper;px=6;py=SUSHI_LOOP.y1+.7;a=Math.atan2(k[1]-py,k[0]-px);render(0);
  return{bad:bad.slice(0,6),count:bad.length,seats:seats.length,lane,prompt:promptText()};
 });
 assert.deepEqual(r.bad,[],r.count+' bad');assert.equal(r.seats,16);assert.ok(r.lane);assert.match(r.prompt,/E: shop$/);
}));

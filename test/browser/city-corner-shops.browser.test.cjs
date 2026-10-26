'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the gas station shop is fitted: counters with what stands on them, the freezer, ATM, crisps and papers, none of them overlapping',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  const rnd=Math.random;Math.random=()=>.1;try{enterRoom('gas',{word:'GAS',ret:[100,100,0]},[5,5,0]);}finally{Math.random=rnd;} // (with the wet-floor cone out)
  if(!room.props.some(o=>o.wetFloor))bad.push('no wet-floor cone');
  const P=room.props,draw=drawBox,parts=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,ray,shade});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return out;};
  const counters=P.filter(o=>o.shopCounter);if(counters.length!==3)bad.push(['counters',counters.length]);
  // what stands on a counter stands on its top
  for(const o of P.filter(o=>o.till||o.jar||o.box&&o.draw&&!o.shopCounter&&o.box.z0>0&&o.box.z0<1.2)){
   const under=counters.find(c=>inBox(c.box,o.x,o.y,0));
   if(!under){if(o.till||o.jar)bad.push(['not on a counter',o.x,o.y]);continue;}
   if(Math.abs(o.box.z0-under.box.z1)>1e-9)bad.push(['floating or sunk',+o.x.toFixed(2),+o.y.toFixed(2),o.box.z0,under.box.z1]);
  }
  // the till screen and console face the clerk; the ATM, freezer and papers face the shop
  const keeper=room.def.keeper,till=P.find(o=>o.till);
  if((keeper[0]-till.x)*till.till.fx+(keeper[1]-till.y)*till.till.fy<=0)bad.push('till faces away from the clerk');
  const atm=P.find(o=>o.atm);if(atm.atm.fy!==-1)bad.push('ATM faces the wall');
  // every part stays inside its model's collision box (a little headroom for rounded tops)
  for(const o of P.filter(o=>o.shopCounter||o.till||o.jar||o.atm||o.crispStand||o.newsRack)){
   for(const q of parts(o)){const x=q.box,c=Math.abs(x.c??1),s=Math.abs(x.s??0),ex=x.hl*c+x.hw*s,ey=x.hl*s+x.hw*c,b=o.box,bc=Math.abs(b.c??1),bs=Math.abs(b.s??0),bx=b.hl*bc+b.hw*bs,by=b.hl*bs+b.hw*bc;
    if(x.x-ex<b.x-bx-1e-6||x.x+ex>b.x+bx+1e-6||x.y-ey<b.y-by-1e-6||x.y+ey>b.y+by+1e-6||x.z1>b.z1+1e-6||x.z0<b.z0-1e-6)bad.push(['outside its box',+o.x.toFixed(2),+o.y.toFixed(2),+x.x.toFixed(3),+x.y.toFixed(3),x.z0,x.z1]);}
  }
  // crisp bags hang on their hooks clear of the spine and the base
  const cs=P.find(o=>o.crispStand),d=cs.crispStand;
  for(const b of d.bags)if(b.z-.17<d.base+1e-9)bad.push('bag on the base');
  // papers lie on the rack's trays
  const nr=P.find(o=>o.newsRack);for(const q of nr.newsRack.papers)if(!nr.newsRack.tiers.some(([z])=>Math.abs(q.z-(z+.01))<1e-9))bad.push('paper off its tray');
  // nothing solid shares space with the new fittings
  const built=P.filter(o=>o.shopCounter||o.atm||o.crispStand||o.newsRack||o.wetFloor||o.box&&o.draw&&o.box.z0===0&&/ICE/.test(String(o.draw)));
  for(const a of built)for(const b of P){
   if(a===b||!b.box||b.fig||b.seat||!b.draw)continue;
   if(b.box.z0>=a.box.z1-1e-9||a.box.z0>=b.box.z1-1e-9)continue; // (things standing on top)
   const ax=Math.abs(a.box.c??1)*a.box.hl+Math.abs(a.box.s??0)*a.box.hw,ay=Math.abs(a.box.s??0)*a.box.hl+Math.abs(a.box.c??1)*a.box.hw;
   const bx=Math.abs(b.box.c??1)*b.box.hl+Math.abs(b.box.s??0)*b.box.hw,by=Math.abs(b.box.s??0)*b.box.hl+Math.abs(b.box.c??1)*b.box.hw;
   if(Math.abs(a.box.x-b.box.x)<ax+bx-.01&&Math.abs(a.box.y-b.box.y)<ay+by-.01)bad.push(['overlap',+a.x.toFixed(2),+a.y.toFixed(2),+b.x.toFixed(2),+b.y.toFixed(2)]);
  }
  // the old painted boxes are gone
  if(String(ROOM_DEFS.gas.props).includes('BX('))bad.push('a painted box is left in the gas station');
  // aisles: past the counter to the clerk's side, to the ATM, round the crisps, to the coffee
  for(const [x,y] of [[8.1,7.2],[8.1,8.1],[6.6,3.6],[6.6,5.2],[2.2,2],[2.2,6.1],[4.5,8.2]])if(!free(x,y))bad.push(['aisle blocked',x,y]);
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));

test('the bodega counter carries its plexiglass screen; grill, deli case and crates stand clear of each other',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000;
  enterRoom('bodega',{word:'BODEGA',ret:[100,100,0]},[5,5,0]);
  const P=room.props,counter=P.find(o=>o.shopCounter),screen=P.find(o=>o.plexi);
  if(!counter||!screen){bad.push('missing counter or screen');return bad;}
  if(Math.abs(screen.box.z0-counter.box.z1)>1e-9)bad.push('screen not on the counter top');
  if(!inBox(counter.box,screen.x,screen.y,0))bad.push('screen off the counter');
  // the screen sits between the clerk and the shop
  const keeper=room.def.keeper;if(!(keeper[0]>screen.x))bad.push('clerk on the wrong side of the screen');
  // panes see-through (but for the glint), the middle one raised over the pass-through
  const pass=screen.plexi.panes[1];if(Math.abs(pass.z0-screen.plexi.z-screen.plexi.gap)>1e-9)bad.push('no pass-through');
  const draw=drawBox,parts=[];drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});try{screen.draw(screen.x,screen.y);}finally{drawBox=draw;}
  const panes=parts.filter(q=>q.box.hw===.004);let clear=0,n=0;
  for(const q of panes)for(let k=0;k<20;k++){HIT.u=k*.037;HIT.w=1.2+k*.021;HIT.face=3;n++;if(!q.shade(0,1,8))clear++;}
  if(panes.length!==3||clear<n*.8)bad.push(['panes',panes.length,clear,n]);
  // nothing solid overlaps (people and the cat aside; the screen stands on the counter)
  const solid=P.filter(o=>o.box&&o.draw&&!o.fig&&!o.seat);
  for(let a=0;a<solid.length;a++)for(let b=a+1;b<solid.length;b++){const A=solid[a].box,B=solid[b].box;
   if(B.z0>=A.z1-1e-9||A.z0>=B.z1-1e-9)continue;
   const ax=Math.abs(A.c??1)*A.hl+Math.abs(A.s??0)*A.hw,ay=Math.abs(A.s??0)*A.hl+Math.abs(A.c??1)*A.hw,bx=Math.abs(B.c??1)*B.hl+Math.abs(B.s??0)*B.hw,by=Math.abs(B.s??0)*B.hl+Math.abs(B.c??1)*B.hw;
   if(Math.abs(A.x-B.x)<ax+bx-.005&&Math.abs(A.y-B.y)<ay+by-.005)bad.push(['overlap',+A.x.toFixed(2),+A.y.toFixed(2),+B.x.toFixed(2),+B.y.toFixed(2)]);}
  if(String(ROOM_DEFS.bodega.props).includes('BX('))bad.push('a painted box is left in the bodega');
  for(const [x,y] of [[6.8,6.4],[4.2,1.3],[3.1,6.9],[1.5,3]])if(!free(x,y))bad.push(['aisle blocked',x,y]);
  return bad.slice(0,10);
 });
 assert.deepEqual(r,[]);
}));

test('the bodega clerk serves through the clear screen from the customer side with E',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('bodega',{word:'BODEGA',ret:[100,100,0]},[5,5,0]);const screen=room.props.find(o=>o.plexi),k=room.def.keeper;
  px=screen.x-.75;py=k[1];a=0;pitch=(1.6-interactionEye())/(k[0]-px)*projY/rows;
  return{free:free(px,py),prompt:promptText()};
 });assert.ok(r.free,'customer stands outside the counter');assert.match(r.prompt,/E: shop/);
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>shopEl?.style.display),'flex');
}));

test('the paper rack trays connect to grounded feet rather than floating in front of the uprights',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  enterRoom('gas',{word:'GAS',ret:[100,100,0]},[5,5,0]);const o=room.props.find(o=>o.newsRack),draw=drawBox,out=[],bad=[];
  drawBox=(box,shade,ray=rayBox)=>out.push({box:{...box},ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
  const d=o.newsRack,B=o.box,c=B.c,s=B.s;
  const parts=out.filter(q=>!d.papers.some(p=>Math.abs(q.box.z0-p.z)<1e-8&&Math.abs(q.box.hl-.11)<1e-8)).map(q=>({u:(q.box.x-o.x)*c+(q.box.y-o.y)*s,v:-(q.box.x-o.x)*s+(q.box.y-o.y)*c,...q.box}));
  const joined=(a,b)=>Math.abs(a.u-b.u)<=a.hl+b.hl+1e-8&&Math.abs(a.v-b.v)<=a.hw+b.hw+1e-8&&a.z0<=b.z1+1e-8&&b.z0<=a.z1+1e-8;
  const reached=new Set(parts.map((p,k)=>Math.abs(p.z0)<1e-8?k:-1).filter(k=>k>=0)),queue=[...reached];
  while(queue.length){const k=queue.pop();parts.forEach((p,j)=>{if(!reached.has(j)&&joined(parts[k],p)){reached.add(j);queue.push(j);}});}
  if(parts.filter(p=>Math.abs(p.z0)<1e-8&&p.hl<.03&&p.hw>.12).length<2)bad.push('missing fore/aft floor feet');
  for(const[z]of d.tiers){const k=parts.findIndex(p=>Math.abs(p.z0-z)<1e-8&&Math.abs(p.hl-.24)<1e-8);if(k<0||!reached.has(k))bad.push('tray disconnected from the floor');}
  return bad;
 });assert.deepEqual(bad,[]);
}));

test('the nested cups have an open top cup and fixed turned fittings reuse their profiles',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const draw=drawBox,bad=[];const capture=o=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box:{...box},ray});try{o.draw(0,0);}finally{drawBox=draw;}return out;};
  const cup=CUP_STACK(0,0,0,6),P=capture(cup),shape=P.find(p=>p.ray===coveRayLathe),b=shape.box,t=shape.ray(0,0,b.z1+.1,0,0,-1,b),floor=b.z1+.1-t;
  if(!(t>0&&floor>.08&&floor<.15&&b.z1-floor>.06))bad.push('top cup has a solid lid or no nested floor');
  for(const o of [cup,JERKY_JAR(0,0,1),WET_FLOOR_CONE(0,0)]){const a=capture(o),b=capture(o);if(a.some((q,k)=>q.box.profile&&q.box.profile!==b[k].box.profile))bad.push('fixed turned profiles rebuilt');}
  return bad;
 });assert.deepEqual(bad,[]);
}));

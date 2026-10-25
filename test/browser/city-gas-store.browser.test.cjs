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

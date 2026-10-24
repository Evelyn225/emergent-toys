'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('service cabinets have sealed worktops, mounted doors and pulls with real finger clearance inside their footprint',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];projX=10000;
  for(const [hl,hw,height]of [[2.8,.32,1.05],[3.6,.28,1],[.55,.32,.9],[2,.38,.63]]){
   const model=KITCHEN_SERVICE_COUNTER(0,0,hl,hw,height),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const top=shapes.find(q=>q.ray===homeRayWorktop&&q.box.z1===height),body=shapes.find(q=>q.ray===coveRayRounded&&q.box.z0===.08),
    doors=shapes.filter(q=>q.ray===homeRayWorktop&&q.box.hw===.012),bars=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.r===.008),
    anchors=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.r===.006);
   const closed=[[-hl+.015,-hw+.015],[hl-.015,hw-.015],[0,0]].every(([x,y])=>{
    const down=top.ray(x,y,2,0,0,-1,top.box),n=Math.hypot(HIT.nx,HIT.ny,HIT.nz),up=top.ray(x,y,0,0,0,1,top.box);
    return down>0&&up>0&&Math.abs(2-down-height)<1e-6&&Math.abs(up-(height-.04))<1e-6&&Math.abs(n-1)<1e-6;
   });
   const mounted=doors.every(q=>{
    const z=(q.box.z0+q.box.z1)/2,t=body.ray(q.box.x,2,z,0,-1,0,body.box),u=q.ray(q.box.x,-2,z,0,1,0,q.box);
    return t>0&&u>0&&-2+u<2-t;
   });
   const handles=bars.every(q=>{
    const b=q.box,door=doors.find(d=>Math.abs(d.box.x-b.x)<1e-6),t=door.ray(b.x,2,b.az,0,-1,0,door.box),front=2-t,
     supports=anchors.filter(a=>Math.abs(a.box.az-b.az)<1e-6&&Math.abs(a.box.by-b.ay)<1e-6&&[b.ax,b.bx].some(x=>Math.abs(x-a.box.ax)<1e-6));
    return t>0&&b.ay-b.r-front>.02&&supports.length===2&&supports.every(a=>a.box.ay<front);
   });
   const bounds=shapes.every(({box:b})=>Math.abs(b.x)+b.hl<=hl+1e-6&&Math.abs(b.y)+b.hw<=hw+1e-6&&b.z0>=0&&b.z1<=height);
   out.push({closed,mounted,handles,bounds,doors:doors.length,bars:bars.length});
  }
  return out;
 });for(const q of r){assert.ok(q.closed&&q.mounted&&q.handles&&q.bounds,JSON.stringify(q));assert.equal(q.bars,q.doors);assert.ok(q.doors>=2);}
}));

test('refitted cabinets preserve appliance supports, room clearance and the taco shop tile finish',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;projX=10000;
  for(const [kind,word]of [['burgerjoint','BURGERS'],['taqueria','TACOS'],['chickenshop','CHICKEN'],['bento','BENTO'],['yakitori','YAKITORI'],['juicebar','JUICE'],['pho','PHO'],['dumplings','DUMPLINGS'],['kissaten','KISSATEN'],['izakaya','IZAKAYA'],['roastery','COFFEE'],['noodlehouse','NOODLES'],['pizzeria','PIZZA']]){
   enterRoom(kind,{word,ret:[100,100,0]},[5,4,0]);const counters=room.props.filter(q=>q.serviceCounter),bad=[];
   for(const q of counters){
    for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#WS'.includes(room.grid[y][x])&&furnishingOverlap(q.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall/shelf',x,y]);
    for(const o of room.props.filter(o=>o.fig))if(inBox(q.box,o.x,o.y,.18))bad.push(['staff',o.x,o.y]);
   }
   const equipment=room.props.filter(q=>q.kitchenCoffee&&q.kitchenCoffee.kind!=='roaster'||q.kitchenCounter?.kind==='rice-cooker');
   const supported=equipment.every(q=>counters.some(c=>Math.abs(c.box.z1-q.box.z0)<1e-6&&
    Math.abs(c.x-q.x)+q.box.hl<=c.box.hl+1e-6&&Math.abs(c.y-q.y)+q.box.hw<=c.box.hw+1e-6));
   let tiles=true;
   if(kind==='taqueria'){
    const q=counters[0],shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{q.draw(0,0);}finally{drawBox=draw;}
    const colors=new Set();for(const part of shapes.filter(s=>s.ray===homeRayWorktop&&s.box.hw===.012))for(const u of [-.05,.05]){
     const t=part.ray(part.box.x+u,2,.45,0,-1,0,part.box);part.shade(0,t,8);colors.add(BG[0]>>4);
    }tiles=colors.has(BLUE)&&colors.has(WHITE);
   }
   out.push({kind,counters:counters.length,bad,supported,tiles});
  }
  return out;
 });for(const q of r){assert.ok(q.counters>=1,JSON.stringify(q));assert.deepEqual(q.bad,[],q.kind);assert.ok(q.supported&&q.tiles,JSON.stringify(q));}
}));

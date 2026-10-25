'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const SHOPS=[['store','STORE','grocery',1],['florist','FLORIST','florist',1],['drugstore','DRUGSTORE','pharmacy',1],['thrift','THRIFT','thrift',1],['books','BOOKS','books',3]];

// a point in a unit's frame: u along its wall from its middle, v out from the wall face
const FRAME=`(o,x,y)=>{const d=o.wallShelves,c=d.c,s=d.s,face=d.wall==='left'?[1,(d.a0+d.a1)/2]:d.wall==='right'?[room.W-1,(d.a0+d.a1)/2]:[(d.a0+d.a1)/2,1];
 const ex=x-face[0],ey=y-face[1];return [c*ex+s*ey,-s*ex+c*ey];}`;

test('wall shelves are built units on their wall faces, clear of the clerk, and only where a shop asks for them',()=>fixture(async p=>{
 const r=await p.evaluate(([SHOPS,FRAME])=>{
  const frame=eval(FRAME),out=[];
  for(const [kind,word,stock,units] of SHOPS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   const w=room.props.filter(o=>o.wallShelves),keeper=room.def.keeper,bad=[];
   if(w.length!==units){out.push([kind,['units',w.length]]);continue;}
   for(const o of w){const d=o.wallShelves,c=d.c,s=d.s,mid=(d.a0+d.a1)/2;
    if(d.kind!==stock)bad.push('stock');
    // the collision box covers the unit from the wall face out to its depth, along its whole run
    const [u0,v0]=frame(o,o.box.x-o.box.hl,o.box.y-o.box.hw),[u1,v1]=frame(o,o.box.x+o.box.hl,o.box.y+o.box.hw);
    if(Math.abs(Math.min(v0,v1))>1e-9||Math.abs(Math.max(v0,v1)-WALL_SHELF.depth)>1e-9)bad.push([d.wall,'off the wall face']);
    if(Math.abs(Math.abs(u1-u0)-(d.a1-d.a0))>1e-9)bad.push([d.wall,'run length']);
    for(let u=-(d.a1-d.a0)/2+.05;u<(d.a1-d.a0)/2;u+=.25){const fx=o.x+c*u-s*(-WALL_SHELF.depth/2-.05),fy=o.y+s*u+c*(-WALL_SHELF.depth/2-.05);if(roomAt(fx,fy)!=='#')bad.push([d.wall,'no wall behind',+u.toFixed(2)]);}
    if(keeper){const [ku,kv]=frame(o,keeper[0],keeper[1]);if(Math.abs(ku)<(d.a1-d.a0)/2+.2&&kv-WALL_SHELF.depth<.18)bad.push([d.wall,'crowds the clerk']);}
    if(d.facings<30)bad.push([d.wall,'thin stock',d.facings]); // (book spines stand in runs, one facing each)
   }
   // no two units overlap
   for(const a of w)for(const b of w)if(a!==b&&Math.abs(a.box.x-b.box.x)<a.box.hl+b.box.hl-1e-9&&Math.abs(a.box.y-b.box.y)<a.box.hw+b.box.hw-1e-9)bad.push('units overlap');
   out.push([kind,bad]);
  }
  // shelves only where asked: the thrift room's other trades keep their own walls
  for(const word of ['ANTIQUES','TAILOR']){enterRoom('thrift',{word,ret:[100,100,0]},[5,5,0]);if(room.props.some(o=>o.wallShelves))out.push([word,['has shelves']]);}
  if(Object.values(ROOM_DEFS).some(d=>d.shelves===true))out.push(['defs',['a painted-shelves flag is left']]);
  enterRoom('thrift',{word:'THRIFT',ret:[100,100,0]},[5,5,0]);
  if(!free(9.2,1.5))out.push(['thrift',['fitting room blocked']]);
  enterRoom('store',{word:'STORE',ret:[100,100,0]},[5,5,0]);
  for(const x of [1.5,2.5,7.5,8.3])if(!free(x,1.6))out.push(['store',['back aisle blocked',x]]);
  // the bookshop's aisles beside the cases, and the walk past the right-hand case stay open
  enterRoom('books',{word:'BOOKS',ret:[100,100,0]},[5,5,0]);
  for(const [x,y] of [[1.6,2.5],[1.6,4],[8.4,2.5],[5,1.6],[8.4,3.8]])if(!free(x,y))out.push(['books',['aisle blocked',x,y]]);
  return out;
 },[SHOPS,FRAME]);
 for(const [k,bad] of r)assert.deepEqual(bad,[],k);
}));

test('wall-shelf stock stands on its shelf, inside its bay and under the shelf above; shelves meet the upright faces',()=>fixture(async p=>{
 const r=await p.evaluate(([SHOPS,FRAME])=>{
  const frame=eval(FRAME),bad=[];
  for(const [kind,word] of SHOPS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   for(const o of room.props.filter(o=>o.wallShelves)){
    const d=o.wallShelves,G=GONDOLA,W=WALL_SHELF,tag=kind+':'+d.wall;
    const draw=drawBox,parts=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
    // each part's extent in the unit frame (boxes are built square to the unit; turned stock is round)
    const span=q=>{const x=q.box,[u,v]=frame(o,x.x,x.y),round=q.ray===coveRayLathe;return {u,v,hu:x.hl,hv:round?x.hl:x.hw,z0:x.z0,z1:x.z1};};
    const tops=d.levels.map(z=>z+G.board),U=G.upright/2,back=W.back,len=d.a1-d.a0;
    for(const q of parts){const e=span(q);
     if(e.u-e.hu<-len/2-1e-9||e.u+e.hu>len/2+1e-9||e.v-e.hv<-1e-9||e.v+e.hv>W.depth+1e-9||e.z1>d.height+1e-9)bad.push([tag,'outside the unit',+e.u.toFixed(3),+e.v.toFixed(3),e.z0]);}
    const shelves=parts.filter(q=>q.ray===rayBox&&Math.abs(q.box.z1-q.box.z0-G.board)<1e-9&&d.levels.includes(q.box.z0));
    if(shelves.length!==d.levels.length*d.bays)bad.push([tag,'shelves',shelves.length]);
    for(const q of shelves){const e=span(q);
     if(!d.posts.some(p=>Math.abs(p+U-(e.u-e.hu))<1e-9)||!d.posts.some(p=>Math.abs(p-U-(e.u+e.hu))<1e-9))bad.push([tag,'shelf off the uprights',+e.u.toFixed(3)]);
     if(Math.abs(e.v-e.hv-back)>1e-9||Math.abs(e.v+e.hv-W.depth)>1e-9)bad.push([tag,'shelf depth']);}
    const stock=parts.filter(q=>q.box.z0>0&&!shelves.includes(q)&&Math.abs(q.box.z1-d.height)>1e-9); // (the frame stands on the floor; the cap is at the top)
    if(stock.length!==d.facings)bad.push([tag,'stock count',stock.length,d.facings]);
    for(const q of stock){const e=span(q),k=tops.findIndex(t=>Math.abs(e.z0-t)<1e-9);
     if(k<0){bad.push([tag,'not on a shelf',e.z0]);continue;}
     const lid=d.levels[k+1]??d.height-.03;if(e.z1>lid+1e-9)bad.push([tag,'through the shelf above',e.z1,lid]);
     const b=d.posts.findIndex((p,n)=>n<d.posts.length-1&&e.u>p&&e.u<d.posts[n+1]);
     if(b<0||e.u-e.hu<d.posts[b]+U-1e-9||e.u+e.hu>d.posts[b+1]-U+1e-9)bad.push([tag,'into an upright',+e.u.toFixed(3)]);
     if(e.v-e.hv<back-1e-9||e.v+e.hv>W.depth+1e-9)bad.push([tag,'off the shelf depth',+e.v.toFixed(3)]);
    }
   }
  }
  return bad.slice(0,10);
 },[SHOPS,FRAME]);
 assert.deepEqual(r,[]);
}));

test('thrift shelf vases have open necks, real inner walls and a closed supported base',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  enterRoom('thrift',{word:'THRIFT',ret:[100,100,0]},[5,5,0]);const o=room.props.find(p=>p.wallShelves),parts=[],draw=drawBox,bad=[];
  drawBox=(box,shade,ray=rayBox)=>parts.push({box:{...box},shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
  const vases=parts.filter(q=>q.ray===coveRayLathe);
  for(const q of vases){const b=q.box,from=b.z1+.1,t=q.ray(b.x,b.y,from,0,0,-1,b);
   if(!(t>0&&Math.abs(from-t-b.z0-.008)<1e-7))bad.push('sealed mouth or missing base');
   const z=b.z0+(b.z1-b.z0)*.46,inside=q.ray(b.x,b.y,z,1,0,0,b),nx=HIT.nx;
   const outside=1-q.ray(b.x+1,b.y,z,-1,0,0,b),thickness=outside-inside;
   if(!(inside>0&&nx<-.5&&thickness>.002&&thickness<.008))bad.push('no thin inward-facing wall');
   if(!parts.some(s=>s.ray===rayBox&&Math.abs(s.box.z1-b.z0)<1e-8&&inBox(s.box,b.x,b.y,0)))bad.push('base off the shelf');
  }
  return{bad:bad.slice(0,8),count:vases.length};
 });assert.deepEqual(result.bad,[]);assert.ok(result.count>10,'native bric-a-brac vases checked');
}));

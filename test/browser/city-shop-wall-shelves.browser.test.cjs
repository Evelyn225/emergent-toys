'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const SHOPS=[['store','STORE','grocery'],['florist','FLORIST','florist'],['drugstore','DRUGSTORE','pharmacy'],['thrift','THRIFT','thrift']];

test('the back-wall shelves are one built unit on the wall face, clear of the clerk, and only where a shop asks for them',()=>fixture(async p=>{
 const r=await p.evaluate(SHOPS=>{
  const out=[];
  for(const [kind,word,stock] of SHOPS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   const w=room.props.filter(o=>o.wallShelves),q=w[0],b=q?.box,keeper=room.def.keeper,bad=[];
   if(w.length!==1){out.push([kind,['units',w.length]]);continue;}
   if(q.wallShelves.kind!==stock)bad.push('stock');
   if(Math.abs(b.y-b.hw-1)>1e-9)bad.push('off the wall');
   for(let x=b.x-b.hl+.05;x<b.x+b.hl;x+=.25)if(roomAt(x,.95)!=='#')bad.push(['no wall behind',x]);
   if(roomAt(b.x-b.hl-.05,1.1)!=='#'&&b.x-b.hl>1+1e-9&&word!=='THRIFT')bad.push('short of the side wall');
   if(keeper&&Math.abs(keeper[0]-b.x)<b.hl&&keeper[1]-(b.y+b.hw)<.18)bad.push(['crowds the clerk',keeper[1]-(b.y+b.hw)]);
   if(q.wallShelves.facings<60)bad.push(['thin stock',q.wallShelves.facings]);
   out.push([kind,bad]);
  }
  // shelves only where asked: the thrift room's other trades keep their own walls
  for(const word of ['ANTIQUES','TAILOR']){enterRoom('thrift',{word,ret:[100,100,0]},[5,5,0]);if(room.props.some(o=>o.wallShelves))out.push([word,['has shelves']]);}
  if(Object.values(ROOM_DEFS).some(d=>d.shelves===true))out.push(['defs',['a painted-shelves flag is left']]);
  // the thrift unit stops short of the fitting room's way in
  enterRoom('thrift',{word:'THRIFT',ret:[100,100,0]},[5,5,0]);
  if(!free(9.2,1.5))out.push(['thrift',['fitting room blocked']]);
  enterRoom('store',{word:'STORE',ret:[100,100,0]},[5,5,0]);
  for(const x of [1.5,2.5,7.5,8.3])if(!free(x,1.6))out.push(['store',['back aisle blocked',x]]);
  return out;
 },SHOPS);
 for(const [k,bad] of r)assert.deepEqual(bad,[],k);
}));

test('wall-shelf stock stands on its shelf, inside its bay and under the shelf above; shelves meet the upright faces',()=>fixture(async p=>{
 const r=await p.evaluate(SHOPS=>{
  const bad=[];
  for(const [kind,word] of SHOPS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   const o=room.props.find(o=>o.wallShelves),d=o.wallShelves,G=GONDOLA,W=WALL_SHELF;
   const draw=drawBox,parts=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
   const tops=G.levels.map(z=>z+G.board),posts=d.posts.map(u=>o.x+u),U=G.upright/2,back=1+W.back,front=1+W.depth;
   for(const q of parts){const x=q.box;
    if(x.x-x.hl<o.box.x-o.box.hl-1e-9||x.x+x.hl>o.box.x+o.box.hl+1e-9||x.y-x.hw<1-1e-9||x.y+x.hw>front+1e-9||x.z1>G.height+1e-9)bad.push([kind,'outside the unit',+x.x.toFixed(3),+x.y.toFixed(3),x.z0]);
   }
   const shelves=parts.filter(q=>q.ray===rayBox&&Math.abs(q.box.z1-q.box.z0-G.board)<1e-9&&G.levels.includes(q.box.z0));
   if(shelves.length!==G.levels.length*d.bays)bad.push([kind,'shelves',shelves.length]);
   for(const q of shelves){const x=q.box,l=x.x-x.hl,rr=x.x+x.hl;
    if(!posts.some(e=>Math.abs(e+U-l)<1e-9)||!posts.some(e=>Math.abs(e-U-rr)<1e-9))bad.push([kind,'shelf off the uprights',+l.toFixed(3)]);
    if(Math.abs(x.y-x.hw-back)>1e-9||Math.abs(x.y+x.hw-front)>1e-9)bad.push([kind,'shelf depth']);}
   const stock=parts.filter(q=>q.ray===coveRayLathe||q.box.hl<.2&&q.box.hw<.1&&!(q.box.z0===0));
   if(stock.length!==d.facings)bad.push([kind,'stock count',stock.length,d.facings]);
   for(const q of stock){const x=q.box,k=tops.findIndex(t=>Math.abs(x.z0-t)<1e-9);
    if(k<0){bad.push([kind,'not on a shelf',x.z0]);continue;}
    const lid=G.levels[k+1]??G.height-.03;if(x.z1>lid+1e-9)bad.push([kind,'through the shelf above',x.z1,lid]);
    const b=posts.findIndex((e,n)=>n<posts.length-1&&x.x>e&&x.x<posts[n+1]);
    if(b<0||x.x-x.hl<posts[b]+U-1e-9||x.x+x.hl>posts[b+1]-U+1e-9)bad.push([kind,'into an upright',+x.x.toFixed(3)]);
    if(x.y-x.hw<back-1e-9||x.y+x.hw>front+1e-9)bad.push([kind,'off the shelf depth',+x.y.toFixed(3)]);
   }
  }
  return bad.slice(0,10);
 },SHOPS);
 assert.deepEqual(r,[]);
}));

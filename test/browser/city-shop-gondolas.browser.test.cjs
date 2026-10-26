'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const SHOPS=[['store','STORE','grocery'],['books','BOOKS','books'],['grocer','GROCER','grocery'],['hardware','HARDWARE','hardware'],['pharmacy','PHARMACY','pharmacy'],
 ['video','VIDEO','video'],['liquor','LIQUOR','wine'],['gas','GAS','grocery'],['bodega','BODEGA','grocery'],['drugstore','DRUGSTORE','pharmacy'],['toys','TOYS','toys']];

test('every shelf island is a built gondola on its old footprint, with no painted block left in the grid',()=>fixture(async p=>{
 const r=await p.evaluate(SHOPS=>{
  const out=[],bad=[];
  for(const [kind,word,stock] of SHOPS){
   const blocks=gondolaBlocks(ROOM_DEFS[kind].grid),cells=ROOM_DEFS[kind].grid.join('').split('S').length-1;
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   const g=room.props.filter(o=>o.gondola);
   out.push([kind,g.length===blocks.length&&blocks.length>0,!room.grid.some(row=>row.includes('S')),g.every(o=>o.gondola.kind===stock)]);
   // the blocks tile exactly the old cells, and each gondola's box is its block
   if(blocks.reduce((a,b)=>a+(b.x1-b.x0)*(b.y1-b.y0),0)!==cells)bad.push([kind,'blocks miss cells']);
   for(const o of g){const b=o.gondola.block,x=o.box;
    if(Math.abs(x.x-(b.x0+b.x1)/2)>1e-9||Math.abs(x.y-(b.y0+b.y1)/2)>1e-9||Math.abs(x.hl-(b.x1-b.x0)/2)>1e-9||Math.abs(x.hw-(b.y1-b.y0)/2)>1e-9)bad.push([kind,'footprint',b]);
    if(o.gondola.facings<40)bad.push([kind,'thin stock',o.gondola.facings]);
   }
  }
  return{out,bad};
 },SHOPS);
 assert.deepEqual(r.bad,[]);for(const [k,count,noS,stock] of r.out)assert.ok(count&&noS&&stock,k);
}));

test('gondola stock stands on its shelves inside the footprint and under the shelf above; the frame joins at shared heights',()=>fixture(async p=>{
 const r=await p.evaluate(SHOPS=>{
  const bad=[];
  for(const [kind,word] of SHOPS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   for(const o of room.props.filter(o=>o.gondola)){
    const draw=drawBox,parts=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
    const G=GONDOLA,b=o.gondola.block,tops=G.levels.map(z=>z+G.board);
    const shelves=parts.filter(q=>q.box.hl>.5&&Math.abs(q.box.z1-q.box.z0-G.board)<1e-9&&G.levels.includes(q.box.z0));
    if(shelves.length!==G.levels.length)bad.push([kind,'shelves',shelves.length]);
    for(const q of parts){
     const x=q.box,c=x.c??1,s=x.s??0,ex=Math.abs(x.hl*c)+Math.abs(x.hw*s),ey=Math.abs(x.hl*s)+Math.abs(x.hw*c);
     if(x.x-ex<b.x0-1e-6||x.x+ex>b.x1+1e-6||x.y-ey<b.y0-1e-6||x.y+ey>b.y1+1e-6)bad.push([kind,'outside the footprint',+x.x.toFixed(2),+x.y.toFixed(2)]);
     if(x.z1>G.height+1e-9)bad.push([kind,'above the top']);
     const stock=q.ray===coveRayLathe||x.hl<.5&&x.hw<o.gondola.half-.01; // (uprights span the full depth)
     if(stock&&!x.gondolaContents){
      const k=tops.findIndex(t=>Math.abs(x.z0-t)<1e-9);if(k<0){bad.push([kind,'not on a shelf',x.z0]);continue;}
      const lid=G.levels[k+1]??G.height-.03;if(x.z1>lid+1e-9)bad.push([kind,'through the shelf above',x.z1,lid]);
     }
    }
   }
  }
  return bad.slice(0,8);
 },SHOPS);
 assert.deepEqual(r,[]);
}));

test('stock draws nearest first, reusing its depth order until the camera turns',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  enterRoom('grocer',{word:'GROCER',ret:[100,100,0]},[2,7,0]);const o=room.props.find(q=>q.gondola),sort=Array.prototype.sort,draw=drawBox,bad=[];let sorts=0;
  Array.prototype.sort=function(...args){sorts++;return sort.apply(this,args);};
  const capture=(x,y)=>{const out=[];drawBox=(b,s,ray=rayBox)=>{if(ray===rayBox&&b.z1-b.z0<.4&&GONDOLA.levels.some(z=>Math.abs(b.z0-z-GONDOLA.board)<1e-8))out.push(dx*b.x+dy*b.y);};try{o.draw(x,y);}finally{drawBox=draw;}if(out.length<40)bad.push('missing stock');for(let k=1;k<out.length;k++)if(out[k]<out[k-1]-1e-8)bad.push('stock order reversed');};
  try{
   dx=1;dy=0;capture(o.x,o.y);const first=sorts;capture(o.x,o.y);capture(o.x+.7,o.y-.6);if(sorts!==first)bad.push('sorted while the camera only translated');
   dx=-1;dy=0;capture(o.x,o.y);if(sorts!==first+1)bad.push('turn did not update the order once');const turned=sorts;capture(o.x+.2,o.y+.3);if(sorts!==turned)bad.push('turned order not reused');
  }finally{Array.prototype.sort=sort;drawBox=draw;}
  return bad;
 });assert.deepEqual(result,[]);
}));

test('hardware gondola bins are open shells with supported metal parts, including a rotated aisle',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  enterRoom('hardware',{word:'HARDWARE',ret:[100,100,0]},[2,7,0]);const bad=[];let bins=0,rotated=false;
  for(const o of room.props.filter(q=>q.gondola)){
   const draw=drawBox,parts=[];drawBox=(box,shade,ray=rayBox)=>parts.push({box:{...box},shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
   for(const q of parts.filter(q=>q.box.hl>=.055&&q.box.hl<.2&&q.box.hw>.1&&q.box.z1-q.box.z0<.4&&GONDOLA.levels.some(z=>Math.abs(q.box.z0-z-GONDOLA.board)<1e-8))){
    bins++;const b=q.box,from=b.z1+.1,t=q.ray(b.x,b.y,from,0,0,-1,b);if(!(t>0&&Math.abs(from-t-b.z0-.008)<1e-7))bad.push('solid lid instead of a recessed floor');
    rotated ||=Math.abs(b.s)>.5;
    const ih=b.hl-.008,rz=-(b.z1-b.z0)/2/ih-.05/ih;
    const wall=q.ray(b.x,b.y,b.z1+.05,b.c,b.s,rz,b);if(!(wall>0&&HIT.nx*b.c+HIT.ny*b.s<-.9))bad.push('missing inward-facing wall');
    const stock=parts.filter(p=>p.box.gondolaContents&&p.box.z0>=b.z0&&p.box.z0<b.z1&&inBox(b,p.box.x,p.box.y,0));if(stock.length<2)bad.push('empty parts bin');
    for(const p of stock){const w=p.box,u=(w.x-b.x)*b.c+(w.y-b.y)*b.s,v=-(w.x-b.x)*b.s+(w.y-b.y)*b.c;
     if(Math.abs(u)+w.hl>b.hl-.008||Math.abs(v)+w.hl>b.hw-.008||w.z1>b.z1)bad.push('parts outside the bin');
     const from=b.z1+.1,t=q.ray(w.x,w.y,from,0,0,-1,b);if(!(t>0&&Math.abs(from-t-w.z0)<1e-7))bad.push('parts float above bin floor');
    }
   }
  }
  return{bad:bad.slice(0,8),bins,rotated};
 });assert.deepEqual(result.bad,[]);assert.ok(result.bins>40);assert.ok(result.rotated,'checks the native north/south hardware aisle');
}));

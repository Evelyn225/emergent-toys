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
     if(stock){
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

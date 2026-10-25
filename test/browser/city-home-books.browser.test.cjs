'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('bound shelf books have real cover thickness, recessed paper, joined spines and exact shelf support',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;
  for(const angle of [0,.2,Math.PI/2,Math.PI,Math.PI*1.5]){
   const model=FURNITURE_STORAGE(0,0,.75,.18,1.05,angle,true),c=Math.cos(angle),s=Math.sin(angle),shapes=[],bad=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const cast=(q,u,v,z,du,dv,dz)=>q.ray(c*u-s*v,s*u+c*v,z,c*du-s*dv,s*du+c*dv,dz,q.box),same=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
   for(let index=0;index<6;index++){
    const parts=shapes.filter(q=>q.box.bookIndex===index),covers=parts.filter(q=>q.box.bookRole==='cover').sort((a,b)=>(a.box.x-b.box.x)*c+(a.box.y-b.box.y)*s),pages=parts.find(q=>q.box.bookRole==='pages'),spine=parts.find(q=>q.box.bookRole==='spine');
    if(covers.length!==2||!pages||!spine){bad.push(['parts',index]);continue;}
    const u=pages.box.x*c+pages.box.y*s,v=-spine.box.x*s+spine.box.y*c-spine.box.hw,z=(pages.box.z0+pages.box.z1)/2;
    const outer=u-.5+cast(covers[0],u-.5,0,z,1,0,0),inner=u+.5-cast(covers[0],u+.5,0,z,-1,0,0);
    if(!same(inner-outer,.003))bad.push(['cover thickness',index]);
    const pageRight=u+.5-cast(pages,u+.5,0,z,-1,0,0),coverInner=u-.5+cast(covers[1],u-.5,0,z,1,0,0);
    if(!same(pageRight,coverInner))bad.push(['cover/pages',index]);
    const pageBound=.5-cast(pages,u,.5,z,0,-1,0),spineBound=-.5+cast(spine,u,-.5,z,0,1,0);
    if(!same(pageBound,spineBound))bad.push(['spine/pages',index]);
    const paperTop=1.5-cast(pages,u,0,1.5,0,0,-1),coverTop=1.5-cast(covers[0],u-.0205,0,1.5,0,0,-1);
    if(!same(coverTop-paperTop,.004))bad.push(['recess',index]);
    for(const q of covers){const x=q.box.x*c+q.box.y*s,y=-q.box.x*s+q.box.y*c,floor=-1+cast(q,x,y,-1,0,0,1);
     const supports=shapes.filter(q=>q.box.bookRole==null).map(q=>{const t=cast(q,x,y,floor+.05,0,0,-1);return t>0?floor+.05-t:-Infinity;});
     if(!same(Math.max(...supports),floor))bad.push(['shelf support',index,floor,Math.max(...supports)]);
    }
    for(const q of parts){const b=q.box,x=c*b.x+s*b.y,y=-s*b.x+c*b.y;
     if(Math.abs(x)+b.hl>model.box.hl+1e-7||Math.abs(y)+b.hw>model.box.hw+1e-7||b.z0<0||b.z1>model.box.z1)bad.push(['bounds',index,b.bookRole]);
     const t=cast(q,c*b.x+s*b.y,-s*b.x+c*b.y+1,z,0,-1,0);
     if(!(t>0)||![HIT.nx,HIT.ny,HIT.nz].every(Number.isFinite)||!same(Math.hypot(HIT.nx,HIT.ny,HIT.nz),1))bad.push(['normal',index,b.bookRole]);
    }
   }
   out.push({angle,bad,parts:shapes.filter(q=>q.box.bookRole).length});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.parts,24);}
}));

test('Fern, studio, loft and Belle shelf models all render supported bound volumes without changing their furniture boxes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];
  for(const kind of ['home','loft','bellehome','islandhome']){
   enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);const shelves=room.props.filter(q=>q.furniture==='shelf'),counts=[];
   for(const model of shelves){let covers=0,pages=0,spines=0;
    drawBox=(b,...args)=>{if(b.bookRole==='cover')covers++;if(b.bookRole==='pages')pages++;if(b.bookRole==='spine')spines++;return draw(b,...args);};
    try{model.draw(model.x-px,model.y-py);}finally{drawBox=draw;}counts.push({covers,pages,spines,box:model.box});
   }env(0);render(0);out.push({kind,counts});
  }return out;
 });for(const q of r){assert.ok(q.counts.length>0,q.kind);for(const s of q.counts){assert.equal(s.covers,12);assert.equal(s.pages,6);assert.equal(s.spines,6);assert.ok(s.box.hl>=.5&&s.box.hw===.18);}}
}));

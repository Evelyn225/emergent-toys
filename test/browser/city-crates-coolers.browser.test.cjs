'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('every drinks cooler backs onto its wall and opens into the room, its products on real shelves behind clear glass',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;projX=10000;
  for(const [kind,word]of [['kebabshop','KEBAB'],['takoyaki','TAKOYAKI'],['bodega','BODEGA'],['motel','MOTEL'],['taqueria','TACOS']]){
   enterRoom(kind,{word,ret:[100,100,0]},[5,4,0]);
   for(const q of room.props.filter(o=>o.drinksCooler)){
    const d=q.drinksCooler,c=-d.fy,s=d.fx,bad=[],shapes=[];
    if(roomAt(q.x-d.fx*(d.depth+.06),q.y-d.fy*(d.depth+.06))!=='#')bad.push('back off the wall');
    if(roomAt(q.x+d.fx*(d.depth+.3),q.y+d.fy*(d.depth+.3))!=='.')bad.push('doors face a wall');
    drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{q.draw(0,0);}finally{drawBox=draw;}
    const at=(u,v)=>[c*u+d.fx*v,s*u+d.fy*v],surfaces=shapes.filter(o=>o.ray===homeRayWorktop);
    for(const g of d.goods){
     const [x,y]=at(g.u,g.v);
     if(Math.abs(g.u)+.033>d.half-.03)bad.push(['side',g.u]);
     const hits=surfaces.map(o=>o.ray(x,y,g.z+.5,0,0,-1,o.box)).filter(t=>t>0);
     if(!hits.some(t=>Math.abs(t-.5)<1e-6))bad.push(['unsupported',g.u,g.z]);
    }
    const glass=shapes.find(o=>o.ray===rayBox&&o.box.hw===.004),[gx,gy]=at(.013,d.depth+.5);
    const t=glass.ray(gx,gy,.9,-d.fx,-d.fy,0,glass.box),clear=t>0&&!glass.shade(0,t,8);
    const handles=shapes.filter(o=>o.ray===coveRayCapsule&&Math.abs(o.box.z1-o.box.z0)>.4);
    if(handles.some(h=>(h.box.ax*d.fx+h.box.ay*d.fy)<d.depth))bad.push('handle behind the glass');
    out.push({kind,goods:d.goods.length,cans:d.goods.filter(g=>g.can).length,doors:d.doors,handles:handles.length,clear,bad});
   }
  }
  return out;
 });
 assert.deepEqual(r.map(q=>q.kind),['kebabshop','takoyaki','bodega','motel','taqueria']);
 for(const q of r){assert.deepEqual(q.bad,[],q.kind);assert.ok(q.clear&&q.goods>=40&&q.cans>0&&q.cans<q.goods&&q.handles===q.doors,JSON.stringify(q));}
}));

test('flour sacks rest layer on layer and open coffee sacks hold their beans below the rolled rim',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox;projX=10000;
  const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{KITCHEN_FLOUR_SACKS(0,0).draw(0,0);}finally{drawBox=draw;}
  const sacks=shapes.filter(o=>o.ray===coveRayRounded),bad=[];
  for(const top of sacks.filter(o=>o.box.z0>0)){
   const below=sacks.filter(o=>Math.abs(o.box.z1-top.box.z0)<1e-9);
   // straight down from the middle of each upper sack's base onto a lower sack's flat top
   const rests=below.some(o=>{const t=o.ray(top.box.x,top.box.y+(top.box.c?0:.1),top.box.z0+.5,0,0,-1,o.box);return t>0&&Math.abs(t-.5)<.002;});
   if(!rests)bad.push([top.box.x,top.box.y,top.box.z0]);
  }
  const floor=sacks.filter(o=>o.box.z0===0).length;
  const lathe=[];drawBox=(box,shade,ray=rayBox)=>lathe.push({box,ray});try{KITCHEN_COFFEE_SACK(0,0,'ETHIOPIA').draw(0,0);}finally{drawBox=draw;}
  const sack=lathe[0],beans=sack.ray(0,0,2,0,0,-1,sack.box),rimTop=Math.max(...sack.box.profile.map(q=>q[0])),side=sack.ray(-1,0,.3,1,0,0,sack.box);
  // the pizzeria's opened sack stands on the prep counter's worktop
  enterRoom('pizzeria',{word:'PIZZA',ret:[100,100,0]},[5,4,0]);
  const upright=room.props.find(o=>o.sack?.upright),counter=room.props.filter(o=>o!==upright&&o.draw&&o.box&&inBox(o.box,upright.x,upright.y,0)),parts=[];
  for(const o of counter){drawBox=(box,shade,ray=rayBox)=>parts.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}}
  const stands=parts.some(o=>{const t=o.ray(upright.x,upright.y,2,0,0,-1,o.box);return t>0&&Math.abs(2-t-upright.sack.floor)<1e-6;});
  return{sacks:sacks.length,floor,bad,beans:2-beans,rimTop,side:-1+side,stands};
 });
 assert.equal(r.sacks,5);assert.equal(r.floor,2);assert.deepEqual(r.bad,[]);
 assert.ok(Math.abs(r.beans-.47)<1e-6&&r.rimTop>r.beans+.07,JSON.stringify(r));
 assert.ok(r.side<-.2&&r.side>-.24,'the sack wall bulges out from its base');assert.ok(r.stands,'the upright sack stands on the worktop');
}));

test('beer crates: empties stand in their divided cells on the crate floor; upturned crates are the table and the seats',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox;projX=10000;
  const model=KITCHEN_BEER_CRATE(0,0,{levels:4,open:true}),d=model.beerCrate,shapes=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const tray=shapes.find(o=>o.ray===foodRayTray),bad=[],[cu,cv]=d.cell;
  for(const b of d.bottles){
   const t=tray.ray(b.u,b.v,b.z+.5,0,0,-1,tray.box);if(!(t>0&&Math.abs(t-.5)<1e-6))bad.push(['floor',b.u,b.v]);
   const i=Math.round((b.u+d.hl-.008)/cu-.5),j=Math.round((b.v+d.hw-.008)/cv-.5);
   const du=Math.abs(b.u-(-d.hl+.008+cu*(i+.5))),dv=Math.abs(b.v-(-d.hw+.008+cv*(j+.5)));
   if(du+.036>cu/2-.003||dv+.036>cv/2-.003)bad.push(['cell',b.u,b.v]);
  }
  const necks=d.bottles.every(b=>b.z+.29>d.top+d.openH),dividers=shapes.filter(o=>o.ray===homeRayWorktop&&(o.box.hl===.003||o.box.hw===.003)).length;
  const rnd=Math.random;try{Math.random=()=>.1;enterRoom('yakitori',{word:'YAKITORI',ret:[100,100,0]},[5,4,0]);}finally{Math.random=rnd;}
  const crates=room.props.filter(o=>o.beerCrate),seats=room.props.filter(o=>o.seat&&crates.some(c=>inBox(c.box,o.x,o.y,0)));
  const seated=seats.map(s=>{const c=crates.find(o=>inBox(o.box,s.x,s.y,0));return Math.abs(c.box.z1-s.h)<1e-9;});
  const table=crates.find(o=>o.beerCrate.levels===2);
  return{bottles:d.bottles.length,bad,necks,dividers,crates:crates.length,seated,tableTop:table.box.z1,top:model.box.z1};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.bottles>=15&&r.necks&&r.dividers===7,JSON.stringify(r));
 assert.equal(r.crates,4);assert.deepEqual(r.seated,[true,true]);assert.equal(r.tableTop,.6);assert.ok(Math.abs(r.top-1.15)<1e-9);
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('home palm pots, filled soil and stems have real contacts; their fronds stay inside the placement bounds',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];
  for(const [height,half]of [[1.4,.19],[1.6,.25]])for(const angle of [0,.2,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]){
   const model=HOME_PALM(0,0,height,23,half,angle),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0,model);}finally{drawBox=draw;}
   const role=n=>shapes.filter(q=>q.box.plantRole===n),pot=role('pot')[0],soil=role('soil')[0],saucer=role('saucer')[0],bad=[];
   const cast=(q,x,y,z,rx,ry,rz)=>q.ray(x,y,z,rx,ry,rz,q.box),same=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7;
   const saucerTop=1-cast(saucer,0,0,1,0,0,-1),potBase=-1+cast(pot,0,0,-1,0,0,1);
   if(!same(saucerTop,potBase))bad.push('saucer/pot');
   const floor=1-cast(pot,0,0,1,0,0,-1),soilBase=-1+cast(soil,0,0,-1,0,0,1),surface=1-cast(soil,0,0,1,0,0,-1);
   if(!same(floor,soilBase)||surface>=pot.box.z1-.03)bad.push(['soil floor/rim',floor,soilBase,surface]);
   for(const z of [.08,.20,.28])if(!same(cast(pot,0,0,z,1,0,0),cast(soil,0,0,z,1,0,0)))bad.push(['soil/wall',z]);
   for(const q of role('cane')){const b=q.box,t=cast(soil,b.ax,b.ay,1,0,0,-1),top=1-t;if(!(t>0&&b.az<top&&b.bz>top))bad.push('root');}
   const ribs=role('rachis');
   for(const q of role('leaf')){const b=q.box;if(!ribs.some(r=>Math.hypot(r.box.ax-b.leafX,r.box.ay-b.leafY,r.box.az-b.leafZ)<1e-9||Math.hypot(r.box.bx-b.leafX,r.box.by-b.leafY,r.box.bz-b.leafZ)<1e-9))bad.push('leaf attachment');}
   for(const {box:b,ray}of shapes){
    if(![b.x,b.y,b.hl,b.hw,b.z0,b.z1].every(Number.isFinite)||b.z0< -1e-7||b.z1>height+1e-7){bad.push(['bounds',b.plantRole]);continue;}
    for(const [nx,ny]of [[Math.cos(angle),Math.sin(angle)],[-Math.sin(angle),Math.cos(angle)]]){
     let extent;
     if(ray===homePalmRayLeaf){
      extent=Math.max(...b.localShape.profile.map(([u,r])=>Math.abs((b.leafX+b.axis[0]*u)*nx+(b.leafY+b.axis[1]*u)*ny)+r*Math.hypot(b.across[0]*nx+b.across[1]*ny,b.ratio*(b.normal[0]*nx+b.normal[1]*ny))));
     }else if(ray===coveRayCapsule)extent=Math.max(Math.abs(b.ax*nx+b.ay*ny),Math.abs(b.bx*nx+b.by*ny))+b.r;
     else extent=Math.abs(b.x*nx+b.y*ny)+b.hl;
     if(extent>half+1e-7)bad.push(['bounds',b.plantRole,extent]);
    }
   }
   out.push({height,half,angle,bad,leaves:role('leaf').length,roots:role('cane').length});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.leaves,90);assert.equal(q.roots,3);}
}));

test('palm leaflets are closed thin solids on both sides, with finite normals and the same geometry at outdoor scale',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=HOME_PALM(0,0,1.6,23,.25),draw=drawBox,inside=[],outside=[];
  drawBox=(box,shade,ray=rayBox)=>inside.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  drawBox=(box,shade,ray=rayBox)=>outside.push({box,ray});try{model.drawScaled(0,0,.1,2);}finally{drawBox=draw;}
  const leaves=inside.filter(q=>q.box.plantRole==='leaf'),small=outside.filter(q=>q.box.plantRole==='leaf'),bad=[];let tested=0;
  for(const [k,q]of leaves.entries()){
   const b=q.box,u=b.localShape.profile[3][0],point=[b.leafX+b.axis[0]*u,b.leafY+b.axis[1]*u,b.leafZ+b.axis[2]*u],n=b.normal;
   for(const side of [-1,1]){
    const o=point.map((v,j)=>v+n[j]*side*.5),d=n.map(v=>-v*side),t=q.ray(...o,...d,b),normal=[HIT.nx,HIT.ny,HIT.nz];
    if(!(t>0&&t<.5&&(.5-t)*2>.0015&&(.5-t)*2<.0025)||!normal.every(Number.isFinite)||Math.abs(Math.hypot(...normal)-1)>1e-7||normal.reduce((sum,v,j)=>sum+v*n[j]*side,0)<.99)bad.push(['solid/normal',k,side,t,normal]);
    const s=small[k],so=o.map((v,j)=>v*.1+(j===2?2:0)),st=s.ray(...so,...d,s.box);
    if(!(st>0&&Math.abs(st-t*.1)<1e-7))bad.push(['scale',k,side,t,st]);tested++;
   }
  }
  return{bad:bad.slice(0,20),tested,small:small.length};
 });assert.deepEqual(r.bad,[]);assert.equal(r.tested,180);assert.equal(r.small,90);
}));

test('a palm places flush without clipping, rotates and saves with real controls; Belle balconies draw its scaled leaves',()=>fixture(async p=>{
 await p.evaluate(()=>{money=30000;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();px=20.9;py=19;a=0;pitch=0;buy('f_plant');held=inv.findIndex(q=>q.id==='f_plant');fade=0;render(0);});
 await p.keyboard.press('KeyQ');assert.ok(await p.evaluate(()=>furnishingCandidate().ok&&Math.abs(furnishingCandidate().x-22.75)<1e-7));await p.keyboard.press('KeyQ');await p.keyboard.press('KeyE');
 const placed=await p.evaluate(()=>{const part=homeFurnishings(homeRecord()).parts[0],model=room.props.find(q=>q.furnishingKey===part.key),draw=drawBox,shapes=[];drawBox=b=>shapes.push(b);try{model.draw(model.x,model.y);}finally{drawBox=draw;}saveGame();return{palm:!!model.homePlant,angle:part.a,clear:shapes.every(b=>b.x+b.hl<=23+1e-7),height:model.box.z1};});
 assert.ok(placed.palm&&placed.clear);assert.equal(placed.angle,Math.PI/2);assert.equal(placed.height,1.6);
 await p.reload();await p.evaluate(()=>{paused=false;mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();px=18;py=19;env(0);render(0);});assert.ok(await p.evaluate(()=>room.props.some(q=>q.homePlant&&q.furnishingKey===1)));
 await p.keyboard.press('KeyF');await p.locator('[data-pack="1"]').click();assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts.length),0);assert.ok(await p.evaluate(()=>inv.some(q=>q.id==='f_plant')));await p.keyboard.press('Escape');
 await p.evaluate(()=>{
  paused=false;mode='walk';room=null;money=20000;buy('home_belle');const home=owned.homes.find(h=>h.kind==='home_belle');
  enterRoom('bellehome',{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[41,73,0]},[22.8,11.2,0]);stepHomeBalcony();render(0);leaveHomeBalcony();
  px=24.4;py=10.3;a=-Math.PI/2;pitch=0;held=inv.findIndex(q=>q.id==='f_plant');render(0);
 });
 await p.keyboard.press('KeyQ');assert.ok(await p.evaluate(()=>furnishingCandidate().ok));await p.keyboard.press('KeyE');
 const balcony=await p.evaluate(()=>{
  stepHomeBalcony();const floor=roofH,draw=drawBox,leaves=[];
  drawBox=(b,...args)=>{if(b.plantRole==='leaf')leaves.push(b);return draw(b,...args);};try{render(0);}finally{drawBox=draw;}
  const result={outside:homeBalconyActive(),leaves:leaves.length,scaled:leaves.every(b=>b.hl<.04&&b.hw<.04&&b.z0>=floor&&b.z1<=floor+.17)};leaveHomeBalcony();return result;
 });assert.ok(balcony.outside&&balcony.scaled);assert.equal(balcony.leaves,270);
 await p.keyboard.press('KeyF');await p.locator('[data-pack="1"]').click();await p.keyboard.press('Escape');
 const packed=await p.evaluate(()=>{
  paused=false;px=22.8;py=11.2;stepHomeBalcony();const draw=drawBox;let leaves=0;
  drawBox=(b,...args)=>{if(b.plantRole==='leaf')leaves++;return draw(b,...args);};try{render(0);}finally{drawBox=draw;}return leaves;
 });assert.equal(packed,180,'packing the palm clears the cached outside model');
}));

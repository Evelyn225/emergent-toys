'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=26;tod=12;env(0);render(0);money=500000;});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
async function home(p,id){await p.evaluate(id=>{cancelFurnishingPlacement();mode='walk';room=null;buyProperty(id,...(id==='home_island'?FERN_HOUSE.door:citySourcePoint(41,73)));const h=owned.homes.at(-1),kind={home_studio:'home',home_loft:'loft',home_belle:'bellehome',home_island:'islandhome'}[id];enterRoom(kind,{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[100,100,0]},ROOM_DEFS[kind].entry);render(0);},id);}
test('wall frames and clocks reject fitted panels, cornices, glazing and intersecting wall decor but retain clear wall placements',()=>fixture(async p=>{
 for(const id of ['home_studio','home_loft','home_belle','home_island']){await home(p,id);const r=await p.evaluate(()=>{
  const bad=[],h=homeRecord(),candidate=(id,x,y,angle,z)=>{px=x;py=y;a=angle;pitch=0;render(0);const t=Math.sin(a)>.9?room.H-1-py:Math.cos(a)<-.9?px-1:py-1;pitch=(z-eye)/t*projY/rows;furnishingPlacement={home:h,id,item:{id},a:0,held:-1};const q=furnishingCandidate();if(!free(px,py))bad.push('review position blocked');return q;};
  const x=room.kind==='home'?2.5:room.kind==='islandhome'?8:12,y=room.H-2;
  if(!candidate('f_frame',x,y,Math.PI/2,1.6).ok)bad.push('clear wall rejected');
  if(room.kind==='bellehome'){const oblique=candidate('f_frame',11,room.H-2.6,Math.atan2(1.6,1),1.6);if(!oblique.ok||Math.abs(oblique.a-Math.PI)>1e-8||Math.abs(oblique.x-12)>1e-8)bad.push('oblique ray selects wrong wall face');}
  if(room.kind==='bellehome')for(const id of ['f_frame','f_clock'])if(candidate(id,x,y,Math.PI/2,.65).ok)bad.push('wall decoration intersects panelling');
  if(room.def.tier===2&&candidate('f_frame',x,y,Math.PI/2,room.def.height-.4).ok)bad.push('frame intersects cornice');
  let q;if(room.kind==='home')q=candidate('f_frame',3.95,2.98,Math.PI,1.6);
  else if(room.kind==='islandhome')q=candidate('f_frame',18.7,room.H-2,Math.PI/2,1.6);
  else q=candidate('f_frame',12.5,1.65,-Math.PI/2,1.6);
  if(q.ok||!q.reason)bad.push('window/glass accepted without explanation');
  const first=candidate('f_frame',x,y,Math.PI/2,1.6);homeFurnishings(h).parts.push({...first,key:1,on:true});refreshFurnishedRoom();
  if(candidate('f_clock',x,y,Math.PI/2,1.6).ok)bad.push('clock overlaps frame');
  furnishingPlacement.part=homeFurnishings(h).parts[0];furnishingPlacement.id='f_frame';if(!furnishingCandidate().ok)bad.push('moving same frame rejects itself');
  return bad;});assert.deepEqual(r,[],id);}
}));
test('real rejected E preserves the flatpack, clear wall E hangs a flush frame and cache refresh follows actual structural props',()=>fixture(async p=>{
 await home(p,'home_belle');
 await p.evaluate(()=>{buy('f_frame');px=12;py=room.H-2;a=Math.PI/2;pitch=0;render(0);pitch=(.65-eye)*projY/rows;});
 await p.keyboard.press('q');assert.equal(await p.evaluate(()=>furnishingCandidate().ok),false);await p.keyboard.press('e');
 assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts.length===0&&inv.some(p=>p.id==='f_frame')&&!!furnishingPlacement),true);
 await p.evaluate(()=>{pitch=(1.6-eye)*projY/rows;render(0);});assert.equal(await p.evaluate(()=>furnishingCandidate().ok),true);await p.keyboard.press('e');
 const r=await p.evaluate(()=>{const part=homeFurnishings(homeRecord()).parts[0],box=furnishingBox(part);return{flush:Math.abs(box.y+box.hw-(room.H-1))<1e-8,count:room.props.filter(p=>p.furnishingKey===part.key).length,photo:part.photo};});assert.deepEqual(r,{flush:true,count:1,photo:0});
 const cache=await p.evaluate(()=>{const p={id:'f_frame',x:12,y:room.H-1-.035,z:1.6,a:Math.PI,key:-1};homeWallFixtureFit(p,room);const old=HOME_WALL_FIXTURE_BOUNDS.get(room.props),same=()=>HOME_WALL_FIXTURE_BOUNDS.get(room.props)===old;homeWallFixtureFit(p,room);const retained=same();refreshFurnishedRoom();homeWallFixtureFit(p,room);return{retained,replaced:!same()};});assert.deepEqual(cache,{retained:true,replaced:true});
}));

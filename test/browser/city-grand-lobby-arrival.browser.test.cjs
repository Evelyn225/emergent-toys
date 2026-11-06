'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;enterRoom('grandhotel',{word:'GRAND HOTEL',ret:[100,100,0]},[12,14.4,-Math.PI/2]);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('Grand arrival table and trolley draw cached colour geometry with grounded feet, supported top, vase, cases and handles',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const models=room.props.filter(p=>p.grandArrival);if(models.length!==2)return['missing arrival furniture'];const bad=[],old=drawBox;
  for(const o of models){const parts=o.grandArrival.parts,A=[],B=[];try{drawBox=(box,shade,ray)=>A.push({box:{...box},ref:box,shade,ray});o.draw(0,0);drawBox=(box,shade,ray)=>B.push({box:{...box},ref:box,shade,ray});o.draw(.2,.3);}finally{drawBox=old;}
   if(A.length!==parts.length||parts.length<20)bad.push('native parts missing');
   for(let k=0;k<A.length;k++){const a=A[k],b=B[k];if(a.ref!==b.ref||a.shade!==b.shade||Math.abs(b.box.x-a.box.x-.2)>1e-8||Math.abs(b.box.y-a.box.y-.3)>1e-8)bad.push('uncached translation');Object.assign(HIT,{u:0,v:0,w:(a.box.z0+a.box.z1)/2,nx:0,ny:0,nz:1,face:5});CH[0]='?';a.shade(0,2,8);if(CH[0]!==' '||BG[0]===NONE)bad.push('glyph or missing surface');}
   const role=r=>parts.filter(p=>p.role===r),one=r=>role(r)[0]?.box;
   if(o.grandArrival.kind==='table'){
    for(const [lower,upper]of [['plinth','pedestal'],['pedestal','rim'],['inset','vase']])if(Math.abs(one(lower).z1-one(upper).z0)>1e-8)bad.push('unsupported '+upper);
    const foot=role('plinth')[0],t=foot.ray(0,0,-1,0,0,1,foot.box);if(Math.abs(t-1)>1e-8)bad.push('floating plinth');
    if(role('bloom').length!==27||role('stem').length!==9||role('leaf').length!==9)bad.push('missing bouquet');
    const top=role('inset')[0],tTop=top.ray(.5,0,2,0,0,-1,top.box);if(Math.abs(2-tTop-.88)>1e-8)bad.push('open table top');
   }else{
    if(role('wheel').length!==4||role('case').length!==2)bad.push('missing luggage');
    for(const p of role('wheel'))if(Math.abs(Math.min(p.box.az,p.box.bz)-p.box.r)>1e-8)bad.push('floating wheel');
    for(const c of role('case'))if(Math.abs(c.box.z0-one('carpet').z1)>1e-8)bad.push('floating case');
    for(const c of role('castor'))if(Math.abs(c.box.z1-one('deck').z0)>1e-8)bad.push('floating deck');
   }
  }return bad;
 });assert.deepEqual(bad,[]);
}));
test('arrival group preserves round table collision, both aisles, lobby service routes and real exit controls',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{if(typeof GRAND_ARRIVAL==='undefined')return{bad:['missing arrival group']};const S=GRAND_ARRIVAL,bad=[];
  if(free(S.x,S.y)||free(S.x+S.radius-.02,S.y)||free(S.trolleyX,S.trolleyY))bad.push('walk through furniture');
  if(!free(S.x+.8,S.y+.8)||!roomOpen(S.x+.8,S.y+.8))bad.push('invisible square collider');
  const points=[[12,14.4],[10.6,10.6],[13.4,10.6],[6.5,4.2],[10.7,2.3],[4.9,9],[18.9,9],[12,15.6]];
  for(const [x,y]of points)if(!free(x,y)||(Math.hypot(x-12,y-14.4)>.01&&!roomPath(12,14.4,x,y).length))bad.push(['blocked route',x,y]);
  return{bad};});assert.deepEqual(r.bad,[]);
 await p.evaluate(()=>{px=12;py=15.6;a=Math.PI/2;render(0);});assert.match(await p.evaluate(()=>promptText()),/E: leave/);await p.keyboard.press('e');assert.deepEqual(await p.evaluate(()=>[mode,room===null,px,py]),['walk',true,100,100]);
}));
test('arrival floor inlay owns the native floor without a raised slab, and both new models visibly render with normal depth',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{if(typeof grandArrivalInlay!=='function')return{bad:['missing floor inlay']};const bad=[],S=GRAND_ARRIVAL;
  for(const [x,y,base]of [[S.x+1.25,S.y,GREEN],[S.x+2.43,S.y,GREEN],[S.x+2.28,S.y,WARM]]){
   const row=Math.floor(hor)+20,d=eye*projY/(row-hor+.5);px=x-d;py=y;roomFloor(0,row,0,1,0);if((BG[0]>>4)!==base||CH[0]!==' '||Math.abs(ZB[0]-d)>1e-5)bad.push(['floor registration/material',x,y,BG[0],base]);
  }
  const pixels=[];for(const o of room.props.filter(p=>p.grandArrival)){
   px=o.grandArrival.kind==='table'?12:17.8;py=o.grandArrival.kind==='table'?14.4:15.1;a=-Math.PI/2;pitch=-.15;render(0);const A=BG.slice(),draw=o.draw;o.draw=()=>{};let n=0;try{render(0);for(let i=0;i<A.length;i++)if(A[i]!==BG[i])n++;}finally{o.draw=draw;}pixels.push(n);
  }
  if(pixels.length!==2||pixels.some(n=>n<30))bad.push(['missing native geometry',pixels]);
  return{bad};});assert.deepEqual(r.bad,[]);
}));

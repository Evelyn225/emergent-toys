'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('hotel landscape frames have joined open bevelled rails, supported recessed layers, wall-contact pads and cached geometry in all room tiers',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{const bad=[],draw=drawBox;
  for(const tier of [0,1,2]){const def=[ROOM_DEFS.motelRoom,ROOM_DEFS.hotelroom,ROOM_DEFS.hotelSuite][tier];enterRoom('hotelroom',{suite:tier===2,lobby:{word:tier===0?'MOTEL':'HOTEL',ret:[100,100,0]}},def.entry);const o=room.props.find(p=>p.hotelWallArt);if(!o){bad.push('missing fitted landscape');continue;}
   const capture=(x=0,y=0)=>{const a=[];drawBox=(b,shade,ray=rayBox)=>a.push({b:{...b},ref:b,shade,ray});try{o.draw(x,y);}finally{drawBox=draw;}return a;},A=capture(),B=capture(),M=capture(.2,.3);capture();const role=q=>o.hotelWallArt.parts.find(p=>p.view===q.ref)?.role,one=r=>A.find(q=>role(q)===r),rails=A.filter(q=>role(q)==='rail'),pads=A.filter(q=>role(q)==='pad'),canvas=one('canvas'),mat=one('mat'),back=one('backing');
   if(rails.length!==4||pads.length!==4||!canvas||!mat||!back){bad.push('missing rendered rails/layers/pads');continue;}
   const cast=(q,u,z,dir)=>{const v=dir>0?-1:1,t=q.ray(u,v,z,0,dir,0,q.b);return t>.01?v+dir*t:NaN;},z=1.9;
   if(rails.some(q=>Number.isFinite(cast(q,0,z,-1))))bad.push('frame opening is filled');
   for(const u of [-.81,.81])for(const h of [-.41,.41])if(!rails.some(q=>Number.isFinite(cast(q,u,z+h,-1))))bad.push('open mitred corner');
   const railFront=cast(rails[0],0,z+.41,-1),printFront=cast(canvas,0,z,-1);if(!(railFront-printFront>.02))bad.push('print is painted on front of frame');
   if(Math.abs(cast(canvas,0,z,1)-cast(mat,0,z,-1))>1e-8||Math.abs(cast(mat,0,z,1)-cast(back,0,z,-1))>1e-8)bad.push('unsupported print/mat/backing');
   for(const q of pads){const u=q.b.x,h=(q.b.z0+q.b.z1)/2,front=cast(q,u,h,-1),rear=cast(q,u,h,1);if(Math.abs(rear+.03)>1e-8||!rails.some(r=>Math.abs(cast(r,u,h,1)-front)<1e-8))bad.push('pad does not meet wall and frame');}
   if(Math.abs(o.hotelWallArt.wallY-1)>1e-8||Math.abs(o.box.z0-1.45)>1e-8||Math.abs(o.box.z1-2.35)>1e-8)bad.push('native wall/height anchor changed');
   for(let k=0;k<A.length;k++){const q=A[k],b=q.b;if(q.ref!==B[k].ref||q.ref!==M[k].ref||q.shade!==B[k].shade||Math.abs(M[k].b.x-b.x-.2)>1e-8||Math.abs(M[k].b.y-b.y-.3)>1e-8)bad.push('prepared geometry/material rebuilt or moved wrong');if(Math.abs(b.x)+b.hl>.85+1e-8||b.y-b.hw<-.03-1e-8||b.y+b.hw>.031+1e-8)bad.push('geometry exceeds retained frame envelope');}
   const near=cast(canvas,0,z,-1);canvas.shade(0,near,0);const dark=BG[0];canvas.shade(0,near,12);if(CH[0]!==' '||BG[0]===dark)bad.push('print is glyph-painted or self-lit');
  }return bad;});assert.deepEqual(bad,[]);
}));
test('native hotel views show the fitted landscape from a clear bedroom and close wall approach',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{enterRoom('hotelroom',{lobby:{word:'HOTEL',ret:[100,100,0]}},ROOM_DEFS.hotelroom.entry);const o=room.props.find(p=>p.hotelWallArt);if(!o)return[{missing:true}];const out=[];
  for(const close of [false,true]){px=2.6;py=close?1.7:5.6;const tx=close?o.x-.8:o.x,tz=close?2.3:1.9;a=Math.atan2(o.y-py,tx-px);pitch=0;render(0);pitch=(tz-eye)/Math.hypot(tx-px,o.y-py)*projY/rows;render(0);const old=[BG.slice(),CH.slice(),COL.slice()],draw=o.draw;let changed=0;o.draw=()=>{};try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==old[0][i]||CH[i]!==old[1][i]||COL[i]!==old[2][i])changed++;}finally{o.draw=draw;}out.push({clear:free(px,py),changed});}return out;});for(const q of r)assert.ok(!q.missing&&q.clear&&q.changed>20,JSON.stringify(q));
}));

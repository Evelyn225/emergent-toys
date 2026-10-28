'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('hotel coffee tables have four closed grounded feet, connected legs, a rounded supported top and a seated suite stone inset with cached bounds',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{const bad=[];for(const tier of [1,2]){const def=tier===2?ROOM_DEFS.hotelSuite:ROOM_DEFS.hotelroom;enterRoom('hotelroom',{suite:tier===2,lobby:{word:'HOTEL',ret:[100,100,0]}},def.entry);const table=room.props.find(p=>p.hotelCoffee);if(!table){bad.push('missing fitted coffee table');continue;}
  const draw=drawBox,capture=(x=0,y=0)=>{const a=[];drawBox=(b,shade,ray=rayBox)=>a.push({b:{...b},ref:b,shade,ray});try{table.draw(x,y);}finally{drawBox=draw;}return a;},A=capture(),B=capture(),M=capture(.2,.3);capture();const meta=table.hotelCoffee;
  const role=q=>meta.parts.find(p=>p.box.profile===q.b.profile)?.role,one=r=>A.find(q=>role(q)===r),top=one('top'),stone=one('stone'),feet=A.filter(q=>role(q)==='foot'),legs=A.filter(q=>role(q)==='leg');
  if(!top||feet.length!==4||legs.length!==4){bad.push('missing rendered top or four feet/legs');continue;}
  const cast=(q,x,y,z,dir)=>{const t=q.ray(x,y,z,0,0,dir,q.b);return t>0?z+dir*t:NaN;};
  const points=new Set();for(const f of feet){const{x,y}=f.b,leg=legs.find(q=>q.b.x===x&&q.b.y===y);points.add([Math.sign(x),Math.sign(y)].join(','));
   if(Math.abs(cast(f,x,y,-1,1))>1e-8||Math.abs(cast(f,x,y,2,-1)-cast(leg,x,y,-1,1))>1e-8||Math.abs(cast(leg,x,y,2,-1)-cast(top,x,y,-1,1))>1e-8)bad.push('floating foot/leg/top support');
   for(const q of [f,leg]){const t=q.ray(x+1,y,(q.b.z0+q.b.z1)/2,-1,0,0,q.b);if(!(t>0&&t<1)||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-8)bad.push('open/invalid turned support');}
  }if(points.size!==4)bad.push('unstable leg layout');
  const height=(x,y)=>Math.max(...A.map(q=>{const t=q.ray(x,y,2,0,0,-1,q.b);return t>0?2-t:-Infinity;}));
  if(Math.abs(height(0,0)-.46)>1e-8||Math.abs(height(.49,0)-.46)>1e-8||!(height(.515,0)>.4&&height(.515,0)<.46)||height(.45,.45)!==-Infinity)bad.push('square, flat or unclosed round tabletop');
  if(tier===2){const side=top.ray(.24,0,.50,1,0,-.2,top.b);if(Math.abs(side-.21)>1e-8||Math.abs(HIT.nx+1)>1e-8)bad.push('oblique recess side is replaced by a cap');if(!stone||Math.abs(cast(stone,0,0,-1,1)-cast(top,0,0,2,-1))>1e-8||Math.abs(cast(top,0,0,2,-1)-.444)>1e-8)bad.push('painted/floating stone inset');}
  else if(stone)bad.push('regular hotel got suite inset');
  for(const q of A)for(let k=0;k<80;k++){
   const ox=q.b.x+(hash(k,11)-.5)*2,oy=q.b.y+(hash(k,13)-.5)*2,oz=(hash(k,17)-.2)*2,rx=(hash(k,19)-.5)*2,ry=(hash(k,23)-.5)*2,rz=(hash(k,29)-.5)*2;
   const fast=q.ray(ox,oy,oz,rx,ry,rz,q.b),saved={...HIT},reference=coveRayLathe(ox,oy,oz,rx,ry,rz,q.b);
   if(Math.abs(fast-reference)>1e-8||fast>0&&['u','v','w','nx','ny','nz','part','face'].some(key=>Math.abs(saved[key]-HIT[key])>1e-7))bad.push('cap acceleration changes exact curved hits/normals/material coordinates');
  }
  const sofa=room.def.hotelAmenities.sofa;if(table.x!==sofa[0]||table.y!==sofa[1]-1.25||table.box.hl!==.52||table.box.hw!==.52||table.box.z0!==0||table.box.z1!==.46)bad.push('native placement/collision footprint changed');
  for(let k=0;k<A.length;k++){const q=A[k],b=q.b;if(q.ref!==B[k].ref||q.ref!==M[k].ref||q.shade!==B[k].shade||Math.abs(M[k].b.x-b.x-.2)>1e-8||Math.abs(M[k].b.y-b.y-.3)>1e-8)bad.push('prepared geometry/material rebuilt or moved wrong');
   if(Math.abs(b.x)+b.hl>.52+1e-8||Math.abs(b.y)+b.hw>.52+1e-8||b.z0<0||b.z1>.46)bad.push('outside real table bounds');
  }
 }enterRoom('hotelroom',{lobby:{word:'MOTEL',ret:[100,100,0]}},ROOM_DEFS.motelRoom.entry);if(room.props.some(p=>p.hotelCoffee))bad.push('motel layout changed');return bad;});assert.deepEqual(bad,[]);
}));
test('both native hotel tiers render the whole coffee table, remain clear beside the sofa and retain routes to room amenities',()=>fixture(async p=>{
 const out=await p.evaluate(()=>[1,2].map(tier=>{const def=tier===2?ROOM_DEFS.hotelSuite:ROOM_DEFS.hotelroom;enterRoom('hotelroom',{suite:tier===2,lobby:{word:'HOTEL',ret:[100,100,0]}},def.entry);const p=room.props.find(p=>p.hotelCoffee);if(!p)return{tier,missing:true};px=p.x+1.15;py=p.y;a=Math.PI;pitch=0;render(0);pitch=(.35-eye)/1.15*projY/rows;render(0);const old=[BG.slice(),CH.slice(),COL.slice()],depth=ZB.slice(),accelerated=hotelCoffeeRay;let parity=true;hotelCoffeeRay=coveRayLathe;try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==old[0][i]||CH[i]!==old[1][i]||COL[i]!==old[2][i]||ZB[i]!==depth[i])parity=false;}finally{hotelCoffeeRay=accelerated;}const draw=p.draw;let changed=0;p.draw=()=>{};try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==old[0][i]||CH[i]!==old[1][i]||COL[i]!==old[2][i])changed++;}finally{p.draw=draw;}
  const route=roomPath(...def.entry.slice(0,2),px,py).length>0,amenities=room.def.hotelAmenities;return{tier,parity,clear:free(px,py),changed,route,tv:free(...amenities.tvApproach),stove:free(amenities.stove[0]-1,amenities.stove[1]),tvPath:roomPath(...def.entry.slice(0,2),...amenities.tvApproach).length>0};}));for(const r of out)assert.ok(!r.missing&&r.parity&&r.clear&&r.changed>40&&r.route&&r.tv&&r.stove&&r.tvPath,JSON.stringify(r));
}));

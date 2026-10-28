'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('hotel lamps have open shades with real wall thickness, supported bulbs, sockets and stems, seated bases and reusable geometry in each price tier',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{const bad=[],heights=[];
  for(const tier of [0,1,2]){const def=[ROOM_DEFS.motelRoom,ROOM_DEFS.hotelroom,ROOM_DEFS.hotelSuite][tier];enterRoom('hotelroom',{suite:tier===2,lobby:{word:tier===0?'MOTEL':'HOTEL',ret:[100,100,0]}},def.entry);render(0);const lamps=room.props.filter(o=>o.hotelLamp);if(lamps.length!==2){bad.push('missing two fitted hotel lamps');continue;}
   for(const o of lamps){const draw=drawBox,capture=(x=0,y=0)=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({b:{...box},ref:box,shade,ray});try{o.draw(x,y);}finally{drawBox=draw;}return a;},A=capture(),B=capture(),M=capture(.2,.3);capture();
    const meta=o.hotelLamp,one=role=>A.find(q=>meta.parts.find(p=>p.role===role)?.view===q.ref),shade=one('shade'),bulb=one('bulb'),base=one('base'),socket=one('socket'),stem=one('stem'),stand=room.props.find(p=>p.box&&p.box.z1===.65&&Math.hypot(p.x-o.x,p.y-o.y)<1e-8);
    if(!shade||!bulb||!base||!socket||!stem){bad.push('missing actual rendered lamp parts');continue;}
    if(!stand||o.box.z0!==stand.box.z1)bad.push('lamp base not on real cabinet top');
    if(stand){const drawn=[];drawBox=(box,shade,ray=rayBox)=>drawn.push({box,ray});try{stand.draw(stand.x,stand.y);}finally{drawBox=draw;}const top=Math.max(...drawn.map(q=>{const t=q.ray(o.x,o.y,2,0,0,-1,q.box);return t>0?2-t:-Infinity;}));if(Math.abs(o.box.z0-top)>1e-8)bad.push('base does not meet rendered cabinet top');}
    const axis=(q,from,dir)=>{const t=q.ray(0,0,from,0,0,dir,q.b);return t>0?from+dir*t:NaN;};
    if(shade.ray(0,0,0,0,0,1,shade.b)>0)bad.push('opaque shade axis');
    const z=(shade.b.z0+shade.b.z1)/2,outer=shade.ray(.5,0,z,-1,0,0,shade.b),outerR=.5-outer,inner=shade.ray(0,0,z,1,0,0,shade.b);
    if(Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-8)bad.push('invalid inner-shade normal');
    if(!(outer>0&&inner>0&&outerR-inner>.003&&outerR-inner<.02))bad.push('no real shade shell thickness');
    shade.shade(0,inner,0);const lining=BG[0]&15;shade.ray(.5,0,z,-1,0,0,shade.b);shade.shade(0,outer,0);const casing=BG[0]&15;if(lining<=casing||casing>5)bad.push('whole shade glows or lining unlit');
    const light=bulb.ray(0,0,0,0,0,1,bulb.b);bulb.shade(0,light,0);if(light<0||(BG[0]&15)<11)bad.push('missing luminous bulb');
    if(Math.abs(axis(base,0,1)-.65)>1e-8||Math.abs(axis(socket,0,1)-axis(stem,2,-1))>1e-8||Math.abs(axis(bulb,0,1)-axis(socket,2,-1))>1e-8)bad.push('floating base/stem/socket/bulb');
    const ceramic=one('ceramic');if(tier===2){if(!ceramic||Math.abs(axis(ceramic,0,1)-axis(base,2,-1))>1e-8||Math.abs(axis(stem,0,1)-axis(ceramic,2,-1))>1e-8)bad.push('suite ceramic body detached');}else if(Math.abs(axis(stem,0,1)-axis(base,2,-1))>1e-8)bad.push('stem detached from base');
    if(bulb.b.z0<=shade.b.z0||bulb.b.z1>=shade.b.z1)bad.push('bulb outside shade');
    if(meta.spokes.length!==3)bad.push('unsupported shade');
    for(const q of meta.spokes){const actual=A.find(p=>p.ref===q.view);if(!actual){bad.push('strut not rendered');continue;}const bb=actual.b,t=actual.ray((bb.ax+bb.bx)/2+1,(bb.ay+bb.by)/2,(bb.az+bb.bz)/2,-1,0,0,bb);if(!(t>0&&t<1)||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-8)bad.push('strut has no closed round surface');const b=q.box,r=Math.hypot(b.bx,b.by),hit=shade.ray(0,0,b.bz,1,0,0,shade.b);if(Math.abs(hit-r)>b.r||Math.hypot(b.ax,b.ay)-b.r>.026*(tier===2?1.25:1))bad.push('strut detached from shade/socket');}
    for(let k=0;k<A.length;k++){const a=A[k],b=a.b;if(a.ref!==B[k].ref||a.ref!==M[k].ref||a.shade!==B[k].shade||Math.abs(M[k].b.x-b.x-.2)>1e-8)bad.push('geometry/material rebuilt or moved wrong');
     const ex=Math.abs(b.x)+b.hl,ey=Math.abs(b.y)+b.hw;if(ex>o.box.hl+1e-8||ey>o.box.hw+1e-8||b.z0<o.box.z0-1e-8||b.z1>o.box.z1+1e-8)bad.push('lamp outside its real bounds');
    }
    if(o.box.hl>stand.box.hl||o.box.hw>stand.box.hw)bad.push('lamp overhangs cabinet footprint');heights.push(o.box.z1-o.box.z0);
   }
  }if(heights.length!==6||heights.at(-1)<=heights[0])bad.push('suite fitting lacks larger proportion');return bad;});assert.deepEqual(bad,[]);
}));
test('native hotel rooms render both lamps and keep bedside routes and closed automatic washroom doors working',()=>fixture(async p=>{
 for(const tier of [0,1,2]){
  const state=await p.evaluate(tier=>{const def=[ROOM_DEFS.motelRoom,ROOM_DEFS.hotelroom,ROOM_DEFS.hotelSuite][tier];enterRoom('hotelroom',{suite:tier===2,lobby:{word:tier===0?'MOTEL':'HOTEL',ret:[100,100,0]}},def.entry);const lamps=room.props.filter(p=>p.hotelLamp);px=tier===2?3.9:2.6;py=5.6;a=-Math.PI/2;pitch=-.17;render(0);render(0);
   const old=[BG.slice(),CH.slice(),COL.slice()],pixels=[];for(const lamp of lamps){const draw=lamp.draw;lamp.draw=()=>{};let changed=0;try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==old[0][i]||CH[i]!==old[1][i]||COL[i]!==old[2][i])changed++;}finally{lamp.draw=draw;}pixels.push(changed);}
   const bed=room.props.find(p=>p.furniture==='bed'),side=bed.box.x+bed.box.hl+.35,walk=roomPath(...room.def.entry.slice(0,2),side,bed.box.y).length>0,door=room.bathroomDoors[0],d=door.bathroomDoor;
   const closed=d.pub&&d.open===0,c=d.vertical?0:1,s=d.vertical?1:0;px=door.x-s*1.05;py=door.y+c*1.05;a=Math.atan2(door.y-py,door.x-px);pitch=0;render(0);return{pixels,walk,closed,clear:free(px,py),prompt:promptText()};},tier);
  assert.ok(state.pixels.length===2&&state.pixels.every(n=>n>8)&&state.walk&&state.closed&&state.clear,JSON.stringify(state));assert.match(state.prompt,/open bathroom door/);await p.keyboard.press('e');
  assert.equal(await p.evaluate(()=>{stepBathroomDoors(2);return room.bathroomDoors[0].bathroomDoor.open;}),1);
  assert.equal(await p.evaluate(()=>{[px,py]=room.def.entry;for(let k=0;k<5;k++)stepBathroomDoors(1);return room.bathroomDoors[0].bathroomDoor.open;}),0);
 }
}));

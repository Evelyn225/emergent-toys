'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('laundry',{word:'LAUNDRY',neon:CYAN,ret:[100,100,0],cell:[10,10]},[5,5.4,-Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('every washer stands in its own bay on the back wall, you can walk up to each one, and E reaches the machine you are facing',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],washers=room.props.filter(o=>o.laundryWasher);
  if(washers.length!==LAUNDRY_WASHER.last-LAUNDRY_WASHER.first+1)bad.push('washers '+washers.length);
  for(const o of washers){
   const {n}=o.laundryWasher;
   if(Math.floor(o.x/LAUNDRY_BAY)!==n)bad.push('machine out of its bay '+n);
   if(o.x-o.box.hl<=n*LAUNDRY_BAY-1e-9||o.x+o.box.hl>=(n+1)*LAUNDRY_BAY+1e-9)bad.push('machine wider than its bay '+n);
   if(Math.abs(o.y-o.box.hw-1)>1e-9)bad.push('machine off the wall '+n);
   if(o.x+o.box.hl>room.W-1)bad.push('machine in the side wall '+n);
   const parts=o.laundryWasher.parts,top=Math.max(...parts.map(q=>q.box.z1));if(top>o.box.z1+1e-9)bad.push('parts above the box');
   for(const q of parts.filter(q=>q.role!=='port'&&q.role!=='lamp'&&q.role!=='coin'))if(Math.abs(q.box.y)+q.box.hw>o.box.hw+1e-9)bad.push('part outside the box '+q.role);
   // stand clear of the machine, within reach, and get its own prompt
   let reach=false;for(let y=1.89;y>o.y+o.box.hw;y-=.02){if(free(o.x,y)){reach=true;px=o.x;py=y;break;}}
   if(!reach)bad.push('cannot reach '+n);else if(machineHere()!==n)bad.push('E reaches the wrong machine at '+n);
  }
  // nothing but the machines answers: not the empty stretch of wall, not back in the room
  px=1.2;py=1.7;if(machineHere()!==-1)bad.push('prompt with no machine there');
  px=5;py=3;if(machineHere()!==-1)bad.push('prompt from across the room');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('your own machine shows your load, its lamp and then clean clothes; the others carry on',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(q=>q.laundryWasher?.n===5),other=room.props.find(q=>q.laundryWasher?.n===6);
  const port=o.laundryWasher.parts.find(q=>q.role==='port'),lamp=o.laundryWasher.parts.find(q=>q.role==='lamp'),otherPort=other.laundryWasher.parts.find(q=>q.role==='port');
  const drum=(p,u=0,w=.05,t=1)=>{HIT.face=3;HIT.u=u;HIT.v=0;HIT.w=w;HIT.nx=0;HIT.ny=1;HIT.nz=0;p.shade(0,t,8);if(CH[0]!==' ')bad.push('drum glyph');return BG[0];};
  const light=()=>{lamp.shade(0,1,8);return BG[0];};
  wash=null;const idleLamp=light();
  wash={cell:room.cell.slice(),n:5,done:T+45,told:false};
  if(!myLaundromat())bad.push('fixture: not my laundromat');
  if(light()===idleLamp)bad.push('lamp ignores the load');
  const frames=new Set();const t0=T;for(let k=0;k<30;k++){T=t0+k*.03;frames.add(drum(port,.07,.05));}T=t0;if(frames.size<2)bad.push('your load does not tumble');
  const far=new Set();for(let k=0;k<30;k++){T=t0+k*.03;far.add(drum(port,.03,.02,30));}T=t0;if(far.size!==1)bad.push('drum shimmers far off');
  const running=drum(port,.07,.05);
  T=wash.done+1;const done=light();if(done===idleLamp&&light()===idleLamp)bad.push('no done lamp');
  const clean=drum(port,.07,.05);if(clean>>4!==WHITE)bad.push('clean load not white');
  if(drum(otherPort,.07,.05)>>4!==BLUE)bad.push('an idle machine shows your clothes');
  wash=null;T=t0;
  // the porthole hits on its face, and on its rim from the side
  const b=port.view;port.view.x=o.x;port.view.y=o.y+port.box.y;
  const t=laundryPortRay(o.x+.05,o.y+port.box.y+1,b.cz+.02,0,-1,0,b);if(Math.abs(t-(1-b.front))>1e-9||HIT.face!==3)bad.push('face '+t);
  const rim=laundryPortRay(o.x-1,o.y+port.box.y+.02,b.cz,1,0,0,b);if(Math.abs(rim-(1-b.r))>1e-9||HIT.face===3)bad.push('rim '+rim);
  if(laundryPortRay(o.x+b.r+.01,o.y+port.box.y+1,b.cz,0,-1,0,b)>0)bad.push('hit outside the circle');
  if(laundryPortRay(o.x-1,o.y+port.box.y+.08,b.cz,1,0,0,b)>0)bad.push('hit in front of the boss');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('dryers, the cart and the shell: joined, filtered, glyph-free, out of the way, with the same footsteps',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],stacks=room.props.filter(o=>o.laundryDryer);if(stacks.length!==8)bad.push('dryers '+stacks.length);
  for(const o of stacks){const f=o.laundryDryer.fx;if(Math.abs(o.x-f*o.box.hl-(f>0?1:room.W-1))>1e-9)bad.push('dryer off its wall');}
  const cart=room.props.find(o=>o.laundryCart),{parts,floor,rim}=cart.laundryCart;
  for(const q of parts.filter(q=>q.role==='washing'))if(q.box.z0!==floor)bad.push('washing off the tray');
  for(const q of parts.filter(q=>q.role==='wire'))if(Math.abs(q.box.ax)>cart.box.hl+1e-9||Math.abs(q.box.ay)>cart.box.hw+1e-9)bad.push('wire outside the box');
  if(parts.filter(q=>q.role==='castor').length!==4)bad.push('castors');
  const tray=parts.find(q=>q.role==='tray');if(tray.box.z1!==floor)bad.push('tray height');
  if(Math.max(...parts.map(q=>q.box.z1))>cart.box.z1+1e-9)bad.push('cart above its box');
  const table=room.props.find(o=>Math.abs(o.x-5.7)<1e-9&&Math.abs(o.y-3.3)<1e-9&&o.box);if(!table||Math.abs(table.box.z1-.85)>.06)bad.push('folding table');
  if(room.def.floor!=='laundryVinyl'||surfaceAt('room',room,5,3)!=='tile')bad.push('footsteps changed');
  const floor_=(x,y,fp=.001,L=6)=>{laundryFloorFinish(0,x,y,L,fp);if(CH[0]!==' ')bad.push('floor glyph');return BG[0];};
  if(floor_(.2,.2)===floor_(.6,.2))bad.push('no check');if(floor_(.4,.2)===floor_(.5,.2))bad.push('no joint');
  const far=new Set();for(let y=1;y<6;y+=.13)for(let x=1;x<9;x+=.17)far.add(floor_(x,y,2));if(far.size!==1)bad.push('floor aliases far off');
  ROOM_CEILS.civicPlaster(0);if(CH[0]!==' ')bad.push('ceiling glyph');
  const wall=(u,z)=>{laundryWallFinish(0,u,.001,z,2,5,0,8);if(CH[0]!==' ')bad.push('wall glyph');return BG[0];};
  if(wall(.1,1)===wall(.15,2))bad.push('no tile to plaster change');if(wall(.3,1)===wall(.15,1))bad.push('no grout');
  if(room.def.sign||!room.props.some(o=>o.laundryWallBoard))bad.push('board');
  if(!room.props.some(o=>o.laundryEntrance))bad.push('entrance');if(room.props.filter(o=>o.laundryCeilingLight).length!==4)bad.push('lights');
  if(!room.props.some(o=>o.laundrySkirting))bad.push('base');
  // door to the machines is walkable
  for(let y=5.4;y>1.9;y-=.2)if(!free(4.6,y))bad.push('blocked route at y '+y.toFixed(1));
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));

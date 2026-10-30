'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('museum',{...MUSEUM.sh,ret:[100,100,0]},[12.5,16.2,-Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('every canvas is whole on one gallery wall, framed where the painter puts it, with no seam across its wall cells',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],frames=room.props.filter(o=>o.museumFrame),{w,z0,z1,inset,pitch:bay}=MUSEUM_CANVAS;
  if(frames.length<8)bad.push('frames '+frames.length);
  for(const o of frames){
   const {face:q,parts}=o.museumFrame,lo=q.k*bay+inset,hi=lo+w;
   for(let c=lo;c<=hi;c+=.2){const x=q.fx?q.line+q.fx*.5:c,y=q.fx?c:q.line+q.fy*.5;if(roomAt(x,y)!=='.'||museumWing(x,y)!=='gallery')bad.push(['canvas off the floor edge',x,y]);
    const wx=q.fx?q.line-q.fx*.5:c,wy=q.fx?c:q.line-q.fy*.5;if(roomAt(wx,wy)!=='#')bad.push(['canvas over an opening',wx,wy]);}
   for(const k of parts){const off=q.fx?k.box.x:k.box.y,half=q.fx?k.box.hl:k.box.hw,dir=q.fx?q.fx:q.fy;if(Math.abs(off*dir-half)>1e-9)bad.push('frame not on the wall');}
   const bars=parts.filter(k=>k.role==='frame');if(bars.length!==4)bad.push('bars');
   const reach=Math.max(...bars.map(k=>k.box.z1)),low=Math.min(...bars.map(k=>k.box.z0));if(Math.abs(reach-z1-.04)>1e-9||Math.abs(low-z0+.04)>1e-9)bad.push('frame not round the canvas');
   if(o.box)bad.push('frame collides');
  }
  // the same painting at the same height from two wall cells it spans
  museumCanvas(0,4,1.5,1,25,1);const one=BG[0];if(CH[0]!==' ')bad.push('canvas glyph');museumCanvas(0,4,1.5,1,25,1);if(BG[0]!==one)bad.push('canvas unstable');
  museumCanvas(0,7,1.5,2,25,1);if(BG[0]===one)bad.push('every canvas the same');
  if(CH[0]!==' ')bad.push('canvas glyph');
  // real view: square on to a frame, its centre shows the wall painter's canvas, inside the frame's reach
  const o=frames.find(f=>f.museumFrame.face.fx===-1),q=o.museumFrame.face;px=q.line-2;py=q.mid;a=0;pitch=0;render(0);
  const row=Math.floor(hor-(1.75-eye)*projY/2),i=row*cols+Math.floor(cols/2),hue=BG[i]>>4;
  if(hue===WHITE||Math.abs(ZB[i]-2)>.05)bad.push(['no canvas where the frame is',hue,ZB[i]]);
  // ...and right across it: a wall cell's edge must not drop a column of marble through the picture.
  // (This wall's palette has no white, so any white between the side bars is the wall showing.)
  px=q.line-2.4;py=q.mid;render(0);const scan=Math.floor(hor-(1.5-eye)*projY/2.4)*cols;let marble=0;
  for(let c=0;c<cols;c++){const dy_=(2*(c+.5)/cols-1)*tf*2.4;if(Math.abs(dy_)<w/2-.1&&BG[scan+c]>>4===WHITE)marble++;}
  if(q.k!==1||q.line!==25)bad.push('fixture: expected the east wall bay');if(marble)bad.push('marble columns through the canvas '+marble);
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('each wing has its own glyph-free filtered finish and keeps it from both sides of a wall',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],floor=(x,y,row)=>{const k=rows-2;eye=1.7;hor=k+.5-eye*projY/(row||2);ROOM_FLOORS.museum(0,.8,x,y,k,cols/2,6);if(CH[0]!==' ')bad.push('floor glyph');return BG[0];};
  if(floor(12.2,13.2)>>4===floor(13.2,13.2)>>4)bad.push('hall chequer gone');
  const far=new Set();for(let y=10.1;y<16;y+=.37)for(let x=8.1;x<17;x+=.41)far.add(floor(x,y,30));if(far.size!==1)bad.push('chequer aliases far off');
  if(floor(10,4)>>4!==RED)bad.push('gem carpet');if(floor(3,4)>>4!==WARM)bad.push('egypt paving');
  floor(22,4);if(CH[0]!==' ')bad.push('parquet glyph');
  const wall=(fn,...a)=>{fn(0,...a);if(CH[0]!==' ')bad.push('wall glyph');return BG[0];};
  const sample=(u,z,d)=>wall(museumEgyptWall,u,z,d,6,1);
  const near=new Set();for(let u=.1;u<4;u+=.03)near.add(sample(u,1.4,1));if(near.size<2)bad.push('no carving up close');
  const distant=new Set();for(let u=.1;u<4;u+=.03)distant.add(sample(u,1.4,12));if(distant.size!==1)bad.push('carving shimmers far off');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('after dark the shell stays dark: no lit fittings or pale trim, dim surfaces, beams on the floor, and the heist paths still work',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],day={lights:room.props.filter(o=>o.museumCeilingLight).length,base:room.props.filter(o=>o.museumSkirting).length,top:room.props.filter(o=>o.museumCornice).length};
  if(day.lights!==MUSEUM_BATTENS.length||!day.base||!day.top)bad.push(['day fittings',day]);
  for(const o of room.props.filter(o=>o.museumCeilingLight))if(Math.abs(o.box.z1-4)>1e-9)bad.push('light off the ceiling');
  if(!room.props.some(o=>o.museumEntrance))bad.push('entrance');
  ROOM_CEILS.museumPlaster(0);const dayCeil=BG[0]&15;
  enterRoom('museum',{...MUSEUM.sh,ret:[100,100,0],line:'',burgled:true,light:.28,loot:0},[12.5,10.5,-Math.PI/2]);render(0);
  if(room.props.some(o=>o.museumCeilingLight||o.museumSkirting||o.museumCornice))bad.push('lit fittings after dark');
  ROOM_CEILS.museumPlaster(0);if((BG[0]&15)>=dayCeil)bad.push('ceiling not dimmed');
  for(const q of room.props)if(q.guard){q.tick=null;q.x=3.5;q.y=15;q.dir=Math.PI;}
  const dark=()=>{ROOM_FLOORS.museum(0,.8,12.5,6,rows-2,cols/2,6);if(CH[0]!==' ')bad.push('night floor glyph');return BG[0];};
  if(dark()>>4===YEL)bad.push('beam with no torch');
  const g=room.props.find(q=>q.guard);Object.assign(g,{x:12.5,y:9,dir:-Math.PI/2});
  if(!(torchAt(12.5,7.5,0)>0)||dark()!==dark())bad.push('fixture');
  ROOM_FLOORS.museum(0,.8,12.5,7.5,rows-2,cols/2,6);if(BG[0]>>4!==YEL)bad.push('no beam on the floor');
  // the frames dim too, and the hide-behind check still has its solid things
  const f=room.props.find(o=>o.museumFrame);if(!f)bad.push('frames gone at night');else{const k=f.museumFrame.parts[0];HIT.nx=0;HIT.ny=0;HIT.nz=1;k.shade(0,2,8);if((BG[0]&15)>5)bad.push('frame glows at night');}
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));

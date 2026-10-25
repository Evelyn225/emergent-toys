'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=26;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('television bezel joins enclose a real screen recess; pads, legs and case connect within bounds at every orientation',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  const out=[],draw=drawBox;
  for(const scale of [1,1.1])for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2,.63]){
   const model=TELEVISION(4,5,{tv:false},scale,angle),shapes=[],bad=[],c=Math.cos(angle),s=Math.sin(angle),S=scale;
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(4,5);}finally{drawBox=draw;}
   const at=(u,v)=>[4+(c*u-s*v)*S,5+(s*u+c*v)*S],role=k=>shapes.filter(q=>q.box.tvRole===k),same=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-7;
   const cast=(q,u,v,z,du,dv,dz)=>q.ray(...at(u,v),z*S,(c*du-s*dv)*S,(s*du+c*dv)*S,dz*S,q.box);
   const frame=role('bezel'),screen=role('screen')[0],back=role('back')[0];
   for(const q of frame)if(cast(q,0,.5,1.1,0,-1,0)>0)bad.push('bezel seals aperture');
   if(!same(cast(screen,0,.5,1.1,0,-1,0),.436)||!same(cast(back,0,-.5,1.1,0,1,0),.43))bad.push('screen/back depth');
   // A ray beside the screen sees the frame; a ray just within it sees a
   // real jamb from the recess, rather than a front-face alpha cutout.
   for(const side of [-1,1]){
    if(!frame.some(q=>same(cast(q,side*.68,.5,1.1,0,-1,0),.43)))bad.push('missing front frame');
    if(!frame.some(q=>same(cast(q,0,.04,1.1,side,0,0),.65)))bad.push('missing inner jamb');
   }
   // Probe both sides of all four joins and their shared line, from front
   // and back. All hit the same surface without cracks or raised edges.
   for(const u of [-.71,.71])for(const z of [.79,1.47])for(const dz of [-1e-5,0,1e-5]){
    const front=frame.map(q=>cast(q,u,.5,z+dz,0,-1,0)).filter(t=>t>0),rear=frame.map(q=>cast(q,u,-.5,z+dz,0,1,0)).filter(t=>t>0);
    if(!front.some(t=>same(t,.43))||!rear.some(t=>same(t,.43)))bad.push('frame seam');
   }
   const pads=role('foot-pad'),legs=role('leg');
   for(const leg of legs){const b=leg.box;
    const lo=b.az-b.r,hi=b.bz+b.r;
    if(!pads.some(p=>b.ax>=p.box.x-Math.abs(c)*p.box.hl-Math.abs(s)*p.box.hw-.01&&b.ax<=p.box.x+Math.abs(c)*p.box.hl+Math.abs(s)*p.box.hw+.01&&lo>=p.box.z0&&lo<=p.box.z1))bad.push('leg/pad');
    if(!(hi>.7*S&&hi<.79*S))bad.push('leg/case');
   }
   for(const pad of pads)if(!same(pad.box.z0,.61*S))bad.push('uneven pad');
   for(const q of shapes){const b=q.box,m=model.box;
    let u,v;
    if(q.ray===coveRayCapsule){u=Math.max(Math.abs((b.ax-4)*c+(b.ay-5)*s),Math.abs((b.bx-4)*c+(b.by-5)*s))+b.r;v=Math.max(Math.abs(-(b.ax-4)*s+(b.ay-5)*c),Math.abs(-(b.bx-4)*s+(b.by-5)*c))+b.r;}
    else{const cu=b.c*c+b.s*s,ss=-b.c*s+b.s*c;u=Math.abs((b.x-4)*c+(b.y-5)*s)+Math.abs(cu)*b.hl+Math.abs(ss)*b.hw;v=Math.abs(-(b.x-4)*s+(b.y-5)*c)+Math.abs(ss)*b.hl+Math.abs(cu)*b.hw;}
    if(u>m.hl+1e-7||v>m.hw+1e-7||b.z0<m.z0-1e-7||b.z1>m.z1+1e-7)bad.push(['bounds',b.tvRole]);
   }
   out.push({bad,frame:frame.length,pads:pads.length,legs:legs.length});
  }return out;
 });for(const q of result){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.frame,4);assert.equal(q.pads,4);assert.equal(q.legs,4);}
}));

test('home and hotel TVs stand on their cabinets, keep screen/case materials separate and follow their own room power state',()=>fixture(async p=>{
 const result=await p.evaluate(()=>{
  const out=[],draw=drawBox;
  for(const kind of ['home','loft','bellehome','islandhome','motelRoom','hotelroom','hotelSuite']){
   const r=makeRoom(kind),model=r.props.find(q=>q.television),shapes=[],bad=[];
   if(!model){out.push({kind,bad:['missing TV']});continue;}
   room=r;mode='room';env(0);render(0);
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;}
   const pads=shapes.filter(q=>q.box.tvRole==='foot-pad'),cabinet=r.props.find(q=>q!==model&&q.box&&Math.abs(q.box.z1-model.box.z0)<1e-7&&inBox(q.box,model.x,model.y,0));
   if(!cabinet)bad.push('missing cabinet');
   else {
    const support=[];drawBox=(box,shade,ray=rayBox)=>support.push({box,ray});try{cabinet.draw(cabinet.x,cabinet.y);}finally{drawBox=draw;}
    for(const pad of pads){const b=pad.box;for(const du of [-b.hl*.7,0,b.hl*.7])for(const dv of [-b.hw*.7,0,b.hw*.7]){const x=b.x+b.c*du-b.s*dv,y=b.y+b.s*du+b.c*dv;const top=Math.max(-Infinity,...support.map(q=>{const t=q.ray(x,y,b.z0+.1,0,0,-1,q.box);return t>0?b.z0+.1-t:-Infinity;}));if(!inBox(cabinet.box,x,y,0)||Math.abs(b.z0-top)>1e-6)bad.push('unsupported pad');}}}
   const frame=shapes.find(q=>q.box.tvRole==='bezel'),screen=shapes.find(q=>q.box.tvRole==='screen');
   const sample=(q)=>{const b=q.box,t=q.ray(b.x-b.s,b.y+b.c,(b.z0+b.z1)/2,b.s,-b.c,0,b);q.shade(0,t,0);return [BG[0],CH[0]];};
   r.tv=false;const dark=sample(frame),off=sample(screen);r.tv=true;const lit=sample(frame),on=sample(screen);
   if(dark[0]!==lit[0]||dark[1]!==lit[1]||(lit[0]&15)>2)bad.push('case glows');
   if(off[0]===on[0])bad.push('screen ignores room power');
   out.push({kind,bad,pads:pads.length});
  }return out;
 });for(const q of result){assert.deepEqual(q.bad,[],q.kind);assert.equal(q.pads,4,q.kind);}
}));


test('home and hotel television controls toggle with E and hotel frames reuse their constructed model',()=>fixture(async p=>{
 const homePrompt=await p.evaluate(()=>{
  money=30000;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();
  [px,py]=room.def.spots.tv;room.tv=false;a=-Math.PI/2;pitch=-.2;freecam=null;env(0);render(0);return promptText();
 });assert.match(homePrompt,/telly on/);
 await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>room.tv),true);
 await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>room.tv),false);
 const hotelPrompt=await p.evaluate(()=>{
  enterRoom('hotelroom',{suite:true,lobby:{word:'GRAND HOTEL'},ret:[100,100,0]},ROOM_DEFS.hotelSuite.entry);
  [px,py]=room.def.hotelAmenities.tvApproach;room.tv=false;a=-Math.PI/2;pitch=-.2;env(0);render(0);return promptText();
 });assert.match(hotelPrompt,/watch TV/);
 await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>room.tv),true);
 const rebuilt=await p.evaluate(()=>{const build=TELEVISION;let count=0;TELEVISION=(...args)=>{count++;return build(...args);};try{render(0);render(0);return count;}finally{TELEVISION=build;}});
 assert.equal(rebuilt,0,'TV construction must not run in a render frame');
 await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>room.tv),false);
}));

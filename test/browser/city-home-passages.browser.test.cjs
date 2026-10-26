'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=false;mode='walk';room=me=null;body.z=body.vz=0;T=10;env(0);render(0);});
 await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('native home passage surrounds match the cut walls, have closed supported joins and reuse rendered collision bounds',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);};let checked=0;const draw=drawBox;
  const capture=(o,x=o.x,y=o.y)=>{let out;drawBox=(box,shade,ray=rayBox)=>out={box:{...box},ref:box,shade,ray};try{o.draw(x,y);}finally{drawBox=draw;}return out;};
  for(const kind of ['loft','bellehome']){
   enterRoom(kind,{ret:[50,73,0]},ROOM_DEFS[kind].entry);const openings=room.def.homePassages;
   if(!openings?.length){bad.push(kind+' has no fitted passages');continue;}
   for(const [index,p]of openings.entries()){
    checked++;const props=room.props.filter(o=>o.homePassage?.index===index),parts=props.map(o=>({o,q:capture(o)}));
    if(!parts.length||parts.some(({q})=>!q)){bad.push('no rendered surround');continue;}
    check(room.grid[p.cross][p.start-1]==='#'&&room.grid[p.cross][p.end]==='#'&&Array.from({length:p.end-p.start},(_,i)=>room.grid[p.cross][p.start+i]).every(c=>c==='.'),'surround does not match actual wall cut');
    const heads=parts.filter(({o})=>o.homePassage.role==='casing-head'),jambs=parts.filter(({o})=>o.homePassage.role==='casing-jamb'),reveals=parts.filter(({o})=>o.homePassage.role==='reveal'),infill=parts.find(({o})=>o.homePassage.role==='infill');
    check(heads.length===2&&jambs.length===4&&reveals.length===2&&infill,'missing opposite face or supported infill');if(!infill)continue;
    for(const {o,q}of parts){
     const b=q.box,B=o.box,again=capture(o),moved=capture(o,o.x+.2,o.y+.3);capture(o);
     check(['x','y','c','s','hl','hw','z0','z1'].every(k=>b[k]===B[k]),'collision does not follow rendered part');
     check(q.ref===again.ref&&q.ray===again.ray&&q.shade===again.shade&&q.ref===moved.ref,'passage bounds/materials rebuilt per frame');
     const t=q.ray(b.x,b.y+b.hw+.2,(b.z0+b.z1)/2,0,-1,0,b);check(t>0&&Math.abs(t-.2)<1e-8,'open or displaced front face');
     const cap=q.ray(b.x,b.y,b.z1+.2,0,0,-1,b);check(cap>0&&Math.abs(HIT.w-b.z1)<1e-8,'missing closed cap');
     check(b.z0>=0&&b.z1<=room.def.height,'surround detached from floor or through ceiling');
    }
    for(const {q}of reveals){const b=q.box;check(Math.abs(b.y-b.hw-p.cross)<1e-9&&Math.abs(b.y+b.hw-p.cross-1)<1e-9,'reveal does not line the wall depth');
     check(Math.min(Math.abs(b.x-b.hl-p.start),Math.abs(b.x+b.hl-p.end))<1e-9&&b.z0===0&&b.z1===infill.q.box.z0,'reveal floats off side or infill');}
    for(const {q}of heads.concat(jambs)){const b=q.box,back=b.y<p.cross+.5?b.y+b.hw:b.y-b.hw;
     check(Math.min(Math.abs(back-p.cross),Math.abs(back-p.cross-1))<1e-9,'casing floats from its wall face');}
    for(const side of [-1,1])for(const x of [p.start-.02,p.end+.02])for(const z of [2.3999,2.4,2.4001]){
     const y=side<0?p.cross-1:p.cross+2;check(parts.some(({q})=>q.ray(x,y,z,0,-side,0,q.box)>0),'open casing corner');}
    for(const x of [p.start+.25,(p.start+p.end)/2,p.end-.25]){const b=infill.q.box,t=infill.q.ray(x,p.cross+.5,1.7,0,0,1,b);check(t>0&&Math.abs(HIT.w-2.4)<1e-8&&HIT.face===6,'infill has no closed underside');}
    for(const face of [1,2]){HIT.face=face;check(infill.q.shade(0,2,8)===false,'buried infill end cap paints a seam over the native wall');}
    const original=room.def.light;
    try{for(const scale of [1,.5])for(const z of [3,room.def.height-.08]){room.def.light=original*scale;HIT.face=3;HIT.u=0;HIT.v=infill.q.box.hw;HIT.w=z;infill.q.shade(0,2,8);const col=BG[0],ch=CH[0],ink=COL[0];roomWall(0,p.start-.5,.01,z,room.def.height,2,1,p.start-1,p.cross,1-2/vis,p.start-.5);check(BG[0]===col&&CH[0]===ch&&COL[0]===ink,'infill paint/bands do not continue native wall lighting');}}finally{room.def.light=original;}
   }
  }return {bad:bad.slice(0,14),checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,4);
}));

test('both native passage routes remain open in both directions and only the rendered jamb strips collide',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[];let checked=0;
  for(const kind of ['loft','bellehome']){
   enterRoom(kind,{ret:[50,73,0]},ROOM_DEFS[kind].entry);if(!room.def.homePassages?.length){bad.push('no passage routes');continue;}
   for(const p of room.def.homePassages){
    const x=(p.start+p.end)/2,y=p.cross+.5;checked++;if(!free(x,y)||!free(p.start+.30,y)||!free(p.end-.30,y))bad.push('a whole-opening collider blocks the route');
    if(free(p.start+.03,y)||free(p.end-.03,y))bad.push('rendered jamb has no collision');
    px=x;py=p.cross-.6;for(let k=0;k<22;k++)move(0,.1);if(mode!=='room'||Math.abs(px-x)>1e-8||py<p.cross+1.5)bad.push([kind,p.start,'cannot walk forwards through passage',px,py]);
    for(let k=0;k<22;k++)move(0,-.1);if(Math.abs(py-(p.cross-.6))>1e-8)bad.push([kind,p.start,'cannot walk back through passage',px,py]);
    if(!roomWalkLine(x,p.cross-.5,x,p.cross+1.5))bad.push([kind,p.start,'native bedroom/study approach blocked']);
   }
   if(!room.bathroomDoors.every(p=>!p.bathroomDoor.pub&&p.bathroomDoor.open===1))bad.push('home bathroom defaults changed');
  }
  for(const kind of ['home','islandhome','islandshelter','cafe','hotelroom']){enterRoom(kind,{ret:[50,73,0],lobby:{word:'HOTEL',ret:[50,73,0]}},ROOM_DEFS[kind].entry||[4,4,0]);if(room.props.some(p=>p.homePassage))bad.push('unrelated room got passage surrounds');}
  return {bad,checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,4);
}));

test('native loft and Belle views render the fitted passage head from both rooms',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[];let checked=0;
  for(const kind of ['loft','bellehome'])for(const index of [0,1])for(const side of [-1,1]){
   enterRoom(kind,{ret:[50,73,0]},ROOM_DEFS[kind].entry);const p=room.def.homePassages?.[index];if(!p){bad.push('no native passage');continue;}
   const mid=(p.start+p.end)/2,offset=index===1?(side<0?-.8:1.8):0;px=mid+offset;py=side<0?p.cross-2:p.cross+3;a=Math.atan2(p.cross+.5-py,mid-px);pitch=0;render(0);pitch=(2.7-1.7)/Math.hypot(p.cross+.5-py,mid-px)*projY/rows;fade=0;render(0);const before=Array.from(BG);
   const props=room.props.filter(o=>o.homePassage?.index===index),saved=props.map(o=>o.draw),draw=drawBox;let active=false,calls=0;
   for(const [i,o]of props.entries())o.draw=(...args)=>{active=['infill','casing-head'].includes(o.homePassage.role);if(active)calls++;try{return saved[i](...args);}finally{active=false;}};
   drawBox=(b,shade,ray)=>draw(b,active?(i,t,L)=>{const hit=shade(i,t,L);if(hit)BG[i]=C(MAG,15);return hit;}:shade,ray);
   try{render(0);if(calls===0||!Array.from(BG).some((c,i)=>c===C(MAG,15)&&before[i]!==c))bad.push([kind,index,side,'native head missing']);if(!free(px,py))bad.push('review camera obstructed');checked++;}
   finally{drawBox=draw;props.forEach((o,i)=>o.draw=saved[i]);}
  }return {bad,checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,8);
}));

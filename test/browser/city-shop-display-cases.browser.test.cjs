'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const ROOMS=[['skate','SKATE',1],['tobacco','TOBACCO',1],['herbs','HERBS',1],['pawn','PAWN',2],['jeweler','JEWELER',3],['tattoo','TATTOO',1],['antiques','ANTIQUES',2]];

test('every shop display case holds solid goods on its velvet bed, inside the glass, nothing painted on the panes',()=>fixture(async p=>{
 const r=await p.evaluate(ROOMS=>{
  const out=[],bad=[];
  for(const [kind,word,n] of ROOMS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   const cases=room.props.filter(o=>o.displayCase);out.push([kind,cases.length===n]);
   for(const o of cases){
    const d=o.displayCase,draw=drawBox,parts=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
    const local=(x,y)=>{const qx=x-d.x,qy=y-d.y;return [qx*d.c+qy*d.s,-qx*d.s+qy*d.c];};
    // goods: everything above the bed and under the glass top, except the glass and the chrome frame
    const goods=parts.filter(q=>q.box.z0>=d.bed-1e-9&&q.box.z1<d.h-.012&&!(q.ray===rayBox&&q.box.hl>d.hl-.05)&&q.ray!==coveRayCapsule||q.ray===coveRayCapsule&&Math.max(q.box.az,q.box.bz)<d.h-.05);
    if(goods.length<d.items.length)bad.push([kind,'too few goods',goods.length,d.items.length]);
    for(const q of goods){
     const b=q.box,pts=q.ray===coveRayCapsule?[[b.ax,b.ay,b.r],[b.bx,b.by,b.r]]:[[b.x,b.y,Math.hypot(b.hl,b.hw)]];
     for(const [x,y,r] of pts){const [u,v]=local(x,y);if(Math.abs(u)+r>d.hl-.02||Math.abs(v)+r>d.hw-.02)bad.push([kind,'outside the bed',+u.toFixed(3),+v.toFixed(3)]);}
     if(b.z0<d.bed-1e-9)bad.push([kind,'sunk into the bed']);
    }
    // every item has a part resting right on the bed
    const rest=goods.filter(q=>Math.abs((q.ray===coveRayCapsule?Math.min(q.box.az,q.box.bz)-q.box.r:q.box.z0)-d.bed)<.0021).length;if(rest<d.items.length*.8)bad.push([kind,'floating goods',rest,d.items.length]);
    // looking through the front glass, the panes are clear where no glint runs
    const glass=parts.find(q=>q.ray===rayBox&&q.box.hl>d.hl-.05&&q.box.z0===d.glassBottom);let clear=0;
    for(let k=0;k<20;k++){const u=-d.hl*.8+k*d.hl*.08,[x,y]=[d.x+d.c*u-d.s*(d.hw+1),d.y+d.s*u+d.c*(d.hw+1)],t=glass.ray(x,y,d.glassBottom+.2,d.s,-d.c,0,glass.box);if(t>0&&!glass.shade(0,t,8))clear++;}
    if(clear<17)bad.push([kind,'glass not clear',clear]);
    if(o.box.z0!==0||Math.abs(o.box.z1-d.h)>1e-9)bad.push([kind,'collision']);
   }
  }
  // the delis use the built food case
  for(const [kind,word] of [['deli','DELI'],['delicatessen','DELICATESSEN']]){enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);out.push([kind,room.props.some(o=>o.foodCase?.kind==='deli')]);}
  return{out,bad:bad.slice(0,8),count:bad.length};
 },ROOMS);
 assert.deepEqual(r.bad,[],r.count+' bad');for(const [k,ok] of r.out)assert.ok(ok,k);
}));

test('shops with display cases still serve at the counter and stay walkable from the door',()=>fixture(async p=>{
 const r=await p.evaluate(ROOMS=>{
  const out=[];
  for(const [kind,word] of ROOMS){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);
   const k=room.def.keeper,clerk=room.props.find(o=>o.fig&&Math.hypot(o.x-k[0],o.y-k[1])<1e-6);
   const blocked=room.props.filter(q=>q!==clerk&&q.displayCase&&inBox(q.box,clerk.x,clerk.y,.15)).length;
   out.push([kind,blocked]);
  }
  return out;
 },ROOMS);
 for(const [k,b] of r)assert.equal(b,0,k);
}));

test('gemstones sit on their ring bands and display-case geometry prepares once',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  enterRoom('jeweler',{word:'JEWELER',ret:[100,100,0]},[5,5,0]);const bad=[];
  const capture=o=>{const draw=drawBox,out=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return out;};
  let rings=0;
  for(const o of room.props.filter(o=>o.displayCase)){
   const a=capture(o),b=capture(o),z=o.displayCase.bed;
   if(a.some((q,k)=>q.box.profile&&q.box.profile!==b[k].box.profile))bad.push('static profiles rebuilt while drawing');
   for(const band of a.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.hl-.018)<1e-8)){
    rings++;const gem=a.find(q=>q.ray===coveRayLathe&&q.box.hl<=.006&&Math.abs(q.box.z0-(z+.006))<1e-8&&Math.hypot(q.box.x-band.box.x,q.box.y-band.box.y)<.03);
    if(!gem){bad.push('ring lacks its stone');continue;}
    const foot=gem.box.profile.find(q=>Math.abs(q[0]-gem.box.z0)<1e-8&&q[1]>0)?.[1];
    for(let k=0;k<8;k++){
     const angle=k*Math.PI/4,x=gem.box.x+foot*.8*Math.cos(angle),y=gem.box.y+foot*.8*Math.sin(angle),from=gem.box.z0+.05,t=band.ray(x,y,from,0,0,-1,band.box);
     if(!(t>0&&Math.abs(from-t-gem.box.z0)<1e-7))bad.push('stone floats over ring hole');
    }
   }
  }
  if(rings<5)bad.push('missing native rings');return bad.slice(0,10);
 });assert.deepEqual(bad,[]);
}));

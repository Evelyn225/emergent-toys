'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
// Every part the tank draws at time t, in world coordinates.
const parts=t=>{
 const model=room.props.find(o=>o.seafoodTank),draw=drawBox,saved=T,shapes=[];projX=10000;T=t;
 drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;T=saved;}
 return {model,shapes};
};
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);enterRoom('dimsum',{word:'DIM SUM',ret:[100,100,0]},[7.4,9.5,-Math.PI/2]);});
 await p.evaluate(`window.parts=${parts}`);
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the dim sum tank is a built unit on the wall: cabinet, framed glass, hood, gravel and water, with the door and tables clear',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const {model,shapes}=parts(10),d=model.seafoodTank,bad=[];
  if(roomAt(d.x-d.fx*.05,d.y-d.fy*.05)!=='#')bad.push('not against the wall');
  for(const u of [-d.half,0,d.half]){const c=-d.fy,s=d.fx;if(roomAt(d.x+c*u+d.fx*(d.depth+.05),d.y+s*u+d.fy*(d.depth+.05))!=='.')bad.push(['front',u]);}
  // nothing else stands in its footprint, and people can walk round its front
  for(const q of room.props)if(q!==model&&q.box&&!q.walk&&q.box.z1>.1&&inBox(q.box,model.box.x,model.box.y,model.box.hw))bad.push(['crowded',q.box.x,q.box.y]);
  let lane=true;for(let y=5.4;y<=7.2;y+=.05)lane&&=free(d.x+d.depth+.35,y);
  // looking through the front glass at the water, most cells stay clear
  const glass=shapes.find(o=>o.ray===rayBox&&o.box.hw<.005&&o.box.hl>d.half-.1);
  let clear=0,n=0;for(let k=0;k<40;k++){const y=d.y-d.half*.8+k*d.half*.04,z=1.1+(k%5)*.06,t=glass.ray(d.x+2,y,z,-1,0,0,glass.box);if(t>0){n++;if(!glass.shade(0,t,8))clear++;}}
  const painted=room.props.some(o=>o.shade&&o.box&&Math.abs(o.box.x-1.3)<.01);
  return{bad,lane,clear,n,painted,parts:shapes.length,top:model.box.z1};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.lane,'walk past the tank');assert.equal(r.painted,false);
 assert.ok(r.n===40&&r.clear>=34,JSON.stringify(r));
}));

test('groupers swim inside the glass all the way round their loop; lobsters, legs and bubbles stay in the water on the gravel',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let checked=0;
  for(let t=0;t<40;t+=.37){
   const {model,shapes}=parts(t),d=model.seafoodTank,inner=d.inner,c=-d.fy,s=d.fx;
   const local=(x,y)=>{const qx=x-d.x,qy=y-d.y;return [qx*c+qy*s,(qx*d.fx+qy*d.fy)-d.depth/2];};
   for(const o of shapes){
    const b=o.box,live=o.ray===homeRayEllipsoid||o.ray===coveRayCapsule||o.box.profile&&b.z1<d.water;
    if(!live||b.z0<d.floor-.06)continue; // the frame, hood and cabinet
    if(b.z0>d.water)continue;
    checked++;
    // the furthest reach of the part's box along the tank's axes
    const [u,v]=o.ray===coveRayCapsule?local((b.ax+b.bx)/2,(b.ay+b.by)/2):local(b.x,b.y);
    const ru=o.ray===coveRayCapsule?Math.abs(b.bx-b.ax)/2*Math.abs(c)+Math.abs(b.by-b.ay)/2*Math.abs(s)+b.r:Math.abs(b.hl*(b.c*c+b.s*s))+Math.abs(b.hw*(-b.s*c+b.c*s));
    const rv=o.ray===coveRayCapsule?Math.abs(b.bx-b.ax)/2*Math.abs(d.fx)+Math.abs(b.by-b.ay)/2*Math.abs(d.fy)+b.r:Math.abs(b.hl*(b.c*d.fx+b.s*d.fy))+Math.abs(b.hw*(-b.s*d.fx+b.c*d.fy));
    if(Math.abs(u)+ru>d.half-.006||Math.abs(v)+rv>inner)bad.push(['glass',+t.toFixed(2),+u.toFixed(3),+v.toFixed(3)]);
    if(b.z1>d.water+1e-6||b.z0<d.floor-.012)bad.push(['height',+t.toFixed(2),b.z0,b.z1]);
   }
  }
  const {model}=parts(0),d=model.seafoodTank;
  return{bad:bad.slice(0,8),count:bad.length,checked,fish:d.fish.length,lobsters:d.lobsters.length,bubbles:d.bubbles};
 });
 assert.deepEqual(r.bad,[],r.count+' bad');assert.ok(r.checked>1000,JSON.stringify(r));
 assert.equal(r.fish,3);assert.equal(r.lobsters,2);assert.ok(r.bubbles>=5);
}));

test('the fish turn smoothly: heading follows their path, never flipping between frames',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const d=room.props.find(o=>o.seafoodTank).seafoodTank,bad=[];
  for(const f of d.fish){let last=null;for(let t=0;t<60;t+=.05){const q=seafoodFishPose(f,t);
   if(last&&q.c*last.c+q.s*last.s<.97)bad.push([t,q.c,q.s]);
   if(last){const mu=q.u-last.u,mv=q.v-last.v,m=Math.hypot(mu,mv);if(m>1e-6&&(mu*q.c+mv*q.s)/m<.9)bad.push(['sideways',t]);}
   last=q;}}
  return bad.slice(0,5);
 });
 assert.deepEqual(r,[]);
}));

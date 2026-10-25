'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const HELP=`const shapes=o=>{const draw=drawBox,out=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return out;};
 const back=(q,fx,fy,wx,wy)=>{const b=q.box;
  if(q.ray===coveRayCapsule)return Math.min((b.ax-wx)*fx+(b.ay-wy)*fy,(b.bx-wx)*fx+(b.by-wy)*fy)-b.r;
  const c=b.c??1,s=b.s??0;return (b.x-wx)*fx+(b.y-wy)*fy-Math.abs(b.hl*(c*fx+s*fy))-Math.abs(b.hw*(-s*fx+c*fy));};
 const clerkClear=()=>{const k=room.def.keeper,clerk=room.props.find(o=>o.fig&&Math.hypot(o.x-k[0],o.y-k[1])<1e-6),bad=[];
  for(const q of room.props)if(q!==clerk&&q.box&&q.box.z0<1&&q.box.z1>.2&&inBox(q.box,clerk.x,clerk.y,.18))bad.push(['clerk',q.box.x,q.box.y]);return bad;};`;

test('the cone rack: every bottom cone rests in its wire ring, stacks clear of the row above, all of it on the wall clear of the clerk',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{${HELP}
  enterRoom('icecream',{word:'ICE CREAM',ret:[100,100,0]},[5.5,6.6,-Math.PI/2]);
  const o=room.props.find(o=>o.coneRack),d=o.coneRack,bad=[...clerkClear()];
  if(roomAt(d.x,d.y-.05)!=='#')bad.push('not on the wall');
  for(const q of shapes(o)){const t=back(q,d.fx,d.fy,d.x,d.y);if(t< -1e-6)bad.push(['into the wall',t]);}
  // the cone's radius where it passes through the ring
  const at=h=>{for(let k=1;k<WAFER_CONE.length;k++){const [z0,r0]=WAFER_CONE[k-1],[z1,r1]=WAFER_CONE[k];if(z1>z0&&h>=z0&&h<=z1)return r0+(r1-r0)*(h-z0)/(z1-z0);}return 0;};
  const r=at(.12),inner=d.ring-.003,outer=d.ring+.003;if(!(r>inner&&r<outer))bad.push(['falls through or misses the ring',r,inner,outer]);
  const top=Math.max(...CONE_RACK.rows)-.12,low=Math.min(...CONE_RACK.rows)-.12+(CONE_RACK.stack-1)*CONE_RACK.step+.13;
  if(low>=top)bad.push(['stacks touch the row above',low,top]);
  const floor=WAFER_CONE[WAFER_CONE.length-1][0];if(Math.abs(CONE_RACK.step-floor)>1e-9)bad.push(['a stacked cone not standing on the floor of the one below',CONE_RACK.step,floor]);
  for(const q of d.holders)if(Math.abs(q.u)>d.half-.04)bad.push(['off the rail',q.u]);
  const i=0;BG[i]=0;iceWall(i,4.2,.01,1.5,3,4,0,8);
  return{bad,holders:d.holders.length,painted:CH[i]==='V'};
 })()`);
 assert.deepEqual(r.bad,[]);assert.equal(r.holders,12);assert.equal(r.painted,false);
}));

test('the burger pass: frame on the shelf, hood in front of the frame, lamps between, tickets above, clear of the machines and the clerk, kitchen seen through it',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{${HELP}
  enterRoom('burgerjoint',{word:'BURGERS',ret:[100,100,0]},[6.5,8.4,-Math.PI/2]);
  const o=room.props.find(o=>o.burgerPass),d=o.burgerPass,parts=shapes(o),bad=[...clerkClear()];
  for(const q of parts){const t=back(q,d.fx,d.fy,d.x,d.y);if(t< -1e-6)bad.push(['into the wall',t]);}
  const flat=parts.filter(q=>q.ray===homeRayWorktop),frames=flat.filter(q=>q.box.hw===.008),shelf=flat.find(q=>q.box.z1===d.bottom),hood=flat.find(q=>q.box.z0===d.top-.02);
  if(!shelf||frames.filter(q=>q.box.z0===d.bottom).length!==2)bad.push('frame not standing on the shelf');
  if(back(hood,d.fx,d.fy,d.x,d.y)<.016-1e-9)bad.push('hood into the frame');
  if(back(hood,d.fx,d.fy,d.x,d.y)>.016+1e-9)bad.push('hood not meeting the frame');
  // the ticket rail is held off the wall: plates on the wall at its height, a standoff from each into the rail
  const railZ=d.top+.18,plates=flat.filter(q=>Math.abs(back(q,d.fx,d.fy,d.x,d.y))<1e-9&&q.box.z0<railZ&&q.box.z1>railZ);
  const standoffs=parts.filter(q=>q.ray===coveRayCapsule&&Math.abs(q.box.az-railZ)<1e-9&&Math.abs(q.box.bz-railZ)<1e-9&&Math.abs(((q.box.ax-q.box.bx)*d.fx+(q.box.ay-q.box.by)*d.fy))>.005);
  if(plates.length<2||standoffs.length<2)bad.push(['ticket rail not held',plates.length,standoffs.length]);
  const lamps=parts.filter(q=>q.box.profile&&q.box.z0>d.bottom&&q.box.z1<d.top);if(lamps.length!==2)bad.push(['lamps',lamps.length]);
  const tickets=parts.filter(q=>q.ray===rayBox&&q.box.hw===.001);if(tickets.some(q=>q.box.z0<=hood.box.z1))bad.push('ticket behind the hood');
  // the shake machine and the soda fountain stand clear of the pass
  for(const m of room.props.filter(q=>q.kitchenDrink||q.box&&Math.abs(q.box.y-1.45)<.2&&q!==o&&!q.fig))if(m.box&&Math.abs(m.box.x-d.x)<d.half+m.box.hl)bad.push(['machine',m.box.x]);
  const i=0;BG[i]=0;CH[i]='?';burgerWall(i,5.7,.01,1.3,3,5,0,8);const kitchen=CH[i]===' ';
  px=5.9;py=3.4;const k=room.def.keeper;a=Math.atan2(k[1]-py,k[0]-px);render(0);
  return{bad,kitchen,tickets:tickets.length,prompt:promptText()};
 })()`);
 assert.deepEqual(r.bad,[]);assert.ok(r.kitchen,'kitchen view through the opening');assert.equal(r.tickets,4);assert.match(r.prompt,/E: shop$/);
}));

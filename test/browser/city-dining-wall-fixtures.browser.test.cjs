'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
// world boxes a prop draws at time t: [box, ray]
const SHAPES=`const shapes=(o,t=T)=>{const draw=drawBox,saved=T,out=[];projX=10000;T=t;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;T=saved;}return out;};
 // how far a drawn part reaches back toward the wall it is mounted on (its nearest point along the facing)
 const back=(q,fx,fy,wx,wy)=>{const b=q.box;
  if(q.ray===coveRayCapsule)return Math.min((b.ax-wx)*fx+(b.ay-wy)*fy,(b.bx-wx)*fx+(b.by-wy)*fy)-b.r;
  const c=b.c??1,s=b.s??0;return (b.x-wx)*fx+(b.y-wy)*fy-Math.abs(b.hl*(c*fx+s*fy))-Math.abs(b.hw*(-s*fx+c*fy));};`;

test('pho fans: plate on the wall, the head clear of it through the whole sweep, blades turning inside the cage',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{${SHAPES}
  enterRoom('pho',{word:'PHO',ret:[100,100,0]},[6.5,7.4,-Math.PI/2]);
  const fans=room.props.filter(o=>o.phoFan),bad=[];let samples=0;
  for(const o of fans){const f=o.phoFan;
   if(roomAt(f.x-f.fx*.05,f.y-f.fy*.05)!=='#'||roomAt(f.x+f.fx*.05,f.y+f.fy*.05)!=='.')bad.push(['not on a wall face',f.x,f.y]);
   let blades=null,moved=false;
   for(let t=0;t<PHO_FAN.period;t+=.23){
    const parts=shapes(o,t);samples++;
    for(const q of parts){const d=back(q,f.fx,f.fy,f.x,f.y);if(d< -1e-6)bad.push(['into the wall',+t.toFixed(2),+d.toFixed(4)]);if(q.box.z1>(room.def.height||3))bad.push('ceiling');}
    const plate=parts.filter(q=>q.ray===homeRayWorktop);if(!plate.some(q=>Math.abs(back(q,f.fx,f.fy,f.x,f.y))<1e-6))bad.push(['plate off the wall',t]);
    const b=parts.filter(q=>q.ray===homeClockRayHand).map(q=>q.box.handShape.bz.toFixed(4)).join();if(blades!==null&&b!==blades)moved=true;blades=b;
    const [hx,hy]=phoFanHeading(f.fx,f.fy,t,f.phase);if(hx*f.fx+hy*f.fy<Math.cos(PHO_FAN.sweep)-1e-9)bad.push('sweeps too far');
    // every grille ring is carried: spokes run from inside the hub out into the rim, and each ring lies along them
    const spokes=parts.filter(q=>q.ray===homeClockRayHand&&q.box.handShape.r===PHO_FAN.wire).map(q=>{const b=q.box,cu=(b.x-o.x)*hy+(b.y-o.y)*-hx,h=b.handShape;
     return {v:(b.x-o.x)*hx+(b.y-o.y)*hy,r0:Math.hypot(h.ax+cu,h.az-f.z),r1:Math.hypot(h.bx+cu,h.bz-f.z)};});
    for(const g of [PHO_FAN.front,PHO_FAN.back]){const on=spokes.filter(q=>Math.abs(q.v-g.v)<1e-6);
     if(on.length<3)bad.push(['too few spokes',g.v,on.length]);
     if(on.some(q=>Math.min(q.r0,q.r1)>g.hub+1e-6||Math.max(q.r0,q.r1)<PHO_FAN.cage-.004-1e-6))bad.push(['a spoke short of the hub or the rim',g.v]);
     if(g.rings.some(r=>on.some(q=>r<Math.min(q.r0,q.r1)||r>Math.max(q.r0,q.r1))))bad.push(['a ring off its spokes',g.v]);}
   }
   if(!moved)bad.push('blades still');
   if(PHO_FAN.shaft[0]>PHO_FAN.back.v+1e-9||PHO_FAN.shaft[1]<PHO_FAN.spinner[0]-1e-9)bad.push('the spinner is not on its shaft');
  }
  const tip=.03+PHO_FAN.blade+PHO_FAN.width;
  // the old painted fan is plain tiled wall now
  const i=0;BG[i]=0;phoWall(i,2,.01,2.1,3,1,4,8);
  return{bad:bad.slice(0,6),count:bad.length,fans:fans.length,samples,tip,cage:PHO_FAN.cage,wall:BG[i]===C(WHITE,5+8*.2)&&CH[i]===' '};
 })()`);
 assert.deepEqual(r.bad,[],r.count+' bad');assert.equal(r.fans,2);assert.ok(r.tip<r.cage-.01,JSON.stringify(r));assert.ok(r.wall,'painted fan gone');
}));

test('kissaten clock hangs on the wall face showing the game time; the painted clock is gone',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{${SHAPES}
  enterRoom('kissaten',{word:'KISSATEN',ret:[100,100,0]},[6.5,6.4,-Math.PI/2]);
  const clocks=room.props.filter(o=>o.kissatenClock),o=clocks[0],k=o.kissatenClock,bad=[];
  if(roomAt(k.x-k.fx*.05,k.y-k.fy*.05)!=='#')bad.push('not on a wall');
  const parts=shapes(o),near=Math.min(...parts.map(q=>back(q,k.fx,k.fy,k.x,k.y)));
  if(Math.abs(near)>.006)bad.push(['back',near]);
  // the hands follow the time of day
  tod=3;const a=shapes(o).filter(q=>q.ray===homeClockRayHand).map(q=>q.box.handShape.bz.toFixed(3)).join();
  tod=9.5;const b=shapes(o).filter(q=>q.ray===homeClockRayHand).map(q=>q.box.handShape.bz.toFixed(3)).join();
  const i=0;BG[i]=0;kissatenWall(i,1.75,.01,2.15,3,1,3,8);
  return{bad,clocks:clocks.length,turned:a!==b,wall:BG[i]===C(WARM,1.6+8*.15)};
 })()`);
 assert.deepEqual(r.bad,[]);assert.equal(r.clocks,1);assert.ok(r.turned,'hands follow tod');assert.ok(r.wall,'painted clock gone');
}));

test('roastery plants: pots on brackets clear of the wall, every leaf hanging in front of it, the painted foliage gone',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{${SHAPES}
  enterRoom('roastery',{word:'COFFEE',ret:[100,100,0]},[6.5,7.4,-Math.PI/2]);
  const plants=room.props.filter(o=>o.trailingPlant),bad=[];
  for(const o of plants){const q=o.trailingPlant;
   if(roomAt(q.x-q.fx*.05,q.y-q.fy*.05)!=='#'||roomAt(q.x+q.fx*.3,q.y+q.fy*.3)!=='.')bad.push(['wall',q.x,q.y]);
   if(q.pot.v-q.pot.radius<.02)bad.push('pot into the wall');
   for(const part of shapes(o)){const d=back(part,q.fx,q.fy,q.x,q.y);if(d< -1e-6)bad.push(['into the wall',d]);if(part.box.z0<.9)bad.push(['too low',part.box.z0]);}
   for(const l of q.leaves)if(l.z>q.pot.top)bad.push('leaf above the pot');
   // each vine grows out of the soil and over the rim; no leaf is inside the pot
   for(const v of q.vines){if(Math.hypot(v.root.u,v.root.v-q.pot.v)>q.pot.inner-.003||Math.abs(v.root.z-q.pot.soil)>.005)bad.push('vine not rooted in the soil');
    if(Math.hypot(v.rim.u,v.rim.v-q.pot.v)<q.pot.radius+.003||v.rim.z<q.pot.top+.003)bad.push('vine through the rim');}
   for(const l of q.leaves)if(l.z+.028>q.z&&Math.hypot(l.u,l.v-q.pot.v)<q.pot.radius)bad.push('leaf inside the pot');
   // nothing else in the room stands where the vines hang
   for(const other of room.props)if(other!==o&&other.box&&!other.walk&&other.box.z1>q.z-1&&inBox(other.box,q.x+q.fx*.12,q.y+q.fy*.12,.1))bad.push(['crowded',other.box.x,other.box.y]);
  }
  const i=0;BG[i]=0;roasteryWall(i,4.8,.01,2,3,1,4,8);
  return{bad:bad.slice(0,6),plants:plants.length,wall:BG[i]===C(WHITE,4.6+8*.15)};
 })()`);
 assert.deepEqual(r.bad,[]);assert.equal(r.plants,4);assert.ok(r.wall,'painted plants gone');
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('jail',{word:'JAIL',until:T+60,ret:[100,100,0]},[11,3.2,Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('guard desk has cached grounded feet and legs, joined frame, supported worktop and hung drawers with attached handles',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(p=>p.jailDesk),draw=drawBox;if(!o)return{bad:['missing fitted desk'],checked:0};
  const capture=()=>{const A=[];drawBox=(b,shade,ray=rayBox)=>A.push({b:{...b},ref:b,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return A;},A=capture(),B=capture(),role=q=>o.jailDesk.parts.find(p=>p.view===q.ref)?.role,many=r=>A.filter(q=>role(q)===r),one=r=>many(r)[0],bottom=q=>q.ray(q.b.x,q.b.y,-1,0,0,1,q.b)-1,top=q=>4-q.ray(q.b.x,q.b.y,4,0,0,-1,q.b);
  if(A.length!==22)return{bad:['missing closed components'],checked:A.length};
  for(let k=0;k<A.length;k++){
   const q=A[k],b=q.b;
   if(q.ref!==B[k].ref||q.ray!==B[k].ray||q.shade!==B[k].shade)bad.push('rebuilt desk geometry');
   if(b.x-b.hl<o.x-.5-1e-8||b.x+b.hl>o.x+.5+1e-8||b.y-b.hw<o.y-.9-1e-8||b.y+b.hw>o.y+.9+1e-8||b.z0<0||b.z1>.8||Math.abs(top(q)-b.z1)>1e-8||Math.abs(bottom(q)-b.z0)>1e-8)bad.push('outside envelope or open caps');
  }
  const feet=many('foot'),legs=many('leg'),long=many('long-apron'),ends=many('end-apron'),topper=one('worktop'),cab=one('cabinet'),drawers=many('drawer'),posts=many('handle-post'),handles=many('handle');
  if(feet.length!==4||legs.length!==4||long.length!==2||ends.length!==2||drawers.length!==2||posts.length!==4||handles.length!==2)bad.push('missing supports/drawers');
  for(let k=0;k<4;k++)if(Math.abs(bottom(feet[k]))>1e-8||Math.abs(top(feet[k])-bottom(legs[k]))>1e-8||Math.abs(top(legs[k])-bottom(topper))>1e-8||!long.some(q=>inBox(q.b,legs[k].b.x,legs[k].b.y,.025-1e-8)&&Math.abs(top(q)-top(legs[k]))<1e-8))bad.push('foot/leg/frame/worktop support gap');
  for(const q of long)for(const e of ends)if(Math.abs(Math.abs(q.b.y-e.b.y)-(q.b.hw+e.b.hw))>1e-8||e.b.x-e.b.hl>q.b.x+q.b.hl||e.b.x+e.b.hl<q.b.x-q.b.hl||q.b.z0!==e.b.z0||q.b.z1!==e.b.z1)bad.push('open apron corner');
  if(Math.abs(top(cab)-bottom(topper))>1e-8||Math.abs(top(topper)-.8)>1e-8)bad.push('cabinet unsupported or worktop changed');
  for(const q of drawers)if(Math.abs(q.b.x+q.b.hl-(cab.b.x-cab.b.hl))>1e-8||q.b.y-q.b.hw<cab.b.y-cab.b.hw||q.b.y+q.b.hw>cab.b.y+cab.b.hw||q.b.z0<cab.b.z0||q.b.z1>cab.b.z1)bad.push('unbacked drawer');
  for(let k=0;k<2;k++){
   const front=drawers[k],h=handles[k],pair=posts.slice(k*2,k*2+2);
   if(pair.some(p=>Math.abs(p.b.ax-(front.b.x-front.b.hl))>1e-8||Math.abs(p.b.az-(front.b.z0+front.b.z1)/2)>1e-8||Math.abs(p.b.bx-h.b.ax)>1e-8)||Math.abs(pair[0].b.by-h.b.ay)>1e-8||Math.abs(pair[1].b.by-h.b.by)>1e-8)bad.push('floating drawer handles');
  }
  const gap=A.map(q=>q.ray(o.x-.2,o.y,.01,0,0,1,q.b)).filter(t=>t>0);if(Math.abs(Math.min(...gap)-.75)>1e-8)bad.push('filled leg space');
  if(o.walk||o.box.hl!==.5||o.box.hw!==.9||o.box.z0!==0||o.box.z1!==.8||o.radius<Math.hypot(.5,.9))bad.push('changed native footprint');
  if(room.props.some(p=>!p.jailDesk&&p.box?.x===19.6&&p.box.y===7.5&&p.box.hl===.5&&p.box.hw===.9))bad.push('legacy slab retained');
  const monitor=room.props.find(p=>p.box?.x===19.6&&p.box.y===7.3),cup=room.props.find(p=>p.x===19.6&&p.y===8.2);let cupBottom=cup?.z;
  if(cup?.jailCoffee){cupBottom=Infinity;drawBox=(b,shade,ray=rayBox)=>{const t=ray(cup.x,cup.y,-1,0,0,1,b);if(t>0)cupBottom=Math.min(cupBottom,t-1);};try{cup.draw(cup.x,cup.y);}finally{drawBox=draw;}}
  if(!monitor||!cup||Math.abs(monitor.box.z0-top(topper))>1e-8||Math.abs(cupBottom-top(topper))>1e-8)bad.push('monitor/coffee no longer supported');
  return{bad,checked:A.length};
 });assert.equal(r.checked,22);assert.deepEqual(r.bad,[]);
}));
test('desk appears from the legal jail cell and actual freecam shows its legs while the guard patrol pauses clear of it',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(p=>p.jailDesk),guard=room.props.find(p=>p.fig&&p.tick&&p.y===7.5),look=guard.fig,t=T;let lo=Infinity,hi=-Infinity;
  try{for(let k=0;k<400;k++){T=k;guard.tick(guard);lo=Math.min(lo,guard.x);hi=Math.max(hi,guard.x);if(inBox(o.box,guard.x,guard.y,.2))bad.push('guard walks through desk');}}finally{T=t;guard.tick(guard);}
  if(Math.abs(lo-2.5)>.01||Math.abs(hi-18.75)>1e-8||guard.fig!==look)bad.push('patrol west end/pause/identity changed');
  const compare=()=>{const A=[BG.slice(),CH.slice(),COL.slice()],d=o.draw;o.draw=()=>{};let n=0;try{if(freecam)renderFreecam();else render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==A[0][i]||CH[i]!==A[1][i]||COL[i]!==A[2][i])n++;}finally{o.draw=d;}return n;};
  // The bars hide most of it from any one spot: it has to show from somewhere you can stand at the cell's front.
  const player={clear:true,changed:0};for(let x=9.5;x<=12.5;x+=.5){px=x;py=5.3;const dx_=19.6-x,dy_=2.2;a=Math.atan2(dy_,dx_);pitch=0;render(0);pitch=(.5-eye)/Math.hypot(dx_,dy_)*projY/rows;render(0);player.clear&&=free(px,py);player.changed=Math.max(player.changed,compare());}px=11;py=5.3;
  const before=[px,py],out=[];toggleFreecam();
  for(const low of [false,true]){
   const x=low?18.5:18,y=low?6.7:7.5,tx=low?19.18:19.6,ty=y,z=low?.4:1.7,tz=low?.2:.55;
   Object.assign(freecam,{x,y,z,yaw:0,pitch:(tz-z)/(tx-x)*projY/rows});
   const legs=o.jailDesk.parts.filter(p=>p.role==='leg'),shades=legs.map(p=>p.shade),hits=new Map();
   if(low)legs.forEach((p,k)=>p.shade=(i,t,L)=>{const ok=shades[k](i,t,L);hits.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;});
   try{renderFreecam();}finally{legs.forEach((p,k)=>p.shade=shades[k]);}
   const owned=[...hits].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col).length;
   if(low&&owned<5)bad.push('legs missing from actual low freecam');
   out.push({changed:compare(),playerHeld:px===before[0]&&py===before[1]});
  }
  Object.assign(freecam,{x:18.6,y:7.95,z:.62,yaw:0,pitch:(.55-.62)/.99*projY/rows});
  const fronts=o.jailDesk.parts.filter(p=>p.role==='drawer'),shades=fronts.map(p=>p.shade),ink=new Map();
  fronts.forEach((p,k)=>p.shade=(i,t,L)=>{const ok=shades[k](i,t,L);ink.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;});
  try{renderFreecam();}finally{fronts.forEach((p,k)=>p.shade=shades[k]);}
  if([...ink].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col).length<20)bad.push('drawer fronts missing from actual freecam');
  freecam=null;render(0);return{bad,player,out,plan:room.grid===JAIL_GRID&&room.def.block===jailBlock&&room.props.filter(p=>p.jailBars).length===6&&room.props.filter(p=>p.jailBunk).length===6};
 });assert.deepEqual(r.bad,[]);assert.ok(r.plan&&r.player.clear&&r.player.changed>2&&r.out.every(q=>q.playerHeld&&q.changed>20),JSON.stringify(r));
}));

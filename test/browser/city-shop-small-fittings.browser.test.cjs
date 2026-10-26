'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('LPs rest on their crate floor with browsable tops, and pawn televisions rest on the mat and each other',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const bad=[],draw=drawBox,parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};projX=10000;
  enterRoom('thrift',{word:'THRIFT',ret:[100,100,0]},[5,5,0]);
  const o=room.props.find(o=>o.recordCrate),ps=parts(o),tray=ps.find(q=>q.ray===foodRayTray),lp=ps.find(q=>q.ray===rayBox);
  const floor=tray.box.z1+.1-tray.ray(tray.box.x,tray.box.y,tray.box.z1+.1,0,0,-1,tray.box);
  if(Math.abs(lp.box.z0-floor)>1e-9)bad.push(['LPs off crate floor',lp.box.z0,floor]);
  if(lp.box.z1-tray.box.z1<.04||lp.box.z1-tray.box.z1>.08)bad.push('LP tops hidden behind the crate rim');
  const again=parts(o);if(tray.box.planes!==again.find(q=>q.ray===foodRayTray).box.planes)bad.push('crate rebuilt');
  enterRoom('pawn',{word:'PAWN',ret:[100,100,0]},[5,5,0]);const mat=room.props.find(o=>o.mat),tv=room.props.filter(o=>o.x===10.75&&[1.55,2.35,1.95].includes(o.y)&&!o.mat).map(o=>parts(o)[0].box).sort((a,b)=>a.z0-b.z0);
  if(tv.length!==3)return ['missing pawn televisions'];
  for(const q of tv.slice(0,2))if(Math.abs(q.z0-mat.box.z1)>1e-9)bad.push(['TV through mat',q.z0,mat.box.z1]);
  if(Math.abs(tv[2].z0-tv[0].z1)>1e-9||Math.abs(tv[2].z0-tv[1].z1)>1e-9)bad.push('stacked TV floats');
  return bad;
 });assert.deepEqual(bad,[]);
}));

test('the returns slot is recessed into its housing and the queue board shows one stable scaled number',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const bad=[],draw=drawBox,parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};projX=projY=10000;
  enterRoom('video',{word:'VIDEO',ret:[100,100,0]},[5,5,0]);const rb=room.props.find(o=>o.returnsBox),ps=parts(rb),body=ps.find(q=>q.box.z0===.06&&q.box.z1===.9),b=body.box;
  const t=body.ray(b.x-b.s*.5,b.y+b.c*.5,.68,b.s,-b.c,0,b);
  if(t<.35||t>.42)bad.push(['returns slot has no depth',t]);
  const hood=ps.find(q=>q.box.z0===.7);if(!hood||Math.abs(hood.box.hw+.2-(- (hood.box.x-b.x)*b.s+(hood.box.y-b.y)*b.c))>1e-8)bad.push('slot hood detached');
  enterRoom('phones',{word:'PHONES',ret:[100,100,0]},[5,5,0]);const screen=room.props.find(o=>o.x===10.7&&o.y===6.3),q=parts(screen).find(q=>q.box.z0===1.2),s=q.box;Object.assign(WH,{dn:1,sl:0,wc:0});
  for(const time of [10,10.7]){T=time;for(let row=0;row<5;row++)for(let col=0;col<8;col++){
   const u=((col+.5)/4-1)*.08,z=1.335+(.5-(row+.5)/5)*.1,t=q.ray(s.x+s.c*u-s.s*.1,s.y+s.s*u+s.c*.1,z,s.s,-s.c,0,s);q.shade(0,t,8);
   if((CH[0]==='#')!==!!glyphOn('01'[Math.floor(col/4)],col%4,row))bad.push(['queue number missing or duplicated',time,row,col,CH[0]]);
  }}return bad.slice(0,8);
 });assert.deepEqual(bad,[]);
}));

test('the sewing needle stays joined to its head and moves continuously down to the supported fabric',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  enterRoom('thrift',{word:'TAILOR',ret:[100,100,0]},[5,5,0]);const o=room.props.find(o=>o.sewing),draw=drawBox,z=o.sewing.z,bad=[],tips=[];let fixed;
  for(let k=0;k<=12;k++){
   T=k/36;const ps=[];drawBox=(box,shade,ray=rayBox)=>ps.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
   const needle=ps.find(q=>q.box.hl===.003&&q.box.hw===.003),fabric=ps.find(q=>Math.abs(q.box.z0-z-.041)<1e-8&&Math.abs(q.box.z1-z-.043)<1e-8);
   if(!needle){bad.push('missing needle');continue;}tips.push(needle.box.z0);
   if(Math.abs(needle.box.z1-z-.09)>1e-8)bad.push('needle detached from head');
   if(!fabric)bad.push('no supported fabric under needle');
   else{const plate=ps.find(q=>Math.abs(q.box.z0-z-.04)<1e-8&&Math.abs(q.box.z1-z-.041)<1e-8);
    if(!plate||plate.box.hl<fabric.box.hl+.0005||plate.box.hw<fabric.box.hw+.0005||Math.abs(plate.box.x-fabric.box.x)>1e-8||Math.abs(plate.box.y-fabric.box.y)>1e-8)bad.push('fabric not supported by the needle plate');}
   for(const q of ps)if(q.box.z1>o.box.z1+1e-8)bad.push('part outside machine bounds');
   const spool=ps.find(q=>q.box.profile);if(spool){if(fixed&&fixed!==spool.box.profile)bad.push('fixed spool rebuilt');fixed=spool.box.profile;}
  }
  if(Math.abs(Math.min(...tips)-z-.043)>1e-8||Math.max(...tips)-Math.min(...tips)<.01||new Set(tips.map(v=>v.toFixed(5))).size<5)bad.push(['needle does not stitch smoothly to the fabric',tips]);
  return bad.slice(0,8);
 });assert.deepEqual(bad,[]);
}));

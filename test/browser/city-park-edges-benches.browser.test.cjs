'use strict';
// Walking off a ramp's deck you fall rather than being set down; benches are solid (jump them, sit on them); and the
// skatepark's concrete, ramps and rails carry their wear (the shapes, and so the riding, unchanged).
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1000,height:600}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=13;weather='clear';env(0);render(0);for(const q of people)q.hidden=true;});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('walk off the top of a ramp and you fall from it; walk down a slope and your feet follow it',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  const P=SKATEPARK,x0=P.bx*8+P.x0,y0=P.by*8+P.y0,x1=P.bx*8+P.x1,y1=P.by*8+P.y1;let best=null;
  for(let x=x0;x<x1;x+=.02)for(let y=y0;y<y1;y+=.02){const g=outdoorGroundHeight(x,y);for(const [dx,dy] of [[.06,0],[-.06,0],[0,.06],[0,-.06]]){const d=g-outdoorGroundHeight(x+dx,y+dy);if(d>.15&&(!best||d>best.d))best={x,y,dx,dy,d};}}
  px=best.x;py=best.y;body.z=body.vz=0;body.ground=undefined;stepBody(1/60);const zs=[];
  for(let k=0;k<90;k++){px+=best.dx/4;py+=best.dy/4;if(k>3){best.dx=0;best.dy=0;}stepBody(1/60);zs.push(body.z);}
  // a gentle slope: walk down it a little at a time; you stay on it
  let slopeAir=0;const o=SKATE_FEATURES.find(q=>q.ramp==='kicker');if(o){px=o.x+o.c*(o.hl-.02);py=o.y+o.s*(o.hl-.02);body.z=body.vz=0;body.ground=undefined;stepBody(1/60);
   for(let k=0;k<60;k++){px-=o.c*.004;py-=o.s*.004;stepBody(1/60);if(body.z>.01)slopeAir++;}}
  return{drop:best.d,peak:Math.max(...zs),landed:zs.at(-1)===0,slopeAir};});
 assert.ok(r.peak>r.drop*10*.8,'in the air off the edge: '+r.peak.toFixed(2)+' m');assert.ok(r.landed,'and down');assert.equal(r.slopeAir,0,'a slope: feet on it');
}));

test('benches: you walk round them, jump over them, and still sit on them',()=>city(async p=>{
 const r=await p.evaluate(()=>{const out=[];for(const b of benches.slice(0,5)){
  px=b.x+b.fx*.15;py=b.y+b.fy*.15;if(!free(px,py))continue;body.z=0;let stopped=false;
  for(let k=0;k<30;k++){const nx=px-b.fx*.01,ny=py-b.fy*.01;if(free(nx,ny)){px=nx;py=ny;}else{stopped=true;break;}}
  body.z=.6;const over=free(b.x,b.y);body.z=0;px=b.x+b.fx*.12;py=b.y+b.fy*.12;out.push({stopped,over,seat:!!nearSeat()});}
  return out;});
 assert.ok(r.length>=3);for(const b of r){assert.ok(b.stopped,'the bench stops you');assert.ok(b.over,'a jump clears it');assert.ok(b.seat,'and you can sit');}
}));

test('the park\'s concrete has its slabs, cure and wear; ramps their streaks; rails their paint scraped back',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  const P=SKATEPARK,ox=P.bx*8,oy=P.by*8;px=ox+4.2;py=oy+4.6;a=.3;pitch=-.4;render(0);
  const tones=new Set();for(let i=Math.floor(BG.length*.6);i<BG.length;i++)if((BG[i]>>4)===GRAY)tones.add(BG[i]&15);
  const rail=SKATE_FEATURES.find(o=>o.kind==='skaterail'),shade=SOLID_SHADE.skaterail(rail);
  HIT.face=3;HIT.u=0;HIT.v=0;HIT.w=rail.z1-.003;shade(0,.1,8);const side=BG[0]>>4;HIT.face=5;HIT.w=rail.z1;shade(0,.1,8);const top=BG[0]>>4;
  return{tones:tones.size,side,top,GRAY};});
 assert.ok(r.tones>=3,'the floor in several tones, not one: '+r.tones);
 assert.equal(r.top,r.GRAY,'the bar\'s top scraped to steel');
}));

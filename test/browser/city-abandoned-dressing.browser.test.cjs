'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;mode='walk';room=me=freecam=null;});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
test('boarded patches belong to abandoned window bays, with supported planks, touching screws and thin layered paper',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedDressingList!=='function')return {missing:true};
  const entries=abandonedDressingList().flat(),bad=[];let horizontal=0,vertical=0;
  for(const e of entries){const parts=abandonedDressingParts(e),planks=parts.filter(p=>p.kind==='plank'),battens=parts.filter(p=>p.kind==='batten'),screws=parts.filter(p=>p.kind==='screw'),papers=parts.filter(p=>p.kind==='paper');
   if(SHOP[idx(Math.floor(e.x-e.nx*.1),Math.floor(e.y-e.ny*.1))]!==e.sh)bad.push('wrong owning facade');
   if(e.sh.kind!==SHOP_SHUT||e.sh.wilderness||planks.length!==4||battens.length!==2||screws.length!==8||papers.length!==2)bad.push('ownership/count');
   if(planks[0].hl>.05)horizontal++;else vertical++;
   if(parts!==abandonedDressingParts(e))bad.push('uncached geometry');
   for(const q of parts){const n=(q.box.x-e.x)*e.nx+(q.box.y-e.y)*e.ny;if(Math.abs(n-q.n)>1e-10||Math.abs(q.t)+q.hl>e.spacing*.39||q.z0<.04||q.z1>.3)bad.push('registration/bounds');}
   for(const q of planks)for(const b of battens)if(Math.abs(q.n-q.hw-(b.n+b.hw))>1e-10||Math.min(q.z1,b.z1)<=Math.max(q.z0,b.z0)||Math.min(q.t+q.hl,b.t+b.hl)<=Math.max(q.t-q.hl,b.t-b.hl))bad.push('unsupported plank');
   for(const q of screws){const plank=planks[q.index];if(Math.abs(q.n-q.hw-(plank.n+plank.hw))>1e-10||Math.abs(q.t-plank.t)+q.hl>plank.hl+1e-10||q.z0<plank.z0||q.z1>plank.z1||!battens.some(b=>q.z0>=b.z0&&q.z1<=b.z1&&q.t-q.hl>=b.t-b.hl&&q.t+q.hl<=b.t+b.hl))bad.push('floating screw');}
   if(papers.some(q=>q.hw>.00003)||Math.abs(papers[0].n-papers[0].hw)>1e-10||Math.abs(papers[1].n-papers[1].hw-(papers[0].n+papers[0].hw))>1e-10)bad.push('floating/thick paper');
  }
  return {count:entries.length,horizontal,vertical,bad:bad.slice(0,10)};
 });assert.equal(r.missing,undefined);assert.ok(r.count>=5&&r.horizontal>0&&r.vertical>0,JSON.stringify(r));assert.deepEqual(r.bad,[]);
}));
test('native street rendering registers the boarded model, occludes it correctly and keeps the closed shop anonymous',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof drawAbandonedDressing!=='function')return {missing:true};
  const entries=abandonedDressingList().flat(),draw=drawAbandonedDressing;let result;
  try{for(const e of entries){px=e.x+e.nx*.22;py=e.y+e.ny*.22;if(!free(px,py))continue;a=Math.atan2(-e.ny,-e.nx);pitch=-.08;body.z=outdoorGroundHeight(px,py);body.vz=body.crouch=0;let calls=0;
    drawAbandonedDressing=(...args)=>{calls++;return draw(...args);};render(0);const aged=Uint8Array.from(BG);
    drawAbandonedDressing=()=>{};render(0);let changed=0;for(let i=0;i<BG.length;i++)if(BG[i]!==aged[i])changed++;
    if(changed<30)continue;drawAbandonedDressing=draw;render(0);
    const[vx,vy]=R(e.x,e.y);ZB.fill(.01);ZBG.fill(.01);CH.fill('X');BG.fill(C(BLUE,5));draw(e,vx,vy);
    result={calls,changed,occluded:CH.every(ch=>ch==='X'),prompt:promptText(),word:e.sh.word};break;
  }}finally{drawAbandonedDressing=draw;}
  return result||{missingView:true};
 });assert.equal(r.missing,undefined);assert.equal(r.missingView,undefined);assert.ok(r.calls>0&&r.changed>30,JSON.stringify(r));assert.ok(r.occluded);assert.ok(!r.prompt.includes(r.word));
}));
test('wood and paper are colour surfaces, and torn-away paper corners leave the existing wall visible',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedDressingParts!=='function')return {missing:true};
  const e=abandonedDressingList().flat()[0],parts=abandonedDressingParts(e),original=drawBox;let index=0,bad=0,cut=false,paper=false;
  try{drawBox=(box,shade)=>{const part=parts[index++];HIT.u=0;HIT.w=(part.z0+part.z1)/2;HIT.face=3;BG[0]=C(BLUE,5);CH[0]='X';if(shade(0,.2,10)&&CH[0]!==' ')bad++;
   if(part.kind==='paper'){paper=BG[0]!==C(BLUE,5);HIT.u=-part.hl*.8;HIT.w=part.z0+.001;BG[0]=C(BLUE,5);CH[0]='X';const drawn=shade(0,.2,10);cut=!drawn&&BG[0]===C(BLUE,5)&&CH[0]==='X';}
  };drawAbandonedDressing(e,0,.22);}finally{drawBox=original;}
  return {bad,paper,cut,index,count:parts.length};
 });assert.equal(r.missing,undefined);assert.equal(r.bad,0);assert.ok(r.paper&&r.cut,JSON.stringify(r));assert.equal(r.index,r.count);
}));

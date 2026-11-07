'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;mode='walk';room=me=freecam=null;});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
test('discarded packing rests on the pavement with joined folds; rooted weeds stay in the window bay and off the entrance',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedGroundParts!=='function')return {missing:true};
  const entries=abandonedDressingList().flat(),bad=[];let cartons=0,weeds=0;
  for(const e of entries){const parts=abandonedGroundParts(e),base=parts.find(p=>p.kind==='carton-base'),folds=parts.filter(p=>p.kind==='carton-fold');
   if(parts!==abandonedGroundParts(e))bad.push('uncached');
   if(base){cartons++;if(folds.length!==4)bad.push('missing fold');for(const f of folds)if(Math.abs(f.z0-base.z1)>1e-10||Math.min(f.t+f.hl,base.t+base.hl)<=Math.max(f.t-f.hl,base.t-base.hl)||Math.min(f.n+f.hw,base.n+base.hw)<=Math.max(f.n-f.hw,base.n-base.hw))bad.push('floating fold');}
   for(const q of parts){
    if(Math.abs(q.t)+q.hl>e.spacing*.39||q.n-q.hw<0||q.n+q.hw>.081)bad.push('bay/sidewalk bounds');
    const x=q.box.x,y=q.box.y,g=outdoorGroundHeight(x,y);
    if(q.kind==='weed'){weeds++;if(Math.abs(q.z0-g)>1e-10||q.z1-q.z0>.04)bad.push('floating/oversized weed');}
    else if(q.kind!=='carton-fold'&&Math.abs(q.z0-g)>1e-10)bad.push('floating rubbish');
   }
   const door=e.x-e.tx*e.spacing*.24+e.nx*.12,doorY=e.y-e.ty*e.spacing*.24+e.ny*.12;
   if(parts.some(q=>inBox(q.box,door,doorY,.01)))bad.push('door blocked');
  }
  return {count:entries.length,cartons,weeds,bad:bad.slice(0,12)};
 });assert.equal(r.missing,undefined);assert.ok(r.count>=5&&r.cartons>=5&&r.weeds===r.count*9,JSON.stringify(r));assert.deepEqual(r.bad,[]);
}));
test('weed rays taper to pointed tips rather than solid boxes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedGroundParts!=='function')return {missing:true};
  let tested=0,bad=0;for(const e of abandonedDressingList().flat().slice(0,10))for(const p of abandonedGroundParts(e).filter(p=>p.kind==='weed')){
   const b=p.box,h=b.z1-b.z0,hit=z=>p.ray(b.x+b.hl*.8,b.y-.1,z,0,1,0,b)>=0;
   if(!hit(b.z0+h*.1)||hit(b.z0+h*.8))bad++;tested++;
  }return {tested,bad};
 });assert.equal(r.missing,undefined);assert.ok(r.tested>=9);assert.equal(r.bad,0);
}));
test('native street rendering includes the ground objects, keeps foreground occlusion and leaves shop prompts anonymous',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof drawAbandonedGround!=='function')return {missing:true};const draw=drawAbandonedGround;let result;
  try{for(const e of abandonedGroundList().flat()){
   px=e.x+e.nx*.19;py=e.y+e.ny*.19;if(!free(px,py))continue;a=Math.atan2(-e.ny,-e.nx);pitch=-.58;body.z=outdoorGroundHeight(px,py);body.vz=body.crouch=0;let calls=0;
   drawAbandonedGround=(...args)=>{calls++;return draw(...args);};render(0);const bg=Uint8Array.from(BG);
   drawAbandonedGround=()=>{};render(0);let changed=0;for(let i=0;i<BG.length;i++)if(bg[i]!==BG[i])changed++;
   if(changed<12)continue;drawAbandonedGround=draw;render(0);const[vx,vy]=R(e.x,e.y);ZB.fill(.01);ZBG.fill(.01);CH.fill('X');BG.fill(C(BLUE,5));draw(e,vx,vy);
   result={calls,changed,occluded:CH.every(ch=>ch==='X'),anonymous:!promptText().includes(e.sh.word)};break;
  }}finally{drawAbandonedGround=draw;}return result||{missingView:true};
 });assert.equal(r.missing,undefined);assert.equal(r.missingView,undefined);assert.ok(r.calls>0&&r.changed>=12,JSON.stringify(r));assert.ok(r.occluded&&r.anonymous);
}));
test('ground materials keep colour surfaces, dormant winter weeds and world-positioned settled snow',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof drawAbandonedGround!=='function')return {missing:true};const e=abandonedDressingList().flat()[0],parts=abandonedGroundParts(e),draw=drawBox,snow=paintSettledSnow,shift=seasonShift;let bad=0,snowCalls=0,spring,winter;
  const render=sn=>{let k=0;setSeason(sn);drawBox=(box,shade)=>{const q=parts[k++];HIT.u=HIT.v=0;HIT.w=(q.z0+q.z1)/2;HIT.face=q.kind==='weed'?3:5;CH[0]='X';shade(0,.2,10);if(CH[0]!==' ')bad++;if(q.kind==='weed'){if(sn===0)spring=BG[0]>>4;else winter=BG[0]>>4;}};drawAbandonedGround(e,0,.2);};
  try{paintSettledSnow=(i,x,y,L,exposure,wear,z)=>{snowCalls++;if(!parts.some(p=>Math.abs(p.box.x-x)<1e-8&&Math.abs(p.box.y-y)<1e-8&&Math.abs((p.z0+p.z1)/2-z)<1e-8))bad++;};render(0);render(3);}finally{drawBox=draw;paintSettledSnow=snow;seasonShift=shift;}
  return {bad,snowCalls,spring,winter,green:GREEN,brown:BRICK};
 });assert.equal(r.missing,undefined);assert.equal(r.bad,0);assert.ok(r.snowCalls>=8,JSON.stringify(r));assert.equal(r.spring,r.green);assert.equal(r.winter,r.brown);
}));
test('rigid packing skips sloped paving while each weed root follows its own ground height',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedGroundParts!=='function')return {missing:true};const e={...abandonedDressingList().flat()[0]},ground=outdoorGroundHeight;let result;
  try{outdoorGroundHeight=(x,y)=>2+((x-e.x)*e.nx+(y-e.y)*e.ny)*.3;
   const parts=abandonedGroundParts(e);result={rigid:parts.filter(p=>p.kind!=='weed').length,weeds:parts.filter(p=>p.kind==='weed').length,rooted:parts.every(p=>Math.abs(p.z0-outdoorGroundHeight(p.box.x,p.box.y))<1e-10)};
  }finally{outdoorGroundHeight=ground;}return result;
 });assert.equal(r.missing,undefined);assert.equal(r.rigid,0);assert.equal(r.weeds,9);assert.ok(r.rooted);
}));
test('abandoned ground dressing reaches other facade families with cached native models and clear pavement',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{if(typeof abandonedGroundList!=='function')return{bad:['brownstone-only dressing']};const entries=abandonedGroundList().flat(),families=[...new Set(entries.map(e=>e.family))],bad=[];let others=0;for(const e of entries){if(e.family!=='brownstones'){others++;if(SHOP[e.ownerCell]!==e.sh||map[e.ownerCell]!==e.ownerHeight)bad.push('wrong facade');}for(const q of abandonedGroundParts(e)){if(q.n+q.hw>.081||q.n-q.hw<0||q.z1-q.z0>.04)bad.push('pavement obstruction');if(q.kind==='weed'&&Math.abs(q.z0-outdoorGroundHeight(q.box.x,q.box.y))>1e-9)bad.push('floating root');}
 const draw=drawBox,A=[],B=[];try{drawBox=(box,shade,ray)=>A.push({box:{...box},ref:box,shade,ray});drawAbandonedGround(e,0,0);drawBox=(box,shade,ray)=>B.push({box:{...box},ref:box,shade,ray});drawAbandonedGround(e,.2,.3);}finally{drawBox=draw;}for(let k=0;k<A.length;k++)if(A[k].ref!==B[k].ref||A[k].shade!==B[k].shade||Math.abs(B[k].box.x-A[k].box.x-.2)>1e-8||Math.abs(B[k].box.y-A[k].box.y-.3)>1e-8)bad.push('uncached translation');}return{families,others,bad:bad.slice(0,8)};});assert.deepEqual(r.bad,[]);assert.ok(r.families.length>=3&&r.others>5,JSON.stringify(r));
}));
test('several permanently shut facade families visibly draw rubbish and weeds through the native street pass',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{if(typeof abandonedGroundList!=='function')return{bad:['missing ground registry']};const entries=abandonedGroundList().flat(),families=[...new Set(entries.map(e=>e.family))],draw=drawAbandonedGround,bad=[],seen=[];try{for(const family of families){for(const e of entries.filter(e=>e.family===family)){px=e.x+e.nx*.19;py=e.y+e.ny*.19;if(!free(px,py))continue;a=Math.atan2(-e.ny,-e.nx);pitch=-.58;body.z=outdoorGroundHeight(px,py);body.vz=body.crouch=0;drawAbandonedGround=draw;render(0);const before=BG.slice();drawAbandonedGround=(q,...args)=>q===e?undefined:draw(q,...args);render(0);let changed=0;for(let k=0;k<BG.length;k++)if(BG[k]!==before[k])changed++;if(changed<6)continue;seen.push(family);break;}}}finally{drawAbandonedGround=draw;}return{bad,seen};});assert.deepEqual(r.bad,[]);assert.ok(r.seen.length>=3,JSON.stringify(r));
}));

test('parallel frontage passes never place both ground groups at the same shop',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const steps=new Set(abandonedStepList().flat().map(e=>e.sh)),ground=abandonedGroundList().flat();return{ground:ground.length,steps:steps.size,overlaps:ground.filter(e=>steps.has(e.sh)).length};});assert.ok(r.ground>30&&r.steps>30,JSON.stringify(r));assert.equal(r.overlaps,0,JSON.stringify(r));
}));

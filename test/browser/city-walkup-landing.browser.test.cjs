'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=false;mode='walk';T=12;tod=12;body.z=body.vz=0;env(0);render(0);});await run(page);assert.deepEqual(errors,[]);}finally{await page.close();}}
test('walk-up landing is a closed supported solid from the top tread to the door, with rounded edges and reused geometry',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('walkup',{district:'brownstones',cell:[100,100],ret:[100,100,0]},[4.85,2,0]);const landing=room.props.find(p=>p.walkupLanding),bad=[];
  if(!landing)return ['no physical landing after the top stair'];const draw=drawBox,capture=(p,x=p.x??p.box?.x,y=p.y??p.box?.y)=>{const rows=[];drawBox=(b,shade,ray=rayBox)=>rows.push({b:{...b},ref:b,shade,ray});try{if(p.draw)p.draw(x,y);else if(p.box)drawBox({...p.box,x,y},p.shade);}finally{drawBox=draw;}return rows;};
  const A=capture(landing),B=capture(landing,landing.x+.1,landing.y+.2);capture(landing);
  if(A.length!==1||B.length!==1)return ['landing has no single closed solid'];
  if(A[0].ref!==B[0].ref||A[0].shade!==B[0].shade||A[0].ray!==B[0].ray)bad.push('landing bounds/material rebuilt after movement');
  if(!landing.walk)bad.push('landing solid blocks its own walkable top');
  const floor=room.props.filter(p=>p.walk).flatMap(p=>capture(p));
  const ys=[];for(let y=1.01;y<3.1;y+=.09)ys.push(y);ys.push(WALKUP_STAIRS.y0-.03,WALKUP_STAIRS.y0-.015,WALKUP_STAIRS.y0-.001,WALKUP_STAIRS.y0+.001);
  for(const x of [4,4.85,5.7])for(const y of ys){let height=-Infinity;
   for(const q of floor){const t=q.ray(x,y,1.3,0,0,-1,q.b);if(t>=0)height=Math.max(height,HIT.w);}
   if(Math.abs(height-WALKUP_STAIRS.rise)>1e-4)bad.push(['unsupported gap or lip',x,+y.toFixed(3),height]);
  }
  const q=A[0],b=q.b;
  for(const y of [1.05,1.6,2.5]){const t=q.ray(WALKUP_RAIL,y,1.2,0,0,-1,b);if(t<0||Math.abs(HIT.w-1)>1e-4)bad.push('level banister foot has no support');}
  const t=q.ray(b.x,b.y,-.2,0,0,1,b);if(t<0||Math.abs(HIT.w)>1e-4||HIT.nz>-.99)bad.push('landing underside is open or floating');
  const edge=q.ray(b.x-b.hl-.1,b.y-b.hw-.1,.5,1,1,0,b);if(edge<.103||Math.abs(HIT.nx)<.3||Math.abs(HIT.ny)<.3||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-6)bad.push('landing corner is not a real rounded solid');
  if(b.y-b.hw>1||b.y+b.hw<WALKUP_STAIRS.y0||b.x+b.hl<WALKUP_STAIRS.x1)bad.push('landing misses door wall or top tread');
  return bad.slice(0,12);
 });assert.deepEqual(r,[]);
}));
test('actual stair walking reaches a supported landing and real E takes the player to the roof and back onto it',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  clearWanted();const b=ARCH_BUILDINGS.find(b=>b.region==='brownstones'&&b.sh.kind===SHOP_APTS);if(!b)return {bad:['no native walk-up building']};
  enterRoom('walkup',{...b.sh,district:'brownstones',cell:[b.x0,b.y0],ret:[b.x0-.2,b.y0-.2,0]},[4.85,7.8,-Math.PI/2]);body.z=body.vz=body.mx=body.my=0;body.seat=null;
  for(let k=0;k<65;k++)move(0,-.1);a=-Math.PI/2;pitch=0;render(0);
  return{bad:[],free:free(px,py),y:py,rise:stairRise(px,py),eye,prompt:promptText(),landing:!!room.props.find(p=>p.walkupLanding)};
 });assert.deepEqual(r.bad,[]);assert.ok(r.free&&r.y<1.4&&r.landing&&r.rise===1&&Math.abs(r.eye-2.7)<1e-8,JSON.stringify(r));assert.match(r.prompt,/stairs to the roof/);
 await page.keyboard.press('e');assert.equal(await page.evaluate(()=>mode),'roof');await page.keyboard.press('e');
 const back=await page.evaluate(()=>{render(0);return{mode,kind:room.kind,free:free(px,py),rise:stairRise(px,py),y:py};});assert.deepEqual(back,{mode:'room',kind:'walkup',free:true,rise:1,y:1.7});
}));
test('the native stair view draws the physical landing instead of leaving its elevated walking surface invisible',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('walkup',{district:'brownstones',cell:[100,100],ret:[100,100,0]},[4.85,4.8,-Math.PI/2]);const landing=room.props.find(p=>p.walkupLanding);if(!landing)return ['no rendered landing'];
  const draw=drawBox,original=landing.draw;let active=false,count=0;landing.draw=(...a)=>{active=true;try{return original(...a);}finally{active=false;}};
  drawBox=(b,shade,ray)=>draw(b,active?(i,t,L)=>{const hit=shade(i,t,L);if(hit){count++;BG[i]=C(MAG,15);}return hit;}:shade,ray);
  try{pitch=0;render(0);pitch=(1-eye)/3*projY/rows;count=0;render(0);const visible=Array.from(BG).filter(c=>c===C(MAG,15)).length;return count>30&&visible>30?[]:[['landing absent from actual view',count,visible]];}finally{drawBox=draw;landing.draw=original;}
 });assert.deepEqual(r,[]);
}));

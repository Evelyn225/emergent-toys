'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run,viewport={width:1280,height:850}){const p=await browser.newPage({viewport}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{lockMouse=()=>{};paused=false;mode='walk';room=me=freecam=null;T=20;tod=14;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('UI scaling enlarges menus, persists and keeps the world projection unchanged',()=>fixture(async p=>{
 const before=await p.evaluate(()=>{openPause();return {FS,cols,rows,width:document.querySelector('#pause .panel')?.getBoundingClientRect().width};});
 await p.locator('[data-set="uiScale"]').fill('1.5');
 const after=await p.evaluate(()=>({FS,cols,rows,scale:uiScale(),width:document.querySelector('#pause .panel')?.getBoundingClientRect().width}));
 assert.equal(after.scale,1.5);assert.equal(after.FS,before.FS);assert.equal(after.cols,before.cols);assert.equal(after.rows,before.rows);assert.ok(after.width>before.width*1.4,JSON.stringify({before,after}));
 await p.reload();assert.equal(await p.evaluate(()=>uiScale()),1.5);
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{settings.uiScale=2;applySettings();openPause();});
 const box=await p.locator('#pause .panel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391&&box.y>=0&&box.height<=844,JSON.stringify(box));
},{width:2560,height:1440}));
test('smoke respects each depth layer, preserves facade lettering, and handles transparent palette cells',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const i=0;ZB[i]=1;ZBG[i]=4;BG[i]=C(ORANGE,6);set(i,'H',C(RED,15));FOGS[i]=FOGB[i]=8;
  const fg=COL[i],bg=BG[i];hazeCell(i,.7,'smoke',2);
  const split=COL[i]===fg&&BG[i]!==bg&&CH[i]==='H';
  const changed=BG[i];hazeCell(i,.9,'soot',5);const behind=BG[i]===changed&&COL[i]===fg;
  hazeCell(i,.7,'smoke',.5);return {split,behind,glyph:CH[i],foregroundChanged:COL[i]!==fg,transparent:hazeTint(NONE,C(WHITE,10),.5)===hazeTint(C(BLACK,0),C(WHITE,10),.5)};
 });assert.ok(r.split&&r.behind&&r.foregroundChanged&&r.transparent&&r.glyph==='H',JSON.stringify(r));
}));
test('sandwich panels converge at their hinge, are closed at their edges, and have a matching footprint',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[];
  for(const sign of [-1,1])for(const z of [.01,.05,.09]){
   const b={x:0,y:0,c:1,s:0,boardSign:sign};const t=rayShopBoard(0,sign*.2,z,0,-sign,0,b);
   out.push({sign,z,t,v:sign*(.2-t)});
  }
  const side=rayShopBoard(-.2,.025-.23*.05,.05,1,0,0,{x:0,y:0,c:1,s:0,boardSign:1});
  shopExteriorList();const solid=solids.find(o=>o.kind==='shopboard');
  return {out,side,solid:{hl:solid.hl,hw:solid.hw,z1:solid.z1}};
 });for(const o of r.out){assert.ok(o.t>0);assert.ok(Math.abs(Math.abs(o.v)-(.027-.23*o.z))<1e-6,JSON.stringify(o));}
 assert.ok(r.side>0);assert.deepEqual(r.solid,{hl:.03,hw:.027000000000000003,z1:.1});
}));
test('fog cannot generate bloom; real light attenuates through fog and sky does not glow',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  GLP_SOFT=true;GLP_OFF=false;GLP=null;POSTFX_OFF=false;settings.bloom=.8;settings.streaks=0;settings.fogRays=false;settings.eyeAdapt=false;settings.colorGrade=false;settings.grain=false;
  const sample=(colour,mist,depth)=>{
   CH.fill(' ');COL.fill(0);BG.fill(colour);ZB.fill(depth);ZBG.fill(depth);FOGS.fill(mist);FOGB.fill(mist);NOGLOW.fill(0);fogRGB=[210,215,220];present(true);
   const {gl,fx}=GLP;if(!fx||POSTFX_OFF)throw new Error('post FX failed');
   gl.bindFramebuffer(gl.FRAMEBUFFER,fx.p4.fb);const bytes=new Uint8Array(fx.p4.w*fx.p4.h*4);gl.readPixels(0,0,fx.p4.w,fx.p4.h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   let sum=0;for(let i=0;i<bytes.length;i+=4)sum+=bytes[i]+bytes[i+1]+bytes[i+2];return sum;
  };
  return {fog:sample(C(GRAY,0),15,4),light:sample(C(WHITE,15),0,1),dim:sample(C(WHITE,15),5,1),hidden:sample(C(WHITE,15),15,4),sky:sample(C(WHITE,15),0,Infinity)};
 });assert.equal(r.fog,0,JSON.stringify(r));assert.ok(r.light>r.dim&&r.dim>=r.hidden,JSON.stringify(r));assert.equal(r.hidden,0);assert.equal(r.sky,0);
}));
test('weed renders one seamless image and milk immediately stops its visual overlay',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  addDrugEffect('weed','fine');stepDrugEffects(3);let calls=0;const orig=g.drawImage;g.drawImage=function(...args){calls++;return orig.apply(this,args);};
  drawDrugVision();const weedCalls=calls;carryItem({id:'milk',uses:3});useHeld({});drawDrugVision();g.drawImage=orig;return {weedCalls,afterCalls:calls,trail:drugVisionTrailReady,art:!!DENSE.milk({id:'milk',uses:3},1)};
 });assert.equal(r.weedCalls,1);assert.equal(r.afterCalls,1);assert.equal(r.trail,false);assert.equal(r.art,true);
}));
test('hose water animates transparently and every rendered water surface is excluded from bloom',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  a=0;pitch=0;render(0);const from=[px+.15,py+.03,eye-.02],to=[px+1.2,py+.14,eye-.10];
  const capture=()=>{ZB.fill(Infinity);ZBG.fill(Infinity);BG.fill(C(ORANGE,4));NOGLOW.fill(0);drawWaterStream(from,to);return Array.from(ZB,(z,i)=>[z,i]).filter(([z])=>Number.isFinite(z)).map(([,i])=>({i,col:BG[i],noGlow:NOGLOW[i]}));};
  const first=capture();T+=.18;const second=capture();return {count:first.length,unlit:first.every(c=>c.noGlow===1),restored:drawNoGlow===0,moving:JSON.stringify(first)!==JSON.stringify(second),transparent:first.some(c=>(c.col>>4)!==WET&&(c.col>>4)!==WHITE)};
 });assert.ok(r.count>0&&r.unlit&&r.restored&&r.moving&&r.transparent,JSON.stringify(r));
}));

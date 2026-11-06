'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;mode='walk';room=me=freecam=null;T=10;});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
test('abandoned steel has stable rust, exposed metal, faded paint and damp feet; normal closed shops keep their clean materials and shutter parts',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedShutterStyle!=='function')return {missing:true};
  const shops=[...new Set(SHOP.filter(s=>s?.kind===SHOP_SHUT&&!s.wilderness))],styles=new Map();
  for(const sh of shops)if(!styles.has(abandonedShutterStyle(sh).kind))styles.set(abandonedShutterStyle(sh).kind,sh);
  const out=[];projY=100;WH.dn=.3;WH.sl=0;
  for(const[kind,sh]of styles){const clean={...sh,kind:SHOP_LIT},palette=new Set();let changed=0,bad=0,stable=true;
   const sample=(sh,u,v,d=.18)=>{const z=.3*v;eye=z;shopShutter(0,.4*u,z,0,.4,0,.3,sh,10,d,0);return {bg:BG[0],ch:CH[0]};};
   for(let y=1;y<32;y++)for(let x=2;x<50;x++){
    const a=sample(sh,x/52,y/34),b=sample(clean,x/52,y/34);palette.add(a.bg>>4);if(a.bg!==b.bg)changed++;if(a.ch!==' '||b.ch!==' ')bad++;
    T+=1;const c=sample(sh,x/52,y/34);if(a.bg!==c.bg)stable=false;
   }
   const lock=sample(sh,.5,.02),cleanLock=sample(clean,.5,.02),rail=sample(sh,.002,.5),cleanRail=sample(clean,.002,.5);
   out.push({kind,changed,palette:[...palette],rust:palette.has(BRICK),steel:palette.has(GRAY),damp:palette.has(GREEN),bad,stable,lock:lock.bg===cleanLock.bg,rail:rail.bg===cleanRail.bg});
  }
  return {out};
 });
 assert.equal(r.missing,undefined);assert.equal(r.out.length,3);
 for(const s of r.out){assert.ok(s.changed>300,JSON.stringify(s));assert.ok(s.rust&&s.steel&&s.damp,JSON.stringify(s));assert.equal(s.bad,0);assert.ok(s.stable&&s.lock&&s.rail,JSON.stringify(s));}
}));
test('real abandoned shopfronts visibly age in native renders and remain anonymous, shut and non-enterable',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedShutterTint!=='function')return {missing:true};
  const spots=[];
  for(let k=0;k<map.length&&spots.length<40;k++){const sh=SHOP[k],x=k%N,y=Math.floor(k/N);if(sh?.kind===SHOP_SHUT&&!sh.wilderness&&map[k]&&!map[idx(x,y+1)]&&free(x+.5,y+1.3))spots.push({x,y,sh});}
  const tint=abandonedShutterTint,paint=graffitiCell;let result;
  try{graffitiCell=()=>false;
   for(const s of spots){px=s.x+.5;py=s.y+1.28;a=-Math.PI/2;pitch=-.15;body.z=outdoorGroundHeight(px,py);body.vz=body.crouch=0;render(0);const aged=Int16Array.from(BG);
    abandonedShutterTint=(sh,a,z,a0,a1,z0,z1,L,d,col)=>col;render(0);abandonedShutterTint=tint;let changed=0;for(let i=0;i<BG.length;i++)if(BG[i]!==aged[i])changed++;
    if(changed>30){render(0);result={changed,prompt:promptText(),word:s.sh.word,open:openAt(s.sh,14),signed:ARCH_DETAILS.some(o=>o.kind==='fascia'&&SHOP[o.ownerCell]===s.sh),pos:[px,py]};break;}
   }
  }finally{abandonedShutterTint=tint;graffitiCell=paint;}
  return result||{missingView:true};
 });
 assert.equal(r.missing,undefined);assert.equal(r.missingView,undefined);assert.ok(r.changed>30);assert.equal(r.open,false);assert.equal(r.signed,false);assert.ok(!r.prompt.includes(r.word)&&!/LEASE|closed down/.test(r.prompt),JSON.stringify(r));
 await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>mode),'walk');
}));
test('closed-for-good street faces attract substantially more tags, including a valid palette in otherwise pristine districts',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const cells=[];for(let k=0;k<map.length&&cells.length<160;k++){const sh=SHOP[k],x=k%N,y=Math.floor(k/N);if(sh?.kind===SHOP_SHUT&&!sh.wilderness&&paintable(k)&&!map[idx(x,y+1)])cells.push([k,x,y,sh]);}
  let aged=0,normal=0,invalid=0;
  for(const[k,x,y,sh]of cells){const kind=sh.kind;try{streetTagCache.clear();aged+=(streetTags(k,x,y,'S')||[]).length;sh.kind=SHOP_LIT;streetTagCache.clear();normal+=(streetTags(k,x,y,'S')||[]).length;}finally{sh.kind=kind;}}
  const themes={...MURAL_THEMES};let belle=0;
  try{for(const key in MURAL_THEMES)MURAL_THEMES[key]=themes.belle;for(const[k,x,y]of cells){streetTagCache.clear();for(const t of streetTags(k,x,y,'S')||[]){belle++;if(!Number.isFinite(t.col)||!t.word||!(t.half>0))invalid++;}}}finally{Object.assign(MURAL_THEMES,themes);streetTagCache.clear();}
  return {faces:cells.length,aged,normal,belle,invalid};
 });
 assert.ok(r.faces>=60);assert.ok(r.aged>r.normal*2,JSON.stringify(r));assert.ok(r.belle>r.faces*.5,JSON.stringify(r));assert.equal(r.invalid,0);
}));

test('small flaking and run marks settle into a calm distant shutter colour',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedShutterTint!=='function')return {missing:true};
  const sh=SHOP.find(s=>s?.kind===SHOP_SHUT&&!s.wilderness),near=new Set(),far=new Set();projY=100;WH.dn=.3;
  for(let y=5;y<28;y++)for(let x=2;x<50;x++)for(const d of [.18,30]){
   const z=.3*y/34;eye=z;shopShutter(0,.4*x/52,z,0,.4,0,.3,sh,10,d,0);(d<1?near:far).add(BG[0]);
  }
  return {near:near.size,far:far.size};
 });
 assert.equal(r.missing,undefined);assert.ok(r.near>=4,JSON.stringify(r));assert.equal(r.far,1,JSON.stringify(r));
}));
test('older heavy shutter courses retain lit lips and recessed creases at a street-readable scale',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof abandonedShutterStyle!=='function')return {missing:true};
  const sh=SHOP.find(s=>s?.kind===SHOP_SHUT&&!s.wilderness),original=abandonedShutterStyle;
  const uniform={...original(sh),kind:0,dent:3,maps:Array.from({length:7},(_,j)=>new Uint8Array((64>>j)**2))};
  const sample=sh=>[.1,.5,.9].map(q=>{const z=.3-SHOP_SHUTTER.housing-SHOP_SHUTTER.slat*2*(8+q);eye=z;shopShutter(0,.2,z,0,.4,0,.3,sh,10,.7,0);return BG[0]&15;});
  projY=100;WH.dn=.3;
  try{abandonedShutterStyle=()=>uniform;return {aged:sample(sh),clean:sample({...sh,kind:SHOP_LIT})};}finally{abandonedShutterStyle=original;}
 });
 assert.equal(r.missing,undefined);assert.ok(r.aged[0]>r.aged[1]&&r.aged[1]>r.aged[2],JSON.stringify(r));assert.equal(new Set(r.clean).size,1);
}));

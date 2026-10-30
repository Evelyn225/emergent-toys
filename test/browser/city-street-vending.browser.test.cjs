'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('vending machines are built inside their footprint, with stock on shelves behind the glass only when you can see into them',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],seen={};
  // every part drawn for machine m seen from (front distance d, sideways e), in the machine's frame: a across (as you face it), v out of the front
  const parts=(m,d,e,sc=1)=>{const fx=-m.s*m.fs,fy=m.c*m.fs,ox=fx*d+m.c*e,oy=fy*d+m.s*e,out=[],draw=drawBox;
   drawBox=(box,shade,ray=rayBox)=>out.push({box,ray});try{drawVending(m,-ox,-oy,sc);}finally{drawBox=draw;}
   return out.map(({box,ray})=>{const x=box.x+ox,y=box.y+oy,u=x*m.c+y*m.s,v=-x*m.s+y*m.c;return {u:u*m.fs,v:v*m.fs,hl:box.hl,hw:box.hw,z0:box.z0,z1:box.z1,ray};});};
  for(const m of machines){if(seen[m.kind+m.c+m.fs])continue;seen[m.kind+m.c+m.fs]=1;
   for(const sc of [1,10]){const k=sc/10,HL=VM_HL*sc,HW=VM_HW*sc,H=VM_H*sc,eps=1e-9*sc;
    const near=parts(m,.15*sc,.03*sc,sc),far=parts(m,1.5*sc,0,sc),behind=parts(m,-.15*sc,0,sc);
    for(const q of near)if(Math.abs(q.u)+q.hl>HL+eps||Math.abs(q.v)+q.hw>HW+eps||q.z0<-eps||q.z1>H+eps)bad.push([m.kind,sc,'a part outside the footprint',+(q.u/k).toFixed(3),+(q.v/k).toFixed(3),+(q.z1/k).toFixed(3)]);
    const glass=VM.glass[0]*k,stock=near.filter(q=>q.v+q.hw<glass-eps&&q.v-q.hw>VM.back*k-eps&&q.z0>VM.z0*k+eps&&q.hl<.06*k&&q.ray!==rayBox||m.kind==='CIGARETTES'&&q.ray===rayBox&&Math.abs(q.hl-.024*k)<eps);
    const want={DRINKS:20,SNACKS:20,CIGARETTES:40}[m.kind];
    if(stock.length!==want)bad.push([m.kind,sc,'stock',stock.length]);
    const shelfTops=[...Array(VM.shelves)].map((_,r)=>(VM.z0+r*(VM.z1-VM.z0)/VM.shelves+.015)*k);
    for(const q of stock)if(!shelfTops.some(z=>Math.abs(q.z0-z)<eps))bad.push([m.kind,sc,'stock not standing on a shelf',+(q.z0/k).toFixed(3)]);
    if(far.length>=near.length-want||behind.length>=near.length-want)bad.push([m.kind,sc,'stock or controls drawn where they cannot be seen into',near.length,far.length,behind.length]);
    // the door's face is flush all round the window and the chute: nothing proud of it but the header and the controls
    const proud=near.filter(q=>q.v+q.hw>VM.door*k+eps);if(proud.some(q=>q.z0<VM.z1*k-eps&&q.u-q.hl<VM.a1*k-eps))bad.push([m.kind,sc,'something proud of the door beside the window']);
   }}
  return {bad:bad.slice(0,10),kinds:Object.keys(seen).length};
 });
 assert.deepEqual(r.bad,[]);
 assert.ok(r.kinds>=4,'machines of several kinds and facings were checked');
}));

test('the header and display have single letters at reading distance, and the glass is clear up close',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const m=machines.find(q=>q.kind==='DRINKS'),fx=-m.s*m.fs,fy=m.c*m.fs,bad=[];
  const look=(d,e)=>{px=m.x+fx*d+m.c*e;py=m.y+fy*d+m.s*e;a=Math.atan2(m.y-py,m.x-px);pitch=0;render(0);render(0);};
  const text=()=>{const out=[];for(let r=0;r<rows;r++){let s='';for(let c=0;c<cols;c++)s+=CH[r*cols+c]||' ';out.push(s);}return out.join('\n');};
  const sub=(w,word)=>{let j=0;for(const ch of w){j=word.indexOf(ch,j);if(j<0)return false;j++;}return true;}; // each letter once, in order
  look(.6,.3);const words=(text().match(/DR[A-Z]*/g)||[]);
  if(!words.length)bad.push('no header seen');if(words.some(w=>!sub(w,'DRINKS')))bad.push(['a doubled letter in the header',words]);
  look(.3,0);if(!/R *E *A *D *Y/.test(text()))bad.push('the display is unreadable up close');
  look(.14,0);const g=VM.glass,k=.1,[gx,gy]=[m.x+fx*(g[0]+g[1])/2*k,m.y+fy*(g[0]+g[1])/2*k],t=Math.hypot(gx-px,gy-py); // (from straight in front, most of the glass shows what's behind it)
  let clear=0,n=0;const draw=drawBox;drawBox=(box,shade,ray)=>{if(Math.abs(box.hw-(g[1]-g[0])/2*k)<1e-9&&Math.abs(box.z1-VM.z1*k)<1e-9)for(let q=0;q<40;q++){HIT.face=m.fs>0?3:4;HIT.u=(q/40-.5)*.5*k;HIT.v=0;HIT.w=(VM.z0+(VM.z1-VM.z0)*((q*7)%40)/40)*k;n++;if(shade(0,t,8)===false)clear++;}};
  try{drawVending(m,m.x-px,m.y-py);}finally{drawBox=draw;}if(!n||clear<n*.8)bad.push(['the glass is not clear up close',clear,n]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('fixed vending surfaces prepare once, stock builds only on a visible approach and its actual pieces do not overlap',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof vendingModel!=='function')return {bad:['no cached vending surfaces'],count:0};
  const bad=[],draw=drawBox;let count=0;
  const capture=(m,d,sc)=>{const a=[],fx=-m.s*m.fs,fy=m.c*m.fs;drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{drawVending(m,-fx*d,-fy*d,sc);}finally{drawBox=draw;}return a;};
  for(const kind of ['DRINKS','SNACKS','CIGARETTES'])for(const [c,s,fs]of [[1,0,1],[1,0,-1],[0,1,1],[0,1,-1]])for(const sc of [1,10]){
   const m={kind,c,s,fs},k=sc/10;
   capture(m,-.15*sc,sc);const model=vendingModel(m,sc);
   if(model.stockParts.length||model.controlParts.length)bad.push([kind,'back view built hidden detail']);
   capture(m,1.5*sc,sc);if(model.stockParts.length)bad.push([kind,'far view built stock']);
   const a=capture(m,.15*sc,sc),parts=model.stockParts.slice(),b=capture(m,.16*sc,sc);
   if(vendingModel(m,sc)!==model||model.stockParts.some((p,j)=>p!==parts[j])||a.length!==b.length)bad.push([kind,'model rebuilt']);
   a.forEach((p,j)=>{if(p.shade!==b[j].shade||p.box.profile!==b[j].box.profile||p.box.recesses!==b[j].box.recesses||p.box.handShape!==b[j].box.handShape)bad.push([kind,'fixed profile/material rebuilt']);});
   const goods=parts.filter(p=>p.box.z0>VM.z0*k+1e-9&&p.box.hl<.05*k&&p.box.hw<.05*k);
   const expected=kind==='CIGARETTES'?40:20;count+=goods.length;if(goods.length!==expected)bad.push([kind,'missing actual stock',goods.length]);
   const spans=goods.map(({box:B})=>{const u=(B.x*c+B.y*s)*fs,v=(-B.x*s+B.y*c)*fs;return[u-B.hl,u+B.hl,v-B.hw,v+B.hw,B.z0,B.z1];});
   for(let i=0;i<spans.length;i++)for(let j=i+1;j<spans.length;j++)if([0,2,4].every(k=>Math.min(spans[i][k+1],spans[j][k+1])-Math.max(spans[i][k],spans[j][k])>1e-9))bad.push([kind,'intersecting stock']);
  }return {bad:bad.slice(0,10),count};
 });assert.deepEqual(r.bad,[]);assert.equal(r.count,640);
}));

test('coin returns are real closed recesses in every facing and READY becomes scaled lettering up close',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof vendingModel!=='function')return ['missing built coin return'];
  const bad=[],draw=drawBox,word=worldText;projX=projY=10000;
  for(const [c,s,fs]of [[1,0,1],[1,0,-1],[0,1,1],[0,1,-1]])for(const sc of [1,10]){
   const k=sc/10,m={kind:'DRINKS',c,s,fs},model=vendingModel(m,sc),parts=[];drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});
   try{drawVending(m,s*fs*.15*sc,-c*fs*.15*sc,sc);}finally{drawBox=draw;}
   const pocket=model.baseParts.find(p=>p.ray===shopCabinetRay);if(!pocket){bad.push('coin cup is a painted solid');continue;}
   const hinge=model.baseParts.find(p=>p.box.vmRole==='flap-hinge'),flap=model.baseParts.find(p=>p.box.vmRole==='delivery-flap'),top=model.baseParts.find(p=>p.box.vmRole==='delivery-top');
   if(!hinge||!flap||!top||hinge.box.z0>flap.box.z1||hinge.box.z1<top.box.z0)bad.push('delivery flap floats below its frame');
   else {const B=hinge.box,t=hinge.ray(B.x,B.y,B.z1+.3*k,0,0,-1,B);if(t<0||HIT.nz<.99)bad.push('hinge not closed round geometry');}
   const B=pocket.box,cast=(du,dz)=>{const v=B.hw+.3*k;return pocket.ray(B.x-B.s*v,B.y+B.c*v,.56*k,B.c*du+B.s,B.s*du-B.c,dz,B);};
   const back=cast(0,0);if(back<.35*k||!HIT.cabinetInner||Math.abs(HIT.nx*(-B.s)+HIT.ny*B.c-1)>1e-8)bad.push('coin recess has no closed back/depth');
   cast(.12,0);if(Math.abs(HIT.nx*B.c+HIT.ny*B.s+1)>1e-8)bad.push('coin recess side missing');
   cast(0,-.12);if(HIT.nz<.99)bad.push('coin recess floor missing');cast(0,.12);if(HIT.nz>-.99)bad.push('coin recess roof missing');
   const display=parts.find(p=>Math.abs(p.box.z0-1.37*k)<1e-8&&Math.abs(p.box.z1-1.49*k)<1e-8);if(!display){bad.push('no READY panel');continue;}
   const calls=[];worldText=(...args)=>{if(args[0]==='READY')calls.push(args);return word(...args);};let ink=0;
   try{for(let x=0;x<20;x++)for(let z=0;z<5;z++){
    HIT.face=fs>0?3:4;HIT.u=((x+.5)/20-.5)*.16*k*fs;HIT.w=(1.4+(z+.5)*.06/5)*k;CH[0]='?';display.shade(0,.1*sc,8);if(CH[0]!==' '&&BLOCK_CELLS.includes(CH[0]))ink++;
   }}finally{worldText=word;}
   if(!calls.length||calls.some(a=>a[11]<.05*k||a[10]*5>.19*k+1e-8)||ink<4)bad.push('READY cannot scale inside its panel');
   HIT.face=fs>0?3:4;HIT.u=(.2-.5)*(VM.a1-VM.a0)*k*fs;HIT.w=(VM.z0+(VM.z1-VM.z0)*(.16/.9))*k;CH[0]='?';
   if(model.glassPart.shade(0,.05*sc,8)!==true||CH[0]!==' ')bad.push('glass glint is a repeated glyph');
  }return bad.slice(0,10);
 });assert.deepEqual(r,[]);
}));

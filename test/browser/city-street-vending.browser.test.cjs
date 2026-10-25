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
    const glass=VM.glass[0]*k,stock=near.filter(q=>q.v+q.hw<glass-eps&&q.v-q.hw>VM.back*k-eps&&q.z0>VM.z0*k+eps&&q.hl<.06*k&&q.ray!==rayBox||m.kind==='CIGARETTES'&&q.ray===rayBox&&Math.abs(q.hl-.027*k)<eps);
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

test('the header and the display letter one cell a letter, and the glass is clear up close',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const m=machines.find(q=>q.kind==='DRINKS'),fx=-m.s*m.fs,fy=m.c*m.fs,bad=[];
  const look=(d,e)=>{px=m.x+fx*d+m.c*e;py=m.y+fy*d+m.s*e;a=Math.atan2(m.y-py,m.x-px);pitch=0;render(0);render(0);};
  const text=()=>{const out=[];for(let r=0;r<rows;r++){let s='';for(let c=0;c<cols;c++)s+=CH[r*cols+c]||' ';out.push(s);}return out.join('\n');};
  const sub=(w,word)=>{let j=0;for(const ch of w){j=word.indexOf(ch,j);if(j<0)return false;j++;}return true;}; // each letter once, in order
  look(.6,.3);const words=(text().match(/DR[A-Z]*/g)||[]);
  if(!words.length)bad.push('no header seen');if(words.some(w=>!sub(w,'DRINKS')))bad.push(['a doubled letter in the header',words]);
  look(.14,0);if(!/R *E *A *D *Y/.test(text()))bad.push('the display is unreadable up close');
  const g=VM.glass,k=.1,[gx,gy]=[m.x+fx*(g[0]+g[1])/2*k,m.y+fy*(g[0]+g[1])/2*k],t=Math.hypot(gx-px,gy-py); // (from straight in front, most of the glass shows what's behind it)
  let clear=0,n=0;const draw=drawBox;drawBox=(box,shade,ray)=>{if(Math.abs(box.hw-(g[1]-g[0])/2*k)<1e-9&&Math.abs(box.z1-VM.z1*k)<1e-9)for(let q=0;q<40;q++){HIT.face=m.fs>0?3:4;HIT.u=(q/40-.5)*.5*k;HIT.v=0;HIT.w=(VM.z0+(VM.z1-VM.z0)*((q*7)%40)/40)*k;n++;if(shade(0,t,8)===false)clear++;}};
  try{drawVending(m,m.x-px,m.y-py);}finally{drawBox=draw;}if(!n||clear<n*.8)bad.push(['the glass is not clear up close',clear,n]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

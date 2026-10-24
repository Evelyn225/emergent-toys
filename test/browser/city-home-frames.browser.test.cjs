'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('photo-frame mitres close around an open recess, with ordered layers and pads meeting the wall and rails',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const part={id:'f_frame',key:1,x:0,y:0,z:1.6,a,photo:0},model=HOME_PHOTO_FRAME(part),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const c=Math.cos(a),s=Math.sin(a),at=(u,v)=>[c*u-s*v,s*u+c*v],role=n=>shapes.filter(q=>q.box.frameRole===n),rails=role('rail'),bad=[];
   const cast=(q,u,z,v=1,dir=-1)=>{const[x,y]=at(u,v);return q.ray(x,y,z,-s*dir,c*dir,0,q.box);};
   for(const q of rails)if(cast(q,0,1.6)>0)bad.push('blocked centre');
   for(const u of [-.37,.37])for(const z of [-.27,.27])for(const d of [-.002,0,.002]){
    const hits=rails.map(q=>cast(q,u+Math.sign(u)*d,1.6+z-Math.sign(z)*d)).filter(t=>t>0);
    if(!hits.length||Math.abs(Math.min(...hits)-.975)>1e-7)bad.push(['mitre',u,z,d,hits]);
   }
   const depths=['glass','print','mat','backing'].map(n=>cast(role(n)[0],.11,1.62));
   if(depths.some((t,k)=>!(t>0)||k&&t<=depths[k-1]))bad.push(['layers',depths]);
   const glass=role('glass')[0];const t=cast(glass,.11,1.62);if(t<0||glass.shade(0,t,8))bad.push('opaque glass');
   for(const q of role('wall-pad')){
    const u=q.box.x*c+q.box.y*s,z=(q.box.z0+q.box.z1)/2,t=cast(q,u,z,-1,1);
    if(!(t>0&&Math.abs(t-.965)<1e-7))bad.push(['wall',u,t]);
    const wood=rails.map(r=>cast(r,u,z,-1,1)).filter(t=>t>0);
    if(!wood.length||Math.abs(Math.min(...wood)-.976)>1e-7)bad.push(['pad/rail',u,wood]);
   }
   const b=model.box;
   for(const {box:q}of shapes){const u=q.x*c+q.y*s,v=-q.x*s+q.y*c,cc=q.c*c+q.s*s,ss=-q.c*s+q.s*c;
    if(Math.abs(u)+Math.abs(cc)*q.hl+Math.abs(ss)*q.hw>b.hl+1e-7||Math.abs(v)+Math.abs(ss)*q.hl+Math.abs(cc)*q.hw>b.hw+1e-7||q.z0<b.z0-1e-7||q.z1>b.z1+1e-7)bad.push(['bounds',q.frameRole]);
   }
   out.push({a,bad,rails:rails.length,pads:role('wall-pad').length,wires:role('hanging-wire').length});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.rails,4);assert.equal(q.pads,4);assert.equal(q.wires,2);}
}));

test('saved photographs retain their full image and orientation through every frame rotation and selection change',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];homePhotos={next:3,photos:[1,2].map(id=>({id,w:48,h:28,title:'test',chars:(id===1?'X':'Y').repeat(48*28),fg:new Array(48*28).fill(C(WHITE,12)),bg:Array.from({length:48*28},(_,k)=>C(id===2?GREEN:k%48<24?RED:BLUE,10))}))};
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const part={id:'f_frame',key:1,x:0,y:0,z:1.6,a,photo:1},model=HOME_PHOTO_FRAME(part),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const q=shapes.find(q=>q.box.frameRole==='print'),c=Math.cos(a),s=Math.sin(a),samples=[];
   function ink(u,w){const v=1,x=c*u-s*v,y=s*u+c*v,t=q.ray(x,y,w,s,-c,0,q.box);if(t<0)return null;q.shade(0,t,12);return [CH[0],BG[0]>>4];}
   for(const z of [1.6-model.photoFrame.printHeight+.001,1.6+model.photoFrame.printHeight-.001])for(const u of [-.309,.309])samples.push(ink(u,z));
   part.photo=2;drawBox=()=>{};try{model.draw(0,0);}finally{drawBox=draw;}const changed=ink(0,1.6);
   out.push({a,samples,changed});
  }return out;
 });for(const q of r){assert.deepEqual(q.samples,[['X',2],['X',3],['X',2],['X',3]],JSON.stringify(q));assert.deepEqual(q.changed,['Y',6]);}
}));

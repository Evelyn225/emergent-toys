'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=26;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('home ducks and snow globes have real flat support, joined parts, contained contents and cached geometry within their reserved footprint',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];px=py=0;a=Math.atan2(5,4);
  for(const id of ['duck','snowglobe'])for(const angle of [0,Math.PI/2,.7]){
   const p={it:{id},x:4,y:5,z:1.07,size:{radius:.08,height:.15},surface:{c:Math.cos(angle),s:Math.sin(angle)}},shapes=[],bad=[],R=p.size.radius,H=p.size.height,c=p.surface.c,s=p.surface.s;
   const capture=()=>{shapes.length=0;drawBox=(box,shade,ray)=>shapes.push({box,shade,ray});try{drawHomeKeepsake(p);}finally{drawBox=draw;}};capture();
   const part=role=>shapes.find(q=>q.box.keepsakeRole===role),at=(u,v)=>[4+R*(c*u-s*v),5+R*(s*u+c*v)];
   const cast=(q,u,v,z,du,dv,dz)=>q.ray(...at(u,v),p.z+z*H,(c*du-s*dv)*R,(s*du+c*dv)*R,dz*H,q.box),same=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-6;
   const base=part(id==='duck'?'body':'base');if(!same(cast(base,0,0,-1,0,0,1),1))bad.push('floating base');
   for(const q of shapes){const b=q.box,du=(b.x-4)*c+(b.y-5)*s,dv=-(b.x-4)*s+(b.y-5)*c;
    if(Math.abs(du)+b.hl>R+1e-7||Math.abs(dv)+b.hw>R+1e-7||b.z0<p.z-1e-7||b.z1>p.z+H+1e-7)bad.push(['bounds',b.keepsakeRole]);
   }
   if(id==='duck'){
    const head=part('head'),body=part('body'),beak=part('beak');
    const headLow=-1+cast(head,0,.35,-1,0,0,1),bodyHigh=2-cast(body,0,.35,2,0,0,-1);
    if(!(bodyHigh>headLow))bad.push('head detached');
    const headFront=2-cast(head,0,2,.68,0,-1,0),beakRear=-1+cast(beak,0,-1,.68,0,1,0);
    if(!(headFront>beakRear))bad.push('beak detached');
    for(const eye of shapes.filter(q=>q.box.keepsakeRole==='eye')){const u=((eye.box.x-4)*c+(eye.box.y-5)*s)/R;
     const rear=-1+cast(eye,u,-1,.82,0,1,0),face=2-cast(head,u,2,.82,0,-1,0);if(!(face>rear))bad.push('eye detached');}
    cast(head,0,2,.72,0,-1,0);if(Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-6)bad.push('head normal');head.shade(0,.5,0);if((BG[0]&15)>7)bad.push('duck glows');
   }else{
    const glass=part('glass'),tree=part('tree'),trunk=part('trunk'),floor=part('snow-floor');
    const crown=2-cast(glass,0,0,2,0,0,-1),inside=.5+cast(glass,0,0,.5,0,0,1);
    if(!same(crown,1)||!same(inside,.97))bad.push('glass thickness');
    const state=homeKeepsakeModel(p.it,p.size).state,oldEye=eye,oldX=state.x,oldY=state.y;
    try{state.x=0;state.y=-.3;eye=p.z+H*.5;
     const t=glass.ray(4,5+.3,eye,0,-1,0,glass.box);
     if(!(t>0)||glass.shade(0,t,8)!==false)bad.push('opaque central glass');
    }finally{eye=oldEye;state.x=oldX;state.y=oldY;}
    for(const [z,r]of tree.box.profile){const h=(z-p.z)/H,t=cast(glass,0,0,h,1,0,0);if(!(t*R>=r-1e-6))bad.push('tree outside glass');}
    if(!same(trunk.box.z0,floor.box.z1)||!(trunk.box.z1>tree.box.z0)||!same(floor.box.z0,base.box.z1))bad.push('unsupported globe contents');
   }
   const model=homeKeepsakeModel(p.it,p.size),profiles=model.parts.map(q=>q.placedProfile);capture();
   if(homeKeepsakeModel(p.it,p.size)!==model||profiles.some((q,k)=>q!==model.parts[k].placedProfile))bad.push('rebuild in frame');
   out.push({id,bad,count:shapes.length});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],q.id);assert.ok(q.count>=5,q.id);}
}));

test('displayed duck and snow globe render on actual home shelf boards and the duck can be taken with E',()=>fixture(async p=>{
 const state=await p.evaluate(()=>{
  money=30000;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();
  const s=homeShelfSurfaces().find(q=>q.z>1),target={surface:s,u:0};
  inv.push({id:'duck'},{id:'snowglobe'});const a1=homeShelfStore(inv.findIndex(q=>q.id==='duck'),target),a2=homeShelfStore(inv.findIndex(q=>q.id==='snowglobe'),target);
  const placed=homeShelfLayout(),duck=placed.find(q=>q.it.id==='duck');px=duck.x-s.s*.7;py=duck.y+s.c*.7;a=Math.atan2(duck.y-py,duck.x-px);freecam=null;env(0);render(0);pitch=(duck.z+duck.size.height*.5-interactionEye())/.7*projY/rows;render(0);
  const draw=drawBox,roles=[];drawBox=(b,shade,ray)=>{if(b.keepsakeRole)roles.push(b.keepsakeRole);return draw(b,shade,ray);};try{render(0);}finally{drawBox=draw;}
  return{stored:[a1[0],a2[0]],roles,kind:interactionFocus()?.kind,item:interactionFocus()?.data?.it?.id,prompt:promptText()};
 });assert.deepEqual(state.stored,[true,true]);assert.ok(state.roles.includes('head')&&state.roles.includes('glass'));assert.equal(state.kind,'home-display');assert.match(state.prompt,/take.*rubber duck/i);
 await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>inv.some(q=>q.id==='duck')&&!homeRecord().decor.some(q=>q.id==='duck')&&homeRecord().decor.some(q=>q.id==='snowglobe')));
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('home shades are hollow shells around visible solid bulbs, with joined mounts, sockets and supports',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;projX=10000;
  for(const kind of ['floor','pendant']){
   const model=homeLampModel(0,0,kind,3,()=>true),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const d=model.lightFitting,part=role=>shapes.find(q=>q.box.profile===d.parts.find(p=>p.role===role)?.box.profile),shade=part('shade'),bulb=part('bulb'),socket=part('socket'),stem=part(kind==='floor'?'stem':'cord'),mount=part(kind==='floor'?'base':'mount');
   const cast=(q,x,y,z,rx,ry,rz)=>q.ray(x,y,z,rx,ry,rz,q.box);
   const axis=cast(shade,0,0,shade.box.z0-.1,0,0,1),z=shade.box.z0+(kind==='floor'?.2:.1);
   const outer=cast(shade,.5,0,z,-1,0,0),outerNormal=HIT.nx,inner=cast(shade,0,0,z,1,0,0),innerNormal=HIT.nx;
   const thickness=.5-outer-inner;
   const bottom=kind==='floor'?1.1:2,rx=kind==='floor'?-.2:0,ry=kind==='floor'?-.1:0,rz=kind==='floor'?.465:.39;
   const bx=kind==='floor'?.2:0,by=kind==='floor'?.1:0,glass=cast(bulb,bx,by,bottom,rx,ry,rz),cover=cast(shade,bx,by,bottom,rx,ry,rz);
   const top=q=>q.box.z1,base=q=>q.box.z0;
   const joined=kind==='floor'?Math.abs(top(mount)-base(stem))<1e-9&&Math.abs(top(stem)-base(socket))<1e-9&&Math.abs(top(socket)-base(bulb))<1e-9:
    Math.abs(top(mount)-3)<1e-9&&Math.abs(base(mount)-top(stem))<1e-9&&Math.abs(base(stem)-top(socket))<1e-9&&Math.abs(base(socket)-top(bulb))<1e-9;
   const spokes=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.az>1.4),attached=spokes.every(q=>{
    const b=q.box,endpoint=(x,y,z,which)=>{
     const r=Math.hypot(x,y),rr=r+.02,t=which.ray(x/r*rr,y/r*rr,z,-x/r,-y/r,0,which.box);
     return t>0&&t<.02+b.r+1e-7;
    };
    return endpoint(b.ax,b.ay,b.az,socket)&&endpoint(b.bx,b.by,b.bz,shade);
   });
   const bounds=shapes.every(({box:b})=>Math.abs(b.x)+b.hl<=model.box.hl+1e-6&&Math.abs(b.y)+b.hw<=model.box.hw+1e-6&&b.z0>=model.box.z0-1e-6&&b.z1<=model.box.z1+1e-6);
   out.push({kind,axis,thickness,outerNormal,innerNormal,glass,cover,joined,attached,spokes:spokes.length,bounds});
  }return out;
 });
 for(const q of r){assert.equal(q.axis,-1,q.kind);assert.ok(q.thickness>.008&&q.thickness<.02,JSON.stringify(q));assert.ok(q.outerNormal>0&&q.innerNormal<0);assert.ok(q.glass>0&&(q.cover<0||q.glass<q.cover),JSON.stringify(q));assert.ok(q.joined&&q.attached&&q.bounds,JSON.stringify(q));assert.ok(q.spokes>=3);}
}));

test('only bulbs and shade linings emit light; fitted pendants remain above home walking routes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;let on=true;projX=10000;
  for(const kind of ['floor','pendant']){
   const model=homeLampModel(0,0,kind,3,()=>on),shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const colors=lit=>{on=lit;drawBox=()=>{};try{model.draw(0,0);}finally{drawBox=draw;}return model.lightFitting.parts.map(part=>{
    const q=shapes.find(q=>q.box.profile===part.box.profile),z=(q.box.z0+q.box.z1)/2,t=q.ray(1,0,z,-1,0,0,q.box);
    if(t<0)return [part.role,-1];q.shade(0,t,3);return [part.role,BG[0]];
   });};
   out.push({kind,on:colors(true),off:colors(false)});
  }
  const homes=[];
  for(const kind of ['home','loft','bellehome','islandhome']){
   enterRoom(kind,{word:'HOME',ret:[100,100,0]},[3,4,0]);const lights=room.props.filter(p=>p.lightFitting);
   homes.push({kind,count:lights.length,bad:lights.some(p=>p.lightFitting.kind!=='pendant'||Math.abs(p.box.z1-room.def.height)>1e-9||p.box.z0<2||!p.walk)});
  }
  return{out,homes};
 });
 for(const q of r.out){const a=Object.fromEntries(q.on),b=Object.fromEntries(q.off);assert.ok((a.bulb&15)>(b.bulb&15)+7,JSON.stringify(q));for(const role of ['socket',q.kind==='floor'?'stem':'cord',q.kind==='floor'?'base':'mount'])assert.equal(a[role],b[role],role);if(q.kind==='pendant')assert.equal(a.shade,b.shade,'outer enamel stays unlit');}
 for(const q of r.homes){assert.ok(q.count>=2,JSON.stringify(q));assert.equal(q.bad,false,JSON.stringify(q));}
}));

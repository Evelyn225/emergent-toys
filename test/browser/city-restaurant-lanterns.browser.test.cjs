'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('restaurant paper shells are open thin solids; their hoops, socket, bulb, cord and ceiling mount join inside the actual bounds',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];
  for(const options of [{},{top:2.4,height:.36,radius:.15},{ceiling:3.6}]){
   const model=PAPER_LANTERN(0,0,options),spec=model.paperLantern,shapes=[],bad=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const one=role=>shapes.find(q=>q.box.lanternRole===role),cast=(q,x,y,z,rx,ry,rz)=>q.ray(x,y,z,rx,ry,rz,q.box),same=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
   const shell=one('paper'),middle=(spec.base+spec.top)/2;
   if(cast(shell,0,0,spec.base-.5,0,0,1)>0||cast(shell,0,0,spec.top+.5,0,0,-1)>0)bad.push('closed paper aperture');
   const outer=.5-cast(shell,.5,0,middle,-1,0,0),inner=cast(shell,0,0,middle,1,0,0);
   if(!same(outer-inner,spec.thickness))bad.push(['paper thickness',outer,inner]);
   if(![HIT.nx,HIT.ny,HIT.nz].every(Number.isFinite)||!same(Math.hypot(HIT.nx,HIT.ny,HIT.nz),1))bad.push('paper normal');
   const bulb=one('bulb'),socket=one('socket'),cord=one('cord'),mount=one('mount');
   const top=q=>spec.ceiling+.5-cast(q,0,0,spec.ceiling+.5,0,0,-1),bottom=q=>spec.base-.5+cast(q,0,0,spec.base-.5,0,0,1);
   if(!same(top(bulb),bottom(socket))||!same(top(cord),bottom(mount))||!same(top(mount),spec.ceiling))bad.push('axial fixture joins');
   for(const role of ['upper-hoop','lower-hoop']){
    const hoop=one(role),z=role==='upper-hoop'?spec.top-.005:spec.base+.005;
    const hole=cast(hoop,0,0,z,1,0,0),paper=cast(shell,0,0,z,1,0,0);
    if(!(hole>0&&paper>hole&&paper<spec.radius*.55+.007))bad.push(['hoop/paper',role]);
   }
   const bars=shapes.filter(q=>q.box.lanternRole==='crossbar');
   for(const q of bars){const b=q.box;
    if(Math.hypot(b.ax,b.ay)+b.r<=spec.radius*.55-.004||Math.hypot(b.bx,b.by)+b.r<=spec.radius*.55-.004||!same(b.az,socket.box.z1)||!same(b.az,cord.box.z0))bad.push('crossbar/socket/hoop');
   }
   for(const {box:b}of shapes)if(Math.abs(b.x)+b.hl>model.box.hl+1e-7||Math.abs(b.y)+b.hw>model.box.hw+1e-7||b.z0<model.box.z0-1e-7||b.z1>model.box.z1+1e-7)bad.push(['bounds',b.lanternRole]);
   cast(one('upper-hoop'),spec.radius*.55,0,spec.top+.5,0,0,-1);one('upper-hoop').shade(0,1,0);const metal=BG[0]&15;
   cast(bulb,.5,0,bulb.box.z0+.03,-1,0,0);bulb.shade(0,1,0);const light=BG[0]&15;
   if(!(metal<3&&light>10))bad.push('emissive hardware');
   out.push({bad,bars:bars.length,headroom:model.box.z0,walk:model.walk});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.bars,2);assert.ok(q.headroom>1.85&&q.walk);}
}));

test('yakitori, izakaya and sushi hang fitted lanterns from their actual ceilings without blocking the floor',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[];
  for(const [kind,count]of [['yakitori',2],['izakaya',2],['sushibar',4]]){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},[5,5,-Math.PI/2]);const fixtures=room.props.filter(p=>p.paperLantern);
   const before=fixtures.map(q=>free(q.x,q.y));room.props=room.props.filter(q=>!q.paperLantern);const without=fixtures.map(q=>free(q.x,q.y));room.props.push(...fixtures);env(0);render(0);
   out.push({kind,count,actual:fixtures.length,ceiling:fixtures.every(q=>Math.abs(q.box.z1-(room.def.height||3))<1e-7),before,without});
  }return out;
 });for(const q of r){assert.equal(q.actual,q.count,q.kind);assert.ok(q.ceiling,q.kind);assert.deepEqual(q.before,q.without,q.kind);}
}));

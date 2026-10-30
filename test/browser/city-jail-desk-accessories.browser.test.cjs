'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('jail',{word:'JAIL',until:T+60,ret:[100,100,0]},[11,3.2,Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('jail monitor and coffee have cached supported closed frames, recessed screen, hollow cup and an open welded handle',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],monitor=room.props.find(p=>p.jailCCTV),cup=room.props.find(p=>p.jailCoffee),draw=drawBox;if(!monitor||!cup)return{bad:['missing accessories'],checked:0};
  const capture=o=>{const A=[];drawBox=(b,shade,ray=rayBox)=>A.push({b:{...b},ref:b,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return A;};let checked=0;
  for(const o of [monitor,cup]){
   const A=capture(o),B=capture(o),m=o.jailCCTV||o.jailCoffee,role=q=>m.parts.find(p=>p.view===q.ref)?.role,one=r=>A.find(q=>role(q)===r),bottom=q=>q.ray(q.b.x,q.b.y,-1,0,0,1,q.b)-1,top=q=>2-q.ray(q.b.x,q.b.y,2,0,0,-1,q.b);
   if(A.length!==(o===monitor?9:3))return{bad:['missing physical components'],checked};
   for(let k=0;k<A.length;k++){checked++;if(A[k].ref!==B[k].ref||A[k].shade!==B[k].shade||A[k].ray!==B[k].ray)bad.push('rebuilt accessories');}
   if(o===monitor){
    const foot=one('foot'),stem=one('stem'),back=one('back'),screen=one('screen'),bottomBar=one('bezel-bottom'),topBar=one('bezel-top'),sides=A.filter(q=>role(q)==='bezel-side'),power=one('power');
    for(const q of A)if(Math.abs(top(q)-q.b.z1)>1e-8||Math.abs(bottom(q)-q.b.z0)>1e-8)bad.push('open monitor caps');
    if(Math.abs(bottom(foot)-.8)>1e-8||Math.abs(top(foot)-bottom(stem))>1e-8||top(stem)<bottom(bottomBar)||bottom(stem)>top(bottomBar))bad.push('floating stand/housing');
    if(sides.length!==2||sides.some(q=>q.b.z0!==bottomBar.b.z1||q.b.z1!==topBar.b.z0)||Math.abs(sides[0].b.y+sides[0].b.hw-(screen.b.y-screen.b.hw))>1e-8||Math.abs(sides[1].b.y-sides[1].b.hw-(screen.b.y+screen.b.hw))>1e-8||screen.b.z0!==bottomBar.b.z1||screen.b.z1!==topBar.b.z0)bad.push('unjoined bezel/screen');
    if(Math.abs(screen.b.x+screen.b.hl-(back.b.x-back.b.hl))>1e-8||screen.b.x-screen.b.hl<=bottomBar.b.x-bottomBar.b.hl+.004||Math.abs(power.b.x+power.b.hl-(bottomBar.b.x-bottomBar.b.hl))>1e-8)bad.push('screen not recessed/backed or unmounted button');
    if(o.box.z0!==.8||o.box.z1!==1.18||o.box.hl!==.085||o.box.hw!==.18||o.walk)bad.push('monitor collider mismatch');
   }else{
    const vessel=one('cup'),coffee=one('coffee'),handle=one('handle'),b=vessel.b;
    if(Math.abs(bottom(vessel)-.8)>1e-8||Math.abs(top(vessel)-.812)>1e-8||Math.abs(top(coffee)-.897)>1e-8)bad.push('floating cup, filled hollow or floating coffee');
    const lip=2-vessel.ray(o.x+.049,o.y,2,0,0,-1,b);if(Math.abs(lip-.92)>1e-8)bad.push('open rim');
    if(A.some(q=>q.ray(o.x-.2,o.y+.08,.865,1,0,0,q.b)>0))bad.push('handle hole filled');
    const h=handle.ray(o.x-.2,o.y+.108,.865,1,0,0,handle.b),hb=handle.ray(o.x+.2,o.y+.108,.865,-1,0,0,handle.b);if(Math.abs(h-.193)>1e-8||Math.abs(hb-.193)>1e-8)bad.push('handle not closed');
    const left=handle.b.y-handle.b.hl;if(left-o.y<.046||left-o.y>.052)bad.push('handle floats or enters hollow');
    const near=vessel.ray(o.x-.2,o.y+.05,.865,1,0,0,b),far=vessel.ray(o.x+.2,o.y+.05,.865,-1,0,0,b);if(!(near>0&&near<.193&&far>0&&far<.193))bad.push('handle not welded into vessel');
    if(o.box||Math.abs(coffee.b.hl-.046)>1e-8)bad.push('new coffee collider or fill gap');
   }
  }
  if(room.props.some(p=>p.art&&p.x===19.6&&p.y===8.2||p.box?.x===19.6&&p.box.y===7.3&&p.box.hl===.18&&p.box.hw===.15))bad.push('legacy accessories retained');
  return{bad,checked};
 });assert.equal(r.checked,12);assert.deepEqual(r.bad,[]);
}));
test('native CCTV screen follows the actual guard while its frame stays unlit and dev freecam holds the prisoner in place',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(p=>p.jailCCTV),parts=o.jailCCTV.parts,front=parts.find(p=>p.role==='screen'),before=[px,py],guard=o.jailCCTV.guard,t=T;
  toggleFreecam();Object.assign(freecam,{x:18.8,y:7.3,z:1.03,yaw:0,pitch:0});
  const maps=[];for(const time of [0,17]){
   T=time;guard.tick(guard);const shade=front.shade,hits=new Map();front.shade=(i,t,L)=>{const ok=shade(i,t,L);hits.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;};
   try{renderFreecam();}finally{front.shade=shade;}
   maps.push(new Map([...hits].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col).map(([i,q])=>[i,q.bg])));
  }
  T=t;guard.tick(guard);if(maps.some(m=>m.size<50)||[...maps[0]].filter(([i,c])=>maps[1].has(i)&&maps[1].get(i)!==c).length<3)bad.push('screen absent or does not track guard');
  const screen=front.shade;HIT.face=2;HIT.v=0;HIT.w=1.03;screen(0,1,0);const lit=BG[0];screen(0,1,15);if(BG[0]!==lit)bad.push('screen emission follows room light');
  HIT.face=1;screen(0,1,0);const rear=BG[0];screen(0,1,15);if(BG[0]===rear||BG[0]>>4===GREEN)bad.push('screen rear glows');
  for(const p of parts.filter(p=>!['screen','power'].includes(p.role))){HIT.nx=-1;HIT.ny=HIT.nz=0;p.shade(0,1,0);const dark=BG[0];p.shade(0,1,15);if(BG[0]===dark||BG[0]>>4===GREEN)bad.push('housing emits');}
  return{bad,held:px===before[0]&&py===before[1]&&room.def.block===jailBlock,guardSame:o.jailCCTV.guard===guard};
 });assert.deepEqual(r.bad,[]);assert.ok(r.held&&r.guardSame);
}));
test('native coffee view shows the hollow rim, actual coffee and open handle with cached geometry',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(p=>p.jailCoffee),parts=o.jailCoffee.parts,before=[px,py],out=[];toggleFreecam();
  for(const role of ['cup','coffee','handle']){
   Object.assign(freecam,{x:19.24,y:8.25,z:1.08,yaw:Math.atan2(8.2-8.25,19.6-19.24),pitch:(.87-1.08)/Math.hypot(.36,.05)*projY/rows});
   const part=parts.find(p=>p.role===role),shade=part.shade,hits=new Map();part.shade=(i,t,L)=>{const ok=shade(i,t,L);hits.set(i,{t,bg:BG[i],ch:CH[i],col:COL[i]});return ok;};try{renderFreecam();}finally{part.shade=shade;}
   const count=[...hits].filter(([i,q])=>Math.abs(ZB[i]-q.t)<1e-5&&BG[i]===q.bg&&CH[i]===q.ch&&COL[i]===q.col).length;out.push({role,count});
  }
  freecam=null;return{out,held:px===before[0]&&py===before[1],bad};
 });assert.deepEqual(r.bad,[]);assert.ok(r.held&&r.out.every(q=>q.count>=3),JSON.stringify(r));
}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
const frames=(p,n,keys={})=>p.evaluate(([n,keys])=>{for(const k in keys)K[k]=keys[k];for(let j=0;j<n;j++){T+=1/60;drive(1/60);}for(const k in keys)K[k]=0;return {v:me?.v,a,mode};},[n,keys]);
test('the ambulance, fire engine and police car outside their stations can be taken with E, drive with their own handling, run lights and siren on H, and go home when left',()=>fixture(async p=>{
 for(const kind of ['amb','fire','police']){
  const r=await p.evaluate(kind=>{clearWanted();reports.length=0;devFree();mode='walk';me=null;const b=SERVICES.find(s=>s.kind===kind&&!s.out);px=b.x+.35;py=b.y;a=Math.PI;
   const prompt=promptText(),before=cars.length;interact();return {prompt,taken:mode==='drive'&&me?.ev&&me.kind===kind&&me.mine&&b.out,added:cars.length-before,reported:reports.length>0||wanted.stars>0,stillStatic:parkedCarAt(b.x,b.y,0)&&!cars.some(c=>c.parked&&c.kind===kind&&near(c.x,c.y,b.x,b.y)<.1)};},kind);
  assert.match(r.prompt,new RegExp('E: take the '+{amb:'ambulance',fire:'fire engine',police:'police car'}[kind]));
  assert.ok(r.taken&&r.added>=1&&r.reported,kind+' '+JSON.stringify(r));
  // pickup from rest: one second on the gas
  await frames(p,60,{KeyW:1});
  const siren=await p.evaluate(()=>{const was=code(me);onkeydown({code:'KeyH',preventDefault(){}});const on=code(me),hint=promptText();onkeydown({code:'KeyH',preventDefault(){}});return {was,on,off:code(me),hint};});
  assert.ok(!siren.was&&siren.on&&!siren.off&&/H: lights/.test(siren.hint),kind+' siren '+JSON.stringify(siren));
  await p.evaluate(kind=>{window['__v_'+kind]=me.v;},kind);
  // leave it, walk far off: it's back at its station
  const home=await p.evaluate(()=>{const c=me,b=c.stolenFrom;me.v=0;leaveCar();px+=60;stepTraffic(.1,T);return {gone:!cars.includes(c),back:!b.out};});
  assert.ok(home.gone&&home.back,kind+' home '+JSON.stringify(home));
 }
 const v=await p.evaluate(()=>[__v_amb,__v_fire,__v_police]);
 assert.ok(v[0]>v[2]&&v[2]>v[1],'pickup off the line: ambulance > police car > fire engine '+JSON.stringify(v));
 const tops=await p.evaluate(()=>['amb','fire','police'].map(k=>EV_HANDLING[k].top));assert.ok(tops[2]>tops[0]&&tops[0]>tops[1],'top speed: police > ambulance > fire engine');
 const turn=await p.evaluate(()=>[EV_HANDLING.amb.steer,EV_HANDLING.fire.steer,EV_HANDLING.police.steer]);assert.ok(turn[1]<turn[0]&&turn[0]<1&&turn[2]>1);
}));

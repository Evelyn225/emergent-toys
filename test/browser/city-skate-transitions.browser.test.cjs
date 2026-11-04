'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('mini ramp renders its true profile and coping; an air re-enters the real park ramp',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=null;T=100;third=false;clearInventory();carryItem({id:'skateboard',uses:0});fx.skating=true;
   const o=SK_TRANSITIONS[0],p=o.profile,bad=[];
   // Downward rays across both quarters and the flat must agree with the
   // analytic riding profile within the chord error bound, including near the lip.
   for(let i=1;i<50;i++){
    const x=-p.tip+2*p.tip*i/50,want=skateProfileHeight(o,x);
    const chordBound=p.radius*(1-Math.cos(p.angle/32))/Math.max(.1,Math.cos(p.angle))+1e-6;
    const t=rayProfile(o.x+x,o.y,1,0,0,-1,o);
    if(t<0||Math.abs(1-t-want)>chordBound)bad.push([x,t,want]);
   }
   const tube=rayProfile(o.x+p.tip,o.y,1,0,0,-1,o),coping=HIT.face;
   px=o.x;py=o.y;a=0;SK.v=.65;SK.dir=0;SK.lastT=T;SK.grind=SK.transition=null;SK.bail=0;body.z=body.vz=0;body.trick=null;
   let air=false,returned=false,peak=0;
   for(let i=0;i<240;i++){
    T+=1/60;stepSkate(1/60);stepBody(1/60);
    peak=Math.max(peak,SKB.p[2]-o.z0);if(SKB.contact==='air')air=true;
    if(air&&SK.transition?.o===o)returned=true;
   }
   // Render from the real skate camera: this also checks the profile metadata
   // survives the camera-relative box wrapper in city-sprites.js.
   third=true;tod=13;env(0);const saved=[px,py,a],[x,y,yaw,z]=skateCam(.1);
   skateView={x:px,y:py,a,eye:z};px=x;py=y;a=yaw;render(.1);[px,py,a]=saved;skateView=null;
   return{bad,tube,coping,air,returned,peak,bail:SK.bail};
  });
  assert.deepEqual(r.bad,[]);assert.ok(r.tube>0);assert.equal(r.coping,9);
  assert.ok(r.air&&r.returned&&r.peak>.18,JSON.stringify(r));assert.ok(r.bail<=0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

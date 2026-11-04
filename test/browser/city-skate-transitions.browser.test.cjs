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
   const bounds=o=>{const x=Math.abs(o.c)*o.hl+Math.abs(o.s)*o.hw,y=Math.abs(o.s)*o.hl+Math.abs(o.c)*o.hw;return[o.x-x,o.x+x,o.y-y,o.y+y];};
   for(const ramp of SK_TRANSITIONS)for(const other of SKATE_FEATURES){
    if(ramp===other)continue;const a=bounds(ramp),b=bounds(other);
    if(a[0]<b[1]&&a[1]>b[0]&&a[2]<b[3]&&a[3]>b[2])bad.push(['overlapping features',ramp.x,ramp.y,other.kind,other.x,other.y]);
   }
   // Downward rays across both quarters and the flat must agree with the
   // analytic riding profile within the chord error bound, including near the lip.
   for(let i=1;i<50;i++){
    const x=-p.tip+2*p.tip*i/50,want=skateProfileHeight(o,x);
    const chordBound=p.radius*(1-Math.cos(p.angle/32))/Math.max(.1,Math.cos(p.angle))+1e-6;
    const t=rayProfile(o.x+x,o.y,1,0,0,-1,o);
    if(t<0||Math.abs(1-t-want)>chordBound)bad.push([x,t,want]);
   }
   const tube=rayProfile(o.x+p.tip,o.y,1,0,0,-1,o),coping=HIT.face;
   const bowl=SK_TRANSITIONS.find(o=>o.bowl),vert=SK_TRANSITIONS.find(o=>o.profile.extension);
   for(let j=0;j<8;j++)for(const radius of [.1,.3,.38,.41]){
    const angle=j/8*Math.PI*2,x=bowl.x+Math.cos(angle)*radius,y=bowl.y+Math.sin(angle)*radius;
    const t=rayBowlProfile(x,y,1,0,0,-1,bowl),want=skateProfileHeight(bowl,radius);
    if(t<0||Math.abs(1-t-want)>.0008)bad.push(['bowl',radius,angle,t,want]);
   }
   const wall=rayProfile(vert.x,vert.y,vert.z0+.33,1,0,0,vert),wallNormal=HIT.nz;
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
   return{bad,tube,coping,air,returned,peak,bail:SK.bail,wall,wallNormal};
  });
  assert.deepEqual(r.bad,[]);assert.ok(r.tube>0);assert.equal(r.coping,9);
  assert.ok(r.wall>0&&Math.abs(r.wallNormal)<1e-6,'vertical extension has a horizontal normal');
  assert.ok(r.air&&r.returned&&r.peak>.18,JSON.stringify(r));assert.ok(r.bail<=0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

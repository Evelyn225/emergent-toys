'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('skater is anchored by shoe geometry and a bowl pop preserves pitch and bank',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const result=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;T=100;clearInventory();carryItem({id:'skateboard',uses:0});fx.skating=true;held=0;third=true;
   const look=skaterLook(),bad=[];
   for(const key of ['ride0','ride1','ride2','crouch','skateair','push2','mongo2']){
    const shoes=figBody(look,key).parts.filter(p=>p.k===1&&p.role({l:[0,0,0],s:0})===FR.SHOE);
    if(shoes.length!==2){bad.push(['shoes',key,shoes.length]);continue;}
    const planted=key.startsWith('push')?[shoes[1]]:key.startsWith('mongo')?[shoes[0]]:shoes;
    const expected=[0,1].map(i=>planted.reduce((s,p)=>s+p.c[i],0)/planted.length),anchor=skaterFootAnchor(key,look);
    if(Math.abs(anchor[0]-expected[0])>1e-8||Math.abs(anchor[1]-expected[1])>1e-8)bad.push(['off board',key,anchor,expected]);
   }
   const bowl=SK_TRANSITIONS.find(o=>o.bowl),theta=.8,r=bowl.profile.flat/2+bowl.profile.radius*Math.sin(theta);
   px=bowl.x+r;py=bowl.y;a=SK.dir=Math.PI/2;SK.v=.5;SK.lastT=T;body.z=body.vz=0;body.trick=null;
   T+=1/60;stepSkate(1/60);stepBody(1/60);
   const before=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).up;
   if(Math.abs(SKB.roll)<.2)bad.push('setup was not banked');
   skatePop('');skateAirPose(0);
   const after=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).up;
   if(Math.hypot(...before.map((v,i)=>v-after[i]))>1e-8)bad.push(['flattened pop',before,after]);
   // Render the banked air through the actual third-person camera.
   const saved=[px,py,a],[x,y,yaw,z]=skateCam(.1);skateView={x:px,y:py,a,eye:z};px=x;py=y;a=yaw;tod=13;env(0);render(0);[px,py,a]=saved;skateView=null;
   return bad;
  });
  assert.deepEqual(result,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

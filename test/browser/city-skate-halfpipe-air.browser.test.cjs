'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');

test('native half-pipes level return airs and land controlled spins with keyboard and pad',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const result=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=game=null;sleep=null;T=100;third=true;
   clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
   let pad=null;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pad?[pad]:[]});
   const ramps=SK_TRANSITIONS.filter(o=>!o.bowl),bad=[];let cases=0;
   for(const o of ramps)for(const side of [-1,1])for(const method of ['natural','pop'])for(const input of ['keyboard','pad'])for(const spin of [-1,0,1]){
    skateDismount();for(const k in K)K[k]=0;SK.lastT=T;body.trick=null;body.z=body.vz=body.peak=0;
    pad=input==='pad'?{connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0}))}:null;
    a=Math.atan2(o.s,o.c)+(side<0?Math.PI:0);
    SK.transition={o,u:side*(o.profile.limit-.03),axis:0,vs:side*(o.profile.extension?.7:.6),va:0};
    skateTransitionPlace(SK.transition);
    const steer=held=>{K.KeyD=input==='keyboard'&&held&&spin>0?1:0;K.KeyA=input==='keyboard'&&held&&spin<0?1:0;if(pad)pad.axes[0]=held?spin:0;};
    if(method==='pop'){steer(true);skatePollInput(0);skatePop('');}
    let air=false,returned=false,airTicks=0,apex=null,previous=null,maxStep=0,lastSpin=0;
    for(let i=0;i<500;i++){
     steer(airTicks<55&&(air||method==='pop'));
     T+=1/120;stepSkate(1/120);stepBody(1/120);skateBoardSync();
     if(SK.bail)break;
     if(skateAir()&&!SK.transition){
      air=true;airTicks++;lastSpin=SK.spin;
      const up=SK.airNormal;
      if(!apex||SKB.p[2]>apex.z)apex={z:SKB.p[2],up:up[2]};
      if(previous)maxStep=Math.max(maxStep,Math.hypot(...up.map((v,j)=>v-previous[j])));previous=up;
     }else if(air&&SK.transition?.o===o){returned=true;break;}
    }
    cases++;
    if(!air||!returned||SK.bail||apex?.up<.98||maxStep>.18||Math.abs(lastSpin-spin*Math.PI)>.35)
     bad.push({ramp:[o.x,o.y],side,method,input,spin,air,returned,bail:SK.bail,apex,maxStep,lastSpin});
   }
   return {bad,cases,ramps:ramps.length};
  });
  assert.deepEqual(result.bad,[]);assert.ok(result.ramps>=3);assert.equal(result.cases,result.ramps*24);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

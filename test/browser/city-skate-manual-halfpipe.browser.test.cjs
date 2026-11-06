'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('fore/aft manual balance, nollie labels, mongo chase, wider half-pipes and stable ramp stars',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await page.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;T=100;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;const bad=[];
  let pad=null;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pad?[pad]:[]});
  const reset=()=>{skateDismount();for(const k in K)K[k]=0;pad=null;px=SKATEPARK.bx*8+4.3;py=SKATEPARK.by*8+3.4;a=SK.dir=0;SK.v=.6;SKB.v=[.6,0,0];SKB.yaw=SKB.pitch=SKB.roll=0;SKB.surf=skateSurface(px,py);body.z=body.vz=body.peak=0;body.trick=null;SK.charge=-1;SK.lastT=T;};
  const tick=()=>{T+=1/120;stepSkate(1/120);stepBody(1/120);skateCam(1/120);};
  const makePad=()=>({connected:true,mapping:'standard',axes:[0,0,0,.4475],buttons:Array.from({length:17},()=>({value:0}))});
  const manual=(depth,x=0,mouse=false)=>{reset();if(mouse){skateMouseBegin();skateMouseMove(0,21);}else{pad=makePad();pad.axes[2]=x;}
   for(let i=0;i<4;i++)tick();if(!SK.manual)return null;SK.manual.bal=.4;SK.manual.balV=.3;
   if(mouse)skateMouseMove(x*120,(depth-.35)*60);else pad.axes[3]=.15+depth*.85;
   for(let i=0;i<20;i++)tick();return SK.manual?.bal;};
  const balanced=manual(.35),side=manual(.35,.8),forward=manual(.2),back=manual(.5),mouse=manual(.35,1,true);
  if(balanced==null||Math.abs(side-balanced)>1e-8||Math.abs(mouse-balanced)>1e-8||!(forward<balanced&&back>balanced))bad.push(['manual axes',balanced,side,forward,back,mouse]);
  reset();pad=makePad();pad.axes[3]=1;for(let i=0;i<5;i++)tick();if(SK.manual)bad.push('full stick became manual');
  reset();skatePop('',{nollie:true,strength:1});if(skateTrickName(body.trick)!=='nollie')bad.push('air nollie label');for(let i=0;i<100;i++)tick();if(!SK.combo?.names.includes('NOLLIE')||SK.combo?.names.some(n=>n.includes('NOLLIE OLLIE')))bad.push(['landing name',SK.combo?.names]);
  for(const source of ['keyboard','pad']){reset();SK.dir=Math.PI;SKB.v=[-.6,0,0];SKB.fakie=true;if(source==='keyboard'){K.KeyW=K.ShiftLeft=1;}else{pad=makePad();pad.axes[3]=0;pad.buttons[2].value=1;}for(let i=0;i<55;i++)tick();if(!SK.mongo||Math.abs(Math.atan2(Math.sin(SK.camYaw-SK.dir),Math.cos(SK.camYaw-SK.dir)))>.5)bad.push(['mongo camera',source,SK.camYaw,SK.dir]);}
  const ramps=SK_TRANSITIONS.filter(o=>!o.bowl);for(const o of ramps)for(const sign of [-1,1])for(const method of ['natural','pop']){
   reset();const u=sign*(o.profile.flat/2+.02),heading=Math.atan2(o.s,o.c);a=heading+(sign<0?Math.PI:0)+.12;
   SK.transition={o,u,axis:0,vs:sign*(o.profile.extension?1.1:.85),va:.08};skateTransitionPlace(SK.transition);SK.transition.u=sign*(o.profile.flat/2+o.profile.curve*.8);skateTransitionPlace(SK.transition);
   const up=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).up;if(up.reduce((s,v,i)=>s+v*SKB.surf.n[i],0)<.999)bad.push('angled half-pipe pose');SK.transition.u=u;skateTransitionPlace(SK.transition);
   if(o.profile.width<.68)bad.push('half-pipe not widened');
   let air=false,returned=false,launchYaw=0,maxTurn=0,didPop=false;
   for(let i=0;i<600&&!SK.bail;i++){if(method==='pop'&&!didPop&&SK.transition&&Math.abs(SK.transition.u)>o.profile.limit-.03){skatePop('');didPop=true;}tick();if(skateAir()){if(!air)launchYaw=a;air=true;maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(a-launchYaw),Math.cos(a-launchYaw))));}else if(air&&SK.transition?.o===o){returned=true;break;}}
   if(!air||!returned||!SKB.fakie||SK.bail||maxTurn>Math.PI/2)bad.push(['half-pipe return',method,o.x,o.y,sign,air,returned,SKB.fakie,SK.bail,maxTurn]);
  }
  // Render actual sky pixels while changing the same yaw/pitch/FOV values as
  // a ramp chase. Every exposed star must be one projected catalogue point.
  reset();fx.skating=false;px=SKATEPARK.bx*8+4;py=SKATEPARK.by*8+3;tod=23;weather='clear';env(0);night=1;overcast=rain=fogAmt=0;
  let stars=0;const originalFOV=FOV;
  for(const [yaw,tilt,widen]of [[0,.15,0],[.2,.3,.15],[.4,.1,.2]]){
   a=yaw;pitch=tilt;FOV=originalFOV+widen;render(0);
   for(let i=0;i<CH.length;i++)if(ZB[i]===Infinity&&['*','+','.'].includes(CH[i])){
    stars++;const id=skyStarIndex[i];if(!(id>=0))bad.push('star detached from world direction');else{
     const s=SKY_STARS[id],d=Math.cos(a)*s.x+Math.sin(a)*s.y,x=Math.floor(cols/2+(-Math.sin(a)*s.x+Math.cos(a)*s.y)*projX/d),y=Math.floor(hor-s.z*projY/d);
     if(y*cols+x!==i)bad.push('star projection mismatch');
    }
   }
  }FOV=originalFOV;if(stars<5)bad.push(['no star coverage',stars]);
  return {bad,ramps:ramps.length,stars};
 });assert.deepEqual(r.bad,[]);assert.ok(r.ramps>=3);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

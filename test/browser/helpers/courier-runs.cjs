'use strict';
// Passed to page.evaluate: use the game's actual input loop, collision and jump physics at 100Hz.
// Only painting and asynchronous frames are disabled, so course times are simulated game seconds.
function timeCourierRuns() {
  paused=true;window.requestAnimationFrame=()=>0;render=()=>{};hud=()=>{};actx=null;
  clearWanted();cars.length=people.length=footCops.length=0;
  fx.caffeine=fx.booze=fx.skating=0;inv.length=0;
  const prefix=[[179.5,106.5]],tail=[[195.4,102.4],[196.4,102.4],[197.5,102.4],[198.5,102.4],[199,102.1]];
  const middle=[[188.2,106.85],[189.4,106.85],[190.3,106.85],[190.8,107.4],[191.4,107.4],[191.4,106.85]];
  const safeFirst=[[182.5,107.4],[183.5,108.1],[183.5,109.5],[186.5,109.5],[186.5,107.35]];
  const fastFirst=[[182.8,106.52],[184.68,106.52,'jump'],[185.75,106.52],[186.5,107.35]];
  const safeSecond=[[191.4,101.25],[194.35,101.25],[194.35,102.4]];
  const fastSecond=[[191.4,102.35],[192.88,102.35,'jump'],[194.35,102.35]];
  const courses=[['safe',false,false],['first jump',true,false],['second jump',false,true],['both jumps',true,true]];
  return courses.map(([name,first,second])=>{
    courierJob=null;startCourier();needs.health=needs.food=needs.drink=100;sleep=false;
    for(const key of Object.keys(K))K[key]=false;
    K.KeyW=K.ShiftLeft=true;
    body.z=body.vz=body.peak=body.crouch=0;body.hop=1;body.buf=body.landedAt=-9;
    body.seat=null;body.groundMode=null;
    enterRoom('courier',{word:'COURIER',cell:[179,103],ret:[179.5,104.2,-Math.PI/2]},[10.3,4.9,0]);
    paused=false;
    const legs=[];
    function go(x,y) {
      let frames=0;
      while(near(px,py,x,y)>.018&&frames++<1500){a=Math.atan2(y-py,x-px);loop(t0+10);}
      const reached=near(px,py,x,y)<=.018;
      legs.push({target:[x,y],reached,at:[px,py],mode});
      return reached;
    }
    // Start at the parcel counter: reaching the depot stairs counts against the bonus too.
    go(4,4.9);go(4,1.7);interact();
    const path=[...prefix,...(first?fastFirst:safeFirst),...middle,...(second?fastSecond:safeSecond),...tail];
    for(let k=0;k<path.length;k++) {
      const [x,y,action]=path[k];if(!go(x,y))break;
      if(action==='jump'){a=Math.atan2(path[k+1][1]-py,path[k+1][0]-px);jump();}
    }
    K.KeyW=false;for(let k=0;k<200&&body.z>0;k++)loop(t0+10);
    paused=true;
    return {name,seconds:courierJob.took,recipient:courierAtRecipient(),health:needs.health,legs,
      bonus:courierBonus(courierRoute(),courierJob.took),fullUntil:courierRoute().quick};
  });
}
// The construction rush, both ways: the ladder and walkway, or the hoist bay's strafe jump (off forward, hold right).
function timeSiteRuns() {
  paused=true;window.requestAnimationFrame=()=>0;render=()=>{};hud=()=>{};actx=null;
  clearWanted();cars.length=people.length=footCops.length=0;
  fx.caffeine=fx.booze=fx.skating=0;inv.length=0;courierRecords.best.garden??=50;
  const prefix=[[179.5,106.5],[179.5,108.4],[180.5,109.4],[180.85,110.5],[182.3,110.5],[182.55,111.2],
    [182.55,111.98,'jump'],[182.55,112.6],[182.55,112.82,'jump'],[182.55,113.3],[182.55,113.48,'jump'],[182.55,113.86]];
  const safe=[[183.55,113.86,'ladder'],[184.2,115.2],[184.9,116.45],[186.33,116.45],[186.33,114.62],[186.85,114.75]];
  const fast=[[184.7,113.86],[184.85,113.63],[185.42,113.63,'strafe'],[186.85,114.75]];
  return [['safe',safe],['shortcut',fast]].map(([name,tail])=>{
    courierJob=null;startCourier('site');needs.health=needs.food=needs.drink=100;sleep=false;
    for(const key of Object.keys(K))K[key]=false;
    K.KeyW=K.ShiftLeft=true;
    body.z=body.vz=body.peak=body.crouch=0;body.hop=1;body.buf=body.landedAt=-9;
    body.seat=null;body.groundMode=null;
    enterRoom('courier',{word:'COURIER',cell:[179,103],ret:[179.5,104.2,-Math.PI/2]},[10.3,4.9,0]);
    paused=false;
    const legs=[];
    function go(x,y) {
      let frames=0;
      while(near(px,py,x,y)>.018&&frames++<1500){a=Math.atan2(y-py,x-px);loop(t0+10);}
      const reached=near(px,py,x,y)<=.018;
      legs.push({target:[x,y],reached,at:[px,py],mode});
      return reached;
    }
    go(4,4.9);go(4,1.7);interact();
    const path=[...prefix,...tail];
    for(let k=0;k<path.length;k++) {
      const [x,y,action]=path[k];if(!go(x,y))break;
      if(action==='jump'){a=Math.atan2(path[k+1][1]-py,path[k+1][0]-px);jump();}
      if(action==='ladder'){interact();for(let n=0;mode==='ladder'&&n<2000;n++)loop(t0+10);}
      if(action==='strafe') {
        a=0;jump();K.KeyW=false;K.KeyD=true;
        for(let n=0;(body.z>0||body.vz>0)&&n<300;n++)loop(t0+10);
        K.KeyD=false;K.KeyW=true;
      }
    }
    K.KeyW=false;for(let k=0;k<200&&body.z>0;k++)loop(t0+10);
    paused=true;
    return {name,seconds:courierJob.took,recipient:courierAtRecipient(),health:needs.health,legs,
      bonus:courierBonus(courierRoute(),courierJob.took),fullUntil:courierRoute().quick};
  });
}
// The night run, at 10pm: down the backs, over the LATE NITE gantry and the footbridge to the ARCADE sign's catwalk;
// or hop the walkway up to speed, run the last strides to the condenser's edge and leap the side street onto the bar roof.
function timeNightRuns() {
  paused=true;window.requestAnimationFrame=()=>0;render=()=>{};hud=()=>{};actx=null;
  clearWanted();cars.length=people.length=footCops.length=0;
  fx.caffeine=fx.booze=fx.skating=0;inv.length=0;courierRecords.best.garden??=50;courierRecords.best.site??=30;
  (0,eval)('tod=22');
  const prefix=[[179.5,106.5],[178.5,107.4],[178.5,110.5]];
  const safe=[[178.5,117.4],[178.3,119.6],[178.3,122.51],[179.73,122.51],[179.73,123.9],[180.4,123.4],[180.75,123.3]];
  const leap=[[178.5,117.3,'hop',.1],[179.7,118.5,'hop',.12],[180.55,121.5,'leap',.05,120],[180.75,123.3]];
  return [['safe',safe],['leap',leap]].map(([name,tail])=>{
    courierJob=null;startCourier('night');needs.health=needs.food=needs.drink=100;sleep=false;
    for(const key of Object.keys(K))K[key]=false;
    K.KeyW=K.ShiftLeft=true;
    body.z=body.vz=body.peak=body.crouch=0;body.hop=1;body.buf=body.landedAt=-9;body.seat=null;body.groundMode=null;
    enterRoom('courier',{word:'COURIER',cell:[179,103],ret:[179.5,104.2,-Math.PI/2]},[10.3,4.9,0]);
    paused=false;
    const legs=[];
    // A hop leg keeps jumping on every landing and only stops once it's close, or past its mark. A leap leg hops on
    // while the next hop still lands short of the edge, runs the last strides, and jumps off the edge itself.
    function go(x,y,action,tol=.018,edge) {
      let frames=0,leapt=false;
      while(near(px,py,x,y)>tol&&frames++<1500) {
        a=Math.atan2(y-py,x-px);
        const down=!(body.z>0||body.vz>0);
        if(action==='hop'&&down)jump();
        if(action==='leap'&&down&&!leapt&&(py>=edge-.06||py+Math.hypot(body.mx,body.my)*.75<edge)){leapt=py>=edge-.06;jump();}
        loop(t0+10);
        if((action==='hop'||action==='leap')&&py>y+.05)break;
      }
      const reached=action==='hop'||action==='leap'?near(px,py,x,y)<=tol||py>y:near(px,py,x,y)<=tol;
      legs.push({target:[x,y],reached,at:[px,py],mode,height:roofH});
      return reached;
    }
    go(4,4.9);go(4,1.7);interact();
    for(const [x,y,action,tol,edge] of [...prefix,...tail]) {
      if(!go(x,y,action,tol,edge))break;
      if(!action)for(let k=0;k<200&&(body.z>0||body.vz>0);k++)loop(t0+10);
    }
    K.KeyW=false;for(let k=0;k<200&&body.z>0;k++)loop(t0+10);
    paused=true;
    return {name,seconds:courierJob.took,recipient:courierAtRecipient(),health:needs.health,street:!!courierJob.street,legs,
      bonus:courierJobBonus(),fullUntil:courierRoute().quick};
  });
}
module.exports={timeCourierRuns,timeSiteRuns,timeNightRuns};

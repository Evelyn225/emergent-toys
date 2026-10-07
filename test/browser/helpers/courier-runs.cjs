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
module.exports={timeCourierRuns};

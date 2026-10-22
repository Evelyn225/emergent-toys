// Moving carriage coordinates stay relative to its centre, independent of the camera.
const EL_RIDERS=new Map();
function elPassengerSet(tr,k,time=T){
 const train=elTrain(tr,k,time),leg=Math.floor((time+(worldReady?tr*108:k*EL_CYCLE/2+tr*17))/36),key=tr+':'+k;
 let state=EL_RIDERS.get(key);
 const make=cycle=>Array.from({length:EL_CARS*8},(_,index)=>{
  const slot=index%8,car=Math.floor(index/8)-1,seed=(cycle+1000)*701+tr*91+index*13;
  if(hash(seed,2,8910)<.4)return null;
  const seated=slot<6,side=(slot%2?1:-1),u=seated?[-.69,0,.69][Math.floor(slot/2)]:slot===6?-.25:.25,v=seated?side*.105:side*.025;
  return {seed,slot,car,seated,u,v,side,look:figStreetLook(seed,[BLUE,RED,GREEN,YEL,STONE][index%5],BLUE)};
 }).filter(Boolean);
 if(!state||state.leg!==leg){state={leg,previous:state?.riders||make(leg-1),riders:make(leg)};EL_RIDERS.set(key,state);}
 const elapsed=train.stopped?DWELL-train.left:10,doorSide=tr?1:-1;
 const pose=(p,exiting)=>{
  const moving=elapsed<(exiting?3:6),progress=exiting?clamp(elapsed/3,0,1):clamp((elapsed-3)/3,0,1),door=(p.u<0?-1:1)*.45*EL_HL;
  const u=moving?door+(p.u-door)*(exiting?1-progress:progress):p.u;
  const v=moving?doorSide*.23+(p.v-doorSide*.23)*(exiting?1-progress:progress):p.v;
  return {...p,u,v,boarding:moving,seated:!moving&&p.seated,exiting};
 };
 const out=elapsed<3?state.previous.filter(p=>hash(p.seed,4,8910)>.35).map(p=>pose(p,true)):[];
 for(const p of state.riders)if(elapsed>=3||hash(p.seed,4,8910)<=.35)out.push(pose(p,false));
 return out;
}
function drawElRiders(train,inside=false){
 for(const p of elPassengerSet(train.tr,train.k)){
  if(inside&&p.car!==ride.car||!inside&&Math.abs(p.v)<EL_HW)continue;
  const x=worldCoord(train.x+p.car*EL_CAR_LEN+p.u),y=EL_TRACK[train.tr]+p.v;
  if(!inView(rel(x-px),rel(y-py),.2))continue;
  const pose=p.seated?'sit7':p.boarding?'walk'+(Math.floor(T*7+p.slot)&7):'stand';
  drawFigure(...R(x,y),EL_TOP+.02,.175,0,p.seated?-p.side:0,p.look,pose,{light:10});
 }
}
function elSeatToggle(){
 if(!ride)return;
 if(ride.seat){ride.seat=null;return;}
 const passengers=elPassengerSet(ride.tr,ride.k),local=ride.off-ride.car*EL_CAR_LEN;
 let best=null,dist=.25;
 for(const u of [-.69,0,.69])for(const side of [-1,1]){
  if(passengers.some(p=>p.car===ride.car&&p.seated&&Math.abs(p.u-u)<.02&&p.side===side))continue;
  const d=Math.hypot(local-u,(ride.side||0)-side*.10);if(d<dist){dist=d;best={u,side};}
 }
 if(best){ride.seat=best;ride.off=ride.car*EL_CAR_LEN+best.u;ride.side=best.side*.10;a=best.side>0?-Math.PI/2:Math.PI/2;}
 else say('Move beside an empty blue seat to sit.',2);
}
function stepElRide(dt){
 const f=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0),s=(K.KeyD?1:0)-(K.KeyA?1:0);
 a+=((K.ArrowRight?1:0)-(K.ArrowLeft?1:0))*2*dt;
 if(f||s){if(ride.seat){ride.seat=null;ride.side=0;}
  const speed=.22*dt/Math.max(1,Math.hypot(f,s)),vx=(Math.cos(a)*f-Math.sin(a)*s)*speed,vy=(Math.sin(a)*f+Math.cos(a)*s)*speed;
  const local=ride.off-ride.car*EL_CAR_LEN,u=clamp(local+vx,-EL_HL+.04,EL_HL-.04),v=clamp((ride.side||0)+vy,-EL_HW+.04,EL_HW-.04);
  const occupants=elPassengerSet(ride.tr,ride.k).filter(p=>p.car===ride.car&&!p.seated);
  const clear=(x,y)=>!occupants.some(p=>Math.hypot(x-p.u,y-p.v)<.04)&&!(Math.abs(y)>.065&&[-.69,0,.69].some(c=>Math.abs(x-c)<.215))&&![-1,1].some(c=>Math.hypot(x-c*.45*EL_HL,y)<.023);
  if(clear(u,ride.side||0))ride.off=ride.car*EL_CAR_LEN+u;
  if(clear(ride.off-ride.car*EL_CAR_LEN,v))ride.side=v;
 }
 px=worldCoord(elRiding().x+ride.off);py=EL_TRACK[ride.tr]+(ride.side||0);
}

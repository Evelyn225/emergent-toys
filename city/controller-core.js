// Shared analog math. Trick sticks use a linear response; steering/look have
// a softer centre and reach full travel before a worn stick hits its gate.
function controllerStick(x=0,y=0,dead=.15,power=1.45){
  if(!Number.isFinite(x)||!Number.isFinite(y))return [0,0];
  const radius=Math.hypot(x,y);
  if(radius<=dead)return [0,0];
  const magnitude=Math.pow(Math.min(1,(radius-dead)/(.95-dead)),power);
  return [x/radius*magnitude,y/radius*magnitude];
}
function controllerEase(value,target,dt){
  const tau=value*target<0||Math.abs(target)<Math.abs(value) ? .035 : .065;
  const next=value+(target-value)*(1-Math.exp(-Math.max(0,Math.min(.1,dt))/tau));
  return Math.abs(next)<.002&&Math.abs(target)<.002?0:next;
}
function controllerThreshold(index){return index===6||index===7 ? .18 : .5;}
function controllerButton(pad,index){
  const button=pad?.buttons?.[index],value=button?.value??(button?.pressed?1:0);
  return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
}
const CONTROLLER={pad:null,id:null,sampleT:-Infinity,keys:new Set(),realKeys:new Set(),buttons:[],blocked:[],
  sprint:false,hint:'',context:'',root:null,focus:0,repeat:0,direction:'',time:0,active:false,lastUsed:-Infinity,
  motion:{forward:0,side:0,steer:0,throttle:0,flightX:0,flightY:0},sheet:null,keyboard:null};
function controllerAxis(key,axis){return key||CONTROLLER.motion[axis]||0;}

// Short contact cues; unsupported or permission-denied actuators are optional.
function controllerRumble(kind,impact=0){
  if(!CONTROLLER.active||!CONTROLLER.pad||typeof settings!=='undefined'&&settings.controllerVibration===false||typeof paused!=='undefined'&&paused)return;
  const actuator=CONTROLLER.pad.vibrationActuator||CONTROLLER.pad.hapticActuators?.[0];
  if(!actuator)return;
  const cues={pop:[.14,.04,45],grind:[.2,.08,60],land:[.12,Math.min(.55,.08+Math.abs(impact)*.045),85],bail:[.25,Math.min(.7,.25+Math.abs(impact)*.3),150]};
  const cue=cues[kind];if(!cue)return;
  const [weakMagnitude,strongMagnitude,duration]=cue;
  CONTROLLER.rumbleActuator=actuator;CONTROLLER.rumbleUntil=(typeof performance==='undefined'?Date.now():performance.now())+duration;
  try{
    const effect=actuator.playEffect?actuator.playEffect('dual-rumble',{startDelay:0,duration,weakMagnitude,strongMagnitude}):actuator.pulse?.(Math.max(weakMagnitude,strongMagnitude),duration);
    return Promise.resolve(effect).catch(()=>{});
  }catch(_){}
}
function controllerStopRumble(){
  const actuator=CONTROLLER.rumbleActuator;if(!actuator||!CONTROLLER.rumbleUntil)return;
  CONTROLLER.rumbleUntil=0;
  try{const stop=actuator.reset?actuator.reset():actuator.playEffect?.('dual-rumble',{startDelay:0,duration:1,weakMagnitude:0,strongMagnitude:0});Promise.resolve(stop).catch(()=>{});}catch(_){}
}

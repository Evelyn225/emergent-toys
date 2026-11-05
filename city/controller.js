// One browser poll per frame, including paused menus. Skating consumes the
// same snapshot, while its unfiltered trick stick stays separate from look.
function controllerReadPad(){
  let pads=[];try{pads=Array.from(navigator.getGamepads?.()||[]);}catch(_){}
  const valid=p=>p?.connected&&(!p.mapping||p.mapping==='standard');
  return pads.find(p=>valid(p)&&`${p.index}:${p.id}`===CONTROLLER.id)||pads.find(valid)||null;
}
function controllerSkateLook(){return !!CONTROLLER.pad&&!CONTROLLER.blocked[4]&&controllerButton(CONTROLLER.pad,4)>.5;}
function controllerSkatePad(){
  if(paused||CONTROLLER.menu||freecam||!CONTROLLER.pad)return null;
  const p=CONTROLLER.pad,look=controllerSkateLook();
  return {connected:true,mapping:'standard',axes:[p.axes[0],p.axes[1],look||!CONTROLLER.stickArmed?0:p.axes[2],look||!CONTROLLER.stickArmed?0:p.axes[3]],
    buttons:Array.from({length:17},(_,i)=>({value:CONTROLLER.blocked[i]?0:controllerButton(p,i)}))};
}
function controllerKey(code,down){
  CONTROLLER.dispatching=true;
  try{window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code==='Escape'?'Escape':code,bubbles:true,cancelable:true}));}
  finally{CONTROLLER.dispatching=false;}
}
function controllerTap(code){controllerKey(code,true);controllerKey(code,false);}
function controllerReleaseKeys(){
  controllerStopRumble();
  for(const code of CONTROLLER.keys)if(!CONTROLLER.realKeys.has(code))controllerKey(code,false);
  CONTROLLER.keys.clear();for(const key in CONTROLLER.motion)CONTROLLER.motion[key]=0;
  if(typeof gun!=='undefined')gun.aimHeld=false;
}
function controllerKeys(wanted){
  for(const code of CONTROLLER.keys)if(!wanted.has(code)&&!CONTROLLER.realKeys.has(code))controllerKey(code,false);
  for(const code of wanted)if(!CONTROLLER.keys.has(code)&&!CONTROLLER.realKeys.has(code))controllerKey(code,true);
  CONTROLLER.keys=wanted;
}
function controllerHint(text){
  let hint=document.getElementById('controller-hint');
  if(!hint){hint=document.createElement('div');hint.id='controller-hint';hint.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:2100;pointer-events:none;color:#d2ecea;background:#080b10dd;padding:6px 10px;font:13px monospace;width:fit-content;max-width:calc(100vw - 36px)';document.body.appendChild(hint);}
  if(hint.textContent!==text)hint.textContent=text;const display=CONTROLLER.active?'block':'none';if(hint.style.display!==display)hint.style.display=display;
}
function controllerTick(dt){
  dt=Math.max(0,Math.min(.05,dt));CONTROLLER.time+=dt;
  const pad=controllerReadPad(),id=pad?`${pad.index}:${pad.id}`:null,previous=CONTROLLER.buttons;
  CONTROLLER.pad=pad;CONTROLLER.sampleT=T;
  if(id!==CONTROLLER.id){
    const lost=!!CONTROLLER.id;controllerReleaseKeys();skateInputReset();CONTROLLER.id=id;
    CONTROLLER.context='';CONTROLLER.hadContext=false;CONTROLLER.active=!!pad;CONTROLLER.buttons=[];CONTROLLER.blocked=Array.from({length:17},(_,i)=>controllerButton(pad,i)>controllerThreshold(i));
    CONTROLLER.stickArmed=!pad||Math.hypot(pad.axes[2]||0,pad.axes[3]||0)<.25;
    if(lost&&!pad&&!paused)openPause();
  }
  if(document.hidden||!document.hasFocus()){
    controllerReleaseKeys();skateInputReset();CONTROLLER.pad=null;
    CONTROLLER.blocked=Array.from({length:17},(_,i)=>controllerButton(pad,i)>controllerThreshold(i)*.5);return;
  }
  if(!pad){controllerHint('');return;}
  const values=Array.from({length:17},(_,i)=>controllerButton(pad,i));
  values.forEach((v,i)=>{if(v<controllerThreshold(i)*.5)CONTROLLER.blocked[i]=false;});
  const held=i=>!CONTROLLER.blocked[i]&&values[i]>controllerThreshold(i),edge=i=>held(i)&&!(previous[i]>controllerThreshold(i));
  const dead=clamp(Number(settings.controllerDeadzone)||.15,.05,.35);
  const left=controllerStick(pad.axes[0],pad.axes[1],dead),right=controllerStick(pad.axes[2],pad.axes[3],dead);
  if(Math.hypot(pad.axes[2]||0,pad.axes[3]||0)<.25)CONTROLLER.stickArmed=true;
  const cameraLook=controllerSkateLook();
  if(CONTROLLER.wasSkateLook&&!cameraLook&&Math.hypot(...right)>.1)CONTROLLER.stickArmed=false;
  CONTROLLER.wasSkateLook=cameraLook;
  if(values.some((v,i)=>v>((i===6||i===7)?.08:.5)&&!CONTROLLER.blocked[i])||Math.hypot(...left)>.05||Math.hypot(...right)>.05)CONTROLLER.active=true;
  const root=controllerMenuRoot();CONTROLLER.menu=root;const context=root?`menu:${root.id}`:game?`game:${game.kind}:${game.g.id}`:`world:${mode}:${skatingNow()}`;
  if(context!==CONTROLLER.context){
    controllerReleaseKeys();skateInputReset();CONTROLLER.stickArmed=Math.hypot(pad.axes[2]||0,pad.axes[3]||0)<.25;CONTROLLER.context=context;CONTROLLER.direction='';
    // Never carry an accept/interaction into the menu or mode it just opened.
    if(CONTROLLER.hadContext)values.forEach((v,i)=>{if(v>controllerThreshold(i)&&previous[i]>controllerThreshold(i))CONTROLLER.blocked[i]=true;});
    CONTROLLER.hadContext=true;
  }
  CONTROLLER.buttons=values;
  if(!CONTROLLER.active){controllerReleaseKeys();return;}
  if(edge(9)){
    controllerReleaseKeys();if(root)controllerMenuBack(root);else openPause();return;
  }
  if(root){
    controllerMenuStep(root,edge,held,controllerStick(pad.axes[0],pad.axes[1],dead,1),right,dt);
    controllerHint(root===CONTROLLER.keyboard?'A type · X erase · Y shift · B done':bigMapOpen()?'D-pad navigate · A select · B back · Y search · LB/RB zoom · right stick pan':'D-pad / left stick navigate · A select · B back · right stick scroll');return;
  }
  if(paused||sleep){controllerReleaseKeys();return;}
  if(edge(8)){controllerReleaseKeys();openBigMap();return;}
  if(edge(3)){controllerReleaseKeys();controllerActions();return;}
  const wanted=new Set(),hold=(code,on)=>{if(on)wanted.add(code);};
  if(game){
    hold('Space',held(0));hold('KeyE',held(1));hold('ArrowUp',held(2)||held(12)||left[1]<-.45);
    hold('ArrowDown',held(13)||left[1]>.45);hold('ArrowLeft',held(14)||left[0]<-.45);hold('ArrowRight',held(15)||left[0]>.45);
    controllerKeys(wanted);controllerHint('A action / hold · D-pad move · X secondary · B leave · Y actions · Start pause');return;
  }
  if(edge(12)){controllerReleaseKeys();controllerTap('KeyI');return;}
  if(edge(13)){controllerReleaseKeys();controllerActions();return;}
  if(edge(14))cycleQuickSlot(-1);if(edge(15))cycleQuickSlot(1);
  if(edge(11))controllerTap('KeyV');
  const vehicle=['drive','sea','boat','air'].includes(mode),skate=skatingNow()&&!freecam;
  const motion=CONTROLLER.motion;
  for(const key in motion)motion[key]=0;
  if(skate){
    if(edge(5))controllerTap('KeyE');
    controllerHint('A push · X mongo · B brake · right stick tricks · LB + right stick look · RB interact · Y actions');
  }else{
    if(edge(4))cycleQuickSlot(-1);if(edge(5))cycleQuickSlot(1);
    hold('Space',held(0));hold(vehicle?'KeyS':'KeyC',held(1));hold('KeyE',held(2));
    hold('ShiftLeft',held(10));
    if(vehicle){
      motion.steer=left[0];motion.throttle=(CONTROLLER.blocked[7]?0:controllerButton(pad,7))-(CONTROLLER.blocked[6]?0:controllerButton(pad,6));
      if(mode==='air'){motion.flightX=left[0];motion.flightY=left[1];}
      if(mode==='boat'){hold('KeyW',motion.throttle>.15||left[1]<-.3);hold('KeyS',motion.throttle<-.15||left[1]>.3);hold('KeyD',left[0]>.2);hold('KeyA',left[0]<-.2);}
    }else if(['walk','room','roof','elplat'].includes(mode)&&!chute&&!freecam){
      motion.forward=-left[1];motion.side=left[0];
      hold('KeyQ',held(7));gun.aimHeld=held(6)&&canAimGun();
    }else{
      hold('KeyW',left[1]<-.2);hold('KeyS',left[1]>.2);hold('KeyD',left[0]>.2);hold('KeyA',left[0]<-.2);hold('KeyQ',held(7));
    }
    controllerHint(vehicle?'Left stick steer / fly · RT power · LT brake / reverse · X enter / exit · A action · Y actions':'Left stick move · right stick look · A jump · X interact · B crouch / sit · RT use · LT aim · Y actions');
  }
  controllerKeys(wanted);
  if(!skate||cameraLook){
    const lookSpeed=2.5*clamp(Number(settings.controllerLook)||1,.25,3),s=settings.sensitivity||1;
    turnBy(right[0]*lookSpeed*dt/(.003*s),right[1]*lookSpeed*.7*dt/(.002*s)*(settings.controllerInvertY?-1:1)*(settings.invertY?-1:1));
  }
}
addEventListener('keydown',e=>{if(!CONTROLLER.dispatching){CONTROLLER.realKeys.add(e.code);CONTROLLER.active=false;}});
addEventListener('keyup',e=>{if(!CONTROLLER.dispatching){CONTROLLER.realKeys.delete(e.code);if(CONTROLLER.keys.has(e.code))K[e.code]=1;}});
addEventListener('mousedown',()=>{CONTROLLER.active=false;});
addEventListener('blur',()=>{controllerReleaseKeys();CONTROLLER.realKeys.clear();skateInputReset();if(CONTROLLER.active&&!paused)openPause();});
{
 const style=document.createElement('style');style.textContent='.controller-focus{outline:2px solid #a5eee6!important;outline-offset:3px!important;color:#fff!important}.slider:has(.controller-focus){outline:2px solid #a5eee6}';document.head.appendChild(style);
}

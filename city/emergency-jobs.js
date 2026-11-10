// Paid emergency shifts start at an interior dispatch terminal. Unlike a taxi
// fare, the shift survives getting out: treatment and the hose happen on foot.
const medicalCalls=[];
let emergencyJob=null,medicalCallId=0;
const emergencyKindName=k=>k==='amb'?'PARAMEDIC':'FIREFIGHTER';
const emergencyIncidents=()=>[...cityFires,...medicalCalls];
const incidentOwned=f=>typeof netIncidentOwned!=='function'||netIncidentOwned(f);
function registerIncident(f){if(!f.panicDone&&fireActive(f)){f.panicDone=true;panicAt(f.x,f.y);}
 if(typeof netRegisterIncident==='function')netRegisterIncident(f);return f;}
function createMedicalCall(at){
  if(medicalCalls.filter(f=>!f.out).length>=8)return null;
  const sites=doors.filter(d=>!d.sh.base&&!map[idx(d.x,d.y)]&&!isWater(d.x,d.y)&&near(d.x,d.y,...at)>3&&near(d.x,d.y,...at)<24);
  const d=sites.length?pick(sites):doors.find(d=>!map[idx(d.x,d.y)]&&!isWater(d.x,d.y));if(!d)return null;
  const look=figLook({top:'long',bot:'pants',col:{top:[pick([BLUE,GREEN,ORANGE,MAG]),10]}});
  const f={id:'medical-'+(++medicalCallId),kind:'medical',x:d.x,y:d.y,born:T,stage:'waiting',look,caseName:pick(['Cyclist with a sprained ankle','Fainting passenger','Fall on the sidewalk','Dizzy pedestrian'])};
  medicalCalls.push(f);registerIncident(f);return f;
}
function emergencyBase(kind,r=room){
  const at=r?.ret||[px,py];return SERVICES.filter(b=>b.kind===kind).reduce((a,b)=>!a||near(...b.door,...at.slice(0,2))<near(...a.door,...at.slice(0,2))?b:a,null);
}
function startEmergencyShift(kind){
  if(emergencyJob)return say('Finish your current emergency shift at a dispatch desk first.',4);
  if(wanted.stars)return say('Dispatch cannot sign you on while the police are looking for you.',4);
  if(room?.evacuating)return say('The building is evacuating. Dispatch is closed.',3);
  const base=emergencyBase(kind);if(!base)return;
  if(base.out)return say('This station’s vehicle is on a call. Try another station or wait for it to return.',4);
  if(job||courierJob)return say('Finish your current job before signing on with emergency dispatch.',4);
  base.out=true;
  const c=addCar({kind,body:EV_BODY[kind],x:base.x,y:base.y,hx:-1,hy:0});makeEvYours(c,base);
  c.emergencyShift=true;c.siren=true;c.player=true;
  emergencyJob={kind,car:c,base,calls:0,earned:0,next:2,call:null,hose:false,care:0};
  room=null;mode='drive';me=c;px=c.x;py=c.y;a=Math.PI;pitch=0;look=0;body.seat=null;body.z=body.vz=0;
  transitSync();say(`${emergencyKindName(kind)} SHIFT · H: siren · E: get out when stopped. Dispatch will radio your first call.`,7);
}
function releaseEmergencyCall(j=emergencyJob){
  if(!j?.call)return;
  const f=j.call;
  if(f.kind==='medical'&&f.stage==='transport'){
    f.x=j.car.x;f.y=j.car.y;const curb=curbOf(j.car);f.x=curb[0];f.y=curb[1];
  }
  emergencyIncidentAction(f,'release',{x:f.x,y:f.y});j.call=null;j.care=0;
}
function endEmergencyShift(reason='Shift finished'){
  const j=emergencyJob;if(!j)return;
  releaseEmergencyCall(j);j.hose=false;j.car.emergencyShift=false;j.car.siren=false;
  emergencyJob=null;say(`${reason}: ${j.calls} call${j.calls===1?'':'s'}, ${fmt$(j.earned)} earned. The vehicle will return to station when clear.`,6);
}
function emergencyIncidentAction(f,action,extra={}){
  if(typeof netEmergencyAction==='function'&&netEmergencyAction(f,action,extra))return;
  applyEmergencyAction(f,action,'solo',extra);
}
function applyEmergencyAction(f,action,who,extra={}){
  if(action==='claim'&&!f.out&&(!f.assigned||f.assigned===who)){f.assigned=who;return true;}
  if(action==='release'&&f.assigned===who){f.assigned=null;if(f.kind==='medical'&&!f.out){f.stage='waiting';if(Number.isFinite(extra.x)&&Number.isFinite(extra.y)){f.x=extra.x;f.y=extra.y;}}if(fireActive(f)&&!cars.some(c=>c.ev&&!c.mine&&!c.remote&&c.fireIncident===f))spawnEmergency('fire',[f.x,f.y],f);return true;}
  if(f.kind!=='medical'||f.assigned!==who||f.out)return false;
  if(action==='load'&&f.stage==='waiting'){f.stage='transport';return true;}
  if(action==='deliver'&&f.stage==='transport'){f.stage='done';f.out=true;f.outAt=T;f.completedBy=who;return true;}
  return false;
}
function nextEmergencyCall(){
  const j=emergencyJob;if(!j||j.call)return;
  const pool=j.kind==='fire'?cityFires.filter(f=>fireActive(f)&&!f.assigned&&near(f.x,f.y,j.car.x,j.car.y)<40):medicalCalls.filter(f=>!f.out&&!f.assigned&&f.stage==='waiting');
  let f=pool.reduce((a,f)=>!a||near(f.x,f.y,j.car.x,j.car.y)<near(a.x,a.y,j.car.x,j.car.y)?f:a,null);
  if(!f){f=j.kind==='fire'?createCityFire(tripDest(j.car)):createMedicalCall([j.car.x,j.car.y]);if(f)registerIncident(f);}
  if(!f){j.next=4;return;}
  j.call=f;j.started=T;j.care=0;j.claimDue=1;j.rough=0;j.damage=j.car.dmg||0;
  emergencyIncidentAction(f,'claim');
  say(`DISPATCH · ${f.kind==='medical'?f.caseName:f.kind==='car'?'Vehicle fire':'Building fire'} · Follow the marker. ${j.kind==='amb'?'Park, get out and E beside the patient.':'Park, get out and E beside your engine for the hose.'}`,8);
}
const emergencySelf=()=>typeof net!=='undefined'&&net.on?net.selfId:'solo';
function finishEmergencyCall(){
  const j=emergencyJob,f=j?.call;if(!j||!f||!f.out)return;
  const ours=f.assigned===emergencySelf();
  if(ours&&!f.failed){
    const base=j.kind==='amb'?95:f.kind==='building'?140:100,bonus=Math.max(0,Math.round(35-(T-j.started)*.15-j.rough*.4)),paid=base+bonus;
    earn(paid);j.calls++;j.earned+=paid;saveGame();
    say(`${j.kind==='amb'?'Patient handed over to triage':'Fire out. Scene safe'}. ${fmt$(base)} + ${fmt$(bonus)} response bonus.`,6);
  }else say(f.failed?'Dispatch: the vehicle was lost. No pay for this call.':'Dispatch: another crew has completed that call.',4);
  j.call=null;j.care=0;j.next=5;j.hose=false;
}
function emergencyTarget(){
  const j=emergencyJob,f=j?.call;if(!f||f.out)return null;
  if(f.kind==='medical'&&f.stage==='transport'){
    const b=SERVICES.filter(b=>b.kind==='amb').reduce((a,b)=>!a||near(b.x,b.lane,j.car.x,j.car.y)<near(a.x,a.lane,j.car.x,j.car.y)?b:a,null);
    return {x:b.door[0],y:b.lane,what:'HOSPITAL HANDOVER',radius:1.6,stop:'STOP'};
  }
  const stop=mode==='drive'?'PARK & GET OUT':f.kind==='medical'?(j.care>0?'TREATING PATIENT':'TREAT PATIENT'):j.hose?'SPRAY FLAMES':'TAKE HOSE AT ENGINE';
  return {x:f.x,y:f.y,what:f.kind==='medical'?'PATIENT':f.kind==='car'?'VEHICLE FIRE':'BUILDING FIRE',radius:1.8,stop};
}
function emergencyPrompt(){
  const j=emergencyJob;if(!j)return '';
  if(mode==='drive'&&me===j.car)return 'H: lights & siren · E: park and get out';
  if(mode!=='walk')return '';
  const f=j.call;
  if(f?.kind==='medical'&&f.stage==='waiting'&&near(px,py,f.x,f.y)<.35){
    if(!f.assigned)return 'Dispatch is confirming your assignment…';
    if(f.assigned!==emergencySelf())return 'Another crew is treating this patient';
    if(near(j.car.x,j.car.y,f.x,f.y)>1.8)return 'Bring your ambulance within 18m of the patient';
    return j.care>0?`Treating patient · ${Math.min(100,Math.floor(j.care/3*100))}%`:'E: treat patient and load the ambulance';
  }
  if(near(px,py,j.car.x,j.car.y)<.6)return j.kind==='fire'?(j.hose?'E: stow hose · hold Q / click to spray':'E: take hose · J: drive engine'):'E: drive your ambulance';
  if(j.hose)return 'Hold Q / click: spray · aim at flames · stay within 30m of engine';
  return '';
}
function enterShiftVehicle(){
  const j=emergencyJob;if(!j||mode!=='walk'||near(px,py,j.car.x,j.car.y)>.65)return false;
  const c=j.car;if(c.wrecked||burning(c)){endEmergencyShift('Vehicle disabled');return true;}
  j.hose=false;me=c;c.parked=false;c.player=true;c.v=0;mode='drive';px=c.x;py=c.y;a=Math.atan2(c.hy,c.hx);look=0;body.seat=null;
  return true;
}
function emergencyUse(){
  const j=emergencyJob;if(!j||mode!=='walk')return false;
  const f=j.call;
  if(f?.kind==='medical'&&!f.out&&f.stage==='waiting'&&near(px,py,f.x,f.y)<.35){
    if(f.assigned!==emergencySelf())return say('Another crew is assigned to this patient.',3),true;
    if(near(j.car.x,j.car.y,f.x,f.y)>1.8)return say('Park your ambulance within 18m first.',3),true;
    j.care=.001;say('Checking the patient and securing the stretcher… Stay close.',4);return true;
  }
  if(near(px,py,j.car.x,j.car.y)<.6){
    if(j.kind==='fire'){j.hose=!j.hose;j.care=0;say(j.hose?'Hose ready. Aim at the flames and hold Q or click. J beside the engine: drive.':'Hose stowed. J: drive the engine.',5);}
    else enterShiftVehicle();return true;
  }
  return false;
}
function emergencyHoseReady(){return !!(emergencyJob?.hose&&mode==='walk'&&!sleep&&!freecam&&!body.seat&&near(px,py,emergencyJob.car.x,emergencyJob.car.y)<3);}
function stepEmergencyJob(dt){
  for(let k=medicalCalls.length-1;k>=0;k--)if(medicalCalls[k].out&&T-medicalCalls[k].outAt>30)medicalCalls.splice(k,1);
  const j=emergencyJob;if(!j)return;
  if(wanted.busted||j.car.wrecked||burning(j.car)||needs.health<=0){endEmergencyShift('Shift interrupted');return;}
  if(j.call?.out){finishEmergencyCall();return;}
  if(j.call?.assigned&&j.call.assigned!==emergencySelf()){j.call=null;j.next=2;j.care=0;}
  if(!j.call){if((j.next-=dt)<=0)nextEmergencyCall();return;}
  const f=j.call;
  if(!f.assigned){if((j.claimDue-=dt)<=0){j.claimDue=1;emergencyIncidentAction(f,'claim');}return;}
  if(j.hose&&(!emergencyHoseReady()||mode!=='walk'))j.hose=false;
  if(j.care>0){
    if(mode!=='walk'||near(px,py,f.x,f.y)>.4||near(j.car.x,j.car.y,f.x,f.y)>1.8){j.care=0;return;}
    j.care+=dt;
    if(j.care>=3){emergencyIncidentAction(f,'load');j.care=0;say('Patient secured. E beside the ambulance to drive; follow the hospital marker.',6);}
  }
  if(f.kind==='medical'&&f.stage==='transport'&&mode==='drive'&&me===j.car){
    j.rough+=Math.max(0,(j.car.dmg||0)-(j.damage||0));j.damage=j.car.dmg||0;
    const t=emergencyTarget();if(near(j.car.x,j.car.y,t.x,t.y)<t.radius&&Math.abs(j.car.v)<STOP_V)emergencyIncidentAction(f,'deliver');
  }
}

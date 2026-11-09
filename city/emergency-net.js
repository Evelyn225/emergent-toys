// One authority per incident. The creator owns its state; peers send bounded
// treatment/water requests. Snapshots include resolved incidents for late packets
// and late joins. On disconnect the elected remaining peer takes over the scene.
let emergencyNetSerial=0,emergencyNetT=0,emergencyNetRev=0;
const emergencyNetSeen=new Map(),emergencyWaterBuckets=new Map();
function netEmergencyLeader(){return [net.selfId,...[...net.peers.values()].filter(p=>p.hello&&!p.mismatch).map(p=>p.id)].sort()[0];}
function netEmergencyAuthority(){return !net.on||netEmergencyLeader()===net.selfId;}
function netIncidentOwned(f){return !!f&&(!net.on||!f.owner||f.owner===net.selfId);}
function netRegisterIncident(f){
  if(!String(f.id).startsWith('emg:'))f.id=`emg:${netRandomId()}:${++emergencyNetSerial}`;
  if(!f.owner)f.owner=net.on?net.selfId:'';
  if(net.on&&f.assigned==='solo')f.assigned=net.selfId;
  f.netDirty=true;emergencyNetT=0;
}
function emergencyWire(f){
  const car=f.car,crew=cars.find(c=>c.fireIncident===f&&!c.mine&&!c.remote&&!c.home&&c.ev);
  const wire={id:f.id,kind:f.kind,x:f.x,y:f.y,age:Math.min(600,T-f.born),out:!!f.out,failed:!!f.failed,assigned:f.assigned||null,rev:++emergencyNetRev};
  if(f.kind==='medical'){
    wire.stage=f.stage;wire.caseName=f.caseName;wire.col=f.look.col.top[0];
    if(f.stage==='transport'){
      const s=f.assigned===net.selfId?emergencyJob?.call===f?{x:emergencyJob.car.x,y:emergencyJob.car.y,rk:'out',veh:{kind:emergencyJob.car.kind}}:null:(net.peers.has(f.assigned)?netSample(net.peers.get(f.assigned),netNow()):null);
      if(s?.rk==='out'&&s.veh?.kind==='amb'){wire.x=f.x=s.x;wire.y=f.y=s.y;}
    }
  }else{
    wire.nodes=f.nodes.map(n=>({x:n.x,y:n.y,z:n.z,heat:n.heat,max:n.max}));
    if(car)wire.car={x:car.x,y:car.y,hx:car.hx,hy:car.hy,body:car.body};
    if(crew)wire.crew={x:crew.ex,y:crew.ey,hx:crew.hx,hy:crew.hy,state:crew.state,v:crew.v};
  }
  return wire;
}
function netSendEmergency(to){
  if(!net.on)return;
  const owned=emergencyIncidents().filter(netIncidentOwned).slice(-16);
  for(const f of owned){if(!f.owner)f.owner=net.selfId;if(f.assigned==='solo')f.assigned=net.selfId;}
  net.tx.send('emergency',{scenes:owned.map(emergencyWire)},to);
}
function netEmergencyFrame(dt){
  if(!net.on)return;
  if((emergencyNetT-=dt)<=0){emergencyNetT=.4;netSendEmergency();}
  for(const [id,v]of emergencyNetSeen)if(netNow()-v.t>600)emergencyNetSeen.delete(id);
}
function netEmergencyAction(f,action,extra){
  if(!net.on)return false;
  if(netIncidentOwned(f)){if(applyEmergencyAction(f,action,net.selfId,extra))emergencyNetT=0;}
  else net.tx.send('emergencyAct',{id:f.id,action,...extra},f.owner);
  return true;
}
function netSendWater(data){if(net.on)net.tx.send('emergencyWater',data);}
function netEmergencyPeerLeft(id){
  const leader=netEmergencyLeader();
  for(const f of emergencyIncidents()){
    if(f.owner===id){if(f.crewCar){const k=cars.indexOf(f.crewCar);if(k>=0)cars.splice(k,1);f.crewCar=null;}f.owner=leader;f.remoteCrew=null;f.netDirty=true;}
    if(f.assigned===id&&!f.out){
      f.assigned=null;
      if(f.kind==='medical'){
        if(f.stage==='transport'){const [x,y]=curbOf({x:f.x,y:f.y,hx:1,hy:0});f.x=x;f.y=y;}
        f.stage='waiting';
      }
    }
    if(netIncidentOwned(f)&&fireActive(f)&&!cars.some(c=>c.ev&&c.fireIncident===f&&!c.mine))spawnEmergency('fire',[f.x,f.y],f);
  }
  emergencyNetT=0;emergencyWaterBuckets.delete(id);
}
function netEmergencyLeft(oldSelf){
  for(const f of emergencyIncidents()){
    if(f.crewCar){const k=cars.indexOf(f.crewCar);if(k>=0)cars.splice(k,1);f.crewCar=null;}
    f.owner='';f.remoteCrew=null;
    if(f.assigned===oldSelf)f.assigned='solo';
    else if(f.assigned&&!f.out){f.assigned=null;if(f.kind==='medical')f.stage='waiting';}
  }
  emergencyNetSeen.clear();emergencyStreams.clear();
}
function validEmergencyWire(w){
  const coord=v=>netNum(v)&&v>=0&&v<N;
  if(!w||typeof w.id!=='string'||!/^emg:[A-Za-z0-9_-]{1,40}:\d{1,8}$/.test(w.id)||!['car','building','medical'].includes(w.kind)||!coord(w.x)||!coord(w.y)||!netNum(w.rev)||w.rev<0)return false;
  if(w.assigned!=null&&(typeof w.assigned!=='string'||w.assigned.length>80))return false;
  if(w.kind==='medical')return ['waiting','transport','done'].includes(w.stage)&&netNum(w.col)&&w.col>=0&&w.col<32;
  return Array.isArray(w.nodes)&&w.nodes.length>0&&w.nodes.length<=6&&w.nodes.every(n=>coord(n.x)&&coord(n.y)&&netNum(n.z)&&n.z>=0&&n.z<5&&netNum(n.heat)&&n.heat>=0&&n.heat<=10&&netNum(n.max)&&n.max>0&&n.max<=10);
}
function acceptEmergencyWire(w,from){
  if(!validEmergencyWire(w))return;
  let f=emergencyIncidents().find(f=>f.id===w.id);
  if(f&&f.owner!==from&&(net.peers.has(f.owner)||f.owner===net.selfId))return;
  const seen=emergencyNetSeen.get(w.id);
  if(seen?.owner===from&&w.rev<=seen.rev)return;
  if(!f){
    if(emergencyIncidents().length>=32)return;
    f={id:w.id,kind:w.kind,born:T-clamp(w.age||0,0,600)};
    (w.kind==='medical'?medicalCalls:cityFires).push(f);if(w.kind!=='medical'&&!w.out)panicAt(w.x,w.y);
  }
  emergencyNetSeen.set(w.id,{owner:from,rev:w.rev,t:netNow()});
  Object.assign(f,{owner:from,x:w.x,y:w.y,assigned:w.assigned||null,out:!!w.out,failed:!!w.failed});
  if(f.out)f.outAt??=T;
  if(w.kind==='medical'){
    f.stage=w.stage;f.caseName=netClean(w.caseName,70)||'Medical assistance';
    f.look=figLook({top:'long',bot:'pants',col:{top:[w.col,10]}});
  }else{
    f.nodes=w.nodes.map(n=>({...n}));
    const vehicle=v=>v&&['x','y','hx','hy'].every(k=>netNum(v[k]))&&v.x>=0&&v.x<N&&v.y>=0&&v.y<N&&Math.abs(v.hx)<=1&&Math.abs(v.hy)<=1;
    f.remoteCrew=vehicle(w.crew)?{...w.crew,state:['out','scene','back'].includes(w.crew.state)?w.crew.state:'out'}:null;
    if(f.remoteCrew){
      const c=f.remoteCrew;if(!f.crewCar)f.crewCar=addCar({kind:'fire',body:RED,x:c.x,y:c.y,hx:c.hx,hy:c.hy,remote:true,ev:true,incidentCrew:true,fireIncident:f});
      Object.assign(f.crewCar,{x:c.x,y:c.y,ex:c.x,ey:c.y,hx:c.hx,hy:c.hy,v:clamp(c.v||0,0,5),state:c.state,parked:c.state==='scene'});
    }else if(f.crewCar){const k=cars.indexOf(f.crewCar);if(k>=0)cars.splice(k,1);f.crewCar=null;}
    if(w.kind==='car'&&vehicle(w.car)){
      if(!f.car){f.car=addCar({kind:'car',body:GRAY,x:w.car.x,y:w.car.y,hx:w.car.hx,hy:w.car.hy});f.car.remote=true;f.car.incidentGhost=true;}
      Object.assign(f.car,{x:w.car.x,y:w.car.y,ex:w.car.x,ey:w.car.y,hx:w.car.hx,hy:w.car.hy,parked:true,v:0,fireT:f.out?null:0,dmg:f.out?DMG_BAD:DMG_FIRE,fireIncident:f.out?null:f});
    }
  }
}
function netEmergencyMessage(type,data,from,p){
  if(type==='emergency'){
    if(!data||!Array.isArray(data.scenes)||data.scenes.length>16)return true;
    for(const w of data.scenes)acceptEmergencyWire(w,from);return true;
  }
  if(type!=='emergencyAct'&&type!=='emergencyWater')return false;
  if(!data||typeof data!=='object')return true;
  if(type==='emergencyAct'&&data.action==='release'){const f=emergencyIncidents().find(f=>f.id===data.id);if(f&&netIncidentOwned(f)){applyEmergencyAction(f,'release',from);emergencyNetT=0;}return true;}
  const s=netSample(p,netNow());
  if(!s||s.rk!=='out'||s.away)return true;
  if(type==='emergencyWater'){
    if(!['x','y','z','yaw','slope'].every(k=>netNum(data[k]))||near(s.x,s.y,data.x,data.y)>.6||s.veh||Math.abs(data.slope)>3||data.z<-.1||data.z>5)return true;
    const now=netNow(),last=emergencyWaterBuckets.get(from)||-1;
    if(now-last<.08)return true;emergencyWaterBuckets.set(from,now);
    const hit=hoseHit(data.x,data.y,data.z,data.yaw,data.slope);
    const end=hit?[hit.node.x,hit.node.y,hit.node.z]:Array.isArray(data.end)&&data.end.length===3&&data.end.every(netNum)&&near(data.x,data.y,data.end[0],data.end[1])<2.7?data.end:null;
    if(end)rememberWater(from,[data.x+Math.cos(data.yaw)*.08-Math.sin(data.yaw)*.026,data.y+Math.sin(data.yaw)*.08+Math.cos(data.yaw)*.026,data.z-.022],end);
    if(hit&&netIncidentOwned(hit.fire))coolFireNode(hit.fire,hit.node,.15);
    return true;
  }
  const f=emergencyIncidents().find(f=>f.id===data.id);if(!f||!netIncidentOwned(f))return true;
  const atCall=near(s.x,s.y,f.x,f.y)<1.8;
  if(data.action==='claim'&&near(s.x,s.y,f.x,f.y)<60)applyEmergencyAction(f,'claim',from);
  if(data.action==='release')applyEmergencyAction(f,'release',from,{x:s.x,y:s.y});
  if(data.action==='load'&&atCall&&!s.veh)applyEmergencyAction(f,'load',from);
  if(data.action==='deliver'&&s.veh?.kind==='amb'&&SERVICES.some(b=>b.kind==='amb'&&near(s.x,s.y,b.door[0],b.lane)<1.6)&&Math.abs(s.veh.v||0)<STOP_V)applyEmergencyAction(f,'deliver',from);
  emergencyNetT=0;return true;
}

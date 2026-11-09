// Real, bounded street incidents shared by dispatch and the player's shifts.
// Positions outdoors are ten-metre cells; pressure and heat are simulation seconds.
const cityFires=[];
let fireIncidentId=0;
const fireActive=f=>!!f&&!f.out&&Array.isArray(f.nodes)&&f.nodes.some(n=>n.heat>0);
function fireNode(x,y,z,heat=4){return {x:worldCoord(x),y:worldCoord(y),z,heat,max:heat};}
function createCarIncident(c){
  if(c.fireIncident&&fireActive(c.fireIncident))return c.fireIncident;
  if(c.wrecked||c.ev||c.remote)return null;
  const volatile=!!(c.owned||playerCar(c));
  Object.assign(c,{fireT:c.fireT??0,dmg:DMG_FIRE});
  if(!playerCar(c))Object.assign(c,{parked:true,v:0,ex:c.x,ey:c.y,bail:true});
  const [hl,hw,top]=VEHICLES[c.kind],x=c.x+c.hx*hl*.55,y=c.y+c.hy*hl*.55;
  const f={id:++fireIncidentId,kind:'car',x:c.x,y:c.y,born:T,car:c,volatile,nodes:[-.5,.5].map(s=>fireNode(x-c.hy*hw*s,y+c.hx*hw*s,top+.04,volatile?2:4))};
  c.fireIncident=f;cityFires.push(f);if(typeof registerIncident==='function')registerIncident(f);return f;
}
function createCityFire(at,kind=Math.random()<.55?'building':'car'){
  if(cityFires.filter(fireActive).length>=5)return null;
  const [x,y]=at;
  const sites=doors.filter(d=>!d.sh.base&&!d.sh.fee&&!d.sh.club&&!cityFires.some(f=>fireActive(f)&&near(f.x,f.y,d.x,d.y)<2)&&near(d.x,d.y,x,y)<8);
  const d=sites.reduce((best,d)=>!best||near(d.x,d.y,x,y)<near(best.x,best.y,x,y)?d:best,null);
  if(!d)return null;
  if(kind==='car'){
    const old=cars.find(c=>c.parked&&!c.mine&&!c.owned&&!c.ev&&!c.remote&&!c.wrecked&&!burning(c)&&near(c.x,c.y,d.x,d.y)<3);
    if(old)return createCarIncident(old);
    // A kerbside breakdown, outside the walking line and the building's entrance.
    const sx=d.nx?d.x-Math.sign(d.nx)*.18:d.x+.7,sy=d.ny?d.y-Math.sign(d.ny)*.18:d.y+.7;
    if(map[idx(sx,sy)]||isWater(sx,sy)||solidAt(sx,sy,.12)||cars.some(c=>near(c.ex,c.ey,sx,sy)<.6))return createCityFire(at,'building');
    const c=addCar({kind:'car',body:GRAY,x:worldCoord(sx),y:worldCoord(sy),hx:d.ny?1:0,hy:d.nx?1:0});
    c.incidentVehicle=true;return createCarIncident(c);
  }
  const nx=Math.sign(d.nx),ny=Math.sign(d.ny),cx=d.x+nx*.105,cy=d.y+ny*.105;
  const f={id:++fireIncidentId,kind:'building',x:d.x,y:d.y,born:T,site:d,
    nodes:[[-.22,.12],[.22,.12],[-.22,.28],[.22,.28]].map(([offset,z])=>fireNode(cx-ny*offset,cy+nx*offset,z,3))};
  cityFires.push(f);if(typeof registerIncident==='function')registerIncident(f);return f;
}
function coolFireNode(f,n,amount){
  if(!fireActive(f)||n.heat<=0)return false;
  n.heat=Math.max(0,n.heat-amount);f.wetUntil=T+.3;
  if(!f.nodes.some(n=>n.heat>0)){
    f.out=true;f.outAt=T;
    if(f.car){f.car.fireT=null;f.car.dmg=DMG_BAD;f.car.fireIncident=null;}
  }
  return true;
}
// A stream stops on the first facade, terrain or solid prop. Never spray through
// a building to reach a marker on the other side.
function fireWaterClear(x,y,z,tx,ty,tz){
  const dx=rel(tx-x),dy=rel(ty-y),dz=tz-z,steps=Math.ceil(Math.hypot(dx,dy)/.025);
  for(let j=1;j<steps;j++){
    const t=j/steps,xx=worldCoord(x+dx*t),yy=worldCoord(y+dy*t),zz=z+dz*t;
    if(map[idx(xx,yy)]>zz||terrainHeight(xx,yy)>zz||solidAt(xx,yy,.003))return false;
  }
  return true;
}
function hoseHit(x,y,z,yaw,slope,range=2.6){
  let best=null,dist=Infinity;
  for(const f of cityFires)if(fireActive(f))for(const n of f.nodes)if(n.heat>0){
    const dx=rel(n.x-x),dy=rel(n.y-y),forward=dx*Math.cos(yaw)+dy*Math.sin(yaw),side=-dx*Math.sin(yaw)+dy*Math.cos(yaw);
    if(forward<.05||forward>range||Math.abs(side)>.055+forward*.035||Math.abs(n.z-z-slope*forward)>.07+forward*.025)continue;
    if(forward<dist&&fireWaterClear(x,y,z,n.x,n.y,n.z)){best={fire:f,node:n};dist=forward;}
  }
  return best;
}
function fireCrewOrigin(c,f=c.fireIncident){
  const x=c.ex??c.x,y=c.ey??c.y;
  for(const side of [-1,1]){const xx=x-c.hy*side*.18,yy=y+c.hx*side*.18;
    if(!map[idx(xx,yy)]&&!solidAt(xx,yy,.015)&&f?.nodes.some(n=>n.heat>0&&fireWaterClear(xx,yy,.14,n.x,n.y,n.z)))return [xx,yy,.14];
  }
  return [x,y,.14];
}
function fireCrewTarget(c){
  const f=c.fireIncident;if(!fireActive(f)||c.mine||c.state!=='scene')return null;
  const origin=fireCrewOrigin(c);
  return f.nodes.find(n=>n.heat>0&&near(c.x,c.y,n.x,n.y)<4&&fireWaterClear(...origin,n.x,n.y,n.z))||null;
}
function stepCityFires(dt){
  for(const c of cars)if(burning(c)&&!c.ev&&!c.remote&&!c.fireIncident){
    const f=createCarIncident(c);if(f)spawnEmergency('fire',[f.x,f.y],f);
  }
  for(const c of cars){if(typeof incidentOwned==='function'&&!incidentOwned(c.fireIncident))continue;const n=fireCrewTarget(c);if(n)coolFireNode(c.fireIncident,n,dt*.9);}
  if(mode==='walk'&&!freecam)for(const f of cityFires)if(fireActive(f)&&f.nodes.some(n=>n.heat>0&&near(n.x,n.y,px,py)<.13))hurt(dt*5);
  for(let k=cityFires.length-1;k>=0;k--){
    const f=cityFires[k];
    if(f.car?.wrecked&&!f.out){f.failed=true;f.out=true;f.outAt=T;for(const n of f.nodes)n.heat=0;}
    // Keep active player calls until dealt with. Distant incidents otherwise burn
    // out, and their temporary parked breakdown is eventually towed.
    if((typeof incidentOwned!=='function'||incidentOwned(f))&&fireActive(f)&&!f.assigned&&T-f.born>300)for(const n of f.nodes)coolFireNode(f,n,n.heat);
    if(f.out&&T-f.outAt>30){if(f.crewCar){const i=cars.indexOf(f.crewCar);if(i>=0)cars.splice(i,1);}if(f.car?.incidentVehicle||f.car?.incidentGhost){const i=cars.indexOf(f.car);if(i>=0)cars.splice(i,1);}cityFires.splice(k,1);}
  }
}

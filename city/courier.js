let courierJob = null;
// best: fastest delivery per route id. A completed route unlocks any route that names it.
let courierRecords = { trips:0, earned:0, best:{}, failed:0 };
let climbing = null;
function courierBonus(route,seconds) {
  return Math.round(route.bonus*clamp((route.bonusUntil-seconds)/(route.bonusUntil-route.quick),0,1));
}
const courierUnlocked = route => !route.unlock || courierRecords.best[route.unlock] != null;
// hours: [from, until) in game hours, wrapping past midnight. A parcel already taken can be finished any time.
const courierInHours = route => !route.hours || (tod>=route.hours[0] || tod<route.hours[1]);
function startCourier(id='garden') {
  if(courierJob)return false;
  const route=COURIER_ROUTES.find(r=>r.id===id);
  if(!route||!courierUnlocked(route)||!courierInHours(route))return false;
  courierJob={id:route.id,took:0};return true;
}
// The speed bonus is for staying up top: reaching the street (a fall, or a walk round to an elevator) forfeits it.
// The parcel still pays, so the apartment elevators remain a way back after a fall. True the moment it's lost.
function stepCourier(dt) {
  if(!courierJob)return false;
  courierJob.took+=Math.max(0,dt);
  if(courierJob.street||mode!=='walk'||body.z>0)return false;
  return courierJob.street=true;
}
const courierJobBonus = () => courierJob.street?0:courierBonus(courierRoute(),courierJob.took);
function loadCourier(data) {
  courierJob=null;courierRecords={trips:0,earned:0,best:{},failed:0};
  const job=data?.job,records=data?.records;
  if(job && COURIER_ROUTES.some(r=>r.id===job.id) && Number.isFinite(job.took) && job.took>=0) {
    courierJob={id:job.id,took:job.took};
    if(job.street===true)courierJob.street=true;
  }
  if(!records)return;
  for(const key of ['trips','earned','failed'])if(Number.isFinite(records[key])&&records[key]>=0)
    courierRecords[key]=Math.floor(records[key]);
  // Saves from before the second route kept one best time, which could only be the garden's.
  const best=Number.isFinite(records.best)?{garden:records.best}:records.best;
  for(const route of COURIER_ROUTES)if(Number.isFinite(best?.[route.id])&&best[route.id]>=0)
    courierRecords.best[route.id]=best[route.id];
}
function failCourier() {
  if(!courierJob)return false;
  courierJob=null;courierRecords.failed++;return true;
}
// called off from the pause menu: the parcel goes back to the depot, no pay, nothing held against you
function cancelCourier() {
  if(!courierJob)return false;
  courierJob=null;return true;
}
function courierRoute() { return courierJob && COURIER_ROUTES.find(r=>r.id===courierJob.id); }
function courierAtRecipient() {
  const r=courierRoute();
  return !!r && !r.recipient.dead && !r.recipient.hidden && mode==='roof' && Math.abs(roofH-r.recipient.z)<.12 && near(px,py,r.recipient.x,r.recipient.y)<.3 && body.z<.5;
}
function finishCourier() {
  const route=courierRoute();
  if(!route || !courierAtRecipient())return null;
  const seconds=courierJob.took,street=!!courierJob.street,bonus=courierJobBonus(),pay=route.pay+bonus,best=courierRecords.best;
  earn(pay);courierRecords.trips++;courierRecords.earned+=pay;
  // Best times (and so unlocks) are for unbroken rooftop runs only.
  if(!street)best[route.id]=best[route.id]==null?seconds:Math.min(best[route.id],seconds);
  courierJob=null;return {route,pay,bonus,seconds,street};
}
// Where the HUD arrow points: the recipient while you're up on the roofs, and from anywhere else (the street, a car)
// back to the depot door, whose stairs are the way up again.
function courierGuide() {
  const r=courierRoute();
  if(mode==='roof')return [r.recipient,{label:r.label,radius:.3,stop:courierAtRecipient()?'DELIVER':'CLIMB UP'}];
  const [x,y]=COURIER_DEPOT.door;
  return [{x,y},{label:COURIER_COMPANY.toUpperCase(),radius:.3,stop:'GO IN'}];
}
function courierLadderNear() {
  if(!['walk','roof'].includes(mode) || body.z>.5)return null;
  const z=mode==='roof'?roofH:0;
  for(const ladder of COURIER_LADDERS)for(const end of ['bottom','top']) {
    const p=ladder[end];
    if(Math.abs(z-p[2])<.12 && near(px,py,p[0],p[1])<.35)return {ladder,end};
  }
  return null;
}

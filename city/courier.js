let courierJob = null;
let courierRecords = { trips:0, earned:0, best:null, failed:0 };
let climbing = null;
function courierBonus(route,seconds) {
  return Math.round(route.bonus*clamp((route.bonusUntil-seconds)/(route.bonusUntil-route.quick),0,1));
}
function startCourier(id='garden') {
  if(courierJob)return false;
  const route=COURIER_ROUTES.find(r=>r.id===id);
  if(!route)return false;
  courierJob={id:route.id,took:0};return true;
}
function stepCourier(dt) { if(courierJob)courierJob.took+=Math.max(0,dt); }
function loadCourier(data) {
  courierJob=null;courierRecords={trips:0,earned:0,best:null,failed:0};
  const job=data?.job,records=data?.records;
  if(job && COURIER_ROUTES.some(r=>r.id===job.id) && Number.isFinite(job.took) && job.took>=0)
    courierJob={id:job.id,took:job.took};
  if(!records)return;
  for(const key of ['trips','earned','failed'])if(Number.isFinite(records[key])&&records[key]>=0)
    courierRecords[key]=Math.floor(records[key]);
  if(Number.isFinite(records.best)&&records.best>=0)courierRecords.best=records.best;
}
function failCourier() {
  if(!courierJob)return false;
  courierJob=null;courierRecords.failed++;return true;
}
function courierRoute() { return courierJob && COURIER_ROUTES.find(r=>r.id===courierJob.id); }
function courierAtRecipient() {
  const r=courierRoute();
  return !!r && mode==='roof' && Math.abs(roofH-r.recipient.z)<.12 && near(px,py,r.recipient.x,r.recipient.y)<.3 && body.z<.5;
}
function finishCourier() {
  const route=courierRoute();
  if(!route || !courierAtRecipient())return null;
  const seconds=courierJob.took,bonus=courierBonus(route,seconds),pay=route.pay+bonus;
  earn(pay);courierRecords.trips++;courierRecords.earned+=pay;
  courierRecords.best=courierRecords.best==null?seconds:Math.min(courierRecords.best,seconds);
  courierJob=null;return {pay,bonus,seconds};
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

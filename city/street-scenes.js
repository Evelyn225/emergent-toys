// Small authored street stories. Coordinates are chosen on the finished city;
// time and saved state drive them even when the player is elsewhere.
const STREET_SCENES = { railway: null, chalk: null, moving: null, boxes: [] };
const streetSceneState = { chalkDay: -1, wash: 0, lampWeek: -1, demoUntil: -1 };
const movingWeek = () => Math.floor(dayNum / 7);
const movingPhase = () => !STREET_SCENES.moving || mod(dayNum, 7) !== 4 ? 'quiet' : tod < 9 ? 'quiet' : tod < 17 ? 'loading' : 'leftovers';
function chalkProgress() {
  return clamp((tod - 9) / 7, 0, 1);
}
const chalkWash = () => streetSceneState.chalkDay === dayNum ? streetSceneState.wash : 0;
function stepStreetScenes(dt) {
  if (streetSceneState.chalkDay !== dayNum) {
    streetSceneState.chalkDay = dayNum;
    streetSceneState.wash = 0;
  }
  if (tod >= 9) streetSceneState.wash = clamp(streetSceneState.wash + Math.max(0, rain - .12) * dt / 45, 0, 1);
}
function loadStreetScenes(raw) {
  streetSceneState.chalkDay = Number.isInteger(raw?.chalkDay) ? raw.chalkDay : dayNum;
  streetSceneState.wash = clamp(Number(raw?.wash) || 0, 0, 1);
  streetSceneState.lampWeek = Number.isInteger(raw?.lampWeek) ? raw.lampWeek : -1;
  streetSceneState.demoUntil = -1;
}
function streetSceneBoxActive(o) {
  const phase = movingPhase();
  return o.leftover ? phase === 'leftovers' && streetSceneState.lampWeek !== movingWeek() : phase === 'loading';
}
function streetSceneHeight(x, y) {
  const site = STREET_SCENES.moving;
  if (!site || Math.abs(x-site.x)>2 || Math.abs(y-site.y)>2) return 0;
  let height = 0;
  for (const o of STREET_SCENES.boxes) if (streetSceneBoxActive(o) && architectureContains(o,x,y)) height = Math.max(height,o.z1);
  return height;
}
function streetSceneBlocked(x,y,pad=.03,z=0) {
  const site=STREET_SCENES.moving;
  if(!site||Math.abs(x-site.x)>2||Math.abs(y-site.y)>2)return false;
  return STREET_SCENES.boxes.some(o=>streetSceneBoxActive(o)&&z<o.z1&&z+.17>o.z0&&architectureContains(o,x,y,pad));
}
function streetSceneCarClear(x,y,hx,hy,hl,hw) {
  const site=STREET_SCENES.moving;
  if(!site||Math.abs(x-site.x)>3||Math.abs(y-site.y)>3)return true;
  const box={x,y,c:hx,s:hy,hl,hw,z0:0,z1:.25};
  return !STREET_SCENES.boxes.some(o=>streetSceneBoxActive(o)&&streetBoxesOverlap(box,o,0));
}
function railwayClock() {
  // A short station stop each lap; the button runs an after-hours demonstration.
  const running = tod >= 8 && tod < 22 || T < streetSceneState.demoUntil;
  const cycle = mod(T,24), travel = cycle < 3 ? 0 : (cycle-3)/21;
  return { running, stopped: !running || cycle < 3, angle: running ? travel*TAU : 0 };
}
function railwayPoint(angle) {
  const u=.255*Math.cos(angle),v=.23+.105*Math.sin(angle);
  const rise = v < .23 ? .018 * terrainEase(clamp((.105-Math.abs(u))/.045,0,1)) : 0;
  return {x:u,y:v,z:.078+rise,c:-.255*Math.sin(angle),s:.105*Math.cos(angle)};
}
// Equal arc distances keep the coaches coupled around both ends of the oval.
const RAILWAY_ARC = new Float64Array(257);
for(let k=1;k<RAILWAY_ARC.length;k++) {
  const a=(k-1)/256*Math.PI*2,b=k/256*Math.PI*2;
  RAILWAY_ARC[k]=RAILWAY_ARC[k-1]+Math.hypot(.255*(Math.cos(b)-Math.cos(a)),.105*(Math.sin(b)-Math.sin(a)));
}
function railwayAtDistance(distance) {
  const at=mod(distance,RAILWAY_ARC[256]);let lo=0,hi=256;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(RAILWAY_ARC[mid]<at)lo=mid;else hi=mid;}
  return railwayPoint((lo+(at-RAILWAY_ARC[lo])/(RAILWAY_ARC[hi]-RAILWAY_ARC[lo]))/256*TAU);
}

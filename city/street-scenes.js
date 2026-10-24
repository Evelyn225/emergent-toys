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
// One sampled centreline supplies the rails, bridge and rolling stock. Include
// exact grade junctions so the approach solids meet the level bridge deck.
const RAILWAY_ANGLES=Array.from({length:128},(_,k)=>k/128*Math.PI*2);
for(const x of [-.15,-.06,.06,.15]){const a=Math.acos(x/.255);RAILWAY_ANGLES.push(a,Math.PI*2-a);}
RAILWAY_ANGLES.sort((a,b)=>a-b);RAILWAY_ANGLES.push(Math.PI*2);
const RAILWAY_PATH=RAILWAY_ANGLES.map(angle=>{
  const x=.255*Math.cos(angle),cap=Math.max(0,Math.abs(x)-.15),upper=Math.sin(angle)>=0;
  // Straight front/rear runs, with round ends. The bridge grades belong on
  // straight track, so both rail heads and rigid wheelsets share one plane.
  const y=.23+(upper?1:-1)*Math.sqrt(Math.max(0,.105*.105-cap*cap));
  const t=upper?0:clamp((.15-Math.abs(x))/.09,0,1),rise=.018*t*t*(3-2*t);
  const c=cap>1e-12?-(y-.23):(upper?-1:1),s=cap>1e-12?x-Math.sign(x)*.15:0,length=Math.hypot(c,s);
  return {x,y,z:.082+rise,c:c/length,s:s/length};
});
const RAILWAY_ARC=new Float64Array(RAILWAY_PATH.length);
for(let k=1;k<RAILWAY_PATH.length;k++){
  const a=RAILWAY_PATH[k-1],b=RAILWAY_PATH[k];
  RAILWAY_ARC[k]=RAILWAY_ARC[k-1]+Math.hypot(b.x-a.x,b.y-a.y);
}
const RAILWAY_LENGTH=RAILWAY_ARC[RAILWAY_ARC.length-1];
function railwaySample(k,t) {
  const a=RAILWAY_PATH[k],b=RAILWAY_PATH[k+1];
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,c:b.x-a.x,s:b.y-a.y};
}
function railwayPoint(angle) {
  const at=mod(angle,Math.PI*2);let lo=0,hi=RAILWAY_ANGLES.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(RAILWAY_ANGLES[mid]<at)lo=mid;else hi=mid;}
  return railwaySample(lo,(at-RAILWAY_ANGLES[lo])/(RAILWAY_ANGLES[hi]-RAILWAY_ANGLES[lo]));
}
// Equal horizontal arc distances keep the coaches coupled around both ends.
function railwayAtDistance(distance) {
  const at=mod(distance,RAILWAY_LENGTH);let lo=0,hi=RAILWAY_ARC.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(RAILWAY_ARC[mid]<at)lo=mid;else hi=mid;}
  return railwaySample(lo,(at-RAILWAY_ARC[lo])/(RAILWAY_ARC[hi]-RAILWAY_ARC[lo]));
}

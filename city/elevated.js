// ---- the elevated train: a steel deck on pillars along H(., EL_ROW).
// The live archipelago has a finite east-west route; trains reverse at both terminals.
// The source-city fixture below retains its original wrapping loop.
// Stations every 8 blocks, with narrow platforms over the sidewalks and stairs down to the street.
// The deck is 12m wide over the middle of the street (clear of the building faces either side) and high enough
// that the street lamps fit under it: y EL_Y0..EL_Y1, z EL_BOT..EL_TOP.
let EL_Y = EL_ROW * 8, EL_HALF = 0.6, EL_Y0 = EL_Y + 1 - EL_HALF, EL_Y1 = EL_Y + 1 + EL_HALF, EL_BOT = 1.15, EL_TOP = 1.27;
const EL_TRACK = [EL_Y + 0.78, EL_Y + 1.22]; // [north track, south track]; direction comes from elTrain().dir
const EL_PLAT = [EL_Y0 + 0.08, EL_Y1 - 0.08]; // where you stand on each platform, along the deck's edges
const underEl = (y,x=px) => (!worldReady||x>=140&&x<=352)&&Math.abs(rel(y - (EL_Y + 1))) < EL_HALF;
const EL_STATIONS = [2, 10, 18, 26].map(bx => ({ x: bx * 8 + 5, x0: bx * 8 + 2.6, x1: bx * 8 + 7.4, name: AVE_NAMES[bx] }));
const elStationAt = x => EL_STATIONS.find(s => worldReady ? x>=s.x0&&x<s.x1 : worldCoord(x - s.x0) < s.x1 - s.x0);
const EL_PLATFORM_OUT=.05;
function elPlatformSurface(x,y){const s=elStationAt(x);return !!s&&(Math.abs(rel(y-EL_Y0))<=EL_PLATFORM_OUT+1e-8||Math.abs(rel(y-EL_Y1))<=EL_PLATFORM_OUT+1e-8);}
const elDeckHeight = (x,y) => underEl(y,x)||elPlatformSurface(x,y) ? EL_TOP : 0;
function elPlatformAt(x,y) {
  if(!elDeckHeight(x,y))return null;
  const s=elStationAt(x);
  if(!s)return null;
  for(const tr of [0,1])if(Math.abs(rel(y-EL_PLAT[tr]))<.14||(tr?y>EL_PLAT[tr]&&y<=EL_Y1+EL_PLATFORM_OUT:y<EL_PLAT[tr]&&y>=EL_Y0-EL_PLATFORM_OUT))return {s,tr};
  return null;
}
// ---- the stairs up: one per platform, a straight run along the curb side of the sidewalk (clear of the bays and
// balconies on the buildings). Two flights with a landing halfway, then a landing at the top that runs out onto the
// platform's end. In each stair's own frame u runs along the street (up the stairs) and v out from the building face
// toward the deck; st.ox, st.oy is the face at the station's middle, st.off how far along it's been slid to find a
// clear run (streetscape.js). A turnstile at the foot (st.x, st.y: where you stand to swipe).
const ELS = { u0: -1.3, u1: -0.25, u2: -0.05, u3: 1.0, u4: 1.3, v0: 0.19, v1: 0.35, top: 0.35 };
// The top landing meets the deck edge, without overlapping its upper surface.
const ELS_POSTS = [[(ELS.u0+ELS.u1)/2,EL_TOP/4],[ELS.u1,EL_TOP/2],[ELS.u2,EL_TOP/2],[(ELS.u2+ELS.u3)/2,EL_TOP*.75],[ELS.u3,EL_TOP],[ELS.u4,EL_TOP]];
let elStairOn = null; // the stair surface occupied by the player; null while walking underneath
for (const s of EL_STATIONS) s.stairs = [0, 1].map(tr => {
  const ay = tr ? -1 : 1, oy = tr ? EL_Y + 2 : EL_Y; // (c, s: u's direction; for the south side, u runs west)
  return elStairFoot({ tr, ox: s.x, oy, ax: 0, ay, c: ay, s: 0, off: 0 });
});
function elStairFoot(st) { st.x = worldCoord(st.ox + st.c * (st.off + ELS.u0 - 0.08)); st.y = st.oy + st.ay * (ELS.v0 + ELS.v1) / 2; return st; }
// the stairs' steelwork as boxes (for the street clearance): the flights in short pieces, the landings, the top
const elStairBoxes = st => {
  const out = [], at = (u, v) => [worldCoord(st.ox + st.c * (st.off + u) + st.ax * v), st.oy + st.s * (st.off + u) + st.ay * v];
  for (let u = ELS.u0 + 0.05; u < ELS.u3; u += 0.1) {
    const [x, y] = at(u, (ELS.v0 + ELS.v1) / 2), g = elStairGround(x, y);
    out.push({ x, y, c: 1, s: 0, hl: 0.05, hw: (ELS.v1 - ELS.v0) / 2 + 0.01, z0: Math.max(0, g - 0.04), z1: g + 0.2 });
  }
  const [x, y] = at((ELS.u3 + ELS.u4) / 2, (ELS.v0 + ELS.top - 0.06) / 2);
  out.push({ x, y, c: 1, s: 0, hl: (ELS.u4 - ELS.u3) / 2 + 0.01, hw: (ELS.top - 0.06 - ELS.v0) / 2, z0: EL_TOP - 0.04, z1: EL_TOP + 0.2 });
  return out;
};
// where (x, y) is on a station's stairs: { st, s, u, v, g } (g: the height of the treads, landings or top under you), or null
function elStairAt(x, y) {
  if (Math.abs(rel(y - EL_Y - 1)) > 1.05) return null; // (nowhere near the el's street)
  for (const s of EL_STATIONS) {
    const dx = rel(x - s.x);
    if (Math.abs(dx) > 2.9) continue;
    for (const st of s.stairs) {
      const dy = rel(y - st.oy), u = st.c * dx + st.s * dy - st.off, v = st.ax * dx + st.ay * dy;
      const H = EL_TOP, lane = v >= ELS.v0 && v <= ELS.v1;
      let g = -1;
      if (u >= ELS.u3 && u <= ELS.u4 && v >= ELS.v0 && v <= ELS.top) g = H; // the top landing
      else if (lane && u >= ELS.u0 && u < ELS.u1) g = (u - ELS.u0) / (ELS.u1 - ELS.u0) * H / 2; // the first flight
      else if (lane && u >= ELS.u1 && u < ELS.u2) g = H / 2; // the landing halfway
      else if (lane && u >= ELS.u2 && u < ELS.u3) g = H / 2 + (u - ELS.u2) / (ELS.u3 - ELS.u2) * H / 2; // the second
      if (g >= 0) return { st, s, u, v, g };
    }
  }
  return null;
}
const elStairGround = (x, y) => { const h = elStairAt(x, y); return h ? h.g : 0; };
const elWalkGround = (x,y) => { const h=elStairAt(x,y);return h&&h.st===elStairOn?h.g:0; };
function elStairPostAt(x,y,feet,height=.17,pad=.025) {
  if(Math.abs(rel(y-EL_Y-1))>1.1)return false;
  for(const station of EL_STATIONS) for(const st of station.stairs) {
    const dx=rel(x-st.ox),dy=rel(y-st.oy),u=st.c*dx+st.s*dy-st.off,v=st.ax*dx+st.ay*dy;
    if(v<ELS.v0-pad||v>ELS.v1+pad||u<ELS.u0||u>ELS.u4+pad)continue;
    for(const [pu,z] of ELS_POSTS)for(const pv of [ELS.v0+.01,ELS.v1-.01])
      if(feet<z-.015&&feet+height>0&&Math.abs(u-pu)<.008+pad&&Math.abs(v-pv)<.008+pad)return true;
  }
  return false;
}
// walking from (x0, y0) to (x, y) as the stairs see it: true (blocked), false (fine), or null (nothing to do with them).
// On the stairs you keep to them (the rails), up or down a step at a time, or off the top onto the deck; from the
// street you can only step onto the bottom step, and only once you've swiped through the turnstile (pass)
const EL_TREAD = 0.08;
function elStairStep(x0, y0, x, y, pass, feet=elStairGround(x0,y0), height=.17) {
  const a = elStairAt(x0, y0), b = elStairAt(x, y);
  const on=a&&feet>=a.g-.025;
  if(!on) {
    if(elStairPostAt(x,y,feet,height))return true;
    if(b&&feet+height<b.g-.02)return null; // enough headroom beneath the steel treads
  }
  if (!a && !b) return null;
  if (on) { // on them: a step at a time; off the bottom, or off the top onto the deck, but not over the rails
    if (!b) return a.g > EL_TREAD * 0.6 && !(elDeckHeight(x,y) && a.g > EL_TOP - 0.01);
    return Math.abs(b.g - a.g) > EL_TREAD;
  }
  if (!b)return null;
  if (b.g > EL_TREAD * 0.6) return true; // low treads without headroom cannot be walked through
  return !(pass && pass.st === b.st); // the bottom step, through the turnstile
}

// Guard the station's outer edge and ends. The train-facing edge stays open for boarding,
// and the outer edge has a gap exactly where the stair landing joins it.
const EL_RAIL_H=.11, EL_RAIL_R=.004;
function elPlatformRails(station,tr) {
  const st=station.stairs[tr],y=tr?EL_Y1+EL_PLATFORM_OUT:EL_Y0-EL_PLATFORM_OUT,inner=EL_PLAT[tr]+(tr?-.12:.12);
  const ends=[ELS.u3,ELS.u4].map(u=>st.ox+st.c*(st.off+u)).sort((a,b)=>a-b);
  const lo=clamp(ends[0],station.x0,station.x1),hi=clamp(ends[1],station.x0,station.x1);
  return [[station.x0,y,lo,y],[hi,y,station.x1,y],[station.x0,y,station.x0,inner],[station.x1,y,station.x1,inner]];
}
function elPlatformRailAt(x,y,feet,pad=.025) {
  if(feet>EL_TOP+EL_RAIL_H||feet+.17<EL_TOP||Math.abs(rel(y-EL_Y-1))>EL_HALF+EL_PLATFORM_OUT+.03)return false;
  for(const station of EL_STATIONS) {
    if(Math.abs(rel(x-station.x))>3)continue;
    for(const tr of [0,1])for(const [ax,ay,bx,by] of elPlatformRails(station,tr)) {
      const dx=rel(bx-ax),dy=by-ay,rx=rel(x-ax),ry=rel(y-ay),d=dx*dx+dy*dy;
      const t=d?clamp((rx*dx+ry*dy)/d,0,1):0;
      if(Math.hypot(rx-t*dx,ry-t*dy)<EL_RAIL_R+pad)return true;
    }
  }
  return false;
}

// pillars at both curbs, clear of the cross streets
const elPillars = [];
for (let bx = 0; bx < NB; bx++) for (const s of [2.6, 4.6, 6.6]) for (const y of [EL_Y0 + 0.05, EL_Y1 - 0.05]) elPillars.push({ x: bx * 8 + s, y });
const elPillarsB = bucketed(elPillars);

// trains: each runs the loop stopping at every station. A hop is HOP_T seconds of travel (eased in and out),
// then DWELL seconds with the doors open. Two trains per track, half a loop apart.
const HOP = N / EL_STATIONS.length, HOP_T = 26, DWELL = 10, EL_CYCLE = (HOP_T + DWELL) * EL_STATIONS.length, EL_CARS = 3, EL_CAR_LEN = 1.9;
const EL_HL = EL_CAR_LEN / 2 - 0.03, EL_HW = 0.14, EL_H = 0.32;
const smooth = v => v * v * (3 - 2 * v);
// where train k on track tr (0 north, 1 south) is at time t: {x of its middle, dir, stopped, station index it's at or leaving}
function elTrain(tr, k, t) {
  if(worldReady) {
    const sequence=[0,1,2,3,2,1],period=(HOP_T+DWELL)*sequence.length,c=mod(t+tr*period/2,period),hop=Math.floor(c/(HOP_T+DWELL)),p=c-hop*(HOP_T+DWELL);
    const from=sequence[hop],next=sequence[(hop+1)%sequence.length],moving=p>=DWELL,dir=Math.sign(next-from);
    return {x:EL_STATIONS[from].x+(EL_STATIONS[next].x-EL_STATIONS[from].x)*(moving?smooth((p-DWELL)/HOP_T):0),dir,stopped:!moving,station:from,next,left:moving?HOP_T-(p-DWELL):DWELL-p};
  }
  const dir = tr ? 1 : -1, c = mod(t + k * EL_CYCLE / 2 + tr * 17, EL_CYCLE), hop = Math.floor(c / (HOP_T + DWELL)), p = c - hop * (HOP_T + DWELL);
  const from = tr ? hop : (EL_STATIONS.length - hop) % EL_STATIONS.length; // station index it set off from
  const x0 = EL_STATIONS[from].x, moving = p >= DWELL;
  return { x: worldCoord(x0 + dir * HOP * (moving ? smooth((p - DWELL) / HOP_T) : 0)), dir, stopped: !moving, station: from,
           left: moving ? HOP_T - (p - DWELL) : DWELL - p, // seconds until it arrives / until it leaves
           next: (from + (tr ? 1 : EL_STATIONS.length - 1)) % EL_STATIONS.length };
}
const elTrainKeys = () => worldReady ? [0] : [0,1];
const elTrains = t => [0, 1].flatMap(tr => elTrainKeys().map(k => ({ tr, k, ...elTrain(tr, k, t) })));
// Sweep the player's body against each moving car, including crossings between frames and across the world seam.
function elTrainImpact(from,to,t0,t1,height=.17) {
  const bottom=EL_TOP+.02,top=bottom+EL_H,radius=.025;
  if(Math.max(from[2],to[2])+height<bottom || Math.min(from[2],to[2])>top)return null;
  for(const tr of [0,1]) {
    const y0=rel(from[1]-EL_TRACK[tr]),y1=y0+rel(to[1]-from[1]);
    if(Math.min(y0,y1)>EL_HW+radius||Math.max(y0,y1)<-EL_HW-radius)continue;
    for(const k of elTrainKeys()) {
      const before=elTrain(tr,k,t0),after=elTrain(tr,k,t1);
      if(before.stopped&&after.stopped)continue;
      for(let j=0;j<EL_CARS;j++) {
        const carX=before.x-before.dir*(j-1)*EL_CAR_LEN;
        const start=[rel(from[0]-carX),rel(from[1]-EL_TRACK[tr]),from[2]];
        const delta=[rel(to[0]-from[0])-rel(after.x-before.x),rel(to[1]-from[1]),to[2]-from[2]];
        const bounds=[[-EL_HL-radius,EL_HL+radius],[-EL_HW-radius,EL_HW+radius],[bottom-height,top]];
        let enter=0,leave=1;
        for(let axis=0;axis<3;axis++) {
          const [lo,hi]=bounds[axis],speed=delta[axis],position=start[axis];
          if(Math.abs(speed)<1e-10) { if(position<lo||position>hi){leave=-1;break;} }
          else {
            const a=(lo-position)/speed,b=(hi-position)/speed;
            enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
          }
        }
        if(enter<=leave)return {tr,k};
      }
    }
  }
  return null;
}

function elNextArrival(station,tr,t=T){
 const now=elTrains(t).filter(o=>o.tr===tr);
 const here=now.find(o=>o.stopped&&EL_STATIONS[o.station]===station);if(here)return {...here,seconds:0};
 for(let seconds=1;seconds<=EL_CYCLE*2;seconds++){
  const arrival=elTrains(t+seconds).find(o=>o.tr===tr&&o.stopped&&EL_STATIONS[o.station]===station);
  if(arrival)return {...arrival,seconds};
 }
 return null;
}
function elTrainBodyAt(x,y,z){
 if(z+.17<EL_TOP+.02||z>EL_TOP+.02+EL_H)return false;
 return elTrains(T).some(t=>Math.abs(rel(y-EL_TRACK[t.tr]))<EL_HW+.025&&Array.from({length:EL_CARS},(_,j)=>t.x-t.dir*(j-1)*EL_CAR_LEN).some(cx=>Math.abs(rel(x-cx))<EL_HL+.025));
}

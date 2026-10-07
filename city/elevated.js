// ---- the elevated train: a steel deck on pillars over the whole length of H(., EL_ROW), which wraps round the world
// east-west, so the line is a loop. Two tracks: westbound on the north half, eastbound on the south half.
// Stations every 8 blocks, with narrow platforms over the sidewalks and stairs down to the street.
// The deck is 12m wide over the middle of the street (clear of the building faces either side) and high enough
// that the street lamps fit under it: y EL_Y0..EL_Y1, z EL_BOT..EL_TOP.
const EL_Y = EL_ROW * 8, EL_HALF = 0.6, EL_Y0 = EL_Y + 1 - EL_HALF, EL_Y1 = EL_Y + 1 + EL_HALF, EL_BOT = 1.15, EL_TOP = 1.27;
const EL_TRACK = [EL_Y + 0.78, EL_Y + 1.22]; // [westbound, eastbound]
const EL_PLAT = [EL_Y0 + 0.08, EL_Y1 - 0.08]; // where you stand on each platform, along the deck's edges
const underEl = y => Math.abs(rel(y - (EL_Y + 1))) < EL_HALF; // under (or on) the deck
const EL_STATIONS = [2, 10, 18, 26].map(bx => ({ x: bx * 8 + 5, x0: bx * 8 + 2.6, x1: bx * 8 + 7.4, name: AVE_NAMES[bx] }));
const elStationAt = x => EL_STATIONS.find(s => mod(x - s.x0, N) < s.x1 - s.x0);
const elDeckHeight = (x,y) => underEl(y) ? EL_TOP : 0;
function elPlatformAt(x,y) {
  if(!underEl(y))return null;
  const s=elStationAt(x);
  if(!s)return null;
  for(const tr of [0,1])if(Math.abs(rel(y-EL_PLAT[tr]))<.14)return {s,tr};
  return null;
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
// where train k on track tr (0 west, 1 east) is at time t: {x of its middle, dir, stopped, station index it's at or leaving}
function elTrain(tr, k, t) {
  const dir = tr ? 1 : -1, c = mod(t + k * EL_CYCLE / 2 + tr * 17, EL_CYCLE), hop = Math.floor(c / (HOP_T + DWELL)), p = c - hop * (HOP_T + DWELL);
  const from = tr ? hop : (EL_STATIONS.length - hop) % EL_STATIONS.length; // station index it set off from
  const x0 = EL_STATIONS[from].x, moving = p >= DWELL;
  return { x: mod(x0 + dir * HOP * (moving ? smooth((p - DWELL) / HOP_T) : 0), N), dir, stopped: !moving, station: from,
           left: moving ? HOP_T - (p - DWELL) : DWELL - p, // seconds until it arrives / until it leaves
           next: (from + (tr ? 1 : EL_STATIONS.length - 1)) % EL_STATIONS.length };
}
const elTrains = t => [0, 1].flatMap(tr => [0, 1].map(k => ({ tr, k, ...elTrain(tr, k, t) })));
// Sweep the player's body against each moving car, including crossings between frames and across the world seam.
function elTrainImpact(from,to,t0,t1,height=.17) {
  const bottom=EL_TOP+.02,top=bottom+EL_H,radius=.025;
  if(Math.max(from[2],to[2])+height<bottom || Math.min(from[2],to[2])>top)return null;
  for(const tr of [0,1]) {
    const y0=rel(from[1]-EL_TRACK[tr]),y1=y0+rel(to[1]-from[1]);
    if(Math.min(y0,y1)>EL_HW+radius||Math.max(y0,y1)<-EL_HW-radius)continue;
    for(const k of [0,1]) {
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

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
// pillars at both curbs, clear of the cross streets
const elPillars = [];
for (let bx = 0; bx < NB; bx++) for (const s of [2.6, 4.6, 6.6]) for (const y of [EL_Y0 + 0.05, EL_Y1 - 0.05]) elPillars.push({ x: bx * 8 + s, y });
const elPillarsB = bucketed(elPillars);

// trains: each runs the loop stopping at every station. A hop is HOP_T seconds of travel (eased in and out),
// then DWELL seconds with the doors open. Two trains per track, half a loop apart.
const HOP = N / EL_STATIONS.length, HOP_T = 26, DWELL = 10, EL_CYCLE = (HOP_T + DWELL) * EL_STATIONS.length, EL_CARS = 3, EL_CAR_LEN = 1.9;
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

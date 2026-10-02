// ---- the elevated train: a steel deck on pillars over the whole length of H(., EL_ROW), which wraps round the world
// east-west, so the line is a loop. Two tracks: westbound on the north half, eastbound on the south half.
// Stations every 8 blocks, with narrow platforms over the sidewalks and stairs down to the street.
const EL_Y = EL_ROW * 8, EL_BOT = 0.55, EL_TOP = 0.68; // deck spans y EL_Y..EL_Y+2, between these heights
const EL_TRACK = [EL_Y + 0.6, EL_Y + 1.4]; // [westbound, eastbound]
const EL_PLAT = [EL_Y + 0.15, EL_Y + 1.85]; // where you stand on each platform
const onEl = (mx, my) => (my & (N - 1)) - EL_Y >>> 0 < 2; // a deck cell
const EL_STATIONS = [2, 10, 18, 26].map(bx => ({ x: bx * 8 + 5, x0: bx * 8 + 2.6, x1: bx * 8 + 7.4, name: AVE_NAMES[bx] }));
const elStationAt = x => EL_STATIONS.find(s => mod(x - s.x0, N) < s.x1 - s.x0);
// pillars at both curbs, clear of the cross streets
const elPillars = [];
for (let bx = 0; bx < NB; bx++) for (const s of [2.6, 4.6, 6.6]) for (const y of [EL_Y + 0.12, EL_Y + 1.88]) elPillars.push({ x: bx * 8 + s, y });
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

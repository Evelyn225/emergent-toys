// Grind paths use absolute world heights and 3D arc lengths. Segments are
// indexed in every block they cross, rather than only at a long rail's midpoint.
const GRIND_PATHS = [], grindPathBuckets = new Map();
const GRIND_FRICTION = { metal: .02, concrete: .04, stone: .06, wood: .08 };
function addGrindPath(points, meta = {}) {
  if (points.length < 2) return null;
  const path = { ...meta, points, segments: [], length: 0 };
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1], to = points[i], d = to.map((v, j) => v - from[j]), len = Math.hypot(...d);
    if (len < 1e-7) continue;
    const seg = { path, from, to, d, len, at: path.length };
    path.segments.push(seg); path.length += len;
    for (let bx = Math.floor(Math.min(from[0], to[0]) / 8); bx <= Math.floor(Math.max(from[0], to[0]) / 8); bx++)
      for (let by = Math.floor(Math.min(from[1], to[1]) / 8); by <= Math.floor(Math.max(from[1], to[1]) / 8); by++) {
        const key = bx + ',' + by, list = grindPathBuckets.get(key) || [];
        list.push(seg); grindPathBuckets.set(key, list);
      }
  }
  if (!path.segments.length) return null;
  path.closed = points.length > 2 && Math.hypot(...points[0].map((v, i) => v - points.at(-1)[i])) < 1e-7;
  GRIND_PATHS.push(path); return path;
}
function grindPathAt(path, distance) {
  const at = clamp(distance, 0, path.length);
  const seg = path.segments.find(s => at <= s.at + s.len) || path.segments.at(-1);
  const t = clamp((at - seg.at) / seg.len, 0, 1);
  return { seg, p: seg.from.map((v, i) => v + seg.d[i] * t), tangent: seg.d.map(v => v / seg.len) };
}
function grindPathNearest(seg, x, y) {
  const [dx, dy] = seg.d, len2 = dx * dx + dy * dy;
  const t = len2 > 1e-12 ? clamp(((x - seg.from[0]) * dx + (y - seg.from[1]) * dy) / len2, 0, 1) : 0;
  const p = seg.from.map((v, i) => v + seg.d[i] * t);
  return { p, distance: seg.at + t * seg.len, gap: Math.hypot(x - p[0], y - p[1]) };
}
function grindFamily(angle, kind, x, y, side = 1) {
  if (angle > 1.13) return Math.abs(y) > .4 ? y < 0 ? 'noseslide' : 'tailslide'
    : kind === 'skateledge' || kind === 'manualpad' || kind === 'kerb' ? 'lipslide' : 'boardslide';
  if (angle > .44) return Math.abs(x) > .4 ? x * side < 0 ? 'smith' : 'feeble' : y < -.4 ? 'overcrook' : 'crooked grind';
  return y < -.4 ? 'nosegrind' : y > .4 ? '5-0' : '50-50';
}
function buildGrindPaths() {
  GRIND_PATHS.length = 0; grindPathBuckets.clear();
  for (const g of GRINDS) {
    const height = terrainHeight(g.x, g.y) + g.z;
    addGrindPath(g.points || [[g.ax, g.ay, height], [g.bx, g.by, height]], { ...g, legacy: g });
  }
  // Kerbstones already drawn by road-surface.js: retain their real surface
  // height, including hills and bridges, and stop before each crossing.
  for (const offset of [.3, 1.7]) alongStreets(5, offset, (x, y, ax, ay, bx, by, ori) => {
    const points = [];
    for (let u = -2.5; u <= 2.5; u += .5) {
      const xx = x + (ori === 'h' ? u : 0), yy = y + (ori === 'v' ? u : 0);
      if (isWater(xx, yy)) return;
      points.push([xx, yy, roadGroundHeight(xx, yy) + .001]);
    }
    addGrindPath(points, { kind: 'kerb', material: 'stone', feature: points, district: districtOf(bx, by) });
  });
  for (const o of ARCH_DETAILS) {
    if (o.kind !== 'rail' && o.kind !== 'planter') continue;
    if (o.z1 > .3) continue; // balcony planters are not street furniture
    const point = (u, v, z) => [o.x + o.c * u - o.s * v, o.y + o.s * u + o.c * v, terrainHeight(o.x, o.y) + z];
    if (o.kind === 'rail') {
      const points = [-o.hl, 0, o.hl].map(u => point(u, 0, .1 + .12 * clamp((.18 - u * (o.c * o.nx + o.s * o.ny) - .075) / .145, 0, 1)));
      addGrindPath(points, { kind: 'handrail', material: 'metal', feature: o });
    } else for (const side of [-1, 1]) addGrindPath([point(-o.hl, side * o.hw, o.z1), point(o.hl, side * o.hw, o.z1)], { kind: 'skateledge', material: 'stone', feature: o });
  }
  // Use the very same flight endpoints as drawElStairs; each landing makes a
  // genuine kink, not two independent rails that drop the skater in between.
  for (const station of EL_STATIONS) for (const st of station.stairs) for (const v of [ELS.v0, ELS.v1]) {
    const points = [[ELS.u0, 0], [ELS.u1, EL_TOP / 2], [ELS.u2, EL_TOP / 2], [ELS.u3, EL_TOP]].map(([u, z]) =>
      [st.ox + st.c * (st.off + u) + st.ax * v, st.oy + st.s * (st.off + u) + st.ay * v, z + .1]);
    addGrindPath(points, { kind: 'handrail', material: 'metal', feature: points,
      district: districtOf(Math.floor(station.x / 8), Math.floor(st.oy / 8)) });
  }
}
function skatePathCatch() {
  const feet = skateGround(px, py) + body.z / 10, air = skateAir();
  if(SK.transition||air&&body.vz>0)return;
  let best = null;
  for (let by = -1; by <= 1; by++) for (let bx = -1; bx <= 1; bx++)
    for (const seg of grindPathBuckets.get((Math.floor(px / 8) + bx) + ',' + (Math.floor(py / 8) + by)) || []) {
      const path = seg.path;
      if (SK.leftGrind && path.feature === SK.leftGrind.feature && T - SK.leftGrindT < .7) continue;
      // Kerbs need an intentional hop; simply carving down a street must not
      // stick the skater to its painted-height pavement edge.
      if (!air && (path.kind === 'kerb' || path.kind === 'bench')) continue;
      if(path.kind==='coping'&&air&&SK.airSource===path.feature)continue;
      const q = grindPathNearest(seg, px, py);
      if (q.gap > (path.kind==='coping' ? .025 : .08) || feet < q.p[2] - .012 || feet > q.p[2] + (air ? .035 : .003)) continue;
      const hl = Math.hypot(seg.d[0], seg.d[1]);
      const along = (Math.cos(SK.dir) * seg.d[0] + Math.sin(SK.dir) * seg.d[1]) / hl;
      if (Math.abs(along) < (path.kind==='coping'?Math.cos(Math.PI/7):.5) || !hl) continue;
      if (!best || q.gap < best.q.gap) best = { seg, path, q, dir: Math.sign(along) };
    }
  if (best) startPathGrind(best.path, best.q.distance, best.dir);
}
function startPathGrind(path, distance, dir) {
  const at = grindPathAt(path, distance), tr = body.trick;
  if (tr && tr.t < (tr.duration ?? tr.air) && tr.name !== 'ollie') return skateBail('BAIL! Still mid-flip when you hit it.');
  if (tr && tr.name !== 'ollie') { const c = SK.combo ||= { names: [], pts: 0, t: T }; c.names.push(tr.name.toUpperCase()); c.pts += SK_POINTS[tr.name] || 50; }
  const angle = Math.atan2(at.tangent[1], at.tangent[0]);
  const off = Math.abs(mod(a - angle + Math.PI / 2, Math.PI) - Math.PI / 2);
  const right = SK_INPUT.right, pressure = K.ArrowUp ? -1 : K.ArrowDown ? 1 : right[1];
  const name = grindFamily(off, path.kind, right[0], pressure, dir);
  // Keep g/top/t for the compatibility release and the existing park tests.
  const g = path.legacy || { ...path, ax: at.seg.from[0], ay: at.seg.from[1], bx: at.seg.to[0], by: at.seg.to[1] };
  SK.grind = { path, distance, speed: Math.max(SK.v * .92, .25), dir, g, top: at.p[2], t: distance / path.length,
    name, t0: T, bal: 0, balV: (Math.random() - .5) * .6, scrapeT: 0, boardOff: a - angle - (dir < 0 ? Math.PI : 0) };
  px = at.p[0]; py = at.p[1]; SK.dir = angle + (dir < 0 ? Math.PI : 0);
  SK.v = SK.grind.speed; body.trick = null; body.vz = 0; SK.spin = 0;
  SK.transition=null;SK.manual=null;SK.airPose=null;SK.airSource=null;SK.airNormal=[0,0,1];
  SKB.roll=0;SKB.pitch=Math.atan2(at.tangent[2]*dir,Math.hypot(at.tangent[0],at.tangent[1]));
  SKB.yaw=a;SKB.surf={h:at.p[2],n:[0,0,1],kind:'grind',material:path.material,ref:path};
  body.z = Math.max(.001, (at.p[2] - skateGround(px, py)) * 10);
  controllerRumble('grind');
  if (actx) sfxSkate('scrape', .9); say(name.toUpperCase() + '!', 1);
}
function stepPathGrind(dt) {
  const G = SK.grind, at = grindPathAt(G.path, G.distance), material = G.path.material || 'stone', held = T - G.t0;
  if (Math.hypot(...SK_INPUT.right) > .3) {
    const off = Math.abs(mod(G.boardOff + Math.PI / 2, Math.PI) - Math.PI / 2);
    G.name = grindFamily(off, G.path.kind, ...SK_INPUT.right, G.dir);
  }
  G.speed = Math.max(0, G.speed + (-.98 * at.tangent[2] * G.dir - .98 * (GRIND_FRICTION[material] || .06)) * dt);
  SK.v = G.speed * Math.hypot(at.tangent[0], at.tangent[1]);
  const steer = clamp((K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) + SK_INPUT.steer, -1, 1);
  const unstable = ['smith', 'feeble', 'crooked grind', 'overcrook'].includes(G.name) ? 1.5 : 1;
  G.balV += ((Math.random() - .5) * (1.6 + held * .5) * unstable + G.bal * 1.4 - steer * 3.2) * dt;
  G.balV *= Math.exp(-dt * .8); G.bal += G.balV * dt;
  if (Math.abs(G.bal) > 1) return skateBail('BAIL! You lost your balance.');
  G.distance += G.dir * G.speed * dt;
  if (G.path.closed) G.distance = mod(G.distance, G.path.length);
  const next = grindPathAt(G.path, G.distance);
  px = worldCoord(next.p[0]); py = worldCoord(next.p[1]); G.top = next.p[2]; G.t = G.distance / G.path.length;
  SK.dir = Math.atan2(next.tangent[1], next.tangent[0]) + (G.dir < 0 ? Math.PI : 0); a = SK.dir + G.boardOff;
  SKB.pitch = Math.atan2(next.tangent[2] * G.dir, Math.hypot(next.tangent[0], next.tangent[1]));
  SKB.roll=clamp(G.bal,-1,1)*.08;SKB.yaw=a;
  body.z = Math.max(.001, (G.top - skateGround(px, py)) * 10); body.vz = 0;
  G.exitVelocity = next.tangent.map(v => v * G.speed * G.dir);
  if (G.distance < 0 || G.distance > G.path.length || G.speed < .05) return endGrind();
  if (actx && (G.scrapeT -= dt) <= 0) { G.scrapeT = .11; sfxSkate('scrape', material === 'metal' ? .55 : .35); }
  say(`${G.name.toUpperCase()}  ${grindPoints(G)}`, .5);
}

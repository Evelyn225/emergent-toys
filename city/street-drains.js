// Ironwork set flush in the ground, drawn into the floor like the manhole
// covers: gully grates in the gutter beside the kerb (rain runs along the
// gutter into them), cast-iron grates round the street trees, and the
// ventilation grates in the pavement beside the subway entrances, and the cellar hatches beside shop doors.
// Every pattern filters to an even tone once its bars are smaller than a cell.
const GULLY = { at: [2.45, 5.45], half: .028, e0: .302, e1: .338, bar: .007, keep: .85 };
const TREE_GRATE = { half: .045, frame: .005, ring: .01, hole: .022 }; // (a 90 cm pit on the kerb line, inside the pavement; soil showing round the trunk)
const VENT_GRATE = { off: .45, hl: .1, hw: .035, bar: .006 };
const HATCH = { along: .18, hl: .04, out0: .008, out1: .078, plate: .011 }; // a cellar hatch beside a shop door: its half length, its span out from the wall
// The gully grate the road point (e across the street from its base, s along
// the block) is on: [u along, v across, its side's kerb e] or null.
function gullyAt(road, e, s, bx, by) {
  if (road !== 1 && road !== 2 || road === 1 && onBridge(bx, by)) return null;
  const near = e < 1, v0 = near ? GULLY.e0 : 2 - GULLY.e1, v1 = near ? GULLY.e1 : 2 - GULLY.e0;
  if (e < v0 || e > v1) return null;
  for (const [k, a] of GULLY.at.entries()) {
    if (Math.abs(s - a) > GULLY.half || hash(bx * 2 + (near ? 0 : 1), by * 2 + (road === 1 ? 0 : 1), 1450 + k) > GULLY.keep) continue;
    return [s - a, near ? e - GULLY.e0 : 2 - GULLY.e0 - e];
  }
  return null;
}
// bars across a grate: 1 on a bar, 0 in a slot, blending to the mean as they shrink below a cell
function grateBars(q,period,footprint){
  const f=Math.max(1e-8,footprint/period),phase=q/period,duty=.45;
  if(f>=1)return duty;
  const a=phase-f/2,b=phase+f/2;
  const coverage=clamp(((Math.floor(b)-Math.floor(a))*duty+Math.min(fract(b),duty)-Math.min(fract(a),duty))/f,0,1),blend=smooth(clamp((f-.5)/.5,0,1));
  return coverage*(1-blend)+duty*blend;
}
function grateTone(bar, frame, L) { // solid iron for the frame and bars, near-black slots, an even mid-tone once they blend
  return [' ',0,C(GRAY,frame?1.7+L*.08:.25+clamp(bar,0,1)*(1.05+L*.1))];
}
// Water running along the gutter to the nearest grate in the rain: [ch, col, bg] or null.
function gutterRunoff(road, e, s, bx, by, L) {
  if (rain < .12 || road !== 1 && road !== 2 || road === 1 && onBridge(bx,by)) return null;
  const near = e < 1, w = near ? e - .3 : 1.7 - e;
  if (w < 0 || w > .012) return null; // (a thin rivulet against the kerb)
  for (const [k, a] of GULLY.at.entries()) {
    const d = s - a;
    if (Math.abs(d) > .5 || hash(bx * 2 + (near ? 0 : 1), by * 2 + (road === 1 ? 0 : 1), 1450 + k) > GULLY.keep) continue;
    const flow = fract(Math.abs(d) * 14 + T * 1.6 * rain); // (ripples travelling in to the grate)
    return flow < .35 ? ['~', C(CYAN, Math.max(L, 5)), C(GRAY, 1.1)] : null;
  }
  return null;
}
// Street trees standing on the pavement, by cell, for their grates. (A tree the
// street fitting left in the road gets none: its pit would lie in the road.)
function treeHasPit(t) {
  const road = ROAD[idx(Math.floor(t.x), Math.floor(t.y))];
  if (road !== 1 && road !== 2 || isWater(t.x, t.y)) return false;
  const e = road === 1 ? mod(t.x, 8) : mod(t.y, 8);
  return Math.min(e, 2 - e) + TREE_GRATE.half <= .3 + 1e-9;
}
let treePitCells = null, treePitCount = -1;
function treePitsNear(wx, wy) {
  if (treePitCount !== trees.length) {
    treePitCells = new Map(); treePitCount = trees.length;
    for (const t of trees) if (treeHasPit(t)) {
      const H=TREE_GRATE.half;
      for(let y=Math.floor(t.y-H);y<=Math.floor(t.y+H);y++)for(let x=Math.floor(t.x-H);x<=Math.floor(t.x+H);x++){
        const cell=idx(x,y);(treePitCells.get(cell)||treePitCells.set(cell,[]).get(cell)).push(t);
      }
    }
  }
  return treePitCells.get(idx(Math.floor(wx), Math.floor(wy)));
}
// Cellar hatches in the pavement beside some shop doors, against the wall, by cell: a pair of diamond-plate leaves
// with a seam down the middle, hinges at their ends and a lifting ring. {x, y: on the wall line, c, s: along it,
// nx, ny: out of it}
let hatchCells = null, hatchCount = -1;
const HATCHES = [];
function hatchesNear(wx, wy) {
  if (hatchCount !== doors.length) {
    hatchCells = new Map(); hatchCount = doors.length; HATCHES.length = 0;
    for (const d of doors) {
      if (!d.sh || d.sh.kind === SHOP_APTS || hash(Math.floor(d.x * 5), Math.floor(d.y * 5), 1460) > .35) continue;
      const n = Math.hypot(d.nx, d.ny) || 1, nx = -d.nx / n, ny = -d.ny / n, c = Math.abs(ny), s = Math.abs(nx), side = hash(Math.floor(d.x * 5), Math.floor(d.y * 5), 1461) < .5 ? -1 : 1;
      const x = worldCoord(d.x - nx * .12 + c * side * HATCH.along), y = worldCoord(d.y - ny * .12 + s * side * HATCH.along); // (on the wall, beside the door)
      const mid = [x + nx * (HATCH.out0 + HATCH.out1) / 2, y + ny * (HATCH.out0 + HATCH.out1) / 2];
      if (!map[idx(Math.floor(x - nx * .05), Math.floor(y - ny * .05))] || map[idx(Math.floor(mid[0]), Math.floor(mid[1]))] || !ROAD[idx(Math.floor(mid[0]), Math.floor(mid[1]))]) continue; // (a wall behind, pavement under it)
      if (machines.some(m => Math.abs(rel(m.x - mid[0])) < .15 && Math.abs(rel(m.y - mid[1])) < .15) || doors.some(e => e !== d && Math.abs(rel(e.x - nx * .12 - x)) < .1 && Math.abs(rel(e.y - ny * .12 - y)) < .1)) continue; // (clear of machines and other doors)
      const h = { x, y, c, s, nx, ny };
      HATCHES.push(h);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cell = idx(Math.floor(mid[0]) + i, Math.floor(mid[1]) + j); (hatchCells.get(cell) || hatchCells.set(cell, []).get(cell)).push(h); }
    }
  }
  return hatchCells.get(idx(Math.floor(wx), Math.floor(wy)));
}
function hatchCell(wx, wy, L, footprint) {
  const hs = hatchesNear(wx, wy);
  if (hs) for (const h of hs) {
    const dx = rel(wx - h.x), dy = rel(wy - h.y), u = dx * h.c + dy * h.s, v = dx * h.nx + dy * h.ny;
    if (Math.abs(u) > HATCH.hl || v < HATCH.out0 || v > HATCH.out1) continue;
    const frame = Math.abs(u) > HATCH.hl - .004 || v < HATCH.out0 + .004 || v > HATCH.out1 - .004;
    if (frame) return [' ', 0, C(GRAY, 1.6 + L * .08)];
    if (Math.abs(u) < Math.max(.0015, footprint / 2)) return [' ', 0, C(GRAY, .3)]; // the seam between the leaves
    if (Math.abs(Math.abs(u) - HATCH.hl + .012) < .006 && Math.abs(v - (HATCH.out0 + HATCH.out1) / 2) > .018) return [' ', 0, C(GRAY, .6)]; // a hinge at each end
    if (Math.abs(Math.hypot(Math.abs(u) - .01, v - (HATCH.out0 + HATCH.out1) / 2) - .005) < .0015) return [' ', 0, C(GRAY, 2.4)]; // the lifting rings, one each side of the seam
    const plate = footprint > HATCH.plate * .4 ? .3 : (fract((u + v) / HATCH.plate) < .18 || fract((u - v) / HATCH.plate) < .18 ? 1 : 0); // the diamond plate, an even sheen far off
    return [' ', 0, C(GRAY, 1.15 + L * .08 + plate * .5)];
  }
  return null;
}
// The ironwork at a road or pavement point, or null: [ch, col, bg].
function streetGrateCell(wx, wy, L, d, road, bx, by) {
  const lx = mod(wx, 8), ly = mod(wy, 8), e = road === 1 ? lx : ly, s = road === 1 ? ly : lx, footprint = d / projX;
  if (Math.min(e, 2 - e) > GULLY.e1) return null; // (the lanes: no ironwork there)
  const g = gullyAt(road, e, s, bx, by);
  if (g) { // bars run across the gutter, toward the kerb
    const frame = Math.abs(g[0]) > GULLY.half - .004 || g[1] < .004 || g[1] > GULLY.e1 - GULLY.e0 - .004;
    return grateTone(grateBars(g[0], GULLY.bar, footprint), frame, L);
  }
  const run = gutterRunoff(road, e, s, bx, by, L);
  if (run) return run;
  if (Math.min(e, 2 - e) < HATCH.out1 + .002) { const h = hatchCell(wx, wy, L, footprint); if (h) return h; }
  const pits = treePitsNear(wx, wy);
  if (pits) for (const t of pits) {
    const u = rel(wx - t.x), v = rel(wy - t.y), H = TREE_GRATE.half;
    if (Math.abs(u) > H || Math.abs(v) > H) continue;
    const r = Math.hypot(u, v);
    if (r < TREE_GRATE.hole) return [':', C(BRICK, L * .7), C(BRICK, .8)]; // the soil round the trunk
    const frame = Math.max(Math.abs(u), Math.abs(v)) > H - TREE_GRATE.frame;
    return grateTone(grateBars(r, TREE_GRATE.ring, footprint), frame, L);
  }
  if (road === 2) { const st = STATION_AT.get(bi(bx, by)); // the subway's ventilation grate, along the pavement past its entrance
    if (st) { const u = rel(wx - st.x - VENT_GRATE.off), v = rel(wy - st.y);
      if (Math.abs(u) < VENT_GRATE.hl && Math.abs(v) < VENT_GRATE.hw) {
        const frame = Math.abs(u) > VENT_GRATE.hl - .004 || Math.abs(v) > VENT_GRATE.hw - .004;
        return grateTone(grateBars(v, VENT_GRATE.bar, footprint), frame, L);
      } } }
  return null;
}

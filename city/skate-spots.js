// Discoverable street lines use the existing city geometry. The DIY median
// and a small park plaza add a few low obstacles without blocking traffic.
const SKATE_SPOTS = [], SKATE_SPOT_FEATURES = [], SKATE_PATCHES = [];
function skateSpotBox(x, y, hl, hw, height, kind, material) {
  const base = roadGroundHeight(x, y), o = { x, y, c: 1, s: 0, hl, hw, z0: base, z1: base + height, kind, material, low: true, spot: true };
  SKATE_SPOT_FEATURES.push(o); SKATE_FEATURES.push(o); solids.push(o);
  for (const side of kind === 'skaterail' ? [0] : [-1, 1]) GRINDS.push({
    ax: x - hl, ay: y + side * hw, bx: x + hl, by: y + side * hw,
    z: base - terrainHeight(x, y) + height, kind, material, feature: o
  });
  return o;
}
function buildSkateSpots() {
  SKATE_SPOTS.length = SKATE_SPOT_FEATURES.length = SKATE_PATCHES.length = 0;
  const station = EL_STATIONS.find(s => {
    const x = s.x - 2, y = EL_Y + 1;
    return !isWater(x, y) && !map[idx(Math.floor(x), Math.floor(y))] && ROAD[idx(Math.floor(x), Math.floor(y))];
  });
  if (station) {
    const x = station.x - 2, y = EL_Y + 1;
    skateSpotBox(x, y, .35, .004, .035, 'skaterail', 'metal');
    skateSpotBox(x + 1, y, .3, .055, .04, 'skateledge', 'wood');
    SKATE_SPOTS.push({ id: 'skate-diy', name: 'Under the el · DIY line', x:x-.5, y:y+.15, line:{x,y},
      description: 'A salvaged flat bar and timber ledge in the median, beneath the elevated tracks. A 3.5 m transfer gap links them. Charge a pop and keep your momentum.' });
  }
  const clear = (x, y) => !isWater(x, y) && !map[idx(Math.floor(x), Math.floor(y))]
    && !ARCH_BLOCKERS.some(o=>architectureContains(o,x,y,.1))
    && !LANDMARK_SOLIDS.some(o=>Math.abs(rel(o.x-x))<Math.max(o.hl||0,o.hw||0)+.2&&Math.abs(rel(o.y-y))<Math.max(o.hl||0,o.hw||0)+.2)
    && !trees.some(o => Math.abs(rel(o.x - x)) < .65 && Math.abs(rel(o.y - y)) < .6)
    && !benches.some(o => Math.abs(rel(o.x - x)) < .65 && Math.abs(rel(o.y - y)) < .6)
    && !solids.some(o => Math.abs(rel(o.x - x)) < .7 && Math.abs(rel(o.y - y)) < .65);
  let plaza = null;
  for (const [bx, by] of parks) {
    if (SKATEPARK && bx === SKATEPARK.bx && by === SKATEPARK.by) continue;
    for (const [u, v] of [[6.2, 6.2], [6.5, 3], [3, 6.5]]) {
      const x = bx * 8 + u, y = by * 8 + v;
      if (clear(x, y)) { plaza = { x, y }; break; }
    }
    if (plaza) break;
  }
  if (plaza) {
    const { x, y } = plaza;
    skateSpotBox(x, y - .2, .3, .035, .04, 'skateledge', 'concrete');
    skateSpotBox(x, y + .2, .3, .035, .04, 'skateledge', 'concrete');
    skateSpotBox(x, y, .3, .1, .02, 'manualpad', 'concrete');
    SKATE_PATCHES.push({ x, y, hl: .55, hw: .5 });
    SKATE_SPOTS.push({ id: 'skate-plaza', name: 'Concrete plaza · ledge line', x:x-.45, y, line:{x,y},
      description: 'Two parallel ledges and a six-metre manual pad on a small concrete plaza. Link a flip, a manual and a grind without losing the combo.' });
  }
  buildExtraSkateparks();
  const stairs = EL_STATIONS.find(s => s.stairs?.length)?.stairs[0];
  if (stairs) SKATE_SPOTS.push({ id: 'skate-stairs', name: 'Station stairs · kinked handrails', x: stairs.x, y: stairs.y,
    description: 'Two flights joined by a landing, with continuous kinked handrails. Enter from the platform with a valid train pass, then line up a downhill rail run.' });
}
function refreshSkateSpotDirectory() {
  const districts = new Set();
  for (const p of GRIND_PATHS) {
    if (p.kind !== 'kerb' || districts.has(p.district)) continue;
    districts.add(p.district);
    const at = grindPathAt(p, p.length / 2).p;
    SKATE_SPOTS.push({ id: `skate-kerb:${p.district}`, name: `${cap(p.district.replace(/[-_]/g, ' '))} · kerb line`, x: at[0], y: at[1],
      description: 'A long kerbstone line between crossings. Ollie onto its edge to grind, pop out over the street, or use a manual to carry a combo between lines.' });
    if (districts.size >= 3) break;
  }
  if (typeof mapPlaceCache !== 'undefined') mapPlaceCache = null;
}
function skateSpotGround(x, y) {
  let h = 0;
  for (const o of SKATE_SPOT_FEATURES) if (Math.abs(rel(x - o.x)) <= o.hl && Math.abs(rel(y - o.y)) <= o.hw) h = Math.max(h, o.z1);
  for(const o of SK_TRANSITIONS)if(o.spotPark){
    const dx=rel(x-o.x),dy=rel(y-o.y),u=o.bowl?Math.hypot(dx,dy):dx*o.c+dy*o.s;
    if(Math.abs(u)<=o.hl&&Math.abs(-dx*o.s+dy*o.c)<=o.hw)h=Math.max(h,skateProfileHeight(o,u));
  }
  return h;
}
const inSkateSpotPatch = (x, y) => SKATE_PATCHES.some(p => Math.abs(rel(x - p.x)) <= p.hl && Math.abs(rel(y - p.y)) <= p.hw);

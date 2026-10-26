// Kerb fixtures: fire hydrants, litter bins, mailboxes and bollards on the
// sidewalk's kerb line, where the lamps stand (CURB), clear of the walking line
// (0.12) and of everything already on the street. Placed on the finished
// city, so they're laid out on the assembled streets. Sizes in the models are
// metres; outdoors is 1/10 scale. {x, y, kind, c, s: along the kerb, fx, fy:
// the way it faces, hl, hw, h: its box, col, seed}
const KERB_KINDS = {
  hydrant: { hl: .024, hw: .024, h: .077 },
  bin: { hl: .027, hw: .027, h: .09 },
  mailbox: { hl: .023, hw: .029, h: .127 },
  bollard: { hl: .011, hw: .011, h: .091 },
  cabinet: { hl: .043, hw: .029, h: .141 },
  pole: { hl: .015, hw: .015, h: .84 },
  guy: { hl: .032, hw: .008, h: .2 },
  shelter: { hl: .155, hw: .07, h: .245, line: .03 },
};
// Shelter surface boxes, in outdoor world units. Rendering, collision and
// rain cover share these exact bounds; the road-facing entrance stays open.
const SHELTER_PARTS=[
  {role:'roof',a:0,v:0,hl:.155,hw:.069,z0:.235,z1:.245,material:'roof',round:.002},
  ...[-.145,.145].flatMap(a=>[-.06,.06].map(v=>({role:'post',a,v,hl:.003,hw:.003,z0:0,z1:.235,material:'metal',round:.001}))),
  {role:'back-lower-rail',a:0,v:-.056,hl:.142,hw:.004,z0:.008,z1:.014,material:'metal'},
  {role:'back-upper-rail',a:0,v:-.056,hl:.142,hw:.004,z0:.222,z1:.235,material:'metal'},
  {role:'back-glass',a:0,v:-.056,hl:.142,hw:.0005,z0:.014,z1:.222,material:'glass'},
  {role:'end-glass',a:-.145,v:-.022,hl:.0005,hw:.034,z0:.014,z1:.222,material:'glass'},
  {role:'end-lower-rail',a:-.145,v:-.0225,hl:.003,hw:.0375,z0:.008,z1:.014,material:'metal'},
  {role:'end-upper-rail',a:-.145,v:-.0225,hl:.003,hw:.0375,z0:.222,z1:.235,material:'metal'},
  {role:'end-frame',a:-.145,v:.0135,hl:.003,hw:.0015,z0:.008,z1:.235,material:'metal'},
  {role:'advert-foot',a:.145,v:-.013,hl:.006,hw:.0435,z0:0,z1:.02,material:'metal'},
  {role:'advert',a:.145,v:-.013,hl:.006,hw:.0435,z0:.02,z1:.22,material:'advert'},
  {role:'advert-head',a:.145,v:-.013,hl:.006,hw:.0435,z0:.22,z1:.235,material:'metal'}
];
const kerbs = [];
// Anything already standing on the sidewalk, with how far a fixture keeps from it.
function kerbCrowded(x, y, r) {
  const near = (list, gap) => list.some(o => Math.abs(rel(o.x - x)) < gap && Math.abs(rel(o.y - y)) < gap);
  const bx = Math.floor(x / 8), by = Math.floor(y / 8), around = b => { const out = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) out.push(...b[bi(bx + i, by + j)]); return out; };
  return near(around(lampsB), r + .045) || near(around(treesB), r + .06) || near(around(benchesB), r + .2) || near(around(machinesB), r + .07)
    || near(around(lightsB), r + .05) || near(around(elPillarsB), r + .06) || near(around(kerbsB), r + .03)
    || near(vendors, r + .32) || near(stations, r + .3) || elStairLocal(x, y);
}
function kerbClear(o) {
  const cell = idx(Math.floor(o.x), Math.floor(o.y));
  if (!ROAD[cell] || isWater(o.x, o.y) || seaAt(o.x, o.y) || GAS_CELL[cell] || GAS_CELL[idx(Math.floor(o.x - o.fx * .4), Math.floor(o.y - o.fy * .4))]) return false;
  const box = { x: o.x, y: o.y, c: o.c, s: o.s, hl: o.hl, hw: o.hw, z0: 0, z1: o.h };
  return !streetGeometryCollision(box, true) && !kerbCrowded(o.x, o.y, Math.max(o.hl, o.hw));
}
const kerbsB = bucketed([]);
const KERB_REPORT = { tried: 0, placed: 0, moved: 0 };
function addKerb(x, y, kind, ax, ay, extra) {
  const k = KERB_KINDS[kind], c = Math.abs(ay), s = Math.abs(ax); // (the box runs along the kerb)
  if(k.line){x-=ax*k.line;y-=ay*k.line;}
  const o = { x: worldCoord(x), y: worldCoord(y), kind, c, s, fx: ax, fy: ay, hl: k.hl, hw: k.hw, h: k.h, seed: hash(Math.floor(x * 10), Math.floor(y * 10), 1407), ...extra };
  KERB_REPORT.tried++;
  for (const along of [0, -.15, .15, -.3, .3]) {
    const sx = o.x, sy = o.y;
    o.x = worldCoord(x + c * along); o.y = worldCoord(y + s * along);
    if (kerbClear(o)) { kerbs.push(o); kerbsB[bi(Math.floor(o.x / 8), Math.floor(o.y / 8))].push(o); KERB_REPORT.placed++; if (along) KERB_REPORT.moved++; return o; }
    o.x = sx; o.y = sy;
  }
  return null;
}
// Timber pole lines in the Docks and the Yards: two poles a block side, down one side of each street, the wires on
// an arm reaching out over the road (clear of the lamp posts on the kerb line). Lines along the avenues (v) are
// carried higher than those along the cross streets (h), so where they cross over a junction they pass well clear.
// A span joins neighbouring poles of a line; a pole at the end of a line is held by a guy wire to an anchor.
const POLE = { r0: .014, r1: .011, hv: .84, hh: .62, at: [2.5, 5.5], sag: .012, span: 5.5, guy: .22, drop: .25 };
const POLE_WIRES = [{ off: .06, dz: .018 }, { off: .12, dz: .018 }, { off: .18, dz: .018 }, { off: .04, dz: .08, tel: true }]; // off: out along the arm; dz: below the pole top
const poleSpans = [], poleSpansB = bucketed([]);
const poleAlong = p => p.ori === 'h' ? p.x : p.y;
// a point on a span's wire, t = 0..1 from p to q, sagging
function poleWirePoint(sp, w, t) {
  const { p, q } = sp, za = p.z + p.h - w.dz, zb = q.z + q.h - w.dz;
  return [p.x + p.fx * w.off + rel(q.x - p.x) * t, p.y + p.fy * w.off + rel(q.y - p.y) * t, za + (zb - za) * t - sp.sag * (w.tel ? 1.3 : 1) * 4 * t * (1 - t)];
}
// Is a stretch of wire (sample points) clear of the buildings, their fittings, the el, the lamps and the trees?
function poleWireClear(pts, walls = true) {
  for (const [x, y, z] of pts) {
    const box = { x, y, c: 1, s: 0, hl: .006, hw: .006, z0: z - .006, z1: z + .006 };
    if (streetGeometryCollision(box, walls) || Math.abs(rel(y - (EL_Y + 1))) < EL_HALF + .1) return false;
    const bx = Math.floor(x / 8), by = Math.floor(y / 8);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (lampsB[bi(bx + i, by + j)].some(l => Math.abs(rel(l.x - x)) < .6 && Math.abs(rel(l.y - y)) < .6 && streetFixtureBoxes(l, 'lamp').some(b => streetBoxesOverlap(box, b)))) return false;
      if (treesB[bi(bx + i, by + j)].some(t => Math.hypot(rel(t.x - x), rel(t.y - y)) < .18)) return false;
    }
  }
  return true;
}
{
  const lines = new Map();
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) for (const ori of ['h', 'v']) {
    if (!(ori === 'h' ? hseg(bx, by) : vseg(bx, by))) continue;
    const o = hash(ori === 'h' ? by : bx, 0, ori === 'h' ? 1470 : 1471) < .5 ? CURB : 2 - CURB; // (the same side the whole way along)
    const ax = ori === 'v' ? (o < 1 ? 1 : -1) : 0, ay = ori === 'h' ? (o < 1 ? 1 : -1) : 0;
    const at = s => ori === 'h' ? [bx * 8 + s, by * 8 + o] : [bx * 8 + o, by * 8 + s];
    const [lx, ly] = at(4);
    if (districtAt(lx - ax * .6, ly - ay * .6) !== 'industrial') continue;
    const key = ori + (ori === 'h' ? by * 8 + o : bx * 8 + o);
    for (const s of POLE.at) {
      const [x, y] = at(s), p = addKerb(x, y, 'pole', ax, ay, { h: ori === 'v' ? POLE.hv : POLE.hh, ori, z: typeof terrainHeight === 'function' ? terrainHeight(x, y) : 0 });
      if (p) (lines.get(key) || lines.set(key, []).get(key)).push(p);
    }
  }
  for (const ps of lines.values()) {
    ps.sort((p, q) => poleAlong(p) - poleAlong(q));
    for (let k = 0; k + 1 < ps.length; k++) {
      const p = ps[k], q = ps[k + 1], len = poleAlong(q) - poleAlong(p), sp = { p, q, len, sag: len * POLE.sag };
      if (len > POLE.span || !POLE_WIRES.every(w => poleWireClear(Array.from({ length: Math.ceil(len / .04) }, (_, n) => poleWirePoint(sp, w, (n + .5) / Math.ceil(len / .04)))))) continue;
      p.next = q; q.prev = p; poleSpans.push(sp);
      poleSpansB[bi(Math.floor((p.x + rel(q.x - p.x) / 2) / 8), Math.floor((p.y + rel(q.y - p.y) / 2) / 8))].push(sp);
    }
  }
  // poles left with no wires come down again; the ends of each line get a guy wire, some poles a transformer, and some
  // a service drop to the building behind them
  for (const ps of lines.values()) for (const p of ps) {
    if (!p.next && !p.prev) { kerbs.splice(kerbs.indexOf(p), 1); const b = kerbsB[bi(Math.floor(p.x / 8), Math.floor(p.y / 8))]; b.splice(b.indexOf(p), 1); KERB_REPORT.placed--; continue; }
    const r = n => hash(Math.floor(p.x * 10), Math.floor(p.y * 10), n);
    for (const dir of [!p.prev && -1, !p.next && 1].filter(Boolean)) {
      const ux = p.ori === 'h' ? dir : 0, uy = p.ori === 'v' ? dir : 0, gx = worldCoord(p.x + ux * POLE.guy), gy = worldCoord(p.y + uy * POLE.guy), gz = typeof terrainHeight === 'function' ? terrainHeight(gx, gy) : 0;
      if (!ROAD[idx(Math.floor(gx), Math.floor(gy))] || GAS_CELL[idx(Math.floor(gx), Math.floor(gy))]) continue;
      const pts = Array.from({ length: 12 }, (_, n) => { const t = (n + .5) / 12; return [p.x + ux * POLE.guy * t, p.y + uy * POLE.guy * t, p.z + p.h - .05 + (gz - p.z - p.h + .05) * t]; });
      if (!poleWireClear(pts.slice(0, 9))) continue;
      const reach=POLE.guy*Math.min(1,.2/Math.max(.01,p.z+p.h-.05-gz));
      const g = { x: worldCoord(gx - ux * reach/2), y: worldCoord(gy - uy * reach/2), kind: 'guy', c: p.c, s: p.s, fx: p.fx, fy: p.fy, hl: reach/2+.006, hw: KERB_KINDS.guy.hw, h: KERB_KINDS.guy.h, pole: p, gx, gy, gz };
      if (!kerbClear(g)) continue;
      kerbs.push(g); kerbsB[bi(Math.floor(g.x / 8), Math.floor(g.y / 8))].push(g);
    }
    p.can = r(1472) < .25;
    const wx = worldCoord(p.x - p.fx * (POLE.drop - .002)), wy = worldCoord(p.y - p.fy * (POLE.drop - .002)), tel = POLE_WIRES[3], z0 = p.z + p.h - tel.dz, z1 = z0 - .12;
    if (r(1473) < .45 && map[idx(Math.floor(wx - p.fx * .05), Math.floor(wy - p.fy * .05))] > z0) {
      const pts = Array.from({ length: 10 }, (_, n) => { const t = (n + .5) / 10, a = tel.off + (-POLE.drop - tel.off) * t; return [p.x + p.fx * a, p.y + p.fy * a, z0 + (z1 - z0) * t - .01 * 4 * t * (1 - t)]; });
      if (poleWireClear(pts.slice(0, 8)) && poleWireClear(pts.slice(8), false)) p.drop = { x: wx, y: wy, z: z1 };
    }
  }
}
// Down each side of each street: a hydrant near the corner, a bin beside the
// first lamp, now and then a mailbox beside the second, and a row of bollards
// in front of a landmark. (ax, ay) points from the buildings into the road;
// hydrant outlets face the road, mailboxes face the people walking past.
for (const o of [CURB, 2 - CURB]) {
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) for (const ori of ['h', 'v']) {
    if (!(ori === 'h' ? hseg(bx, by) : vseg(bx, by))) continue;
    const ax = ori === 'v' ? (o < 1 ? 1 : -1) : 0, ay = ori === 'h' ? (o < 1 ? 1 : -1) : 0;
    const at = s => ori === 'h' ? [bx * 8 + s, by * 8 + o] : [bx * 8 + o, by * 8 + s];
    const [lx, ly] = at(5), lot = [lx - ax * .6, ly - ay * .6], dist = districtAt(...lot), r = n => hash(bx * 2 + (o < 1 ? 0 : 1), by * 2 + (ori === 'h' ? 0 : 1), n);
    if (blockKind(Math.floor(lot[0] / 8), Math.floor(lot[1] / 8)) === 'park' && r(1400) < .7) continue;
    if (r(1401) < (dist === 'industrial' ? .6 : .4)) addKerb(...at(2.6), 'hydrant', ax, ay, { col: dist === 'industrial' ? YEL : RED });
    if (dist !== 'industrial' && r(1402) < ({ downtown: .75, chinatown: .75, shotengai: .8 }[dist] || .55))
      addKerb(...at(3.85), 'bin', ax, ay, { col: ['chinatown', 'downtown'].includes(dist) ? GREEN : GRAY });
    if (!['industrial', 'belle'].includes(dist) && r(1403) < .22) addKerb(...at(6.85), 'mailbox', -ax, -ay, { col: dist === 'shotengai' ? RED : BLUE });
    if (dist !== 'belle' && r(1405) < .12) addKerb(...at(6.2), 'cabinet', -ax, -ay, { col: GREEN, telecom: true }); // a telecom cabinet
    if (['downtown', 'midtown', 'chinatown', 'waterfront'].includes(dist) && r(1408) < .18) { // a shelter, open to the road, its bench inside
      const sh = addKerb(...at(5.9), 'shelter', ax, ay, { word: ADS[Math.floor(r(1409) * ADS.length)] });
      if (sh) { const b = { x: worldCoord(sh.x - ax * .03), y: worldCoord(sh.y - ay * .03), fx: ax, fy: ay, shelter: sh }; benches.push(b); benchesB[bi(Math.floor(b.x / 8), Math.floor(b.y / 8))].push(b); }
    }
    if (landmarkOf.has(bi(Math.floor(lot[0] / 8), Math.floor(lot[1] / 8))) || dist === 'downtown' && r(1404) < .12)
      for (let k = 0; k < 5; k++) addKerb(...at(4.6 + k * .2), 'bollard', ax, ay, {});
  }
}
// on foot, they're solid; a kicked ball stops at them too
// The same lathe profiles used for rendering bound the part of a round
// fixture in the caller's height interval (walking body, or a kicked ball).
function kerbProfileRadius(profile,lo,hi) {
  let radius=0;
  for(let j=1;j<profile.length;j++){
    const [za,ra]=profile[j-1],[zb,rb]=profile[j],a=Math.max(lo/KERB_K,Math.min(za,zb)),b=Math.min(hi/KERB_K,Math.max(za,zb));
    if(a>b)continue;if(Math.abs(zb-za)<1e-9){radius=Math.max(radius,ra,rb);continue;}
    radius=Math.max(radius,ra+(rb-ra)*(a-za)/(zb-za),ra+(rb-ra)*(b-za)/(zb-za));
  }return radius*KERB_K;
}
function kerbFootprint(o,u,v,pad,lo=0,hi=Infinity) {
  if(hi<0||lo>o.h)return false;
  const k=KERB_K,over=(a,b)=>hi>=a*k&&lo<=b*k;
  const rect=(x,y,a,b)=>Math.hypot(Math.max(0,Math.abs(u-x)-a*k),Math.max(0,Math.abs(v-y)-b*k))<=pad;
  const cap=(ax,ay,bx,by,z,r)=>{
    const dz=Math.max(lo-z*k,z*k-hi,0);if(dz>r*k)return false;
    const ex=(bx-ax)*k,ey=(by-ay)*k,x=u-ax*k,y=v-ay*k,t=clamp((x*ex+y*ey)/(ex*ex+ey*ey),0,1);
    return Math.hypot(x-ex*t,y-ey*t)<=Math.sqrt((r*k)**2-dz*dz)+pad;
  };
  if(o.kind==='pole')return Math.hypot(u,v)<=POLE.r0+pad;
  if(o.kind==='guy'){
    const anchor=rel(o.gx-o.x)*o.c+rel(o.gy-o.y)*o.s,pole=rel(o.pole.x-o.x)*o.c+rel(o.pole.y-o.y)*o.s,ground=o.gz-terrainHeight(o.x,o.y),rise=o.pole.z+o.pole.h-.05-o.gz;
    const end=(h)=>anchor+(pole-anchor)*clamp((h-ground)/rise,0,1),segment=(a,b,r)=>Math.hypot(u-clamp(u,Math.min(a,b),Math.max(a,b)),v)<=r+pad;
    if(lo<=ground+.004&&hi>=ground&&Math.hypot(u-anchor,v)<=.006+pad)return true;
    const top=Math.min(hi,.2),bottom=Math.max(lo,ground);
    if(top<bottom)return false;
    if(segment(end(bottom),end(top),.0012))return true;
    const a=Math.max(bottom,ground+.004),b=Math.min(top,ground+.16);
    return a<=b&&segment(end(a),end(b),.0035);
  }
  if(o.kind==='shelter'){
    const fs=Math.sign(-o.s*o.fx+o.c*o.fy)||1;
    // Grounded walking projects the walls, never the overhead canopy.
    return SHELTER_PARTS.some(q=>(q.role!=='roof'||Number.isFinite(hi))&&hi>=q.z0&&lo<=q.z1&&Math.hypot(Math.max(0,Math.abs(u-q.a)-q.hl+(q.round||0)),Math.max(0,Math.abs(v*fs-q.v)-q.hw+(q.round||0)))<=(q.round||0)+pad);
  }
  if(o.kind==='cabinet'){
    const fs=Math.sign(-o.s*o.fx+o.c*o.fy)||1;
    const rounded=(a,b,r)=>Math.hypot(Math.max(0,Math.abs(u)-(a-r)*k),Math.max(0,Math.abs(v)-(b-r)*k))<=r*k+pad;
    if(over(0,.1)&&rect(0,0,.42,.27)||over(.1,1.35)&&rounded(.4,.25,.02)||over(1.35,1.41)&&rounded(.43,.28,.012))return true;
    if(over(.16,1.3)&&rect(0,.253*fs*k,.38,.003))return true;
    if(over(.645,.795)&&rect(.315*k,.28*fs*k,.005,.005))return true;
    for(const z of [.65,.79])if(over(z-.005,z+.005)&&rect(.315*k,.268*fs*k,.005,.017))return true;
    return over(1,1.242)&&rect(0,0,.412,.18);
  }
  if(o.kind==='mailbox'){
    const fs=Math.sign(-o.s*o.fx+o.c*o.fy)||1;
    if(over(0,.23))for(const a of [-.19,.19])for(const b of [-.22,.22])if(rect(a*k,b*fs*k,.02,.02))return true;
    if(over(.22,1.27)){
      const h=Math.max(lo,1.05*k)-1.05*k,r=Math.sqrt(Math.max(0,(.22*k)**2-h*h));
      if(rect(0,0,r/k,.25))return true;
    }
    if(over(.78,1)&&rect(0,.25*fs*k,.16,.01))return true;
    if(over(.964,.976)){
      if(rect(0,.282*fs*k,.1,.005))return true;
      for(const a of [-.09,.09])if(rect(a*k,.271*fs*k,.01,.011))return true;
    }
    return over(.6,.7)&&rect(0,.252*fs*k,.1,.004);
  }
  const profile=o.kind==='bin'?KERB_BIN:o.kind==='bollard'?KERB_BOLLARD:KERB_HYDRANT;
  const radius=Math.max(kerbProfileRadius(profile,lo,hi),o.kind==='hydrant'?kerbProfileRadius(KERB_NUT,lo-.72*k,hi-.72*k):0);if(radius>0&&Math.hypot(u,v)<=radius+pad)return true;
  if(o.kind!=='hydrant')return false;
  const fs=Math.sign(-o.s*o.fx+o.c*o.fy)||1;
  for(const e of [-1,1])if(cap(e*.08,0,e*.14,0,.42,.032)||cap(e*.14,0,e*.16,0,.42,.042))return true;
  return cap(0,fs*.08,0,fs*.16,.34,.045)||cap(0,fs*.16,0,fs*.18,.34,.056);
}
function kerbAt(x,y,pad,z=null,height=Infinity) {
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const o of kerbsB[bi(Math.floor(x/8)+i,Math.floor(y/8)+j)]){
    const x_=rel(x-o.x),y_=rel(y-o.y),u=x_*o.c+y_*o.s,v=-x_*o.s+y_*o.c;
    if(Math.abs(u)>o.hl+pad||Math.abs(v)>o.hw+pad)continue;
    const lo=z===null?0:z-terrainHeight(o.x,o.y);
    if(kerbFootprint(o,u,v,pad,lo,lo+height))return o;
  }return null;
}
// A signal controller cabinet at most junctions: on the kerb beside the first
// signal pole, half a cell back from the corner, its doors to the pavement.
{
  const done = new Set();
  for (const l of lights) {
    const ix = Math.floor(l.bx / 8), iy = Math.floor(l.by / 8), key = bi(ix, iy);
    if (done.has(key) || hash(ix, iy, 1406) > .6) continue;
    const e = l.vert ? mod(l.x, 8) : mod(l.y, 8), ax = l.vert ? (e < 1 ? 1 : -1) : 0, ay = l.vert ? 0 : (e < 1 ? 1 : -1);
    const away = Math.sign(l.vert ? l.y - (l.by + 1) : l.x - (l.bx + 1)) || 1;
    if (addKerb(l.vert ? l.x : l.x + away * .5, l.vert ? l.y + away * .5 : l.y, 'cabinet', -ax, -ay, { col: GRAY, signal: true })) done.add(key);
  }
}

// Exact roof footprint, with the fixture's real terrain elevation.
function shelterRoofAt(x,y,z){
  const roof=SHELTER_PARTS[0];
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const q of kerbsB[bi(Math.floor(x/8)+i,Math.floor(y/8)+j)]){
    if(q.kind!=='shelter'||z>terrainHeight(q.x,q.y)+roof.z1)continue;
    const x_=rel(x-q.x),y_=rel(y-q.y),u=x_*q.c+y_*q.s,v=-x_*q.s+y_*q.c;
    if(Math.hypot(Math.max(0,Math.abs(u)-roof.hl+roof.round),Math.max(0,Math.abs(v)-roof.hw+roof.round))<=roof.round)return q;
  }return null;
}

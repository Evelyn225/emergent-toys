// ===== smoke and vapour that hangs in the air. Every drag you breathe out leaves a few puffs in front of you, a lit
// cigarette sends up the odd wisp, and the vape's cloud is a lot more (mango-coloured). Outside they drift off on the
// wind and are gone in a few seconds; indoors they hang about for half a minute, so a room you keep smoking in gets
// hazy. Walk into a cloud and it fogs your view. Close wisps use the same colour-only treatment in goods-ui.js.
const haze = []; // { at: placeKey, kind: 'smoke' | 'vape' | 'steam' | 'engine' | 'soot' | 'breath' (cold breath: particles.js), x, y, z, r, vx, vy, s (world units a metre), life 1..0, fade, seed }
let hazeLastTip = 0, hazeDue = 0, hazeWisp = 0;
const HAZE_WIND = [0.035, 0.012]; // outside, in cells a second (a light breeze)
// breathe out (amount 0..3: a wisp, a drag, a big vape cloud) in front of you
function hazeExhale(amount, kind) {
  const at = placeKey();
  if (at === null) return;
  const s = mode === 'room' ? 1 : 0.1, n = Math.max(1, Math.round(2 + amount * 4));
  for (let k = 0; k < n; k++) {
    const sp = (Math.random() - 0.5) * (0.5 + amount * 0.3), d = (0.7 + Math.random() * 0.5 + amount * 0.35) * s, r = (0.14 + amount * 0.1 + Math.random() * 0.08) * s;
    haze.push({ at, kind, s, x: px + Math.cos(a + sp) * d, y: py + Math.sin(a + sp) * d, z: (1.45 + Math.random() * 0.3) * s,
      r, rMax: r * (kind === 'vape' ? 2.5 : 2) + (kind === 'vape' ? 0.22 : 0.15) * s, vx: Math.cos(a + sp) * (0.3 + amount * 0.25) * s, vy: Math.sin(a + sp) * (0.3 + amount * 0.25) * s,
      life: 1, fade: kind === 'breath' ? 1 / 1.5 : mode === 'room' ? 1 / 25 : kind === 'vape' ? 1 / 12 : 1 / 6, seed: Math.random() * 100 }); // (a vape cloud hangs about a while, even outside)
  }
  while (haze.length > 90) haze.shift();
}
function stepHaze(dt) {
  if (cigTip > hazeLastTip + 0.5) hazeDue = 0.8; // a drag (or lighting up): breathe it out in a moment
  hazeLastTip = cigTip;
  if (hazeDue > 0 && (hazeDue -= dt) <= 0) hazeExhale(0.45, 'smoke');
  if (fx.smoke > 0 && onFootMode() && (hazeWisp -= dt) <= 0) { hazeWisp = 1.4 + Math.random() * 1.2; hazeExhale(-0.3, 'smoke'); } // off the end of it
  for (let k = haze.length - 1; k >= 0; k--) {
    const p = haze[k], out = p.at === '';
    p.x += (p.vx + (out ? HAZE_WIND[0] : 0)) * dt; p.y += (p.vy + (out ? HAZE_WIND[1] : 0)) * dt;
    p.vx *= 1 - Math.min(1, dt * 1.2); p.vy *= 1 - Math.min(1, dt * 1.2); // the breath slows; then it's just the air moving it
    p.z += (p.vz ?? 0.08 * p.s) * dt; p.r += (p.rMax - p.r) * Math.min(1, dt * (out ? 0.6 : 0.3)); // rising, spreading out to a limit
    if ((p.life -= p.fade * dt) <= 0) haze.splice(k, 1);
  }
}
// ---- smoke off things burning out in the world: lit campfires, Fern House's stove after dark, and the cloud a firework
// leaves hanging where it burst (lit up by the next). Only where you could see it, and never so much it crowds out the rest
const FERN_CHIMNEY = [541.25, 245.1, fernChimneyTop()+.02]; // (its top: islands-content.js)
let worldSmokeT = 0, fwLight = { col: WHITE, t: -99 };
function worldPuff(x, y, z, r, rMax, kind, life, vz) {
  haze.push({ at: '', kind, s: 0.1, x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r, z, r, rMax, vx: 0, vy: 0, vz, life: 1, fade: 1 / life, seed: Math.random() * 100 });
  while (haze.length > 140) haze.shift();
}
function stepWorldSmoke(dt) {
  if (mode === 'room' || (worldSmokeT -= dt) > 0) return;
  worldSmokeT = 0.5;
  const seen = (x, y) => Math.hypot(rel(x - px), rel(y - py)) < vis;
  for (const o of FIRES) if (fireLit(o) && seen(o.x, o.y)) worldPuff(o.x, o.y, (o.z ?? terrainHeight(o.x, o.y)) + 0.16, 0.03, 0.16, 'smoke', 7, 0.07);
  const [cx, cy, cz] = FERN_CHIMNEY;
  if (night > 0.2 && seen(cx, cy)) worldPuff(cx, cy, terrainHeight(cx, cy) + cz, 0.025, 0.14, 'smoke', 8, 0.05);
}
function fireworkSmoke(s) { // (called at the burst: events.js)
  fwLight = { col: s.col, t: T };
  let mine = 0;
  for (let k = haze.length - 1; k >= 0; k--) if (haze[k].kind === 'fwsmoke' && ++mine >= 24) haze.splice(k, 1); // (the oldest go first)
  worldPuff(s.x, s.y, s.h, 1, 2.6, 'fwsmoke', 14, 0.02);
}
// drawn last in the scene (after the walls and the people), see-through: a soft core, wisps round its edge, the
// world showing between them. Behind a wall, hidden.
function drawHaze() {
  if (!haze.length) return;
  const room_ = mode === 'room', at = room_ ? placeKey() : ''; // (outdoors, from a car or a boat too)
  let inside = 0, insideKind = 'smoke';
  for (const p of haze) {
    if (p.at !== at) continue;
    const rx_ = room_ ? p.x - px : rel(p.x - px), ry_ = room_ ? p.y - py : rel(p.y - py), depth = dx * rx_ + dy * ry_;
    const near = Math.hypot(rx_, ry_, p.z - eye) / p.r;
    if (near < 1 && p.life * (1 - near) > inside && p.kind !== 'engine' && p.kind !== 'soot' && p.kind !== 'fwsmoke' && p.kind !== 'breath') { inside = p.life * (1 - near); insideKind = p.kind; } // (a car's smoke drifts past you, it doesn't swallow the view)
    if (depth < 0.05 * p.s * 10 || depth > vis) continue;
    const sc = projX / depth, cx = cols / 2 + (-dy * rx_ + dx * ry_) * sc, rw = p.r * sc, cy = hor - (p.z - eye) * projY / depth, rh = p.r * projY / depth * 0.75;
    const c0 = Math.max(0, Math.floor(cx - rw)), c1 = Math.min(cols, Math.ceil(cx + rw)), r0 = Math.max(0, Math.floor(cy - rh)), r1 = Math.min(rows, Math.ceil(cy + rh));
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
      const i = r * cols + c;
      if (depth >= ZB[i] && depth >= ZBG[i]) continue;
      const nx = (c + 0.5 - cx) / rw, ny = (r + 0.5 - cy) / rh, d = Math.hypot(nx, ny);
      if (d >= 1) continue;
      const dens = (1 - d * d) * (0.3 + 0.8 * noise(nx * 2.6 + p.seed, ny * 2.6 - T * 0.25, 991)) * Math.min(1, p.life * 1.6) * (p.kind === 'vape' ? 1.15 : 0.85); // (holds together most of its life, thins out at the end)
      if (dens < 0.22 || dens < 0.4 && hash(c, r, 993) > 0.6) continue; // thin: the world shows through
      hazeCell(i, dens, p.kind, depth);
    }
  }
  if (inside > 0.12) for (let i = 0; i < CH.length; i++) { // in the thick of it: the whole view clouds over
    const dens = inside * (0.3 + 0.7 * noise((i % cols) * 0.15, (i / cols | 0) * 0.3 - T * 0.3, 992));
    if (dens > 0.3 && hash(i, 7, 994) > 0.35) hazeCell(i, dens * 0.6, insideKind);
  }
}
// Quantised palette compositing keeps the scene visible through thin haze.
// The bounded cache avoids a nearest-palette search for every cloud cell/frame.
const HAZE_TINTS=new Map();
function hazeTint(background,target,opacity){
  if(opacity<=0)return background;
  const bg=background!==NONE&&PALRGB[background]?background:C(BLACK,0),alpha=clamp(Math.round(opacity*8),1,8),key=(bg*256+target)*8+alpha-1;
  if(HAZE_TINTS.has(key))return HAZE_TINTS.get(key);
  const a=PALRGB[bg],b=PALRGB[target],f=alpha/8,r=a[0]+(b[0]-a[0])*f,g_=a[1]+(b[1]-a[1])*f,bl=a[2]+(b[2]-a[2])*f;
  let best=0,error=Infinity;
  for(let k=0;k<PALRGB.length;k++){if(k===NONE)continue;const p=PALRGB[k],d=(p[0]-r)**2+(p[1]-g_)**2+(p[2]-bl)**2;if(d<error){error=d;best=k;}}
  if(HAZE_TINTS.size>=8192)HAZE_TINTS.delete(HAZE_TINTS.keys().next().value);
  HAZE_TINTS.set(key,best);return best;
}
function hazeCell(i,dens,kind,depth=0){
  let target,opacity;
  if(kind==='breath'){target=C(WHITE,(10+dens*4)*Math.max(.6,amb));opacity=dens*.38;}
  else if(kind==='soot'){target=C(GRAY,.3+dens*.8);opacity=dens*.9;}
  else if(kind==='fwsmoke'){
    const flash=Math.exp(-Math.max(0,T-fwLight.t)*2.5),col=flash>.15?fwLight.col:GRAY;
    target=C(col,(2+dens*4)*(.5+flash*2));opacity=dens*.65;
  }else{
    const vape=kind==='vape',lit=Math.max(vape?.7:.35,amb)*(kind==='steam'?1.25:1);
    target=C(vape?WARM:GRAY,(8+dens*5)*lit);opacity=dens*(vape?.8:.6);
  }
  opacity=clamp(opacity,0,1);
  // Keep lettering and the surface behind it at their own depths. Erasing glyphs
  // turned glazed facades into flat black cutouts whenever a puff crossed them.
  const smokeFog=mode==='room'?0:clamp((1-Math.exp(-Math.max(0,depth-.18)*fogAmt*1.9/vis))*FOG_LEVELS,0,FOG_LEVELS);
  if(depth<ZBG[i]){BG[i]=hazeTint(BG[i],target,opacity);FOGB[i]=Math.round(FOGB[i]*(1-opacity)+smokeFog*opacity);}
  if(depth<ZB[i]){COL[i]=hazeTint(COL[i],target,opacity);FOGS[i]=Math.round(FOGS[i]*(1-opacity)+smokeFog*opacity);}

}

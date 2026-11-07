// Small boarded patches and torn paper left on permanently shut brownstone
// shop windows. Positions come from the same facade bays as the actual shutter.
let ABANDONED_DRESSING_B=null;
const ABANDONED_DRESSING_PARTS=new WeakMap();
function abandonedDressingList(){
 if(ABANDONED_DRESSING_B)return ABANDONED_DRESSING_B;
 const out=[];
 for(const b of ARCH_BUILDINGS){
  if(b.sh.kind!==SHOP_SHUT||b.sh.wilderness||b.profile||b.region!=='brownstones')continue;
  for(const f of b.faces){
   if(!f.front||f.low||f.spacing<.4)continue;
   const unit=Math.min(f.units-1,Math.floor(hash(b.x0,b.y0,1841)*f.units));
   const along=f.start+(unit+.5)*f.spacing;
   out.push({sh:b.sh,seed:b.seed,x:f.side?along:f.line,y:f.side?f.line:along,
    tx:f.side?1:0,ty:f.side?0:1,nx:f.nx,ny:f.ny,spacing:f.spacing});
  }
 }
 return ABANDONED_DRESSING_B=bucketed(out);
}
function abandonedDressingParts(e){
 let parts=ABANDONED_DRESSING_PARTS.get(e);if(parts)return parts;
 parts=[];
 const add=(kind,t,n,hl,hw,z0,z1,index=0)=>{
  parts.push({kind,t,n,hl,hw,z0,z1,index,box:boxAt(e.x+e.tx*t+e.nx*n,e.y+e.ty*t+e.ny*n,e.tx,e.ty,hl,hw,z0,z1)});
 };
 // Rear battens touch the facade plane. Each plank sits on their fronts,
 // with a screw over both supports. Some patches use horizontal timber.
 const horizontal=hash(e.seed*1e3,0,1843)>.5;
 if(horizontal){
  for(const t of [-.07,.07])add('batten',t,.002,.0075,.002,.075,.235);
  for(let j=0;j<4;j++){
   const z=.095+j*.033;
   add('plank',0,.0055,.10+hash(j,e.seed*1e3,1842)*.004,.0015,z-.014,z+.014,j);
   for(const t of [-.07,.07])add('screw',t,.00745,.001,.00045,z-.001,z+.001,j);
  }
 }else{
  for(const z of [.095,.22])add('batten',0,.002,.06,.002,z-.0075,z+.0075);
  for(let j=0;j<4;j++){
   const t=(j-1.5)*.028,top=.265+hash(j,e.seed*1e3,1842)*.004;
   add('plank',t,.0055,.013,.0015,.055,top,j);
   for(const z of [.095,.22])add('screw',t,.00745,.001,.00045,z-.001,z+.001,j);
  }
 }
 for(let j=0;j<2;j++)add('paper',(horizontal ? .135 : .085)+j*.023,.00002+j*.00004,.013,.00002,.125+j*.014,.159+j*.014,j);
 ABANDONED_DRESSING_PARTS.set(e,parts);return parts;
}
function drawAbandonedDressing(e,vx,vy){
 const parts=abandonedDressingParts(e);
 for(const p of parts){
  const box={...p.box,x:vx+(p.box.x-e.x),y:vy+(p.box.y-e.y)};
  drawBox(box,(i,t,L)=>{
   if(p.kind==='paper'){
    const u=HIT.u/p.hl,v=(HIT.w-p.z0)/(p.z1-p.z0);
    // Missing lower corners expose the steel; these are paper remnants rather
    // than a new sign identifying the former business.
    if(v<.16+(Math.floor((u+1)*4+p.index)&1)*.12||u>.6&&v>.86)return false;
    BG[i]=C(v<.42?WARM:WHITE,(2+L*.28)*shadeFace(HIT.face));
   }else if(p.kind==='screw')BG[i]=C(GRAY,(1+L*.2)*shadeFace(HIT.face));
   else{
    const fp=t/projY,across=p.hl>(p.z1-p.z0)/2?HIT.w:HIT.u,grain=coveGroove(across+p.index*.003,.008,.001,fp);
    const split=p.hl>(p.z1-p.z0)/2
     ? Math.abs(HIT.w-(p.z0+p.z1)/2)<Math.max(.0005,fp*.3)&&HIT.u>p.hl-.034
     : Math.abs(HIT.u+.003)<Math.max(.0005,fp*.3)&&HIT.w>p.z1-.034;
    BG[i]=C(p.kind==='batten'?BRICK:p.index&1?GRAY:WARM,((split?1:2.2)+L*.24-grain*.9)*shadeFace(HIT.face));
   }
   return set(i,' ',0),true;
  });
 }
}
function abandonedShopDressing(){
 forNear(abandonedDressingList(),e=>{
  if(e.sh.kind!==SHOP_SHUT)return;
  const[vx,vy]=R(e.x,e.y);if(Math.hypot(vx,vy)>SHOP_WINDOW.near*2.5||!inView(vx,vy,.22))return;
  drawAbandonedDressing(e,vx,vy);
 });
 drawAbandonedGroundDressing();
}

// ---- sun-faded ghost lettering: where a shut shop's fascia sign hung, the wall behind it was kept out of the sun for
// years, so with the board gone its outline and the old name are left as a darker, unfaded patch. Some letters fell
// or were prised off earlier and left no mark; the board's fixing holes show at its corners. Called from the facade
// renderers where they would have drawn the sign. u0: the sign's centre in the caller's (signed) wall coordinate.
const GHOST_WORDS = new WeakMap();
function ghostWord(sh) {
  let w = GHOST_WORDS.get(sh);
  if (w === undefined) {
    let s = Math.floor((sh.architecture?.seed ?? 0) * 1e3); for (const ch of sh.word) s = (s * 31 + ch.charCodeAt(0)) | 0;
    w = [...sh.word].map((ch, k) => ch !== ' ' && hash(k, s & 0xffff, 1851) < .3 ? ' ' : ch).join('');
    GHOST_WORDS.set(sh, w);
  }
  return w;
}
function ghostSign(i, u, uStep, z, d, b, f, sh, u0, base, L) {
  if (sh.kind !== SHOP_SHUT || sh.wilderness || !f.front || z < .28) return false;
  const g = architectureSignSpec(b, f, sh); if (g.cwid < .03) return false;
  const half = sh.word.length * g.cwid / 2 + g.edge * 2.5, top = g.zc + g.band / 2 + g.edge, bot = g.zc - g.band / 2 - g.edge, du = u - u0;
  if (z > top || z < bot || Math.abs(du) > half) return false;
  const fp = Math.max(uStep, d / projY), lvl = 1.9 + L * .2;
  const rim = Math.abs(du) > half - fp * .9 || z > top - fp * .9 || z < bot + fp * .9; // (the grime line round where the board sat)
  const bg = C(base, rim ? lvl * .62 : lvl);
  if (wallText(i, u, uStep, z, d, ghostWord(sh), u0, g.zc, g.cwid, g.band, C(base, Math.max(1, lvl * .55)), bg)) return true;
  BG[i] = bg;
  const hole = fp < .012 && (half - Math.abs(du)) < .02 && (half - Math.abs(du)) > .008 && Math.min(top - z, z - bot) < .02 && Math.min(top - z, z - bot) > .008;
  return set(i, hole ? '.' : ' ', C(GRAY, 1)), true;
}

// ---- left at the step: weeds along the foot of the shutter and in the pavement cracks, and what got dumped there
// once nobody was going to move it: bin bags, flattened and soggy cardboard boxes, a mattress against the shutter, a
// milk crate, flyers blown into the corner. Every shut shop on the street (not out in the wilds).
let ABANDONED_STEP_B = null;
const ABANDONED_STEP_PARTS = new WeakMap();
function abandonedStepList() {
  if (ABANDONED_STEP_B) return ABANDONED_STEP_B;
  const out = [];
  for (const b of ARCH_BUILDINGS) {
    if (b.sh.kind !== SHOP_SHUT || b.sh.wilderness) continue;
    for (const f of b.faces) {
      if (!f.front || f.low || f.end - f.start < .4) continue;
      const mid = (f.start + f.end) / 2;
      out.push({ sh: b.sh, seed: b.seed ?? hash(b.x0, b.y0, 1852), x: f.side ? mid : f.line, y: f.side ? f.line : mid, tx: f.side ? 1 : 0, ty: f.side ? 0 : 1, nx: f.nx, ny: f.ny, w: f.end - f.start });
    }
  }
  return ABANDONED_STEP_B = bucketed(out);
}
function abandonedStepParts(e) {
  let parts = ABANDONED_STEP_PARTS.get(e); if (parts) return parts;
  parts = [];
  const h = (k, j = 0) => hash(Math.floor(e.seed * 997) + k, j, 1853), half = e.w / 2 - .04;
  const add = (kind, t, n, hl, hw, z0, z1, extra = {}) => parts.push({ kind, t, n, hl, hw, z0, z1, ...extra,
    box: boxAt(e.x + e.tx * t + e.nx * n, e.y + e.ty * t + e.ny * n, e.tx, e.ty, hl, hw, z0, z1) });
  // weeds: tufts at the foot of the wall, thicker in the corners
  for (let k = 0; k < 14; k++) { const t = (h(k, 1) * 2 - 1) * half, tall = .012 + h(k, 2) * .022 * (Math.abs(t) > half * .7 ? 1.5 : 1); add('weed', t, .007 + h(k, 3) * .008, .008 + h(k, 4) * .01, .006, 0, tall, { k }); }
  // the dumped things: two to four of them, in their own spots along the front
  const n = 2 + Math.floor(h(20) * 3), used = [];
  for (let k = 0; k < n; k++) {
    let t = (h(30 + k) * 2 - 1) * (half - .08); if (used.some(u => Math.abs(u - t) < .14)) t = -t; used.push(t);
    const what = Math.floor(h(40 + k) * 6);
    if (what === 0 || what === 1) { // bin bags, a heap of two or three
      for (let j = 0; j < 2 + (h(50 + k) > .5); j++) add('bag', t + (j - .8) * .045, .035 + (j & 1) * .02, .024 + h(60 + j, k) * .006, .022, 0, .05 + h(70 + j, k) * .015, { k: j });
    } else if (what === 2) { add('box', t, .035, .03, .025, 0, .04, { k }); add('box', t + .01, .035, .022, .02, .04, .07, { k: k + 1 }); }
    else if (what === 3 && !used.mattress) { used.mattress = true; add('mattress', t, .012, .045, .007, 0, .17, { k }); } // (stood up against the shutter)
    else if (what === 4) add('crate', t, .03, .019, .016, 0, .03, { k });
    else add('flat', t, .05, .045, .03, 0, .003, { k }); // (a box trodden flat)
  }
  for (let k = 0; k < 4; k++) add('flyer', (h(80 + k) * 2 - 1) * half, .02 + h(90 + k) * .06, .015, .011, 0, .0008, { k, rot: h(95 + k) });
  ABANDONED_STEP_PARTS.set(e, parts); return parts;
}
function drawAbandonedStep(e, vx, vy, d) {
  for (const p of abandonedStepParts(e)) {
    if (p.kind === 'flyer' && d > 2) continue;
    if (p.kind === 'weed' && d > 3.5) continue;
    const box = { ...p.box, x: vx + (p.box.x - e.x), y: vy + (p.box.y - e.y) };
    drawBox(box, (i, t, L) => {
      const top = HIT.face === 5, sf = shadeFace(HIT.face), fp = t / projY;
      if (p.kind === 'weed') { // a tuft: blades as strokes over the step, splaying and thinning toward their tips
        const v = (HIT.w - p.z0) / (p.z1 - p.z0), lean = (HIT.u / p.hl) * v * .5, blade = Math.abs(fract((HIT.u + lean * p.hl) / Math.max(.004, fp * 1.2) + p.k * .37) - .5);
        if (HIT.face === 5 || HIT.face === 6 || blade > .42 - .3 * v) return false;
        const g = 2.6 + L * .3 - v * .5;
        if (fp > .006) { BG[i] = C(GREEN, g * .8); return set(i, ' ', 0), true; } // (far: a dab of green)
        return set(i, v > .7 ? "'" : lean > .05 ? '/' : lean < -.05 ? '\\' : '|', C(GREEN, Math.max(3, g * 1.6))), true; // (on whatever's behind: the pavement, the steel)
      }
      if (p.kind === 'bag') { // a black bin bag: a rounded lump, sheen on top, the knot
        const r = Math.hypot(HIT.u / p.hl, (HIT.w - p.z0) / (p.z1 - p.z0) * 1.6 - .2);
        if (!top && r > 1.25) return false;
        const fold = Math.abs(fract(HIT.u / .012 + HIT.w / .02 + p.k * .3) - .5) < .12, sheen = r < .55 && (HIT.w - p.z0) / (p.z1 - p.z0) > .5;
        BG[i] = C(GRAY, (top ? 1.5 : .8) + (sheen ? .9 : 0) - (fold ? .35 : 0) + L * .1);
        return set(i, fp < .005 && sheen && fold ? '~' : ' ', C(GRAY, 5)), true;
      }
      if (p.kind === 'box' || p.kind === 'flat') { // cardboard: brown, its tape, darker where it's got wet
        const tape = top && Math.abs(HIT.u) < .003, wet = HIT.w - p.z0 < .006 && !top;
        BG[i] = C(tape ? STONE : BRICK, ((top ? 4.4 : 3.4) * sf - (wet ? 1.2 : 0) + L * .2) * (p.kind === 'flat' ? .8 : 1)); return set(i, ' ', 0), true;
      }
      if (p.kind === 'mattress') { // a stained mattress, buttoned, propped against the steel
        const button = fp < .008 && Math.abs(fract(HIT.u / .03) - .5) < .12 && Math.abs(fract(HIT.w / .035) - .5) < .1;
        const stain = hash(Math.floor(HIT.u * 60), Math.floor(HIT.w * 60), 1854) > .82;
        BG[i] = C(stain ? SKIN : WHITE, (button ? 4 : stain ? 5 : 7.5) * sf * (.5 + L * .04)); return set(i, ' ', 0), true;
      }
      if (p.kind === 'crate') { // a plastic milk crate: open grid sides
        const grid = !top && (Math.abs(fract((HIT.face <= 2 ? HIT.v : HIT.u) / .008) - .5) > .3 || Math.abs(fract(HIT.w / .009) - .5) > .3);
        if (!top && !grid && fp < .006) return false;
        BG[i] = C(p.k & 1 ? BLUE : RED, (5 + L * .3) * sf); return set(i, ' ', 0), true;
      }
      // a flyer: white paper, a line or two of print
      BG[i] = C(p.rot > .5 ? YEL : WHITE, 5 + L * .4); return set(i, fp < .002 && Math.abs(fract(HIT.v / .0025) - .5) < .15 ? '-' : ' ', C(GRAY, 3)), true;
    });
  }
}
function abandonedStepDressing() {
  forNear(abandonedStepList(), e => {
    if (e.sh.kind !== SHOP_SHUT) return;
    const [vx, vy] = R(e.x, e.y), d = Math.hypot(vx, vy);
    if (d > SHOP_WINDOW.near * 1.6 || !inView(vx, vy, e.w / 2 + .1)) return;
    drawAbandonedStep(e, vx, vy, d);
  });
}

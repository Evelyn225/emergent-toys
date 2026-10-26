// The vending machine, built: a steel cabinet with rounded edges on a recessed
// plinth, its door framing a lit header, a glass window onto four shelves of
// stock, the control column (display, keypad, coin and note slots, the coin
// return) and the delivery flap in its chute. Sizes are metres; sc/10 scales them
// (sc 1 outdoors, in cells; 10 indoors). The footprint is VM_HL x VM_HW x VM_H.
const VM_COL = { DRINKS: RED, SNACKS: BLUE, CIGARETTES: GRAY };
const VM_GOODS = { DRINKS: ['o', [RED, BLUE, GREEN, YEL, WHITE]], SNACKS: ['#', [YEL, ORANGE, RED, GREEN, MAG]], CIGARETTES: ['=', [WHITE, RED, YEL, WHITE, CYAN]] };
// a: across the front, left to right as you face it; v: out of the front; z: up
const VM = { a0: -.39, a1: .15, z0: .46, z1: 1.58, // the window
  shell: .28, door: .34, glass: [.30, .31], back: -.2, chute: [-.33, .05, .14, .36], shelves: 4, items: 5, near: .9 };
const VM_CAN = [[0, 0], [0, .028], [.008, .033], [.112, .033], [.123, .026], [.123, 0]];
// A flat part's world normal from its rayBox face, for coveLight.
function vmNormal(c, s) {
  const f = HIT.face;
  HIT.nx = f === 1 ? c : f === 2 ? -c : f === 3 ? -s : f === 4 ? s : 0;
  HIT.ny = f === 1 ? s : f === 2 ? -s : f === 3 ? c : f === 4 ? -c : 0;
  HIT.nz = f === 5 ? 1 : f === 6 ? -1 : 0;
}
function buildVending(m, sc) {
  let vx=0,vy=0,glow=0,inside=false;
  const k = sc / 10, fs = m.fs, c = m.c, s = m.s, body = VM_COL[m.kind], [, cols_] = VM_GOODS[m.kind];
  const fx = -s * fs, fy = c * fs;
  const at = (a, v) => { const u = a * fs * k, w = v * fs * k; return [vx + c * u - s * w, vy + s * u + c * w]; };
  const baseParts=[],controlParts=[],stockParts=[];let target=baseParts;
  const add=(box,shade,ray=rayBox)=>target.push({box,shade,ray});
  const round=(x,y,c,s,hl,hw,z0,z1,r,shade)=>add({...boxAt(x,y,c,s,hl,hw,z0,z1),round:Math.min(r,hl*.98,hw*.98,(z1-z0)*.49)},shade,coveRayRounded);
  const lathe=(x,y,z,profile,shade)=>{const points=profile.map(([h,r])=>[h+z,r]),r=Math.max(...points.map(p=>p[1]));add({...boxAt(x,y,1,0,r,r,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),profile:points},shade,coveRayLathe);};
  const lit = (base, n) => (i, t, L) => { BG[i] = C(base, n + L * .25 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; };
  const flat = (a0, a1, v0, v1, z0, z1, shade, role) => { const [x, y] = at((a0 + a1) / 2, (v0 + v1) / 2); add({...boxAt(x, y, c, s, (a1 - a0) / 2 * k, (v1 - v0) / 2 * k, z0 * k, z1 * k),vmRole:role}, (i, t, L) => (vmNormal(c, s), shade(i, t, L))); };
  const across = (centre = 0) => HIT.u * fs / k + centre, outward = () => (-s * HIT.nx + c * HIT.ny) * fs; // (a of a hit on a part centred at a = centre; its normal out of the front)
  // the cabinet: one rounded shell, open where the window and the chute look into it
  const [sx, sy] = at(0, (VM.shell - .35) / 2);
  round(sx, sy, c, s, .45 * k, (VM.shell + .35) / 2 * k, .06 * k, 1.9 * k, .035 * k, (i, t, L) => {
    const a = across(), z = HIT.w / k, [ca0, ca1, cz0, cz1] = VM.chute;
    if (outward() > .7 && (a > VM.a0 && a < VM.a1 && z > VM.z0 && z < VM.z1 || a > ca0 && a < ca1 && z > cz0 && z < cz1)) return false;
    const band = Math.abs(outward()) < .3 && z > 1.0 && z < 1.32; // a lighter stripe down each side
    BG[i] = C(body, (band ? 2.4 : 1.5) + L * .32 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true;
  });
  flat(-.42, .42, -.32, .25, 0, .06, lit(GRAY, .8)); // the plinth, set back under it
  // the door: header, stile, control column and the frame round the chute
  const [hx, hy] = at(0, (VM.shell + .35) / 2);
  round(hx, hy, c, s, .44 * k, (.35 - VM.shell) / 2 * k, VM.z1 * k, 1.86 * k, .012 * k, (i, t, L) => {
    if (outward() < .7) { BG[i] = C(body, 1.4 + L * .3 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; }
    BG[i] = C(body, 5 + glow * 7);
    const word = m.kind, letterW = Math.min(.075, .8 / word.length) * k;
    return set(i, worldText(word, HIT.u * fs, HIT.w, t, i, vx+hx, vy+hy, 1.72 * k, c * fs, s * fs, letterW, .16 * k), C(WHITE, 15)), true;
  });
  const frame = lit(body, 1.6);
  flat(-.44, VM.a0, VM.shell, VM.door, VM.z0, VM.z1, frame); // the stile
  // A true closed coin-return recess in the control column, open at its face.
  const [pcx,pcy]=at((VM.a1+.44)/2,(VM.shell+VM.door)/2);
  add({...boxAt(pcx,pcy,c*fs,s*fs,(.44-VM.a1)/2*k,(VM.door-VM.shell)/2*k,VM.z0*k,VM.z1*k),round:.0005*k,recesses:[[.04*k,.52*k,.60*k,-.029*k]]},shopCabinetShade,shopCabinetRay);
  const [ca0, ca1, cz0, cz1] = VM.chute;
  flat(-.44, .44, VM.shell, VM.door, cz1, VM.z0, frame,'delivery-top'); flat(-.44, .44, VM.shell, VM.door, .08, cz0, frame); // above and below the chute
  flat(-.44, ca0, VM.shell, VM.door, cz0, cz1, frame); flat(ca1, .44, VM.shell, VM.door, cz0, cz1, frame); // either side of it
  // the chute, and its flap hanging in it with a lip to push
  flat(ca0, ca1, VM.shell - .09, VM.shell - .01, cz0, cz1, (i, t, L) => { BG[i] = C(GRAY, .5); return set(i, ' ', 0), true; });
  flat(ca0 + .01, ca1 - .01, VM.shell - .005, VM.shell + .005, cz0 + .01, cz1 - .005, lit(GRAY, 1.2),'delivery-flap');
  flat(ca0 + .1, ca1 - .1, VM.shell + .005, VM.shell + .02, cz1 - .035, cz1 - .02, lit(GRAY, 2.4));
  const [hingeX,hingeY]=at((ca0+ca1)/2,VM.shell),hingeHalf=(ca1-ca0-.02)/2*k,hingeZ=(cz1-.002)*k,hingeR=.006*k;
  add({...boxAt(hingeX,hingeY,c,s,hingeHalf+hingeR,hingeR,hingeZ-hingeR,hingeZ+hingeR),vmRole:'flap-hinge',handRatio:1,handShape:{ax:-hingeHalf,ay:0,az:hingeZ,bx:hingeHalf,by:0,bz:hingeZ,r:hingeR}},frame,homeClockRayHand);
  // the controls, out of the column's face: display, keypad, coin slot and note slot
  const controls=()=>{target=controlParts;
    const d = VM.door;
    flat(.2, .39, d, d + .01, 1.37, 1.49, (i, t, L) => { BG[i] = C(GRAY, .4); if (outward() < .7 || .032 * k * projX / t < .8) return set(i, ' ', 0), true; const [ex, ey] = at(.295, d + .01);
      return set(i, worldText('READY', HIT.u * fs, HIT.w, t, i, ex, ey, 1.43 * k, c * fs, s * fs, .032 * k, .06 * k), C(RED, 7 + glow * 8)), true; }); // (scaled letters up close; blank below a readable footprint)
    flat(.22, .37, d, d + .01, 1.0, 1.3, (i, t, L) => {
      const key = outward() > .7 && fract(HIT.w / k / .075) > .35 && fract(across() / .05 + .5) > .3;
      BG[i] = C(key ? WHITE : GRAY, (key ? 2.4 : 1.2) + L * .2 * coveDetail(t, .05)); return set(i, ' ', 0), true;
    });
    flat(.25, .33, d, d + .01, .86, .94, (i, t, L) => { BG[i] = C(GRAY, outward() > .7 && Math.abs(HIT.w / k - .9) < .008 ? .3 : 3 + L * .2); return set(i, ' ', 0), true; });
    flat(.22, .37, d, d + .01, .7, .8, (i, t, L) => { BG[i] = C(GRAY, outward() > .7 && Math.abs(HIT.w / k - .75) < .006 ? .3 : 2.2 + L * .2); return set(i, ' ', 0), true; });
  };
  const [gl0, gl1] = VM.glass, rows_ = VM.shelves, wide = VM.a1 - VM.a0, high = VM.z1 - VM.z0, mid = (VM.a0 + VM.a1) / 2;
  const stock=()=>{target=stockParts;
    // inside: the lit back, the lining, the shelves with their price lips, and the stock on them
    const lining = (i, t, L) => { BG[i] = C(GRAY, 1.8 + glow * 1.6); return set(i, ' ', 0), true; }, b = VM.back, sh = VM.shell;
    flat(VM.a0, VM.a1, b - .02, b, VM.z0, VM.z1, (i, t, L) => { BG[i] = C(WHITE, 1.8 + glow * 2.4); return set(i, ' ', 0), true; });
    flat(VM.a0 - .02, VM.a0, b, sh, VM.z0, VM.z1, lining); flat(VM.a1, VM.a1 + .02, b, sh, VM.z0, VM.z1, lining);
    flat(VM.a0, VM.a1, b, sh, VM.z1, VM.z1 + .02, (i, t, L) => { BG[i] = C(WHITE, 4 + glow * 6); return set(i, ' ', 0), true; }); // the strip light in its ceiling
    for (let r = 0; r < rows_; r++) {
      const z = VM.z0 + r * high / rows_;
      flat(VM.a0, VM.a1, b, .25, z, z + .015, lining);
      flat(VM.a0, VM.a1, .25, .265, z, z + .035, (i, t, L) => { const slot = fract((across(mid) - VM.a0) / wide * VM.items), tag = slot > .35 && slot < .65; BG[i] = C(tag ? WHITE : GRAY, tag ? 3.5 + glow * 3 : 1.6); return set(i, ' ', 0), true; });
      for (let j = 0; j < VM.items; j++) {
        const a = VM.a0 + (j + .5) * wide / VM.items, col = cols_[(j + r * 2) % 5], [x, y] = at(a, .1), zz = (z + .015) * k;
        if (m.kind === 'DRINKS') lathe(x, y, zz, VM_CAN.map(([h, rr]) => [h * k, rr * k]), (i, t, L) => {
          const band = Math.abs(HIT.w / k - z - .075) < .02; BG[i] = C(band ? WHITE : col, (band ? 3 : 2.2) + glow * 2 + L * .25 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; });
        else if (m.kind === 'SNACKS') round(x, y, c, s, .042 * k, .014 * k, zz, zz + .17 * k, .012 * k, (i, t, L) => {
          BG[i] = C(col, 2.4 + glow * 2 + L * .3 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; });
        else for (const e of [-1, 1]) { const [px_, py_] = at(a + e * .027, .1); add(boxAt(px_, py_, c, s, .024 * k, .011 * k, zz, zz + .088 * k), (i, t, L) => {
          vmNormal(c, s); const top = HIT.w / k > z + .075; BG[i] = C(top ? WHITE : col, (top ? 3.2 : 2.2) + glow * 2 + L * .25 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; }); }
      }
    }
  };
  // the glass: clear but for a glint up close; at a distance the stock is painted on it instead
  flat(VM.a0, VM.a1, gl0, gl1, VM.z0, VM.z1, (i, t, L) => {
    const q = (across(mid) - VM.a0) / wide, z = (HIT.w / k - VM.z0) / high;
    if (inside) {
      const glint=coveGroove(q*.7+z*.9-.3,1,.012,t/(projX*k))*coveDetail(t,.25*k);
      if(glint<.65)return false;BG[i]=C(WHITE,3+glow*3);set(i,' ',0);return true;
    }
    const sz = z * rows_, row = Math.floor(sz), sq = q * VM.items, j = Math.floor(sq);
    BG[i] = C(CYAN, 1 + glow * 2.5);
    if(fract(sz)<.12){BG[i]=C(GRAY,1.6+glow);set(i,' ',0);return true;}
    const cell=fract(sz)*(VM.z1-VM.z0)/rows_,u=fract(sq),height=m.kind==='DRINKS'?.123:m.kind==='SNACKS'?.17:.088;
    const acrossItem=m.kind==='CIGARETTES'?Math.abs(u-.25)<.22||Math.abs(u-.75)<.22:u>.18&&u<.82;
    const item=acrossItem&&cell>.015&&cell<.015+height,col=cols_[(j+row*2)%5];
    if (item) BG[i] = C(col, 2 + glow * 3);
    set(i,' ',0);return true;
  });
  const glassPart=baseParts.pop();
  const prepare=fn=>{const x=vx,y=vy;vx=vy=0;fn();vx=x;vy=y;target=baseParts;};
  return {baseParts,controlParts,stockParts,glassPart,draw(x,y){
    vx=x;vy=y;glow=Math.max(night,overcast*.6);
    const front=-(vx*fx+vy*fy)>VM.door*k;inside=Math.hypot(vx,vy)<VM.near*sc&&front;
    if(front&&!controlParts.length)prepare(controls);
    if(inside&&!stockParts.length)prepare(stock);
    const paint=p=>drawBox({...p.box,x:vx+p.box.x,y:vy+p.box.y},p.shade,p.ray);
    for(const p of baseParts)paint(p);
    if(front)for(const p of controlParts)paint(p);
    if(inside)for(const p of stockParts)paint(p);
    paint(glassPart);
  }};
}
const VM_PREPARED=new WeakMap();
function vendingModel(m,sc=1) {
  let scales=VM_PREPARED.get(m);if(!scales)VM_PREPARED.set(m,scales=new Map());
  let model=scales.get(sc);if(!model)scales.set(sc,model=buildVending(m,sc));return model;
}
function drawVending(m,vx,vy,sc=1) {vendingModel(m,sc).draw(vx,vy);}

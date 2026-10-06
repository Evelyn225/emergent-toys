function landmarkStone(i, x, z, base, L, faceLight = 1) {
  const row = Math.floor(z * 6), joint = fract(x * 3 + (row & 1) * .5), grain = hash(Math.floor(x * 18),Math.floor(z * 24),702);
  BG[i] = C(base,1.8 + L * faceLight * .3 + grain * .55);
  set(i, fract(z * 6) < .045 ? '_' : joint < .025 ? '|' : grain > .99 ? '.' : ' ', C(base,L * .6));
}
function landmarkGlass(i, du, z, half, bottom, top, L, stained = true) {
  const ad = Math.abs(du), peak = top - half * 1.4 * Math.min(1,ad / half) ** .7;
  if (ad > half + .035 || z < bottom - .025 || z > peak + .035) return false;
  if (ad > half || z < bottom || z > peak) {
    set(i, ad > half ? '|' : '^', C(STONE,L * 1.1)); return true;
  }
  const pane = Math.floor((du + half) / half * 3), band = Math.floor((z - bottom) * 7), glass = stained ? GLASS[mod(pane + band,GLASS.length)] : CYAN;
  BG[i] = C(glass,1.2 + day * 2 + night * 2);
  const lead = Math.abs(du) < .012 || fract((du + half) / half * 3) < .055 || fract((z - bottom) * 7) < .045;
  set(i, lead ? '+' : ' ', C(lead ? GRAY : glass,lead ? L * .65 : Math.max(3,L * .75)));
  return true;
}
function cathedralExterior(i, z, h, side, wc, mx, my, L, b) {
  const p = b.profile, local = rel(wc - (side ? b.x : b.y));
  landmarkStone(i,wc,z,p.stone,L);
  const tower = my - b.y === 3 && (mx - b.x === 3 || mx - b.x === 6);
  if (tower) {
    const center = side ? mx - b.x + .5 : 3.5, du = local - center;
    if (Math.abs(du) > .39) return set(i, fract(z * 9) < .1 ? '=' : '|', C(STONE,L));
    if (Math.abs(z - .38) < .03 || Math.abs(z - (h - 1.5)) < .04) return set(i,'=',C(STONE,L));
    if (landmarkGlass(i,du,z,.13,.85,2.5,L)) return;
    if (landmarkGlass(i,du - .18,z,.065,h - 1.35,h - .28,L,false) || landmarkGlass(i,du + .18,z,.065,h - 1.35,h - .28,L,false)) return;
    return;
  }
  const front = side && my - b.y === 4 && rel(py - my) < 0;
  if (front && Math.abs(local - 5) < .6) {
    const du = local - 5, rr = Math.hypot(du,z - 1.8);
    if (rr < .56) {
      const angle = Math.atan2(du,z - 1.8), spoke = Math.abs(Math.sin(angle * 6)) < .1 && rr > .095;
      if (rr > .49 || spoke) return set(i,'+',C(STONE,L * 1.15));
      BG[i] = C(GLASS[mod(Math.floor((angle + Math.PI) * 6 / Math.PI) + Math.floor(rr * 7),8)],2 + day * 3);
      return set(i,rr < .1 ? '*' : ' ',C(YEL,Math.max(4,L)));
    }
    const ad = Math.abs(du), top = .64 - Math.min(1,ad / .21) ** .7 * .23;
    if (ad < .24 && z < top + .035) {
      if (ad > .21 || z > top) return set(i,'#',C(STONE,L));
      BG[i] = C(BRICK,1 + night * 2);
      return set(i,ad < .008 ? '|' : fract(du * 40) < .12 ? '|' : ' ',C(YEL,L * .65));
    }
  }
  // A complete lancet occupies each structural bay; margins at the corners stay stone.
  const start = side ? 3 : 4, end = side ? 7 : 8;
  if (local > start + .25 && local < end - .25) {
    const center = Math.floor(local) + .5;
    if (landmarkGlass(i,local - center,z,side ? .18 : .2,.52,Math.min(h - .22,2.7),L)) return;
  }
  if (Math.abs(z - .28) < .025 || z > h - .08) set(i,'=',C(STONE,L));
}
function composedLandmarkFacade(i, z, h, side, sty, fog, wc, mx, my) {
  const b = LANDMARK_BY_BLOCK.get(bi(Math.floor(mx / 8),Math.floor(my / 8)));
  if (!b || sty !== 3 && sty !== 4) return false;
  const L = fog * amb * (side ? 11 : 15);
  if (sty === 4) cathedralExterior(i,z,h,side,wc,mx,my,L,b);
  else landmarkStone(i,wc,z,b.profile.stone,L);
  return true;
}
function landmarkClockFace(i, z, o, L) {
  // Each dial is read from outside: its clockwise direction must survive the opposite wall's orientation.
  let du = HIT.face <= 2 ? HIT.v : HIT.u;
  if (HIT.face === 1 || HIT.face === 4) du = -du;
  const dz = z - (o.z0 + .68), radius = Math.min(o.hl,o.hw) * .73;
  const rr = Math.hypot(du,dz);
  if (rr > radius) return false;
  if (rr > radius - .045) { set(i,'O',C(YEL,L * 1.1)); return true; }
  const angle = Math.atan2(du,dz), hand = (direction,length) => rr < length && Math.abs(mod(angle - direction + Math.PI,Math.PI * 2) - Math.PI) * Math.max(rr,.06) < .023;
  BG[i] = C(WHITE,Math.max(7 + day * 3,night * 11));
  if (hand(mod(tod,12) / 12 * Math.PI * 2,radius * .52) || hand(fract(tod) * Math.PI * 2,radius * .82)) set(i,'#',C(GRAY,1));
  else set(i,Math.abs(rr - radius * .83) < .025 && Math.abs(Math.sin(angle * 6)) < .22 ? '+' : ' ',C(GRAY,2));
  return true;
}
function landmarkSolidShade(o, i, t, L) {
  const { profile: p } = o.b, z = HIT.w, face = HIT.face, u = face <= 2 && !o.planes ? HIT.v : HIT.u;
  const roof = o.kind === 'roof', inclined = o.planes && face >= 6;
  const endWall = roof && (o.form === 'gable' && (face === 2 || face === 3) || o.form === 'crossgable' && (face === 0 || face === 1));
  if (roof && !endWall) {
    const base = p.roof, seam = fract((face < 8 ? HIT.v : HIT.u) * 9) < .055;
    BG[i] = C(base,1.3 + L * (inclined ? .28 : .35));
    set(i,seam ? '/' : fract(z * 14) < .045 ? '-' : ' ',C(base,L * .85));
    paintSettledSnow(i,o.x + HIT.u,o.y + HIT.v,L,.55,0,HIT.w);
    return true;
  }
  landmarkStone(i,u + o.x,z,p.stone,L,shadeFace(o.planes ? 1 : face));
  if (o.kind === 'clock' && face < 5 && landmarkClockFace(i,z,o,L)) return true;
  if (o.kind === 'shaft' && face < 5) {
    for (const bottom of [1.6,p.shaft * .57]) if (landmarkGlass(i,u,z,.11,bottom,bottom + .85,L,false)) return true;
    if (Math.abs(u) > (face <= 2 ? o.hw : o.hl) - .11) set(i,'|',C(STONE,L));
  } else if (o.kind === 'lantern' && face < 5) {
    if (Math.abs(u) < .25 && z > o.z0 + .12 && z < o.z1 - .08) { BG[i] = C(CYAN,2 + day * 2); set(i,'|',C(YEL,L)); }
  } else if (o.kind === 'bell' || o.kind === 'finial') { BG[i] = C(YEL,2 + L * .25); set(i,o.kind === 'bell' ? '#' : '|',C(YEL,L)); }
  else if (o.kind === 'balustrade') {
    if (z > o.z1 - .016 || Math.abs(fract(u * 24) - .5) < .16) set(i,z > o.z1 - .016 ? '=' : '|',C(STONE,L));
    else return false;
  } else if (o.kind === 'course' || o.kind === 'portal') set(i,o.kind === 'portal' && o.planes ? '^' : '=',C(STONE,L * 1.1));
  else if (o.kind === 'pier') set(i,'|',C(STONE,L));
  if ((!o.planes && face === 5) || o.planes && face === 4) paintSettledSnow(i,o.x + HIT.u,o.y + HIT.v,L,1,0,HIT.w);
  return true;
}
function drawLandmarks() {
  forNear(landmarkSolidsB,o => {
    const vx = rel(o.x - px), vy = rel(o.y - py);
    if (Math.hypot(vx,vy) > vis + 4) return;
    const far = dx * vx + dy * vy + Math.abs(dx) * o.hl + Math.abs(dy) * o.hw;
    const edge = Math.abs(-dy * vx + dx * vy) - Math.abs(dy) * o.hl - Math.abs(dx) * o.hw;
    if (far < .02 || edge > far * tf) return;
    drawBox({ ...o,x: vx,y: vy },(i,t,L) => landmarkSolidShade(o,i,t,L),o.planes ? rayMansard : rayBox);
  });
}

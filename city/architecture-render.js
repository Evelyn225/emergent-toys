// Entrances, windows and corner margins belong to each building's actual faces.
const BROWNSTONE_MATERIALS = [BRICK, SKIN, BRICK, STONE, BRICK];
function architectureFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const k = idx(mx, my), sh = SHOP[k], b = sh?.architecture;
  if (!b) return false;
  const dir = side ? (rel(py - my) < 0 ? 0 : 1) : (rel(px - mx) < 0 ? 2 : 3), f = ARCH_FACES[dir][k];
  if (!f || f.height !== h) return false;
  const along = rel(wc - f.start), L = fog * amb * (side ? 11 : 15);
  if (b.profile) residentialFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  else if (b.region === 'midtown') midtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  else if (b.region === 'brownstones') brownstoneFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  else downtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  return true;
}
function brownstoneWindow(i, du, z, half, z0, z1, lit, L, base) {
  if (Math.abs(du) > half + 0.025 || z < z0 - 0.025 || z > z1 + 0.035) return false;
  if (Math.abs(du) > half || z < z0 || z > z1) {
    set(i, Math.abs(du) > half ? '|' : '=', C(base, L * 1.1)); return true;
  }
  BG[i] = C(lit ? WARM : CYAN, lit ? 2 + night * 5 : 1 + day * 1.4);
  set(i, Math.abs(du) < 0.011 ? '|' : Math.abs(z - (z0 + z1) / 2) < 0.012 ? '-' : lit ? ' ' : ':', C(lit ? WARM : WHITE, Math.max(L * 0.6, lit ? night * 13 : 0)));
  return true;
}
function architectureShutter(i, z, sh, L) {
  if (openAt(sh, tod)) return false;
  BG[i] = C(GRAY, 1 + day);
  set(i, fract(z * 60) < 0.5 ? '=' : '-', C(GRAY, L * 0.6));
  return true;
}
function architectureLeaseSign(i, u, uStep, z, d, wc, f, sh, L) {
  if (!f.front || sh.kind !== SHOP_SHUT) return false;
  const width = f.end - f.start, center = (Math.sign(u * wc) || 1) * (f.start + width / 2);
  return wallText(i, u, uStep, z, d, 'FOR LEASE', center, 0.17, Math.min(0.05, (width - 0.2) / 9), 0.05,
    C(RED, Math.max(L, 6)), C(WHITE, Math.max(L * 0.5, 3)));
}
function brownstoneFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  const base = BROWNSTONE_MATERIALS[b.material], sk = sk0(b.seed), unit = clamp(Math.floor(along / f.spacing), 0, f.units - 1);
  const center = (unit + 0.5) * f.spacing, local = along - center, corner = Math.min(along, f.end - f.start - along);
  const stone = b.material === 1 || b.material === 3, grain = hash(Math.floor(wc * 16), Math.floor(z * 22), sk);
  BG[i] = C(base, 2.5 + L * (stone ? 0.36 : 0.25) + grain * 0.45);
  if (corner < 0.07 || Math.abs(Math.abs(local) - f.spacing / 2) < 0.025)
    return set(i, fract(z * 10) < 0.11 ? '=' : '|', C(base, L * 0.9));
  if (b.h - z < 0.12 || Math.abs(z - 0.44) < 0.025) return set(i, '=', C(stone ? WHITE : STONE, L));
  if (z < 0.42) {
    const signLight = openAt(sh, tod) ? Math.max(L, night * 10) : L * 0.5;
    if (f.front && z > 0.375 && wallText(i, u, uStep, z, d, sh.word, (Math.sign(u * wc) || 1) * (f.start + (f.end - f.start) / 2), 0.39,
      Math.min(0.07, (f.end - f.start - 0.25) / sh.word.length), 0.038, C(STONE, signLight), C(base, 2))) return;
    if (architectureLeaseSign(i, u, uStep, z, d, wc, f, sh, L)) return;
    if (f.front && sh.kind === SHOP_APTS) {
      const door = local + f.spacing * 0.24, half = f.spacing * 0.125;
      const top = 0.35 - (door / half) ** 2 * 0.018;
      if (Math.abs(door) < half + 0.025 && z > 0.12 && z < top + 0.025) {
        if (Math.abs(door) > half || z > top) return set(i, z > top ? '^' : '|', C(STONE, L));
        BG[i] = C(BRICK, 1 + L * 0.12);
        return set(i, z > 0.3 ? ':' : Math.abs(door) < 0.01 ? '|' : z < 0.15 ? '=' : '#', C(z > 0.3 ? WARM : BRICK, z > 0.3 ? Math.max(L, night * 11) : L * 0.65));
      }
      if (brownstoneWindow(i, local - f.spacing * 0.22, z, f.spacing * 0.15, 0.16, 0.32, hash(unit, 5, sk) > litT, L, STONE)) return;
    } else if (f.front && z > 0.04 && z < 0.34 && Math.abs(local) < f.spacing * 0.39) {
      if (architectureShutter(i, z, sh, L)) return;
      BG[i] = C(CYAN, 1 + night * 2);
      return set(i, Math.abs(local) < f.spacing * 0.03 ? '|' : z > 0.3 ? '=' : ':', C(WARM, Math.max(L * 0.65, night * 11)));
    } else if (brownstoneWindow(i, local, z, f.spacing * 0.15, 0.13, 0.3, hash(unit, 5, sk) > litT, L, STONE)) return;
    if (z < 0.12) return set(i, fract(z * 30) < 0.15 ? '_' : ' ', C(GRAY, L * 0.8));
  } else {
    const fl = Math.floor((z - 0.45) / f.fh), floor0 = 0.45 + fl * f.fh;
    if (fl >= 0 && fl < f.floors) {
      const windows = f.front ? 2 : 3, gap = f.spacing * 0.74 / windows;
      const bay = clamp(Math.floor((local + f.spacing * 0.37) / gap), 0, windows - 1), du = local + f.spacing * 0.37 - (bay + 0.5) * gap;
      if (brownstoneWindow(i, du, z, Math.min(0.115, gap * 0.29), floor0 + f.fh * 0.18, floor0 + f.fh * 0.78,
        hash(unit * 3 + bay, fl, sk) > litT - 0.1, L, STONE)) return;
    }
  }
  return set(i, fract(z * (stone ? 10 : 24)) < 0.045 ? '_' : fract(wc * (stone ? 4 : 15) + (Math.floor(z * 24) & 1) * 0.5) < 0.04 ? '|' : grain > 0.97 ? '.' : ' ', C(base, L * 0.62));
}
function downtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  const width = f.end - f.start;
  const base = b.sty === 14 ? [STONE, WHITE, STONE, WARM, GRAY][b.material] : b.sty === 1 ? BLUE : GRAY;
  const podium = b.tiers[0].h, onPodium = z < podium && b.tiers.length > 1, stone = b.sty === 14 || onPodium;
  BG[i] = C(stone ? base : b.sty === 1 ? BLUE : GRAY, stone ? 2 + L * 0.3 : 0.6 + day * 0.7);
  if (f.height - z < 0.065 || Math.abs(z - 0.42) < 0.025 || onPodium && podium - z < 0.06)
    return set(i, '=', C(b.sty === 14 ? STONE : GRAY, L));
  const corner = Math.min(along, width - along), bays = Math.max(1, Math.floor((width - 0.12) / (b.sty === 1 ? 0.22 : 0.32)));
  const spacing = (width - 0.12) / bays, bay = Math.floor((along - 0.06) / spacing), fu = fract((along - 0.06) / spacing);
  if (corner < 0.06) return set(i, '|', C(stone ? base : GRAY, L));
  if (z < 0.4) {
    const signLight = openAt(sh, tod) ? Math.max(L, night * 14) : L * 0.5;
    if (f.front && z > 0.32 && wallText(i, u, uStep, z, d, sh.word, (Math.sign(u * wc) || 1) * (f.start + width / 2), 0.36,
      Math.min(0.085, (width - 0.3) / sh.word.length), 0.055, C(sh.neon, signLight), C(GRAY, 1))) return;
    if (architectureLeaseSign(i, u, uStep, z, d, wc, f, sh, L)) return;
    const lobby = f.front && Math.abs(along - width / 2) < Math.min(0.7, width * 0.25);
    if (z > 0.04 && z < 0.31 && (lobby || fu > 0.16 && fu < 0.84)) {
      if (architectureShutter(i, z, sh, L)) return;
      BG[i] = C(lobby ? WARM : CYAN, 1 + night * 3);
      return set(i, fu < 0.08 || fu > 0.92 || Math.abs(z - 0.26) < 0.014 ? '|' : ':', C(WHITE, Math.max(L * 0.65, night * 10)));
    }
    return set(i, fract(z * 14) < 0.08 ? '_' : ' ', C(base, L * 0.8));
  }
  const floors = Math.max(1, Math.round((f.height - 0.5) * 3)), fh = (f.height - 0.5) / floors;
  const fl = Math.floor((z - 0.43) / fh), fz = fract((z - 0.43) / fh), lit = hash(bay, fl, sk0(b.seed)) > litT;
  if (b.sty === 14) {
    if (fu < 0.15 || fu > 0.85) return set(i, '|', C(base, L));
    if (fz < 0.2) return set(i, fl % 4 === 0 ? '=' : '-', C(STONE, L * 0.65));
    if (f.height - z < 0.3) return set(i, Math.abs(fu - 0.5) < 0.15 ? '^' : '|', C(YEL, Math.max(L, night * 10)));
  } else if (fu < 0.07 || fz < 0.1) return set(i, fu < 0.07 ? '|' : '-', C(GRAY, L * 0.75));
  if (stone && (fu < 0.15 || fu > 0.85 || fz < 0.2 || fz > 0.86)) return set(i, fract(z * 12) < 0.06 ? '_' : ' ', C(base, L * 0.7));
  BG[i] = C(lit ? WARM : b.sty === 1 ? BLUE : CYAN, lit ? 1.8 + night * 4 : 0.7 + day * 1.1);
  return set(i, lit ? ' ' : b.sty === 1 && fract((along + z * 0.5) * 5) < 0.05 ? '/' : ':', C(lit ? WARM : CYAN, Math.max(L * 0.45, lit ? night * 12 : 0)));
}
function architectureDetailShade(o, i, t, L) {
  if (o.profile) return residentialDetailShade(o, i, t, L);
  const z = HIT.w, base = o.region === 'brownstones' ? BROWNSTONE_MATERIALS[o.material] : [STONE, WHITE, STONE, WARM, GRAY][o.material];
  if (o.kind === 'rail') {
    const out = HIT.u * (o.c * o.nx + o.s * o.ny), top = 0.1 + 0.12 * clamp((0.18 - out - 0.075) / 0.145, 0, 1);
    if (z > top + 0.012) return false;
    if (HIT.face >= 5 || z > top - 0.014 || Math.abs(fract(HIT.u * 32) - 0.5) < 0.17) {
      BG[i] = C(GRAY, 1); return set(i, z > top - 0.014 ? '-' : '|', C(GRAY, L * 0.8)), true;
    }
    return false;
  }
  BG[i] = C(o.kind === 'step' ? GRAY : base, (1.8 + L * 0.35) * (HIT.face >= 7 ? 0.78 : shadeFace(HIT.face)));
  if (o.kind === 'bay' && (HIT.face < 5 || HIT.face >= 7)) {
    const fl = Math.floor((z - 0.45) / o.fh), fz = fract((z - 0.45) / o.fh);
    let along = HIT.face <= 2 ? HIT.v + o.outSign * o.bevelD / 2 : HIT.u;
    let half = HIT.face <= 2 ? o.hw - o.bevelD / 2 : o.hl;
    if (HIT.face === (o.outSign > 0 ? 3 : 4)) half -= o.bevelW;
    if (HIT.face >= 7) {
      const sign = HIT.face === 7 ? 1 : -1, width = Math.hypot(o.bevelW, o.bevelD);
      const midU = sign * (o.hl - o.bevelW / 2), midV = o.outSign * (o.hw - o.bevelD / 2);
      along = ((HIT.u - midU) * o.bevelW - sign * o.outSign * (HIT.v - midV) * o.bevelD) / width;
      half = width / 2;
    }
    const frame = Math.min(0.03, half * 0.3);
    if (fl >= 0 && fl < o.floors && fz > 0.18 && fz < 0.78 && Math.abs(along) < half - frame) {
      const lit = hash(fl, 4, sk0(o.seed)) > litT - 0.1;
      BG[i] = C(lit ? WARM : CYAN, lit ? 2 + night * 5 : 1 + day * 1.4);
      return set(i, Math.abs(along) < 0.01 ? '|' : fz > 0.46 && fz < 0.49 ? '-' : lit ? ' ' : ':', C(WHITE, Math.max(L * 0.7, lit ? night * 12 : 0))), true;
    }
  }
  const top = HIT.face === 5;
  set(i, top || o.kind === 'course' || o.kind === 'cornice' ? '=' : o.kind === 'pier' ? '|' : ' ', C(o.kind === 'step' ? GRAY : STONE, L * 0.9));
  if (top) paintSettledSnow(i, o.x + HIT.u * o.c - HIT.v * o.s, o.y + HIT.u * o.s + HIT.v * o.c, L * 0.7,1,0,HIT.w);
  return true;
}
function drawArchitecture() {
  forNear(architectureBuildingsB, b => {
    const c = b.crown;
    if (!c || Math.hypot(rel(c.x - px), rel(c.y - py)) > vis + 2) return;
    drawBox({ ...boxAt(...R(c.x, c.y), 1, 0, c.hl, c.hw, c.z0, c.z1), planes: c.planes }, (i, t, L) => {
      const seam = Math.abs(fract((HIT.face < 8 ? HIT.v : HIT.u) * 8) - 0.5) > 0.44;
      BG[i] = C(GRAY, (1.2 + L * 0.25) * (HIT.face === 4 ? 1.15 : 0.85));
      set(i, seam ? '/' : ' ', C(seam ? YEL : GRAY, L));
      paintSettledSnow(i, c.x + HIT.u, c.y + HIT.v, L * 0.7, HIT.face === 4 ? 1 : 0.5,0,HIT.w);
      return true;
    }, rayMansard);
  });
  forNear(architectureDetailsB, o => {
    if (map[o.ownerCell] !== o.ownerHeight) return;
    // Massing stays in the height map; small trim is culled before it becomes an unreadable speck.
    const vx = rel(o.x - px), vy = rel(o.y - py), distance = Math.hypot(vx, vy);
    if (distance > vis + 1 || distance > (o.detailDistance || (o.kind === 'bay' || o.kind === 'cornice' ? 18 : 9))) return;
    // Reject boxes outside the view before projecting their corners or copying their shape data.
    const along = dx * o.c + dy * o.s, across = -dx * o.s + dy * o.c;
    const far = dx * vx + dy * vy + Math.abs(along) * o.hl + Math.abs(across) * o.hw;
    const edge = Math.abs(-dy * vx + dx * vy) - Math.abs(across) * o.hl - Math.abs(along) * o.hw;
    if (far < 0.02 || edge > far * tf) return;
    if (o.z0 > eye && (o.z0 - eye) * projY > (hor + 1) * far ||
      o.z1 < eye && (eye - o.z1) * projY > (rows + 1 - hor) * far) return;
    drawBox({ ...o, x: vx, y: vy }, (i, t, L) => architectureDetailShade(o, i, t, L), o.planes ? rayBeveledBay : rayBox);
  });
}

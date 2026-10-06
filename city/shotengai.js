// ===== the Shotengai: a few blocks of covered shopping streets south of downtown (world.js picks the neighbourhood).
// Narrow buildings hung all over with vertical neon signs, air-conditioners and lit upstairs signboards; shops with
// noren curtains and paper lanterns at the door; a roof of ribbed translucent panels over every street, lamps along
// it, banners hanging from it; vending machines on every corner. Inside: a pachinko parlour, crane game shops, a
// capsule hotel, and izakayas, yakitori, takoyaki and bento counters.

// ---- facades (STY 17)
const NOREN = [RED, BLUE, GRAY, BRICK];
function shotengaiFront(i, u, z, sh, sk, open, L, glowL) { // the ground floor, under the shop sign
  const fs = fract(u * 2), lit = Math.max(L, glowL);
  if (fs < 0.06) return set(i, '|', C(BRICK, L));
  if (!open) return set(i, fract(z * 60) < 0.5 ? '=' : '-', C(GRAY, L * 0.6)); // shutters down
  if ((Math.abs(fs - 0.14) < 0.05 || Math.abs(fs - 0.86) < 0.05) && z > 0.17 && z < 0.28) { // paper lanterns either side of the door
    BG[i] = C(RED, 3 + night * 5); return set(i, z > 0.265 || z < 0.18 ? '=' : fract(z * 40) < 0.4 ? '-' : 'O', C(z > 0.265 || z < 0.18 ? GRAY : YEL, lit));
  }
  if (z > 0.24 && fs > 0.22 && fs < 0.78) { // the noren: cloth panels hanging in the doorway, split, the shop's mark on them
    if (fract(fs * 8) < 0.12) return set(i, ' ', 0);
    BG[i] = C(NOREN[sk & 3], 2 + L * 0.15);
    return set(i, Math.abs(fs - 0.5) < 0.05 && z > 0.27 ? 'o' : ' ', C(WHITE, lit));
  }
  if (z < 0.24 && fs > 0.22 && fs < 0.78) { BG[i] = C(WARM, 2 + glowL * 0.15); return set(i, fract(z * 30) < 0.15 ? '-' : ':', C(WARM, lit)); } // the warm doorway
  // display windows: plastic food, capsule toys, magazines, whatever they sell
  BG[i] = C(GRAY, 1 + glowL * 0.1);
  if (fract(z * 16) < 0.2) return set(i, '=', C(GRAY, L));
  return set(i, sh.glyphs[hash(Math.floor(u * 20), Math.floor(z * 16), sk) * sh.glyphs.length | 0], C(ITEM_COL[hash(Math.floor(u * 20), Math.floor(z * 16), sk + 1) * 8 | 0], lit));
}
function shotengaiUpper(i, u, z, zz, fl, fz, h, d, uStep, sh, sk, open, L, glowL) {
  const bays = 1.5, fu = fract(u * bays), bay = Math.floor(u * bays);
  // a vertical neon sign down the edge of every bay: the shop's name, top to bottom, chasing lights along its edges
  if (fu > 0.04 && fu < 0.16 && zz < h - 0.55 && zz > 0.05) {
    const w = sh.kind === SHOP_APTS ? ['HOTEL', 'BAR', 'KARAOKE', 'MAHJONG', 'CLINIC', 'DANCE'][(bay + sk) % 6] : sh.word, col = NEON[(bay + sk) & 3];
    BG[i] = C(col, 2 + night * 2);
    if (fu < 0.05 || fu > 0.15) return set(i, fract(zz * 12 - T * 2) < 0.4 ? '*' : '|', C(YEL, Math.max(L, night * 15)));
    const q = (h - 0.65 - zz) / 0.09, p = Math.floor(q);
    const on = oneCell((fract(q) - 0.5) * 0.09, d / projY) && (uStep >= 0.06 || oneCell((fu - 0.1) * 0.66, uStep));
    return set(i, on && p >= 0 && p < w.length ? w[p] : ' ', C(WHITE, Math.max(L, night * 15)));
  }
  if (fz > 0.8) { // a lit signboard across each floor: somebody's bar, clinic, mahjong parlour
    const lit_ = hash(bay, fl, sk + 3) > 0.3;
    BG[i] = C(lit_ ? NEON[(bay * 3 + fl) & 3] : GRAY, lit_ ? 2 + night * 4 : 1);
    return set(i, lit_ && fract(u * 9) < 0.5 ? '=' : ' ', C(WHITE, Math.max(L, lit_ ? night * 13 : 0)));
  }
  if (fz > 0.12 && fz < 0.32 && fu > 0.7 && fu < 0.82 && hash(bay, fl, sk + 5) > 0.4) return set(i, fz > 0.29 || fz < 0.15 ? '-' : '#', C(GRAY, L)); // an air-conditioner
  const wu = fract(u * bays * 2);
  if (fu > 0.2 && wu > 0.2 && wu < 0.8 && fz > 0.25 && fz < 0.72) { // small windows: lamp-lit, TV-blue, or dark
    const k = hash(Math.floor(u * bays * 2), fl, sk);
    if (k > litT - 0.1) return set(i, fract(wu * 3) < 0.15 ? '|' : '#', C(k > 0.93 ? CYAN : WARM, Math.max(L, glowL)));
    return set(i, '.', C(GRAY, L * 0.3));
  }
  return set(i, (Math.floor(u * 10) + Math.floor(zz * 20)) % 6 ? ' ' : '.', C(GRAY, L * 0.6)); // tiled render
}

// ---- the arcade roof over the streets, seen from underneath
// It's glass: the steel shows (beams down the sides, a rib every 5m, a bar down the middle and across between the
// ribs) and between them you see the sky, and the buildings above the roofline
function arcadeRoofPart(wx, wy) {
  const k = idx(Math.floor(wx), Math.floor(wy)), r = ROAD[k], ns = r === 1 || r === 3 && fract(wy / 8) >= 0.25;
  const across = (ns ? mod(wx, 8) : mod(wy, 8)) / 2, along = ns ? wy : wx;
  if (across < 0.02 || across > 0.98) return 'beam';
  if (fract(along * 2) < 0.035) return 'rib';
  if (Math.abs(across - 0.5) < 0.015 || Math.abs(fract(along * 2) - 0.5) < 0.025) return 'bar';
  return null; // glass
}
function arcadeRoofCell(i, wx, wy) {
  const part = arcadeRoofPart(wx, wy);
  const steel = 4 + day * 4 + lampsOn * 2;
  if (part === 'beam') { BG[i] = C(GRAY, steel); return set(i, '#', C(WHITE, 9)), true; }
  if (part === 'rib') { BG[i] = C(GRAY, steel * 0.8); return set(i, '=', C(WHITE, 10)), true; }
  if (part === 'bar') { BG[i] = C(GRAY, steel * 0.7); return set(i, '-', C(WHITE, 8)), true; }
  return false;
}
// does the ray to this wall cell pass under the arcade roof first? (wall points above it are hidden by it)
function arcadeRoofHit(z, side, mx, my, wc) {
  if (eye >= ARCADE_Z || z <= ARCADE_Z) return null;
  const f = (ARCADE_Z - eye) / (z - eye), wx = side ? wc : mx + (rel(px - mx) < 0 ? 0 : 1), wy = side ? my + (rel(py - my) < 0 ? 0 : 1) : wc;
  const hx = px + rel(wx - px) * f, hy = py + rel(wy - py) * f;
  return arcadeAt(hx, hy) && arcadeRoofPart(mod(hx, N), mod(hy, N)) ? [hx, hy] : null; // (through the glass: the wall)
}
// and the sky: where the roof is over you, that's what you see looking up
function arcadeSky(i, rx, ry, up) {
  if (eye >= ARCADE_Z || up <= 0) return false;
  const t = (ARCADE_Z - eye) / up;
  if (t > 40) return false;
  const hx = px + rx * t, hy = py + ry * t;
  if (!arcadeAt(hx, hy) || !arcadeRoofPart(mod(hx, N), mod(hy, N))) return false; // (through the glass: the sky)
  ZB[i] = t; arcadeRoofCell(i, mod(hx, N), mod(hy, N));
  return true;
}

// ---- inside: the pachinko parlour, the crane game shop, the capsule hotel
// a pachinko machine: chrome and lights, the glass full of pins with silver balls raining down, a tray of balls
const pachinkoMachine = (x, y, k, fy) => ({ ...BX(x, y, 0.3, 0.25, 0, 1.9, (i, t, L) => {
  const f = HIT.face, w = HIT.w, v = HIT.v;
  BG[i] = C(GRAY, (2 + L * 0.3) * shadeFace(f));
  if (f !== 1) return set(i, f === 5 ? ' ' : fract(w * 5) < 0.1 ? '-' : ' ', C(GRAY, L)), true;
  if (w > 1.7) { BG[i] = C(NEON[k & 3], 4); return set(i, fract(v * 8 + T * 3) < 0.5 ? '*' : ' ', C(YEL, 15)), true; } // the lit crown
  if (w > 0.95 && Math.abs(v) < 0.24) { // the glass: pins, balls falling, the reels in the middle
    BG[i] = C(BLUE, 1);
    if (Math.abs(w - 1.3) < 0.07 && Math.abs(v) < 0.1) return set(i, '7', C(RED, 15)), true;
    if (hash(Math.floor(v * 30), Math.floor(w * 25 + T * 6), k) > 0.93) return set(i, 'o', C(WHITE, 15)), true;
    return set(i, (Math.floor(v * 30) + Math.floor(w * 25)) & 1 ? ' ' : '.', C(YEL, 9)), true;
  }
  if (w > 0.75 && w < 0.92) return set(i, 'o', C(WHITE, 13)), true; // the tray of balls
  return set(i, Math.abs(v) < 0.04 && w > 0.5 && w < 0.7 ? '@' : ' ', C(GRAY, L)), true; // the handle
}, 0, fy), pachi: true, cx: x, cy: y, fy });
const crane = (x, y, k) => ({ ...BX(x, y, 0.45, 0.45, 0, 1.95, (i, t, L) => { // a crane cabinet: a glass case of plush, the claw above
  const f = HIT.face, w = HIT.w;
  if (f === 5 || w > 1.75) { BG[i] = C([MAG, CYAN, YEL, GREEN][k & 3], 4); return set(i, f === 5 ? ' ' : fract(HIT.u * 6 + T * 2) < 0.5 ? '*' : '=', C(WHITE, 15)), true; }
  if (w < 0.7) { BG[i] = C([MAG, CYAN, YEL, GREEN][k & 3], 2 + L * 0.2); return set(i, w > 0.6 ? '=' : w > 0.35 && w < 0.45 && (f === 1 || f === 2) ? 'o' : ' ', C(WHITE, L)), true; }
  BG[i] = C(CYAN, 1); // the glass
  const a = f <= 2 ? HIT.v : HIT.u;
  if (w < 1.05) return set(i, '@', C(ITEM_COL[hash(Math.floor(a * 10), Math.floor(w * 10), k) * 8 | 0], 13)), true; // the pile of prizes
  const cx = 0.25 * Math.sin(T * 0.7 + k);
  if (Math.abs(a - cx) < 0.04 && w > 1.35) return set(i, '|', C(GRAY, 12)), true;
  if (Math.abs(w - 1.32) < 0.04 && Math.abs(a - cx) < 0.1) return set(i, Math.abs(a - cx) > 0.05 ? (a < cx ? '/' : '\\') : 'V', C(WHITE, 14)), true;
  return set(i, ' ', 0), true;
}), crane: true, cx: x, cy: y });
const nearPachinko = () => mode === 'room' && room.props.find(s => s.pachi && Math.abs(px - s.cx) < 0.4 && Math.abs(py - (s.cy + s.fy * 0.75)) < 0.4) || null;
const nearCrane = () => mode === 'room' && room.props.find(s => s.crane && Math.abs(px - s.cx) < 0.6 && py > s.cy + 0.4 && py < s.cy + 1.4) || null;
const nearMahjong = () => mode === 'room' && room.kind === 'tea' && room.props.find(s => s.mj && Math.hypot(px - s.cx, py - s.cy) < 1.3) || null;
function shotengaiPrompt() {
  if (nearMahjong()) return `E: sit in on a hand of mahjong (${fmt$(MJ_BUYIN)} in the pot)`;
  const pm = nearPachinko();
  if (pm) return pm.busy ? 'Somebody\'s on this one' : `E: play pachinko (${fmt$(CREDIT)} for 40 balls)`;
  if (room.kind === 'pachinko' && nearKeeper()) return `E: swap tickets for prizes (${tickets} tickets)`;
  if (nearCrane()) return `E: try the crane (${fmt$(CREDIT)})`;
  if (room.kind === 'capsule' && nearKeeper()) return `E: a pod for the night (${fmt$(CAPSULE_RATE)})`;
  return '';
}
const CAPSULE_RATE = 15;
function useShotengai() { // true if E did something (and the mahjong tables in the tea houses)
  if (nearMahjong()) { if (!pay(MJ_BUYIN)) say(`The buy-in's ${fmt$(MJ_BUYIN)}.`); else { startGame('mahjong', 'table'); say('"Sit, sit. Four sets and a pair, yes? We play the simple way here."', 4); } return true; }
  const pm = nearPachinko();
  if (pm) { if (pm.busy) say('Somebody\'s on this one. He doesn\'t look up.'); else if (!pay(CREDIT)) say(`It's ${fmt$(CREDIT)} for a tray of balls.`); else startGame('pachinko', 'arcade'); return true; }
  if (room.kind === 'pachinko' && nearKeeper()) { openPrizes(); return true; }
  if (nearCrane()) { if (!pay(CREDIT)) say(`It's ${fmt$(CREDIT)} a go.`); else startGame('crane', 'arcade'); return true; }
  if (room.kind === 'capsule' && nearKeeper()) {
    if (!pay(CAPSULE_RATE)) { say(`A pod's ${fmt$(CAPSULE_RATE)}.`); return true; }
    sleep = { t: 0, home: true };
    say(`Pod ${100 + (Math.random() * 300 | 0)}. You crawl in, pull the blind down and the hum of the air vent puts you straight to sleep.`, 4);
    return true;
  }
  return false;
}
function pachinkoWall(i, u, uStep, z, d, mx, my, L) { // mirrored panels, a neon band, the prize list over the counter
  if (Math.abs(z - 2.5) < 0.06) return set(i, '=', C(NEON[Math.floor(Math.abs(u) * 2 + T * 4) & 3], 15)), true;
  if (mx === room.W - 1 && z > 1.6 && z < 2.3 && wallText(i, u, uStep, z, d, 'PRIZES', 8.5 * Math.sign(u), 1.95, 0.2, 0.3, C(YEL, 15), C(RED, 3))) return true;
  BG[i] = C(MAG, 1 + L * 0.05);
  return set(i, (Math.floor(Math.abs(u) * 4) + Math.floor(z * 4)) % 5 ? ' ' : '*', C(YEL, 8)), true;
}
function capsuleWall(i, u, uStep, z, d, mx, my, L) { // the side walls are pods, two high: round-cornered holes, blinds, a glow
  if (mx !== 0 && mx !== room.W - 1 || z > 2.4) { BG[i] = C(WHITE, 2 + L * 0.1); return set(i, z > 2.4 && fract(Math.abs(u) * 2) < 0.1 ? '|' : ' ', C(GRAY, L)), true; }
  const au = Math.abs(u), pu = fract(au / 1.1), pz = z < 1.2 ? z / 1.2 : (z - 1.2) / 1.2, pod = Math.floor(au / 1.1) * 2 + (z < 1.2 ? 0 : 1);
  BG[i] = C(WHITE, 3 + L * 0.1);
  if (pu < 0.1 || pu > 0.9 || pz < 0.12 || pz > 0.88) return set(i, pz > 0.95 || pz < 0.04 ? '_' : ' ', C(GRAY, L)), true;
  if (hash(pod, mx, 7) > 0.55) { BG[i] = C(GRAY, 2); return set(i, fract(pz * 10) < 0.5 ? '=' : '-', C(GRAY, L * 0.8)), true; } // blind down: somebody's in
  BG[i] = C(WARM, 2 + L * 0.15); return set(i, pz < 0.3 ? '~' : ' ', C(BLUE, 12)), true; // an empty pod: the futon, the little lamp
}
const SHOTENGAI_ROOMS = {
  pachinko: { grid: boxRoom(14, 11), light: 1, floor: 'carpet', ceil: 'disco', wall: pachinkoWall, keeper: [12.3, 8.6],
    props: r => {
      const p = [];
      for (let x = 2; x <= 12; x += 0.85) p.push({ ...pachinkoMachine(x, 1.5, Math.round(x * 3), 1), busy: chance(0.55) });
      for (let x = 2.4; x <= 10.4; x += 0.85) { p.push({ ...pachinkoMachine(x, 4.9, Math.round(x * 5), -1), busy: chance(0.5) }, { ...pachinkoMachine(x, 5.45, Math.round(x * 7), 1), busy: chance(0.5) }); }
      for (const s of p.slice()) if (s.busy) p.push(sitting(s.cx, s.cy + s.fy * 0.6, shirt(), 0.45, s.fy > 0));
      p.push(...counterBox(12.3, 9.2, 0.9), standing(12.3, 8.6, RED));
      return p;
    } },
  cranes: { grid: boxRoom(11, 8), light: 1, floor: 'carpet', ceil: 'disco', wall: arcadeWall,
    props: r => {
      const p = [];
      for (const [x, y] of [[2, 1.5], [3.4, 1.5], [4.8, 1.5], [6.2, 1.5], [7.6, 1.5], [9, 1.5], [3, 4.4], [4.4, 4.4], [6.6, 4.4], [8, 4.4]]) p.push(crane(x, y, Math.round(x * 3 + y)));
      if (chance(0.6)) p.push(standing(3.4, 2.6, shirt())); if (chance(0.6)) p.push(SP(8, 5.5, 0.4, 1.15, ART.keeper, (c, row, L) => C(row < 3 ? SKIN : row < 6 ? MAG : BLUE, L)));
      return p;
    } },
  capsule: { grid: boxRoom(7, 12), light: 0.9, floor: 'wood', ceil: 'strip', wall: capsuleWall, keeper: [5.2, 9.1], // (the desk off to one side: it used to stand right across the door)
    props: r => [...counterBox(5.2, 9.7, 0.65), standing(5.2, 9.1, BLUE), SP(1.4, 10.6, 0.7, 1.3, ART.plant, plantCol)] },
};
Object.assign(ROOM_DEFS, SHOTENGAI_ROOMS);
Object.assign(ROOM_FOR, { PACHINKO: 'pachinko', 'CRANE GAME': 'cranes', GACHA: 'cranes', CAPSULE: 'capsule', IZAKAYA: 'bar', KISSATEN: 'cafe', MANGA: 'books', DRUGSTORE: 'store',
  YAKITORI: 'diner', TAKOYAKI: 'diner', BENTO: 'diner' });
MENU_ITEMS.push(['YAKITORI 6', 'EDAMAME 3', 'SAKE 7', 'BEER 6'], ['TAKOYAKI 5', 'RAMUNE 2', 'ONIGIRI 3', 'TEA 2'], ['BENTO 9', 'ONIGIRI 3', 'MISO 3', 'TEA 2']);
Object.assign(MENUS, { YAKITORI: MENU_ITEMS.length - 3, TAKOYAKI: MENU_ITEMS.length - 2, BENTO: MENU_ITEMS.length - 1 });

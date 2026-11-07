'use strict';
// ---- the emergency services' street fronts (WORLD_QUALITY item 42). The ground floor of each police station, fire
// station and hospital is laid out round its real door (SERVICES, world.js): the police station's rusticated stone,
// barred windows and lamp-flanked double doors; the fire station's two apparatus bays in brick piers; the hospital's
// sliding doors under a red band, ribbon windows in white panels. On the pavement out front: the bay each service
// keeps clear for its vehicle.

// the service whose lot this shop is, and the cells of pavement in front of each: worked out again whenever the
// services' doors move (the world is laid out, then placed in the ocean)
const CIVIC_OF = new Map(), CIVIC_APRON = new Map();
let civicKeyX = NaN, civicKeyY = NaN, civicKeyN = NaN;
function civicIndex() { // (called for every pavement pixel: three number compares when nothing has moved)
  const d0 = SERVICES[0]?.door;
  if (!d0 || (d0[0] === civicKeyX && d0[1] === civicKeyY && N === civicKeyN)) return;
  civicKeyX = d0[0]; civicKeyY = d0[1]; civicKeyN = N; CIVIC_OF.clear(); CIVIC_APRON.clear();
  for (const b of SERVICES) {
    const frontY = Math.round(b.door[1] + .12), sh = SHOP[idx(Math.floor(b.door[0] - .01), frontY)];
    b.frontY = frontY;
    if (sh) CIVIC_OF.set(sh, b);
    for (let x = Math.floor(b.door[0] - 2.6); x <= Math.floor(b.door[0] + 2.6); x++) CIVIC_APRON.set(idx(x, frontY - 1), b);
  }
}

const civicFp = (uStep, d) => Math.max(uStep, d / projY);
function civicStone(i, wc, z, fp, L, tone = 1) { // rusticated courses: deep horizontal joints, staggered vertical ones
  const row = Math.floor(z / .045), course = coveGroove(z, .045, .006, fp), joint = coveGroove(wc + (row & 1) * .09, .18, .004, fp);
  BG[i] = C(GRAY, (2.2 + L * .14) * tone - 1.6 * course - .9 * joint + (hash(Math.floor((wc + (row & 1) * .09) / .18), row, 811) - .5) * .25);
  return set(i, ' ', 0), true;
}
function civicBrick(i, wc, z, fp, L) { // red brick, stretcher bond, its mortar filtered with distance
  const row = Math.floor(z / .016), course = coveGroove(z, .016, .0025, fp), joint = coveGroove(wc + (row & 1) * .025, .05, .0025, fp);
  BG[i] = C(RED, 1.35 + L * .1 - .9 * Math.max(course, joint) + (hash(Math.floor((wc + (row & 1) * .025) / .05), row, 812) - .5) * .2);
  return set(i, ' ', 0), true;
}
const civicGlass = (i, lit, col = CYAN, k = 1) => { BG[i] = C(col, (.7 + lit * .25) * k); return set(i, ' ', 0), true; };

function civicFront(i, u, uStep, z, d, side, mx, my, wc, sh, L, lit) {
  civicIndex();
  const b = CIVIC_OF.get(sh);
  if (!b || z > .32) return false;
  const fp = civicFp(uStep, d), front = side && my === b.frontY && rel(py - my) < 0, du = front ? wc - b.door[0] : 99;
  if (b.kind === 'police') {
    if (Math.abs(du) < .32 && z < .025) { BG[i] = C(GRAY, 3.2 + L * .15 - coveGroove(z, .0125, .002, fp) * 1.5); return set(i, ' ', 0), true; } // the steps
    if (Math.abs(du) < .27 && z < .275) { // the entrance: a stone surround, a lit transom, two doors with glass
      const a = Math.abs(du);
      if (a > .235 || z > .255) return civicStone(i, wc, z, fp, L, 1.2);
      if (z > .205) return Math.abs(fract(du / .078) - .5) < .06 ? (BG[i] = C(GRAY, 1), set(i, ' ', 0), true) : civicGlass(i, lit, WARM, 1.2);
      if (z > .195 || a < .006) { BG[i] = C(GRAY, 1.2); return set(i, ' ', 0), true; }
      const glass = a > .03 && a < .205 && z > .1 && z < .18, handle = Math.abs(a - .025) < .006 && Math.abs(z - .1) < .02;
      if (handle) { BG[i] = C(YEL, 6); return set(i, ' ', 0), true; }
      if (glass) return civicGlass(i, lit, CYAN, 1.1);
      BG[i] = C(BLUE, .9 + L * .1 - (Math.abs(fract(z / .045) - .5) > .44 ? .3 : 0)); return set(i, ' ', 0), true;
    }
    for (const e of [-1, 1]) { const lu = du - e * .34; if (Math.abs(lu) < .035 && z > .19 && z < .27) { // the blue lamps, either side
      const globe = Math.hypot(lu / .035, (z - .245) / .025) < 1;
      if (globe) { BG[i] = C(BLUE, 3 + night * 7); return set(i, Math.abs(z - .245) < .006 ? '-' : ' ', C(WHITE, Math.max(L, night * 15))), true; }
      if (Math.abs(lu) < .006) { BG[i] = C(GRAY, .8); return set(i, ' ', 0), true; }
    } }
    const wu = fract((wc - (front ? b.door[0] : 0)) / .5 + .5) - .5; // tall barred windows on .5 centres
    if (Math.abs(du) > .45 && Math.abs(wu) < .09 && z > .07 && z < .245) {
      if (Math.abs(wu) > .075 || z > .235) return civicStone(i, wc, z, fp, L, 1.35);
      if (Math.abs(fract(wu / .03) - .5) < .12 && fp < .02) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; } // the bars
      return civicGlass(i, lit, CYAN, .9);
    }
    if (z > .06 && z < .07 && Math.abs(wu) < .1 && Math.abs(du) > .45) { BG[i] = C(GRAY, 3.4); return set(i, ' ', 0), true; } // sills
    if (z > .275 && z < .3) { BG[i] = C(BLUE, 1.4 + L * .1); return set(i, ' ', 0), true; } // the blue string course under the sign
    return civicStone(i, wc, z, fp, L, z < .04 ? .75 : 1);
  }
  if (b.kind === 'fire') {
    for (const c of [-.5, .5]) { const bu = du - c; if (Math.abs(bu) < .42 && z < .265) { // an apparatus bay: white frame, red folding door, a band of windows
      if (Math.abs(bu) > .405 || z > .25) { BG[i] = C(WHITE, 4.5 + L * .2); return set(i, ' ', 0), true; }
      if (z > .15 && z < .19) return Math.abs(fract(bu / .082) - .5) > .42 ? (BG[i] = C(RED, 1.6), set(i, ' ', 0), true) : civicGlass(i, lit, WARM, 1.1);
      const panel = coveGroove(z, .025, .003, fp), fold = coveGroove(bu, .205, .004, fp);
      BG[i] = C(RED, 2.4 + L * .25 - 1.4 * Math.max(panel, fold)); return set(i, ' ', 0), true;
    } }
    if (Math.abs(du) < .055 && z < .265 && front) return civicBrick(i, wc, z, fp, L); // the pier between the bays
    const pd = du - 1.25; // the crew's door, to one side
    if (front && Math.abs(pd) < .09 && z < .21) {
      if (Math.abs(pd) > .075 || z > .2) { BG[i] = C(WHITE, 4); return set(i, ' ', 0), true; }
      if (z > .11 && z < .18 && Math.abs(pd) < .055) return civicGlass(i, lit, WARM, 1);
      BG[i] = C(RED, 1.6 + L * .15); return set(i, ' ', 0), true;
    }
    if (z > .265 && z < .3 && front && Math.abs(du) < .95) { BG[i] = C(WHITE, 3.5 + L * .2 - coveGroove(wc, .1, .004, fp)); return set(i, ' ', 0), true; } // the stone lintel over the bays
    const wu = fract(wc / .45) - .5; // elsewhere: tall windows in the brick
    if (Math.abs(du) > 1.4 && Math.abs(wu) < .08 && z > .08 && z < .24) return Math.abs(wu) > .068 || z > .23 ? (BG[i] = C(WHITE, 3.6), set(i, ' ', 0), true) : civicGlass(i, lit, WARM, .8);
    if (z < .03) { BG[i] = C(GRAY, 1.8 + L * .1); return set(i, ' ', 0), true; } // the plinth
    return civicBrick(i, wc, z, fp, L);
  }
  // the hospital
  if (Math.abs(du) < .34 && z < .3) { // the entrance: a red band with a white cross over sliding glass doors
    if (z > .25) { const cu = Math.abs(du), cz = Math.abs(z - .275), cross = (cu < .018 && cz < .018) || (cu < .006 && cz < .02) || (cz < .006 && cu < .02); BG[i] = cross ? C(WHITE, 14) : C(RED, 3 + L * .2 + night * 3); return set(i, ' ', 0), true; }
    if (Math.abs(du) > .315 || z > .24) { BG[i] = C(GRAY, 3.5 + L * .2); return set(i, ' ', 0), true; }
    if (Math.abs(du) < .004 || Math.abs(Math.abs(du) - .16) < .004) { BG[i] = C(GRAY, 2.6); return set(i, ' ', 0), true; } // the leaves' frames
    return civicGlass(i, lit, CYAN, 1.25 + (z < .02 ? -.3 : 0));
  }
  if (z < .04) { BG[i] = C(GRAY, 2 + L * .12 - coveGroove(wc, .3, .004, fp)); return set(i, ' ', 0), true; } // the plinth
  if (z > .1 && z < .22) { // the ribbon window, mullioned
    if (Math.abs(fract(wc / .2) - .5) > .46) { BG[i] = C(WHITE, 3.8); return set(i, ' ', 0), true; }
    return civicGlass(i, lit, CYAN, .95);
  }
  if (front) for (const e of [-1, 1]) { const cu = Math.abs(du - e * .55), cz = Math.abs(z - .26); if (cu < .04 && cz < .04 && (cu < .013 || cz < .013)) { BG[i] = C(RED, 6 + night * 8); return set(i, ' ', 0), true; } } // a red cross either side
  BG[i] = C(WHITE, 2.2 + L * .32 - 2 * coveGroove(wc, .3, .004, fp) - 1.5 * coveGroove(z, .1, .003, fp)); return set(i, ' ', 0), true; // white panels
}

// The pavement in front: the bay each service keeps clear, painted. [base, level] for floorCell, or null.
function civicApron(wx, wy, L, d) {
  civicIndex();
  const b = CIVIC_APRON.get(idx(Math.floor(wx), Math.floor(wy)));
  if (!b) return null;
  const ex = wx - b.x, ey = b.frontY - wy, fp = d / projY, LP = L * roadDark();
  if (ey < 0 || ey > .3) return null;
  if (b.kind === 'fire') { // the whole front of the bays: yellow hatching in a yellow border, KEEP CLEAR
    const du = wx - b.door[0];
    if (Math.abs(du) > .95) return null;
    const edge = Math.min(.95 - Math.abs(du), .3 - ey, ey);
    if (edge < .018) return [YEL, LP * .7];
    return fract((du + ey) / .06) < .35 && fp < .03 ? [YEL, LP * .55] : null;
  }
  if (Math.abs(ex) > .34) return null;
  const edge = Math.min(.34 - Math.abs(ex), .28 - ey, ey - .02);
  if (b.kind === 'police') { // a bay outlined in white, POLICE down its middle in blue
    if (edge < 0) return null;
    if (edge < .016) return [WHITE, LP * .75];
    return Math.abs(ey - .15) < .03 && Math.abs(fract(ex / .05) - .5) < .3 && fp < .03 ? [BLUE, LP * .5] : null;
  }
  // the ambulance bay: a red and white chequer border, the bay inside kept bare
  if (edge < 0) return null;
  if (edge < .03) return (Math.floor((wx + wy) / .03) & 1) ? [RED, LP * .65] : [WHITE, LP * .7];
  return null;
}

// Fishing finds, small treasures and ammunition get full held art as well as their small ground icons.
function heldAmmo(it) {
  return sculpt(32, 18, (x, y) => {
    if (Math.abs(x) > 8.4 || y < -6.6 || y > 7.6) return null;
    if (Math.abs(x) > 7.8 || y < -6 || Math.abs(y - 2.3) < .5 || y > 7) return dLit(.65 - x * .025, WARM, 8);
    if (y < 2.3) {
      for (let k = 0; k < Math.min(24, it.uses); k++) {
        const cx = -6.3 + (k % 8) * 1.8, cy = -4.3 + Math.floor(k / 8) * 2.1;
        const d = dEll(x, y, cx, cy, .65, .8);
        if (d < 1) return [d < .25 ? '.' : 'o', C(d < .25 ? BRICK : YEL, d < .25 ? 6 : 14)];
      }
      return [':', C(BRICK, 5)];
    }
    const word = dText(x, y, 0, 4, '.38 SPECIAL') || dText(x, y, 0, 6, '24 ROUNDS');
    return word ? [word, C(RED, 13)] : dLit(.6 - x * .025, WARM, 8);
  });
}
DENSE.ammo = heldAmmo;
DROPPED_ART.ammo = it => [[' .--------.', '| o o o o |', '|.38 BOX  |', " '--------'"], ch => ch === 'o' ? C(YEL, 14) : /[.38BOX]/.test(ch) ? C(RED, 13) : C(WARM, 12)];

function heldShellfish(it) {
  const crab = it.id === 'crab', wave = Math.sin(T * 2.4);
  return sculpt(32, 19, (x, y) => {
    if (crab) {
      for (const sg of [-1, 1]) {
        for (let k = 0; k < 3; k++) if (Math.abs(y - (2 + k * 1.7 + sg * x * .15)) < .35 && x * sg > 2.7 && x * sg < 8) return ['/', C(RED, 12)];
        const claw = dEll(x, y, sg * 6.2, -3.4 + wave * sg * .4, 2, 2.5);
        if (claw < 1 && !(Math.abs(x - sg * 6.2) < .5 && y < -3.4)) return dLit(.8 - sg * (x - sg * 6.2) * .12, RED, 9);
      }
      if (Math.abs(Math.abs(x) - 1.7) < .5 && y < -1.8 && y > -3.5) return ['o', C(WHITE, 15)];
      if (dEll(x, y, 0, .7, 5.4, 3.4) < 1) return dLit(dBall(x, y, 0, .7, 5.4, 3.4), RED, 8);
    } else {
      if (y > 2.7 && y < 8.8) for (let k = 0; k < 6; k++) {
        const cx = (k - 2.5) * 1.25 + Math.sin(y * .7 + T * 2 + k) * .55;
        if (Math.abs(x - cx) < .32) return [Math.cos(y * .7 + T * 2 + k) > 0 ? '(' : ')', C(MAG, 11)];
      }
      if (y < -7.6 || y > 3.2 || Math.abs(x) > Math.max(0, (y + 7.6) * .52)) return null;
      if (Math.abs(Math.abs(x) - 1.4) < .5 && Math.abs(y - 1.2) < .55) return ['o', C(WHITE, 15)];
      return dLit(.8 - Math.abs(x) * .07, MAG, 8);
    }
    return null;
  });
}
DENSE.crab = DENSE.squid = heldShellfish;

function heldFishingJunk(it) {
  const id = it.id;
  return sculpt(32, 19, (x, y) => {
    if (id === 'oldboot') {
      const cuff = x > -5.6 && x < 1.5 && y > -7.7 && y < 2.5;
      const foot = dEll(x, y, 1.2, 4.5, 7.2, 3.1) < 1;
      if (!cuff && !foot) return null;
      if (y > 6.4) return ['=', C(GRAY, 8)];
      if (cuff && Math.abs(x + 1.7) < 1.3 && Math.abs(fract(y / 2) - .5) < .2) return ['x', C(WARM, 12)];
      return dLit(.55 - x * .025, BRICK, 6);
    }
    if (id === 'tincan') {
      if (Math.abs(x) > 5.4 - Math.max(0, 1 - Math.abs(y)) || Math.abs(y) > 6.7) return null;
      if (Math.abs(y) > 5.8) return ['=', C(GRAY, 12)];
      const word = dText(x, y, 0, -.4, 'BEANS');
      return word ? [word, C(WHITE, 14)] : [Math.abs(y - x * .4 - 2) < .4 ? '/' : '#', C(y < 2.4 ? ORANGE : GRAY, 8 + dCyl(x, 5.4) * 5)];
    }
    if (id === 'seaweed') {
      for (let k = 0; k < 5; k++) if (Math.abs(x - (k - 2) * 2.2 - Math.sin(y * .5 + T * .9 + k) * .8) < .45 && Math.abs(y) < 7.7 - Math.abs(k - 2)) return [k & 1 ? ')' : '(', C(GREEN, 10 + k)];
      return null;
    }
    if (id === 'plasticbag') {
      const d = dEll(x, y, 0, 1.4, 6.5, 6.4);
      if (y < -4.4 && y > -8 && Math.abs(Math.abs(x) - 3) < .6) return ['|', C(WHITE, 12)];
      if (d > 1) return null;
      const word = dText(x, y, 0, 1, 'THANK YOU');
      if (word) return [word, C(RED, 13)];
      return d > .85 ? ['|', C(WHITE, 11)] : Math.abs(x + 3.2) < .3 ? [':', C(WHITE, 8)] : null;
    }
    if (id === 'tyre' || id === 'trolleywheel') {
      const d = dEll(x, y, 0, .2, 6.8, 7.4), hole = dEll(x, y, 0, .2, 3.6, 4.5);
      if (d > 1 || hole < 1 && id === 'tyre') return null;
      if (hole < 1) return Math.abs(x) < .6 || Math.abs(y - .2) < .5 ? ['+', C(GRAY, 13)] : ['.', C(GRAY, 5)];
      return [Math.abs(fract((x + y) * .4) - .5) < .16 ? '/' : '#', C(GRAY, 4 + dBall(x, y, 0, .2, 6.8, 7.4) * 5)];
    }
    if (id === 'trafficcone') {
      if (y > 6 && y < 8 && Math.abs(x) < 7.4) return ['=', C(ORANGE, 10)];
      if (y < -7 || y > 6 || Math.abs(x) > (y + 7) * .45) return null;
      return dLit(.7 - x * .04, y > -3.3 && y < -1 || y > 2.5 && y < 4 ? WHITE : ORANGE, 8);
    }
    if (id === 'flipflop') {
      if (dEll(x, y, 0, .3, 4.8, 7.7) > 1) return null;
      if (Math.abs(y + 1.7 - Math.abs(x) * 1.2) < .5 && y < 2.6) return ['/', C(MAG, 13)];
      return dLit(.75 - x * .04, CYAN, 8);
    }
    return null;
  });
}
for (const id of ['oldboot', 'tincan', 'seaweed', 'plasticbag', 'tyre', 'trafficcone', 'flipflop', 'trolleywheel']) DENSE[id] = heldFishingJunk;
DENSE.soggybook = it => {
  const [art, col] = DENSE.book(it, 1);
  return [art, (ch, r, c) => { const value = col(ch, r, c); return C(value >> 4 === BLUE ? BRICK : value >> 4, Math.min(11, value & 15)); }];
};

function heldPocketknife(it) {
  const phase = heldUsePhase(it), open = phase >= 0 ? Math.sin(phase * Math.PI) : 0;
  const angle = -Math.PI / 2 - (1 - open) * Math.PI, ca = Math.cos(angle), sa = Math.sin(angle);
  return sculpt(32, 25, (x, y) => {
    // Upright handle in the fist, hinge above it. The blade folds into the handle and opens upward.
    if (Math.abs(x) < 1.6 && y > -2.5 && y < 9) {
      if (Math.hypot(x, y + 1.3) < .75 || Math.hypot(x, y - 6.5) < .45) return ['o', C(YEL, 14)];
      return dLit(.8 - x * .15, RED, 8);
    }
    const dy = y + 2, along = x * ca + dy * sa, across = -x * sa + dy * ca;
    if (along > .5 && along < 8.6 && Math.abs(across) < .9 * (1 - along / 9))
      return [Math.abs(across) > .4 ? '/' : '#', C(GRAY, across > 0 ? 15 : 11)];
    return null;
  });
}
function heldTreasure(it) {
  const id = it.id, phase = heldUsePhase(it), glint = Math.sin(T * 2.3) > .94;
  if (id === 'pocketknife') return heldPocketknife(it);
  return sculpt(28, 19, (x, y) => {
    if (id === 'bottlemsg') {
      const half = y < -4.4 ? 1.4 : y < -1.8 ? 1.4 + (y + 4.4) : 4.2;
      if (y < -8 || y > 8 || Math.abs(x) > half) return null;
      if (y < -6.8) return dLit(.6, BRICK, 8);
      if (Math.abs(x) > half - .4 || y > 7.2) return ['|', C(GREEN, 13)];
      if (y > -.5 && y < 5 && Math.abs(x) < 2.8) return [Math.abs(fract(y * .6) - .5) < .12 ? '~' : '#', C(WARM, 13)];
      return Math.abs(x + half * .5) < .3 ? [':', C(WHITE, 10)] : null;
    }
    if (id === 'pearl') {
      const b = dSphere(x, y, 5.2);
      if (b < 0) return null;
      return [glint && x < -1.5 && y < -1.5 ? '*' : dFill(b), C(b > .8 ? WHITE : WARM, 9 + b * 6)];
    }
    if (id === 'goldring') {
      const d = dEll(x, y, 0, 1.4, 5.7, 5.4), hole = dEll(x, y, 0, 1.4, 4.3, 4);
      if (dEll(x, y, 0, -4, 1.7, 1.5) < 1) return [glint ? '*' : '#', C(CYAN, 15)];
      return d < 1 && hole > 1 ? dLit(.65 - x * .045, YEL, 9) : null;
    }
    if (id === 'divewatch') {
      if (Math.abs(x) < 3.7 && Math.abs(y) < 8) {
        if (Math.abs(y) > 4.3) return [Math.floor(y) & 1 ? '=' : '#', C(GRAY, 9)];
        if (Math.abs(x) > 3 || Math.abs(y) > 3.5) return dLit(.7, GRAY, 10);
        const time = String(Math.floor(tod)).padStart(2, '0') + ':' + String(Math.floor(fract(tod) * 60)).padStart(2, '0');
        const text = dText(x, y, 0, .2, time);
        return text ? [text, C(CYAN, 15)] : ['.', C(GRAY, 3)];
      }
      return null;
    }
    if (id === 'wishcoins') {
      for (const [cx, cy] of [[-3, -2], [2, -3], [-4, 2], [1, 2], [4, 5]]) {
        if (dEll(x, y, cx, cy, 2.3, 2) < 1) return [glint ? '*' : 'o', C(YEL, 13)];
      }
      return null;
    }
    const d = Math.hypot(x, y) / 6.2;
    if (d > 1) return null;
    if (d > .82) return dLit(.6 - x * .035, id === 'compass' ? YEL : GRAY, 9);
    if (id === 'compass') {
      for (const [cx, cy, word] of [[0, -4.1, 'N'], [4.1, .2, 'E'], [0, 4.2, 'S'], [-4.1, .2, 'W']]) {
        const text = dText(x, y, cx, cy, word); if (text) return [text, C(WHITE, 14)];
      }
      const angle = -a + (phase >= 0 ? Math.sin(phase * 10) * .15 * (1 - phase) : 0);
      const along = x * Math.sin(angle) - y * Math.cos(angle), across = x * Math.cos(angle) + y * Math.sin(angle);
      if (Math.abs(across) < .5 && Math.abs(along) < 3.7) return ['|', C(along > 0 ? RED : WHITE, 14)];
      return ['.', C(GRAY, 3)];
    }
    const stamp = dText(x, y, 0, -1.2, 'KING') || dText(x, y, 0, 2, '1908');
    return stamp ? [stamp, C(WHITE, 14)] : dLit(.7 - x * .035, GRAY, 8);
  });
}
for (const id of ['bottlemsg', 'oldcoin', 'goldring', 'pearl', 'compass', 'divewatch', 'pocketknife', 'wishcoins']) DENSE[id] = heldTreasure;

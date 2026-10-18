// ===== car damage you can see and feel (the rules are in damage.js): smoke out of the bonnet, grey and then black;
// the bang when a burning car goes up (it hurts whoever's in it or near it, and throws you clear); the driver of a
// burning car in the traffic getting out and away; the dashboard's warning lights; and the respray at an AUTO REPAIR.
let carSmokeT = 0;
function stepCarDamage(dt) {
  for (const c of stepCarFires(dt)) carBang(c);
  for (const c of cars) if (c.bail && !c.ejected) { c.ejected = true; ejectDriver(c); } // (the driver, out and running)
  if (me && burning(me) && !me.warnedFire) { me.warnedFire = true; say('Flames out of the bonnet. Get out, now!', 4); }
  if (me && !burning(me)) me.warnedFire = false;
  if ((carSmokeT -= dt) > 0) return;
  carSmokeT = 0.1;
  for (const c of cars) { // smoke from the ones that are smoking, near enough to see
    const smoking = c.dmg >= DMG_SMOKE || c.wrecked && T - (c.boomT || 0) < 30;
    if (!smoking || Math.hypot(rel(c.x - px), rel(c.y - py)) > 14) continue;
    const [hl, , top] = VEHICLES[c.kind], ax = Math.cos(carYaw(c)), ay = Math.sin(carYaw(c)), at = c.wrecked ? 0 : hl * 0.6, black = c.dmg >= DMG_BAD || c.wrecked || burning(c);
    haze.push({ at: '', kind: black ? 'soot' : 'engine', s: 0.1, x: c.x + ax * at + (Math.random() - 0.5) * 0.04, y: c.y + ay * at + (Math.random() - 0.5) * 0.04, z: top,
      r: 0.045, rMax: black ? 0.22 : 0.2, vx: 0, vy: 0, vz: black ? 0.16 : 0.12, life: 1, fade: black ? 1 / 3 : 1 / 3, seed: Math.random() * 100 });
  }
  while (haze.length > 140) haze.shift();
}
// up it goes: a ball of black smoke, a boom, and anyone in it or beside it hurt
function carBang(c) {
  for (let k = 0; k < 10; k++) haze.push({ at: '', kind: 'soot', s: 0.1, x: c.x + (Math.random() - 0.5) * 0.3, y: c.y + (Math.random() - 0.5) * 0.3, z: 0.05 + Math.random() * 0.1,
    r: 0.1, rMax: 0.35, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, vz: 0.3, life: 1, fade: 1 / 5, seed: Math.random() * 100 });
  const d = Math.hypot(rel(c.x - px), rel(c.y - py));
  if (actx && d < 30) { playClip('crash', clamp(1 - d / 30, 0.2, 1)); tone(actx.currentTime, 40, 0.9, 0.12 * clamp(1 - d / 30, 0, 1), 'sawtooth'); }
  if (c === me && mode === 'drive') { leaveCar(); hurt(35); return say('It goes up with you half out of the door. You hit the tarmac, singed.', 5); }
  if (onFootMode() && mode === 'walk' && d < 0.6) { hurt(25 * (1 - d / 0.6)); say('The blast knocks you flat.', 3); }
  if (c.owned) say(`Your ${ITEMS[c.model].name} is a burnt-out shell. The garage will tow it and fix it up (the key fob, ${fmt$(TOW_FEE)}).`, 6);
}
// at the wheel: the warning lights, and in the driver's seat the fire coming up over the bonnet
function damageDash() {
  const c = me;
  if (!c || !c.dmg) return;
  const fire = burning(c), bad = c.dmg >= DMG_BAD, blink = fract(T * 2) < 0.5;
  const label = fire ? 'FIRE! GET OUT' : c.dmg >= DMG_SMOKE ? 'ENGINE' : 'DAMAGE';
  if (c.dmg >= DMG_DENTS) dashText(rows - 2, cols - label.length - 3, label, C(fire || bad ? RED : YEL, fire || bad ? (blink ? 15 : 7) : 13));
  if (fire && !chaseOn) for (let x = 0; x < cols; x++) { // flames over the hood, flickering
    const h = Math.floor((0.5 + 0.5 * Math.sin(x * 0.7 + T * 11)) * (1 + Math.sin(x * 0.23 - T * 3)) * 2), mid = Math.abs(x - cols / 2) < cols * 0.3;
    if (!mid) continue;
    for (let r = rows - 5; r > rows - 5 - h; r--) { const i = r * cols + x; set(i, r === rows - 5 ? 'W' : '^', C(r === rows - 5 ? ORANGE : YEL, 15)); BG[i] = C(ORANGE, 6 + h); FOGS[i] = FOGB[i] = 0; }
  }
}
// ---- the respray
function sprayPrompt() {
  if (mode !== 'drive' || !me || Math.abs(me.v) > 0.3 || !sprayShopAt(me.x, me.y)) return '';
  const why = sprayRefusal(me);
  return why === 'seen' ? '"Not with the cops watching!" The shutter stays down.' : why === 'wreck' ? '' : `AUTO REPAIR   E: respray and fix it up (${fmt$(SPRAY_FEE)})`;
}
function startRespray() {
  const why = sprayRefusal(me);
  if (why === 'seen') return say('"Not with the cops watching!" The shutter stays down.', 3);
  if (why === 'money') return say(`"A respray's ${fmt$(SPRAY_FEE)}." You can't cover it.`, 3);
  if (why) return;
  pay(SPRAY_FEE); me.v = 0;
  sleep = { t: 0, spray: true };
  say('The shutter rolls up and you drive in.', 2);
}
function stepSpray(dt) { // (stepSleep hands it over: ten minutes in a fade)
  sleep.t += dt;
  fade = sleep.t < 1 ? sleep.t : sleep.t < 2 ? 1 : clamp(1 - (sleep.t - 2) / 1.2, 0, 1);
  if (sleep.t >= 1 && !sleep.done) { sleep.done = true; sleep.lost = applyRespray(me); if ((tod += 1 / 6) >= 24) { tod -= 24; dayNum++; } }
  if (sleep.t > 2 && !sleep.said) { sleep.said = true; say(`Ten minutes later the shutter rolls up: new paint, the dents knocked out.${sleep.lost ? ' Nobody\'s looking for this car now.' : ''}`, 5); }
  if (sleep.t > 3.2) { sleep = null; fade = 0; }
}

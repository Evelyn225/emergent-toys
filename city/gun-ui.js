// ===== the revolver on screen and in your ears (gun.js has the rules): the gun in your hand, turning its cylinder,
// kicking up when it goes off, swung open to reload; the crosshair; the shot (the flash, the street lit up for an
// instant, a streak to where it went, the bang and the buildings throwing it back); the blood, the sheet the
// paramedics put over somebody; the police shooting back; and the screaming.

// The same actor objects drive drawing, hit tests, death and interaction checks.
function gunSceneFigures(includeDead=false){
  const out=[],add=(who,x=who.x,y=who.y,z=outdoorGroundHeight(x,y),h=.175)=>{if((includeDead||!who.dead)&&!who.hidden)out.push({who,x,y,z,h});};
  for(const p of fairFolk)add(p);
  for(const p of extras)if(p.person!=null&&(!p.when||p.when()))add(p,p.x,p.y,p.z||0);
  for(const p of vendors)add(p,p.x+(p.ox||0),p.y+(p.oy||0));
  for(const p of ANGLERS)add(p);
  if(supplierVisit)add(supplierVisit);
  if(drugBuyer)add(drugBuyer);
  for(const target of [clubFigureTarget(),...courierFigureTargets(),...gardenFigureTargets(),...gasFigureTargets()])if((includeDead||!target.who.dead)&&!target.who.hidden)out.push(target);
  if(typeof streetSceneTargets==='function')out.push(...streetSceneTargets().filter(p=>(includeDead||!p.who.dead)&&!p.who.hidden));
  if(typeof coastFigureTargets==='function')out.push(...coastFigureTargets().filter(p=>includeDead||!p.who.dead));
  return out;
}

function sceneFigureTarget(who,x,y,z,h=.175,extra={}) {
  if(!who.dead)who.sceneAt={x,y,z,h};
  return {who,...(who.sceneAt||{x,y,z,h}),...extra};
}
function drawSceneFigure(p,look,pose='stand',hx=0,hy=0,opts) {
  const o=p.who;if(o.hidden)return;
  drawFigure(...R(p.x,p.y),p.z,p.h,o.dead?-o.down.fx:hx,o.dead?-o.down.fy:hy,look,o.dead?'dead':pose,opts);
}

// Indoor rays use room metres and stop at real walls, counters and furniture.
function traceRoomShot(x,y,z,hx,hy,slope) {
  let end=SHOT_RANGE*10,what='air';
  for(let d=.025;d<end;d+=.025){
    const xx=x+hx*d,yy=y+hy*d,zz=z+slope*d;
    if(zz<=0){end=d;what='ground';break;}
    if(xx<0||yy<0||xx>=room.W||yy>=room.H||zz>= (room.def.height||3) || ROOMW.cell(Math.floor(xx),Math.floor(yy))>zz){end=d;what='wall';break;}
  }
  for(const p of room.props)if(p.box&&!p.shotPermeable){
    const hit=rayBox(x,y,z,hx,hy,slope,p.box);if(hit>0&&hit<end){end=hit;what='wall';}
  }
  let who=null;
  for(const p of [...room.props,...roomCops]){
    const cop=roomCops.includes(p);
    if((!cop&&(!p.fig||p.fig.build||p.still||p.cutout))||p.dead||p.hidden)continue;
    const h=p.h||1.8,ox=p.x-x,oy=p.y-y,d=ox*hx+oy*hy,across=Math.abs(oy*hx-ox*hy),zz=z+slope*d-(p.z||0);
    const seated=typeof p.pose==='string'&&p.pose.startsWith('sit'),height=seated?Math.min(h,(p.seatZ??.45)+1.15):h;
    if(d>0&&d<end&&across<h*.18&&zz>=0&&zz<=height){end=d;what=cop?'cop':'person';who=p;}
  }
  return {d:end,x:x+hx*end,y:y+hy*end,z:Math.max(0,z+slope*end),what,who};
}
const bloodRoomKey=()=>placeKey()+((room?.lobby?.cell||room?.lobby?.ret)?':'+(room.lobby.cell||room.lobby.ret).slice(0,2).join(','):'');
function killRoomFigure(p,hx,hy){
  pools.push({x:p.x,y:p.y,t:T,at:bloodRoomKey(),scale:10,z:0});if(pools.length>48)pools.shift();
  p.dead=true;p.looted=false;p.down={t:.2,dur:Infinity,fx:hx,fy:hy};p.z=0;p._moving=false;p.sees=false;delete p.fireT;delete p.aimT;
  const k=room.def.keeper;if(k&&Math.hypot(p.x-k[0],p.y-k[1])<.6)room.keeperDead=true;
}

// ---- where a round ends up: the sound of it striking, heard from there (a clank off a car, a chip off a wall, a thud
// into the ground), and in a building's wall a hole that stays. (A hole sits on the face the shot crossed into)
const bulletHoles = []; // { x, y, z, nx, ny }: out of doors, the oldest go first
function shotImpact(r, indoors, slope) {
  if (r.what === 'air' || r.what === 'person' || r.what === 'cop') return;
  if (actx) {
    const p = indoors ? soundDistanceProfile((r.x - px) / 10, (r.y - py) / 10, (r.z - eye) / 10, a, 8, 0.6, false) : worldSoundProfile(r.x, r.y, r.z, 40, 3);
    const at = actx.currentTime + p.delay, g = p.gain, hi = f => filt('lowpass', Math.min(f, p.cutoff));
    if (r.what === 'car') { tone(at, 820 + Math.random() * 200, 0.18, 0.07 * g, 'triangle', p.pan); tone(at, 1340, 0.1, 0.03 * g, 'square', p.pan); burst(at, 0.05, [filt('bandpass', 3000, 3), hi(8000)], 0.12 * g, p.pan); }
    else if (r.what === 'wall') { burst(at, 0.04, [filt('bandpass', 2200, 1.2), hi(8000)], 0.14 * g, p.pan); burst(at + 0.01, 0.12, [hi(500)], 0.08 * g, p.pan); }
    else burst(at, 0.08, [hi(900)], 0.14 * g, p.pan);
  }
  if (indoors || r.what !== 'wall') return;
  const hx = Math.cos(a), hy = Math.sin(a), cx = Math.floor(r.x), cy = Math.floor(r.y);
  if (!(map[idx(cx, cy)] > r.z)) return; // (a building's wall, not a roof or a rock)
  const xFace = Math.floor(r.x - hx * 0.03) !== cx, yFace = Math.floor(r.y - hy * 0.03) !== cy; // (back out past the trace's 0.02 step)
  if (xFace === yFace) return; // (a corner, or it came down onto it)
  const t = xFace ? ((hx > 0 ? cx : cx + 1) - r.x) / hx : ((hy > 0 ? cy : cy + 1) - r.y) / hy;
  const nx = xFace ? -Math.sign(hx) : 0, ny = xFace ? 0 : -Math.sign(hy);
  bulletHoles.push({ x: worldCoord(r.x + hx * t + nx * 0.001), y: worldCoord(r.y + hy * t + ny * 0.001), z: r.z + slope * t, nx, ny });
  if (bulletHoles.length > 60) bulletHoles.shift();
}
function drawBulletHoles() {
  for (const h of bulletHoles) {
    const vx = rel(h.x - px), vy = rel(h.y - py);
    if (vx * h.nx + vy * h.ny >= 0) continue; // (from round the back of the wall)
    const p = fishProj(vx, vy, h.z);
    if (p && p.depth < Math.min(vis, 6)) fishPut(p.c, p.r, p.depth, p.depth < 0.6 ? 'o' : '.', C(GRAY, 2.5), C(GRAY, 0.6));
  }
}

// ---- Q and R
function pullTrigger() {
  const indoors = mode === 'room', slope = (hor - (rows >> 1)) / projY; // (the crosshair's on the middle row)
  const r = fireGun(px, py, eye, a, slope, indoors);
  if (!r) return;
  if (r.empty) { if (actx) dryFire(actx.currentTime); return say('*click* It\'s empty. R to reload.', 1.5); }
  if (actx) { gunBang(actx.currentTime, 1, 0, indoors ? 'in' : ''); screams(px, py); }
  shotImpact(r, indoors, slope);
  if (r.what === 'person' || r.what === 'cop') say(pick(r.what === 'cop' ? ['The officer drops. Somebody on the radio is asking for them.', 'The officer goes down and stays down.']
    : ['They go down and don\'t get up.', 'They drop where they stood.', 'They fall. Nobody near them moves to help.']), 2.5);
  else if (r.what === 'car') say(pick(['The round punches through a door panel.', '*PANG* off the car.']), 1.5);
  else if (heldGun().uses === 0) say(ammoLeft() ? 'That\'s six. R to reload.' : 'That\'s six, and no more rounds.', 2);
}
function reloadKey() {
  const r = reloadGun();
  if (!r) return;
  if (r[0]) say(r[0], 2);
  if (actx && r[1] === 'reload') reloadSound(actx.currentTime);
  else if (actx && r[1]) sfxUse(r[1]);
}
// shot by the police till you dropped: the hospital, and they've kept the gun
function shotDown() {
  confiscateGun();
  passOut('Gunshot wounds. You\'re lucky. The police have your revolver, and would like to talk when you\'re up.');
}

// ---- the gun in your hand: side-on, muzzle toward the crosshair, the fist round the grip. Drawn in characters and
// turned on the canvas as a piece: up with the kick of a shot, right up to reload with the cylinder swung out
const REVOLVER = [
  '                                     _',
  ' _                                  / )',
  '[_]__________________________ _____/ /__',
  '|____________________________|=====|::::\\',
  ' `---------------------------|-----|:::::\\',
  '       `===================\'  |=====|::o::|',
  '                          \\  |-----|:::::\\',
  '                           \\_|_____|::::::\\',
  '                              \\ ( \\ \\#######\\',
  '                               `--`--\'#######\\',
  '                                      \\#######\\',
  '                                       \\#######\\',
  '                                        |#######|',
  '                                        \\_______/'];
const GUN_GRIP = [43, 9]; // (the column and row your fist closes round)
const CYL_FACE = [' .---. ', '/ o o \\', '| o+o |', '\\ o o /', " `---' "]; // swung out: the chambers, filling as you load
const gunView = { spin: 0, t: 0 }; // the cylinder's turn as drawn, easing after gun.spin
function gunGeom() {
  const aim = gunAim();
  const u = Math.max(10, Math.min(Math.max(14, cv.height / 36), cv.width / 45));
  const hsz = Math.round(u * 1.15), s = Math.round(u * (0.7 + aim * 0.04));
  const k = gun.kick, rl = gun.reload > 0 ? Math.min(1, (RELOAD_T - gun.reload) * 5, gun.reload * 5) : 0;
  const cx = Math.round(cv.width * (0.82 - aim * 0.075) + k * u * 0.6);
  const hy = Math.round(cv.height - 5.6 * hsz + k * u * 0.5 + rl * u * 0.6 - aim * u * 1.5);
  return { u, s, hsz, cx, hy, ang: 0.05 + k * 0.32 + rl * 0.85 - aim * 0.06 };
}
// the picture as it is this instant: the cylinder's flutes moved round, the hammer back or down, the cylinder out
function revolverArt(open, rounds) {
  const art = REVOLVER.map(l => [...l]), turn = Math.floor(gunView.spin * 2);
  for (let r = 3; r <= 6; r++) for (let c = 30; c <= 34; c++) art[r][c] = open ? ' ' : (r + turn) & 1 ? '-' : '=';
  if (gun.kick > 0.45) { // fired: the hammer's down on the frame
    for (const [r, c] of [[0, 37], [1, 36], [1, 37], [1, 38], [2, 37]]) art[r][c] = ' ';
    art[2][36] = '_'; art[2][37] = ')';
  }
  if (open) { // swung out to the side, its face to you: a round in each chamber as it goes in
    let k = 0;
    CYL_FACE.forEach((l, r) => [...l].forEach((ch, c) => { const row = art[8 + r] || (art[8 + r] = []); while (row.length < 22 + c) row.push(' '); row[21 + c] = ch === 'o' ? (k++ < rounds ? '@' : 'o') : ch; }));
  }
  return art.map(r => r.join(''));
}
function revolverCol(ch, r, c) {
  if (ch === '@') return C(YEL, 14); // (brass)
  if (r >= 8 && c >= 20 && c < 30) return C(GRAY, ch === 'o' ? 4 : 11); // (the cylinder, swung out: an empty chamber's dark)
  if (r >= 8 && c >= 37 || r >= 10) return ch === '#' ? C((r + c) & 1 ? BRICK : WARM, 9 + ((r * 3 + c) % 4)) : C(BRICK, 10); // the walnut grip, chequered
  if (ch === '=' && r >= 3 && r <= 6 && c >= 30 && c <= 34) return C(CYAN, 13); // the cylinder catching the light
  if (ch === ':') return C(GRAY, 7);
  if (ch === 'o') return C(YEL, 11);
  if (r <= 2 || ch === '[' || ch === ']') return C(WHITE, 14); // the top edge, in the light
  return C(GRAY, 11 - (r > 4 ? 2 : 0));
}
function drawRevolver(it) {
  const G = gunGeom(), dt = clamp(T - gunView.t, 0, 0.05); gunView.t = T;
  gunView.spin += (gun.spin - gunView.spin) * Math.min(1, dt * 14); // (a sixth of a turn a shot, snapping round)
  const open = gun.reload > 0, rounds = open ? Math.min(CYLINDER, it.uses + ammoLeft(), it.uses + Math.floor((1 - gun.reload / RELOAD_T) * 7)) : it.uses;
  g.font = G.s + 'px monospace';
  const w = g.measureText('M').width, gx = -(GUN_GRIP[0] + 0.5) * w, gy = -GUN_GRIP[1] * G.s;
  g.save();
  g.translate(G.cx, G.hy + 0.2 * G.hsz); g.rotate(G.ang);
  drawBehindHand(0, -G.hsz * .2, G.hsz, () => {
    artText(revolverArt(open, rounds), gx, gy, G.s, revolverCol);
    if (open) { // the other hand steadies the swung-out cylinder as the rounds go in
      artText(['   __', ' _/ /', '( _/ ', ' \\__'], gx + w * 18, gy + G.s * 11, G.s,
        () => C(SKIN, 12));
    }
    if (gun.kick > 0.55) { // the flash, off the end of the barrel
      const big = Math.round(G.u * (0.8 + gun.kick * 0.5)), k = gun.kick;
      g.font = big + 'px monospace';
      const fw = g.measureText('M').width;
      artText(k > 0.8 ? ['\\|/', '-*-', '/|\\'] : [' . ', '-#-', " ' "], gx - fw * 3.2, gy + 3.5 * G.s - big * 1.5, big, ch => ch === '*' || ch === '#' ? C(WHITE, 15) : ch === '-' ? C(YEL, 15) : C(ORANGE, 14));
    }
  });
  g.restore();
  g.font = FS + 'px monospace';
}

// ---- the crosshair, the cylinder count, the flash lighting everything for an instant, and being hit
function drawGunHud() {
  const it = heldGun();
  if (it && handheldMode() && !game) {
    const x = cols / 2 * cw, y = (rows >> 1) * FS, moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD;
    const spread = cw * (1.2 - gunAim() * 0.45 + gun.kick * 2.5 + (moving ? 0.6 : 0));
    const on = mode !== 'room' && aimingAt(); // (red when somebody's in it)
    g.font = FS + 'px monospace'; g.lineJoin = 'round'; g.lineWidth = Math.max(2, FS * 0.16); g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.fillStyle = on ? '#f44' : 'rgba(255,255,255,0.92)';
    for (const [ch, ox, oy] of [['-', -spread - cw * 0.5, -FS * 0.5], ['-', spread - cw * 0.5, -FS * 0.5], ['|', -cw * 0.5, -FS * 0.5 - spread * 0.8], ['|', -cw * 0.5, -FS * 0.5 + spread * 0.8], ['.', -cw * 0.5, -FS * 0.75]]) {
      g.strokeText(ch, x + ox, y + oy); g.fillText(ch, x + ox, y + oy);
    }
    // the cylinder: a round for each, under the crosshair to the right, and what's left in the boxes
    const loaded = 'o'.repeat(it.uses) + '.'.repeat(CYLINDER - it.uses);
    const txt = gun.reload > 0 ? 'reloading' : `${loaded}  ${ammoLeft()}`;
    g.fillStyle = it.uses ? 'rgba(255,220,120,0.9)' : '#f66';
    g.strokeText(txt, x + cw * 3, y + FS * 1.6); g.fillText(txt, x + cw * 3, y + FS * 1.6);
  }
  const flash = Math.max(0, 1 - (T - gun.lastShotT) / 0.07);
  if (flash > 0) { // the street lit up for an instant
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(cv.width * 0.6, cv.height * 0.7, 0, cv.width * 0.6, cv.height * 0.7, cv.width * 0.7);
    gr.addColorStop(0, `rgba(255,190,90,${0.35 * flash})`); gr.addColorStop(1, `rgba(255,150,60,${0.08 * flash})`);
    g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); g.restore();
  }
  const hurt_ = Math.max(0, 1 - (T - gun.hurtT) / 0.6);
  if (hurt_ > 0) { // hit: the edges go red
    const gr = g.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.25, cv.width / 2, cv.height / 2, cv.width * 0.7);
    gr.addColorStop(0, 'rgba(160,0,0,0)'); gr.addColorStop(1, `rgba(170,0,0,${0.55 * hurt_})`);
    g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
  }
}
// is somebody in the crosshair? (a cheap look, a few times a second)
let aimLook = { t: -1, on: false };
function aimingAt() {
  if (T - aimLook.t < 0.1) return aimLook.on;
  const r = traceShot(px, py, eye, Math.cos(a), Math.sin(a), (hor - (rows >> 1)) / projY);
  aimLook = { t: T, on: r.what === 'person' || r.what === 'cop' };
  return aimLook.on;
}
// a flash's light on the ground round it (city-render.js): yours, and the police's
function muzzleGlow(wx, wy) {
  let k = 0;
  const lit = (x, y, t, R) => { const age = T - t; if (age > 0.08) return; const d = Math.hypot(rel(wx - x), rel(wy - y)); if (d < R) k = Math.max(k, (1 - d / R) ** 1.6 * (1 - age / 0.08)); };
  for (const s of gun.shots) if (!s.indoors) lit(s.x0, s.y0, s.t, 1.4);
  for (const s of gun.copShots) if (!s.room) lit(s.x, s.y, s.t, 1);
  return k * clamp(0.35 + night, 0, 1);
}
const gunLit = () => T - gun.lastShotT < 0.08 || gun.copShots.some(s => T - s.t < 0.08);

// ---- out in the world: the streak of a shot, the police's flashes, the blood
function drawShots() {
  if (mode === 'room') return;
  for (const s of gun.shots) { // yours: from just under your eye, off to the right where the gun is, to wherever it stopped
    const age = T - s.t;
    if (age > 0.09 || s.indoors) continue;
    const ox = rel(s.x0 - px) + Math.cos(a + 0.6) * 0.02, oy = rel(s.y0 - py) + Math.sin(a + 0.6) * 0.02;
    const p0 = fishProj(ox + Math.cos(a) * 0.08, oy + Math.sin(a) * 0.08, s.z0 - 0.02), p1 = fishProj(rel(s.x - px), rel(s.y - py), s.z);
    if (p0 && p1) fishSeg(p0, p1, C(age < 0.04 ? WHITE : YEL, 15));
    if (p1 && (s.what === 'wall' || s.what === 'ground' || s.what === 'car')) fishPut(p1.c, p1.r, p1.depth, '*', C(s.what === 'car' ? YEL : WHITE, 14)); // (sparks, or a puff of grit)
  }
  for (const s of gun.copShots) { // theirs: a flash at the officer's outstretched hands, and a streak coming at you
    if (T - s.t > 0.09 || s.room) continue;
    const [vx, vy] = R(s.x, s.y), d = Math.hypot(vx, vy) || 1, hx = vx - vx / d * 0.03, hy = vy - vy / d * 0.03; // (a step toward you from them: the muzzle)
    drawArt(hx, hy, 0.11, 0.07, 0.07, ['\\|/', '-@-', '/|\\'], ch => ch === '@' ? C(WHITE, 15) : C(T - s.t < 0.04 ? YEL : ORANGE, 15));
    if (T - s.t < 0.06) { // passing you on one side (a miss) or straight at you (a hit), ending just short of your eyes
      const k = 0.12 / d, mx = vx * k - vy / d * (s.hit ? 0 : 0.05 * s.side), my = vy * k + vx / d * (s.hit ? 0 : 0.05 * s.side);
      const p0 = fishProj(hx, hy, 0.13), p1 = fishProj(mx, my, eye - 0.02);
      if (p0 && p1) fishSeg(p0, p1, C(YEL, 14));
    }
  }
}
// pools of blood: spreading over the first few seconds from under them, an uneven edge that soaks into the ground in
// spatters, a wet sheen in the middle while it's fresh, going dark brown as it dries
function drawBlood() {
  for (const b of pools) {
    if((b.at??'')!==(mode==='room'?bloodRoomKey():''))continue;
    const scale=b.scale||1,ground=b.z??(mode==='room'?0:walkGround(b.x,b.y));
    const vx = rel(b.x - px), vy = rel(b.y - py);
    if (Math.hypot(vx, vy) > Math.min(vis, 14)) continue;
    const age = T - b.t, r = scale*(0.025 + 0.085 * (1 - Math.exp(-age / 3.5))), dry = clamp((age - 50) / 130, 0, 1), seed = b.x * 13 + b.y * 7;
    drawBox(boxAt(vx, vy, 1, 0, r * 1.35, r * 1.35, ground+.0001, ground+0.0004*scale), (i, t, L) => {
      const an = Math.atan2(HIT.v, HIT.u), q = Math.hypot(HIT.u, HIT.v);
      const edge = r * (0.78 + 0.14 * Math.sin(an * 3 + seed) + 0.08 * Math.sin(an * 7 + seed * 1.7) + 0.05 * Math.sin(an * 13 + seed * 0.3)), k = q / edge;
      if (k > 1.25 || k > 1 && hash(Math.floor(HIT.u * 300), Math.floor(HIT.v * 300), 4411) > 0.35) { BG[i] = BG_UNSET; return false; }
      const col = dry > 0.5 ? BRICK : RED, lv = Math.max(0.6, L * 0.1);
      if (k > 0.85) { BG[i] = BG_UNSET; return set(i, k > 1 ? '.' : ',', C(col, (5 - dry * 2) * lv)), true; } // (the soaked-in edge, and the spatters past it)
      BG[i] = C(col, (2.6 - k * 0.8 - dry * 1.1) * lv);
      const glint = dry < 0.4 && k < 0.5 && hash(Math.floor(HIT.u * 160), Math.floor(HIT.v * 160), 4412) > 0.9; // (wet: it catches the light)
      return set(i, glint ? '~' : ' ', C(RED, 9 * lv)), true;
    });
  }
}
// what the people round a body look like: the paramedics' white sheet over it, once they've got there
function drawSheet(o, vx, vy) {
  const fx_ = o.down.fx, fy_ = o.down.fy;
  drawBox(boxAt(vx + fx_ * 0.02, vy + fy_ * 0.02, fx_, fy_, 0.1, 0.04, 0, 0.025), (i, t, L) => {
    BG[i] = C(WHITE, 4 + L * 0.6); return set(i, HIT.face === 5 ? (fract(HIT.u * 9 + HIT.v * 4) < 0.25 ? '~' : ' ') : '_', C(GRAY, 9 + L * 0.3)), true; // (folds in it, over the shape of them)
  });
}

// ---- the sound: every frame, the police's shots you haven't heard yet, and what happens when one hits you
function stepGunUI() {
  for (const s of gun.copShots) {
    if (s.heard) continue;
    s.heard = true;
    const d = s.room ? Math.hypot(s.x - px, s.y - py) / 10 : near(s.x, s.y, px, py), side = s.room ? 0 : Math.sin(Math.atan2(rel(s.y - py), rel(s.x - px)) - a);
    if (actx) gunBang(actx.currentTime, clamp(1.1 - d / 9, 0.2, 0.9), clamp(side, -0.8, 0.8), s.room ? 'in' : d > 3 ? 'far' : '');
    if (s.hit) { if (actx) tone(actx.currentTime + 0.02, 70, 0.2, 0.25); say(pick(['You\'re hit!', 'Something punches you in the side. You\'re hit.', 'Hit! It burns.']) + (needs.health < 35 ? ' You can\'t take much more of this.' : ''), 2); }
    else if (actx && d < 5) whizz(actx.currentTime + 0.05, clamp(side, -0.8, 0.8)); // (it went past you)
  }
}
// noise through a filter: a sharp start and a falling tail
function gunNoise(at, len, type, freq, q, gain, pan = 0) {
  const s = actx.createBufferSource(), fl = actx.createBiquadFilter(), g_ = actx.createGain(), p = actx.createStereoPanner();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.value = freq; fl.Q.value = q; p.pan.value = pan;
  g_.gain.setValueAtTime(0, at); g_.gain.linearRampToValueAtTime(gain, at + 0.002); g_.gain.exponentialRampToValueAtTime(0.0005, at + len);
  shot(s, fl, g_, p, sfxBus); s.start(at, Math.random() * 1.5, len + 0.05);
}
// the bang: a crack, the blast, a thump in your chest, and the street throwing it back off every wall a few times
// over, a little later and a little duller each time ('in': a room, short and boxy; 'far': somebody else's, down the street)
function gunBang(at, vol, pan = 0, where = '') {
  if (playGameplayEffect('gunshot', at, vol, pan, where)) return;
  const far = where === 'far';
  if (!far) gunNoise(at, 0.06, 'highpass', 2200, 0.7, 0.5 * vol, pan);
  gunNoise(at, far ? 0.3 : 0.4, 'lowpass', far ? 1100 : 3200, 0.8, 0.9 * vol, pan);
  const o = actx.createOscillator(), g_ = actx.createGain(), p = actx.createStereoPanner();
  o.type = 'sine'; o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.25); p.pan.value = pan;
  g_.gain.setValueAtTime(0, at); g_.gain.linearRampToValueAtTime(0.7 * vol, at + 0.004); g_.gain.exponentialRampToValueAtTime(0.0005, at + 0.3);
  shot(o, g_, p, sfxBus); o.start(at); o.stop(at + 0.35);
  const echoes = where === 'in' ? [[0.04, 0.3], [0.09, 0.12]] : [[0.19, 0.3], [0.42, 0.17], [0.78, 0.09], [1.25, 0.05]];
  for (const [d, k] of echoes) gunNoise(at + d, 0.35 + d * 0.5, 'lowpass', 900 - d * 300, 0.7, k * vol, -pan * 0.6);
}
const dryFire = at => { tone(at, 2600, 0.025, 0.09, 'square'); gunNoise(at, 0.03, 'bandpass', 3500, 4, 0.12); };
const whizz = (at, pan) => gunNoise(at, 0.12, 'bandpass', 5000, 6, 0.1, pan);
// thumbing the cylinder out, six rounds in one after another, and snapping it shut
function reloadSound(at) {
  if (playGameplayEffect('reload', at)) return;
  gunNoise(at, 0.05, 'bandpass', 2400, 3, 0.22);
  for (let k = 0; k < 6; k++) gunNoise(at + 0.3 + k * 0.17, 0.035, 'bandpass', 3800 + k * 90, 5, 0.12);
  gunNoise(at + RELOAD_T - 0.12, 0.07, 'bandpass', 1800, 2, 0.3);
}
// somebody screaming: a voice (a buzz through two formants), up, wavering, and down
function scream(at, vol, pan, pitch) {
  const o = actx.createOscillator(), lfo = actx.createOscillator(), lg = actx.createGain(), f1 = actx.createBiquadFilter(), f2 = actx.createBiquadFilter(), g_ = actx.createGain(), p = actx.createStereoPanner(), len = 0.7 + Math.random() * 0.6;
  o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch * 0.8, at); o.frequency.linearRampToValueAtTime(pitch * 1.35, at + 0.15); o.frequency.linearRampToValueAtTime(pitch * 0.9, at + len);
  lfo.frequency.value = 6 + Math.random() * 3; lg.gain.value = pitch * 0.03; lfo.connect(lg); lg.connect(o.frequency);
  f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 3; f2.type = 'peaking'; f2.frequency.value = 2600; f2.gain.value = 9; p.pan.value = pan;
  g_.gain.setValueAtTime(0, at); g_.gain.linearRampToValueAtTime(vol, at + 0.06); g_.gain.setValueAtTime(vol * 0.8, at + len * 0.7); g_.gain.exponentialRampToValueAtTime(0.0005, at + len);
  shot(o, f1, f2, g_, p, sfxBus); o.start(at); o.stop(at + len + 0.05); lfo.start(at); lfo.stop(at + len + 0.05);
}
// the ones who scream as they run: the nearest few
function screams(x, y) {
  const near_ = people.filter(p => p.flee && p.flee.scream && !p.hidden).map(p => [p, Math.hypot(rel(p.x - x), rel(p.y - y))]).sort((p, q) => p[1] - q[1]).slice(0, 3);
  near_.forEach(([p, d], k) => scream(actx.currentTime + 0.25 + k * 0.3 + Math.random() * 0.2, clamp(0.06 - d * 0.006, 0.012, 0.06), clamp(Math.sin(Math.atan2(rel(p.y - py), rel(p.x - px)) - a), -0.8, 0.8), 520 + (p.ph * 97 % 1) * 420));
}

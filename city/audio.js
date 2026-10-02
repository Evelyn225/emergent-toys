// ===== audio: recorded beds and synthesised layers, glided toward audioMix()'s targets every frame, plus one-shots
// (footsteps, sirens, the till, the shop bell, train clatter). Starts on the first key press or click (browsers
// won't play sound before one). N toggles sound.
//
// Recorded beds stream from audio/ascii-city/ through two <audio> elements each that crossfade at the loop point,
// so nothing is decoded whole into memory and the loop never clicks. A bed that has been silent for a few seconds
// pauses where it is and picks up from there when it's needed again.
const AUDIO_DIR = 'audio/ascii-city/';
const BED_FILES = { city: 'city-day.mp3', night: 'night.mp3', crowd: 'crowd.mp3', restaurant: 'restaurant.mp3', bossa: 'bossa.mp3', coffee: 'coffee.mp3',
                    rain: 'rain.mp3', karaoke: 'karaoke.mp3' };
// overall level of each layer at full mix
const LEVEL = { city: 0.5, crowd: 0.35, night: 0.5, restaurant: 0.45, bossa: 0.3, coffee: 0.3, karaoke: 0.35,
                rain: 0.28, board: 0.5, waves: 0.5, wind: 0.3, rumble: 0.7, tunnel: 0.3, engine: 0.4 };
// measured RMS of each synthesised layer at gain 1, scaled to match a recorded bed (~0.07 at -20 LUFS) at gain 1
const CAL = { board: 0.8, waves: 0.57, wind: 0.82, rumble: 0.33, tunnel: 0.64, engine: 0.16 };
const XF = 4, GLIDE = 0.45, MASTER = 0.55; // loop crossfade seconds; time constant of every level change; overall volume
let actx = null, master = null, soundOn = true, noiseBuf = null, musicBus, ambBus, sfxBus; // the three volume settings' buses
const beds = {}, synth = {};

function audioStart() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  const comp = actx.createDynamicsCompressor(); // glues the layers together and stops stacked one-shots clipping
  comp.threshold.value = -18; comp.ratio.value = 3;
  master = actx.createGain(); master.gain.value = soundOn ? MASTER : 0;
  master.connect(comp); comp.connect(actx.destination);
  [musicBus, ambBus, sfxBus] = [0, 1, 2].map(() => { const g = actx.createGain(); g.connect(master); return g; });
  applyVolumes();
  noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
  const n = noiseBuf.getChannelData(0); for (let k = 0; k < n.length; k++) n[k] = Math.random() * 2 - 1;
  for (const k in BED_FILES) beds[k] = makeBed(BED_FILES[k], k === 'bossa' || k === 'coffee' || k === 'karaoke' ? musicBus : ambBus);
  makeSynths();
  onMoney = amount => amount > 0 ? sfxTill() : sfxCoin();
}
// the volume settings: master scales everything, music / ambience / effects their own bus (squared: feels linear)
function applyVolumes() {
  if (!actx) return;
  const now = actx.currentTime;
  musicBus.gain.setTargetAtTime(settings.music ** 2 * 1.5, now, 0.1); ambBus.gain.setTargetAtTime(settings.ambience ** 2 * 1.5, now, 0.1);
  sfxBus.gain.setTargetAtTime(settings.effects ** 2 * 1.5, now, 0.1);
}
function toggleSound() {
  soundOn = !soundOn;
  if (master) master.gain.setTargetAtTime(soundOn ? MASTER : 0, actx.currentTime, 0.15);
  say(soundOn ? 'Sound on' : 'Sound off', 1.5);
}

// ---- recorded beds
function makeBed(file, bus) {
  const out = actx.createGain(); out.gain.value = 0; out.connect(bus);
  const voices = [0, 1].map(() => {
    const el = new Audio(AUDIO_DIR + file); el.preload = 'auto';
    const g = actx.createGain(); g.gain.value = 0;
    actx.createMediaElementSource(el).connect(g); g.connect(out);
    return { el, g };
  });
  // start somewhere random, so the beds never line up
  voices[0].el.addEventListener('loadedmetadata', () => { voices[0].el.currentTime = Math.random() * Math.max(0, voices[0].el.duration - XF * 2); }, { once: true });
  return { out, voices, cur: 0, idle: 99, xf: false };
}
function tickBed(b, target, dt) {
  const now = actx.currentTime, v = b.voices[b.cur], o = b.voices[1 - b.cur];
  b.out.gain.setTargetAtTime(target, now, GLIDE);
  b.idle = target < 0.002 ? b.idle + dt : 0;
  if (b.idle > 4) { v.el.pause(); o.el.pause(); return; } // faded right out: pause, keeping our place
  if (b.idle > 0) return;
  if (v.el.paused) { // (re)starting, from wherever it paused
    if (b.xf) { o.el.pause(); b.xf = false; } // a crossfade cut short by a pause: just carry on with this copy
    v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(1, now);
    v.el.play().catch(() => {});
  }
  const dur = v.el.duration;
  if (!dur) return;
  if (!b.xf && v.el.currentTime > dur - XF) { // near the end: bring the other copy in from the top
    o.el.currentTime = 0; o.el.play().catch(() => {});
    o.g.gain.cancelScheduledValues(now); o.g.gain.setValueAtTime(0, now); o.g.gain.linearRampToValueAtTime(1, now + XF);
    v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(1, now); v.g.gain.linearRampToValueAtTime(0, now + XF);
    b.xf = true;
  } else if (b.xf && (v.el.ended || v.el.currentTime >= dur - 0.05)) { v.el.pause(); b.cur = 1 - b.cur; b.xf = false; }
}

// ---- synthesised layers, all from one looped noise buffer and a few oscillators
function noiseSrc(rate = 1) {
  const s = actx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
  s.start(0, Math.random() * 2); return s;
}
const filt = (type, freq, q = 0.7) => { const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
const chain = (...nodes) => { for (let k = 0; k < nodes.length - 1; k++) nodes[k].connect(nodes[k + 1]); return nodes[nodes.length - 1]; };
function lfo(param, rate, depth) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(param); o.start(); }
function layer() { const g = actx.createGain(); g.gain.value = 0; g.connect(ambBus); return g; }
// a short recorded loop, decoded once and played round and round into `dest` (whose gain the mix drives)
function loopClip(name, dest) {
  fetch(AUDIO_DIR + name + '.mp3').then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).then(buf => {
    const s = actx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start();
  }).catch(() => {}); // (no file, or opened from disk: silent)
}
function makeSynths() {
  // a skateboard: the low roar of wheels on the street
  synth.board = layer(); loopClip('skateboard', synth.board); // wheels on the street: a recorded roll, looped
  // waves: low surf that swells and draws back
  synth.waves = layer(); const swell = actx.createGain(); swell.gain.value = 0.55; lfo(swell.gain, 0.08, 0.45);
  chain(noiseSrc(0.7), filt('lowpass', 550), swell, synth.waves);
  // wind: a bandpassed rush whose pitch wanders
  synth.wind = layer(); const wf = filt('bandpass', 380, 0.6); lfo(wf.frequency, 0.11, 160); chain(noiseSrc(), wf, synth.wind);
  // the el: deep rumble and a hum
  synth.rumble = layer(); chain(noiseSrc(0.5), filt('lowpass', 110), synth.rumble);
  const hum = actx.createOscillator(); hum.frequency.value = 42; const hg = actx.createGain(); hg.gain.value = 0.3; chain(hum, hg, synth.rumble); hum.start();
  // a subway station: tunnel air and fluorescent hum
  synth.tunnel = layer(); chain(noiseSrc(0.6), filt('lowpass', 260), synth.tunnel);
  const fl = actx.createOscillator(); fl.frequency.value = 120; const flg = actx.createGain(); flg.gain.value = 0.08; chain(fl, flg, synth.tunnel); fl.start();
  // a car engine: a growl that rises with speed
  synth.engine = layer(); synth.engineOsc = actx.createOscillator(); synth.engineOsc.type = 'sawtooth'; synth.engineOsc.frequency.value = 45;
  synth.engineLP = filt('lowpass', 380); chain(synth.engineOsc, synth.engineLP, synth.engine); synth.engineOsc.start();
}

// ---- one-shots
// a burst of filtered noise with a fast attack and an exponential tail; optional extra node for colour
function burst(at, len, filters, gain, pan = 0) {
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const g = actx.createGain(), p = actx.createStereoPanner(); p.pan.value = pan;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, at + len);
  chain(s, ...filters, g, p, sfxBus); s.start(at, Math.random() * 1.5, len + 0.05);
}
function tone(at, freq, len, gain, type = 'sine', pan = 0) {
  const o = actx.createOscillator(), g = actx.createGain(), p = actx.createStereoPanner();
  o.type = type; o.frequency.value = freq; p.pan.value = pan;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, at + len);
  chain(o, g, p, sfxBus); o.start(at); o.stop(at + len + 0.05);
}
// footsteps per surface: mostly a soft heel thud with a little scuff on top, nothing bright.
// [scuff filter, freq, Q, tail seconds, level, thud Hz (0 = none)]
const STEP = { stone: ['lowpass', 1000, 0.7, 0.07, 0.6, 72], grass: ['lowpass', 550, 0.5, 0.1, 0.45, 0], wood: ['bandpass', 420, 1.4, 0.09, 0.6, 115],
               metal: ['bandpass', 1300, 2.5, 0.12, 0.4, 90], gravel: ['bandpass', 1500, 0.6, 0.09, 0.5, 0], sand: ['lowpass', 650, 0.5, 0.1, 0.35, 0],
               tile: ['bandpass', 1300, 1, 0.05, 0.5, 95], carpet: ['lowpass', 380, 0.5, 0.06, 0.35, 0] };
let stepSide = 1;
function sfxStep(surface, run) {
  const [type, f, q, tail, lvl, thump] = STEP[surface] || STEP.stone, at = actx.currentTime + Math.random() * 0.01;
  const g = lvl * (run ? 0.11 : 0.075) * (0.8 + Math.random() * 0.4);
  stepSide = -stepSide;
  burst(at, tail, [filt(type, f * (0.85 + Math.random() * 0.3), q), filt('lowpass', 2500)], g * 0.6, stepSide * 0.12);
  if (surface === 'gravel') burst(at + 0.035, tail, [filt(type, f * 0.8, q), filt('lowpass', 2500)], g * 0.35, stepSide * 0.12); // crunch
  if (thump) tone(at, thump * (0.9 + Math.random() * 0.2), 0.07, g * 1.2);
  if (surface === 'metal') tone(at, 600 + Math.random() * 150, 0.1, g * 0.12, 'sine');
}
function sfxTill() { // cha-ching: the drawer, then the bell
  const at = actx.currentTime;
  burst(at, 0.08, [filt('bandpass', 2500, 1)], 0.25);
  tone(at + 0.08, 2093, 0.7, 0.12); tone(at + 0.08, 2637, 0.7, 0.1); tone(at + 0.11, 3136, 0.5, 0.06);
}
function sfxCoin() { const at = actx.currentTime; tone(at, 3100, 0.15, 0.08); tone(at + 0.07, 4150, 0.18, 0.06); }
// short recorded one-shots (eating, drinking): fetched and decoded once, played through the effects bus
const CLIPS = {};
function playClip(name, gain) {
  if (!CLIPS[name]) CLIPS[name] = fetch(AUDIO_DIR + name + '.mp3').then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).catch(() => null);
  CLIPS[name].then(buf => {
    if (!buf) return;
    const s = actx.createBufferSource(), g_ = actx.createGain();
    s.buffer = buf; s.playbackRate.value = 0.93 + Math.random() * 0.14; g_.gain.value = gain; chain(s, g_, sfxBus); s.start();
  });
}
function sfxDoor() { const at = actx.currentTime; tone(at, 1568, 0.5, 0.08); tone(at + 0.12, 1976, 0.6, 0.07); } // a shop bell

// ---- sirens: one voice per emergency vehicle in earshot, with its own pattern, Doppler and panning
const SIREN = { amb: { type: 'square', f: t => 700 + 520 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 3.2)) },
                police: { type: 'sawtooth', f: t => 720 + 650 * fract(t * 2.8) },
                fire: { type: 'square', f: t => 480 + 420 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 4.5)) } };
const sirens = new Map(); // car -> voice
const SIREN_R = 28; // heard out to here (280m), fading to nothing at the edge
function tickSirens(indoors) {
  const now = actx.currentTime, right = [-Math.sin(a), Math.cos(a)];
  for (const c of cars) if (code(c) && !sirens.has(c) && Math.hypot(rel(c.x - px), rel(c.y - py)) < SIREN_R) {
    const o = actx.createOscillator(), lp = filt('lowpass', 2600), g = actx.createGain(), p = actx.createStereoPanner();
    o.type = SIREN[c.kind].type; g.gain.value = 0; chain(o, lp, g, p, sfxBus); o.start();
    sirens.set(c, { o, lp, g, p, t0: Math.random() * 5 });
  }
  for (const [c, v] of sirens) {
    const rx = rel(c.ex - px), ry = rel(c.ey - py), d = Math.hypot(rx, ry) || 0.01;
    if (!cars.includes(c) || !code(c) || d > SIREN_R + 4) { v.g.gain.setTargetAtTime(0, now, 0.3); v.o.stop(now + 1.5); sirens.delete(c); continue; }
    const vr = -(c.hx * rx + c.hy * ry) / d * c.v; // closing speed, cells/s (sound: ~34 cells/s)
    v.o.frequency.setTargetAtTime(SIREN[c.kind].f(T + v.t0) * 34 / (34 - vr), now, 0.02);
    v.g.gain.setTargetAtTime(0.16 * clamp(1 - d / SIREN_R, 0, 1) ** 2 / (1 + (d / 6) ** 1.2) * (indoors ? 0.12 : 1), now, 0.1);
    v.lp.frequency.setTargetAtTime(indoors ? 700 : 2600 / (1 + d / 30), now, 0.2);
    v.p.pan.setTargetAtTime(clamp((rx * right[0] + ry * right[1]) / d, -1, 1) * 0.8, now, 0.1);
  }
}

// ---- thunder: a crack (if it's close) rolling into a long low rumble, arriving d/34 seconds after the flash
function sfxThunder(d, indoors) {
  const at = actx.currentTime + d / 34, near = clamp(1.2 - d / 70, 0.15, 1), s = actx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.3 + near * 0.15; // slowed right down: a low growl
  const lp = filt('lowpass', indoors ? 180 : 220 + near * 900), g = actx.createGain(), k = (indoors ? 0.4 : 1.1) * near;
  lp.frequency.setValueAtTime(lp.frequency.value, at); lp.frequency.exponentialRampToValueAtTime(70, at + 3);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.8 * k, at + (near > 0.7 ? 0.015 : 0.3)); // crack, or a far-off roll
  g.gain.exponentialRampToValueAtTime(0.25 * k, at + 0.7); g.gain.linearRampToValueAtTime(0.35 * k, at + 1.5);
  g.gain.exponentialRampToValueAtTime(0.0005, at + 4 + d / 30);
  chain(s, lp, g, sfxBus); s.start(at, Math.random() * 1.5); s.stop(at + 5 + d / 30);
}
let heardBolt = null;

// ---- per frame
let stepAcc = 0, lastPos = null, clackT = 0;
function audioTick(dt) {
  if (!actx || actx.state !== 'running') return;
  const now = actx.currentTime, indoors = mode === 'room';
  master.gain.setTargetAtTime(soundOn ? MASTER * settings.master ** 2 * 1.5 * (1 - fade) : 0, now, 0.3); // the world goes quiet as you fall asleep
  // the el: how close a moving train is, if you're by the el
  const elDist = Math.abs(rel(py - (EL_Y + 1))), trains = elTrains(T);
  const elNear = mode === 'room' ? 0 : clamp(1 - elDist / 7, 0, 1) *
    Math.max(0, ...trains.map(t => clamp(1 - Math.abs(rel(t.x - px)) / 9, 0, 1) * (t.stopped ? 0.25 : 1)));
  const bx = Math.floor(px / 8), by = Math.floor(py / 8);
  const mix = audioMix({ mode, room, day, night, rain, fog: fogAmt, tod, roofH, storm, district: districtAt(px, py), barCrowd: room ? barCrowd() : 0,
    seaDist: seaDist(px, py), boombox: fx.boombox, skating: fx.skating && (K.KeyW || K.KeyS || K.KeyA || K.KeyD), onBridge: ROAD[idx(Math.floor(px), Math.floor(py))] === 1 && onBridge(bx, by), elNear, speed: me ? me.v : 0 });
  for (const k in beds) tickBed(beds[k], mix[k] * LEVEL[k], dt);
  for (const k in CAL) synth[k].gain.setTargetAtTime(mix[k] * LEVEL[k] * CAL[k], now, GLIDE);
  if (me) { // the engine note follows the car
    synth.engineOsc.frequency.setTargetAtTime(38 + Math.abs(me.v) * 32, now, 0.08);
    synth.engineLP.frequency.setTargetAtTime(300 + Math.abs(me.v) * 400, now, 0.1);
  }
  // riding the el: wheels clatter over the rail joints, faster with speed
  if (mode === 'el') {
    const t = elRiding(), speed = !t || t.stopped ? 0 : t.left < 3 || t.left > HOP_T - 3 ? 1 : 3; // slow pulling in and out
    if (speed && (clackT -= dt * speed) < 0) { clackT = 1; const at = now; burst(at, 0.05, [filt('bandpass', 1300, 2)], 0.1, -0.3); burst(at + 0.11, 0.05, [filt('bandpass', 1200, 2)], 0.08, 0.3); }
  }
  tickSirens(indoors);
  if (bolt && bolt !== heardBolt) { heardBolt = bolt; sfxThunder(bolt.d, indoors); }
  // footsteps: one every step-length of ground covered on foot
  const onFoot = mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat';
  if (onFoot && lastPos && lastPos[2] === mode) {
    const moved = Math.hypot(rel(px - lastPos[0]), rel(py - lastPos[1])), run = K.ShiftLeft || K.ShiftRight;
    if (moved < 1) stepAcc += moved / (mode === 'room' ? (run ? 1.0 : 0.75) : run ? 0.14 : 0.1);
    if (stepAcc >= 1) { stepAcc = 0; sfxStep(surfaceAt(mode, room, px, py), run); }
  }
  lastPos = [px, py, mode];
}

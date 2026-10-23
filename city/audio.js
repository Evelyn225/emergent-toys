// ===== audio: recorded beds and synthesised layers, glided toward audioMix()'s targets every frame, plus one-shots
// (footsteps, sirens, the till, the shop bell, train clatter). Starts on the first key press or click (browsers
// won't play sound before one). N toggles sound.
//
// Recorded beds stream from audio/ascii-city/ through two <audio> elements each that crossfade at the loop point,
// so nothing is decoded whole into memory and the loop never clicks. A bed that has been silent for a few seconds
// pauses where it is and picks up from there when it's needed again; after a minute it lets its stream go.
const AUDIO_DIR = 'audio/ascii-city/';
const BED_FILES = { city: 'city-day.mp3', night: 'night.mp3', crowd: 'crowd.mp3', restaurant: 'restaurant.mp3', bossa: 'bossa.mp3', coffee: 'coffee.mp3',
                    rain: 'rain.mp3', karaoke: 'karaoke.mp3', arcade: 'arcade.mp3', birds: 'birds.mp3', cathedral: 'cathedral.mp3', pachinko: 'pachinko.mp3',
                    waterfall: 'waterfall.mp3', aquarium: 'aquarium.mp3', waterSoft: 'waterfall-lowpass.mp3' };
// overall level of each layer at full mix
const LEVEL = { city: 0.5, crowd: 0.35, night: 0.5, restaurant: 0.45, bossa: 0.3, coffee: 0.3, karaoke: 0.35, arcade: 0.35,
                rain: 0.28, birds: 0.35, cathedral: 0.5, pachinko: 0.45, waterfall: 0.4, aquarium: 0.3, waterSoft: 0.16,
                fluorescent: 0.2, watch: 0.2,
                board: 0.5, waves: 0.5, wind: 0.3, rumble: 0.7, tunnel: 0.3, engine: 0.4 };
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
  for (const k in BED_FILES) beds[k] = makeBed(BED_FILES[k], k === 'bossa' || k === 'coffee' || k === 'karaoke' || k === 'arcade' || k === 'aquarium' ? musicBus : ambBus);
  beds.rain.out.disconnect(); beds.rain.lp = filt('lowpass', 18000); chain(beds.rain.out, beds.rain.lp, ambBus); // muffled through the walls indoors
  makeSynths();
  preloadGameplayAudio();
  clipBuffer('police-siren.wav').then(buf => { policeSirenBuffer = buf; });
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
  if (!soundOn) cancelTransitAnnouncements();
  if (!soundOn) hushGameplayAudio();
  if (master) master.gain.setTargetAtTime(soundOn ? MASTER : 0, actx.currentTime, 0.15);
  say(soundOn ? 'Sound on' : 'Sound off', 1.5);
}

// ---- recorded beds
// Its two <audio> elements are only made when the bed is first wanted, and let go again after a minute of silence
// (a phone only has room for so many streams: nine beds' worth, loaded all visit, was too many)
function makeBed(file, bus) {
  const out = actx.createGain(); out.gain.value = 0; out.connect(bus);
  return { file, out, voices: null, cur: 0, idle: 99, xf: false };
}
function bedVoices(b) {
  b.voices = [0, 1].map(() => {
    const el = new Audio(AUDIO_DIR + b.file); el.preload = 'auto';
    const g = actx.createGain(); g.gain.value = 0;
    const src = actx.createMediaElementSource(el); src.connect(g); g.connect(b.out);
    return { el, g, src };
  });
  b.cur = 0; b.xf = false;
  const v = b.voices[0].el; // start somewhere random, so the beds never line up
  v.addEventListener('loadedmetadata', () => { v.currentTime = Math.random() * Math.max(0, v.duration - XF * 2); }, { once: true });
}
function dropVoices(b) {
  for (const v of b.voices) { v.el.pause(); v.el.removeAttribute('src'); v.el.load(); v.src.disconnect(); v.g.disconnect(); }
  b.voices = null;
}
function tickBed(b, target, dt) {
  const now = actx.currentTime;
  b.out.gain.setTargetAtTime(target, now, GLIDE);
  b.idle = target < 0.002 ? b.idle + dt : 0;
  if (!b.voices) { if (b.idle > 0) return; bedVoices(b); }
  const v = b.voices[b.cur], o = b.voices[1 - b.cur];
  if (b.idle > 60) return dropVoices(b); // silent for a minute: let the stream go
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
// a one-shot: chained like chain(), and taken apart again when its source finishes. Safari only frees audio nodes once
// they're disconnected, so without this every footstep left its filters running (silently) for the rest of the visit,
// thousands of them after a while, until the phone killed the page
const shot = (...nodes) => { nodes[0].onended = () => { for (let k = 0; k < nodes.length - 1; k++) nodes[k].disconnect(); }; return chain(...nodes); };
function lfo(param, rate, depth) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(param); o.start(); }
function layer() { const g = actx.createGain(); g.gain.value = 0; g.connect(ambBus); return g; }
// a short recorded loop, decoded once and played round and round into `dest` (whose gain the mix drives)
function loopClip(name, dest) {
  fetch(AUDIO_DIR + name + '.mp3').then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).then(buf => {
    const s = actx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(); dest.src = s; // (so the mix can pitch it)
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
  synth.fluorescent = layer(); loopClip('fluorescent-light-hum', synth.fluorescent);
  synth.watch = layer(); loopClip('pocket-watch-ticking', synth.watch);
}

// ---- one-shots
// a burst of filtered noise with a fast attack and an exponential tail; optional extra node for colour
function burst(at, len, filters, gain, pan = 0) {
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const g = actx.createGain(), p = actx.createStereoPanner(); p.pan.value = pan;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, at + len);
  shot(s, ...filters, g, p, sfxBus); s.start(at, Math.random() * 1.5, len + 0.05);
}
function tone(at, freq, len, gain, type = 'sine', pan = 0) {
  const o = actx.createOscillator(), g = actx.createGain(), p = actx.createStereoPanner();
  o.type = type; o.frequency.value = freq; p.pan.value = pan;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, at + len);
  shot(o, g, p, sfxBus); o.start(at); o.stop(at + len + 0.05);
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
// the board's own noises (skate.js): a foot pushing off, a foot dragged to brake, the deck scraping along a wall
function sfxSkate(kind, k = 1) {
  const at = actx.currentTime;
  if (kind === 'push') burst(at, 0.09, [filt('lowpass', 700)], 0.08);
  else if (kind === 'drag') burst(at, 0.16, [filt('bandpass', 1600, 0.8)], 0.05 * k);
  else burst(at, 0.2, [filt('bandpass', 2600, 1.5)], 0.09 * k);
}
// the ball (goods.js), heard from where it is: a bounce or a rebound off a wall (k: how hard), a touch, a splash
function sfxBall(kind, x, y, z, k) {
  const p = worldSoundProfile(x, y, z, 30, 2), at = actx.currentTime + p.delay, g = p.gain;
  if (g < 0.002) return;
  if (kind === 'splash') { burst(at, 0.3, [filt('bandpass', 1200, 0.8), filt('lowpass', p.cutoff)], 0.15 * g, p.pan); playClip('water-drip', 0.4 * g, at, p); return; }
  if (kind === 'touch') { burst(at, 0.05, [filt('lowpass', Math.min(900, p.cutoff))], 0.05 * g, p.pan); tone(at, 120, 0.05, 0.05 * g, 'sine', p.pan); return; }
  tone(at, 150 + Math.random() * 30, 0.07, 0.12 * k * g, 'sine', p.pan); // the leather's thup
  burst(at, 0.04, [filt('lowpass', Math.min(kind === 'wall' ? 2200 : 1400, p.cutoff))], 0.1 * k * g, p.pan);
}
function sfxTill() { // cha-ching: the drawer, then the bell
  const at = actx.currentTime;
  burst(at, 0.08, [filt('bandpass', 2500, 1)], 0.25);
  tone(at + 0.08, 2093, 0.7, 0.12); tone(at + 0.08, 2637, 0.7, 0.1); tone(at + 0.11, 3136, 0.5, 0.06);
}
function sfxCoin() { const at = actx.currentTime; tone(at, 3100, 0.15, 0.08); tone(at + 0.07, 4150, 0.18, 0.06); }
// Short recordings: fetched and decoded once. Bare names default to MP3; explicit filenames support lossless loops.
const CLIPS = {};
function clipBuffer(name) {
  const file = name.includes('.') ? name : name + '.mp3';
  if (!CLIPS[name]) CLIPS[name] = fetch(AUDIO_DIR + file).then(r => {
    if (!r.ok) throw new Error('Audio unavailable: ' + file);
    return r.arrayBuffer();
  }).then(b => actx.decodeAudioData(b)).catch(() => null);
  return CLIPS[name];
}
function playClip(name, gain, when = actx.currentTime, spatial=null) {
  clipBuffer(name).then(buf => {
    if (!buf) return;
    const s = actx.createBufferSource(), g_ = actx.createGain();
    s.buffer = buf; s.playbackRate.value = 0.93 + Math.random() * 0.14; g_.gain.value = gain;
    if(spatial){const lp=filt('lowpass',spatial.cutoff),pan=actx.createStereoPanner();pan.pan.value=spatial.pan;shot(s,lp,g_,pan,sfxBus);}
    else shot(s,g_,sfxBus);
    s.start(Math.max(actx.currentTime, when));
  });
}
function worldSoundProfile(x,y,z,range=180,reference=14) {
  const [x0,y0]=audioWorldPosition(mode,room,px,py),z0=mode==='room'||!Number.isFinite(eye)?terrainHeight(x0,y0)+.17:eye; // (eye: set by the first render)
  return soundDistanceProfile(rel(x-x0),rel(y-y0),z-z0,a,range,reference,mode==='room');
}
let peeLoopVoice = null;
function setPeeAudio(on) {
  if (!actx) return;
  if (!on) {
    if (!peeLoopVoice) return;
    const voice = peeLoopVoice; peeLoopVoice = null;
    voice.gain.gain.setTargetAtTime(0, actx.currentTime, 0.06);
    voice.source.stop(actx.currentTime + 0.3);
    voice.source.onended = () => { voice.source.disconnect(); voice.gain.disconnect(); };
    return;
  }
  if (peeLoopVoice) return;
  clipBuffer('piss_seamless').then(buf => {
    if (!buf || !pee || !actx || peeLoopVoice) return;
    const source = actx.createBufferSource(), gain = actx.createGain();
    source.buffer = buf; source.loop = true; gain.gain.value = 0;
    source.connect(gain); gain.connect(sfxBus); source.start();
    gain.gain.setTargetAtTime(0.24, actx.currentTime, 0.08);
    peeLoopVoice = { source, gain };
  });
}
function sfxDoor() { const at = actx.currentTime; tone(at, 1568, 0.5, 0.08); tone(at + 0.12, 1976, 0.6, 0.07); } // a shop bell
function sfxKnock() {
  const at=actx.currentTime;
  for(const delay of [0,.16,.34]) {
    burst(at+delay,.065,[filt('lowpass',700)],.12);
    tone(at+delay,155,.07,.1);
  }
}

// ---- sirens: one voice per emergency vehicle in earshot, with Doppler and panning
const SIREN = { amb: { type: 'square', f: t => 700 + 520 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 3.2)) },
                fire: { type: 'square', f: t => 480 + 420 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 4.5)) } };
let policeSirenBuffer = null; // decoded once; WAV keeps the exact seamless loop boundaries
const sirens = new Map(); // car -> voice
const SIREN_R = 28; // heard out to here (280m), fading to nothing at the edge
function tickSirens(indoors) {
  const now = actx.currentTime, right = [-Math.sin(a), Math.cos(a)];
  const [lx,ly]=audioWorldPosition(mode,room,px,py);
  for (const c of cars) if (code(c) && !wanted.busted && !sirens.has(c) && Math.hypot(rel(c.x - lx), rel(c.y - ly)) < SIREN_R) {
    const recorded = c.kind === 'police';
    if (recorded && !policeSirenBuffer) continue; // try next frame after the shared clip finishes loading
    const o = recorded ? actx.createBufferSource() : actx.createOscillator();
    const lp = filt('lowpass', 2600), g = actx.createGain(), p = actx.createStereoPanner();
    if (recorded) { o.buffer = policeSirenBuffer; o.loop = true; }
    else o.type = SIREN[c.kind].type;
    g.gain.value = 0; shot(o, lp, g, p, sfxBus);
    if (recorded) o.start(now, Math.random() * policeSirenBuffer.duration);
    else o.start();
    sirens.set(c, { o, lp, g, p, recorded, t0: Math.random() * 5 });
  }
  for (const [c, v] of sirens) {
    const rx = rel(c.ex - lx), ry = rel(c.ey - ly), d = Math.hypot(rx, ry) || 0.01;
    if (!cars.includes(c) || !code(c) || wanted.busted || d > SIREN_R + 4) { v.g.gain.setTargetAtTime(0, now, 0.3); v.o.stop(now + 1.5); sirens.delete(c); continue; }
    const vr = -(c.hx * rx + c.hy * ry) / d * c.v; // closing speed, cells/s (sound: ~34 cells/s)
    const doppler = clamp(34 / (34 - vr), 0.5, 2);
    if (v.recorded) v.o.playbackRate.setTargetAtTime(doppler, now, 0.02);
    else v.o.frequency.setTargetAtTime(SIREN[c.kind].f(T + v.t0) * doppler, now, 0.02);
    // Recorded audio is normalized to -20 LUFS; oscillators have much higher RMS at gain 1.
    const level = v.recorded ? 0.8 : 0.16;
    v.g.gain.setTargetAtTime(level * clamp(1 - d / SIREN_R, 0, 1) ** 2 / (1 + (d / 6) ** 1.2) * (indoors ? 0.12 : 1), now, 0.1);
    v.lp.frequency.setTargetAtTime(indoors ? 700 : 2600 / (1 + d / 30), now, 0.2);
    v.p.pan.setTargetAtTime(clamp((rx * right[0] + ry * right[1]) / d, -1, 1) * 0.8, now, 0.1);
  }
}

// ---- car alarms (damage.js): each one going cycles through a warble, a whoop and beeps, heard from where it's parked
const carAlarms = new Map(); // car -> voice
function tickCarAlarms() {
  const now = actx.currentTime;
  for (const c of cars) if (carAlarming(c) && !carAlarms.has(c)) {
    const o = actx.createOscillator(), lp = filt('lowpass', 4000), g = actx.createGain(), p = actx.createStereoPanner();
    o.type = 'square'; g.gain.value = 0; shot(o, lp, g, p, sfxBus); o.start();
    carAlarms.set(c, { o, lp, g, p });
  }
  for (const [c, v] of carAlarms) {
    if (!cars.includes(c) || !carAlarming(c)) { v.g.gain.setTargetAtTime(0, now, 0.05); v.o.stop(now + 0.3); carAlarms.delete(c); continue; }
    const t = T - c.alarmT, phase = Math.floor(t / 2.5) % 3, prof = worldSoundProfile(c.x, c.y, terrainHeight(c.x, c.y) + 0.08, 60, 4);
    const f = phase === 0 ? (Math.floor(t * 10) % 2 ? 950 : 1250) : phase === 1 ? 500 + 1200 * fract(t / 0.6) : 1400;
    v.o.frequency.setTargetAtTime(f, now, 0.005);
    v.g.gain.setTargetAtTime(0.1 * prof.gain * (phase === 2 && fract(t * 3) >= 0.5 ? 0 : 1), now, 0.01);
    v.lp.frequency.setTargetAtTime(Math.min(4000, prof.cutoff), now, 0.05);
    v.p.pan.setTargetAtTime(prof.pan, now, 0.05);
  }
}

// the game's frozen (a shop, the inventory, the map, the dev tools, a hidden tab: anything that stops the frame loop,
// not only the pause menu, which mutes everything): the sirens fall silent rather than hold whatever note they were on.
// tickSirens brings them back with the first frame after
function hushSirens() {
  hushGameplayAudio();
  if (!actx) return;
  for (const v of [...sirens.values(), ...carAlarms.values()]) v.g.gain.setTargetAtTime(0, actx.currentTime, 0.04);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) hushSirens(); });

// ---- fires: a lit campfire crackles and pops, a burning car quicker and louder, heard from where they are
function tickFireSounds(dt) {
  for (const o of FIRES) if (fireLit(o)) firePop(dt, 4 + fireRoar(o) * 6, 0.5, 1, o);
  for (const c of cars) if (burning(c)) firePop(dt, 16, 1, 2, c);
}
function firePop(dt, rate, loud, reference, o) {
  if (Math.random() >= dt * rate) return;
  const p = worldSoundProfile(o.x, o.y, (o.z ?? terrainHeight(o.x, o.y)) + 0.03, reference * 6, reference);
  if (p.gain < 0.002) return;
  const at = actx.currentTime + p.delay + Math.random() * 0.03, deep = Math.random() < 0.2; // (now and then a deeper snap of a log)
  burst(at, deep ? 0.05 : 0.015 + Math.random() * 0.02, [filt(deep ? 'bandpass' : 'highpass', deep ? 400 : 1500 + Math.random() * 2500), filt('lowpass', p.cutoff)],
    (deep ? 0.1 : 0.06) * loud * p.gain * (0.4 + Math.random() * 0.6), p.pan);
}

// ---- thunder: a crack (if it's close) rolling into a long low rumble, arriving d/34 seconds after the flash
function sfxThunder(d, indoors) {
  const at = actx.currentTime + d / 34, near = clamp(1.2 - d / 70, 0.15, 1), s = actx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.3 + near * 0.15; // slowed right down: a low growl
  const lp = filt('lowpass', indoors ? 180 : 220 + near * 900), g = actx.createGain(), k = (indoors ? 0.65 : 1.1) * near;
  lp.frequency.setValueAtTime(lp.frequency.value, at); lp.frequency.exponentialRampToValueAtTime(70, at + 3);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.8 * k, at + (near > 0.7 ? 0.015 : 0.3)); // crack, or a far-off roll
  g.gain.exponentialRampToValueAtTime(0.25 * k, at + 0.7); g.gain.linearRampToValueAtTime(0.35 * k, at + 1.5);
  g.gain.exponentialRampToValueAtTime(0.0005, at + 4 + d / 30);
  shot(s, lp, g, sfxBus); s.start(at, Math.random() * 1.5); s.stop(at + 5 + d / 30);
}
let heardBolt = null, dripT = 0;

// ---- per frame
let stepAcc = 0, lastPos = null, clackT = 0, rotorT = 0;
function audioTick(dt) {
  tickGameplayAudio();
  if (!actx || actx.state !== 'running') return;
  const now = actx.currentTime, indoors = mode === 'room';
  master.gain.setTargetAtTime(soundOn ? MASTER * settings.master ** 2 * 1.5 * (1 - fade) : 0, now, 0.3); // the world goes quiet as you fall asleep
  // the el: how close a moving train is, if you're by the el
  const elDist = Math.abs(rel(py - (EL_Y + 1))), trains = elTrains(T);
  const elNear = mode === 'room' ? 0 : clamp(1 - elDist / 7, 0, 1) *
    Math.max(0, ...trains.map(t => clamp(1 - Math.abs(rel(t.x - px)) / 9, 0, 1) * (t.stopped ? 0.25 : 1)));
  const bx = Math.floor(px / 8), by = Math.floor(py / 8);
  let waterfall=0;
  if(mode==='room'&&room.kind==='conservatory')waterfall=clamp(1-Math.hypot(px-CONS_POOL.x,py-.8)/6.5,0,1);
  else if(worldReady&&mode!=='room')waterfall=clamp(1-near(px,py,627,190)/8,0,1);
  const mix = audioMix({ mode, room, day, night, rain, fog: fogAmt, tod, roofH, storm, record:homeRecordAudio(), district: districtAt(px, py), gardens: mode === 'boat' || inGardens(px, py), waterfall, watch: hurrying(), barCrowd: room ? barCrowd() : 0,
    wilderness:worldReady&&!!wildIslandAt(...audioWorldPosition(mode,room,px,py)),ferryInside:mode==='ferry'&&ferryRide?.u>-.98&&Math.abs(ferryRide.v)<.46,ferryMoving:mode==='ferry'&&!ferryShip(ferryRide.id).stopped,
    seaDist: seaDist(px, py), boombox: fx.boombox, song: fx.song, skating: wheelsRolling() ? Math.max(SK.v / SK_TOP, 0.25) : 0, onBridge: ROAD[idx(Math.floor(px), Math.floor(py))] === 1 && onBridge(bx, by), elNear, speed: me ? me.v : sea ? sea.v : pilot ? pilot.v : 0, throttle: pilot ? (PLANE_TYPES[pilot.type].heli ? pilot.rotor || 0 : pilot.throttle || 0) : 0, airHeight: pilot ? pilot.z : 0,
    fairNear: mode === 'room' ? 0 : clamp(1 - Math.hypot(rel(px - FAIR.cx), rel(py - (FAIR.y0 + FAIR.y1) / 2)) / 12, 0, 1), fairEye: fairRide ? fairEye : 0, fireworks: eventNow('fireworks') && weather !== 'storm', serenade: courierSerenade() });
  for (const k in beds) tickBed(beds[k], mix[k] * LEVEL[k], dt);
  beds.rain.lp.frequency.setTargetAtTime(indoors ? 450 : 18000, now, 0.3);
  for (const k in CAL) synth[k].gain.setTargetAtTime(mix[k] * LEVEL[k] * CAL[k], now, k === 'board' ? 0.04 : GLIDE); // (the wheels cut out the instant you pop, and back on landing)
  if (pilot && PLANE_TYPES[pilot.type].heli && gameplayBuffers.rotor) synth.engine.gain.setTargetAtTime(0, now, .08);
  if (fx.skating) synth.board.src?.playbackRate.setTargetAtTime(0.75 + 0.3 * Math.min(1.3, SK.v / SK_TOP), now, 0.1); // (the wheels' whirr rising with speed)
  synth.fluorescent.gain.setTargetAtTime(mix.fluorescent * LEVEL.fluorescent, now, GLIDE);
  synth.watch.gain.setTargetAtTime(mix.watch * LEVEL.watch, now, GLIDE);
  if (indoors && room.kind === 'conservatory') {
    if ((dripT -= dt) <= 0) { dripT = 2.5 + Math.random() * 4; playClip('water-drip', 0.18); }
  } else dripT = 0;
  if (me || sea) { // the engine note follows the car (or the boat: lower, burbling)
    const v = Math.abs((me || sea).v), m = me ? 1 : 0.7;
    synth.engineOsc.frequency.setTargetAtTime((38 + v * 32) * m, now, 0.08);
    synth.engineLP.frequency.setTargetAtTime(300 + v * 400 * m, now, 0.1);
  } else if(mode==='ferry') {
    synth.engineOsc.frequency.setTargetAtTime(ferryShip(ferryRide.id).stopped?28:36,now,.5);
    synth.engineLP.frequency.setTargetAtTime(220,now,.5);
  } else if (pilot) { // a prop's drone or a jet's whine, up with the throttle; a helicopter's rotor thudding round
    const T_ = PLANE_TYPES[pilot.type], th = T_.heli ? pilot.rotor || 0 : pilot.throttle || 0;
    synth.engineOsc.frequency.setTargetAtTime(T_.heli ? 30 + th * 25 : pilot.type === 'jet' ? 90 + th * 160 : 55 + th * 70, now, 0.15);
    synth.engineLP.frequency.setTargetAtTime(T_.heli ? 260 + th * 200 : pilot.type === 'jet' ? 900 + th * 1800 : 400 + th * 500, now, 0.2);
    if (T_.heli && !gameplayBuffers.rotor && th > 0.1 && (rotorT -= dt * (4 + th * 14)) < 0) { rotorT = 1; burst(now, 0.07, [filt('lowpass', 220)], 0.12 * th, 0); }
  }
  // riding the el: wheels clatter over the rail joints, faster with speed
  if (mode === 'el') {
    const t = elRiding(), speed = !t || t.stopped ? 0 : t.left < 3 || t.left > HOP_T - 3 ? 1 : 3; // slow pulling in and out
    if (speed && (clackT -= dt * speed) < 0) { clackT = 1; const at = now; burst(at, 0.05, [filt('bandpass', 1300, 2)], 0.1, -0.3); burst(at + 0.11, 0.05, [filt('bandpass', 1200, 2)], 0.08, 0.3); }
  }
  tickSirens(indoors); tickCarAlarms(); tickFireSounds(dt);
  if (bolt && bolt !== heardBolt) { heardBolt = bolt; sfxThunder(bolt.d, indoors); }
  // footsteps: one every step-length of ground covered on foot
  const onFoot = mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat'||mode==='ferry';
  const footPos=mode==='ferry'?[ferryRide.u,ferryRide.v,mode]:[px,py,mode];
  if (onFoot && lastPos && lastPos[2] === mode) {
    const moved = Math.hypot(rel(footPos[0] - lastPos[0]), rel(footPos[1] - lastPos[1])), run = K.ShiftLeft || K.ShiftRight;
    if (moved < 1) stepAcc += moved / (mode === 'room' ? (run ? 1.0 : 0.75) : run ? 0.14 : 0.1);
    if (stepAcc >= 1) { stepAcc = 0; sfxStep(surfaceAt(mode, room, px, py), run); }
  }
  lastPos = footPos;
}

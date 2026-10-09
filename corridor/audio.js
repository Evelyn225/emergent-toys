// Sound. Footsteps, machinery, doors, keys, detonations, ambience, and the ending music are
// recordings from audio/corridor/. Chimes, the pump's hum, and the blast front are synthesised.
// Anything with a place in the world is panned from that place, and every placed sound feeds a send
// into the current zone's reverb. A recording that fails to load falls back to synthesis or to
// silence, so a missing file never breaks what it decorates.
const soundDir = 'audio/corridor/';
const soundFiles = {
  concrete: 'steps-concrete.mp3', metal: 'steps-metal.mp3', stone: 'steps-stone.mp3', grass: 'steps-grass.mp3', water: 'water.mp3', wheel: 'wheel.mp3',
  button: 'button.mp3', key: 'key.mp3', lock: 'lock.mp3', shutter: 'shutter.mp3', hatch: 'hatch.mp3',
  liftStart: 'lift-start.mp3', liftLoop: 'lift-loop.mp3', liftStop: 'lift-stop.mp3',
  explosion1: 'explosion-1.mp3', explosion2: 'explosion-2.mp3',
  ventilation: 'ventilation.mp3', wind: 'cave-wind.mp3', rubble: 'rubble.mp3', ending: 'ending.mp3',
  birds: 'birds.mp3', hum: 'fluorescent-hum.mp3',
};
// Levels that bring each recording to a common loudness before the master.
const soundLevel = { button: 2, key: 2.5, lock: 1.8, shutter: 1.3, hatch: 1.2, wheel: 2.2, lift: .6, water: 10, ventilation: 3.5, wind: 3, rubble: 2, birds: 2.2, hum: .9 };
// Each steps file holds single steps in fixed half-second slots, level-matched.
const stepSlot = .5;
// The lift's stop recording reaches its clunk this long after it starts; it starts this long before docking.
const liftStopLead = 1.3;
// Reverb per zone: decay time in seconds, and how much of everything is sent into it.
const zoneReverb = {
  bend: [1.4,.3], reservoir: [3.8,.45], ascent: [3,.4], overlook: [3.8,.45], lowerWorks: [1.6,.3], store: [.45,.15],
  shaft: [2.6,.4], sump: [3.2,.45], control: [.6,.18], service: [1.3,.3], cave: [4.5,.5],
  reception: [1.5,.3], stairs: [3.4,.42], outside: [.3,.04],
};
// The facility's ventilation is everywhere there is power; the cave has moving air instead.
const zoneVentilation = { service: .45, cave: .12, reservoir: .7, overlook: .7, ascent: .7 };
const zoneWind = { service: .25, cave: 1, stairs: .2, outside: .5 };
// Birdsong outside, and the faintest of it down the stair.
const zoneBirds = { stairs: .05, outside: 1 };
const listenerForward = new THREE.Vector3(), soundAt = new THREE.Vector3();
let lastStep = -1;
function createAudio() {
  const ctx = new AudioContext(), master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  // The pump's motor hum, heard only while it runs.
  const hum = ctx.createOscillator(), humGain = ctx.createGain();
  hum.type = 'sine'; hum.frequency.value = 55; humGain.gain.value = 0; hum.connect(humGain).connect(master); hum.start();
  const buffer = ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random()*2-1;
  const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), noiseGain = ctx.createGain();
  noise.buffer = buffer; noise.loop = true; filter.type = 'lowpass'; filter.frequency.value = 180;
  noiseGain.gain.value = .05; noise.connect(filter).connect(noiseGain).connect(master); noise.start();
  // Two convolvers trade places when the zone changes, so a room's tail is never cut off.
  const send = ctx.createGain(), rooms = [0,1].map(() => {
    const convolver = ctx.createConvolver(), gain = ctx.createGain(); gain.gain.value = 0;
    send.connect(convolver).connect(gain).connect(master);
    return { convolver,gain };
  });
  const sound = { ctx,master,humGain,noiseGain,send,buffer,rooms,room: 0,impulses: {},samples: {},beds: {},
    water: null,motor: null,lift: null,liftTrip: null,music: null,waterLevel: 0,motorLevel: 0,lastStep: null };
  loadSounds(sound);
  return sound;
}
async function loadSounds(sound) {
  await Promise.all(Object.entries(soundFiles).map(async ([name,file]) => {
    try {
      const response = await fetch(soundDir+file);
      if (response.ok) sound.samples[name] = await sound.ctx.decodeAudioData(await response.arrayBuffer());
    } catch {}
  }));
}
// A room's impulse response: noise that decays 60 dB over the decay time and darkens as it fades.
function impulse(decay) {
  const { ctx } = audio, length = Math.ceil(ctx.sampleRate*decay), response = ctx.createBuffer(2,length,ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = response.getChannelData(c);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i/length;
      low += (Math.random()*2-1-low)*(.55-.45*t);
      data[i] = low*Math.pow(.001,t);
    }
  }
  return response;
}
function setRoom(name) {
  const [decay,wet] = zoneReverb[name] ?? [1.6,.3], now = audio.ctx.currentTime;
  const current = audio.rooms[audio.room], next = audio.rooms[1-audio.room];
  next.convolver.buffer = audio.impulses[name] ??= impulse(decay);
  next.gain.gain.setTargetAtTime(wet,now,.25); current.gain.gain.setTargetAtTime(0,now,.25);
  audio.room = 1-audio.room;
}
// Send a node to the mix, from a place in the world if it has one. A rolloff of 0 keeps only direction.
function route(node,position = null,refDistance = 2,rolloffFactor = 1) {
  let tail = node;
  if (position) {
    tail = new PannerNode(audio.ctx,{ panningModel: 'HRTF',distanceModel: 'inverse',refDistance,rolloffFactor,
      positionX: position.x,positionY: position.y,positionZ: position.z });
    node.connect(tail);
  }
  tail.connect(audio.master); tail.connect(audio.send);
  return tail;
}
function place(panner,p) {
  const now = audio.ctx.currentTime;
  panner.positionX.setTargetAtTime(p.x,now,.03); panner.positionY.setTargetAtTime(p.y,now,.03); panner.positionZ.setTargetAtTime(p.z,now,.03);
}
// Play a recording once from a place. Returns false if it is not loaded, so callers can fall back.
function play(name,position,{ level = soundLevel[name] ?? 1,rate = 1,refDistance = 2,rolloff = 1,at = 0 } = {}) {
  if (!audio || !soundOn) return true;
  const sample = audio.samples[name];
  if (!sample) return false;
  const source = audio.ctx.createBufferSource(), gain = audio.ctx.createGain();
  source.buffer = sample; source.playbackRate.value = rate; gain.gain.value = level;
  source.connect(gain); route(gain,position,refDistance,rolloff); source.start(audio.ctx.currentTime+at);
  return true;
}
// A looping recording. Encoders pad the ends with silence, so the loop skips any silent head and tail.
function loopSource(sample) {
  const source = audio.ctx.createBufferSource(), data = sample.getChannelData(0);
  let a = 0, b = data.length-1;
  while (a < b && Math.abs(data[a]) < 1e-4) a++;
  while (b > a && Math.abs(data[b]) < 1e-4) b--;
  source.buffer = sample; source.loop = true;
  source.loopStart = a/sample.sampleRate; source.loopEnd = (b+1)/sample.sampleRate;
  source.start(0,source.loopStart);
  return source;
}
document.getElementById('sound').addEventListener('click',async () => {
  try {
    if (!audio) audio = createAudio(); soundOn = !soundOn; await audio.ctx.resume();
    if (!ended) audio.master.gain.setTargetAtTime(soundOn && playing ? masterLevel() : 0,audio.ctx.currentTime,.1);
    if (audio.musicVolume) audio.musicVolume.gain.setTargetAtTime(soundOn ? settings.volume : 0,audio.ctx.currentTime,.1);
    document.getElementById('sound').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    document.getElementById('sound').setAttribute('aria-pressed',String(soundOn));
  } catch { document.getElementById('sound').textContent = 'SOUND UNAVAILABLE'; }
});
function chime(frequency,duration,position = null) {
  if (!audio || !soundOn) return;
  const now = audio.ctx.currentTime, bus = audio.ctx.createGain();
  route(bus,position,2.5);
  for (const overtone of [1,2.01,3.9]) {
    const osc = audio.ctx.createOscillator(), gain = audio.ctx.createGain(); osc.frequency.value = frequency*overtone;
    gain.gain.setValueAtTime(.16/overtone,now); gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain).connect(bus); osc.start(); osc.stop(now+duration);
  }
}
function clunk(position) {
  if (!audio || !soundOn) return;
  const now = audio.ctx.currentTime, osc = audio.ctx.createOscillator(), gain = audio.ctx.createGain();
  osc.frequency.setValueAtTime(140,now); osc.frequency.exponentialRampToValueAtTime(60,now+.18);
  gain.gain.setValueAtTime(.35,now); gain.gain.exponentialRampToValueAtTime(.001,now+.25);
  osc.connect(gain); route(gain,position,1.5); osc.start(now); osc.stop(now+.25);
}
// Things the walker operates. Heavier controls play the same button lower.
function press(position,rate = 1) { if (!play('button',position,{ rate,refDistance: 1.5 })) clunk(position); }
function crank(position) { if (!play('wheel',position)) chime(110,.5,position); }
function keyPickedUp(position) { if (!play('key',position,{ refDistance: 1.5 })) chime(660,.4,position); }
function lockTurned(position) { if (!play('lock',position,{ refDistance: 1.5 })) chime(330,.5,position); }
function shutterRolls(position) { play('shutter',position,{ refDistance: 3 }); }
function hatchSwings(position) { if (!play('hatch',position,{ refDistance: 3 })) chime(82,1.4,position); }
// A detonation: a recorded explosion over a falling sub-tone. From a place it keeps only its
// direction, so distant ones stay as loud as they were designed to be. Without the recording, a
// muffled noise burst stands in.
function boom(level,position = null,recording = 'explosion1',rate = 1) {
  if (!audio || !soundOn) return;
  const ctx = audio.ctx, now = ctx.currentTime, bus = ctx.createGain(), osc = ctx.createOscillator(), body = ctx.createGain();
  route(bus,position,2,0);
  osc.frequency.setValueAtTime(52,now); osc.frequency.exponentialRampToValueAtTime(22,now+2.8);
  body.gain.setValueAtTime(.0001,now); body.gain.exponentialRampToValueAtTime(level*.7,now+.06); body.gain.exponentialRampToValueAtTime(.001,now+3);
  osc.connect(body).connect(bus); osc.start(now); osc.stop(now+3);
  const sample = audio.samples[recording];
  if (sample) {
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = sample; source.playbackRate.value = rate; gain.gain.value = level*2.4;
    source.connect(gain).connect(bus); source.start(now);
    return;
  }
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), burst = ctx.createGain();
  source.buffer = audio.buffer; source.loop = true; filter.type = 'lowpass';
  filter.frequency.setValueAtTime(150+500*level,now); filter.frequency.exponentialRampToValueAtTime(70,now+2.5);
  burst.gain.setValueAtTime(.0001,now); burst.gain.exponentialRampToValueAtTime(1.6*level,now+.1); burst.gain.exponentialRampToValueAtTime(.001,now+2.6);
  source.connect(filter).connect(burst).connect(bus); source.start(now,0,2.6);
}
// The approaching front: far off a low muffled rumble that opens into a roaring rush as it closes.
// It comes from the nearest point of the front, by direction only; closeness is in the filter and gain.
function updateRoar(gap,from) {
  if (!audio) return;
  const ctx = audio.ctx, now = ctx.currentTime;
  if (!roar) {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    const sub = ctx.createOscillator(), subGain = ctx.createGain();
    source.buffer = audio.buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 120;
    gain.gain.value = 0; sub.frequency.value = 31; subGain.gain.value = 0;
    source.connect(filter).connect(gain);
    sub.connect(subGain).connect(audio.master); source.start(); sub.start();
    roar = { filter,gain,subGain,panner: route(gain,from,2,0) };
  }
  place(roar.panner,from);
  const near = 1-Math.min(1,gap/110);
  roar.filter.frequency.setTargetAtTime(120*Math.pow(25,near*near),now,.08);
  roar.gain.gain.setTargetAtTime(.04+.9*near**3,now,.08);
  roar.subGain.gain.setTargetAtTime(.35*near*near,now,.08);
}
// Silence the old runtime before the black restart screen loads the remembered game.
function endSound() {
  if (!audio) return;
  const ctx = audio.ctx, now = ctx.currentTime;
  audio.master.gain.cancelScheduledValues(now);
  audio.master.gain.setValueAtTime(0,now);
  ctx.suspend();
}
// The floor underfoot decides the step: decks and treads ring as metal, the cave is stone, the surface is grass.
function stepSurface() {
  if (!ground) return 'concrete';
  return ground.userData.surface ?? (ground.material === steel ? 'metal' : ground.material === rock ? 'stone' : 'concrete');
}
function footstep(surface = stepSurface()) {
  if (!audio || !soundOn) return;
  const ctx = audio.ctx, now = ctx.currentTime, sample = audio.samples[surface];
  if (!sample) {
    const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    source.buffer = audio.buffer; filter.type = 'lowpass'; filter.frequency.value = 850;
    gain.gain.setValueAtTime(.45,now); gain.gain.exponentialRampToValueAtTime(.001,now+.13);
    source.connect(filter).connect(gain); route(gain); source.start(now,.3,.15);
    audio.lastStep = 'synth';
    return;
  }
  // Never the same step twice running, at a slightly different pitch and weight each time.
  const slots = Math.round(sample.duration/stepSlot);
  let slot = Math.floor(Math.random()*slots);
  if (slot === lastStep) slot = (slot+1)%slots;
  lastStep = slot;
  const source = ctx.createBufferSource(), gain = ctx.createGain();
  source.buffer = sample; source.playbackRate.value = .93+Math.random()*.14;
  gain.gain.value = (surface === 'metal' ? .7 : .85)*(.75+Math.random()*.25);
  source.connect(gain); route(gain); source.start(now,slot*stepSlot,stepSlot);
  audio.lastStep = surface;
}
// A looping bed, straight to the master: everywhere at once, not from a place.
function setBed(name,level) {
  const sample = audio.samples[name];
  if (!sample) return;
  if (!audio.beds[name]) {
    const gain = audio.ctx.createGain(); gain.gain.value = 0;
    loopSource(sample).connect(gain).connect(audio.master);
    audio.beds[name] = gain;
  }
  audio.beds[name].gain.setTargetAtTime(level*soundLevel[name],audio.ctx.currentTime,1.2);
}
// Called when the zone or the power changes.
function updateBeds() {
  setBed('ventilation',powerCut ? 0 : zoneVentilation[zone] ?? 1);
  setBed('wind',zoneWind[zone] ?? 0);
  if (collapsed) setBed('birds',zoneBirds[zone] ?? 0);
}
// The tubes' hum comes from the nearest working lamp in the reception and up the stair, and cuts
// out with it when it flickers.
function updateHum(lamp,distance) {
  const sample = audio.samples.hum;
  if (!sample) return;
  const ctx = audio.ctx;
  if (!audio.hum) {
    const gain = ctx.createGain(); gain.gain.value = 0;
    loopSource(sample).connect(gain);
    audio.hum = { gain,panner: route(gain,soundAt.set(0,0,0),1.5),lamp: null,level: 0 };
  }
  if (lamp && lamp !== audio.hum.lamp) place(audio.hum.panner,lamp.source.position);
  audio.hum.lamp = lamp;
  const level = lamp && distance < 12 ? lamp.level*soundLevel.hum : 0;
  if (level !== audio.hum.level) audio.hum.gain.gain.setTargetAtTime(level,ctx.currentTime,.015);
  audio.hum.level = level;
}
// The lift: a start as the car leaves, a running loop, and a stop whose clunk lands as it docks.
// All of it rides with the car. Without the recordings, a synthesised motor turns at the sheave.
function updateLiftSound(remaining,carY) {
  const ctx = audio.ctx, now = ctx.currentTime, recorded = audio.samples.liftStart && audio.samples.liftLoop && audio.samples.liftStop;
  if (!recorded) {
    if (!audio.motor) {
      const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 47; filter.type = 'lowpass'; filter.frequency.value = 260; gain.gain.value = 0;
      osc.connect(filter).connect(gain); route(gain,soundAt.set(-33,sheaveY,-48.9),3); osc.start();
      audio.motor = gain;
    }
    audio.motorLevel = remaining !== null && !powerCut ? .5 : 0;
    audio.motor.gain.setTargetAtTime(audio.motorLevel,now,.35);
    if (remaining === null && audio.liftTrip) chime(165,1.6,liftControl);
    audio.liftTrip = remaining === null ? null : 'running';
    return;
  }
  if (!audio.lift) {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const panner = route(gain,soundAt.set(-33,carY+1.5,-50),3);
    loopSource(audio.samples.liftLoop).connect(gain);
    audio.lift = { gain,panner,y: carY };
  }
  if (carY !== audio.lift.y) { place(audio.lift.panner,soundAt.set(-33,carY+1.5,-50)); audio.lift.y = carY; }
  const level = soundLevel.lift;
  if (remaining !== null && !audio.liftTrip) {
    audio.liftTrip = 'running';
    playOnCar('liftStart',level);
    audio.lift.gain.gain.setTargetAtTime(level,now+1.6,.2);
  }
  if (audio.liftTrip === 'running' && remaining !== null && remaining <= liftStopLead) {
    audio.liftTrip = 'stopping';
    audio.lift.gain.gain.cancelScheduledValues(now);
    audio.lift.gain.gain.setTargetAtTime(0,now,.25);
    playOnCar('liftStop',level);
  }
  if (remaining === null && audio.liftTrip === 'stopping') audio.liftTrip = null;
  audio.motorLevel = audio.liftTrip === 'running' ? level : 0;
  function playOnCar(name,gainValue) {
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = audio.samples[name]; gain.gain.value = gainValue;
    source.connect(gain).connect(audio.lift.panner); source.start();
  }
}
// Per frame: the listener follows the camera, the water runs while the level moves, the lift runs
// with its car, and the collapse's rubble shifts where it lies.
function updateSound(waterRemaining,liftRemaining,carY) {
  if (!audio || ended) return;
  const ctx = audio.ctx, now = ctx.currentTime, listener = ctx.listener, p = camera.position;
  camera.getWorldDirection(listenerForward);
  if (listener.positionX) {
    listener.positionX.value = p.x; listener.positionY.value = p.y; listener.positionZ.value = p.z;
    listener.forwardX.value = listenerForward.x; listener.forwardY.value = listenerForward.y; listener.forwardZ.value = listenerForward.z;
    listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
  } else {
    listener.setPosition(p.x,p.y,p.z); listener.setOrientation(listenerForward.x,listenerForward.y,listenerForward.z,0,1,0);
  }
  // The level eases toward its target, so its speed follows what is left to go: the water is loud
  // while the level runs and fades as it settles. Steps of a twentieth keep automation sparse.
  const waterLevel = Math.round(Math.min(1,waterRemaining/.5)*20)/20*soundLevel.water;
  if (!audio.water && audio.samples.water && waterLevel > 0) {
    const gain = ctx.createGain(); gain.gain.value = 0;
    loopSource(audio.samples.water).connect(gain); route(gain,soundAt.set(12,-1.5,-42),7);
    audio.water = gain;
  }
  if (audio.water && waterLevel !== audio.waterLevel) audio.water.gain.setTargetAtTime(waterLevel,now,.15);
  audio.waterLevel = waterLevel;
  updateLiftSound(liftRemaining,carY);
  if (collapsed && !audio.rubble && audio.samples.rubble) {
    const gain = ctx.createGain(); gain.gain.value = soundLevel.rubble;
    loopSource(audio.samples.rubble).connect(gain); route(gain,tunnelFrames[collapseAt].center.clone().setY(1.2),3);
    audio.rubble = gain;
  }
  // Beds wait for their recordings: the first frames after Sound is enabled may come before them.
  if (!audio.bedsReady && audio.samples.ventilation && audio.samples.wind) { audio.bedsReady = true; updateBeds(); }
  if (collapsed && audio.bedsReady && audio.samples.birds && !audio.beds.birds) updateBeds();
}

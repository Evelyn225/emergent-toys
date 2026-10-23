// Event one-shots never wait for the network: warm the cache at unlock and retain
// synthesised fallbacks until ready. Loops start only from current simulation state.
const gameplayBuffers = {}, gameplayLoops = new Map(), gameplayShots = new Set();
let gameplayPreloaded = false;
function preloadGameplayAudio() {
  if (gameplayPreloaded) return;
  gameplayPreloaded = true;
  for (const [key, asset] of Object.entries(GAMEPLAY_AUDIO))
    clipBuffer(asset.file).then(buffer => { gameplayBuffers[key] = buffer; });
}
function gameplayAudioAllowed() {
  return actx?.state === 'running' && soundOn && settings.master > 0 && settings.effects > 0 && !paused && !freecam && !document.hidden;
}
function stopGameplayVoice(voice, fade = .02) {
  voice.source.onended = () => { for (const node of voice.nodes) node.disconnect(); };
  if (fade) {
    voice.gain.gain.cancelScheduledValues(actx.currentTime);
    voice.gain.gain.setTargetAtTime(0, actx.currentTime, .004);
  }
  voice.source.stop(actx.currentTime + fade);
}
function hushGameplayAudio() {
  for (const voice of gameplayLoops.values()) stopGameplayVoice(voice, 0);
  for (const voice of gameplayShots) stopGameplayVoice(voice, 0);
  gameplayLoops.clear(); gameplayShots.clear();
}
function playGameplayEffect(key, at, vol = 1, pan = 0, where = '') {
  const buffer = gameplayBuffers[key];
  if (!buffer) return false;
  if (!gameplayAudioAllowed()) return true; // Suppress the fallback while muted/frozen too.
  let cutoff = 16000;
  if (where === 'far') cutoff = 1100;
  else if (where === 'in') cutoff = 6500;
  const source = actx.createBufferSource(), gain = actx.createGain(), lp = filt('lowpass', cutoff), panner = actx.createStereoPanner();
  source.buffer = buffer; gain.gain.value = GAMEPLAY_AUDIO[key].gain * vol; panner.pan.value = pan;
  const owner = heldGun(), location = mode === 'room' ? room : null;
  const voice = { source, gain, nodes: [source, lp, gain, panner], valid: () =>
    (mode === 'room' ? room : null) === location && (key !== 'reload' || heldGun() === owner && gun.reload > 0) };
  chain(source, lp, gain, panner, sfxBus);
  source.onended = () => { for (const node of voice.nodes) node.disconnect(); gameplayShots.delete(voice); };
  if (gameplayShots.size >= 20) { const old = gameplayShots.values().next().value; stopGameplayVoice(old); gameplayShots.delete(old); }
  gameplayShots.add(voice); source.start(Math.max(actx.currentTime, at));
  return true;
}
function gameplayLoop(owner, key, volume, pan = 0, rate = 1, cutoff = 12000) {
  const buffer = gameplayBuffers[key];
  if (!buffer) return;
  let voice = gameplayLoops.get(owner);
  if (!voice) {
    const source = actx.createBufferSource(), gain = actx.createGain(), lp = filt('lowpass', cutoff), panner = actx.createStereoPanner();
    source.buffer = buffer; source.loop = true; gain.gain.value = 0;
    chain(source, lp, gain, panner, sfxBus);
    voice = { source, gain, lp, panner, nodes: [source, lp, gain, panner] };
    gameplayLoops.set(owner, voice); source.start();
  }
  const now = actx.currentTime;
  voice.gain.gain.setTargetAtTime(volume * GAMEPLAY_AUDIO[key].gain, now, .08);
  voice.panner.pan.setTargetAtTime(pan, now, .08);
  voice.source.playbackRate.setTargetAtTime(rate, now, .1);
  voice.lp.frequency.setTargetAtTime(cutoff, now, .1);
}
function tickGameplayAudio() {
  if (!gameplayAudioAllowed()) return hushGameplayAudio();
  const active = new Set();
  const cooking = game?.kind === 'cook' && !game.g.over ? game.g : null;
  if (cooking) {
    const heat = cooking.state().heat;
    if (heat > .35) { active.add(cooking); gameplayLoop(cooking, 'sizzle', clamp((heat - .2) / .8, 0, 1)); }
  }
  const helicopters = aircraft.filter(craft => PLANE_TYPES[craft.type].heli && craft.rotor > .02 && !craft.wrecked && !craft.ditched &&
    (mode === 'air' && craft === pilot || craft.state === 'abandoned'));
  if (heli) helicopters.push(heli);
  const [earX, earY] = audioWorldPosition(mode, room, px, py);
  let earZ = terrainHeight(earX, earY);
  if (mode === 'air' && pilot) earZ = pilot.z;
  else if (mode === 'roof') earZ = roofH;
  else if (mode === 'el' || mode === 'elplat') earZ = EL_TOP;
  for (const craft of helicopters) {
    const aboard = mode === 'air' && pilot === craft, spin = craft === heli ? 1 : craft.rotor;
    const rx = rel(craft.x - earX), ry = rel(craft.y - earY), height = craft.z - earZ;
    const distance = aboard ? 0 : Math.hypot(rx, ry, height);
    if (distance >= 40) continue;
    active.add(craft);
    const volume = spin ** 2 * (aboard ? .9 : clamp(1 - distance / 40, 0, 1) ** 2) * (mode === 'room' ? .15 : 1);
    const pan = aboard ? 0 : clamp((-Math.sin(a) * rx + Math.cos(a) * ry) / Math.max(1, distance), -.9, .9);
    let cutoff = 10000 / (1 + distance / 12);
    if (mode === 'room') cutoff = 800;
    else if (aboard) cutoff = 6500;
    gameplayLoop(craft, 'rotor', volume, pan, .45 + spin * .55, cutoff);
  }
  for (const [owner, voice] of gameplayLoops) if (!active.has(owner)) { stopGameplayVoice(voice); gameplayLoops.delete(owner); }
  for (const voice of gameplayShots) if (!voice.valid()) { stopGameplayVoice(voice); gameplayShots.delete(voice); }
}

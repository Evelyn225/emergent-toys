// Recorded PA, driven by actions and simulation transitions. Rendering never requests speech.
// A location/epoch guards both pending decodes and already scheduled AudioBufferSources.
let transitEpoch = 0, transitLocation = null, transitTime = null, transitObserved = null;
let transitQueue = [], transitVoice = null, transitLoading = false, transitBus = null;
let transitReminderAt = -Infinity;

function transitPlayerLocation() {
  if (mode === 'room' && (room?.kind === 'station' || room?.kind === 'train'))
    return { key: room.kind, owner: room };
  if (mode === 'el' && ride) return { key: 'el', owner: ride };
  if (mode === 'elplat') {
    const platform = elPlatformAt(px, py);
    if (platform) return { key: 'elplat:' + platform.tr, owner: platform.s };
  }
  return null;
}
function transitAudible() {
  return !!actx && actx.state === 'running' && soundOn && settings.master > 0 && settings.effects > 0 &&
    !paused && !freecam && !document.hidden;
}
function cancelTransitAnnouncements() {
  transitEpoch++;
  transitQueue = []; transitLoading = false;
  if (transitVoice) {
    for (const source of transitVoice.sources) { source.onended = null; source.stop(); source.disconnect(); }
    for (const node of transitVoice.nodes) node.disconnect();
    transitVoice = null;
  }
  transitLocation = transitTime = transitObserved = null;
}
function transitSameLocation(location) {
  const current = transitPlayerLocation();
  return current && location && current.key === location.key && current.owner === location.owner;
}
function transitSnapshot() {
  if (mode === 'el') return elRiding();
  if (mode === 'elplat') {
    const platform = elPlatformAt(px, py);
    return platform ? elTrains(T).find(t => t.tr === platform.tr &&
      (EL_STATIONS[t.station] === platform.s || EL_STATIONS[t.next] === platform.s)) : null;
  }
  // The platform train continues its existing cycle while a rider picks a destination.
  if (mode === 'room' && (room.kind === 'station' || room.kind === 'train' && room.dest == null)) {
    const phase = mod(T - room.t0, TRAIN_CYCLE);
    return { phase, cycle: Math.floor((T - room.t0) / TRAIN_CYCLE) };
  }
  return null;
}
function transitSync() {
  const location = transitPlayerLocation();
  if (!location || !transitAudible()) {
    if (transitLocation || transitVoice || transitLoading) cancelTransitAnnouncements();
    return false;
  }
  const changed = !transitSameLocation(transitLocation);
  const jumped = transitTime != null && (T < transitTime || T - transitTime > .25);
  if (changed || jumped) {
    cancelTransitAnnouncements();
    transitLocation = location;
    transitObserved = transitSnapshot();
    // Cache promises as well as decoded buffers. A failed fetch is cached as null.
    for (const group of Object.values(TRANSIT_ASSETS)) for (const asset of Object.values(group))
      if (asset.file) clipBuffer(asset.file);
  }
  transitTime = T;
  return !changed && !jumped;
}
function transitValid(item) {
  return item.epoch === transitEpoch && transitAudible() && transitSameLocation(item.location) &&
    T >= item.at && T - item.at <= item.maxAge && Math.abs(T - transitTime) <= .25 && item.relevant();
}
function transitAnnounce(phrase, station = null, relevant = () => true, maxAge = 5) {
  const files = transitFiles(phrase, station);
  if (!files || !transitLocation || !transitAudible()) return;
  transitQueue.push({ files, epoch: transitEpoch, location: transitLocation, at: T, maxAge, relevant });
  // Bounded queue: speech is local and timely, never an accumulating timetable backlog.
  if (transitQueue.length > 4) transitQueue.shift();
  transitPump();
}
function transitPABus() {
  if (transitBus) return transitBus;
  const hp = filt('highpass', TRANSIT_PA.highpass), presence = filt('peaking', TRANSIT_PA.presence, 1.2), lp = filt('lowpass', TRANSIT_PA.lowpass);
  presence.gain.value = TRANSIT_PA.presenceGain;
  chain(hp, presence, lp, sfxBus);
  const reflection = actx.createDelay(.1), reflectionGain = actx.createGain();
  reflection.delayTime.value = TRANSIT_PA.reflectionTime;
  reflectionGain.gain.value = TRANSIT_PA.reflectionGain;
  chain(lp, reflection, reflectionGain, sfxBus);
  transitBus = hp;
  return hp;
}
async function transitPump() {
  if (transitVoice || transitLoading) return;
  const item = transitQueue.shift();
  if (!item) return;
  if (!transitValid(item)) return transitPump();
  transitLoading = true;
  const buffers = await Promise.all(item.files.map(file => clipBuffer(file)));
  // An obsolete load must not clear the new location's loading flag or start its queue.
  if (item.epoch !== transitEpoch) return;
  transitLoading = false;
  if (!transitValid(item) || buffers.some(buffer => !buffer)) return transitPump();
  const voice = { sources: [], nodes: [] };
  transitVoice = voice;
  let when = actx.currentTime + TRANSIT_PA.lead;
  for (const buffer of buffers) {
    const source = actx.createBufferSource(), envelope = actx.createGain();
    source.buffer = buffer;
    const end = when + buffer.duration, fadeTime = Math.min(TRANSIT_PA.fade, buffer.duration / 4);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(TRANSIT_PA.gain, when + fadeTime);
    envelope.gain.setValueAtTime(TRANSIT_PA.gain, end - fadeTime);
    envelope.gain.linearRampToValueAtTime(0, end);
    source.connect(envelope); envelope.connect(transitPABus());
    voice.sources.push(source); voice.nodes.push(envelope);
    // Both halves use one AudioContext clock, regardless of frame rate or network timing.
    source.start(when); when = end + TRANSIT_PA.gap;
  }
  voice.sources[voice.sources.length - 1].onended = () => {
    for (const source of voice.sources) source.disconnect();
    for (const node of voice.nodes) node.disconnect();
    if (transitVoice === voice) { transitVoice = null; transitPump(); }
  };
}
function transitDirection(dir, reversal = false) {
  if (!dir) return;
  let phrase = dir > 0 ? 'east' : 'west';
  if (reversal) phrase = dir > 0 ? 'returnEast' : 'returnWest';
  transitAnnounce(phrase);
}
function transitSubwayDirection(from, to) {
  return Math.sign(stations[to].x - stations[from].x);
}
function transitBoarded() {
  transitSync();
  // Subway direction is unknown until its directly selected destination is known.
  const now = transitSnapshot();
  // Boarding inside the warning window still hears it, even if its threshold was crossed
  // on the platform. Keep the timetable and the destination picker unchanged.
  if (mode === 'el' && now.stopped && now.left <= TRANSIT_PA.doorsLead)
    transitAnnounce('doors', null, () => elRiding()?.stopped, 1);
  if (mode === 'room' && now?.phase >= 18 - TRANSIT_PA.doorsLead && now.phase < 18)
    transitAnnounce('doors', null, () => room?.kind === 'train' && room.dest == null, 1);
  if (mode === 'el') transitDirection(elRiding().dir);
}
function transitSubwayDeparted() {
  transitSync();
  const journey = room, dest = room.dest;
  transitDirection(transitSubwayDirection(room.st, dest));
  transitAnnounce('next', stations[dest].name, () => room === journey && room.dest === dest);
}
function transitSubwayArrived() {
  transitSync();
  transitAnnounce('arrival', stations[room.st].name);
  transitReminder('belongings');
}
function transitReminder(phrase) {
  if (T - transitReminderAt < 60) return;
  transitReminderAt = T;
  transitAnnounce(phrase, null, () => true, 4);
}
function stepTransitAnnouncements() {
  if (!transitSync()) return;
  const before = transitObserved, now = transitSnapshot();
  transitObserved = now;
  if (!before || !now) return;
  if (mode === 'el' || mode === 'elplat') {
    const aboard = mode === 'el';
    const platform = aboard ? null : elPlatformAt(px, py);
    const atPlatform = aboard || EL_STATIONS[now.station] === platform?.s;
    if (now.stopped && atPlatform && before.stopped && before.left > TRANSIT_PA.doorsLead && now.left <= TRANSIT_PA.doorsLead) {
      const tr = aboard ? ride.tr : platform.tr, k = aboard ? ride.k : now.k;
      transitAnnounce('doors', null, () => {
        const t = elTrain(tr, k, T);
        return t.stopped && t.station === now.station;
      }, 1);
    }
    if (!now.stopped && before.stopped && aboard) {
      const train = ride;
      transitAnnounce('next', EL_STATIONS[now.next].name, () => {
        const t = elTrain(train.tr, train.k, T);
        return !t.stopped && t.next === now.next;
      });
    }
    if (now.stopped && (!before.stopped || before.station !== now.station) && atPlatform) {
      transitAnnounce('arrival', EL_STATIONS[now.station].name);
      if (aboard && before.dir !== now.dir) transitDirection(now.dir, true);
      if (!aboard) transitReminder('alight');
    }
  } else if (before.cycle === now.cycle) {
    if (before.phase < 6 && now.phase >= 6 && room.kind === 'station') transitReminder('alight');
    if (before.phase < 18 - TRANSIT_PA.doorsLead && now.phase >= 18 - TRANSIT_PA.doorsLead) {
      const stationRoom = room;
      transitAnnounce('doors', null, () => room === stationRoom && mod(T - room.t0, TRAIN_CYCLE) < 18, 1);
    }
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelTransitAnnouncements(); });

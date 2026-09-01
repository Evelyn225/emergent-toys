// ─────────────────────────────────────────────────────────────────
// SYSTEM AUDIO
// ─────────────────────────────────────────────────────────────────
// One AudioContext for the whole OS, chosen over <audio> elements for three
// reasons that all show up in this codebase:
//
//   - The Settings volume is one assignment on a master gain node, not a walk
//     over every element that happens to be playing.
//   - ctx.suspend() silences everything on tab-hide in a single call, with no
//     bookkeeping about what was mid-playback and no restart glitch on the way
//     back. Scheduled times are expressed against ctx.currentTime, which stops
//     advancing while suspended, so a loop resumes exactly where it froze.
//   - Overlapping one-shots (a click during a glitch, two clicks in 40ms) come
//     free. HTMLAudioElement restarts the single element instead, so the usual
//     workaround is cloneNode per shot.
//
// The context cannot exist before a user gesture: browsers create it suspended
// and refuse to resume it. Every entry point here is therefore a no-op until
// unlockSystemAudio() has run, and no caller has to check - playSound and
// startSoundLoop are safe to call at any time, including during boot, and
// startSoundLoop remembers the request so the loop begins at the first click.

const SOUND_DIR = 'os/sounds/';
const SOUND_FILES = {
  ambience: 'computerAmbience.ogg',
  boot:     'win95Start.ogg',
  shutdown: 'ShutdownJingle.ogg',
  defrag:   'defrag.ogg',
  error:    'error.ogg',
  glitch:   'glitch.ogg',
  click:    'mouseClick.ogg',
};

// Per-sound trim, so the mix lives in one table instead of being spread across
// call sites. These multiply the master volume from Settings. The ambience is
// deliberately far below everything else: it plays for the whole session and
// is meant to sit under the OS, not in front of it.
const SOUND_GAIN = {
  ambience: 0.40,
  boot:     0.75,
  shutdown: 0.75,
  defrag:   0.40,
  error:    0.65,
  glitch:   0.50,
  click:    0.30,
};

// defrag.ogg does not loop seamlessly and a slow run can outlast its ~1 minute,
// so its tail is overlapped with its head by this much. Long enough to bury the
// discontinuity in drive chatter, short enough that the overlap is not heard as
// a doubling. A seam-matched source file would let this drop to 0 and use the
// seamless path below instead.
const DEFRAG_CROSSFADE_SEC = 0.35;
// The monitor sleeps; the machine does not. Ambience drops to this while the
// idle-sleep overlay is up rather than stopping.
const AMBIENCE_SLEEP_DUCK = 0.3;
// exponentialRampToValueAtTime cannot reach or cross zero.
const GAIN_FLOOR = 0.0001;
const DEFAULT_SOUND_VOLUME = 0.6;
// How long the master takes to reach silence before the context is suspended
// on tab-hide, and to come back after it resumes. Long enough that the output
// lands on silence instead of stepping to it, short enough that a quick flick
// to another tab and back does not sound like a fade effect.
const HIDE_FADE_SEC = 0.18;

let audioCtx = null;
let audioMaster = null;
let audioUnlocked = false;
let audioSuspendedByHide = false;
let audioHideFadeTimer = null;
let systemAudioInited = false;
const audioBuffers = new Map();
const audioLoads = new Map();
// name -> { volume, crossfade, duck, active, buffer, gain, passes:Set, nextStart }
const audioLoops = new Map();

function systemAudioEnabled() {
  return osSettings.sounds !== false;
}

function getSystemVolume() {
  const v = Number(osSettings.soundVolume);
  if (!Number.isFinite(v)) return DEFAULT_SOUND_VOLUME;
  return Math.max(0, Math.min(1, v));
}

function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch (e) {
    return null;
  }
  audioMaster = audioCtx.createGain();
  audioMaster.gain.value = masterTargetGain();
  audioMaster.connect(audioCtx.destination);
  return audioCtx;
}

// Called from the gesture listeners at the bottom of this file, and again by
// them if a resume() was ever rejected, so a revoked activation heals on the
// next click instead of leaving the OS permanently silent.
function unlockSystemAudio() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (audioUnlocked && ctx.state === 'running') return;
  if (ctx.state === 'running') { markAudioUnlocked(); return; }
  ctx.resume().then(markAudioUnlocked).catch(() => {});
}

function markAudioUnlocked() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  audioUnlocked = true;
  // Loops asked for before the first gesture - the desktop ambience starts
  // during boot - have been waiting on exactly this.
  audioLoops.forEach((entry, name) => { if (entry.active) primeLoop(name, entry); });
}

function loadSound(name) {
  if (audioBuffers.has(name)) return Promise.resolve(audioBuffers.get(name));
  const pending = audioLoads.get(name);
  if (pending) return pending;
  const file = SOUND_FILES[name];
  const ctx = ensureAudioContext();
  if (!file || !ctx) return Promise.resolve(null);
  const load = fetch(SOUND_DIR + file)
    .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer(); })
    .then(data => ctx.decodeAudioData(data))
    .then(buffer => { audioBuffers.set(name, buffer); return buffer; })
    .catch(() => {
      // A missing or undecodable sound must never break the thing it decorates.
      // Forgetting the rejection lets a later call retry rather than caching
      // the failure for the rest of the session.
      audioLoads.delete(name);
      return null;
    });
  audioLoads.set(name, load);
  return load;
}

// Fire-and-forget one-shot. `volume` is a multiplier on the sound's entry in
// SOUND_GAIN, for callers that vary intensity (see triggerGlitch).
//
// Returns a promise resolving to how many milliseconds the sound will play for,
// or 0 if it did not play at all - for callers that need to sequence something
// after it, like the shutdown flow holding the screen until the jingle is done.
// Nearly every caller ignores it.
//
// It resolves when playback STARTS, not when it ends, and that is deliberate:
// an `ended` event never arrives if a tab switch suspends the context mid-sound,
// so a caller awaiting the end could wait forever. Resolving with the duration
// up front lets the caller decide its own deadline against the wall clock.
function playSound(name, options = {}) {
  if (!audioUnlocked || !systemAudioEnabled() || document.hidden) return Promise.resolve(0);
  const scale = Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1;
  return loadSound(name).then(buffer => {
    // Re-checked after the decode: on the very first play of a sound this
    // resolves a frame or more later, by which time the tab may be hidden or
    // the user may have switched sound off.
    if (!buffer || !audioUnlocked || !systemAudioEnabled() || document.hidden) return 0;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = Math.max(0, (SOUND_GAIN[name] ?? 0.5) * scale);
    src.connect(gain);
    gain.connect(audioMaster);
    src.onended = () => { try { src.disconnect(); gain.disconnect(); } catch (e) {} };
    src.start();
    return Math.round(buffer.duration * 1000);
  });
}

// Idempotent: calling this on an already-running loop does nothing, so a
// caller does not have to track whether it already started one.
function startSoundLoop(name, options = {}) {
  let entry = audioLoops.get(name);
  if (!entry) {
    entry = {
      volume: SOUND_GAIN[name] ?? 0.5,
      crossfade: 0,
      duck: 1,
      active: false,
      buffer: null,
      gain: null,
      passes: new Set(),
      nextStart: 0,
    };
    audioLoops.set(name, entry);
  }
  // Re-read on every start rather than only at creation. The entry outlives the
  // loop - stopping keeps it so `duck` survives - and reading the option once
  // would mean the second start of a sound silently used the first one's
  // scheduling mode.
  if ('crossfade' in options) entry.crossfade = Math.max(0, Number(options.crossfade) || 0);
  if (entry.active) return;
  entry.active = true;
  primeLoop(name, entry);
}

function stopSoundLoop(name, options = {}) {
  const entry = audioLoops.get(name);
  if (!entry) return;
  entry.active = false;
  stopLoopPasses(entry, Math.max(0, Number(options.fade) || 0));
}

function primeLoop(name, entry) {
  if (!audioUnlocked || !systemAudioEnabled()) return;
  if (entry.passes.size) return;
  loadSound(name).then(buffer => {
    // Same re-check as playSound: the first prime waits on a decode, and the
    // loop may have been stopped in the meantime.
    if (!buffer || !entry.active || !audioUnlocked || !systemAudioEnabled()) return;
    if (entry.passes.size) return;
    entry.buffer = buffer;

    if (!entry.gain) {
      entry.gain = audioCtx.createGain();
      entry.gain.connect(audioMaster);
    }
    // Always reset: a previous stop may have left this ramped down to the floor.
    const now = audioCtx.currentTime;
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(Math.max(GAIN_FLOOR, entry.volume * entry.duck), now);

    if (!entry.crossfade) {
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(entry.gain);
      entry.passes.add(src);
      src.start();
      return;
    }

    // Crossfaded loop. Two passes are queued up front and every pass queues the
    // one two ahead of it when it ends. Chaining a single pass on `ended` would
    // always be late by exactly the crossfade length, because pass N+1 has to
    // START before pass N finishes - so the schedule runs one pass deep. With a
    // one-minute file and a 350ms overlap that is ~59 seconds of lead, and it
    // needs no timers: setTimeout is throttled in a background tab, while
    // buffer sources are scheduled against ctx.currentTime, which is frozen for
    // exactly as long as the context is suspended.
    entry.nextStart = audioCtx.currentTime + 0.02;
    queueLoopPass(entry);
    queueLoopPass(entry);
  });
}

function queueLoopPass(entry) {
  const buffer = entry.buffer;
  if (!buffer) return;
  const fade = Math.min(entry.crossfade, buffer.duration / 3);
  const at = entry.nextStart;
  entry.nextStart = at + Math.max(0.05, buffer.duration - fade);

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  src.connect(gain);
  gain.connect(entry.gain);

  // Equal-gain in and out across the overlap. The pass envelope peaks at 1 and
  // entry.gain carries the trim, so volume and ducking stay one node away from
  // the scheduling.
  gain.gain.setValueAtTime(GAIN_FLOOR, at);
  gain.gain.exponentialRampToValueAtTime(1, at + fade);
  gain.gain.setValueAtTime(1, at + buffer.duration - fade);
  gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, at + buffer.duration);

  // So stopLoopPasses can tear the pair down without closing over this scope.
  src._passGain = gain;
  entry.passes.add(src);
  src.onended = () => {
    entry.passes.delete(src);
    try { src.disconnect(); gain.disconnect(); } catch (e) {}
    if (entry.active && audioUnlocked && systemAudioEnabled()) queueLoopPass(entry);
  };
  src.start(at);
}

// Tears down the sources without clearing `active`, so the caller decides
// whether this is a stop or a pause that should re-prime later.
function stopLoopPasses(entry, fadeSec) {
  const passes = [...entry.passes];
  entry.passes.clear();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  if (entry.gain && fadeSec > 0) {
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(Math.max(GAIN_FLOOR, entry.gain.gain.value), now);
    entry.gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, now + fadeSec);
  }
  passes.forEach(src => {
    // Replaced, not dropped, and the disconnect happens in it rather than
    // here: the handler being replaced is the one that queues the next pass,
    // and a stop must not schedule more audio on its way out - but
    // disconnecting a node that is still fading cuts it dead and there is no
    // fade left to hear.
    src.onended = () => {
      try { src.disconnect(); } catch (e) {}
      try { if (src._passGain) src._passGain.disconnect(); } catch (e) {}
    };
    try { fadeSec > 0 ? src.stop(now + fadeSec) : src.stop(); } catch (e) {}
  });
}

// Ramps a running loop to `factor` of its normal level and keeps it there.
// The factor is remembered, so a loop ducked while stopped comes back ducked.
function duckSoundLoop(name, factor, seconds = 0.6) {
  const entry = audioLoops.get(name);
  if (!entry) return;
  entry.duck = Math.max(0, Math.min(1, Number(factor) || 0));
  if (!entry.gain || !audioCtx) return;
  const now = audioCtx.currentTime;
  entry.gain.gain.cancelScheduledValues(now);
  entry.gain.gain.setValueAtTime(Math.max(GAIN_FLOOR, entry.gain.gain.value), now);
  entry.gain.gain.exponentialRampToValueAtTime(
    Math.max(GAIN_FLOOR, entry.volume * entry.duck), now + Math.max(0.01, seconds));
}

// Where the master gain belongs right now. Floored rather than allowed to
// reach a true zero: every ramp here is exponential, and an exponential ramp
// cannot start from or cross zero - parking the master at exactly 0 would mean
// the next fade back up did nothing at all. GAIN_FLOOR is -80dB, so the
// difference from silence is not a thing anyone can hear.
function masterTargetGain() {
  return Math.max(GAIN_FLOOR, systemAudioEnabled() ? getSystemVolume() : 0);
}

function rampMasterTo(target, seconds) {
  if (!audioCtx || !audioMaster) return;
  const now = audioCtx.currentTime;
  const gain = audioMaster.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(GAIN_FLOOR, gain.value), now);
  gain.exponentialRampToValueAtTime(Math.max(GAIN_FLOOR, target), now + Math.max(0.01, seconds));
}

// Called by applySettings whenever osSettings changes, from either the
// Settings window or REGEDIT.
function applySystemAudioSettings() {
  const enabled = systemAudioEnabled();
  // Ramped rather than assigned: a step change on a gain node is an audible
  // click, which is a poor sound for the control that turns sound off. Skipped
  // while hidden, where the master is parked at the floor by the visibility
  // handler below - the new level is picked up by the fade back in.
  if (!document.hidden) rampMasterTo(masterTargetGain(), 0.08);
  // Muting is not enough for the loops: a silent ambience would keep a decoder
  // running for the rest of the session. They are torn down and re-primed.
  audioLoops.forEach((entry, name) => {
    if (!entry.active) return;
    if (enabled) primeLoop(name, entry);
    else stopLoopPasses(entry, 0.08);
  });
}

// Which chrome clicks: buttons, menu entries, icons and titlebar controls.
// Deliberately not text fields, window bodies, the bare desktop, or drags -
// a click on every pointerdown is authentic for about ninety seconds and
// unbearable after that.
const CLICK_SOUND_SELECTOR = [
  '#start-btn',
  '.sm-item',
  '.taskbar-btn',
  '.desktop-icon',
  '.dlg-btn',
  '.win-btn',
  '.menu-item',
  '.menu-dd-item:not(.disabled)',
  '.st-toggle',
  '.cad-action',
  '.vp-btn',
].join(',');

function initSystemAudio() {
  if (systemAudioInited) return;
  systemAudioInited = true;
  // Capture phase: several apps stopPropagation on their own menu handling,
  // and the click feedback should not depend on which of them do.
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const target = e.target instanceof Element ? e.target.closest(CLICK_SOUND_SELECTOR) : null;
    if (!target || target.disabled) return;
    playSound('click');
  }, true);
  initTraySound();
}

// ── The volume block meter ────────────────────────────────────────
// Lives here rather than in the Settings window that used to own it, because
// there are two of these now: the Settings row and the tray flyout. The drag
// maths is the fiddly part (see `preview` below) and two copies of it would be
// two things to keep in step, which is how this codebase ended up with three
// lists of the same programs once already.
const VOL_BLOCKS = 10;

// Quantised to the blocks that are actually drawn: clicking a block should
// land on that block, not on a continuous value that rounds to its neighbour.
function setVolumeStep(step) {
  const clamped = Math.max(0, Math.min(VOL_BLOCKS, step));
  osSettings.soundVolume = clamped / VOL_BLOCKS;
  // Dragging a muted slider upwards unmutes, the way every OS mixer does.
  if (clamped > 0 && !osSettings.sounds) osSettings.sounds = true;
}

// Returns the render function, so a caller that has its own refresh pass can
// redraw the meter without knowing how it is drawn.
function mountVolumeBlocks(el) {
  if (!el) return () => {};
  let dragging = false;

  function render() {
    const filled = systemAudioEnabled() ? Math.round(getSystemVolume() * VOL_BLOCKS) : 0;
    el.innerHTML =
      `<span style="color:#000080">${'&#9632;'.repeat(filled)}</span>` +
      `<span style="color:#6a6a6a">${'&#9643;'.repeat(VOL_BLOCKS - filled)}</span>`;
    el.classList.toggle('off', !systemAudioEnabled());
    el.setAttribute('aria-valuenow', String(Math.round(getSystemVolume() * 100)));
  }

  // Live during a drag, but nothing is written to disk until the pointer is
  // released - saveSettings and saveRegistry both hit localStorage, and
  // pointermove fires at frame rate.
  function preview(clientX) {
    // Measured against the content box, not the border box: the blocks are
    // drawn inside 2px of bevel and 6px of padding, and mapping the pointer
    // across the full width would land a click a block away from the one it
    // was aimed at near either end.
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const inset = n => parseFloat(cs.getPropertyValue(n)) || 0;
    const left = r.left + inset('border-left-width') + inset('padding-left');
    const width = Math.max(1, r.width - inset('border-left-width') - inset('border-right-width')
                                      - inset('padding-left') - inset('padding-right'));
    setVolumeStep(Math.round(((clientX - left) / width) * VOL_BLOCKS));
    applySystemAudioSettings();
    render();
  }

  function commit() {
    saveSettings();
    applySettings();
    playSound('click');
  }

  // Pointer capture instead of document-level move/up listeners: those would
  // outlive the window and stack up one pair per Settings open.
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    preview(e.clientX);
  });
  el.addEventListener('pointermove', e => { if (dragging) preview(e.clientX); });
  el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    commit();
  });
  el.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    commit();
  });
  el.addEventListener('keydown', e => {
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1
              : (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    setVolumeStep(Math.round(getSystemVolume() * VOL_BLOCKS) + dir);
    commit();
  });

  render();
  return render;
}

// ── The tray speaker ──────────────────────────────────────────────
// The ambience starts itself at the first click of the session, and until this
// existed the only way to stop it was Start > Settings > a toggle two levels
// in. One click is where a mute belongs.
let traySoundRender = null;

function traySoundFlyoutEl() {
  let el = document.getElementById('tray-volume');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'tray-volume';
  el.innerHTML =
    '<div id="tray-volume-label">Volume</div>' +
    '<div class="st-vol vp-vol-blocks" id="tray-volume-blocks" role="slider" tabindex="0"' +
    ' aria-label="System volume" aria-valuemin="0" aria-valuemax="100"></div>' +
    '<button class="st-toggle" type="button" id="tray-volume-mute"></button>';
  document.body.appendChild(el);
  return el;
}

function isTraySoundFlyoutOpen() {
  const el = document.getElementById('tray-volume');
  return !!el && el.classList.contains('open');
}

function closeTraySoundFlyout() {
  const el = document.getElementById('tray-volume');
  if (el) el.classList.remove('open');
  const btn = document.getElementById('tray-sound');
  if (btn) btn.classList.remove('open');
}

function openTraySoundFlyout() {
  const btn = document.getElementById('tray-sound');
  if (!btn) return;
  const el = traySoundFlyoutEl();
  // A context menu open elsewhere would sit above this at its own z-index.
  closeDropdown();
  el.classList.add('open');
  btn.classList.add('open');
  renderTraySound();
  // Measured after it is displayed - a flyout still in display:none has no box
  // to anchor against. Right-aligned to the button and clamped to the viewport,
  // because the tray sits hard against the right edge on a desktop and the
  // panel is wider than the 16px icon it hangs from.
  //
  // Vertically it anchors to the TASKBAR's top edge, not the button's: the
  // button sits a few pixels inside the bar, so hanging the flyout off it
  // leaves those pixels of taskbar covered. Same reasoning as showCtxMenu's
  // anchorBottom option, which the taskbar's own menu uses.
  const r = btn.getBoundingClientRect();
  const bar = document.getElementById('taskbar');
  const barTop = bar ? bar.getBoundingClientRect().top : r.top;
  const box = el.getBoundingClientRect();
  el.style.left = Math.max(4, Math.min(window.innerWidth - box.width - 4,
                                       r.right - box.width)) + 'px';
  el.style.top = Math.max(0, barTop - box.height) + 'px';
  // Deferred past the click that opened it, or that same click closes it.
  setTimeout(() => {
    document.addEventListener('pointerdown', onTraySoundOutside, true);
  }, 0);
}

function onTraySoundOutside(e) {
  const el = document.getElementById('tray-volume');
  const btn = document.getElementById('tray-sound');
  if (el && el.contains(e.target)) return;
  if (btn && btn.contains(e.target)) return;
  document.removeEventListener('pointerdown', onTraySoundOutside, true);
  closeTraySoundFlyout();
}

function toggleTraySoundFlyout() {
  if (isTraySoundFlyoutOpen()) {
    document.removeEventListener('pointerdown', onTraySoundOutside, true);
    closeTraySoundFlyout();
  } else {
    openTraySoundFlyout();
  }
}

// Called by applySettings, so the icon follows a change made from REGEDIT or
// the Settings window as well as one made here.
function renderTraySound() {
  const btn = document.getElementById('tray-sound');
  if (btn) {
    const on = systemAudioEnabled();
    setIconContent(btn, on ? 'icon:sound' : 'icon:sound-mute');
    const label = on ? 'System volume ' + Math.round(getSystemVolume() * 100) + '%' : 'Sound muted';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', on ? 'false' : 'true');
  }
  const mute = document.getElementById('tray-volume-mute');
  if (mute) {
    const muted = !systemAudioEnabled();
    mute.textContent = muted ? 'Unmute' : 'Mute';
    mute.classList.toggle('on', muted);
  }
  if (traySoundRender) traySoundRender();
}

function toggleSystemMute() {
  osSettings.sounds = !systemAudioEnabled();
  // Unmuting a slider someone had dragged to zero would be silent, which reads
  // as the button not working.
  if (osSettings.sounds && getSystemVolume() <= 0) osSettings.soundVolume = DEFAULT_SOUND_VOLUME;
  saveSettings();
  applySettings();
  if (systemAudioEnabled()) playSound('click');
}

function initTraySound() {
  const btn = document.getElementById('tray-sound');
  if (!btn) return;
  // Left click mutes, because that is the one thing worth a single click.
  // Anything more deliberate than that - setting a level - is the flyout, on
  // right-click and on long-press, where the rest of the OS puts its menus.
  btn.addEventListener('click', () => {
    // A long press has already opened the flyout and a button still emits its
    // click afterwards, which would mute at the same time. Same guard the
    // desktop icons use, and the same place it is cleared.
    if (_longPressActive) { _longPressActive = false; return; }
    toggleSystemMute();
  });
  // stopPropagation matters as much as preventDefault here: wmInstallTaskbarMenu
  // binds contextmenu on #taskbar and this button is inside it, so without this
  // a right-click opens the taskbar's Cascade/Tile menu ON TOP of the flyout -
  // the flyout is there, correctly positioned, with a menu covering it.
  btn.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    toggleTraySoundFlyout();
  });
  addLongPress(btn);
  traySoundRender = mountVolumeBlocks(traySoundFlyoutEl().querySelector('#tray-volume-blocks'));
  document.getElementById('tray-volume-mute')
    .addEventListener('click', () => { toggleSystemMute(); });
  renderTraySound();
}

// The whole point of the Web Audio path: one call stops everything, including
// mid-flight one-shots and both kinds of loop, and resuming picks up where it
// left off because ctx.currentTime did not advance while suspended.
//
// It cannot be that one call on its own, though. ctx.suspend() halts the graph
// wherever the waveform happens to be, and a step from that sample straight to
// silence is, precisely, a click - the ambience is a continuous hum, so it is
// essentially never near a zero crossing at the moment a tab is switched.
// Resuming does the same in reverse. So the master is faded to the floor first
// and the context suspended only once that fade has been rendered, and on the
// way back the context is resumed while still silent and faded up after.
document.addEventListener('visibilitychange', () => {
  if (!audioCtx) return;
  clearTimeout(audioHideFadeTimer);
  audioHideFadeTimer = null;

  if (document.hidden) {
    if (audioCtx.state !== 'running') return;
    audioSuspendedByHide = true;
    rampMasterTo(GAIN_FLOOR, HIDE_FADE_SEC);
    // Background tabs clamp setTimeout to about a second, so this can land
    // well after the fade it is waiting on. That is harmless: the fade is
    // scheduled on the AudioParam and rendered by the audio thread on time
    // regardless of what the timer does, so a late suspend costs a moment of
    // silent processing. An early one costs the click this exists to remove.
    audioHideFadeTimer = setTimeout(() => {
      audioHideFadeTimer = null;
      if (document.hidden && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
    }, HIDE_FADE_SEC * 1000 + 40);
    return;
  }

  if (!audioSuspendedByHide) return;
  audioSuspendedByHide = false;
  // Back before the timer fired: the context never stopped, so only the fade
  // needs reversing.
  if (audioCtx.state === 'running') { rampMasterTo(masterTargetGain(), HIDE_FADE_SEC); return; }
  // Resume first, fade second. Ramps are scheduled against ctx.currentTime,
  // which is frozen until the resume resolves.
  //
  // May be rejected if the browser has since dropped this page's activation.
  // unlockSystemAudio re-checks ctx.state on the next gesture, so the failure
  // costs one click rather than the session - but the master would be left at
  // the floor, so it is restored on that path too.
  audioCtx.resume()
    .then(() => rampMasterTo(masterTargetGain(), HIDE_FADE_SEC))
    .catch(() => rampMasterTo(masterTargetGain(), HIDE_FADE_SEC));
});

// Registered at load, not from initSystemAudio: clicking through the BIOS
// screen has to count as the unlocking gesture, or the startup jingle that
// plays right after it would be blocked.
['pointerdown', 'keydown', 'touchstart'].forEach(type => {
  document.addEventListener(type, unlockSystemAudio, { capture: true, passive: true });
});

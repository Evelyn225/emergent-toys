// ===== pause menu: Esc (or the mouse lock being released). Freezes the game, fades the sound, and holds the
// settings, which apply as you change them and are kept in localStorage.
const DETAIL = { high: 10, medium: 12, low: 15 }; // character size in px: bigger characters, fewer of them, faster
let pauseEl = null;
const GLYPHPORT_DESKTOP_APP = Boolean(window.__GLYPHPORT_DESKTOP__);
let desktopFullscreen = false, desktopFullscreenBusy = false;
let desktopQuitting = false;
async function quitDesktopGame() {
  if (!NATIVE_MOUSE_APP || desktopQuitting) return;
  desktopQuitting = true;
  saveGame();
  releaseMouse();
  try {
    await desktopMouseCommands.catch(() => {});
    await window.__TAURI__.core.invoke('quit_game');
  } catch (error) {
    desktopQuitting = false;
    say('Could not quit the app. You can close its window.', 4);
  }
}
async function toggleDesktopFullscreen() {
  if (!NATIVE_MOUSE_APP || desktopFullscreenBusy) return;
  desktopFullscreenBusy = true;
  try {
    desktopFullscreen = await window.__TAURI__.core.invoke('toggle_game_fullscreen');
    // Refresh confinement after the window's bounds change.
    if (paused) releaseMouse();
    else if (mouseCaptured()) lockMouse();
  } catch (error) {
    say('Could not change fullscreen. Please update the Windows app.', 4);
  } finally {
    desktopFullscreenBusy = false;
    if (pauseEl) pauseEl.show();
  }
}
const MOBILE_BROWSER = navigator.userAgentData?.mobile || /Android|iPhone|iPod|iPad|Mobile/i.test(navigator.userAgent) ||
  (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function applySettings() {
  FOV = settings.fov * Math.PI / 180;
  if (DETAIL[settings.detail] !== FS) { FS = DETAIL[settings.detail]; resize(); }
  applyVolumes();
}

function buildPause() {
  const slider = (k, label, min, max, step) => `<label class="row"><span>${label}</span><span class="slider"><span class="bar" data-bar="${k}"></span><input type="range" min="${min}" max="${max}" step="${step}" data-set="${k}" aria-label="${label}"></span><span data-show="${k}"></span></label>`;
  const toggle = (k, label) => `<div class="row"><span>${label}</span><button class="tog" data-toggle="${k}"></button><span></span></div>`;
  const el = menuEl('pause', 500, `
    <div class="panel" role="dialog" aria-label="Paused" style="width: min(520px, calc(100vw - 32px))">
      <h1>Paused</h1>
      <p class="sub">Glyphport</p>
      <button class="item" data-act="resume">Resume</button>
      <button class="item" data-act="controls">Controls <span class="k" style="margin-left:auto">reference</span></button>
      <button class="item" data-act="map">Map of the city</button>
      <button class="item" data-act="multiplayer">Multiplayer <span class="k" data-net-badge style="margin-left:auto"></span></button>
      <button class="item" data-act="cancel-courier" style="display:none">Cancel courier delivery</button>
      <button class="item" data-act="cancel-fare" style="display:none">Cancel this fare</button>
      <button class="item" data-act="newgame">Start over</button>
      <button class="item" data-act="dev">Dev tools <span class="k" style="margin-left:auto">F2</span></button>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="item" data-act="screenshot" style="width:auto;flex:1">Take screenshot <span class="k" style="margin-left:auto">F12</span></button>
        <button class="item" data-act="screenshot-folder" style="width:auto;display:${GLYPHPORT_DESKTOP_APP ? 'flex' : 'none'}">Open screenshot folder</button>
      </div>
      <p class="sub">${GLYPHPORT_DESKTOP_APP ? 'Saved as PNGs in Screenshots beside the game executable.' : 'Screenshots download as PNGs.'}</p>
      <a class="item" data-desktop-download href="https://github.com/Evelyn225/emergent-toys/releases/latest/download/Glyphport-Setup.exe" target="_blank" rel="noopener" style="display:${!GLYPHPORT_DESKTOP_APP && !MOBILE_BROWSER ? 'flex' : 'none'}">Download Windows app <span class="k" style="margin-left:auto">desktop</span></a>
      <button class="item" data-act="fullscreen" style="display:${GLYPHPORT_DESKTOP_APP ? 'flex' : 'none'}">Fullscreen <span class="k" style="margin-left:auto">F11</span></button>
      <button class="item" data-act="update" style="display:${GLYPHPORT_DESKTOP_APP ? 'flex' : 'none'}">Check for updates</button>
      <p class="sub" data-update-status style="display:${GLYPHPORT_DESKTOP_APP ? 'block' : 'none'}"></p>
      <h2>sound</h2>
      ${slider('master', 'Master', 0, 1, 0.05)}${slider('music', 'Music', 0, 1, 0.05)}${slider('ambience', 'Ambience', 0, 1, 0.05)}${slider('effects', 'Effects', 0, 1, 0.05)}
      <h2>view</h2>
      ${slider('fov', 'Field of view', 50, 120, 1)}
      ${slider('lod', 'Detail distance', 0.5, 3, 0.1)}
      ${slider('tripVisuals', 'Drug visuals', 0, 1, 0.05)}
      <div class="row"><span>Detail</span><div class="opts">${Object.keys(DETAIL).map(d => `<button class="opt" data-detail="${d}">${d}</button>`).join('')}</div><span></span></div>
      ${toggle('help', 'Help line')}
      <h2>mouse</h2>
      ${slider('sensitivity', 'Sensitivity', 0.25, 3, 0.05)}
      ${toggle('invertY', 'Invert Y')}
      <h2>controller</h2>
      ${slider('controllerDeadzone', 'Stick dead zone', .05, .35, .01)}
      ${slider('controllerLook', 'Look speed', .25, 3, .05)}
      ${slider('controllerSteering', 'Steering response', .5, 2, .1)}
      ${toggle('controllerInvertY', 'Invert controller look')}
      ${toggle('controllerVibration', 'Controller vibration')}

      <h2></h2>
      ${GLYPHPORT_DESKTOP_APP ? '<button class="item" data-act="quit">Quit game</button>' : '<a class="item" href="index.html">Quit to Eve Net</a>'}
    </div>`);
  const show = () => {
    const fullscreen = el.querySelector('[data-act="fullscreen"]');
    fullscreen.firstChild.textContent = desktopFullscreen ? 'Exit fullscreen ' : 'Fullscreen ';
    fullscreen.disabled = desktopFullscreenBusy;
    if (GLYPHPORT_DESKTOP_APP) showDesktopUpdate(el);
    // the jobs you're on, to call off: only while there's one
    el.querySelector('[data-act="cancel-courier"]').style.display = courierJob ? 'flex' : 'none';
    const fare = el.querySelector('[data-act="cancel-fare"]');
    fare.style.display = job && (job.ride || job.hail) ? 'flex' : 'none';
    fare.firstChild.textContent = job && job.ride ? 'Cancel this fare (let them out, find another)' : 'Cancel this pickup (find another fare)';
    el.querySelector('[data-net-badge]').textContent = net.on ? `${net.code}, ${net.peers.size + 1} here` : '';
    for (const inp of el.querySelectorAll('[data-set]')) inp.value = settings[inp.dataset.set];
    for (const s of el.querySelectorAll('[data-show]')) {
      const k = s.dataset.show, v = settings[k];
      s.textContent = k === 'fov' ? v + '°' : k === 'sensitivity' ? v.toFixed(2) + 'x' : k === 'lod' ? (+v).toFixed(1) + 'x' : Math.round(v * 100) + '%';
    }
    for (const b of el.querySelectorAll('[data-bar]')) {
      const inp = el.querySelector(`[data-set="${b.dataset.bar}"]`), lo = +inp.min, hi = +inp.max;
      b.innerHTML = asciiBar((settings[b.dataset.bar] - lo) / (hi - lo));
    }
    for (const b of el.querySelectorAll('[data-toggle]')) b.textContent = settings[b.dataset.toggle] ? '[x] on' : '[ ] off';
    for (const b of el.querySelectorAll('[data-detail]')) b.classList.toggle('on', b.dataset.detail === settings.detail);
  };
  el.addEventListener('input', e => {
    const k = e.target.dataset.set;
    if (!k) return;
    settings[k] = +e.target.value;
    saveSettings(); applySettings(); show();
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'fullscreen') toggleDesktopFullscreen();
    if (b.dataset.act === 'screenshot') takeScreenshot();
    if (b.dataset.act === 'screenshot-folder') openScreenshotFolder();
    if (b.dataset.act === 'update') desktopUpdateAction();
    if (b.dataset.act === 'quit') quitDesktopGame();
    if (b.dataset.act === 'controls') openControls();
    if (b.dataset.act === 'resume') closePause(true);
    if (b.dataset.act === 'dev') openDev();
    if (b.dataset.act === 'map') openBigMap();
    if (b.dataset.act === 'multiplayer') openNetMenu(); // (net.js)
    if (b.dataset.act === 'cancel-courier' && cancelCourier()) { saveGame(); say('You call dispatch and hand the parcel back. No pay, no hard feelings.', 4); closePause(true); }
    if (b.dataset.act === 'cancel-fare' && cancelFare()) { say('You call it off. The light goes back on: someone else will flag you down soon.', 4); closePause(true); }
    if (b.dataset.act === 'newgame') { if (b.dataset.sure) newGame(); else { b.dataset.sure = 1; b.textContent = 'Start over: lose your money, things, home and car? Click again'; } }
    if (b.dataset.toggle) settings[b.dataset.toggle] = !settings[b.dataset.toggle];
    if (b.dataset.detail) settings.detail = b.dataset.detail;
    if (b.dataset.toggle || b.dataset.detail) { saveSettings(); applySettings(); show(); }
  });
  el.show = show;
  return el;
}


// A separate reference screen keeps the pause/settings menu compact.
let controlsEl = null;
const controlsOpen = () => controlsEl?.style.display === 'flex';
function closeControls() {
  controlsEl.style.display = 'none';
  pauseEl.style.display = 'flex';
  pauseEl.querySelector('[data-act="controls"]').focus();
}
function openControls() {
  if (!controlsEl) {
    controlsEl = menuEl('controls', 510, `
      <div class="panel controls-panel" role="dialog" aria-labelledby="controls-title">
        <header class="controls-header"><div><p class="controls-eyebrow">GLYPHPORT / FIELD GUIDE</p><h1 id="controls-title">Controls</h1><p class="controls-intro">Pick a tab to find the controls you need.</p></div>
        <button class="item controls-back" data-controls-back aria-label="Back to pause"><span class="controls-back-long">← Back to pause</span><span class="controls-back-short">← Back</span><span class="k">Esc</span></button></header>
        <nav class="controls-tabs" aria-label="Control categories">
          <button data-controls-tab="keyboard" aria-pressed="true">Keyboard & mouse</button>
          <button data-controls-tab="controller" aria-pressed="false">Controller</button>
          <button data-controls-tab="skate" aria-pressed="false">Skateboarding</button>
        </nav>
        <section data-controls-section="keyboard"><h2>Keyboard & mouse</h2><div class="keys">
          <b>WASD</b><span>Move on foot or drive.</span>
          <b>Mouse</b><span>Look around. Click the game to capture the mouse.</span>
          <b>Shift</b><span>Hold to run.</span>
          <b>E</b><span>Interact: talk, use, buy or get in.</span>
          <b>Space</b><span>Jump. Tap again near landing to bunny hop. In a car, hold for the handbrake or a drift.</span>
          <b>Right mouse</b><span>Hold to aim the revolver.</span>
          <b>C</b><span>Hold to crouch, or sit when there’s a seat.</span>
          <b>H</b><span>Hail a taxi.</span>
          <b>V</b><span>Change the car camera.</span>
          <b>M</b><span>Open the city map.</span>
          <b>Shift + M</b><span>Toggle the minimap.</span>
          <b>1–8</b><span>Equip a quick-slot item. Press the same key again to put it away. In a taxi or train, pick a stop.</span>
          <b>0</b><span>Put away what you’re holding.</span>
          <b>I</b><span>Open your inventory and assign quick slots.</span>
          <b>Q / left mouse</b><span>Use what you’re holding.</span>
          <b>R</b><span>Reload the revolver.</span>
          <b>B</b><span>Play the next boombox tape.</span>
          <b>G</b><span>Pickpocket, shoplift or grab.</span>
          <b>L</b><span>Pick a lock at night.</span>
          <b>J</b><span>Start taxi work or a shift.</span>
          <b>N</b><span>Toggle sound.</span>
          <b>P</b><span>Pee.</span>
          <b>Esc</b><span>Pause. In this guide, go back to the pause menu.</span>
          <b>F12</b><span>Take a screenshot.</span>
      </div></section>
        <section data-controls-section="controller" hidden><h2>Controller</h2><div class="keys">
          <b>Left stick</b><span>Move. Click the stick to run or cruise.</span>
          <b>Right stick</b><span>Look around. Click the stick to change the camera.</span>
          <b>A</b><span>Jump or do the current action. In menus, choose.</span>
          <b>X</b><span>Interact.</span>
          <b>B</b><span>Crouch. In menus, go back.</span>
          <b>Y</b><span>Show the actions you can do here.</span>
          <b>Start</b><span>Pause.</span>
          <b>View</b><span>Open the city map.</span>
          <b>LT / RT</b><span>LT aims; RT uses your held item. In a vehicle, LT brakes and RT adds power.</span>
          <b>D-pad up / down</b><span>Up opens your inventory. Down opens actions.</span>
          <b>D-pad left / right</b><span>Switch quick slots. During activities, choose a direction.</span>
          <b>Menu navigation</b><span>Use the D-pad or left stick to select. Left and right adjust sliders or slots. Scroll with the right stick.</span>
          <b>Text fields</b><span>Select a text field and press A to open the on-screen keyboard.</span>
          <b>On a skateboard</b><span>A pushes, X pushes mongo (with your front foot), and B brakes. See Skateboarding for tricks and balance.</span>
          <b>LB + right stick</b><span>Hold LB to look around while skating.</span>
          <b>RB / Y while skating</b><span>RB interacts. Press Y for actions, including getting off the board.</span>
      </div></section>
        <section data-controls-section="skate" hidden><h2>Skateboarding</h2><div class="keys">
          <b>W / gamepad A / left stick forward</b><span>Push. From a stop, you head toward the camera view.</span>
          <b>Shift + W / gamepad X</b><span>Push mongo: use your front foot to push.</span>
          <b>A / D / left stick</b><span>Carve on the ground. Spin in the air.</span>
          <b>Mouse / LB + right stick</b><span>Look around the skater. On a controller, hold LB while moving the right stick.</span>
          <b>Hold S / left stick down</b><span>Brake. Keep holding to turn around and push the other way. Release to coast.</span>
          <b>S + A/D / gamepad B</b><span>Hold S and steer to powerslide. Gamepad B brakes to a stop.</span>
          <b>Space</b><span>Hold to load an ollie, then release to jump.</span>
          <b>Arrow keys</b><span>Choose a flip while holding Space, or tap an arrow in the air. Air tricks don’t give you another jump.</span>
          <b>Touch: Ollie</b><span>Tap Ollie to jump, or swipe from it to choose a trick.</span>
          <b>Right mouse / right stick</b><span>For gesture tricks, hold the right mouse button and drag, or move the right stick. Directions below refer to that drag or stick movement.</span>
          <b>Ollie / nollie</b><span>Pull back to load, then flick forward for an ollie. Load forward instead for a nollie.</span>
          <b>Kickflip / heelflip</b><span>After loading, flick forward-left for a kickflip or forward-right for a heelflip.</span>
          <b>Shuvit</b><span>Scoop a half-circle, then release.</span>
          <b>360 flip / 360 shuvit</b><span>Scoop three-quarters of a circle, then release. Left gives a 360 flip; right gives a 360 shuvit.</span>
          <b>Varial heelflip</b><span>Scoop a half-circle right, then flick upper-right and release.</span>
          <b>Hardflip</b><span>Scoop a quarter-circle left, then flick upper-right and release.</span>
          <b>Inward heelflip</b><span>Scoop a quarter-circle right, then flick upper-left and release.</span>
          <b>Flips in the air</b><span>Flick left or right and release. You don’t need to load again. Loaded flicks and scoops work too.</span>
          <b>C / RT before takeoff</b><span>Hold to jump out of a bowl or ramp onto the deck. Otherwise, bowl airs aim back inside. Choose before you pop or cross the lip.</span>
          <b>Coping boardslide</b><span>Jump out, turn the board across the coping (the tube along the lip), then come down moving along it.</span>
          <b>Q / E / LT / RT in the air</b><span>Hold to grab. Use the mouse or right stick to choose nose, tail or side. Let go before landing. RT can’t grab if you used it to jump out.</span>
          <b>Manual / nose manual</b><span>Hold the right stick or mouse partway back for a manual, or partway forward for a nose manual. Full deflection loads a jump. Manuals link combos across flat ground.</span>
          <b>Grind balance</b><span>Use A/D to move the balance marker toward the centre. With the right stick or a right-mouse drag, left/right balances and forward/back shifts nose/tail pressure.</span>
          <b>Manual balance</b><span>Adjust forward/back pressure to keep the balance marker centred. With a mouse, the starting drag sets neutral; keep right-click held and move gently forward/back to correct. A/D steers; it doesn’t balance a manual.</span>
      </div></section>
        <footer class="controls-footer">Game paused · Settings are available in the pause menu</footer>
      </div>`);
    // Each binding is a single, aligned row, even when its explanation wraps.
    controlsEl.querySelectorAll('.keys').forEach(list => {
      for (const key of [...list.querySelectorAll('b')]) {
        const description = key.nextElementSibling;
        const row = document.createElement('div'); row.className = 'control-binding';
        list.insertBefore(row, key); row.append(key, description);
      }
    });
    controlsEl.addEventListener('click', e => {
      if (e.target.closest('[data-controls-back]')) return closeControls();
      const tab = e.target.closest('[data-controls-tab]');
      if (!tab) return;
      controlsEl.querySelectorAll('[data-controls-tab]').forEach(button => button.setAttribute('aria-pressed', String(button === tab)));
      controlsEl.querySelectorAll('[data-controls-section]').forEach(section => section.hidden = section.dataset.controlsSection !== tab.dataset.controlsTab);
    });
  }
  pauseEl.style.display = 'none';
  controlsEl.style.display = 'flex';
  controlsEl.querySelector('[data-controls-back]').focus();
}

const homeEl = document.getElementById('home');
function resetStartOver() {
  const button = pauseEl && pauseEl.querySelector('[data-act="newgame"]');
  if (button) { delete button.dataset.sure; button.textContent = 'Start over'; }
}
function openPause() {
  releaseHeldMouse();
  if (paused) return;
  pauseEl = pauseEl || buildPause();
  resetStartOver();
  paused = true;
  cancelTransitAnnouncements();
  for (const k in K) K[k] = 0; // nothing held down while we're away
  pauseEl.show(); pauseEl.style.display = 'flex'; homeEl.style.display = GLYPHPORT_DESKTOP_APP ? 'none' : 'block'; // the way home: only while paused in the browser
  releaseMouse();
  if (actx) master.gain.setTargetAtTime(0, actx.currentTime, 0.15);
  pauseEl.querySelector('[data-act="resume"]').focus();
}
function closePause(lock) {
  if (!paused) return;
  if (controlsOpen()) closeControls();
  resetStartOver();
  paused = false; pauseEl.style.display = 'none'; homeEl.style.display = 'none';
  if (lock) lockMouse(); // resuming with the mouse: take it straight back
}
const togglePause = () => controlsOpen() ? closeControls() : paused ? closePause(NATIVE_MOUSE_APP) : openPause();
// letting go of the mouse lock (the browser eats the Esc that does it) pauses too
// (not while a cabinet or a shift has the screen: Esc there walks away from it)
document.addEventListener('pointerlockchange', () => {
  const wasLocked=browserMouseObservedLocked;browserMouseObservedLocked=!!document.pointerLockElement;
  // Capture requests can finish after a menu has opened. Release that late
  // capture deliberately, and ignore duplicate notifications of an old loss.
  if(browserMouseObservedLocked&&paused){releaseMouse();return;}
  if(consumeMouseRelease())return;
  if (wasLocked&&!browserMouseObservedLocked && !desktopMouseCaptured && !paused && (freecam || !sleep && !game)) openPause();
});
applySettings();

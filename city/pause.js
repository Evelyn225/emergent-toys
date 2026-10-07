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
      <button class="item" data-act="map">Map of the city</button>
      <button class="item" data-act="newgame">Start over</button>
      <button class="item" data-act="dev">Dev tools <span class="k" style="margin-left:auto">F2</span></button>
      <a class="item" data-desktop-download href="https://github.com/Evelyn225/emergent-toys/releases/latest/download/Glyphport-Setup.exe" target="_blank" rel="noopener" style="display:${!GLYPHPORT_DESKTOP_APP && !MOBILE_BROWSER ? 'flex' : 'none'}">Download Windows app <span class="k" style="margin-left:auto">desktop</span></a>
      <button class="item" data-act="fullscreen" style="display:${GLYPHPORT_DESKTOP_APP ? 'flex' : 'none'}">Fullscreen <span class="k" style="margin-left:auto">F11</span></button>
      <button class="item" data-act="update" style="display:${GLYPHPORT_DESKTOP_APP ? 'flex' : 'none'}">Check for updates</button>
      <p class="sub" data-update-status style="display:${GLYPHPORT_DESKTOP_APP ? 'block' : 'none'}"></p>
      <h2>sound</h2>
      ${slider('master', 'Master', 0, 1, 0.05)}${slider('music', 'Music', 0, 1, 0.05)}${slider('ambience', 'Ambience', 0, 1, 0.05)}${slider('effects', 'Effects', 0, 1, 0.05)}
      <h2>view</h2>
      ${slider('fov', 'Field of view', 50, 120, 1)}
      <div class="row"><span>Detail</span><div class="opts">${Object.keys(DETAIL).map(d => `<button class="opt" data-detail="${d}">${d}</button>`).join('')}</div><span></span></div>
      ${toggle('help', 'Help line')}
      <h2>mouse</h2>
      ${slider('sensitivity', 'Sensitivity', 0.25, 3, 0.05)}
      ${toggle('invertY', 'Invert Y')}
      <h2>controls</h2>
      <div class="keys">
        <b>WASD</b><span>move / drive</span><b>mouse</b><span>look (click to lock); on a skateboard, right-click and flick for tricks</span>
        <b>shift</b><span>run</span><b>E</b><span>use, talk, enter, buy</span>
        <b>space</b><span>jump (tap near landing to bunny hop); in car: handbrake / drift; on board: ollie</span><b>right mouse</b><span>on a board: hold and flick for tricks</span><b>C</b><span>crouch (hold) / sit</span>
        <b>H</b><span>hail a taxi</span><b>V</b><span>car camera</span>
        <b>M</b><span>map</span><b>1-8</b><span>quick slots; again to put away (taxi / train: pick a stop)</span><b>0</b><span>empty hands</span><b>B</b><span>boombox: next tape</span><b>G</b><span>pickpocket / shoplift / grab</span><b>L</b><span>pick a lock (at night)</span>
        <b>I</b><span>what you carry; assign items to quick slots</span><b>Q</b><span>use held item</span>
        <b>J</b><span>drive a taxi / work a shift</span><b>N</b><span>sound on / off</span>
        <b>P</b><span>pee</span>
        <b>Esc</b><span>pause</span>
      </div>
      <h2></h2>
      ${GLYPHPORT_DESKTOP_APP ? '<button class="item" data-act="quit">Quit game</button>' : '<a class="item" href="index.html">Quit to Eve Net</a>'}
    </div>`);
  const RANGE = { fov: [50, 100], sensitivity: [0.25, 3] };
  const show = () => {
    const fullscreen = el.querySelector('[data-act="fullscreen"]');
    fullscreen.firstChild.textContent = desktopFullscreen ? 'Exit fullscreen ' : 'Fullscreen ';
    fullscreen.disabled = desktopFullscreenBusy;
    if (GLYPHPORT_DESKTOP_APP) showDesktopUpdate(el);
    for (const inp of el.querySelectorAll('[data-set]')) inp.value = settings[inp.dataset.set];
    for (const s of el.querySelectorAll('[data-show]')) {
      const k = s.dataset.show, v = settings[k];
      s.textContent = k === 'fov' ? v + '°' : k === 'sensitivity' ? v.toFixed(2) + 'x' : Math.round(v * 100) + '%';
    }
    for (const b of el.querySelectorAll('[data-bar]')) { const [lo, hi] = RANGE[b.dataset.bar] || [0, 1]; b.innerHTML = asciiBar((settings[b.dataset.bar] - lo) / (hi - lo)); }
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
    if (b.dataset.act === 'update') desktopUpdateAction();
    if (b.dataset.act === 'quit') quitDesktopGame();
    if (b.dataset.act === 'resume') closePause(true);
    if (b.dataset.act === 'dev') openDev();
    if (b.dataset.act === 'map') openBigMap();
    if (b.dataset.act === 'newgame') { if (b.dataset.sure) newGame(); else { b.dataset.sure = 1; b.textContent = 'Start over: lose your money, things, home and car? Click again'; } }
    if (b.dataset.toggle) settings[b.dataset.toggle] = !settings[b.dataset.toggle];
    if (b.dataset.detail) settings.detail = b.dataset.detail;
    if (b.dataset.toggle || b.dataset.detail) { saveSettings(); applySettings(); show(); }
  });
  el.show = show;
  return el;
}

const homeEl = document.getElementById('home');
function openPause() {
  if (paused) return;
  pauseEl = pauseEl || buildPause();
  paused = true;
  for (const k in K) K[k] = 0; // nothing held down while we're away
  pauseEl.show(); pauseEl.style.display = 'flex'; homeEl.style.display = GLYPHPORT_DESKTOP_APP ? 'none' : 'block'; // the way home: only while paused in the browser
  releaseMouse();
  if (actx) master.gain.setTargetAtTime(0, actx.currentTime, 0.15);
  pauseEl.querySelector('[data-act="resume"]').focus();
}
function closePause(lock) {
  if (!paused) return;
  paused = false; pauseEl.style.display = 'none'; homeEl.style.display = 'none';
  if (lock) lockMouse(); // resuming with the mouse: take it straight back
}
const togglePause = () => paused ? closePause(NATIVE_MOUSE_APP) : openPause();
// letting go of the mouse lock (the browser eats the Esc that does it) pauses too
// (not while a cabinet or a shift has the screen: Esc there walks away from it)
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !desktopMouseCaptured && !paused && !sleep && !game) openPause(); });
applySettings();

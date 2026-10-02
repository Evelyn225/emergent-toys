// ===== pause menu: Esc or P (or the mouse lock being released). Freezes the game, fades the sound, and holds the
// settings, which apply as you change them and are kept in localStorage.
const DETAIL = { high: 10, medium: 12, low: 15 }; // character size in px: bigger characters, fewer of them, faster
let pauseEl = null;

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
      <p class="sub">ASCII City</p>
      <button class="item" data-act="resume">Resume</button>
      <h2>sound</h2>
      ${slider('master', 'Master', 0, 1, 0.05)}${slider('music', 'Music', 0, 1, 0.05)}${slider('ambience', 'Ambience', 0, 1, 0.05)}${slider('effects', 'Effects', 0, 1, 0.05)}
      <h2>view</h2>
      ${slider('fov', 'Field of view', 50, 100, 1)}
      <div class="row"><span>Detail</span><div class="opts">${Object.keys(DETAIL).map(d => `<button class="opt" data-detail="${d}">${d}</button>`).join('')}</div><span></span></div>
      ${toggle('help', 'Help line')}
      <h2>mouse</h2>
      ${slider('sensitivity', 'Sensitivity', 0.25, 3, 0.05)}
      ${toggle('invertY', 'Invert Y')}
      <h2>controls</h2>
      <div class="keys">
        <b>WASD</b><span>move / drive</span><b>mouse</b><span>look (click to lock)</span>
        <b>shift</b><span>run</span><b>E</b><span>use, talk, enter, buy</span>
        <b>H</b><span>hail a taxi</span><b>V</b><span>car camera</span>
        <b>M</b><span>map</span><b>1-5</b><span>taxi / train stop</span>
        <b>I</b><span>what you carry</span><b>Q</b><span>use held item</span>
        <b>hold T</b><span>fast-forward</span><b>Y</b><span>weather</span>
        <b>N</b><span>sound on / off</span><b>Esc</b><span>pause</span>
      </div>
      <h2></h2>
      <a class="item" href="index.html">Quit to Eve Net</a>
    </div>`);
  const RANGE = { fov: [50, 100], sensitivity: [0.25, 3] };
  const show = () => {
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
    if (b.dataset.act === 'resume') closePause(true);
    if (b.dataset.toggle) settings[b.dataset.toggle] = !settings[b.dataset.toggle];
    if (b.dataset.detail) settings.detail = b.dataset.detail;
    if (b.dataset.toggle || b.dataset.detail) { saveSettings(); applySettings(); show(); }
  });
  el.show = show;
  return el;
}

function openPause() {
  if (paused) return;
  pauseEl = pauseEl || buildPause();
  paused = true;
  for (const k in K) K[k] = 0; // nothing held down while we're away
  pauseEl.show(); pauseEl.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
  if (actx) master.gain.setTargetAtTime(0, actx.currentTime, 0.15);
  pauseEl.querySelector('[data-act="resume"]').focus();
}
function closePause(lock) {
  if (!paused) return;
  paused = false; pauseEl.style.display = 'none';
  if (lock) cv.requestPointerLock(); // resuming with the mouse: take it straight back
}
const togglePause = () => paused ? closePause(false) : openPause();
// letting go of the mouse lock (the browser eats the Esc that does it) pauses too
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !paused && !sleep) openPause(); });
applySettings();

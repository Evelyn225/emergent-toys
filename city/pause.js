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
  const el = document.createElement('div');
  el.id = 'pause';
  el.innerHTML = `
    <style>
      #pause { position: fixed; inset: 0; z-index: 500; display: none; align-items: center; justify-content: center;
               background: rgba(0, 0, 0, 0.6); font: 13px/1.5 monospace; color: rgba(255, 255, 255, 0.85); }
      #pause .panel { width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box;
                      padding: 20px 22px; background: rgba(10, 6, 10, 0.94); border: 1px solid rgba(255, 255, 255, 0.15); }
      #pause h1 { margin: 0 0 14px; font-size: 18px; font-weight: normal; letter-spacing: 4px; color: #fff; }
      #pause h2 { margin: 18px 0 8px; font-size: 11px; font-weight: normal; letter-spacing: 2px; color: rgba(255, 255, 255, 0.5); }
      #pause .row { display: grid; grid-template-columns: 9em 1fr 3.5em; align-items: center; gap: 10px; margin: 6px 0; }
      #pause .row span:last-child { text-align: right; color: rgba(255, 255, 255, 0.6); }
      #pause input[type=range] { width: 100%; accent-color: #ffb84d; }
      #pause input[type=checkbox] { justify-self: start; width: 16px; height: 16px; margin: 0; accent-color: #ffb84d; }
      #pause button, #pause a.btn { display: block; width: 100%; box-sizing: border-box; margin: 6px 0; padding: 8px 10px; text-align: left;
               font: inherit; color: #fff; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); cursor: pointer; text-decoration: none; }
      #pause button:hover, #pause a.btn:hover, #pause button:focus-visible { background: rgba(255, 184, 77, 0.18); border-color: rgba(255, 184, 77, 0.6); outline: none; }
      #pause .seg { display: flex; gap: 6px; }
      #pause .seg button { margin: 0; text-align: center; padding: 4px 0; }
      #pause .seg button.on { background: rgba(255, 184, 77, 0.25); border-color: rgba(255, 184, 77, 0.7); }
      #pause .keys { display: grid; grid-template-columns: 8em 1fr; gap: 2px 10px; color: rgba(255, 255, 255, 0.7); }
      #pause .keys b { font-weight: normal; color: #fff; }
    </style>
    <div class="panel" role="dialog" aria-label="Paused">
      <h1>PAUSED</h1>
      <button data-act="resume">Resume</button>
      <h2>SOUND</h2>
      ${['master', 'music', 'ambience', 'effects'].map(k => `<label class="row"><span>${k[0].toUpperCase() + k.slice(1)}</span>
        <input type="range" min="0" max="1" step="0.05" data-set="${k}"><span data-show="${k}"></span></label>`).join('')}
      <h2>VIEW</h2>
      <label class="row"><span>Field of view</span><input type="range" min="50" max="100" step="1" data-set="fov"><span data-show="fov"></span></label>
      <div class="row"><span>Detail</span><div class="seg">${Object.keys(DETAIL).map(d => `<button data-detail="${d}">${d}</button>`).join('')}</div><span></span></div>
      <label class="row"><span>Help line</span><input type="checkbox" data-set="help"><span></span></label>
      <h2>MOUSE</h2>
      <label class="row"><span>Sensitivity</span><input type="range" min="0.25" max="3" step="0.05" data-set="sensitivity"><span data-show="sensitivity"></span></label>
      <label class="row"><span>Invert Y</span><input type="checkbox" data-set="invertY"><span></span></label>
      <h2>CONTROLS</h2>
      <div class="keys">
        <b>WASD</b><span>move (in a car: drive)</span><b>mouse / arrows</b><span>look (click to lock the mouse)</span>
        <b>shift</b><span>run</span><b>E</b><span>use, talk, enter, buy, get in / out</span><b>H</b><span>hail a taxi</span>
        <b>V</b><span>car camera</span><b>M</b><span>map</span><b>1-5</b><span>taxi / train destination</span>
        <b>hold T</b><span>fast-forward time</span><b>Y</b><span>weather</span><b>N</b><span>sound on / off</span><b>Esc / P</b><span>pause</span>
      </div>
      <h2></h2>
      <a class="btn" href="index.html">Quit to Eve Net</a>
    </div>`;
  document.body.appendChild(el);
  const show = () => {
    for (const inp of el.querySelectorAll('[data-set]')) inp.type === 'checkbox' ? inp.checked = settings[inp.dataset.set] : inp.value = settings[inp.dataset.set];
    for (const s of el.querySelectorAll('[data-show]')) {
      const k = s.dataset.show, v = settings[k];
      s.textContent = k === 'fov' ? v + '°' : k === 'sensitivity' ? v.toFixed(2) + 'x' : Math.round(v * 100) + '%';
    }
    for (const b of el.querySelectorAll('[data-detail]')) b.classList.toggle('on', b.dataset.detail === settings.detail);
  };
  el.addEventListener('input', e => {
    const k = e.target.dataset.set;
    if (!k) return;
    settings[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
    saveSettings(); applySettings(); show();
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'resume') closePause(true);
    if (b.dataset.detail) { settings.detail = b.dataset.detail; saveSettings(); applySettings(); show(); }
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

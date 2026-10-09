// Settings on the pause card: look speed, inverted vertical look, and volume. They are remembered in
// this browser; if storage is unavailable they still apply for the visit. Stored values are clamped,
// since anything could be sitting under the key.
const settingsKey = 'corridor-crawler-settings';
const settings = { lookSpeed: 1,invertLook: false,volume: .8 };
try {
  const stored = JSON.parse(localStorage.getItem(settingsKey)) ?? {};
  const clamp = (value,min,max,fallback) => Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback;
  settings.lookSpeed = clamp(stored.lookSpeed,.25,3,1);
  settings.invertLook = stored.invertLook === true;
  settings.volume = clamp(stored.volume,0,1,.8);
} catch {}
const lookSpeedInput = document.getElementById('look-speed'), invertInput = document.getElementById('invert-look');
const volumeInput = document.getElementById('volume');
// The level the game's master bus sits at with sound on.
const masterLevel = () => .18*settings.volume;
function showSettings() {
  lookSpeedInput.value = settings.lookSpeed; invertInput.checked = settings.invertLook; volumeInput.value = Math.round(settings.volume*100);
  document.getElementById('look-speed-value').textContent = settings.lookSpeed.toFixed(2) + '×';
  document.getElementById('volume-value').textContent = Math.round(settings.volume*100) + '%';
}
function saveSettings() {
  showSettings();
  try { localStorage.setItem(settingsKey,JSON.stringify(settings)); } catch {}
}
lookSpeedInput.addEventListener('input',() => { settings.lookSpeed = +lookSpeedInput.value; saveSettings(); });
invertInput.addEventListener('change',() => { settings.invertLook = invertInput.checked; saveSettings(); });
volumeInput.addEventListener('input',() => {
  settings.volume = +volumeInput.value/100; saveSettings();
  if (!audio) return;
  const now = audio.ctx.currentTime;
  if (!ended) audio.master.gain.setTargetAtTime(soundOn && playing ? masterLevel() : 0,now,.05);
  if (audio.musicVolume) audio.musicVolume.gain.setTargetAtTime(soundOn ? settings.volume : 0,now,.05);
});
showSettings();

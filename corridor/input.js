function look(dx,dy) {
  const speed = .0022*settings.lookSpeed;
  yaw -= dx*speed;
  pitch = Math.max(-1.45,Math.min(1.45,pitch-dy*speed*(settings.invertLook ? -1 : 1)));
}
function resetInput() {
  keys.clear();
  touchLook = null;
}
function pause() {
  if (ended) return;
  playing = false;
  resetInput();
  veil.hidden = false;
  reticle.hidden = true;
  document.body.classList.remove('playing');
  enterLabel.textContent = 'CONTINUE WALKING';
  prompt.textContent = '';
  if (document.pointerLockElement) document.exitPointerLock();
  if (audio) audio.master.gain.setTargetAtTime(0,audio.ctx.currentTime,.15);
}
async function start() {
  if (ended) return;
  notice.textContent = '';
  if (!coarse) {
    try { await renderer.domElement.requestPointerLock(); }
    catch { notice.textContent = 'Mouse capture unavailable. Drag the scene to look around.'; }
  }
  playing = true;
  veil.hidden = true;
  reticle.hidden = false;
  document.body.classList.add('playing');
  clock.getDelta();
  if (audio && soundOn) {
    await audio.ctx.resume();
    audio.master.gain.setTargetAtTime(masterLevel(),audio.ctx.currentTime,.15);
  }
}
enter.addEventListener('click',start);
renderer.domElement.addEventListener('click',() => { if (!playing) start(); });
document.addEventListener('pointerlockchange',() => { if (!document.pointerLockElement && playing && !coarse) pause(); });
document.addEventListener('mousemove',event => { if (playing && document.pointerLockElement) look(event.movementX,event.movementY); });
document.addEventListener('keydown',event => {
  if (!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','Escape'].includes(event.code)) return;
  if (playing) event.preventDefault();
  if (event.code === 'Escape') { pause(); return; }
  if (!playing) return;
  keys.add(event.code); if (event.code === 'KeyE' && !event.repeat) interact();
});
document.addEventListener('keyup',event => keys.delete(event.code));
window.addEventListener('blur',pause); document.addEventListener('visibilitychange',() => { if (document.hidden) pause(); });
renderer.domElement.addEventListener('pointerdown',event => {
  if (playing && !document.pointerLockElement) { touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY }; renderer.domElement.setPointerCapture(event.pointerId); }
});
renderer.domElement.addEventListener('pointermove',event => {
  if (!touchLook || touchLook.id !== event.pointerId) return;
  look((event.clientX-touchLook.x)*1.7,(event.clientY-touchLook.y)*1.7); touchLook.x = event.clientX; touchLook.y = event.clientY;
});
function releaseLook(event) { if (touchLook && touchLook.id === event.pointerId) touchLook = null; }
renderer.domElement.addEventListener('pointerup',releaseLook); renderer.domElement.addEventListener('pointercancel',releaseLook);
for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown',event => { event.preventDefault(); keys.add(button.dataset.key); button.setPointerCapture(event.pointerId); });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name,() => keys.delete(button.dataset.key));
}
document.getElementById('touch-use').addEventListener('click',interact); document.getElementById('touch-pause').addEventListener('click',pause);
if (coarse) document.querySelector('.controls').innerHTML = '<dt>ARROWS</dt><dd>Walk in any direction</dd><dt>DRAG</dt><dd>Look around</dd><dt>E / Ⅱ</dt><dd>Interact / pause</dd>';
function message(text) { prompt.textContent = text; messageUntil = time.value+3; }
function interact() { if (playing && active) active.use(); }

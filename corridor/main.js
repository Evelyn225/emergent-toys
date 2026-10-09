function animate() {
  if (ended) return;
  requestAnimationFrame(animate); update(Math.min(clock.getDelta(),.04));
  if (!ended) renderer.render(scene,camera);
}
await Promise.all(remnantAssets);
if (restarting) {
  // The same initial player position and rebuilt world as a refresh, ready to walk.
  update(0); renderer.render(scene,camera);
  await restartProgress(100);
  const cleanURL = new URL(location.href); cleanURL.searchParams.delete('restart');
  history.replaceState(null,'',cleanURL.href);
  endScreen.hidden = true;
  resumeWalking();
}
animate();

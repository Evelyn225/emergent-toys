function animate() {
  if (ended) return;
  requestAnimationFrame(animate); update(Math.min(clock.getDelta(),.04));
  if (!ended) renderer.render(scene,camera);
}
animate();

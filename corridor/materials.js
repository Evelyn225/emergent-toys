function material(tone = 1, emission = 0, water = 0, rough = 0, paint = [.87,.90,.84], surfaceKind = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { tone: { value: tone }, emission: { value: emission }, water: { value: water }, rough: { value: rough },
      paint: { value: new THREE.Vector3(...paint) }, surfaceKind: { value: surfaceKind }, basinWaterline,
      time, powered, carLamp, flash, lampCount, tunnelLamps, tunnelReach, blastLight },
    defines: { TUNNEL_LAMPS: lampSources.length },
    vertexShader: glsl.surfaceVertex,
    fragmentShader: glsl.dither+glsl.surfaceFragment,
    side: THREE.DoubleSide,
  });
}
// The small personal belongings keep their own fine grain; these finishes belong to the architecture.
const concrete = material(1,0,0,0,undefined,1), steel = material(.6,0,0,0,undefined,2), pale = material(1.25,0,0,0,undefined,2);
const lit = material(1, .85), waterMaterial = material(1, 0, 1), rock = material(.75, 0, 0, 1);
// The button is the only colour in the game.
const red = material(1.1, .3, 0, 0, [.82,.12,.1]);
const blastMaterial = new THREE.ShaderMaterial({
  uniforms: { time },
  vertexShader: glsl.blastNoise+glsl.blastVertex,
  fragmentShader: glsl.dither+glsl.blastNoise+glsl.blastFragment,
  side: THREE.DoubleSide,
});

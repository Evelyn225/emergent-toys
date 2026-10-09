// The control room's plan board is drawn from the same coordinates as the geometry.
const mapCanvas = document.createElement('canvas'); mapCanvas.width = 1024; mapCanvas.height = 768;
const mapContext = mapCanvas.getContext('2d'), mapTexture = new THREE.CanvasTexture(mapCanvas);
const toMap = (x,z) => [512+(x+23.5)*6.6,404-(z+37.5)*6.6];
function drawMap() {
  const ctx = mapContext, ink = '#cdd4c8', room = '#26302a', ground = '#141a17';
  ctx.fillStyle = ground; ctx.fillRect(0,0,1024,768);
  ctx.lineWidth = 2; ctx.strokeStyle = ink;
  function area(points) {
    ctx.beginPath();
    points.forEach(([x,z],i) => { const [px,py] = toMap(x,z); if (i) ctx.lineTo(px,py); else ctx.moveTo(px,py); });
    ctx.closePath(); ctx.fillStyle = room; ctx.fill(); ctx.stroke();
  }
  const rect = (x0,z0,x1,z1) => area([[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
  function gap(x0,z0,x1,z1) {
    const [ax,ay] = toMap(x0,z1), [bx,by] = toMap(x1,z0);
    ctx.fillStyle = room; ctx.fillRect(ax-2,ay-2,bx-ax+4,by-ay+4);
  }
  function bar(x0,x1,z,filled) {
    const [ax,ay] = toMap(x0,z), [bx] = toMap(x1,z);
    ctx.fillStyle = filled ? ink : ground; ctx.fillRect(ax,ay-4,bx-ax,8);
    if (!filled) ctx.strokeRect(ax,ay-4,bx-ax,8);
  }
  function text(value,x,z,size = 15) {
    const [px,py] = toMap(x,z);
    ctx.font = 'bold ' + size + 'px ISOCPEUR, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ink; ctx.fillText(value,px,py);
  }
  area([...tunnelFrames.map(f => [f.left.x,f.left.z]),...tunnelFrames.map(f => [f.edge.x,f.edge.z]).reverse()]);
  rect(0,-57,24,-27); rect(3,-82,21,-57); rect(-13,-52,0,-48); rect(-27,-59,-13,-41);
  rect(-31,-52,-27,-48); rect(-35,-52,-31,-47.5); rect(-39,-52,-35,-48); rect(-61,-60,-39,-40);
  rect(-61,-52,-39,-48); rect(controlPlan.x0,controlPlan.z0,controlPlan.x1,controlPlan.z1);
  if (northShutter.released) rect(storePlan.x0,storePlan.z0,storePlan.x1,storePlan.z1);
  // The service run is on the plan until it leaves the sheet; the rock beyond it never was.
  if (southUnlocked) rect(-21.5,-59.3-serviceStraight,-18.5,-59);
  for (const x of [0,-13,-27,-31,-35,-39]) gap(x,-52,x,-48);
  gap(10,-27,14,-27); gap(4.6,-57,19.4,-57); gap(-61,-50.83,-61,-49.17);
  if (northShutter.released) gap(-21.5,-41,-18.5,-41); else bar(-21.5,-18.5,-41,true);
  if (southUnlocked) gap(-21.5,-59.3,-18.5,-59); else bar(-21.5,-18.5,-59,true);
  for (const [a,b] of [[[-35,-52],[-31,-47.5]],[[-35,-47.5],[-31,-52]]]) {
    const [ax,ay] = toMap(...a), [bx,by] = toMap(...b);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  }
  text('INTAKE',-3.5,-2); text('RESERVOIR',12,-42); text('ASCENT',12,-70); text('HUB',-20,-50);
  text('LIFT',-33,-44.5,13); text('SUMP',-50,-44); text('CONTROL',-66.3,-47.4,13);
  text(northShutter.released ? 'STORE' : 'SEALED',-20,northShutter.released ? -36.2 : -43,13);
  if (southUnlocked) text('SERVICE',-11.5,-76,13); else text('LOCKED',-20,-62,13);
  if (northShutter.released && !keyTaken) {
    const [px,py] = toMap(-20,-38.6);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(px,py,6,0,Math.PI*2); ctx.fill(); ctx.fillRect(px+4,py-1.5,14,3);
  }
  const [hx,hy] = toMap(-68.6,-50);
  ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(hx,hy,6,0,Math.PI*2); ctx.fill();
  text('YOU ARE HERE',-66.3,-56,13);
  ctx.textAlign = 'left'; ctx.font = 'bold 20px ISOCPEUR, monospace'; ctx.fillText('SUBSTRUCTURE PLAN',36,42);
  ctx.font = '13px ISOCPEUR, monospace'; ctx.fillText('LOWER WORKS CONTROL',36,66);
  mapTexture.needsUpdate = true;
}

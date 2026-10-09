// The intake after the button. A later visit finds it fallen in a few metres from the door, its lamps
// dead but one, the hum gone, the rubble still settling. Nothing beyond it can be reached.
const collapseAt = 30, collapseCrest = collapseAt+6, collapseToe = collapseAt-3;
let settleIn = 5, dustIn = 0, flickerLamp = null;
// The rubble's height across the passage at a frame, rising from the floor to the crown of the vault.
const rubbleHeight = i => 3.25*sstep(collapseToe,collapseCrest,i);
function rubbleHalfWidth(i) {
  const m = rubbleHeight(i), { halfWidth } = tunnelFrames[Math.round(i)];
  return m <= 1.6 ? halfWidth : halfWidth*Math.sqrt(Math.max(0,1-((m-1.6)/1.5)**2));
}
function collapse() {
  // The mound: rows across the vault at the rubble's height, joined into one rough slope.
  const row = i => {
    const f = tunnelFrames[i], m = rubbleHeight(i), half = rubbleHalfWidth(i);
    return Array.from({ length: 9 },(_,k) => {
      const p = f.center.clone().addScaledVector(f.right,(k/4-1)*half);
      return p.setY(k === 0 || k === 8 ? Math.min(m,3.1) : m+.35*rockNoise(p.x*1.7,m,p.z*1.7)*Math.min(1,m));
    });
  };
  for (let i = collapseToe; i < collapseCrest+2; i++) strip(row(i),row(i+1),rock);
  // Broken stone heaped on the slope, half buried.
  for (let k = 0; k < 40; k++) {
    const i = collapseToe+(collapseCrest-collapseToe+1)*hash3(k,7,1), f = tunnelFrames[Math.round(i)];
    const r = .18+.45*hash3(k,8,1), u = (hash3(k,9,1)*2-1)*Math.max(0,rubbleHalfWidth(i)-r);
    const piece = mesh(stone(r,k*3.1),rock);
    piece.position.copy(f.center).addScaledVector(f.right,u).setY(rubbleHeight(i)+r*.2);
    piece.rotation.set(hash3(k,10,1)*3,hash3(k,11,1)*6,0);
  }
  // A rib torn from the vault, lying across the foot of the fall.
  const a = tunnelFrames[collapseToe-1], b = tunnelFrames[collapseAt+1];
  beam(a.center.clone().addScaledVector(a.right,.25-a.halfWidth).setY(.12).toArray(),
    b.center.clone().addScaledVector(b.right,b.halfWidth*.6).setY(2.4).toArray(),.13);
  const g = tunnelFrames[collapseToe-2];
  barrier([g.left.x,g.left.z],[g.edge.x,g.edge.z],[-1,-1],[4,4]);
  // One lamp, on the wall at the foot of the fall, still hangs on. It takes over the first slot in
  // the lamp array; the fixture it belonged to stays dead.
  const heading = Math.atan2(-g.right.z,g.right.x), p = intakeWall(collapseToe-2,1,1.4,.06), q = intakeWall(collapseToe-2,1,1.4,.02);
  flickerLamp = box(p.x,p.y,p.z,.1,.42,.16,lit); flickerLamp.rotation.y = heading; flickerLamp.userData.dynamic = true;
  box(q.x,q.y,q.z,.04,.54,.26,steel).rotation.y = heading;
  lampSources[0].position.copy(intakeWall(collapseToe-2,1,1.5,.5)); lampSources[0].reach = 7.5;
}
if (collapsed) collapse();
// The pause card offers a way to forget the ending and find the place whole again.
const forget = document.getElementById('forget');
forget.hidden = !collapsed;
forget.addEventListener('click',() => { try { localStorage.removeItem(collapseKey); } catch {} location.reload(); });
function updateCollapse(dt) {
  if (!collapsed || !playing) return;
  // Mostly on; now and then it stutters, or drops out for a moment.
  const t = time.value, s = Math.sin(t*1.7)+Math.sin(t*4.3+1), on = s < 1.35 && !(s > 1 && Math.sin(t*41) < 0);
  lampSources[0].strength = on ? .45 : 0;
  flickerLamp.material = on ? lit : steel;
  updateDust(dt);
  shake *= Math.exp(-dt*2.5);
  if ((dustIn -= dt) <= 0) { shed(2); dustIn = .4; }
  if ((settleIn -= dt) <= 0) {
    // The fall shifts: a groan from the rubble, a tremor, and grit from the vault.
    boom(.12,tunnelFrames[collapseAt].center.clone().setY(1.5),'explosion2',.6); shake = Math.max(shake,.15); shed(40);
    settleIn = 14+18*Math.random();
  }
}

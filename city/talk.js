// ---- talking to people (E): a line that depends on where you are, the time and the weather. Some ask a favour.
const nearestOf = (list, x, y) => list.reduce((b, s) => !b || Math.hypot(rel(s.x - x), rel(s.y - y)) < Math.hypot(rel(b.x - x), rel(b.y - y)) ? s : b, null);
// "2 blocks north-east" from (x, y) to (tx, ty); north is -y
function directions(x, y, tx, ty) {
  const ex = rel(tx - x), ey = rel(ty - y), n = Math.round(Math.hypot(ex, ey) / 8);
  const dir = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'][Math.round(Math.atan2(-ey, ex) / (Math.PI / 4)) & 7];
  return n < 1 ? 'just round here' : `${n} block${n > 1 ? 's' : ''} ${dir}`;
}
const DISTRICT_LINES = {
  chinatown: ['Best dumplings in the city are round here.', 'Mind the lanterns, they just put them up.'],
  industrial: ['Shift starts soon.', 'Smells like diesel round here.', 'Used to be a factory on every corner.'],
  waterfront: ['Love watching the boats.', 'You can walk right out to the end of the pier.', 'Smell that sea air.'],
  downtown: ['Everyone downtown is in such a hurry.', 'My office is up on the fortieth floor.'],
  brownstones: ['Quiet street, this.', 'My neighbour practises the trumpet. At 6am.'],
  midtown: ['Busy round here today.', 'Have you tried the diner on the corner?'],
};
function talkLine(p) {
  const h = tod, st = nearestOf(stations, p.x, p.y), lines = [...(DISTRICT_LINES[districtAt(p.x, p.y)] || [])];
  if (rain > 0.4) lines.push('This rain, huh.', 'Forgot my umbrella. Again.', 'Good weather for ducks.');
  if (fogAmt > 0.4) lines.push("Can't see a thing in this fog.", 'Fog rolled in off the water again.');
  if (rain < 0.2 && fogAmt < 0.2 && (h > 20 || h < 4)) lines.push('Nice night for a walk.', 'You can almost see the stars tonight.');
  if (h >= 5 && h < 9) lines.push('Too early for this.', 'Need. Coffee.', p.role === 'worker' ? "Can't be late again." : 'Morning.');
  if (h >= 12 && h < 14) lines.push('Lunch break. Finally.');
  if (h >= 17 && h < 19) lines.push('Long day.', 'Rush hour. Every single day.');
  if (h >= 23 || h < 4) lines.push('Bit late to be out wandering, no?', "Last call's at three, you know.", p.role === 'owl' ? 'The night is young!' : 'Should be in bed.');
  if (st && Math.hypot(rel(st.x - p.x), rel(st.y - p.y)) < 40) lines.push(`The ${st.name} train is late again.`, `Is ${st.name} station still closed for repairs?`);
  if (Math.abs(rel(p.y - (EL_ROW * 8 + 1))) < 12) lines.push('That el train shakes my whole apartment.', 'You get used to the trains. Mostly.');
  if (cars.some(c => c.ev && Math.hypot(rel(c.x - p.x), rel(c.y - p.y)) < 25)) lines.push("Another siren. Hope everyone's okay.", 'Something going on round the corner?');
  lines.push('Hey.', 'Can I help you?', 'Nice evening for it.'.replace('evening', h < 12 ? 'morning' : h < 18 ? 'day' : 'evening'));
  return pick(lines);
}

// one favour at a time: show someone the way (escort), fetch them something from a street cart (fetch), find a dog (dog)
let task = null;
const stationFor = p => stations.find(s => { const d = Math.hypot(rel(s.x - p.x), rel(s.y - p.y)); return d > 12 && d < 48; });
function startTask(p) {
  const r = Math.random(), v = nearestOf(vendors, p.x, p.y), st = stationFor(p);
  if (r < 0.2 && v && Math.hypot(rel(v.x - p.x), rel(v.y - p.y)) < 40) {
    task = { kind: 'fetch', who: p, type: v.type, have: false, until: T + 240, ask: `Could you grab me ${v.type.item} from a cart? I'm starving.` };
  } else if (r < 0.4) {
    const d = nearestDoor(p.x + (Math.random() - 0.5) * 30, p.y + (Math.random() - 0.5) * 30, () => true, 2);
    if (!d) return false;
    task = { kind: 'dog', who: p, dog: { x: d.x, y: d.y, follow: false }, until: T + 300,
             ask: `Have you seen my dog? Little brown thing. Answers to ${pick(['Biscuit', 'Noodle', 'Pickles', 'Bean', 'Waffles'])}.` };
  } else if (r < 0.65 && st) {
    task = { kind: 'escort', who: p, to: { x: st.x, y: st.y, name: `${st.name} station` }, ask: `Excuse me, which way is ${st.name} station? Could you show me?` };
  } else {
    const d = nearestDoor(p.x, p.y, d => d.use === 'shop' && openAt(d.sh, tod) && Math.hypot(rel(d.x - p.x), rel(d.y - p.y)) > 9, 3);
    if (!d) return false;
    task = { kind: 'escort', who: p, to: { x: d.x, y: d.y, name: d.sh.word }, ask: `Do you know a ${d.sh.word.toLowerCase()} round here? Could you show me?` };
  }
  p.wait = 0;
  if (task.kind === 'escort') { p.talk = 0; p.follow = true; p.path.length = 0; } else p.talk = Infinity; // the others wait right here
  return true;
}
// where the task points you
function taskTarget() {
  if (!task) return null;
  if (task.kind === 'escort') return task.to;
  if (task.kind === 'fetch') return task.have ? task.who : nearestOf(vendors.filter(v => v.type === task.type), px, py);
  return task.dog.follow ? task.who : task.dog;
}
function taskText() {
  if (!task) return '';
  const t = taskTarget(), where = t ? directions(px, py, t.x, t.y) : '';
  if (task.kind === 'escort') return `show them to ${task.to.name}: ${where}`;
  if (task.kind === 'fetch') return task.have ? `take the ${task.type.name.toLowerCase()} back: ${where}` : `buy ${task.type.item} from a cart: ${where}`;
  return task.dog.follow ? `take the dog back to its owner: ${where}` : `find the lost dog: ${where}`;
}
// back onto the sidewalk graph after a favour: in at the nearest door for a while, out to the corner later
function release(p, hide = true) {
  p.follow = false; p.talk = 0;
  const d = nearestDoor(p.x, p.y, () => true, 1);
  if (d) { p.x = d.x; p.y = d.y; p.hidden = hide; p.wait = 5 + Math.random() * 10; p.inside = d; snapToCorner(p); }
}
// a favour done: thanks, and usually some cash
function endTask(line, reward = 0) {
  if (reward > 0) { earn(reward); line += ` They press ${fmt$(reward)} into your hand.`; }
  say(line, 5); task = null;
}
const tip = (lo, hi) => lo + Math.round(Math.random() * (hi - lo));
// followers walk straight after you (they're in a hurry)
function followYou(p, dt) {
  const ex = rel(px - p.x), ey = rel(py - p.y), d = Math.hypot(ex, ey);
  if (mode !== 'walk' || d > 10) { release(p); return endTask("You lost them. They'll have to ask someone else."); }
  if (d > 0.35) { const s = Math.min(d - 0.35, 0.22 * dt); p.x = mod(p.x + ex / d * s, N); p.y = mod(p.y + ey / d * s, N); p.ph += dt * 5; }
}
// per frame: the dog trots after you; escorts and hand-overs complete when you get there
function stepTask(dt) {
  if (!task) return;
  const p = task.who, near = (t, r) => Math.hypot(rel(t.x - px), rel(t.y - py)) < r;
  if (task.until && T > task.until) { release(p, false); return endTask('They got tired of waiting and wandered off.'); }
  if (task.kind === 'escort' && near(task.to, 0.7)) {
    release(p); return endTask(`"${task.to.name}! Thank you so much!"`, tip(5, 15));
  }
  if (task.kind === 'dog') {
    const g = task.dog;
    if (!g.follow) { g.x += Math.sin(T * 0.7) * dt * 0.02; return; } // sniffing about
    const ex = rel(px - g.x), ey = rel(py - g.y), d = Math.hypot(ex, ey);
    if (d > 0.25) { const s = Math.min(d - 0.25, 0.3 * dt); g.x += ex / d * s; g.y += ey / d * s; }
    if (Math.hypot(rel(p.x - g.x), rel(p.y - g.y)) < 0.6) {
      p.talk = 3; endTask(`"${pick(['There you are!', 'Oh, thank goodness!', 'Bad dog! Good dog!'])}" They're beaming.`, tip(20, 40));
    }
  }
}
// E on someone: answer a task, or chat
function talkTo(p) {
  if (task && task.who === p) {
    if (task.kind === 'fetch' && task.have) { p.talk = 3; return endTask(`"Oh, ${task.type.name.toLowerCase()}! You're a lifesaver."`, task.type.price + tip(3, 8)); }
    return say(`"${task.ask}"`, 4);
  }
  if (!task && Math.random() < 0.3 && startTask(p)) return say(`"${task.ask}"`, 5);
  p.talk = Math.max(p.talk || 0, 3);
  say(`"${talkLine(p)}"`, 4);
}
// E at a cart while you're fetching for someone
const taskBuy = ven => { if (task && task.kind === 'fetch' && !task.have && ven.type === task.type) { task.have = true; return true; } return false; };
// E on the lost dog
const nearDog = () => task && task.kind === 'dog' && !task.dog.follow && Math.hypot(rel(task.dog.x - px), rel(task.dog.y - py)) < 0.5;

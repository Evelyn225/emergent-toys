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
  shotengai: ['The roof keeps the rain off. Best street in the city when it pours.', 'Try the takoyaki. Mind, they\'re hot.', 'I won a cat at the crane game. Took forty tries.', 'Pachinko? I only go for the noise.', 'You can sleep in a capsule for fifteen bucks, you know.'],
  industrial: ['Shift starts soon.', 'Smells like diesel round here.', 'Used to be a factory on every corner.'],
  waterfront: ['Love watching the boats.', 'You can walk right out to the end of the pier.', 'Smell that sea air.'],
  downtown: ['Everyone downtown is in such a hurry.', 'My office is up on the fortieth floor.'],
  belle: ['The hotel lobby has a piano player after dinner.', 'Look up at those copper roofs when the sun catches them.', 'The old hotel ballroom is beautiful. Very strict about the guest list, though.'],
  brownstones: ['Quiet street, this.', 'My neighbour practises the trumpet. At 6am.'],
  midtown: ['Busy round here today.', 'Have you tried the diner on the corner?'],
};
const FAIR_LINES = ['Have you been up the wheel? You can see the whole city.', "The darts are rigged. I'm going again anyway.", "I've had three corn dogs. I regret nothing.",
  'Hold my candy floss, I want a go on the duck pond.', 'The carousel horse I was on had a face like my uncle.', 'Every summer since I was six. Never won a thing.',
  'Smell that? Sea air and fried dough.', "My kid's somewhere round here. Probably on the carousel. Again."];
function talkLine(p) {
  if (p.fair) return pick(FAIR_LINES);
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
  if (cars.some(c => code(c) && Math.hypot(rel(c.x - p.x), rel(c.y - p.y)) < 25)) lines.push("Another siren. Hope everyone's okay.", 'Something going on round the corner?');
  lines.push('Hey.', 'Can I help you?', 'Nice evening for it.'.replace('evening', h < 12 ? 'morning' : h < 18 ? 'day' : 'evening'));
  return pick(lines);
}

// one favour at a time: show someone the way (escort), fetch them something from a street cart (fetch), find a dog (dog)
let task = null;
const stationFor = p => stations.find(s => { const d = Math.hypot(rel(s.x - p.x), rel(s.y - p.y)); return d > 12 && d < 48; });
function startTask(p) {
  const r = Math.random(), v = nearestOf(vendors, p.x, p.y), st = stationFor(p);
  if (r < 0.2 && v && Math.hypot(rel(v.x - p.x), rel(v.y - p.y)) < 40) {
    task = { kind: 'fetch', who: p, type: v.type, want: VENDOR_STOCK[v.type.name][0], until: T + 240, ask: `Could you grab me ${v.type.item} from a cart? I'm starving.` };
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
// the fetch favour: is what they asked for in your bag? (buy it and eat it, and you're back to the cart)
const fetchHave = () => !!task && task.kind === 'fetch' && carrying(task.want);
// where the task points you
function taskTarget() {
  if (!task) return null;
  if (task.kind === 'escort') return task.to;
  if (task.kind === 'fetch') return fetchHave() ? task.who : nearestOf(vendors.filter(v => v.type === task.type), px, py);
  return task.dog.follow ? task.who : task.dog;
}
function taskText() {
  if (!task) return '';
  const t = taskTarget(), where = t ? directions(px, py, t.x, t.y) : '';
  if (task.kind === 'escort') return `show them to ${task.to.name}: ${where}`;
  if (task.kind === 'fetch') return fetchHave() ? `take the ${task.type.name.toLowerCase()} back: ${where}` : `buy ${task.type.item} from a cart: ${where}`;
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
    if (fetchHave()) { takeSlot(inv.findIndex(it => it.id === task.want)); p.talk = 3; return endTask(`"Oh, ${task.type.name.toLowerCase()}! You're a lifesaver."`, task.type.price + tip(3, 8)); }
    return say(`"${task.ask}"`, 4);
  }
  if (!task && !p.fair && Math.random() < 0.3 && startTask(p)) return say(`"${task.ask}"`, 5);
  p.talk = Math.max(p.talk || 0, 3);
  if (fx.stink > 0 && Math.random() < 0.7) return say(pick(['They take a step back. "Oof. Stinky tofu?"', 'They wave a hand in front of their face. "Have you been at the night market?"', '"Whoa. Okay. Mints. Get some mints."']), 3);
  say(`"${talkLine(p)}"`, 4);
}
// bought at a cart while you're fetching for someone: was that it?
const taskBuy = (ven, id) => !!task && task.kind === 'fetch' && ven.type === task.type && id === task.want;
// E on the lost dog
const nearDog = () => task && task.kind === 'dog' && !task.dog.follow && Math.hypot(rel(task.dog.x - px), rel(task.dog.y - py)) < 0.5;

// ---- chatting to people indoors (E on anyone sitting or standing about who isn't behind the counter): a line for
// the kind of place, sometimes one for the hour. Just talk, no favours.
const ROOM_TALK = {
  store: ['They moved the bread again. Every week, new aisle.', "I only came in for milk. Look at this basket.", 'Is it me or are these prices going up daily?', 'The self-checkout hates me personally.'],
  bar: ['First one\'s for the thirst. Second one\'s for the taste. Third one... I forget.', 'Don\'t order the house red. Trust me.', 'Barkeep knows my name. That\'s not a good sign, is it.', 'I come here to be alone. Together.', 'You look like you\'ve had a day.'],
  diner: ['The coffee\'s terrible. Fourth cup.', 'Pie of the day is always cherry. Every day. Nobody knows why.', 'Been sitting in this booth since 1987.', 'They do breakfast all day. Civilisation peaked here.'],
  arcade: ['I had the high score on that one for six years. Some kid took it last week.', 'Don\'t touch the claw machine. It\'s rigged. I\'ve spent forty bucks proving it.', 'Got any quarters? No? Tokens? No?', 'Nobody understands the pain of a continue screen.'],
  laundry: ['Somebody stole one sock. Just one. Why.', 'This dryer eats coins. Use the one on the end.', 'I come here for the warm. Don\'t tell anyone.', 'Spin cycle\'s the best bit. Very relaxing.'],
  cinema: ['Shh! It\'s the good part.', 'I\'ve seen this four times. It doesn\'t get better.', 'The popcorn costs more than the ticket.', 'If that guy kicks my seat one more time...'],
  hotel: ['Room service took an hour and forgot the fork.', 'I\'m here for a conference. I think. Lost the badge.', 'The lifts are haunted. Fourth floor, every night, ding.', 'Checking out. Taking all the little soaps.'],
  apts: ['The lift\'s been "being fixed" since March.', 'Whoever\'s cooking fish on three, I will find you.', 'Package room\'s a lottery. Never your parcel.', 'You new in the building? Don\'t park in 4B.'],
  barber: ['Just a trim, I told him. Just. A. Trim.', 'Best gossip in the city is in this chair.', 'Don\'t let him talk you into the hot towel. Actually, do.', 'My barber knows more about me than my wife.'],
  hospital: ['Been waiting two hours. My arm\'s fine now, honestly.', 'Vending machine\'s out of everything but the gross crisps.', 'Don\'t ask what happened. It involved a ladder.', 'They gave me a little bracelet. Feels like a festival.'],
  bank: ['Forty minutes in this queue to deposit four dollars.', 'One window open. Five tellers. Ask me how.', 'The pens are chained down. What do they think we are?', 'Do you think the vault\'s really full of gold? Like in cartoons?'],
  karaoke: ['I\'m doing Bohemian Rhapsody next. All of it. All the parts.', 'Liquid courage. It\'s working.', 'That guy\'s been singing the same song for an hour.', 'Pick a duet with me. Anything. Please.'],
  petshop: ['That parrot called me a name.', 'I came for fish food and I\'m leaving with a hamster. Don\'t judge.', 'The puppies are a trap. A beautiful trap.', 'Do lizards get lonely? Asking for me.'],
  florist: ['Anniversary. Forgot. Need the biggest bunch they\'ve got.', 'Is a cactus romantic? It lasts longer.', 'Smells amazing in here, doesn\'t it.'],
  station: ['Train\'s late. Again. Again again.', 'Mind the gap. I always think they mean my life.', 'Someone\'s been busking that same song for a week.', 'I\'ve missed my stop three times this month. Reading.', 'Rats down here are the size of cats. Friendly though.'],
  train: ['Don\'t sit there, it\'s sticky.', 'Next stop\'s mine. I think. Which line is this?', 'The guy over there is eating a whole rotisserie chicken.', 'Ten more minutes of sleep. Wake me at the end.'],
  cafe: ['Third oat latte. I am now vibrating.', 'Writing a novel. Chapter one. Since 2019.', 'The wifi password is on the board. Good luck reading it.', 'This is my office now. They haven\'t noticed.', 'The pastries go by ten. Rookie mistake to come at eleven.'],
  books: ['I came in for one book. I have six.', 'The cat that lives here judged my choice.', 'Don\'t tell anyone, I just read here. For free.', 'Have you read anything good lately? Don\'t say the phone book.'],
  noodle: ['Slurping\'s a compliment here. Slurp loud.', 'Extra chilli was a mistake. A delicious mistake.', 'Best broth in the city. Simmers for two days.', 'I come here every night. They just bring my bowl.'],
  garage: ['Funny noise when I brake. They\'re charging me for the funny noise.', 'Been here since noon. My car\'s "nearly done" since noon.', 'Tyres. Always tyres.'],
  tea: ['Pung! ...no wait, sorry.', 'Don\'t play with Mrs Lau. She takes everything.', 'Green tea, mahjong, gossip. Perfect evening.', 'I\'ve been playing fifty years. Still lose to my sister.', 'The tiles are older than me. So are the players.'],
  storage: ['Everything I own is in a ten-by-ten box. Very freeing.', 'I keep my ex\'s stuff here. Paying monthly. Petty, I know.', 'Unit 47 hums at night. I don\'t ask.'],
  jail: ['I didn\'t do it. Well. I did that one.', 'Food\'s not bad. The company\'s worse.', 'First time? Keep your head down.', 'Officer! I demand my phone call! ...it was a pizza order.'],
  lighthouse: ['Two hundred and twelve steps. I counted.', 'Keeper\'s been here thirty years. Talks to the gulls.', 'Best view in the city, if you can breathe at the top.'],
  showroom: ['Just looking. Just looking. Is that heated seats?', 'Salesman\'s been circling me for twenty minutes.', 'I could never afford this. I\'m here for the free coffee.'],
  realty: ['Four hundred a month for a closet with a window. A "cosy studio".', 'Location, location, location. And debt.', 'I\'m house hunting. The houses are winning.'],
  aquarium: ['Look at the jellyfish. Just floating. No rent. No email.', 'That octopus looked right at me. It knows things.', 'Sharks are just ocean dogs. Big wet dogs.', 'My kid\'s named every fish. All of them are "Gerald".'],
  cathedral: ['Shh. Lovely acoustics. Shh.', 'I just come in for the quiet.', 'Those windows took a hundred years to make.', 'Lit a candle for my nan. And one for my team.'],
  pachinko: ['Silver balls. All day. I hear them in my sleep.', 'I\'m up. I think. It\'s hard to tell.', 'It\'s not gambling if you don\'t understand it.'],
  cranes: ['Forty tries for a plush cat. Worth it.', 'The claw\'s weaker after nine. Science.'],
  capsule: ['It\'s cosy. Like a coffin with wifi.', 'Don\'t sit up too fast.'],
  conservatory: ['It\'s so warm in here. My glasses keep fogging.', 'That plant smells like rotting meat. On purpose!', 'I come here in winter and pretend I\'m on holiday.'],
  aviary: ['A bird landed on my head. I\'m choosing to see it as a blessing.', 'They love the seed. They tolerate me.'],
  jade: ['My grandmother swore by jade. Lived to 103.', 'Is it real? The man says it\'s real.', 'For luck. Need all of it this month.'],
  casino: ['Feeling lucky. Felt lucky an hour ago too.', 'House always wins. I\'m here to make it work for it.', 'No clocks, no windows. What day is it?', 'Red. It\'s always red. Except when it isn\'t.', 'One more spin and I\'m going home. That was nine spins ago.'],
  exchange: ['Buy low, sell high. I keep doing the other one.', 'BYTE\'s going to the moon. Or the floor.', 'I\'ve been staring at this ticker for six hours.', 'Diversify, they said. So now I lose money in seven places.'],
  stripclub: ['I\'m only here for the wings.', 'Don\'t make eye contact with the bouncer.', 'My friend\'s bachelor party. He left an hour ago.', 'Those are six very talented characters.',
    'Twelve dollars for a soda. A SODA.', 'She remembered my name. She calls everyone "hon". Still.', 'I\'m an accountant. This is my one night.',
    'The one on the left pole is putting herself through law school. Tip her.', 'Wife thinks I\'m at bowling. I don\'t even own the shoes.',
    'Don\'t sit there, that chair\'s been sticky since 2003.', 'The VIP room is forty bucks for a song. A short song.', 'I come for the music. Honestly. Listen to that bass.',
    'Shh. This is my favourite song.', 'Ran out of singles an hour ago. Just vibing now.'],
};
const GENERIC_ROOM_TALK = ['Hi.', 'Oh, hello.', 'Can I help you?', 'Lovely place, isn\'t it.', 'Do I know you?'];
let lastRoomLine = '';
function roomTalkLine(kind, h = tod) {
  const lines = [...(ROOM_TALK[kind] || GENERIC_ROOM_TALK)];
  if (h >= 5 && h < 9 && kind !== 'jail') lines.push('Too early for people.', 'Haven\'t had my coffee yet. Speak slowly.');
  if ((h >= 23 || h < 4) && kind !== 'jail') lines.push('Shouldn\'t you be in bed?', 'It\'s late. Why are we both here?');
  if (rain > 0.4 && kind !== 'jail' && kind !== 'station' && kind !== 'train') lines.push('Waiting out the rain. You too?');
  let line = pick(lines);
  for (let k = 0; k < 4 && line === lastRoomLine; k++) line = pick(lines); // (not the same one twice running)
  return (lastRoomLine = line);
}
// who you'd be talking to: someone sitting or standing within reach, roughly in front, nearer than the counter
const PEOPLE_ART = () => [ART.keeper, ART.sitter, ART.sitterBack];
function roomPerson() {
  if (mode !== 'room' || !room || !room.props) return null;
  const arts = PEOPLE_ART(), k = room.def.keeper, keeperD = k ? Math.hypot(px - k[0], py - k[1]) : Infinity;
  let best = null, bd = 1.4;
  for (const s of room.props) {
    if (!arts.includes(s.art) || k && Math.hypot(s.x - k[0], s.y - k[1]) < 0.6) continue; // (not the one behind the counter)
    const ex = s.x - px, ey = s.y - py, d = Math.hypot(ex, ey), facing = (Math.cos(a) * ex + Math.sin(a) * ey) / (d || 1);
    const score = d - facing * 0.4;
    if (d < 1.4 && facing > -0.2 && score < bd) { bd = score; best = s; }
  }
  return best && Math.hypot(best.x - px, best.y - py) < keeperD - 0.2 ? best : null;
}
const talkInRoom = () => say(`"${roomTalkLine(room.kind)}"`, 4);

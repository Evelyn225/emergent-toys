// ---- goods: things you can buy, carry and use. Pure (no DOM), so the node tests can run it; goods-ui.js draws it.
// kind: food / drink (used up in bites or sips), smoke, gear (kept). uses = bites, sips or drags.
const ITEMS = {
  // food
  hotdog: { name: 'hot dog', price: 3, kind: 'food', uses: 3 }, taco: { name: 'tacos', price: 5, kind: 'food', uses: 3 },
  icecream: { name: 'ice cream', price: 4, kind: 'food', uses: 4 }, noodlebox: { name: 'noodles', price: 6, kind: 'food', uses: 4 },
  croissant: { name: 'croissant', price: 3, kind: 'food', uses: 3 }, donut: { name: 'donut', price: 2, kind: 'food', uses: 2 },
  bagel: { name: 'bagel', price: 3, kind: 'food', uses: 3 }, sandwich: { name: 'sandwich', price: 7, kind: 'food', uses: 4 },
  chips: { name: 'chips', price: 2, kind: 'food', uses: 4 }, candy: { name: 'candy bar', price: 2, kind: 'food', uses: 2 }, apple: { name: 'apple', price: 1, kind: 'food', uses: 3 },
  slice: { name: 'pizza slice', price: 4, kind: 'food', uses: 3 }, burger: { name: 'burger', price: 8, kind: 'food', uses: 4 },
  kebab: { name: 'kebab', price: 8, kind: 'food', uses: 4 }, ramen: { name: 'ramen', price: 10, kind: 'food', uses: 5 },
  dumplings: { name: 'dumplings', price: 6, kind: 'food', uses: 4 }, mooncake: { name: 'mooncake', price: 4, kind: 'food', uses: 2 },
  fries: { name: 'fries', price: 3, kind: 'food', uses: 3 }, chicken: { name: 'fried chicken', price: 9, kind: 'food', uses: 4 },
  pho: { name: 'pho', price: 11, kind: 'food', uses: 5 }, banhmi: { name: 'banh mi', price: 7, kind: 'food', uses: 4 },
  padthai: { name: 'pad thai', price: 11, kind: 'food', uses: 5 }, greencurry: { name: 'green curry', price: 12, kind: 'food', uses: 5 },
  mangorice: { name: 'mango sticky rice', price: 6, kind: 'food', uses: 3 },
  ginseng: { name: 'ginseng root', price: 6, kind: 'food', uses: 2, caffeine: 70 }, // a bitter chew, and a kick like coffee
  // drink
  coffee: { name: 'coffee', price: 3, kind: 'drink', uses: 4, caffeine: 60 }, latte: { name: 'latte', price: 5, kind: 'drink', uses: 4, caffeine: 50 },
  tea: { name: 'tea', price: 2, kind: 'drink', uses: 3, caffeine: 25 }, soda: { name: 'soda', price: 2, kind: 'drink', uses: 3 },
  water: { name: 'water', price: 1, kind: 'drink', uses: 3 }, energy: { name: 'energy drink', price: 4, kind: 'drink', uses: 3, caffeine: 90 },
  beer: { name: 'beer', price: 6, kind: 'drink', uses: 4, booze: 0.25 }, whiskey: { name: 'whiskey', price: 9, kind: 'drink', uses: 2, booze: 0.4 },
  cocktail: { name: 'cocktail', price: 12, kind: 'drink', uses: 3, booze: 0.3 },
  milkshake: { name: 'milkshake', price: 5, kind: 'drink', uses: 4 }, smoothie: { name: 'smoothie', price: 6, kind: 'drink', uses: 4 },
  thaitea: { name: 'Thai iced tea', price: 4, kind: 'drink', uses: 4, caffeine: 30 },
  herbaltea: { name: 'herbal tea', price: 3, kind: 'drink', uses: 3, sober: 0.35 }, // clears your head a bit
  // smoke
  cigarettes: { name: 'cigarettes', price: 10, kind: 'smoke', uses: 5 },
  // gear
  skateboard: { name: 'skateboard', price: 60, kind: 'gear' }, ball: { name: 'soccer ball', price: 20, kind: 'gear' },
  boombox: { name: 'boombox', price: 45, kind: 'gear' }, umbrella: { name: 'umbrella', price: 12, kind: 'gear' },
  book: { name: 'paperback', price: 12, kind: 'gear' }, newspaper: { name: 'newspaper', price: 1, kind: 'gear' },
  vinyl: { name: 'vinyl record', price: 18, kind: 'gear' }, flowers: { name: 'flowers', price: 14, kind: 'gear' },
  // arcade prizes (tickets, not dollars: price is what they'd fetch new, for the pawn shop)
  yoyo: { name: 'yo-yo', price: 5, kind: 'gear' }, harmonica: { name: 'harmonica', price: 12, kind: 'gear' },
  duck: { name: 'rubber duck', price: 3, kind: 'gear' }, sparklers: { name: 'sparklers', price: 6, kind: 'toy', uses: 5 },
};
// the arcade's prize counter: what tickets buy
let tickets = 0;
const PRIZES = [['candy', 8], ['duck', 20], ['yoyo', 30], ['sparklers', 35], ['harmonica', 60], ['ball', 90], ['skateboard', 300]];
function claimPrize(id) {
  const p = PRIZES.find(q => q[0] === id);
  if (!p) return [false, 'Not a prize.'];
  if (tickets < p[1]) return [false, `That's ${p[1]} tickets. You have ${tickets}.`];
  if (inv.length >= INV_SIZE) return [false, 'Your hands are full.'];
  tickets -= p[1]; inv.push({ id, uses: ITEMS[id].uses || 0 }); held = inv.length - 1;
  return [true, `You trade ${p[1]} tickets for ${aOrSome(ITEMS[id].name)}.`];
}
// what each kind of place sells: by shop word first, then by room kind
const STOCK_WORD = {
  '24/7': ['sandwich', 'chips', 'soda', 'water', 'energy', 'cigarettes', 'newspaper', 'umbrella'],
  BODEGA: ['sandwich', 'chips', 'apple', 'soda', 'energy', 'cigarettes', 'newspaper'], DELI: ['sandwich', 'bagel', 'chips', 'soda', 'coffee'],
  LIQUOR: ['beer', 'whiskey', 'cigarettes', 'chips'], PHARMACY: ['water', 'energy', 'umbrella'],
  GROCERY: ['apple', 'chips', 'water', 'soda'], MARKET: ['apple', 'chips', 'water'], FRUIT: ['apple'],
  PAWN: ['skateboard', 'boombox', 'umbrella', 'vinyl'], SPORTS: ['ball', 'skateboard', 'water', 'energy'], SKATE: ['skateboard', 'soda'],
  HARDWARE: ['umbrella'], RECORDS: ['vinyl', 'boombox'], BOOKS: ['book', 'newspaper', 'coffee'], FLORIST: ['flowers'],
  CAFE: ['coffee', 'latte', 'croissant', 'donut'], COFFEE: ['coffee', 'latte', 'croissant'], DONUTS: ['donut', 'coffee'], BAKERY: ['bagel', 'croissant', 'donut'],
  PIZZA: ['slice', 'soda'], TACOS: ['taco', 'soda'], KEBAB: ['kebab', 'soda'], DINER: ['burger', 'coffee', 'soda'],
  RAMEN: ['ramen', 'tea'], NOODLES: ['ramen', 'dumplings', 'tea'], PHO: ['pho', 'banhmi', 'tea'], DUMPLINGS: ['dumplings', 'tea'],
  'DIM SUM': ['dumplings', 'tea', 'mooncake'], SUSHI: ['tea', 'dumplings'], THAI: ['padthai', 'greencurry', 'mangorice', 'thaitea'],
  BURGERS: ['burger', 'fries', 'milkshake', 'soda'], CHICKEN: ['chicken', 'fries', 'soda'], JUICE: ['smoothie', 'water', 'apple'],
  'ICE CREAM': ['icecream', 'milkshake'], BAGELS: ['bagel', 'coffee'], TOYS: ['yoyo', 'duck', 'ball', 'sparklers'],
  THRIFT: ['umbrella', 'vinyl', 'book', 'boombox'], TOBACCO: ['cigarettes', 'newspaper', 'candy'],
  'TEA HOUSE': ['tea', 'mooncake'], MAHJONG: ['tea', 'beer'], HERBS: ['herbaltea', 'ginseng', 'tea'],
};
const STOCK_ROOM = { bar: ['beer', 'whiskey', 'cocktail'], karaoke: ['beer', 'cocktail'], diner: ['burger', 'coffee', 'soda'],
                     hotel: ['water', 'soda', 'chips'], arcade: ['soda', 'chips'], gym: ['water', 'energy'], cinema: ['soda', 'chips'] };
const stockFor = (kind, word) => STOCK_WORD[word] || STOCK_ROOM[kind] || [];
// the street carts
const VENDOR_STOCK = { 'HOT DOGS': ['hotdog', 'soda'], TACOS: ['taco', 'soda'], 'ICE CREAM': ['icecream'], COFFEE: ['coffee', 'donut'], NOODLES: ['noodlebox', 'tea'] };

// ---- what you carry: 8 slots, one held. Effects wear off with time.
const INV_SIZE = 8;
const inv = []; // { id, uses }
let held = 0; // which slot is in your hand; -1 = nothing, hands empty
// take slot k in hand, or (if it's already there) put it away and hold nothing
const holdSlot = k => { held = held === k ? -1 : k; };
const fx = { caffeine: 0, booze: 0, smoke: 0, skating: false, boombox: false, song: null, yoyo: 0, spark: 0 };
// the boombox's tapes: which recorded music bed each one plays (see audio-mix.js)
const BOOMBOX_SONGS = ['bossa', 'coffee', 'karaoke', 'arcade'], SONG_NAMES = { bossa: 'Bossa nova', coffee: 'Some cafe jazz', karaoke: 'Sweet Caroline', arcade: 'Arcade chiptunes' };
// B with the boombox playing: on to the next tape, in order
function nextSong() { fx.song = BOOMBOX_SONGS[(BOOMBOX_SONGS.indexOf(fx.song) + 1) % BOOMBOX_SONGS.length]; return SONG_NAMES[fx.song]; }
let cigTip = 0; // how hot the cigarette tip is (a drag heats it)
const heldItem = () => inv[held] || null;
function buy(id) { // false + why, if you can't
  const it = ITEMS[id];
  if (inv.length >= INV_SIZE) return [false, 'Your hands are full.'];
  if (!pay(it.price)) return [false, `${cap(it.name)} is ${fmt$(it.price)}. You can't afford it.`];
  inv.push({ id, uses: it.uses || 0 }); held = inv.length - 1;
  return [true, `You buy ${aOrSome(it.name)}. (${fmt$(it.price)})`];
}
const cap = s => s[0].toUpperCase() + s.slice(1);
const aOrSome = n => /s$/.test(n) && !/ss$/.test(n) ? n : (/^[aeiou]/.test(n) ? 'an ' : 'a ') + n;
// your storage unit: one unit, the same at every STORAGE place in town
const STORE_SIZE = 30, stored = [];
function takeSlot(k) { // carried slot k out of your hands, still holding whatever you were holding
  const was = held, it = inv[k];
  held = k; removeHeld();
  held = was < 0 ? -1 : clamp(was > k ? was - 1 : was, 0, Math.max(0, inv.length - 1)); // (empty hands stay empty)
  return it;
}
function storeSlot(k) { // carried slot k -> the unit
  if (!inv[k]) return [false, 'Nothing there.'];
  if (stored.length >= STORE_SIZE) return [false, 'Your unit is full.'];
  const it = takeSlot(k); stored.push(it);
  return [true, `You put the ${ITEMS[it.id].name} in your unit.`];
}
// pawn shops buy gear off you (not half-eaten food) for a fraction of what it cost new
const SELL_RATE = { PAWN: 0.4 };
const sellPrice = (it, rate) => ITEMS[it.id].kind === 'gear' ? Math.max(0.25, Math.round(ITEMS[it.id].price * rate * 4) / 4) : 0;
function sellSlot(k, rate) {
  if (!inv[k]) return [false, 'Nothing there.'];
  const p = sellPrice(inv[k], rate), name = ITEMS[inv[k].id].name;
  if (!p) return [false, `"We don't take ${name}."`];
  takeSlot(k); earn(p);
  return [true, `You sell the ${name} for ${fmt$(p)}.`];
}
function retrieveSlot(k) { // the unit's item k -> your hands
  if (!stored[k]) return [false, 'Nothing there.'];
  if (inv.length >= INV_SIZE) return [false, 'Your hands are full.'];
  const it = stored.splice(k, 1)[0]; inv.push(it);
  return [true, `You take the ${ITEMS[it.id].name} out of your unit.`];
}
function removeHeld() {
  const it = inv[held];
  if (it && it.id === 'skateboard') fx.skating = false;
  if (it && it.id === 'boombox') fx.boombox = false;
  inv.splice(held, 1); held = clamp(held, 0, Math.max(0, inv.length - 1));
}
// Q: use what's in your hand. Returns a line to show (and the sound to play, see goods-ui.js)
const BOOK_LINES = ['"It was a dark and stormy night..." You read a chapter.', 'A detective novel. The butler, surely.', 'Poetry. You read one, then another.',
  'A guidebook to the city. Half the shops in it have closed.'];
function useHeld(near) {
  const it = heldItem();
  if (!it) return ['Your hands are empty.', null];
  const d = ITEMS[it.id];
  if (d.kind === 'food' || d.kind === 'drink') {
    it.uses--;
    if (d.caffeine) fx.caffeine = Math.min(180, fx.caffeine + d.caffeine / d.uses);
    if (d.booze) fx.booze = Math.min(1.5, fx.booze + d.booze / d.uses);
    if (d.sober) fx.booze = Math.max(0, fx.booze - d.sober / d.uses);
    const done = it.uses <= 0;
    if (done) removeHeld();
    return [done ? (d.kind === 'food' ? `You finish the ${d.name}.` : `You finish the ${d.name}.`) : d.kind === 'food' ? `You take a bite of the ${d.name}.` : `You sip the ${d.name}.`,
            d.kind === 'food' ? 'bite' : 'sip'];
  }
  if (d.kind === 'smoke') {
    if (fx.smoke > 0) { cigTip = 1; return ['You take a drag.', 'drag']; }
    it.uses--; fx.smoke = 45; cigTip = 1;
    if (it.uses <= 0) removeHeld();
    return [`You light a cigarette.${it.uses > 0 ? ` (${it.uses} left)` : ' Last one.'}`, 'light'];
  }
  switch (it.id) {
    case 'skateboard':
      if (near.indoors) return ['Not in here.', null];
      fx.skating = !fx.skating; return [fx.skating ? 'You drop the board and kick off.' : 'You flip the board up into your hand.', 'board'];
    case 'boombox': // a different tape each time you switch it on
      fx.boombox = !fx.boombox;
      if (fx.boombox) fx.song = pick(BOOMBOX_SONGS.filter(s => s !== fx.song));
      return [fx.boombox ? `You hit play. ${SONG_NAMES[fx.song]}.` : 'You stop the tape.', 'click'];
    case 'ball':
      if (near.indoors) return ['Not in here.', null];
      kickBall(near.x, near.y, near.a); removeHeld(); return ['You punt the ball down the street.', 'kick'];
    case 'umbrella': return [near.rain > 0.3 ? 'You hold the umbrella up against the rain.' : 'You twirl the umbrella. It isn\'t raining.', null];
    case 'book': return [pick(BOOK_LINES), 'page'];
    case 'newspaper': return [`Headline: ${pick(near.headlines)}`, 'page'];
    case 'vinyl': return ['You admire the sleeve. Shame you don\'t have a record player.', null];
    case 'yoyo': fx.yoyo = 1.4; return [pick(['Walk the dog.', 'Around the world.', 'Rock the baby.', 'It sleeps at the bottom, then snaps back up.']), 'whirr'];
    case 'harmonica':
      if (near.person) { // a little busking: they stop to listen, and might drop you something
        near.person.talk = 4;
        if (Math.random() < 0.5) { const c = Math.round((0.25 + Math.random() * 1.5) * 4) / 4; earn(c); return [`You play the blues. They listen, and drop you ${fmt$(c)}.`, 'harmonica']; }
        return ['You play the blues. They listen, nod, and move on.', 'harmonica'];
      }
      return ['You play a few bars of the blues.', 'harmonica'];
    case 'duck': return [near.water ? 'You float the duck on the water a while, then fish it back out.' : 'Squeak.', 'squeak'];
    case 'sparklers':
      if (fx.spark > 0) return ['It\'s still fizzing.', null];
      it.uses--; fx.spark = 25;
      if (it.uses <= 0) removeHeld();
      return [`You light a sparkler.${it.uses > 0 ? ` (${it.uses} left)` : ' The last one.'}`, 'light'];
    case 'flowers':
      if (near.person) { removeHeld(); near.person.talk = 4; return [`"For me? Oh!" ${pick(['They light up.', 'They blush.', 'They smell them and grin.'])}`, 'chime']; }
      return ['You sniff the flowers. Lovely.', null];
  }
  return ['Nothing happens.', null];
}
// things you put down stay where you left them till you pick them up again: out on the street (at '') or inside
// somewhere (at = that room's key, see placeKey); outdoors z is the height it's lying at (0, or up on a roof).
// Half-eaten stays half-eaten.
const dropped = []; // { id, uses, x, y, at, z }
function dropHeldAt(x, y, at, z = 0) {
  const it = heldItem();
  if (!it) return null;
  removeHeld(); dropped.push({ id: it.id, uses: it.uses, x, y, at, z });
  return ITEMS[it.id].name;
}
// the nearest thing lying within r of (x, y) in the same place, if any
function droppedNear(x, y, at, r, z = 0) {
  let best = null, bd = r;
  for (const d of dropped) if (d.at === at && Math.abs((d.z || 0) - z) < 0.05) { const e = at ? Math.hypot(d.x - x, d.y - y) : Math.hypot(rel(d.x - x), rel(d.y - y)); if (e < bd) { bd = e; best = d; } }
  return best;
}
function pickUpDropped(d) {
  if (inv.length >= INV_SIZE) return [false, 'Your hands are full.'];
  dropped.splice(dropped.indexOf(d), 1); inv.push({ id: d.id, uses: d.uses }); held = inv.length - 1;
  return [true, `You pick up the ${ITEMS[d.id].name}.`];
}
function stepGoods(dt) {
  if (fx.skating && mode !== 'walk') fx.skating = false;
  fx.caffeine = Math.max(0, fx.caffeine - dt); fx.booze = Math.max(0, fx.booze - dt / 120); fx.smoke = Math.max(0, fx.smoke - dt);
  fx.yoyo = Math.max(0, fx.yoyo - dt); fx.spark = Math.max(0, fx.spark - dt);
  cigTip = Math.max(0, cigTip - dt * 0.8);
  return stepBall(dt);
}
// how fast you walk, from what you've had and what you're riding
const footSpeed = () => (fx.skating ? 1.8 : 1) * (fx.caffeine > 0 ? 1.25 : 1);

// ---- the soccer ball, once kicked: rolls, slows, bounces off walls, sinks in the sea; walk into it to dribble,
// E to pick it up
let ball = null; // { x, y, vx, vy, z, vz }
function kickBall(x, y, a, power = 2.6) {
  ball = { x: x + Math.cos(a) * 0.12, y: y + Math.sin(a) * 0.12, vx: Math.cos(a) * power, vy: Math.sin(a) * power, z: 0.02, vz: power * 0.25 };
}
function stepBall(dt) {
  if (!ball) return;
  ball.vz -= 2 * dt; ball.z += ball.vz * dt;
  if (ball.z < 0) { ball.z = 0; ball.vz = Math.abs(ball.vz) > 0.08 ? -ball.vz * 0.5 : 0; }
  const f = Math.max(0, 1 - (ball.z > 0 ? 0.2 : 1.1) * dt); ball.vx *= f; ball.vy *= f;
  for (const ax of ['x', 'y']) { // move one axis at a time, bouncing off whatever's solid
    const nx = ax === 'x' ? ball.x + ball.vx * dt : ball.x, ny = ax === 'y' ? ball.y + ball.vy * dt : ball.y;
    if (map[idx(Math.floor(nx), Math.floor(ny))] > ball.z) { if (ax === 'x') ball.vx *= -0.6; else ball.vy *= -0.6; }
    else { ball.x = mod(nx, N); ball.y = mod(ny, N); }
  }
  if (isWater(ball.x, ball.y) && ball.z === 0) { ball = null; return 'lost'; } // into the drink
  // dribbling: walk into it and it rolls on ahead of you
  const dx_ = rel(ball.x - px), dy_ = rel(ball.y - py), d = Math.hypot(dx_, dy_);
  if (d < 0.07 && mode === 'walk') { const s = 0.9; ball.vx += dx_ / (d || 1) * s; ball.vy += dy_ / (d || 1) * s; }
  return null;
}
function pickUpBall() {
  if (!ball || Math.hypot(rel(ball.x - px), rel(ball.y - py)) > 0.3 || inv.length >= INV_SIZE) return false;
  ball = null; inv.push({ id: 'ball', uses: 0 }); held = inv.length - 1; return true;
}

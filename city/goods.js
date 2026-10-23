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
  sushi: { name: 'sushi', price: 12, kind: 'food', uses: 4 },
  pho: { name: 'pho', price: 11, kind: 'food', uses: 5 }, banhmi: { name: 'banh mi', price: 7, kind: 'food', uses: 4 },
  padthai: { name: 'pad thai', price: 11, kind: 'food', uses: 5 }, greencurry: { name: 'green curry', price: 12, kind: 'food', uses: 5 },
  mangorice: { name: 'mango sticky rice', price: 6, kind: 'food', uses: 3 },
  cottoncandy: { name: 'cotton candy', price: 3, kind: 'food', uses: 3 }, corndog: { name: 'corn dog', price: 4, kind: 'food', uses: 3 },
  popcorn: { name: 'popcorn', price: 3, kind: 'food', uses: 5 }, lemonade: { name: 'lemonade', price: 3, kind: 'drink', uses: 3 },
  yakitori: { name: 'yakitori', price: 6, kind: 'food', uses: 3 }, takoyaki: { name: 'takoyaki', price: 5, kind: 'food', uses: 4 },
  onigiri: { name: 'onigiri', price: 3, kind: 'food', uses: 2 }, bento: { name: 'bento box', price: 9, kind: 'food', uses: 5 },
  sake: { name: 'sake', price: 7, kind: 'drink', uses: 2, booze: 0.35 }, melonsoda: { name: 'melon soda', price: 3, kind: 'drink', uses: 3 },
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
  cigarettes: { name: 'cigarettes', price: 10, kind: 'smoke', uses: 5 }, pipe: { name: 'pipe', price: 18, kind: 'smoke', uses: 4 },
  vape: { name: 'mango vape', price: 25, kind: 'gear' },
  // gear
  skateboard: { name: 'skateboard', price: 60, kind: 'gear' }, ball: { name: 'soccer ball', price: 20, kind: 'gear' },
  boombox: { name: 'boombox', price: 45, kind: 'gear' }, umbrella: { name: 'umbrella', price: 12, kind: 'gear' },
  book: { name: 'paperback', price: 12, kind: 'gear' }, newspaper: { name: 'newspaper', price: 1, kind: 'gear' },
  vinyl: { name: 'vinyl record', price: 18, kind: 'gear' }, flowers: { name: 'flowers', price: 14, kind: 'gear' },
  movinglamp: { name: 'moving-day table lamp', price: 0, kind: 'gear' },
  telescope: {name:'brass telescope',price:85,kind:'gear'},
  // property (property.js): not carried, owned
  car_hatch: { name: 'old hatchback', price: 450, kind: 'car' }, car_sedan: { name: 'sedan', price: 1500, kind: 'car' },
  car_sports: { name: 'sports car', price: 4000, kind: 'car' },
  // a car's keys (you get them with it; Q calls it round to you, see property.js). Not for sale, not worth anything
  key_car_hatch: { name: 'hatchback keys', price: 0, kind: 'keys', car: 'car_hatch' }, key_car_sedan: { name: 'sedan keys', price: 0, kind: 'keys', car: 'car_sedan' },
  key_car_sports: { name: 'sports car keys', price: 0, kind: 'keys', car: 'car_sports' },
  home_studio: { name: 'studio apartment', price: 1200, kind: 'home' }, home_loft: { name: 'loft', price: 4200, kind: 'home' },
  home_belle: { name: 'Belle Époque residence', price: 11000, kind: 'home' },
  // a change of look (nothing to carry: it's on you), which makes you harder to place (notoriety.js)
  haircut: { name: 'haircut', price: 15, kind: 'look', look: 'haircut', line: 'Twenty minutes in the chair, a mirror held up behind you. You look like somebody else. Somebody tidier.' },
  coat: { name: 'secondhand coat', price: 25, kind: 'look', look: 'coat', line: 'You leave in a coat that used to be somebody else\'s. It fits well enough. The old one goes in the donation bin.' },
  // tattoos (the tattoo parlour): not carried, they're on you for good. hours: how long you sit for it; where: on you
  tattoo_swallow: { name: 'swallow', price: 60, kind: 'tattoo', hours: 1, where: 'on the back of your hand' },
  tattoo_anchor: { name: 'anchor', price: 80, kind: 'tattoo', hours: 1, where: 'on your forearm' },
  tattoo_rose: { name: 'rose', price: 120, kind: 'tattoo', hours: 2, where: 'on your other forearm' },
  tattoo_dagger: { name: 'dagger through a heart', price: 150, kind: 'tattoo', hours: 2, where: 'on your upper arm' },
  tattoo_panther: { name: 'crawling panther', price: 220, kind: 'tattoo', hours: 3, where: 'climbing up your arm' },
  tattoo_koi: { name: 'koi half sleeve', price: 480, kind: 'tattoo', hours: 5, where: 'from your elbow to your shoulder, waves and all' },
  // arcade prizes (tickets, not dollars: price is what they'd fetch new, for the pawn shop)
  vhs: { name: 'VHS tape', price: 4, kind: 'gear' },
  yoyo: { name: 'yo-yo', price: 5, kind: 'gear' }, harmonica: { name: 'harmonica', price: 12, kind: 'gear' },
  duck: { name: 'rubber duck', price: 3, kind: 'gear' }, jadebangle: { name: 'jade bangle', price: 15, kind: 'gear' }, jadedragon: { name: 'jade dragon', price: 45, kind: 'gear' }, sharkplush: { name: 'plush shark', price: 15, kind: 'gear' }, plushcat: { name: 'lucky cat plush', price: 12, kind: 'gear' }, plushbear: { name: 'plush bear', price: 12, kind: 'gear' }, snowglobe: { name: 'snow globe', price: 9, kind: 'gear' }, sparklers: { name: 'sparklers', price: 6, kind: 'toy', uses: 5 },
  petcat: { name: 'pet cat carrier', price: 80, kind: 'pet' },
  petdog: { name: 'pet dog carrier', price: 80, kind: 'pet' },
  spraypaint: { name: 'spray paint', price: 8, kind: 'toy', uses: 6 }, // (graffiti.js)
  // the Chinatown night market (nightmarket.js): street food, charms, curios
  // (each does something: heal = health back, a whole one; fill = hunger filled, a whole one, whatever the price; sugar = a rush like caffeine)
  bao: { name: 'pork bao', price: 4, kind: 'food', uses: 3, heal: 15 }, eggwaffle: { name: 'egg waffle', price: 5, kind: 'food', uses: 4, sugar: 45 },
  stinkytofu: { name: 'stinky tofu', price: 4, kind: 'food', uses: 3, fill: 60 }, bubbletea: { name: 'bubble tea', price: 5, kind: 'drink', uses: 4, caffeine: 30 },
  fortunecookie: { name: 'fortune cookie', price: 2, kind: 'food', uses: 1 }, // a fortune with a stock tip in it that comes true (stocks.js)
  redstring: { name: 'red string bracelet', price: 8, kind: 'gear' }, luckycoin: { name: 'lucky coin', price: 15, kind: 'gear' },
  tigerbalm: { name: 'tiger balm', price: 12, kind: 'toy', uses: 3 }, // rub it in: health back
  lantern: { name: 'paper lantern', price: 10, kind: 'gear' }, // held after dark: light round you
  firecrackers: { name: 'firecrackers', price: 6, kind: 'toy', uses: 3 }, // a distraction: the cops look the other way
  mysterybox: { name: 'mystery box', price: 20, kind: 'toy', uses: 1 },
  goldfish: { name: 'goldfish in a bag', price: 3, kind: 'gear' }, // (won at the night market's tub)
  // the two that bend the world: carry the watch and T hurries the hours along; shake the globe and the sky changes
  pocketwatch: { name: 'cursed pocket watch', price: 300, kind: 'gear' }, // (the prize counters' top prize, for tickets)
  cityglobe: { name: 'Glyphport snow globe', price: 350, kind: 'gear' },
  postcard: { name: 'museum postcard', price: 2, kind: 'gear' }, dinotoy: { name: 'toy T. rex', price: 8, kind: 'gear' }, replicastar: { name: 'replica Glyphport Star', price: 15, kind: 'gear' }, // (the museum gift shop)
  orrery: { name: 'Equinox Orrery', price: 2500, kind: 'gear' }, // (the museum's: turn the crank and the season turns with it. Only a thief owns one)
  diamond: { name: 'the Glyphport Star', price: 6000, kind: 'gear' }, // (the museum's diamond: fence it at the pawn shop)
  hotelmasterpiece: { name: 'stolen hotel painting', price: 9000, kind: 'gear' },
  hotelharbour: { name: 'Harbour at First Light', price: 6000, kind: 'gear' },
  hotelstilllife: { name: 'Midnight Supper', price: 4500, kind: 'gear' },
};
// the arcade's prize counter: what tickets buy
let tickets = 0;
const PRIZES = [['candy', 8], ['duck', 20], ['yoyo', 30], ['sparklers', 35], ['harmonica', 60], ['ball', 90], ['skateboard', 300], ['pocketwatch', 1500]];
function claimPrize(id) {
  const p = PRIZES.find(q => q[0] === id);
  if (!p) return [false, 'Not a prize.'];
  if (tickets < p[1]) return [false, `That's ${p[1]} tickets. You have ${tickets}.`];
  if (inv.length >= INV_SIZE) return [false, 'Your bag is full.'];
  tickets -= p[1]; carryItem({ id, uses: ITEMS[id].uses || 0 });
  return [true, `You trade ${p[1]} tickets for ${aOrSome(ITEMS[id].name)}.`];
}
// what each kind of place sells: by shop word first, then by room kind
const STOCK_WORD = {
  'FAIR FOOD': ['corndog', 'popcorn', 'cottoncandy', 'lemonade'],
  MUSEUM: ['postcard', 'dinotoy', 'replicastar'], // (the gift shop)
  'STREET FOOD': ['bao', 'eggwaffle', 'stinkytofu', 'bubbletea'], CHARMS: ['redstring', 'luckycoin', 'fortunecookie', 'tigerbalm'], CURIOS: ['mysterybox', 'lantern', 'firecrackers', 'cityglobe'], // (the night market's stalls)
  YAKITORI: ['yakitori', 'beer', 'sake'], TAKOYAKI: ['takoyaki', 'melonsoda'], BENTO: ['bento', 'onigiri', 'tea'], IZAKAYA: ['beer', 'sake', 'yakitori'],
  KISSATEN: ['coffee', 'melonsoda', 'sandwich'], DRUGSTORE: ['water', 'energy', 'umbrella', 'candy'], MANGA: ['book'], CAPSULE: ['water', 'onigiri'],
  '24/7': ['sandwich', 'chips', 'soda', 'water', 'energy', 'cigarettes', 'newspaper', 'umbrella', 'eggs', 'bread', 'drynoodles'],
  BODEGA: ['sandwich', 'chips', 'apple', 'soda', 'energy', 'cigarettes', 'newspaper', 'eggs', 'bread', 'pasta', 'rice'], DELI: ['sandwich', 'bagel', 'chips', 'soda', 'coffee', 'bread', 'cheese', 'bacon', 'butter'],
  LIQUOR: ['beer', 'whiskey', 'cigarettes', 'chips'], PHARMACY: ['water', 'energy', 'umbrella'],
  GROCERY: ['apple', 'chips', 'water', 'soda', 'eggs', 'bread', 'butter', 'cheese', 'rice', 'pasta', 'drynoodles', 'potatoes', 'onion', 'tomatoes', 'garlic', 'mushrooms', 'greens', 'peppers', 'chilli', 'lemon', 'rawchicken', 'mince', 'bacon', 'tofu'], // (and the makings of dinner: cooking.js)
  MARKET: ['apple', 'chips', 'water', 'potatoes', 'onion', 'tomatoes', 'garlic', 'mushrooms', 'greens', 'peppers', 'chilli', 'lemon'], FRUIT: ['apple', 'lemon', 'tomatoes'],
  PAWN: ['telescope', 'skateboard', 'boombox', 'umbrella', 'vinyl'], SPORTS: ['ball', 'skateboard', 'water', 'energy'], SKATE: ['skateboard', 'soda', 'spraypaint'],
  HARDWARE: ['umbrella', 'spraypaint'], RECORDS: ['vinyl', 'boombox'], BOOKS: ['book', 'newspaper', 'coffee'], FLORIST: ['flowers'],
  CAFE: ['coffee', 'latte', 'croissant', 'donut'], COFFEE: ['coffee', 'latte', 'croissant'], DONUTS: ['donut', 'coffee'], BAKERY: ['bagel', 'croissant', 'donut'],
  PIZZA: ['slice', 'soda'], TACOS: ['taco', 'soda'], KEBAB: ['kebab', 'soda'], DINER: ['burger', 'coffee', 'soda'],
  RAMEN: ['ramen', 'tea'], NOODLES: ['ramen', 'dumplings', 'tea'], PHO: ['pho', 'banhmi', 'tea'], DUMPLINGS: ['dumplings', 'tea'],
  'DIM SUM': ['dumplings', 'tea', 'mooncake'], SUSHI: ['sushi', 'tea'], VIDEO: ['vhs', 'candy', 'soda'], THAI: ['padthai', 'greencurry', 'mangorice', 'thaitea'],
  BURGERS: ['burger', 'fries', 'milkshake', 'soda'], CHICKEN: ['chicken', 'fries', 'soda'], JUICE: ['smoothie', 'water', 'apple'],
  'ICE CREAM': ['icecream', 'milkshake'], BAGELS: ['bagel', 'coffee'], TOYS: ['yoyo', 'duck', 'ball', 'sparklers'],
  THRIFT: ['coat', 'umbrella', 'vinyl', 'book', 'boombox'], BARBER: ['haircut'], TOBACCO: ['cigarettes', 'pipe', 'vape', 'newspaper'],
  CARS: ['car_hatch', 'car_sedan', 'car_sports'], REALTY: ['home_studio', 'home_loft', 'home_belle'],
  DELICATESSEN: ['sandwich', 'bagel', 'chips', 'soda', 'coffee', 'bread', 'cheese', 'bacon', 'butter'], JEWELER: ['jadebangle', 'luckycoin', 'redstring'], ANTIQUES: ['vinyl', 'book', 'harmonica', 'lantern'], TAILOR: ['umbrella'],
  TATTOO: ['tattoo_swallow', 'tattoo_anchor', 'tattoo_rose', 'tattoo_dagger', 'tattoo_panther', 'tattoo_koi'],
  GAS: ['hotdog', 'coffee', 'candy', 'chips', 'soda', 'energy', 'water', 'cigarettes'], // (the shop, not the pumps: you never need gas)
  'TEA HOUSE': ['tea', 'mooncake'], JADE: ['jadebangle', 'jadedragon'], 'PET SHOP': ['petcat', 'petdog'], CASINO: ['cocktail', 'whiskey', 'water'], VELVET: ['beer', 'whiskey', 'cocktail'], MAHJONG: ['tea', 'beer'], HERBS: ['herbaltea', 'ginseng', 'tea'],
};
const STOCK_ROOM = { bar: ['beer', 'whiskey', 'cocktail'], karaoke: ['beer', 'cocktail'], diner: ['burger', 'coffee', 'soda'],
                     hotel: ['water', 'soda', 'chips'], arcade: ['soda', 'chips'], gym: ['water', 'energy'], cinema: ['soda', 'chips'] };
// (and the pawnbroker, after nine, has something under the counter: gun.js)
const stockFor = (kind, word) => word === 'PAWN' && underCounter(tod) ? [...STOCK_WORD.PAWN, ...UNDER_COUNTER] : STOCK_WORD[word] || STOCK_ROOM[kind] || [];
// the street carts
const VENDOR_STOCK = { 'COTTON CANDY': ['cottoncandy', 'lemonade'], 'HOT DOGS': ['hotdog', 'soda'], TACOS: ['taco', 'soda'], 'ICE CREAM': ['icecream'], COFFEE: ['coffee', 'donut'], NOODLES: ['noodlebox', 'tea'] };

// ---- what you carry: a 24-item bag and 8 quick slots; one item in hand. Effects wear off with time.
const INV_SIZE = 24, QUICK_SLOTS = 8;
const inv = []; // { id, uses }
const quickSlots = Array(QUICK_SLOTS).fill(-1); // inventory indexes; empty slots are -1
let held = 0; // which slot is in your hand; -1 = nothing, hands empty
// take slot k in hand, or (if it's already there) put it away and hold nothing
const holdSlot = k => { held = held === k ? -1 : k; };
function assignQuickSlot(k, slot) {
  if (!inv[k] || slot < -1 || slot >= QUICK_SLOTS) return false;
  for (let i = 0; i < QUICK_SLOTS; i++) if (quickSlots[i] === k) quickSlots[i] = -1;
  if (slot >= 0) quickSlots[slot] = k;
  return true;
}
function carryItem(it, select = true) {
  if (inv.length >= INV_SIZE) return -1;
  const k = inv.push(it) - 1, slot = quickSlots.indexOf(-1);
  if (slot >= 0) quickSlots[slot] = k;
  if (select) held = k;
  return k;
}
function clearInventory() { inv.length = 0; quickSlots.fill(-1); held = -1; }
function removeInventoryAt(k) {
  inv.splice(k, 1);
  for (let s = 0; s < QUICK_SLOTS; s++) quickSlots[s] = quickSlots[s] === k ? -1 : quickSlots[s] > k ? quickSlots[s] - 1 : quickSlots[s];
  held = held < 0 ? -1 : held > k ? held - 1 : held === k ? clamp(k, 0, Math.max(0, inv.length - 1)) : held;
}
function holdQuickSlot(slot) { const k = quickSlots[slot]; if (k >= 0 && inv[k]) holdSlot(k); }
function cycleQuickSlot(direction) {
  const choices = [-1, ...quickSlots.filter(k => k >= 0 && inv[k])], at = choices.indexOf(held);
  held = choices[mod((at < 0 ? 0 : at) + direction, choices.length)];
}
const fx = { stink: 0, bang: 0, pipe: false, vape: 0, cloud: 0, caffeine: 0, booze: 0, smoke: 0, skating: false, boombox: false, song: null, yoyo: 0, spark: 0, fresh: 0, fed: 0 }; // (fed: well fed, after a perfect dish: cooking.js)
let heldUse = null; // a short visual gesture, tied to this inventory item rather than its slot
function animateHeldUse(it) {
  const d = ITEMS[it.id];
  if (d.kind === 'gun' || d.rod || ['yoyo', 'skateboard', 'ball'].includes(it.id)) return;
  heldUse = { item: it, t: T, duration: d.kind === 'drink' ? .7 : .65 };
}
// the boombox's tapes: which recorded music bed each one plays (see audio-mix.js)
// luck: carry jade and the odds tip your way a little (pachinko, mahjong; more to come). The bangle's barely
// anything, the dragon's a bit more, and they add up
const carrying = id => inv.some(it => it.id === id);
let goldenDuckDue = false, fortuneLuckT = -1; // (a fortune teller's promises: a gold duck in the next pond; luck at the games till then)
const luck = () => (carrying('jadebangle') ? 0.03 : 0) + (carrying('jadedragon') ? 0.08 : 0) + (carrying('plushcat') ? 0.02 : 0) // (and the lucky cat, a little)
  + (carrying('redstring') ? 0.02 : 0) + (carrying('luckycoin') ? 0.03 : 0) // (the night market's charms)
  + (T < fortuneLuckT ? 0.06 : 0); // (and the fortune teller said so)
// The yo-yo is steered by a virtual cursor bounded to a circle around the hand. Cursor distance pays out string;
// direction sets the target position, while the yo-yo carries momentum as it catches up.
const yoyo = { out: false, len: 0, lenV: 0, ang: 0, angV: 0, spin: 0, aimX: 0, aimY: 0 };
// Exact damped-spring motion keeps the same response through uneven frame times.
function yoyoSpring(value, velocity, target, stiffness, damping, dt) {
  const decay = damping / 2, frequency = Math.sqrt(stiffness - decay * decay);
  const offset = value - target, fade = Math.exp(-decay * dt), c = Math.cos(frequency * dt), s = Math.sin(frequency * dt);
  return [target + fade * (offset * c + (velocity + decay * offset) * s / frequency),
    fade * (velocity * c - (decay * velocity + stiffness * offset) * s / frequency)];
}
function stepYoyo(dt) {
  const targetLen = yoyo.out ? Math.hypot(yoyo.aimX, yoyo.aimY) : 0;
  [yoyo.len, yoyo.lenV] = yoyoSpring(yoyo.len, yoyo.lenV, targetLen, 36, 8, dt);
  yoyo.len = clamp(yoyo.len, 0, 1);
  if ((yoyo.len === 0 && yoyo.lenV < 0) || (yoyo.len === 1 && yoyo.lenV > 0)) yoyo.lenV = 0;
  // Direction is undefined at the hand: let momentum coast instead of snapping toward tiny cursor movements.
  if (yoyo.out && targetLen <= .04) {
    const fade = Math.exp(-6 * dt);
    yoyo.ang += yoyo.angV * (1 - fade) / 6; yoyo.angV *= fade;
  } else {
    const targetAng = yoyo.out ? Math.atan2(yoyo.aimX, yoyo.aimY) : 0;
    const da = mod(targetAng - yoyo.ang + Math.PI, Math.PI * 2) - Math.PI;
    [yoyo.ang, yoyo.angV] = yoyoSpring(yoyo.ang, yoyo.angV, yoyo.ang + da, 34, 6, dt);
  }
  yoyo.ang = mod(yoyo.ang + Math.PI, Math.PI * 2) - Math.PI;
  if (yoyo.out || yoyo.len > 0) yoyo.spin += dt * (20 + Math.abs(yoyo.angV) * 6);
  if (!yoyo.out && yoyo.len < .01 && Math.abs(yoyo.lenV) < .08 && Math.abs(yoyo.ang) < .01 && Math.abs(yoyo.angV) < .05) {
    yoyo.len = yoyo.lenV = yoyo.ang = yoyo.angV = 0; yoyo.aimX = yoyo.aimY = 0;
  }
  fx.yoyo = yoyo.len > 0 || yoyo.out ? 1 : 0;
}
// About 200 screen pixels reaches the end of the string. Clamp the virtual cursor to its hand-centered circle.
const yoyoSwing = (dx, dy = 0) => {
  const x = yoyo.aimX + dx / 200, y = yoyo.aimY + dy / 200, r = Math.hypot(x, y);
  yoyo.aimX = r > 1 ? x / r : x; yoyo.aimY = r > 1 ? y / r : y;
};
const BOOMBOX_SONGS = ['bossa', 'coffee', 'karaoke', 'arcade', 'aquarium'], SONG_NAMES = { bossa: 'Bossa nova', coffee: 'Some cafe jazz', karaoke: 'Sweet Caroline', arcade: 'Arcade chiptunes', aquarium: 'Aquarium music' };
// B with the boombox playing: on to the next tape, in order
function nextSong() { fx.song = BOOMBOX_SONGS[(BOOMBOX_SONGS.indexOf(fx.song) + 1) % BOOMBOX_SONGS.length]; return SONG_NAMES[fx.song]; }
let cigTip = 0; // how hot the cigarette tip is (a drag heats it)
const heldItem = () => inv[held] || null;
function buy(id) { // false + why, if you can't
  const it = ITEMS[id];
  if (it.kind === 'car' || it.kind === 'home') { const [x, y] = room && room.ret ? room.ret : [px, py]; return buyProperty(id, x, y); }
  if (it.kind === 'tattoo') return getTattoo(id);
  if (it.kind === 'look') return pay(it.price) ? [true, `${it.line}${changeLook(it.look)} (${fmt$(it.price)})`] : [false, `A ${it.name} is ${fmt$(it.price)}. You can't afford it.`];
  if (inv.length >= INV_SIZE) return [false, 'Your bag is full.'];
  if ((it.kind === 'gun' || it.kind === 'ammo') && wanted.stars > 0) return [false, '"Not with the police out looking for you. Come back when it\'s quiet."'];
  if (!pay(it.price)) return [false, it.kind === 'gun' ? `"${fmt$(it.price)}. Cash. I don't do layaway."` : `${cap(it.name)} is ${fmt$(it.price)}. You can't afford it.`];
  carryItem({ id, uses: it.uses || 0 });
  if (it.kind === 'gun') return [true, `${GUN_SOLD} (${fmt$(it.price)})${ammoLeft() ? '' : ' It isn\'t loaded. You\'ll want a box of rounds.'}`];
  if (it.kind === 'ammo') return [true, `A box of ${it.uses} rounds goes across the counter in a paper bag. (${fmt$(it.price)})`];
  return [true, `You buy ${aOrSome(it.name)}. (${fmt$(it.price)})${it.rod ? ' Hold Q to wind up and let go to cast; when the bobber goes under, Q to strike.' : ''}`];
}
const cap = s => s[0].toUpperCase() + s.slice(1);
const aOrSome = n => /s$/.test(n) && !/ss$/.test(n) ? n : (/^[aeiou]/.test(n) ? 'an ' : 'a ') + n;
// your storage unit: one unit, the same at every STORAGE place in town
const STORE_SIZE = 30, HOME_STORE_SIZE = 120, stored = [], closet = []; // the larger home stash is shared between apartments
// your ink (tattoo ids, oldest first): sit in the chair, pay, and the hours go by
const tattoos = [];
function getTattoo(id) {
  const it = ITEMS[id];
  if (tattoos.includes(id)) return [false, `You've already got the ${it.name}. Pick something new off the wall.`];
  if (!pay(it.price)) return [false, `The ${it.name} is ${fmt$(it.price)}. Come back when you've saved up.`];
  tattoos.push(id);
  for (tod += it.hours; tod >= 24; tod -= 24) dayNum++;
  return [true, `${it.hours > 1 ? it.hours + ' hours' : 'An hour'} in the chair. The ${it.name}, ${it.where}. It stings, and it's perfect.${changeLook('tattoo')} (${fmt$(it.price)})`];
}
// what you could walk off with (not a car, a flat or somebody's needlework)
const stealable = stock => stock.filter(id => !['car', 'home', 'tattoo', 'look', 'gun', 'ammo'].includes(ITEMS[id].kind)); // (nor what's under the counter)
const isHomeDecor = it => !!it && ITEMS[it.id] && ITEMS[it.id].kind === 'gear' && !['skateboard', 'boombox', 'umbrella', 'ball', 'goldfish'].includes(it.id);
const isFridgeItem = it => !!it && ITEMS[it.id] && ['food', 'drink', 'fish', 'ingredient'].includes(ITEMS[it.id].kind);
function takeSlot(k) { // carried slot k out of your hands, still holding whatever you were holding
  const was = held, it = inv[k];
  held = k; removeHeld();
  held = was < 0 ? -1 : clamp(was > k ? was - 1 : was, 0, Math.max(0, inv.length - 1)); // (empty hands stay empty)
  return it;
}
function storeSlot(k, list = stored, where = 'your unit', accepts = null, capacity = STORE_SIZE) { // carried slot k -> the unit (or the closet)
  if (!inv[k]) return [false, 'Nothing there.'];
  if (accepts && !accepts(inv[k])) return [false, where === 'the fridge' ? 'The fridge only keeps food and drinks.' : 'That does not belong on the shelf.'];
  if (list.length >= capacity) return [false, `${cap(where)} is full.`];
  const it = takeSlot(k); list.push(it);
  return [true, `You put the ${ITEMS[it.id].name} in ${where}.`];
}
// pawn shops buy gear off you (not half-eaten food) for a fraction of what it cost new
// (and the bait hut buys what you catch: rate 'catch', see catchPrice in fishing.js; it bins your junk for nothing)
const SELL_RATE = { PAWN: 0.4, 'BAIT & TACKLE': 'catch', SUSHI: 'sushi' }; // (and the sushi bars, sea fish only: sushiPrice)
const sellPrice = (it, rate) => rate === 'catch' ? catchPrice(it) : rate === 'sushi' ? sushiPrice(it) : ['gear', 'gun'].includes(ITEMS[it.id].kind) ? Math.max(0.25, Math.round(ITEMS[it.id].price * rate * 4) / 4) : 0;
const binnable = (it, rate) => rate === 'catch' && ITEMS[it.id].kind === 'junk';
function sellSlot(k, rate) {
  if (!inv[k]) return [false, 'Nothing there.'];
  const p = sellPrice(inv[k], rate), name = ITEMS[inv[k].id].name;
  if (!p && binnable(inv[k], rate)) { takeSlot(k); return [true, `They take the ${name} off your hands and drop it in the bin.`]; }
  if (!p && rate === 'sushi' && ITEMS[inv[k].id].kind === 'fish') return [false, `"Fish from the sea only. Not ${name}."`];
  if (!p) return [false, `"We don't take ${name}."`];
  const it = takeSlot(k); earn(p);
  return [true, `You sell the ${it.kg ? catchName(it) : name} for ${fmt$(p)}.`];
}
function retrieveSlot(k, list = stored, where = 'your unit') { // the unit's item k -> your hands
  if (!list[k]) return [false, 'Nothing there.'];
  if (inv.length >= INV_SIZE) return [false, 'Your bag is full.'];
  const it = list.splice(k, 1)[0]; carryItem(it, false);
  return [true, `You take the ${ITEMS[it.id].name} out of ${where}.`];
}
function removeHeld() {
  const it = inv[held];
  if (it && it.id === 'skateboard') fx.skating = false;
  if (it && it.id === 'boombox') fx.boombox = false;
  removeInventoryAt(held);
}
// Q: use what's in your hand. Returns a line to show (and the sound to play, see goods-ui.js)
const BOOK_LINES = ['"It was a dark and stormy night..." You read a chapter.', 'A detective novel. The butler, surely.', 'Poetry. You read one, then another.',
  'A guidebook to the city. Half the shops in it have closed.'];
function useHeld(near) {
  if(wanted.busted)return ['',null];
  const it = heldItem();
  if (!it) return fx.smoke>0 ? takeSmokeDrag() : ['Your hands are empty.', null];
  const d = ITEMS[it.id];
  if (d.kind === 'drug') return consumeDrug(it);
  animateHeldUse(it);
  if (d.kind === 'food' || d.kind === 'drink') {
    const feel = eatSome(it.id, d, it.q ? DISH_EAT[it.q] : 1); // (needs.js; a dish you cooked eats as well as you cooked it)
    if (it.q === 'perfect') fx.fed = Math.max(fx.fed, WELL_FED);
    it.uses--;
    if (d.caffeine) fx.caffeine = Math.min(180, fx.caffeine + d.caffeine / d.uses);
    if (d.sugar) fx.caffeine = Math.min(180, fx.caffeine + d.sugar / d.uses); // (a sugar rush: you go quicker, same as coffee)
    if (d.heal) needs.health = Math.min(maxHealth(), needs.health + d.heal / d.uses);
    if (it.id === 'stinkytofu') fx.stink = 150; // (and you'll smell of it a while)
    if (d.booze) fx.booze = Math.min(1.5, fx.booze + d.booze / d.uses);
    if (d.sober) fx.booze = Math.max(0, fx.booze - d.sober / d.uses);
    if (d.sober) clearDrugEffects(30);
    const done = it.uses <= 0;
    if (done) removeHeld();
    if (it.id === 'fortunecookie') return [`You crack it open. The fortune reads: "${fortune()}"`, 'bite'];
    if (d.cooked) { const nm = dishName(it), q = it.q; return [(done ? `You finish the ${nm}.` : q === 'burnt' ? pick([`The ${nm} is burnt. You eat it anyway.`, `Crunchy. Black. ${cap(nm)}, technically.`]) : q === 'perfect' ? pick([`The ${nm} is exactly right.`, `You made this ${nm}, and it's good.`]) : `You take a bite of the ${nm}.`) + feel, 'bite']; }
    return [(done ? `You finish the ${d.name}.` : d.kind === 'food' ? `You take a bite of the ${d.name}.` : `You sip the ${d.name}.`) + feel,
            it.id === 'soda' && it.uses === 2 ? 'cancrush' : d.kind === 'food' ? 'bite' : 'sip'];
  }
  if (d.kind === 'smoke') {
    if (it.id==='joint') return lightJoint(it);
    if (fx.smoke > 0) return takeSmokeDrag();
    const pipe = it.id === 'pipe';
    it.uses--; fx.smoke = pipe ? 70 : 45; fx.pipe = pipe; fx.smokeKind=pipe?'pipe':'cigarette';cigTip = 1;
    if (it.uses <= 0) removeHeld();
    if (pipe) return [`You pack the bowl and light the pipe.${it.uses > 0 ? ` (${it.uses} bowls left)` : ' The last of the tobacco.'}`, 'light'];
    return [`You light a cigarette.${it.uses > 0 ? ` (${it.uses} left)` : ' Last one.'}`, 'light'];
  }
  if (d.kind === 'keys') return summonCar(d.car);
  if (d.kind === 'ammo') return [`${it.uses} rounds in a cardboard box. With the revolver in your hand, R loads them.`, null];
  if (d.kind === 'gun') return ['', null]; // (Q fires it: gun-ui.js)
  if (d.rod) return rodUse(near); // (fishing.js)
  if (d.kind === 'fish') return [pick([`The ${d.name} looks at you. You look at the ${d.name}.`, `A ${catchName(it)}. The hut by the Sunset Pier will take it off you.`, `You hold the ${d.name} up. It is, unmistakably, a fish.`]), null];
  if (d.kind === 'ingredient') return [pick([`You'll want to cook the ${d.name} first. The stove at home, or a grill down by the water.`, `Raw ${d.name}. It needs a pan.`]), null];
  if (d.kind === 'junk') return [pick([`It's still ${aOrSome(d.name)}.`, 'You turn it over. No, still junk. The bait hut will bin it for you.']), null];
  switch (it.id) {
    case 'goldkoi': return koiWish();
    case 'bottlemsg': return readBottle();
    case 'oldcoin': return [`You turn the coin over. Heads: the king. Tails: a ship.`, 'click'];
    case 'goldring': return ['You try the ring on. It fits. "Again?" it says, on the inside.', null];
    case 'pearl': return ['You roll the pearl in your palm. It is the only perfectly round thing you own.', null];
    case 'compass': return ['The needle swings round and settles. North is where it always was.', null];
    case 'divewatch': return [`The watch says ${String(Math.floor(tod)).padStart(2, '0')}:${String(Math.floor(fract(tod) * 60)).padStart(2, '0')}. It has never been wrong.`, 'click'];
    case 'pocketknife': return ['A good knife. The gardeners\' crest on the handle. You could hand it in at the gardens. You could.', null];
    case 'vape': // hold Q to pull, let go to blow it out (stepGoods)
      if (fx.vape > 0) return ['', null];
      fx.vape = 0.001; return ['', 'drag'];
    case 'skateboard':
      if (near.indoors || mode !== 'walk') return [near.indoors ? 'Not in here.' : 'Not up here.', null];
      fx.skating = !fx.skating; return [fx.skating ? 'You drop the board and kick off.' : 'You flip the board up into your hand.', 'board'];
    case 'boombox': // a different tape each time you switch it on
      fx.boombox = !fx.boombox;
      if (fx.boombox) fx.song = pick(BOOMBOX_SONGS.filter(s => s !== fx.song));
      return [fx.boombox ? `You hit play. ${SONG_NAMES[fx.song]}.` : 'You stop the tape.', fx.boombox ? 'tape' : 'click'];
    case 'ball':
      if (near.indoors) return ['Not in here.', null];
      kickBall(near.x, near.y, near.a); removeHeld(); return ['You punt the ball down the street.', 'kick'];
    case 'umbrella': return [near.rain > 0.3 ? 'You hold the umbrella up against the rain.' : 'You twirl the umbrella. It isn\'t raining.', null];
    case 'book': return [pick(BOOK_LINES), 'page'];
    case 'newspaper': return [`Headline: ${pick(near.headlines)}`, 'page'];
    case 'vinyl': return ['A record in a paper sleeve. Put it on a record player at home.', null];
    case 'jadebangle': return [pick(['You turn the bangle round your wrist. Cool and smooth. Lucky, they say.', 'The jade catches the light. You feel a tiny bit luckier.']), null];
    case 'jadedragon': return [pick(['You rub the dragon\'s head for luck.', 'The little jade dragon stares back, very sure of itself.', 'You give the dragon a pat. Good fortune, apparently, follows.']), null];
    case 'plushcat': return [pick(['The lucky cat waves its paw. Fortune incoming, surely.', 'You pat the lucky cat on the head. You feel a tiny bit luckier.', 'The lucky cat beckons good fortune your way. A little bit of it, anyway.']), null];
    case 'petcat': return ['The cat mews from its carrier. It will be glad to have a home.', null];
    case 'petdog': return ['The dog gives a little whine from its carrier. It will be glad to have a home.', null];
    case 'plushbear': return [pick(['You give the bear a hug. Nobody saw.', 'The bear has one ear slightly bigger than the other. You love it.']), null];
    case 'sharkplush': return [pick(['You make the plush shark do the Jaws music. Dun dun. Dun dun.', 'You give the plush shark a squeeze. It squeaks.', 'The plush shark stares back with its little felt eyes.', 'You check the tag. It says made in Sweden.']), 'squeak'];
    case 'snowglobe': return [pick(['You shake the snow globe. Glitter swirls round a tiny clownfish.', 'Snow, underwater. It makes no sense and you love it.']), null];
    case 'movinglamp': return ['You straighten the amber shade. There is a little chip in the base, and a handwritten label: "Still works. New place has no room."',null];
    case 'yoyo': yoyo.out = !yoyo.out; if (yoyo.out) yoyo.aimX = yoyo.aimY = 0; fx.yoyo = 1; return [yoyo.out ? 'You let the yo-yo drop. Move the mouse to steer and reel it in or out.' : 'You reel it back in.', 'whirr'];
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
      if (it.uses <= 0) { removeHeld(); return ['The sparkler is spent.', null]; }
      it.uses--; fx.spark = 25;
      return [`You light a sparkler.${it.uses > 0 ? ` (${it.uses} left)` : ' The last one.'}`, 'light'];
    case 'pocketwatch': return [pick(['The second hand runs fast. Hold Q to hurry the hours and the weather.', 'It ticks a little too loud. The engraving inside the lid has been scratched out.', 'You open the lid. For a moment the street goes quiet, as if waiting.']), 'click'];
    case 'cityglobe': return shakeGlobe();
    case 'orrery': return turnOrrery();
    case 'postcard': return [pick(['A postcard of the T. rex. On the back: "Wish you were here. Actually don\'t, it\'s ten dollars."', 'A postcard of the museum dome under snow.']), null];
    case 'dinotoy': return ['RAWR. The little T. rex\'s arms flap uselessly.', 'squeak'];
    case 'replicastar': return ['Glass, and not very good glass. Still sparkles, though.', null];
    case 'diamond': return [pick(['The Glyphport Star throws little rainbows all over your hands.', 'Forty carats. The pawn shop would ask very few questions, for a price.', 'You hold it up to the light. Somewhere, an insurance company weeps.']), null];
    case 'hotelmasterpiece': return ['You study The Duke of Brie. He looks far too pleased with himself for someone being smuggled out of a hotel.', null];
    case 'hotelharbour': return ['You tilt Harbour at First Light towards the light. The little boats seem to float above the brushstrokes.', null];
    case 'hotelstilllife': return ['You admire Midnight Supper: wine, pears, and a dinner nobody is ever going to finish. Best keep the frame intact.', null];
    case 'redstring': return [pick(['You tug the red string round your wrist. A little luck at the tables and the games, the stallholder said.', 'A thread of red. Keeps the bad stuff off, and tips the odds a hair your way at the games.']), null];
    case 'luckycoin': return [`You flip the lucky coin: ${Math.random() < 0.5 ? 'heads' : 'tails'}. (On you, it nudges the odds at the games.)`, 'click'];
    case 'tigerbalm':
      if (needs.health >= maxHealth() - 1) return ['You smell the tiger balm. Camphor. You don\'t need it right now.', null];
      it.uses--; needs.health = Math.min(maxHealth(), needs.health + 30);
      if (it.uses <= 0) removeHeld();
      return [`You rub the tiger balm in. It burns, then it doesn't, and everything aches less.${it.uses > 0 ? ` (${it.uses} left)` : ' The tin\'s empty.'}`, null];
    case 'lantern': return [night > 0.3 ? 'You hold the lantern up. Its warm light spills round you.' : 'A red paper lantern. It\'ll come into its own after dark.', null];
    case 'firecrackers': {
      if (near.indoors) return ['Not in here!', null];
      it.uses--; if (it.uses <= 0) removeHeld();
      fx.bang = 1.2;
      if (wanted.stars > 0 && !wanted.busted) { // the cops wheel round toward the noise, and lose you for a moment
        const an = Math.random() * Math.PI * 2;
        wanted.seen = false; wanted.lastX = worldCoord(px + Math.cos(an) * 2.5); wanted.lastY = worldCoord(py + Math.sin(an) * 2.5); wanted.hideT += 6;
        return ['BANG BANG BANG BANG! You toss the firecrackers and slip away while every cop on the street turns toward the racket.', 'kick'];
      }
      for (const p of people) if (!p.hidden && Math.hypot(rel(p.x - px), rel(p.y - py)) < 0.8) p.talk = 3;
      return [pick(['BANG BANG BANG! Everyone nearby jumps out of their skin.', 'A string of firecrackers goes off at your feet. Somewhere a car alarm joins in.']) + (it.uses > 0 ? ` (${it.uses} left)` : ''), 'kick'];
    }
    case 'telescope': fx.telescope=!fx.telescope;return [fx.telescope?'You raise the telescope. Q lowers it.':'You lower the telescope.',null];
    case 'goldfish': return [pick(['You hold the bag up to the light. The goldfish looks at you, then at the city, unimpressed.', 'The goldfish does a lap of its bag. Then another.', 'You name the goldfish. It doesn\'t react, but you know.']), null];
    case 'mysterybox': { // open it: something from the pile, nobody said what
      removeHeld();
      const id = pickWeighted(MYSTERY_BOX);
      carryItem({ id, uses: ITEMS[id].uses || 0 });
      return [id === 'jadedragon' || id === 'pocketwatch' ? `You tear it open. ${aOrSome(ITEMS[id].name).replace(/^./, c => c.toUpperCase())}?! No way.` : `You tear the box open: ${aOrSome(ITEMS[id].name)}.`, 'chime'];
    }
    case 'flowers':
      if (near.person) { removeHeld(); near.person.talk = 4; return [`"For me? Oh!" ${pick(['They light up.', 'They blush.', 'They smell them and grin.'])}`, 'chime']; }
      return ['You sniff the flowers. Lovely.', null];
  }
  return ['Nothing happens.', null];
}
// the night market's mystery box: mostly cheap, now and then not [id, weight]
const MYSTERY_BOX = [['duck', 14], ['candy', 12], ['yoyo', 10], ['sparklers', 10], ['firecrackers', 8], ['fortunecookie', 8], ['lantern', 5], ['tigerbalm', 5], ['harmonica', 8], ['plushcat', 8], ['sharkplush', 8], ['plushbear', 8], ['snowglobe', 7], ['vinyl', 6], ['jadebangle', 5], ['luckycoin', 3], ['jadedragon', 1], ['pocketwatch', 0.25]];
// a fortune cookie's fortune: a hint at one of the city's companies, and that company really does get good news soon
// (stocks.js: a tipped stock's news chance goes right up, and the news it gets is good)
const FORTUNE_HINT = { DUMP: 'The golden dumpling will rise.', CABS: 'Fortune rides in the back of a yellow car.', ELRL: 'Look up: what runs above the street will climb.',
  PIER: 'Joy by the water will soon be worth more.', JADE: 'Green stone brings green paper.', LUCK: 'The house will soon be luckier than you.', BYTE: 'A small wave of bytes becomes a big one.' };
function fortune() {
  const s = pick(STOCKS); s.tip = true;
  return `${FORTUNE_HINT[s.sym]} Lucky numbers: ${[0, 0, 0].map(() => 1 + (Math.random() * 49 | 0)).join(', ')}`;
}
const pickWeighted = list => { let r = Math.random() * list.reduce((t, [, w]) => t + w, 0); for (const [id, w] of list) if ((r -= w) < 0) return id; return list[0][0]; };
// the Glyphport snow globe: the city in glass. Shake it and the sky outside turns to match (and stays a good while);
// give the snow a few seconds to settle before you try again
const GLOBE_SETTLE = 8;
let globeT = -99;
const GLOBE_SKY = { clear: 'the stars come out over the tiny towers', rain: 'rain streaks down the glass', storm: 'lightning flickers in the glass', fog: 'fog fills the globe', snow: 'the snow comes down and stays down' };
function shakeGlobe() {
  if (T - globeT < GLOBE_SETTLE) return ['The snow\'s still settling.', null];
  globeT = T; weather = season() === 'winter' ? 'snow' : WEATHER_NEXT[weather]; wTimer = 600;
  return [`You shake the globe. Inside, ${GLOBE_SKY[weather]}. Outside, too.`, 'chime'];
}
// the Equinox Orrery: brass planets round a brass sun. Turn the crank and the year turns on a season; the city follows
// (winter brings snow, spring melts it). The gears need a little while before they'll turn again
const ORRERY_REST = 12;
let orreryT = -99;
const ORRERY_LINE = { spring: 'The sun swings low and climbs again. Green comes back to the trees.', summer: 'The little brass sun burns brighter. It\'s summer.',
  autumn: 'The planets tick round. Leaves turn, all over the city at once.', winter: 'The gears grind round to the shortest day. The air goes cold. Winter.' };
function turnOrrery() {
  if (T - orreryT < ORRERY_REST) return ['The gears are still settling.', null];
  orreryT = T; seasonShift++; wTimer = 0; // (and the sky catches up)
  return [`You turn the crank. ${ORRERY_LINE[season()]}`, 'whirr'];
}
// the pocket watch in your hand and Q held down: the hours hurry along (the globe's a Q press too, see useHeld)
const hurrying = () => usingHeldItem() && !paused && !!heldItem() && heldItem().id === 'pocketwatch';
// things you put down stay where you left them till you pick them up again: out on the street (at '') or inside
// somewhere (at = that room's key, see placeKey); outdoors z is the height it's lying at (0, or up on a roof).
// Half-eaten stays half-eaten; cooking quality, ingredients and catch weight stay with the item too.
function itemName(it) {
  if (ITEMS[it.id].kind === 'drug') return `${DRUG_QUALITY[it.q] || 'standard'} ${ITEMS[it.id].name}`;
  if (ITEMS[it.id].cooked) return `${it.q ? it.q + ' ' : ''}${dishName(it)}`;
  return it.kg ? catchName(it) : ITEMS[it.id].name;
}
const dropped = []; // inventory item plus { x, y, at, z }
function dropHeldAt(x, y, at, z = 0) {
  const it = heldItem();
  if (!it) return null;
  removeHeld(); dropped.push({ ...it, x, y, at, z });
  return itemName(it);
}
// the nearest thing lying within r of (x, y) in the same place, if any
function droppedNear(x, y, at, r, z = 0) {
  let best = null, bd = r;
  for (const d of dropped) if (d.at === at && Math.abs((d.z || 0) - z) < 0.05) { const e = at ? Math.hypot(d.x - x, d.y - y) : Math.hypot(rel(d.x - x), rel(d.y - y)); if (e < bd) { bd = e; best = d; } }
  return best;
}
function pickUpDropped(d) {
  if (inv.length >= INV_SIZE) return [false, 'Your bag is full.'];
  const { x, y, at, z, displayZ, ...it } = d;
  dropped.splice(dropped.indexOf(d), 1); carryItem(it);
  return [true, `You pick up the ${itemName(it)}.`];
}
function stepGoods(dt) {
  if (fx.skating && (mode !== 'walk' || !heldItem() || heldItem().id !== 'skateboard')) fx.skating = false; // (on foot again: indoors, or something else in your hand)
  fx.caffeine = Math.max(0, fx.caffeine - dt); fx.booze = Math.max(0, fx.booze - dt / 120); fx.smoke = Math.max(0, fx.smoke - dt);
  fx.stink = Math.max(0, fx.stink - dt); fx.bang = Math.max(0, fx.bang - dt);
  stepYoyo(dt); if (!heldItem() || heldItem().id !== 'yoyo') yoyo.out = false; // (put it away and it comes back up)
  fx.spark = Math.max(0, fx.spark - dt); fx.fresh = Math.max(0, fx.fresh - dt); fx.fed = Math.max(0, fx.fed - dt);
  // The last wire stays in your hand while burning. Empty entries loaded from an old save are cleaned up too.
  if (!fx.spark) for (let k = inv.length - 1; k >= 0; k--) {
    if (inv[k].id === 'sparklers' && inv[k].uses <= 0) removeInventoryAt(k);
  }
  cigTip = Math.max(0, cigTip - dt * 0.8);
  if (fx.vape > 0) { // pulling on the vape: the longer, the bigger the cloud
    const it = heldItem();
    if (usingHeldItem() && it && it.id === 'vape') fx.vape = Math.min(3, fx.vape + dt);
    else { fx.cloud = fx.vape; fx.vape = 0; }
  }
  return stepBall(dt);
}
// how fast you walk, from what you've had and what you're riding
const footSpeed = () => (fx.skating ? 1.8 : 1) * (fx.caffeine > 0 ? 1.25 : 1);

// ---- the soccer ball, once kicked: rolls, slows, bounces off walls, sinks in the sea; walk into it to dribble,
// E to pick it up
let ball = null; // { x, y, vx, vy, z, vz }
// what stops it: buildings (unless it's sailing over a low one), and everything solid at street level: fences,
// containers, booths, lamp posts, vending machines
const ballBlocked = (x, y, z) => map[idx(Math.floor(x), Math.floor(y))] > z || z < 0.2 && (solidAt(x, y, 0.015) || lampAt(x, y, 0.01) || machineAt(x, y, 0.015) || fairBlocked(x, y, 0.015));
function kickBall(x, y, a, power = 2.6) {
  let d = 0; // set down just in front of you, short of any wall you're standing against
  while (d < 0.12 && !ballBlocked(x + Math.cos(a) * (d + 0.02), y + Math.sin(a) * (d + 0.02), 0.02)) d += 0.02;
  ball = { x: worldCoord(x + Math.cos(a) * d), y: worldCoord(y + Math.sin(a) * d), vx: Math.cos(a) * power, vy: Math.sin(a) * power, z: 0.02, vz: power * 0.25 };
}
// (what it sounds like, heard from where it is: audio.js, when there's sound at all)
const ballSound = (kind, speed) => { if (typeof actx !== 'undefined' && actx) sfxBall(kind, ball.x, ball.y, ball.z, clamp(speed / 2, 0.15, 1)); };
function stepBall(dt) {
  if (!ball) return;
  ball.vz -= 2 * dt; ball.z += ball.vz * dt;
  if (ball.z < 0) { ball.z = 0; if (Math.abs(ball.vz) > 0.08) { ballSound('bounce', Math.abs(ball.vz) * 4); ball.vz = -ball.vz * 0.5; } else ball.vz = 0; }
  const f = Math.max(0, 1 - (ball.z > 0 ? 0.2 : 1.1) * dt); ball.vx *= f; ball.vy *= f;
  const n = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 0.01)); // (small steps: a fence is only 2cm thick)
  for (let s = 0; s < n; s++) for (const ax of ['x', 'y']) { // move one axis at a time, bouncing off whatever's solid
    const nx = ax === 'x' ? ball.x + ball.vx * dt / n : ball.x, ny = ax === 'y' ? ball.y + ball.vy * dt / n : ball.y;
    if (ballBlocked(nx, ny, ball.z)) { const v = Math.abs(ax === 'x' ? ball.vx : ball.vy); if (v > 0.1) ballSound('wall', v); if (ax === 'x') ball.vx *= -0.6; else ball.vy *= -0.6; }
    else { ball.x = worldCoord(nx); ball.y = worldCoord(ny); }
  }
  if (isWater(ball.x, ball.y) && ball.z === 0) { ballSound('splash', 2); ball = null; return 'lost'; } // into the drink
  // dribbling: walk into it and it rolls on ahead of you (a touch you hear, not one every frame you're against it)
  const dx_ = rel(ball.x - px), dy_ = rel(ball.y - py), d = Math.hypot(dx_, dy_);
  if (d < 0.07 && mode === 'walk') { const s = 0.9; ball.vx += dx_ / (d || 1) * s; ball.vy += dy_ / (d || 1) * s; if (!(ball.touchT > T - 0.3)) { ball.touchT = T; ballSound('touch', 1); } }
  return null;
}
function pickUpBall() {
  if (!ball || Math.hypot(rel(ball.x - px), rel(ball.y - py)) > 0.3 || inv.length >= INV_SIZE) return false;
  ball = null; carryItem({ id: 'ball', uses: 0 }); return true;
}

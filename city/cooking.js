// ===== cooking. A stove in every home you own, and out of doors the public grills on the beaches and in the park and
// a campfire on Lighthouse Island (props.js puts those up, cooking-ui.js draws them and the panel). E at one and pick
// something you've got the makings of (from your bag, and at home the fridge too); then the pan: hold SPACE to keep
// the heat in the green, and when it says so FLIP it (UP), STIR it (UP) or ADD the next thing (DOWN). Too hot and it
// catches, too cool and it takes forever. What comes out is perfect, fine or burnt, and eats accordingly: a perfect
// dish fills you more and leaves you well fed a while (you get hungry slower); a burnt one, less.
// The groceries for it (goods.js STOCK_WORD): the grocer's has most things, the market the vegetables, the deli the
// bread, cheese and bacon, the corner shops eggs and the basics.
Object.assign(ITEMS, {
  // the pantry: not for eating as it comes
  eggs: { name: 'eggs', price: 3, kind: 'ingredient', col: WHITE }, bread: { name: 'loaf of bread', price: 3, kind: 'ingredient', col: WARM },
  butter: { name: 'butter', price: 3, kind: 'ingredient', col: YEL }, cheese: { name: 'cheese', price: 5, kind: 'ingredient', col: YEL },
  rice: { name: 'bag of rice', price: 3, kind: 'ingredient', col: WHITE }, pasta: { name: 'pasta', price: 2, kind: 'ingredient', col: YEL },
  drynoodles: { name: 'dried noodles', price: 2, kind: 'ingredient', col: YEL }, potatoes: { name: 'potatoes', price: 2, kind: 'ingredient', col: BRICK },
  onion: { name: 'onion', price: 1, kind: 'ingredient', col: WARM }, tomatoes: { name: 'tomatoes', price: 2, kind: 'ingredient', col: RED },
  garlic: { name: 'garlic', price: 1, kind: 'ingredient', col: WHITE }, mushrooms: { name: 'mushrooms', price: 3, kind: 'ingredient', col: WARM },
  greens: { name: 'bok choy', price: 2, kind: 'ingredient', col: GREEN }, peppers: { name: 'peppers', price: 2, kind: 'ingredient', col: RED },
  chilli: { name: 'chillies', price: 1, kind: 'ingredient', col: RED }, lemon: { name: 'lemon', price: 1, kind: 'ingredient', col: YEL },
  rawchicken: { name: 'chicken thighs', price: 7, kind: 'ingredient', col: WARM }, mince: { name: 'beef mince', price: 6, kind: 'ingredient', col: RED },
  bacon: { name: 'bacon', price: 5, kind: 'ingredient', col: RED }, tofu: { name: 'tofu', price: 3, kind: 'ingredient', col: WHITE },
});
// what you can make: needs (ingredient ids; 'fish' is any fish you caught), where (stove: a home's hob and oven; grill:
// a public grill; fire: the campfire), how (pan: one flip; pot: stirred twice; grill: turned twice; oven: turned once,
// low and slow), the heat it wants (the green band), how long it takes at that heat, and what it makes: fill (how much
// a whole one fills you), uses (bites), heal (health back, a whole one), soup (it's a drink too, a bit)
const RECIPES = [
  { id: 'panfish', name: 'pan-fried fish', of: 'pan-fried {}', needs: ['fish', 'butter'], where: ['stove', 'fire'], how: 'pan', fill: 50, uses: 3 },
  { id: 'fishchips', name: 'fish and chips', of: '{} and chips', needs: ['fish', 'potatoes'], where: ['stove'], how: 'pan', fill: 75, uses: 4 },
  { id: 'fishcurry', name: 'fish curry', of: '{} curry', needs: ['fish', 'rice', 'chilli'], where: ['stove'], how: 'pot', fill: 80, uses: 5, soup: 0.5 },
  { id: 'grilledfish', name: 'grilled fish with lemon', of: 'grilled {} with lemon', needs: ['fish', 'lemon'], where: ['grill', 'fire'], how: 'grill', fill: 55, uses: 3, heal: 15 },
  { id: 'fishstick', name: 'fish on a stick', of: '{} on a stick', needs: ['fish'], where: ['fire'], how: 'grill', fill: 40, uses: 3 },
  { id: 'fishsandwich', name: 'fish sandwich', of: '{} sandwich', needs: ['fish', 'bread'], where: ['stove', 'grill'], how: 'pan', fill: 60, uses: 4 },
  { id: 'friedeggs', name: 'fried eggs on toast', needs: ['eggs', 'bread'], where: ['stove', 'fire'], how: 'pan', fill: 45, uses: 3 },
  { id: 'omelette', name: 'mushroom omelette', needs: ['eggs', 'mushrooms', 'cheese'], where: ['stove'], how: 'pan', fill: 55, uses: 3 },
  { id: 'baconeggs', name: 'bacon and eggs', needs: ['bacon', 'eggs'], where: ['stove', 'grill', 'fire'], how: 'pan', fill: 60, uses: 3 },
  { id: 'grilledcheese', name: 'grilled cheese', needs: ['bread', 'cheese', 'butter'], where: ['stove', 'grill'], how: 'pan', fill: 50, uses: 3 },
  { id: 'toast', name: 'toast', needs: ['bread'], where: ['stove', 'grill', 'fire'], how: 'grill', fill: 25, uses: 2 },
  { id: 'pomodoro', name: 'pasta pomodoro', needs: ['pasta', 'tomatoes', 'garlic'], where: ['stove'], how: 'pot', fill: 65, uses: 4 },
  { id: 'bolognese', name: 'spaghetti bolognese', needs: ['pasta', 'mince', 'tomatoes', 'onion'], where: ['stove'], how: 'pot', fill: 85, uses: 5 },
  { id: 'macncheese', name: 'mac and cheese', needs: ['pasta', 'cheese', 'butter'], where: ['stove'], how: 'pot', fill: 75, uses: 4 },
  { id: 'homeburger', name: 'homemade burger', needs: ['mince', 'bread', 'onion'], where: ['grill', 'stove', 'fire'], how: 'grill', fill: 75, uses: 4 },
  { id: 'friedrice', name: 'egg fried rice', needs: ['rice', 'eggs', 'onion'], where: ['stove'], how: 'pan', fill: 65, uses: 4 },
  { id: 'chickencurry', name: 'chicken curry', needs: ['rawchicken', 'rice', 'chilli', 'onion'], where: ['stove'], how: 'pot', fill: 90, uses: 5, soup: 0.5 },
  { id: 'roastchicken', name: 'roast chicken and potatoes', needs: ['rawchicken', 'potatoes', 'garlic'], where: ['stove'], how: 'oven', fill: 100, uses: 6, heal: 20 },
  { id: 'skewers', name: 'chicken skewers', needs: ['rawchicken', 'peppers', 'onion'], where: ['grill', 'fire'], how: 'grill', fill: 70, uses: 4 },
  { id: 'stirfry', name: 'noodle stir-fry', needs: ['drynoodles', 'greens', 'tofu'], where: ['stove', 'fire'], how: 'pan', fill: 65, uses: 4 },
  { id: 'risotto', name: 'mushroom risotto', needs: ['rice', 'mushrooms', 'butter', 'cheese'], where: ['stove'], how: 'pot', fill: 80, uses: 5 },
  { id: 'jacketpotato', name: 'jacket potato', needs: ['potatoes', 'cheese', 'butter'], where: ['stove', 'fire'], how: 'oven', fill: 60, uses: 3 },
  { id: 'tomatosoup', name: 'tomato soup', needs: ['tomatoes', 'onion', 'garlic'], where: ['stove', 'fire'], how: 'pot', fill: 45, uses: 4, soup: 1 },
  { id: 'grilledveg', name: 'grilled vegetables', needs: ['peppers', 'mushrooms', 'onion'], where: ['grill', 'fire'], how: 'grill', fill: 40, uses: 3, heal: 15 },
];
const RECIPE = Object.fromEntries(RECIPES.map(r => [r.id, r]));
for (const r of RECIPES) ITEMS[r.id] = { name: r.name, price: Math.round(r.fill / 8), kind: 'food', uses: r.uses, fill: r.fill, heal: r.heal, cooked: true };
for (const r of RECIPES) if (r.soup) SOUPY[r.id] = r.soup;
// each way of cooking: the green band of heat it wants, how long it takes in it, and the moves it asks for on the way
const HOW = {
  pan: { band: [0.45, 0.75], time: 9, moves: [[0.55, 'up', 'FLIP IT']] },
  pot: { band: [0.32, 0.6], time: 11, moves: [[0.45, 'up', 'STIR IT'], [0.78, 'up', 'STIR IT']] },
  grill: { band: [0.5, 0.8], time: 9, moves: [[0.4, 'up', 'TURN IT'], [0.75, 'up', 'TURN IT']] },
  oven: { band: [0.35, 0.55], time: 12, moves: [[0.6, 'up', 'TURN THE TRAY']] },
};
const STATION_NAME = { stove: 'the stove', grill: 'the grill', fire: 'the campfire' };
const DISH_EAT = { perfect: 1.25, fine: 1, burnt: 0.6 }; // (how much more, or less, it fills you)
const WELL_FED = 600; // seconds of getting hungry and thirsty at half the rate, after something perfect
const isIngredient = it => !!it && ITEMS[it.id] && (ITEMS[it.id].kind === 'ingredient' || ITEMS[it.id].kind === 'fish');
// the name a cooked thing goes by: the fish in it, if there is one ("pan-fried mackerel")
const dishName = it => it.of && RECIPE[it.id] && RECIPE[it.id].of ? RECIPE[it.id].of.replace('{}', ITEMS[it.of].name) : ITEMS[it.id].name;
// does this carried thing count for that ingredient? (any fish for 'fish'; the golden koi is not dinner)
const fits = (it, need) => need === 'fish' ? ITEMS[it.id].kind === 'fish' : it.id === need;
// what's needed and what's there: for each ingredient, where it'd come from (your bag, or the fridge at home), or null
function makings(r, pantry = []) {
  const usedInv = new Set(), usedP = new Set();
  return r.needs.map(need => {
    const k = inv.findIndex((it, j) => !usedInv.has(j) && fits(it, need));
    if (k >= 0) { usedInv.add(k); return { need, from: 'bag', k }; }
    const p = pantry.findIndex((it, j) => !usedP.has(j) && fits(it, need));
    if (p >= 0) { usedP.add(p); return { need, from: 'fridge', k: p }; }
    return { need, from: null };
  });
}
const canMake = (r, pantry) => makings(r, pantry).every(m => m.from);
const recipesAt = station => RECIPES.filter(r => r.where.includes(station));
// it's done: out of the bag and the fridge with the makings, onto a plate (in your bag) with the dish. Returns a line
function serveDish(r, verdict, pantry = []) {
  const ms = makings(r, pantry);
  if (!ms.every(m => m.from)) return 'Something you needed has gone. There\'s nothing to cook.';
  let fish = null;
  // (take from the end first, so the indexes still point at the right things)
  for (const m of ms.filter(m => m.from === 'fridge').sort((p, q) => q.k - p.k)) { const it = pantry.splice(m.k, 1)[0]; if (m.need === 'fish') fish = it; }
  for (const m of ms.filter(m => m.from === 'bag').sort((p, q) => q.k - p.k)) { const it = takeSlot(m.k); if (m.need === 'fish') fish = it; }
  const uses = r.uses + (fish && fish.kg ? clamp(Math.floor(fish.kg / 2), 0, 3) : 0); // (a bigger fish goes further)
  const dish = { id: r.id, uses, q: verdict, ...(fish ? { of: fish.id } : {}) };
  carryItem(dish); // (straight into your hand)
  return `${verdict === 'perfect' ? 'Perfect.' : verdict === 'burnt' ? 'Burnt.' : 'Not bad.'} ${cap(dishName(dish))}${verdict === 'perfect' ? ', exactly as it should be' : verdict === 'burnt' ? ', mostly black. You could still eat it' : ''}.`;
}

// ---- the pan itself (the minigame: minigame-ui.js plays it, cooking-ui.js starts it). opts: { recipe }
GAMES.cook = (rnd = Math.random, word = '', o = {}) => {
  const r = RECIPE[o.recipe] || RECIPES[0], how = HOW[r.how], W = 32, H = 15;
  const g = { id: 'cook', title: r.name.toUpperCase(), W, H, score: 0, over: false, recipe: r.id, how: r.how };
  // the moves: put in each extra ingredient early on (DOWN), then the flips or stirs (UP)
  const adds = r.needs.slice(1).map((need, k, a) => [0.12 + 0.25 * (k + 1) / (a.length + 1), 'down', `ADD THE ${(need === 'fish' ? 'FISH' : ITEMS[need].name.replace(/^(bag|loaf) of /, '')).toUpperCase()}`]);
  const moves = [...adds, ...how.moves].map(([at, key, label]) => ({ at, key, label, state: 'wait', t: 0 }));
  let heat = 0.15, done = 0, char = 0, t = 0, missed = 0, flare = 0, sizzleT = 0, flipT = -9, drift = 0, lastMove = null;
  const [lo, hi] = how.band;
  const now = () => moves.find(m => m.state === 'now');
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    drift += ((rnd() - 0.5) * 0.6 - drift) * Math.min(1, dt * 2); // (the flame's never quite steady)
    heat = clamp(heat + (k.act ? 0.6 : -0.42) * dt + drift * 0.08 * dt, 0, 1);
    if (r.how === 'grill' && flare <= 0 && rnd() < dt * 0.08) { flare = 0.8; ev.push('flare'); } // a flare-up: fat on the coals
    if (flare > 0) { flare -= dt; heat = Math.min(1, heat + dt * 0.5); }
    const pace = heat < lo ? 0.25 + 0.75 * (heat / lo) ** 1.5 : heat > hi ? 1.25 : 1; // too cool: slow; too hot: quick, and catching
    done = Math.min(1, done + pace * dt / how.time);
    if (heat > hi) char += (heat - hi) * 1.6 * dt;
    // the move that's due: it waits a moment for you, and the pan doesn't wait at all
    const m = now() || moves.find(q => q.state === 'wait' && done >= q.at);
    if (m) {
      if (m.state === 'wait') { m.state = 'now'; m.t = 0; ev.push('due'); }
      m.t += dt;
      const press = m.key === 'up' ? k.upP : k.downP;
      if (press) { m.state = 'done'; flipT = t; lastMove = m; ev.push(m.label.startsWith('ADD') ? 'add' : m.label.startsWith('STIR') ? 'stir' : 'flip'); }
      else if (m.t > 1.6) { m.state = 'missed'; missed++; ev.push('miss'); }
      else if (heat > lo && !m.label.startsWith('ADD')) char += 0.05 * dt; // (the side that's down's still cooking)
    }
    if ((sizzleT -= dt) <= 0 && heat > 0.35) { sizzleT = 0.35 + rnd() * 0.3; ev.push('sizzle'); }
    if (done >= 1 && !now()) { // done: how it turned out
      const late = Math.max(0, t / how.time - 1.8) * 0.4; // (stewed: you kept it too cool too long)
      const q = clamp(1 - char - missed * 0.18 - late, 0, 1);
      g.score = Math.round(q * 100);
      g.result = q >= 0.8 ? 'perfect' : q >= 0.45 ? 'fine' : 'burnt';
      g.over = true; ev.push(g.result === 'burnt' ? 'die' : 'clear');
    }
    return ev;
  };
  // the look of what's in it: one glyph string per recipe, its colour going from raw to golden to brown to black
  const LOOK = { panfish: '<o)))><', fishchips: '<o)>=-=-', fishcurry: '~o~o~o~', grilledfish: '<o)))>< ()', fishstick: '-<o)))><', fishsandwich: '[<o)>]',
    friedeggs: '(O) (O)', omelette: '(======)', baconeggs: '~~ (O) ~~', grilledcheese: '[####]', toast: '[ ] [ ]', pomodoro: '~@~@~@~', bolognese: '~@#@#@~', macncheese: 'oooooo',
    homeburger: '(####)', friedrice: ':.:.:.:', chickencurry: '~#~#~#~', roastchicken: '(%%) o o', skewers: '-#-o-#-o-', stirfry: '~%~%~%~', risotto: ':o:o:o:', jacketpotato: '(  )(  )', tomatosoup: '~~~~~~~', grilledveg: '#o# #o#' };
  const look = LOOK[r.id] || 'oooo';
  const foodCol = () => { const c = char > 0.45 ? GRAY : char > 0.2 ? BRICK : done > 0.6 ? ORANGE : done > 0.3 ? YEL : ITEMS[r.needs[0] === 'fish' ? 'mackerel' : r.needs[0]].col || WARM; return C(c, char > 0.45 ? 5 : 14); };
  g.draw = (put, text, textAt, fill) => {
    // the heat gauge down the left, its green band, the needle
    for (let y = 2; y <= 12; y++) {
      const v = (12 - y) / 10, band = v >= lo - 0.001 && v <= hi + 0.001;
      put(1, y, band ? '=' : '-', C(band ? GREEN : v > hi ? RED : BLUE, band ? 13 : 9), C(band ? GREEN : GRAY, band ? 3 : 1));
    }
    const ny = Math.round(12 - heat * 10); put(2, ny, '<', C(heat > hi ? RED : heat < lo ? CYAN : WHITE, 15));
    text(1.5, 0.6, 'HEAT', C(WHITE, 11), 'center');
    // how done, along the top
    for (let x = 5; x < W - 1; x++) { const f = (x - 5) / (W - 6); put(x, 0, f < done ? '#' : '.', f < done ? foodCol() : C(GRAY, 6)); }
    // the cookware, the food in or on it, the flames under it
    const cx = 18, fy = 8, hop = t - flipT < 0.45 ? Math.round(Math.sin((t - flipT) / 0.45 * Math.PI) * 3) : 0;
    if (r.how === 'pan') {
      for (let x = cx - 8; x <= cx + 8; x++) put(x, fy + 1, '_', C(GRAY, 12), C(GRAY, 2));
      put(cx - 9, fy, '\\', C(GRAY, 12)); put(cx + 9, fy, '/', C(GRAY, 12));
      for (let x = cx + 10; x <= cx + 13; x++) put(x, fy - 1, '=', C(BRICK, 12)); // the handle
    } else if (r.how === 'pot') {
      for (let y = fy - 3; y <= fy + 1; y++) { put(cx - 7, y, '|', C(GRAY, 12), C(GRAY, 2)); put(cx + 7, y, '|', C(GRAY, 12), C(GRAY, 2)); }
      for (let x = cx - 7; x <= cx + 7; x++) put(x, fy + 1, '=', C(GRAY, 12), C(GRAY, 2));
      put(cx - 8, fy - 2, 'o', C(GRAY, 12)); put(cx + 8, fy - 2, 'o', C(GRAY, 12)); // the handles
      for (let x = cx - 6; x <= cx + 6; x++) put(x, fy - 1, (x + Math.floor(t * 6)) % 3 ? '~' : heat > lo ? 'o' : '~', heat > lo ? C(WHITE, 11) : C(CYAN, 9)); // bubbling
      if (heat > lo) for (let s = 0; s < 3; s++) { const sy = fy - 4 - ((t * 2 + s * 0.7) % 3 | 0); put(cx - 4 + s * 4 + Math.round(Math.sin(t * 3 + s)), sy, '~', C(WHITE, 7)); } // steam
      const sp = moves.find(m => m.label.startsWith('STIR') && m.state === 'done') && t - flipT < 0.6; // the spoon going round
      if (sp) put(cx + Math.round(Math.cos((t - flipT) * 14) * 4), fy - 2, '/', C(BRICK, 14));
    } else if (r.how === 'grill') {
      for (let x = cx - 9; x <= cx + 9; x++) { put(x, fy + 1, x % 2 ? '=' : '#', C(GRAY, 10), C(GRAY, 1)); }
    } else { // the oven: a door with a window, the tray in it
      for (let x = cx - 9; x <= cx + 9; x++) { put(x, fy - 3, '=', C(GRAY, 12), C(GRAY, 3)); put(x, fy + 2, '=', C(GRAY, 12), C(GRAY, 3)); }
      for (let y = fy - 2; y <= fy + 1; y++) { put(cx - 9, y, '|', C(GRAY, 12), C(GRAY, 3)); put(cx + 9, y, '|', C(GRAY, 12), C(GRAY, 3)); for (let x = cx - 8; x <= cx + 8; x++) put(x, y, ' ', 0, C(ORANGE, 1 + heat * 3)); }
      for (let x = cx - 6; x <= cx + 6; x++) put(x, fy + 1, '_', C(GRAY, 13));
    }
    const fyy = (r.how === 'pot' ? fy - 1 : fy) - hop;
    // the food, at the screen's own character size (a block per letter reads as a smear): a heap of it, its look worked
    // across it, browning as it goes; in the pot, the top of what's bubbling
    const tex = n => (look + '  ').repeat(12).slice(0, n);
    if (r.how === 'pot') { if (done > 0.15) fill(cx - 6, fy - 2, 13, 1, Wc => [tex(Wc - 2)], foodCol()); }
    else fill(cx - 7, fyy - 1, 15, 2, Wc => [' .' + '-'.repeat(Wc - 6) + '. ', '( ' + tex(Wc - 6) + ' )', '( ' + tex(Wc - 6).split('').reverse().join('') + ' )', " `" + '-'.repeat(Wc - 6) + "' "], foodCol());
    if (r.how !== 'oven') for (let x = cx - 8; x <= cx + 8; x += 2) { // the flames
      const tall = heat * 2.2 + (hash(x, Math.floor(t * 10), 1701) - 0.5) * 0.8 + (flare > 0 ? 1.5 : 0);
      if (tall > 0.3) put(x, fy + 3, tall > 1.6 ? 'A' : '^', C(tall > 1.8 ? YEL : heat > hi ? RED : ORANGE, 13));
      if (tall > 1.2) put(x, fy + 2, r.how === 'grill' ? '*' : '^', C(heat > hi ? YEL : ORANGE, 12));
    }
    if (heat > lo + 0.1) for (let s = 0; s < 6; s++) if (hash(s, Math.floor(t * 8), 1703) < heat - 0.3) text(cx - 5 + s * 2 + hash(s, Math.floor(t * 8), 1704) * 2, fyy - 1 - hash(s, 7, Math.floor(t * 8)) * 2, hash(s, 3, Math.floor(t * 8)) < 0.5 ? '*' : "'", C(YEL, 12)); // spitting
    if (char > 0.2) for (let s = 0; s < 4; s++) text(cx - 3 + s * 2 + Math.sin(t * 2 + s), fyy - 2 - ((t * 1.5 + s * 0.7) % 3), s & 1 ? '(' : ')', C(GRAY, 6 + char * 5)); // smoke, curling up
    // The required action stays visible. Heat advice has its own line and
    // cannot replace it while you're trying to hold the temperature steady.
    const m = now();
    if (m) text(W / 2, 2, `${m.label}!  [${m.key === 'up' ? 'UP' : 'DOWN'}]`, C(m.key === 'up' ? YEL : CYAN, 15), 'center');
    else if (lastMove && t - flipT < .8) text(W / 2, 2, lastMove.label.startsWith('ADD') ? 'ADDED' : lastMove.label.startsWith('STIR') ? 'STIRRED' : lastMove.label.startsWith('FLIP') ? 'FLIPPED' : 'TURNED', C(GREEN, 14), 'center');
    if (heat > hi) text(W / 2, 3, 'TOO HOT - RELEASE HEAT', C(RED, 14), 'center');
    else if (heat < lo && done > 0.05) text(W / 2, 3, 'TOO COOL - HOLD HEAT', C(CYAN, 12), 'center');
    if (flare > 0) text(W / 2, 13.5, 'FLARE-UP!', C(ORANGE, 15), 'center');
  };
  g.status = () => g.over ? 'Dish ready - added to your bag' : `HOLD SPACE heat, keep it in the green   UP flip / stir   DOWN add   ${Math.round(done * 100)}% done`;
  g.reward = () => 0;
  g.state = () => ({ heat, done, char, missed, moves, t });
  return g;
};

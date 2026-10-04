// ===== hunger, thirst and health. Food fills `food`, drink fills `drink` (0-100); both run down as you play
// (real time: neither fast-forward nor a night's sleep speeds them up), thirst a little faster. Run either dry and
// your health starts to go, faster with both; at nothing you pass out and wake up in the hospital with a bill
// (crime-ui.js / actions.js). Food heals a little as you eat it, health comes back slowly while you're fed and
// watered, and the nurse at the hospital patches you up for a fee. A long fall off a roof costs health too (moves.js).
const DRINK_LAST = 30 * 60, FOOD_LAST = 40 * 60; // seconds from full to empty
const STARVE_T = 4 * 60; // seconds from full health to passing out with one meter empty (half that with both)
const HEAL_T = 10 * 60; // seconds to get your health all the way back, fed and watered
const MEDICAL_BILL = 80, NURSE_FEE = 25;
const FOOD_HEALS = 0.4; // health per point of hunger filled: a burger (50) is 20 health, a candy bar 8
const needs = { food: 85, drink: 85, health: 100, warned: '', bladder: 20 };
// the bladder (0-100): never shown. Fills slowly by itself and faster with every drink, booze fastest; P empties it (pee.js)
const BLADDER_FILL = 25 * 60; // seconds to fill up drinking nothing at all
const wetting = (d, w) => d.booze ? w * 2.4 : w * 0.5; // bladder from `w` points of drink: a beer goes straight through you

// how much an item fills you up, all its bites or sips together: [food, drink]. Dearer food is more of a meal;
// water is the best thing for thirst, booze the worst; a milkshake or a bowl of soup counts for both
const SOUPY = { ramen: 1, pho: 1, noodlebox: 0.5, greencurry: 0.5, icecream: 0.5, apple: 0.5 };
const FILLING = { milkshake: 1, smoothie: 1, lemonade: 0.3, bubbletea: 0.5 };
function nourish(id, d) {
  if (d.kind === 'food') return [d.fill || clamp(10 + d.price * 5, 15, 70), (SOUPY[id] || 0) * 30];
  if (d.kind !== 'drink') return [0, 0];
  const base = id === 'water' ? 55 : clamp(25 + d.price * 3, 25, 50);
  return [(FILLING[id] || 0) * 30, d.booze ? base * 0.5 : base];
}
// a bite or a sip of it: returns a word about how you feel now, or ''
function eatSome(id, d) {
  const [f, w] = nourish(id, d), wasHungry = needs.food < 30, wasThirsty = needs.drink < 30;
  needs.food = Math.min(100, needs.food + f / d.uses); needs.drink = Math.min(100, needs.drink + w / d.uses);
  needs.health = Math.min(100, needs.health + f * FOOD_HEALS / d.uses); // a proper meal patches you up a bit
  needs.bladder = Math.min(100, needs.bladder + wetting(d, w) / d.uses);
  if (wasHungry && needs.food >= 30) return ' That takes the edge off.';
  if (wasThirsty && needs.drink >= 30) return ' That\'s better.';
  return '';
}
// every frame (on your feet or not). Returns 'faint' when you've gone down, or a warning to show once
function stepNeeds(dt, canFaint) {
  needs.food = Math.max(0, needs.food - dt * 100 / FOOD_LAST);
  needs.drink = Math.max(0, needs.drink - dt * 100 / DRINK_LAST);
  needs.bladder = Math.min(100, needs.bladder + dt * 100 / BLADDER_FILL);
  const empty = (needs.food <= 0) + (needs.drink <= 0);
  if (empty) needs.health = Math.max(canFaint ? 0 : 1, needs.health - dt * 100 / STARVE_T * empty); // (not at the wheel: you hang on till you're out)
  else if (needs.food > 30 && needs.drink > 30) needs.health = Math.min(100, needs.health + dt * 100 / HEAL_T);
  if (needs.health <= 0) return 'faint';
  // a word when things get bad: once per stage
  const stage = needs.health < 35 ? 'weak' : needs.drink <= 0 ? 'parched' : needs.food <= 0 ? 'starving' : needs.drink < 20 ? 'thirsty' : needs.food < 20 ? 'hungry' : '';
  if (stage === needs.warned) return '';
  needs.warned = stage;
  return { weak: 'Your vision swims. You need to eat and drink, now, or you\'ll pass out.', parched: 'Your mouth is bone dry. You\'re getting weaker.',
    starving: 'Your stomach aches. You\'re getting weaker.', thirsty: 'You\'re thirsty.', hungry: 'You\'re getting hungry.' }[stage] || '';
}
// fell `m` metres: health it costs (a storey or so is nothing; past about 25m it's the hospital whatever)
const fallHurt = m => m < 4 ? 0 : (m - 4) * 4.5;
function hurt(n) { needs.health = Math.max(0, needs.health - n); return needs.health <= 0; }
// after passing out: the hospital's done its bit
function hospitalised() {
  const bill = Math.min(MEDICAL_BILL, Math.max(0, money));
  money -= bill; needs.health = 100; needs.bladder = 10; needs.food = Math.max(needs.food, 50); needs.drink = Math.max(needs.drink, 50); needs.warned = '';
  return bill;
}
const refillNeeds = () => { needs.food = needs.drink = needs.health = 100; needs.warned = ''; };

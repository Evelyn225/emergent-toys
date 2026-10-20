// Groceries have their own full-size pictures; dropped icons stay small. Meals show their food, serving dish,
// remaining portions and cooking quality, rather than stretching a ground icon into a hand.
function heldGroceryPackage(it) {
  const id = it.id, meat = ['rawchicken', 'mince', 'bacon'].includes(id);
  const labels = { rice: 'RICE', pasta: 'PASTA', drynoodles: 'NOODLES', butter: 'BUTTER', tofu: 'TOFU' };
  return sculpt(30, 17, (x, y) => {
    if (id === 'eggs') {
      if (Math.abs(x) > 7.8 || y < -5.8 || y > 6.5) return null;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const ex = -4.8 + c * 4.8, ey = -2.6 + r * 5;
        if (dEll(x, y, ex, ey, 1.8, 2.2) < 1) return dLit(dBall(x, y, ex, ey, 1.8, 2.2), WHITE, 10);
      }
      return dLit(.45 + x * -.02, BRICK, 7, 12);
    }
    if (id === 'bread') {
      const d = dEll(x, y, 0, .6, 8, 5.3);
      if (d > 1) return null;
      if (y < 1 && Math.abs(fract((x + y * .5) / 4) - .5) < .1) return ['/', C(WARM, 14)];
      return dLit(dBall(x, y, 0, .6, 8, 5.3), BRICK, 8);
    }
    const top = meat ? -4.8 : -6.5, bottom = meat ? 5.2 : 7;
    const half = meat ? 8 : id === 'butter' || id === 'tofu' ? 6 : 5.5 + Math.sin((y - top) / (bottom - top) * Math.PI) * 1.1;
    if (y < top || y > bottom || Math.abs(x) > half) return null;
    if (Math.abs(x) > half - .6 || y > bottom - .8 || y < top + .6) return dLit(.6, meat ? WHITE : WARM, 9);
    if (meat) {
      const n = noise(x * 2.4, y * 2.4, 8103), b = dCyl(x, half);
      if (id === 'rawchicken') {
        const joint = dEll(x, y, x < 0 ? -3.3 : 3.3, 0, 3.1, 3.5);
        return joint < 1 ? [n > .7 ? ':' : dFill(b * .6), C(n > .7 ? WHITE : MAG, 9 + b * 3)] : [':', C(WHITE, 9)];
      }
      if (id === 'bacon') return [Math.sin(y * 2 + x * .35) > .1 ? '=' : '~', C(Math.sin(y * 2 + x * .35) > .1 ? RED : WHITE, 11 + b * 3)];
      return [n > .65 ? '~' : '%', C(n > .65 ? WARM : RED, 8 + b * 5)];
    }
    const label = dText(x, y, 0, .4, labels[id] || id.toUpperCase());
    if (label) return [label, C(id === 'butter' ? RED : BLUE, 14)];
    if (id === 'pasta' || id === 'drynoodles') {
      if (y > 2 && y < 5.8) return [id === 'pasta' ? '|' : '~', C(YEL, 12 + dCyl(x, half) * 3)];
    }
    if (id === 'rice' && y > 2) return [hash(Math.floor(x * 3), Math.floor(y * 3), 8104) > .4 ? ':' : '.', C(WHITE, 14)];
    return dLit(dCyl(x, half), id === 'butter' ? YEL : WHITE, 8);
  });
}
function heldProduce(it) {
  const id = it.id;
  return sculpt(30, 17, (x, y) => {
    const oval = (cx, cy, rx, ry, col) => dEll(x, y, cx, cy, rx, ry) < 1 ? dLit(dBall(x, y, cx, cy, rx, ry), col, 8) : null;
    if (id === 'cheese') {
      if (y < -5 || y > 6 || x < -6.5 || x > 6.5 - (y + 5) * .25) return null;
      for (const [cx, cy, r] of [[-3, -2, 1.1], [2, 1, 1.3], [-2, 4, .8]]) {
        if (Math.hypot(x - cx, y - cy) < r) return ['o', C(ORANGE, 8)];
      }
      return dLit(.8 - x * .035 - y * .02, YEL, 9);
    }
    if (id === 'potatoes') {
      for (const [cx, cy, rx, ry] of [[-3.6, 1, 3.4, 4.6], [3.3, .4, 3.8, 4.8], [0, -2.5, 3, 3.7]]) {
        const v = oval(cx, cy, rx, ry, BRICK);
        if (v) return hash(Math.floor(x * 2), Math.floor(y * 2), 8105) > .94 ? ['o', C(BRICK, 6)] : v;
      }
    } else if (id === 'onion' || id === 'garlic') {
      if (Math.abs(x) < .6 && y < -3.5 && y > -7.5) return ['|', C(id === 'onion' ? GREEN : WARM, 13)];
      const v = oval(0, 1, id === 'onion' ? 5 : 4.8, 5, id === 'onion' ? WARM : WHITE);
      if (v) return Math.abs(Math.sin(x * (id === 'onion' ? .85 : 1.3) + y * .1)) < .18 ? [')', C(id === 'onion' ? BRICK : WARM, 10)] : v;
    } else if (id === 'tomatoes' || id === 'peppers') {
      for (const [cx, cy, col] of [[-3.2, 1.2, RED], [3, 0, id === 'peppers' ? YEL : RED]]) {
        if (y < cy - 2.3 && y > cy - 5.4 && Math.abs(x - cx) < .45) return ['|', C(GREEN, 13)];
        const v = oval(cx, cy, 3.6, id === 'peppers' ? 4.7 : 3.6, col);
        if (v) return v;
      }
    } else if (id === 'mushrooms') {
      for (const [cx, cy] of [[-4.7, 1], [0, -1.7], [4.6, 1.4]]) {
        if (y > cy && y < cy + 5.2 && Math.abs(x - cx) < .8) return ['|', C(WHITE, 13)];
        const v = oval(cx, cy, 2.7, 2.3, WARM);
        if (v && y <= cy + .4) return v;
      }
    } else if (id === 'greens') {
      if (y > 0 && y < 7 && Math.abs(x) < 2.6 - y * .2) return ['|', C(WHITE, 13)];
      for (const [cx, cy] of [[-3, -1.3], [0, -3], [3, -1.3]]) {
        const v = oval(cx, cy, 2.8, 4.2, GREEN);
        if (v) return Math.abs(x - cx) < .25 ? ['|', C(GREEN, 8)] : v;
      }
    } else if (id === 'chilli') {
      for (const sg of [-1, 1]) {
        const cy = y + sg * .8, center = sg * 2.5 + Math.sin(cy * .32) * 1.2;
        if (cy > -5.4 && cy < 6.4 && Math.abs(x - center) < (6.4 - cy) * .17) return dLit(.7 - (x - center) * .15, RED, 8);
        if (cy > -7 && cy < -5.2 && Math.abs(x - center) < .45) return ['|', C(GREEN, 13)];
      }
    } else if (id === 'lemon') {
      const v = oval(0, 0, 6, 4, YEL);
      if (v) return hash(Math.floor(x * 4), Math.floor(y * 4), 8106) > .85 ? ['.', C(YEL, 11)] : v;
      if (Math.abs(x) < 6.8 && Math.abs(y) < .5) return ['>', C(YEL, 12)];
    }
    return null;
  });
}
for (const id of ['eggs', 'bread', 'butter', 'rice', 'pasta', 'drynoodles', 'rawchicken', 'mince', 'bacon', 'tofu']) DENSE[id] = heldGroceryPackage;
for (const id of ['cheese', 'potatoes', 'onion', 'tomatoes', 'garlic', 'mushrooms', 'greens', 'peppers', 'chilli', 'lemon']) DENSE[id] = heldProduce;

const HELD_BOWLS = new Set(['fishcurry', 'pomodoro', 'bolognese', 'macncheese', 'friedrice', 'chickencurry', 'stirfry', 'risotto', 'tomatosoup']);
const HELD_HAND_FOOD = { homeburger: 'burger', skewers: 'yakitori', fishstick: 'yakitori' };
function heldToast(it, f) {
  const toast = it.id === 'toast', fish = it.id === 'fishsandwich', burnt = it.q === 'burnt';
  return sculpt(30, 15, (x, y) => {
    const bite = dBites(x, y, f, 7);
    if (bite === true) return null;
    const half = 6.8 + (y < -2 ? Math.sqrt(Math.max(0, 1 - ((y + 2) / 4.5) ** 2)) * 1.4 : 0);
    if (y < -6.5 || y > 6 || Math.abs(x) > half) return null;
    const edge = Math.abs(x) > half - .8 || y < -5.6 || y > 5.2;
    let ch = dFill(.75 - x * .025), col = edge ? BRICK : WARM;
    if (bite === 'rim') { ch = ':'; col = WHITE; }
    else if (!toast && Math.abs(y - 1.4) < 1.5) {
      col = fish ? WHITE : YEL; ch = fish ? (Math.floor(x * 2) & 1 ? '/' : '%') : '~';
    } else if (Math.abs(fract((x + y * .25) / 3.5) - .5) < .12 && y < 1) {
      ch = '/'; col = BRICK; // toasted grill lines
    }
    return [ch, C(burnt ? GRAY : col, burnt ? 4 + hash(x, y, 8112) * 3 : edge ? 11 : 14)];
  });
}
function heldMeal(it, f) {
  const id = it.id, burnt = it.q === 'burnt';
  if (['toast', 'grilledcheese', 'fishsandwich'].includes(id)) return heldToast(it, f);
  if (HELD_HAND_FOOD[id]) {
    const [art, col] = DENSE[HELD_HAND_FOOD[id]](it, f);
    return [art, (ch, r, c) => burnt ? C(GRAY, 5 + (r + c) % 3) : col(ch, r, c)];
  }
  const bowl = HELD_BOWLS.has(id), soup = ['fishcurry', 'chickencurry', 'tomatosoup'].includes(id);
  return sculpt(34, 19, (x, y) => {
    const steam = dSteam(x, y, -3.3, f, [-3.1, 2.7], 5);
    if (steam && !burnt) return steam;
    const dish = dEll(x, y, 0, 2.6, 9.4, bowl ? 5.5 : 4.6);
    if (dish > 1) return null;
    const b = dBall(x, y, 0, 2.6, 9.4, 6), rim = dEll(x, y, 0, 1.3, 8.4, bowl ? 2.9 : 3.5);
    const ceramic = () => dLit(b, WHITE, 8);
    if (rim > 1 || bowl && y > 3) return ceramic();
    if (rim > .87) return ['=', C(it.q === 'perfect' ? CYAN : WHITE, 13)];
    const eaten = x > -8 + f * 16;
    if (eaten) return bowl ? [':', C(WHITE, 7)] : ceramic();
    const food = (ch, col, light = 13) => [ch, C(burnt ? GRAY : col, burnt ? 4 + hash(x, y, 8111) * 3 : light)];
    const n = hash(Math.floor(x * 2.3), Math.floor(y * 2.3), 8110);
    if (['panfish', 'fishchips', 'grilledfish'].includes(id)) {
      if (id === 'grilledfish' && dEll(x, y, 5.4, 1.8, 1.8, 1.5) < 1) return food('o', YEL, 15);
      if (id === 'fishchips' && y > 1.7 && Math.abs(x) < 7.2) return food(Math.floor(x * 1.2) & 1 ? '|' : '=', YEL);
      if (dEll(x, y, -1, 0, 5.9, 2.1) < 1) return food(Math.abs(fract((x + y) * .35) - .5) < .1 ? '/' : dFill(b), id === 'panfish' ? ORANGE : WARM);
      return ceramic();
    }
    if (id === 'friedeggs' || id === 'baconeggs') {
      if (id === 'baconeggs' && y > 2.6) return food(Math.sin(x * 2 + y) > 0 ? '~' : '=', RED);
      for (const cx of [-3.2, 3]) {
        if (dEll(x, y, cx, .5, 3.2, 2.5) < 1) return food(dEll(x, y, cx, .4, 1.2, 1.1) < 1 ? '@' : '#', dEll(x, y, cx, .4, 1.2, 1.1) < 1 ? YEL : WHITE, 15);
      }
      return ceramic();
    }
    if (id === 'omelette') {
      if (dEll(x, y, 0, .6, 6.8, 3) < 1 && y > -.6) return food(n > .82 ? 'o' : dFill(b), n > .82 ? BRICK : YEL);
      return ceramic();
    }
    if (id === 'roastchicken') {
      if (dEll(x, y, 0, .3, 4.5, 2.8) < 1) return food(n > .8 ? '%' : '#', BRICK, 14);
      for (const cx of [-6, 6]) if (dEll(x, y, cx, 1.8, 1.7, 2) < 1) return food('o', WARM);
      return ceramic();
    }
    if (id === 'jacketpotato') {
      if (dEll(x, y, 0, 1, 5.6, 2.7) < 1) return food(Math.abs(y - 1) < .6 || Math.abs(x) < .5 ? '=' : '#', Math.abs(y - 1) < .6 ? YEL : BRICK);
      return ceramic();
    }
    if (id === 'grilledveg') return food(n > .7 ? '%' : n > .4 ? '#' : 'o', n > .7 ? GREEN : n > .4 ? RED : WARM);
    if (soup) return food(n > .82 ? 'o' : n > .68 ? ',' : '~', n > .82 ? WARM : n > .68 ? GREEN : id === 'tomatosoup' ? RED : ORANGE);
    if (id === 'risotto' && n > .8) return food('o', BRICK);
    if (id === 'friedrice' && n > .75) return food(n > .9 ? '%' : '@', n > .9 ? GREEN : YEL);
    if (id === 'stirfry' && n > .8) return food('%', GREEN);
    const col = id === 'pomodoro' || id === 'bolognese' ? RED : id === 'risotto' || id === 'friedrice' ? WHITE : YEL;
    return food(id === 'risotto' || id === 'friedrice' ? ':' : Math.sin(x * 2 + y * 1.5) > 0 ? '~' : '=', col);
  });
}
for (const recipe of RECIPES) DENSE[recipe.id] = heldMeal;

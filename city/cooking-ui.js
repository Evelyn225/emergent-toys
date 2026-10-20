// ===== cooking, on screen (cooking.js has the rules): the public grills and the campfire out of doors, the panel of
// what you can make where you are, the pan itself (a minigame: minigame-ui.js shows it), and the pictures of the
// groceries and what you make of them

// ---- out of doors: a kettle grill on its three legs, the coals glowing while you're cooking on it; and a campfire in its
// ring of stones on Lighthouse Island, always burning a little, roaring while there's something over it
let cookCtx = null; // what's on, and where: { on: 'stove' | 'grill' | 'fire', spot, recipe, pantry }
const cookingOn = () => game && game.g.id === 'cook' && cookCtx ? cookCtx.on : null;
SOLID_SHADE.grill = o => (i, t, L) => {
  const f = HIT.face, w = HIT.w, lit = cookCtx && cookCtx.spot === o.spot && game && game.g.id === 'cook';
  if (w < 0.06 && f !== 5) return Math.abs(Math.abs(HIT.u) - o.hl + 0.008) < 0.008 && (f === 3 || f === 4) ? (set(i, '|', C(GRAY, L)), true) : false; // the legs: see-through between
  if (f === 5) { BG[i] = lit ? C(RED, 2 + Math.sin(T * 7 + HIT.u * 40) * 0.8) : C(GRAY, 0.8); return set(i, fract(HIT.u * 40) < 0.4 ? '#' : lit && hash(Math.floor(HIT.u * 60), Math.floor(T * 6), 1801) > 0.7 ? '*' : '=', C(lit ? ORANGE : GRAY, lit ? 13 : L * 0.7)), true; } // the grate, the coals under it
  BG[i] = C(GRAY, (0.7 + L * 0.12) * shadeFace(f)); // the kettle: black enamel
  return set(i, w > 0.094 ? '=' : f === 3 && Math.abs(HIT.u) < 0.012 && w < 0.075 ? 'o' : ' ', C(GRAY, L)), true;
};
// the campfire: a ring of round stones, logs leaning in together, flames that face you from whichever side you
// come at it (licking up in tongues, white-hot at the heart, red at the tips), sparks drifting up out of it, and a warm
// pool of light flickering on the ground round it (fireGlow: the floor asks). It's always burning a little; it roars
// while you've something over it. (Its solid box is only there to walk round)
SOLID_SHADE.campfire = () => () => false;
const fireRoar = o => cookCtx && cookCtx.spot === o && game && game.g.id === 'cook' ? 1 : 0.6;
const FIRES = GRILLS.filter(o => o.on === 'fire');
function fireGlow(wx, wy) {
  let k = 0;
  for (const o of FIRES) {
    const d = Math.hypot(rel(wx - o.x), rel(wy - o.y)), R = 0.32 + fireRoar(o) * 0.3;
    if (d < R) k = Math.max(k, (1 - d / R) ** 2.2 * (0.85 + 0.15 * Math.sin(T * 9 + d * 20) * Math.sin(T * 5.3)));
  }
  return k * clamp(Math.max(night, overcast * 0.5) * 1.4 - 0.1, 0, 1); // (by day you'd never see it)
}
function drawCampfires() {
  for (const o of FIRES) {
    const [vx, vy] = R(o.x, o.y);
    if (Math.hypot(vx, vy) > Math.min(vis, 16) || !inView(vx, vy, 0.4)) continue;
    const roar = fireRoar(o), warm = 0.35 + 0.65 * Math.max(night, overcast * 0.5);
    for (let k = 0; k < 10; k++) { // the stones
      const an = k / 10 * TAU + 0.3, sx = vx + Math.cos(an) * 0.075, sy = vy + Math.sin(an) * 0.075, face = Math.cos(an - Math.atan2(-vy, -vx)); // (the side towards the fire's lit)
      dot(sx, sy, 0.009, 0.013, (i, t, L) => { BG[i] = C(face < 0 ? ORANGE : GRAY, 1.1 + L * 0.2 + (face < 0 ? warm * 2.5 : 0)); return set(i, hash(k, 1, 1811) > 0.5 ? 'o' : '@', C(GRAY, L * 0.8)), true; });
    }
    for (let k = 0; k < 5; k++) { // the logs, leaning in to a point
      const an = k / 5 * TAU + 0.6;
      drawRod(vx + Math.cos(an) * 0.05, vy + Math.sin(an) * 0.05, 0.004, vx + Math.cos(an) * 0.008, vy + Math.sin(an) * 0.008, 0.055, 0.006, (i, t, L) => {
        const ember = HIT.w > 0.03 && hash(k, Math.floor(T * 4 + HIT.w * 30), 1813) > 0.6;
        BG[i] = ember ? C(RED, 2 + warm * 3) : C(BRICK, 1 + L * 0.15); return set(i, ember ? '*' : '=', ember ? C(ORANGE, 14) : C(BRICK, L * 0.7)), true;
      });
    }
    // the flames and the sparks over them: a billboard, so it's round from every side
    const H = 0.1 + 0.08 * roar, top = 0.36;
    drawShape(vx, vy, 0.008, 0.07, top, (i, u, z, du, dz, L) => {
      if (z > H) { // above it: sparks drifting up and fading
        const cell = hash(Math.floor(u / du + Math.sin(z * 30 + T) * 2), Math.floor(z / dz - T * 9), 1815);
        if (cell > 0.985 - roar * 0.008 && Math.abs(u) < 0.03 + (z - H) * 0.15) return set(i, cell > 0.997 ? '*' : '.', C(z > H + 0.12 ? ORANGE : YEL, 14 - (z - H) * 25)), true;
        return false;
      }
      const h = z / H, n = noise(u * 55, z * 28 - T * 7, 1817), width = 0.055 * (1 - h) ** 0.7 * (0.75 + 0.5 * n); // tongues licking up, flickering
      const off = Math.abs(u - Math.sin(T * 3 + z * 40) * 0.006 * h);
      if (off > width) return false;
      const core = off / Math.max(width, 1e-4) < 0.45 && h < 0.6;
      BG[i] = core ? C(YEL, 5 + (1 - h) * 6) : C(h > 0.7 ? RED : ORANGE, 3 + (1 - h) * 6);
      return set(i, core ? (h < 0.25 ? '@' : '#') : h > 0.75 ? "'" : n > 0.5 ? '^' : 'A', C(core ? WHITE : YEL, 15)), true;
    });
  }
}
// standing at one, out of doors
const nearGrill = () => mode === 'walk' ? GRILLS.find(o => Math.hypot(rel(o.x - px), rel(o.y - py)) < 0.28) || null : null;
const grillPrompt = o => o.on === 'fire' ? 'E: cook over the campfire' : 'E: cook on the grill';

// ---- the panel: what you can make here, what each needs, and whether you've got it (in your bag, or at home in the
// fridge); the ones you can make first. 1-9 or a click to start one
let cookEl = null;
function openCooking(on, pantry = null, spot = null) {
  if (!cookEl) { cookEl = panel('cooking'); cookEl.querySelector('.panel').style.width = 'min(580px, calc(100vw - 32px))'; } // (wider: what each needs goes along the row)
  cookCtx = { on, pantry: pantry || [], spot };
  const list = recipesAt(on).map(r => ({ r, ms: makings(r, cookCtx.pantry) })).sort((p, q) => q.ms.every(m => m.from) - p.ms.every(m => m.from));
  cookCtx.list = list.map(e => e.r);
  const ready = list.filter(e => e.ms.every(m => m.from)).length;
  const rows_ = list.map(({ r, ms }, k) => {
    const ok = ms.every(m => m.from), needs = ms.map(m => `<span style="color:${m.from ? '#9d9' : 'rgba(255,255,255,0.3)'}">${m.need === 'fish' ? 'a fish' : ITEMS[m.need].name}${m.from === 'fridge' ? ' (fridge)' : ''}</span>`).join(', ');
    return `${k === 0 && ready ? '<h2>you can make</h2>' : ''}${k === ready ? `<h2>${ready ? 'missing something' : 'nothing you have the makings of yet'}</h2>` : ''}<button class="item" data-cook="${k}" ${ok ? '' : 'disabled'}><span class="k">${k < 9 ? k + 1 : ''}</span><span>${r.name}</span><span class="lead"></span><span class="v" style="font-size:0.85em">${needs}</span></button>`;
  }).join('');
  const where = { stove: 'At the stove', grill: 'At the grill', fire: 'At the campfire' }[on];
  showPanel(cookEl, `<h1>${where}</h1><p class="sub">${pantry ? 'From your bag and the fridge' : 'From your bag'} &middot; the grocer's, the market and the deli sell the makings</p>${rows_}
    <p class="hint">${TOUCH ? 'Tap a recipe, then hold Heat; use Flip / Stir / Turn and Add when prompted. Close to leave.' : '1-9 cook &middot; then HOLD SPACE for heat, UP to flip or stir, DOWN to add &middot; E / Esc close'}</p>`);
  cookEl.onclick = e => { const b = e.target.closest('[data-cook]'); if (b) startCooking(cookCtx.list[+b.dataset.cook]); };
}
function startCooking(r) {
  if (!r || !canMake(r, cookCtx.pantry)) return;
  hidePanel(cookEl);
  cookCtx.recipe = r.id;
  startGame('cook', 'cook', '', { recipe: r.id });
  game.onDone = verdict => { say(serveDish(r, verdict, cookCtx.pantry), 5); if (actx) sfxUse('chime'); };
}
// keys while the panel's up (goods-ui.js panelKey asks); true if handled
function cookPanelKey(e) {
  if (!cookEl || cookEl.style.display !== 'flex') return false;
  const n = /^Digit([1-9])$/.exec(e.code);
  if (e.code === 'Escape' || e.code === 'KeyE') hidePanel(cookEl);
  else if (n) startCooking(cookCtx.list[n[1] - 1]);
  return true;
}
// the pan's noises (minigame-ui.js sfxGame asks first)
function sfxCook(e) {
  const at = actx.currentTime;
  if (e === 'sizzle') { fishNoise(at, 0.3, 5000, 3500, 1.2, 0.05, 0.1); return true; }
  if (e === 'flip') { fishNoise(at, 0.12, 900, 1600, 1, 0.12, 0.2); tone(at + 0.1, 140, 0.08, 0.1); return true; }
  if (e === 'stir') { fishNoise(at, 0.25, 600, 400, 2, 0.1, 0.3); return true; }
  if (e === 'add') { fishNoise(at, 0.4, 4500, 3000, 1, 0.14, 0.05); return true; } // into the hot pan: a hiss
  if (e === 'flare') { fishNoise(at, 0.5, 800, 300, 0.7, 0.2, 0.1); return true; }
  if (e === 'due') { tone(at, 990, 0.06, 0.04, 'square'); return true; }
  return false;
}

// ---- the pictures: the groceries, and what you make of them (eaten down bite by bite)
Object.assign(DROPPED_ART, {
  eggs: () => [[' ______', '|(O)(O)|', '|(O)(O)|', "'------'"], c => c === 'O' ? C(WHITE, 15) : C(BRICK, 12)],
  bread: () => [['  .----.', ' (~~~~~~)', ' |      |', ' |______|'], (c, r) => r < 2 ? C(BRICK, 13) : C(WARM, 14)],
  butter: () => [[' ______', '|BUTTER|', "'------'"], (c, r) => r === 1 && /[A-Z]/.test(c) ? C(RED, 13) : C(YEL, 14)],
  cheese: () => [['   ___', '  /o  \\', ' /__o__\\', '|  o   |', "'------'"], c => c === 'o' ? C(WARM, 9) : C(YEL, 14)],
  rice: () => [['  _____', ' | RICE|', ' |.....|', " '-----'"], (c, r) => /[A-Z]/.test(c) ? C(RED, 13) : c === '.' ? C(WHITE, 14) : C(WHITE, 11)],
  pasta: () => [['  _____', ' |PASTA|', ' ||||||| ', " '-----'"], (c, r) => /[A-Z]/.test(c) ? C(BLUE, 13) : c === '|' && r === 2 ? C(YEL, 14) : C(WHITE, 11)],
  drynoodles: () => [[' ~~~~~~', '(~~~~~~)', " ~~~~~~"], () => C(YEL, 13)],
  potatoes: () => [['  .-. .-.', ' ( o )( . )', "  `-' `-'"], c => c === 'o' || c === '.' ? C(BRICK, 8) : C(BRICK, 13)],
  onion: () => [['   |', '  .^.', ' ( | )', "  `-'"], (c, r) => r === 0 ? C(GREEN, 12) : C(WARM, 14)],
  tomatoes: () => [['  v   v', ' (o) (o)', "  -   -"], (c, r) => c === 'v' ? C(GREEN, 13) : C(RED, 14)],
  garlic: () => [['   |', '  /|\\', ' (_|_)'], (c, r) => C(WHITE, 14)],
  mushrooms: () => [[' .--. .--.', '(____)(____)', '  ||    ||'], (c, r) => r === 2 ? C(WHITE, 13) : C(WARM, 13)],
  greens: () => [['  \\|/', '  \\|/', '  (|)', '   |'], (c, r) => r < 2 ? C(GREEN, 14) : C(WHITE, 12)],
  peppers: () => [['   |   |', '  (R) (Y)', "   V   V"], c => c === 'Y' ? C(YEL, 14) : c === '|' ? C(GREEN, 12) : C(RED, 14)],
  chilli: () => [['  _', ' / )', '( /', ' V'], (c, r) => r === 0 ? C(GREEN, 12) : C(RED, 14)],
  lemon: () => [['  .--.', ' (    )>', "  `--'"], () => C(YEL, 15)],
  rawchicken: () => [[' ______', '|(%%%%)|', '|(%%%%)|', "'------'"], c => c === '%' ? C(MAG, 12) : C(WHITE, 12)],
  mince: () => [[' ______', '|~%~%~%|', '|%~%~%~|', "'------'"], c => c === '%' || c === '~' ? C(RED, 12) : C(WHITE, 12)],
  bacon: () => [[' ~=~=~=~', ' =~=~=~=', ' ~=~=~=~'], c => c === '=' ? C(WHITE, 13) : C(RED, 13)],
  tofu: () => [[' ______', '|      |', '|______|'], () => C(WHITE, 14)],
});
// the dishes: a plate (or a bowl, or a bun), less of it each bite
const plate = (food, col, bowl = false) => (it, f) => [[bitten([` ${food}`], f)[0] || ' ', bowl ? '\\_____/' : '(_______)'], (c, r) => r === 0 && c !== ' ' ? C(it.q === 'burnt' ? GRAY : col, it.q === 'burnt' ? 7 : 14) : C(WHITE, 12)]; // (the food goes, the plate stays)
Object.assign(DROPPED_ART, {
  panfish: plate('<o)))><', ORANGE), fishchips: plate('<o)>=-=-', YEL), fishcurry: plate('~o~o~o', ORANGE, true), grilledfish: plate('<o)))>()', WARM),
  fishstick: plate('-<o)))>', ORANGE), fishsandwich: plate('[<o)>]', WARM), friedeggs: plate('(O) (O)', YEL), omelette: plate('(=====)', YEL),
  baconeggs: plate('~~(O)~~', ORANGE), grilledcheese: plate('[####]', YEL), toast: plate('[ ] [ ]', BRICK), pomodoro: plate('~@~@~@', RED, true),
  bolognese: plate('~@#@#@', RED, true), macncheese: plate('oooooo', YEL, true), homeburger: plate('(####)', BRICK), friedrice: plate(':.:.:.', YEL, true),
  chickencurry: plate('~#~#~#', ORANGE, true), roastchicken: plate('(%%)oo', WARM), skewers: plate('-#-o-#-', BRICK), stirfry: plate('~%~%~%', GREEN, true),
  risotto: plate(':o:o:o', WHITE, true), jacketpotato: plate('(    )', BRICK), tomatosoup: plate('~~~~~~', RED, true), grilledveg: plate('#o# #o#', GREEN),
});

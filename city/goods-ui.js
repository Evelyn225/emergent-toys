// ===== goods on screen: the shop menu, the inventory, the hotbar, and what's in your hand (or mouth, or underfoot)
// ---- in your hand: ASCII art at the bottom right, bobbing as you walk. No backgrounds: every character has a thin
// dark outline so it reads over anything, and the fingers hide the bottom of whatever you're holding. Things change
// as you use them: glasses empty, food gets bitten, a coffee stops steaming, the pack runs down.
// HAND[id] = (it, f) => [lines, colour(ch, row, col)], f = how much is left (0..1)
const usesLeft = it => { const m = ITEMS[it.id].uses || 0; return m ? clamp(it.uses / m, 0, 1) : 1; };
// a glass or bowl: interior spans [row, c0, c1] (top to bottom) filled from the bottom up to f, a surface on top
function filled(lines, spans, f, body, surface = '~') {
  const out = lines.slice(), k = Math.ceil(f * spans.length - 1e-9);
  spans.forEach(([r, c0, c1], i) => {
    const lvl = spans.length - 1 - i, ch = lvl < k - 1 ? body : lvl === k - 1 ? surface : ' ';
    out[r] = out[r].slice(0, c0) + ch.repeat(c1 - c0 + 1) + out[r].slice(c1 + 1);
  });
  return out;
}
// bites: a rounded notch out of one side (right / top / bottom), deeper the more is gone (just pieces missing)
function bitten(lines, f, from = 'right', edge = '') { // edge: what the bitten surface shows (an apple's white flesh), if anything
  if (f >= 0.999) return lines;
  const H = lines.length, W = Math.max(...lines.map(l => l.length)), gone = 1 - f;
  return lines.map((l, y) => [...l.padEnd(W)].map((ch, x) => {
    const d = from === 'right' ? Math.hypot((W - 1 - x) / W, (y - H * 0.4) / H * 0.9) / (gone * 0.95)
            : from === 'top' ? Math.hypot((x - W / 2) / W * 0.8, y / H) / (gone * 1.05)
            : Math.hypot((x - W / 2) / W * 0.8, (H - 1 - y) / H) / (gone * 1.05);
    return d < 1 ? ' ' : edge && d < 1.25 && ch !== ' ' ? edge : ch;
  }).join('').replace(/\s+$/, ''));
}
// (bitten with 0.45 + f * 0.55: something you'd drink or slurp, bitten anyway, but never quite to nothing)
const hue = (map, dflt) => (c, r) => { for (const [chars, col] of map) if (chars.includes(c)) return col; return dflt; };
const HAND = {
  // the night market's: street food, charms, curios, and the two that bend the world
  bao: (it, f) => [bitten(['   _.~~._', '  ( ~ ~  )', ' (        )', "  `------'"], f), (c, r) => r < 2 && c === '~' ? C(GRAY, 12) : C(WHITE, 14)],
  eggwaffle: (it, f) => [bitten([' .oOoOoOo.', ' oOoOoOoOo', ' oOoOoOoOo', " `oOoOoOo'"], f), (c, r) => c === 'O' ? C(YEL, 15) : C(ORANGE, 13)],
  stinkytofu: (it, f) => [[' ~ ~ ~', ...Array.from({ length: Math.max(1, it.uses) }, () => ' [##]'), '   |', '   |'], (c, r) => c === '~' ? C(GREEN, 10) : c === '#' ? C(ORANGE, 14) : c === '|' ? C(BRICK, 12) : C(YEL, 13)],
  bubbletea: (it, f) => [filled(['    //', '  .//__.', ' |      |', ' |      |', ' |      |', ' |oOoOoo|', "  `----'"], [[2, 2, 7], [3, 2, 7], [4, 2, 7]], f, ':', '~'),
    (c, r) => r < 2 && c === '/' ? C(MAG, 13) : c === 'o' || c === 'O' ? C(BRICK, 10) : c === ':' || c === '~' ? C(WARM, 14) : C(WHITE, 11)],
  redstring: () => [['  .----.', ' (      )', '  `-oo-\'', '     \\\\'], (c, r) => c === 'o' ? C(YEL, 15) : C(RED, 13)],
  luckycoin: () => [['  .---.', ' / .-. \\', '| | # | |', ' \\ `-\' /', "  `---'"], (c, r) => c === '#' ? C(GRAY, 6) : C(YEL, 14)],
  goldfish: () => { const k = Math.floor(T * 1.5) & 1; return [['   _/\_', '  (    )', ` ( ${k ? '><>' : '<><'}  )`, ' (  ~ ~ )', "  `----'"], (c, r) => c === '>' || c === '<' ? C(ORANGE, 15) : r === 0 ? C(RED, 13) : c === '~' ? C(CYAN, 12) : C(WHITE, 11)]; },
  postcard: () => [[' .--------.', ' | /^\\ ~ |', ' |T-REX  #|', " '--------'"], (c, r) => c === '#' ? C(RED, 14) : r === 1 ? C(GREEN, 13) : r === 2 ? C(BRICK, 13) : C(WHITE, 13)],
  dinotoy: () => [['      __', '     / o)', ' .-^^ /', '<__  |', '   ||\\\\'], (c, r) => c === 'o' ? C(WHITE, 15) : C(GREEN, 13)],
  replicastar: () => [['  ____', ' /\\  /\\', '/__\\/__\\', '\\  \\/  /', ' \\    /', '  \\  /', '   \\/'], (c, r) => C(CYAN, 9)],
  orrery: () => { const k = Math.floor(T * 0.5) & 3; return [['     .-o-.', `  o ( ${'-\\|/'[k]}*${'-/|\\'[k]} ) o`, "     `-o-'", '   ___|___', '  [=======]'], (c, r) => c === '*' ? C(YEL, 15) : c === 'o' ? C([CYAN, RED, GREEN, WHITE][r & 3], 14) : r > 2 ? C(BRICK, 12) : C(YEL, 12)]; },
  diamond: () => [['  ____', ' /\\  /\\', '/__\\/__\\', '\\  \\/  /', ' \\    /', '  \\  /', '   \\/'], (c, r) => C(fract(T * 2 + r * 0.2) < 0.15 ? WHITE : CYAN, 13 + (r & 1) * 2)],
  fortunecookie: (it, f) => [['   .---.', "  /  .-'\\", ' (  (  ~~~', "  `--`"], (c, r) => c === '~' ? C(WHITE, 15) : C(YEL, 13)],
  tigerbalm: it => [['  ._____.', ' |  /\\  |', ' | (oo) |', " |TIGER |", " `-----'"], (c, r) => r === 0 ? C(GRAY, 12) : c === 'o' || c === '/' || c === '\\' || c === '(' || c === ')' ? C(ORANGE, 15) : /[A-Z]/.test(c) ? C(YEL, 14) : C(RED, 12)],
  lantern: () => [['    |', '  .-=-.', ' ( ||| )', ' ( ||| )', "  `-=-'", '    ~'], (c, r) => r === 0 ? C(GRAY, 10) : c === '=' || c === '~' ? C(YEL, 15) : c === '|' && r > 1 && r < 4 ? C(YEL, 14) : C(RED, 15)],
  firecrackers: it => [['   *', '   \\', ...Array.from({ length: Math.max(1, it.uses) * 2 }, (_, k) => k & 1 ? '  ==]' : ' [==  '), '   |'], (c, r) => c === '*' ? C(YEL, 15) : c === '\\' || c === '|' ? C(GRAY, 11) : C(RED, 14)],
  mysterybox: () => [['  _\\ /_', ' |  X  |', ' |  ?  |', ' |_____|'], (c, r) => c === '?' ? C(WHITE, 15) : c === 'X' || c === '\\' || c === '/' ? C(RED, 14) : C(BRICK, 13)],
  pocketwatch: () => { const k = Math.floor(T * (K.KeyT && timeKeys() ? 12 : 1)) & 3; // the hands, round and round
    return [['    o', '  .-^-.', ' / 12  \\', `|9  ${'|/-\\'[k]}  3|`, ' \\  6  /', "  `---'"], (c, r) => r === 0 ? C(GRAY, 12) : r === 3 && '|/-\\'.includes(c) ? C(GRAY, 3) : /[0-9]/.test(c) ? C(BRICK, 9) : r === 1 || c === '/' || c === '\\' || c === '`' || c === "'" || c === '|' ? C(YEL, 13) : C(WARM, 14)]; },
  cityglobe: () => [['  .-----.', ' / * # * \\', '| #|#|#|# |', ' \\ ##### /', "  '-----'", ' [GLYPHPT]'], (c, r) => r === 5 ? (c === '[' || c === ']' ? C(BRICK, 13) : C(YEL, 12)) : c === '*' ? C(WHITE, 15) : c === '#' ? C(YEL, 13) : C(CYAN, 12)],
  // drinks: a paper cup steams less as it goes; glasses show their level
  coffee: (it, f) => [[f > 0.5 ? '  ( ( (' : '', f > 0.25 ? '   ) ) )' : '', ' ._______.', ' [_______]', '  |     |', '  |CAFE |', '  |     |', '   \\___/'],
    (c, r) => r < 2 ? C(WHITE, 8) : 'CAFE'.includes(c) ? C(GREEN, 13) : r < 4 ? C(GRAY, 12) : C(WHITE, 14)],
  latte: (it, f) => [filled([' .________.', ' |        |__', ' |        |  )', ' |        |  )', ' |        |_/', " '--------'"], [[1, 2, 9], [2, 2, 9], [3, 2, 9], [4, 2, 9]], f, ':', '~'),
    (c, r) => c === ':' ? C(BRICK, 13) : c === '~' ? C(WHITE, 15) : C(WHITE, 12)],
  tea: (it, f) => [filled(['   ) )', ' ._______.', ' |       |\\', ' |       | )', '  \\_____/_/', ' ========='], [[2, 2, 8], [3, 2, 8]], f, ':', '~'),
    (c, r) => r === 0 ? C(WHITE, 7) : c === ':' || c === '~' ? C(ORANGE, 12) : C(WHITE, 13)],
  soda: (it, f) => [bitten([' _______', '(_______)', '|       |', '| C O L |', '|   A   |', '|  ~~~  |', '(_______)'], 0.45 + f * 0.55), (c, r) => /[A-Z~]/.test(c) ? C(WHITE, 15) : C(RED, 13)],
  energy: (it, f) => [bitten([' _______', '(_______)', '|  ZAP  |', '|   /   |', '|  /_   |', '|   /   |', '(_______)'], 0.45 + f * 0.55), (c, r) => /[A-Z/_]/.test(c) && r > 1 && r < 6 ? C(YEL, 15) : C(GREEN, 12)],
  water: (it, f) => [filled(['   [=]', '   | |', '  /   \\', ' |     |', ' |     |', ' |     |', ' |_____|'], [[3, 2, 6], [4, 2, 6], [5, 2, 6]], f, ':', '~'),
    (c, r) => c === ':' || c === '~' ? C(CYAN, 14) : r === 0 ? C(BLUE, 13) : C(CYAN, 9)],
  beer: (it, f) => [filled([' ________', '|        |__', '|        |  |', '|        |  |', '|        |__|', '|        |', ' \\______/'], [[1, 1, 8], [2, 1, 8], [3, 1, 8], [4, 1, 8], [5, 1, 8]], f, '#', '@'),
    (c, r) => c === '#' ? C(YEL, 13) : c === '@' ? C(WHITE, 15) : C(WHITE, 10)],
  whiskey: (it, f) => [filled([' _________', '|         |', '|         |', '|         |', '|_________|'], [[1, 1, 9], [2, 1, 9], [3, 1, 9]], f, '#', '~'),
    (c, r) => c === '#' || c === '~' ? C(ORANGE, 13) : C(WHITE, 11)],
  cocktail: (it, f) => [filled(['   o   /', '\\-------/', ' \\     /', '  \\   /', '   \\ /', '    |', '  __|__'], [[2, 2, 6], [3, 3, 5]], f, '%', '~'),
    (c, r) => c === 'o' ? C(RED, 15) : c === '%' || c === '~' ? C(MAG, 14) : C(WHITE, 12)],
  milkshake: (it, f) => [filled(['     /', '    /', '  @@/@@', ' |    |', ' |    |', ' |    |', '  \\__/'], [[3, 2, 5], [4, 2, 5], [5, 2, 5]], f, '%', '%'),
    (c, r) => c === '/' && r < 3 ? C(RED, 13) : c === '@' ? C(WHITE, 15) : c === '%' ? C(MAG, 13) : C(WHITE, 11)],
  smoothie: (it, f) => [filled(['    |', '  .-|-.', ' |     |', ' |     |', ' |     |', '  \\___/'], [[2, 2, 6], [3, 2, 6], [4, 2, 6]], f, '%', '~'),
    (c, r) => r < 2 && c === '|' ? C(GREEN, 14) : c === '%' || c === '~' ? C(ORANGE, 14) : C(WHITE, 11)],
  thaitea: (it, f) => [filled(['    ||', '  __||__', ' |      |', ' |      |', ' |      |', '  \\____/'], [[2, 2, 7], [3, 2, 7], [4, 2, 7]], f, ':', '~'),
    (c, r) => r < 2 && c === '|' ? C(WHITE, 13) : c === ':' ? C(ORANGE, 13) : c === '~' ? C(WARM, 15) : C(WHITE, 11)],
  herbaltea: (it, f) => [filled(['  ~ ~', ' .------.', ' |      |o', ' |      |', "  `----'"], [[2, 2, 7], [3, 2, 7]], f, ':', '~'),
    (c, r) => r === 0 ? C(WHITE, 7) : c === ':' || c === '~' ? C(GREEN, 13) : c === 'o' ? C(GRAY, 12) : C(BRICK, 13)],
  // food: bites out of it
  hotdog: (it, f) => [bitten(['  ____________', ' (~~~~~~~~~~~~)', '(==============)', ' (____________)'], f),
    (c, r) => c === '~' ? C(YEL, 15) : c === '=' ? C(RED, 13) : C(ORANGE, 12)],
  taco: (it, f) => [bitten(['    _______', '  .%%%%%%%%%.', ' /%%%%%%%%%%%\\', '/_____________\\'], f), (c, r) => c === '%' ? C(GREEN, 13) : C(YEL, 13)],
  icecream: (it, f) => [bitten(['   .@@@@.', '  @@@@@@@@', '  @@@@@@@@', '   \\####/', '    \\##/', '     \\/'], 0.35 + f * 0.65),
    (c, r) => c === '@' || c === 'v' ? C(MAG, 14) : C(ORANGE, 12)],
  noodlebox: (it, f) => [filled(['     //', '    //', ' __//____', '|~~~~~~~~|', '|~~~~~~~~|', ' \\______/'], [[3, 1, 8], [4, 1, 8]], f, '~'),
    (c, r) => r < 3 ? C(BRICK, 12) : c === '~' ? C(YEL, 14) : C(WHITE, 13)],
  ramen: (it, f) => [bitten(filled(['     ||', '  ___||_____', ' (~~~~~~~~~~)', '  \\________/'], [[2, 2, 11]], 1, '~'), 0.45 + f * 0.55, 'top'),
    (c, r) => r < 2 ? C(BRICK, 12) : c === '~' ? C(YEL, 14) : C(RED, 12)],
  pho: (it, f) => [bitten(filled(['     ||', '  _,_||_,_,_', ' (~~~~~~~~~~)', '  \\________/', '    \\____/'], [[2, 2, 11]], 1, '~'), 0.45 + f * 0.55, 'top'),
    (c, r) => c === ',' ? C(GREEN, 14) : r < 2 && c === '|' ? C(BRICK, 12) : c === '~' ? C(WARM, 14) : C(WHITE, 13)],
  banhmi: (it, f) => [bitten(['   ____________', ' /%%=%%=%%=%%=%\\', '(~~~~~~~~~~~~~~~)', " '-------------'"], f),
    (c, r) => c === '%' ? C(GREEN, 13) : c === '=' ? C(RED, 12) : c === '~' ? C(ORANGE, 12) : C(WARM, 13)],
  padthai: (it, f) => [bitten(['    ,  .  ,', '  ~@~~*~~@~~', ' ~~~~*~~~~@~~', '(=============)', " '-----------'"], f, 'top'),
    (c, r) => c === '@' ? C(BRICK, 13) : c === '*' ? C(YEL, 14) : c === ',' || c === '.' ? C(GREEN, 13) : c === '~' ? C(ORANGE, 13) : C(WHITE, 12)],
  greencurry: (it, f) => [filled(['   ,  ,', ' .--------.', '(%%%%%%%%%%)', ' \\%%%%%%%%/', "  '------'"], [[2, 1, 10], [3, 2, 9]], f, '%', '~'),
    (c, r) => r === 0 ? C(GREEN, 14) : c === '%' || c === '~' ? C(GREEN, 12) : C(WHITE, 13)],
  mangorice: (it, f) => [bitten(['  .-~~~~-.', ' (@@@@@@@@)', ' (::::::::)', "(==========)"], f, 'top'),
    (c, r) => c === '@' || c === '~' && r === 0 ? C(YEL, 15) : c === ':' ? C(WHITE, 15) : c === '=' ? C(GREEN, 12) : C(YEL, 12)],
  cottoncandy: (it, f) => [bitten(['  .@@@@@.', ' @@@@@@@@@', '@@@@@@@@@@@', ' @@@@@@@@@', "  '@@@@@'", '     |', '     |', '     |'], 0.4 + f * 0.6, 'top'),
    (c, r) => c === '|' ? C(WHITE, 13) : C(MAG, (r + 13) % 3 ? 13 : 15)],
  corndog: (it, f) => [bitten(['  .-------.', ' (@@@@@@@@@)', "  '-------'", '      |', '      |', '      |'], f, 'top'),
    (c, r) => r > 2 ? C(WARM, 12) : c === '@' ? C(ORANGE, 13) : C(YEL, 13)],
  popcorn: (it, f) => [bitten([' o O o O o', 'oOoOoOoOoO', '|=|=|=|=|=|', '| POPCORN |', ' \\_______/'], f, 'top'),
    (c, r) => r < 2 ? C(WHITE, 15) : /[A-Z]/.test(c) ? C(WHITE, 15) : C(RED, 13)],
  lemonade: (it, f) => [filled(['    \\', ' .___\\__.', ' |      |', ' |      |', ' |      |', '  \\____/'], [[2, 2, 7], [3, 2, 7], [4, 2, 7]], f, ':', '~'),
    (c, r) => r < 2 && c === '\\' ? C(RED, 14) : c === ':' || c === '~' ? C(YEL, 15) : C(WHITE, 11)],
  fries: (it, f) => [bitten(['  | |||| |', '  ||||||||', ' \\========/', '  | FRIES|', '  |______|'], f, 'top'),
    (c, r) => r < 2 ? C(YEL, 15) : /[A-Z]/.test(c) ? C(WHITE, 15) : C(RED, 13)],
  chicken: (it, f) => [bitten([' (@) (@)(@)', '.----------.', '| CHICKEN  |', '|==========|', " \\________/"], f, 'top'),
    (c, r) => c === '@' || c === '(' || c === ')' ? C(ORANGE, 14) : /[A-Z]/.test(c) ? C(WHITE, 15) : r === 3 ? C(RED, 13) : C(WHITE, 12)],
  croissant: (it, f) => [bitten(['    _..--.._', '  .(\\  \\/  /).', ' (__\\__/\\__/__)'], f), (c, r) => C(ORANGE, 13)],
  donut: (it, f) => [bitten(['   .-~~~-.', '  /  .-.  \\', ' |  (   )  |', '  \\  `-`  /', "   `-...-'"], f), (c, r) => r < 2 || c === '~' ? C(MAG, 14) : C(WARM, 12)],
  bagel: (it, f) => [bitten(['   .-----.', '  /  .-.  \\', ' |  (   )  |', '  \\  `-`  /', "   `-----'"], f), (c, r) => C(WARM, 12)],
  sandwich: (it, f) => [bitten(['  _________', ' (%%%%%%%%%)', ' |=========|', ' |~~~~~~~~~|', ' (_________)'], f),
    (c, r) => c === '%' ? C(GREEN, 13) : c === '=' ? C(RED, 12) : c === '~' ? C(YEL, 13) : C(WARM, 12)],
  chips: (it, f) => [[' .--------.', ' | CHIPS  |', ' |  ' + (f > 0.5 ? '(__)' : f > 0 ? ' __ ' : '    ') + '  |', ' |  ' + (f > 0.25 ? '(__)' : '    ') + '  |', " '--------'"],
    (c, r) => /[A-Z]/.test(c) ? C(WHITE, 15) : c === '(' || c === ')' || r > 1 && c === '_' ? C(YEL, 15) : C(RED, 12)],
  apple: (it, f) => [bitten(['     ,', '   .-|-.', '  /     \\', ' |       |', '  \\     /', "   `---'"], f, 'right', '('), (c, r) => r === 0 || c === '|' && r === 1 ? C(GREEN, 13) : c === '(' ? C(WHITE, 13) : C(RED, 13)],
  slice: (it, f) => [bitten(['\\%%o%%%o%%/', ' \\%%%o%%%/', '  \\%o%%%/', '   \\%%%/', '    \\%/', '     V'], 0.4 + f * 0.6, 'top'),
    (c, r) => c === 'o' ? C(RED, 14) : c === '%' ? C(YEL, 14) : C(ORANGE, 12)],
  burger: (it, f) => [bitten(['   .-----.', '  / . . . \\', ' (%%%%%%%%%)', ' (=========)', ' (~~~~~~~~~)', "  '-------'"], f),
    (c, r) => c === '%' ? C(GREEN, 13) : c === '=' ? C(BRICK, 12) : c === '~' ? C(YEL, 14) : C(ORANGE, 13)],
  kebab: (it, f) => [bitten(['  _______', ' /%%%%%%%\\', ' |%=%=%=%|', ' |%%%%%%%|', ' \\_______/', '   |___|'], f, 'top'),
    (c, r) => c === '%' ? C(GREEN, 12) : c === '=' ? C(BRICK, 12) : C(WARM, 13)],
  sushi: it => { // a board of nigiri, one fewer each bite
    const n = clamp(it.uses, 1, 4);
    return [[' ' + ' _~_ '.repeat(n), ' ' + '(###)'.repeat(n), '[' + '='.repeat(n * 5) + ']'],
      (c, r) => r === 0 ? C(ORANGE, 14) : r === 1 ? C(WHITE, 15) : C(BRICK, 12)];
  },
  vhs: () => [[' ___________', '|  _     _  |', '| (_)===(_) |', '|___________|'], (c, r) => c === '(' || c === ')' || c === '_' && r === 2 ? C(WHITE, 13) : c === '=' ? C(GRAY, 9) : C(GRAY, 12)],
  dumplings: it => { // a tray of them, two by two, one fewer each time
    const n = clamp(it.uses, 1, 4), row = k => ' ' + ' .-. '.repeat(k).trimEnd(), body = k => ' ' + '(   )'.repeat(k);
    const lines = n > 2 ? [row(n - 2), body(n - 2), row(2), body(2)] : [row(n), body(n)];
    return [[...lines, '(__________)'], (c, r) => r === lines.length ? C(BRICK, 12) : C(WHITE, 14)];
  },
  mooncake: (it, f) => [bitten(['  .------.', ' (  .--.  )', ' ( ( ** ) )', ' (  `--`  )', "  '------'"], f), (c, r) => c === '*' ? C(YEL, 15) : C(ORANGE, 12)],
  ginseng: (it, f) => [bitten(['   \\ |/', '    \\|', '   (  )', '  / /\\ \\', ' / /  \\ \\'], f, 'bottom'), (c, r) => r < 2 ? C(GREEN, 13) : C(WARM, 13)],
  candy: (it, f) => [bitten([' _________', '[  CANDY  >', "'---------'"], f), (c, r) => /[A-Z]/.test(c) ? C(WHITE, 15) : C(MAG, 13)],
  // things
  cigarettes: it => { // the pack, with as many left as are poking out of it
    const n = Math.max(0, it.uses), tips = '  ' + 'i'.repeat(n).padEnd(5), sticks = '  ' + '|'.repeat(n).padEnd(5);
    return [[tips, sticks, ' .-------.', ' | SMOKES|', ' |  .-.  |', ' |  |_|  |', ' |_______|'],
      (c, r) => r === 0 ? C(ORANGE, 13) : r === 1 ? C(WHITE, 15) : /[A-Z]/.test(c) ? C(RED, 14) : C(WHITE, 13)];
  },
  book: () => [[' __________', '|\\  ~~~~  |', '| |  ~~~~ |', '| |       |', '| |  ===  |', ' \\|_______|'], (c, r) => c === '~' || c === '=' ? C(WHITE, 13) : C(BLUE, 13)],
  newspaper: () => [[' ___________', '|THE  DAILY |', '|===  ====  |', '|[] =======|', '|== ======= |', '|___________|'], (c, r) => /[A-Z]/.test(c) ? C(WHITE, 15) : C(GRAY, 12)],
  vinyl: () => [[' _________', '|  _____  |', '| /     \\ |', '|(   o   )|', '| \\_____/ |', '|_________|'], (c, r) => c === 'o' ? C(RED, 14) : r > 1 && r < 5 && c !== '|' ? C(GRAY, 13) : C(MAG, 13)],
  flowers: () => [['  *@ *@*', ' @*@ @* *', '  \\ |/ /', '   \\|//', '   [__]', '   [__]'],
    (c, r) => r < 2 ? C(ITEM_COL[(c.charCodeAt(0) + r * 3) & 7], 15) : r > 3 ? C(BRICK, 12) : C(GREEN, 13)],
  ball: () => [['   ____', '  / \\/ \\', ' |  /\\  |', ' | /  \\ |', '  \\_\\/_/'], (c, r) => c === '/' || c === '\\' ? C(GRAY, 9) : C(WHITE, 15)],
  boombox: () => [['  _[======]_', ' |  [    ]  |', ' |(O) == (O)|', ' |(_) == (_)|', ' |__________|'], (c, r) => c === 'O' ? C(GRAY, 14) : c === '=' ? C(CYAN, 14) : C(GRAY, 12)],
  skateboard: () => [['   .---.', '  /     \\', ' O=======O', ' |#######|', ' |%%%%%%%|', ' |#######|', ' |%%%%%%%|', ' O=======O', '  \\     /', "   '---'"],
    (c, r) => c === 'O' ? C(WHITE, 15) : c === '=' ? C(GRAY, 12) : c === '#' ? C(RED, 13) : c === '%' ? C(YEL, 14) : C(BRICK, 12)],
  yoyo: () => [[' .-.', '(-@-)', " '-'", '  |', '  |'], (c, r) => r > 2 ? C(WHITE, 10) : c === '@' ? C(WHITE, 15) : C(RED, 14)],
  vape: () => [[' .-.', ' |' + (fx.vape > 0 ? '@' : 'o') + '|', ' |M|', ' |A|', ' |N|', ' |G|', ' |O|', " '-'"],
    (c, r) => c === '@' ? C(ORANGE, 10 + fx.vape * 1.7) : c === 'o' ? C(GRAY, 9) : /[A-Z]/.test(c) ? C(YEL, 14) : C(ORANGE, 12)],
  pipe: () => [['  ___', ' (___)', '  | |___', '  |_____|'], (c, r) => r < 2 ? C(BRICK, 12) : C(BRICK, 10)],
  harmonica: () => [[' __________', '[|:|:|:|:|:]', ' ----------'], (c, r) => c === ':' ? C(GRAY, 7) : C(GRAY, 14)],
  sharkplush: () => [['        /|', '  ___.-/ |__', '<(________o_>', "      \\/  \\/"], (c, r) => c === 'o' ? C(WHITE, 15) : r === 2 && c === '_' ? C(WHITE, 13) : C(GRAY, 13)],
  snowglobe: () => [['  .-----.', ' / . * . \\', '|  ><>  * |', ' \\ * . . /', "  '-----'", ' [=======]'], (c, r) => r === 5 ? C(BRICK, 13) : c === '>' || c === '<' ? C(ORANGE, 15) : c === '*' || c === '.' ? C(WHITE, 15) : C(CYAN, 12)],
  spraypaint: (it, f) => [['   _', '  [o]', ' .---.', ' |   |', ' |ZAP|', ' |   |', " '---'"], (c, r) => r < 2 ? C(GRAY, 13) : c === 'Z' || c === 'A' || c === 'P' ? C(WHITE, 15) : C([MAG, CYAN, GREEN, ORANGE][it.uses & 3], 13)],
  plushcat: () => [['  /\_/\ ', ' ( o.o )/', '  > ^ <', ' (_____)'], (c, r) => c === 'o' ? C(GREEN, 15) : r === 1 && c === '/' && r ? C(RED, 14) : C(WHITE, 14)],
  plushbear: () => [[' (\_/)', ' (o o)', '/(   )\\', ' (___)'], (c, r) => c === 'o' ? C(GRAY, 4) : C(BRICK, 13)],
  yakitori: (it, f) => [bitten(['  @@@@@@=', '  @@@@@@==', '  @@@@@@=', '        \\', '         \\'], f), (c, r) => c === '@' ? C(BRICK, 13) : C(WARM, 12)],
  takoyaki: (it, f) => [bitten(['  ~ ~ ~ ~', ' (@)(@)(@)', ' (@)(@)(@)', " '-------'"], f, 'top'), (c, r) => c === '~' ? C(WHITE, 13) : c === '@' ? C(BRICK, 13) : c === '(' || c === ')' ? C(ORANGE, 13) : C(WARM, 12)],
  onigiri: (it, f) => [bitten(['    /\\', '   /  \\', '  / :: \\', ' /######\\'], f, 'top'), (c, r) => c === '#' ? C(GREEN, 6) : c === ':' ? C(RED, 12) : C(WHITE, 15)],
  bento: (it, f) => [bitten([' .--------.', ' |@@|oo|~~|', ' |@@|oo|~~|', " '--------'"], f, 'top'), (c, r) => c === '@' ? C(WHITE, 15) : c === 'o' ? C(RED, 13) : c === '~' ? C(GREEN, 13) : C(BRICK, 13)],
  sake: (it, f) => [bitten(['   _', '  | |', ' /   \\', '|~~~~~|', '|_____|'], 0.45 + f * 0.55), (c, r) => c === '~' ? C(WHITE, 12) : C(WHITE, 15)],
  melonsoda: (it, f) => [filled(['   @  /', ' .---/-.', ' |    |', ' |    |', ' |    |', "  '--'"], [[2, 2, 5], [3, 2, 5], [4, 2, 5]], f, ':', '~'), (c, r) => c === '@' ? C(RED, 15) : c === ':' || c === '~' ? C(GREEN, 14) : C(WHITE, 12)],
  jadebangle: () => [['  .-~~-.', ' / .--. \\', '| |    | |', ' \\ `--` /', "  `-~~-'"], (c, r) => C(GREEN, 13)],
  jadedragon: () => [['   __/\\_', '  (@  ~~>', '  /|  \\', ' ~~\\__/~', ' [=====]'], (c, r) => c === '@' ? C(RED, 15) : r === 4 ? C(BRICK, 12) : C(GREEN, 13)],
  duck: () => [['    __', '  <(o )___', '   ( ._> /', "    `---'"], (c, r) => c === '>' ? C(ORANGE, 15) : c === 'o' ? C(WHITE, 15) : C(YEL, 15)],
  sparklers: () => [['  |', '  |', '  |', '  |', '  |'], (c, r) => C(GRAY, 12)],
  umbrella: () => [['     .', '    /|\\', '   / | \\', '  |  |  |', '  |==|==|', '  |  |  |', '   \\ | /', '    \\|/', '     |', '     |'],
    (c, r) => c === '=' ? C(WHITE, 14) : c === '|' && r > 7 ? C(GRAY, 12) : c === '.' ? C(GRAY, 14) : C(BLUE, 13)],
};
const heldArt = it => (HAND[it.id] || HAND.book)(it, usesLeft(it));
let smokePuffs = []; // [x, y, life, drift] in screen px
const putCell = (r, c, ch, col) => { if (r < 0 || r >= rows || c < 0 || c >= cols || ch === ' ') return; const i = r * cols + c; set(i, ch, col); FOGS[i] = FOGB[i] = 0; };
function putArt(art, r0, c0, col) { art.forEach((l, r) => [...l].forEach((ch, k) => putCell(r0 + r, c0 + k, ch, col(ch, r)))); }
function drawHeld(dt) {
  if (!(mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat')) return;
  if (fx.skating && mode === 'walk') drawBoard3D(); // the board under your feet
}

// ---- drawn big over the finished frame, in characters with a dark outline instead of a background
function artText(lines, x, y, size, colFn) {
  const w = g.measureText('M').width;
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, size * 0.14); g.strokeStyle = 'rgba(0,0,0,0.8)';
  lines.forEach((l, r) => { for (let k = 0; k < l.length; k++) if (l[k] !== ' ') g.strokeText(l[k], x + k * w, y + r * size); });
  lines.forEach((l, r) => { for (let k = 0; k < l.length; k++) if (l[k] !== ' ') { g.fillStyle = PAL[colFn(l[k], r, k)]; g.fillText(l[k], x + k * w, y + r * size); } });
  return w;
}
// the hand: a fist seen side-on, four fingers curled round the bottom of what it holds (a band each, knuckles to
// the left), the arm running off to the right-hand edge of the screen. HAND_GRIP = the column under the item's middle.
let HAND_ART = [
  '  _________',
  " (_________  '---",
  '(__________',
  '(__________',
  ' (____________.---'];
const HAND_GRIP = 6;
function drawHand(cx, top, size) {
  g.font = size + 'px monospace';
  const w = g.measureText('M').width, x0 = cx - (HAND_GRIP + 0.5) * w;
  const reach = Math.ceil((cv.width - x0) / w) + 1; // the arm carries on off the edge of the screen
  const art = HAND_ART.map(l => l.endsWith('-') ? l.padEnd(reach, '-') : l);
  artText(art, x0, top, size, c => c === '-' || c === "'" || c === '.' ? C(SKIN, 11) : C(SKIN, 13));
}
// a run of characters along a straight line on screen (a string, a shaft), each one picked to follow its slope
function charLine(x0, y0, x1, y1, w, size, col) {
  const dxs = (x1 - x0) / w, dys = (y1 - y0) / size, n = Math.ceil(Math.hypot(dxs, dys));
  const ch = Math.abs(dys) > Math.abs(dxs) * 2 ? '|' : Math.abs(dxs) > Math.abs(dys) * 2 ? '-' : dxs * dys < 0 ? '/' : '\\';
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, size * 0.14); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.fillStyle = col;
  for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n - w / 2, y = y0 + (y1 - y0) * k / n - size / 2; g.strokeText(ch, x, y); g.fillText(ch, x, y); }
}
let handDrawn = null; // what the hand held in the last frame drawn ({ id, t }), or null: for the tests
function drawHeldBig() {
  handDrawn = null;
  const onFoot = mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat';
  if (onFoot && fx.smoke > 0) drawCigarette();
  drawVapeCloud();
  const it = heldItem();
  if (!it || !onFoot || fx.skating && it.id === 'skateboard') return;
  const moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD, u = Math.max(14, cv.height / 36); // scaled to the screen, not the detail setting
  const isz = Math.round(u * 1.5), hsz = Math.round(u * 1.15);
  const bob = moving ? Math.sin(T * (fx.skating ? 4 : 9)) * u * 0.35 : Math.sin(T * 1.5) * u * 0.08;
  const lift = it.id === 'yoyo' ? Math.min(1, 0.55 + yoyo.len * 3) : 0; // (holding a yo-yo your hand's up, so it hangs below; higher still to work it)
  const cx = Math.round(cv.width * (0.84 - lift * 0.14)), hy = Math.round(cv.height - 5.6 * hsz + bob - lift * cv.height * 0.34); // the top of the fist: all of it on screen, a short arm to the edge
  const grip = hy + 1.1 * hsz; // where the fingers wrap round
  if (drawHeldDense(it, cx, hy, hsz, grip)); // (the dense-art trial: the item drawn finer, the same hand)
  else if (it.id === 'umbrella' && rain > 0.2 && mode !== 'room') drawCanopy(cx, grip, isz, bob);
  else {
    const [art, col] = heldArt(it);
    g.font = isz + 'px monospace';
    const w = g.measureText('M').width, artW = Math.max(...art.map(l => l.length)), top = grip + 0.5 * isz - art.length * isz;
    if (it.id !== 'yoyo') {
      g.save(); g.beginPath(); g.rect(0, 0, cv.width, hy + 0.75 * hsz); g.clip(); // the fingers hide its bottom
      artText(art, cx - artW * w / 2, top, isz, col); g.restore();
    }
    if (it.id === 'sparklers' && fx.spark > 0) drawSparks(cx, top - isz * 0.4, isz);
  }
  drawHand(cx, hy, hsz); handDrawn = { id: it.id, t: T };
  if (it.id === 'yoyo') drawYoyo(cx - hsz * 0.2, hy + HAND_ART.length * hsz); // (in your hand or out on its string, it hangs from under your fist)
  g.font = FS + 'px monospace';
}
// the umbrella open over you, seen from underneath: panels of fabric between ribs fanning out from the hub (just off
// the top of the screen) to a scalloped rim that hangs lowest straight ahead, drips falling off the tips, and the
// shaft running from your fist up to the hub. All characters.
function drawCanopy(cx, grip, size, bob) {
  const W = cv.width, H = cv.height, u = Math.max(14, H / 36), s = Math.round(u * 0.72); // (the world's own character size, like the items)
  g.font = s + 'px monospace';
  const w = g.measureText('M').width, ribs = 9, hubX = W * 0.56, off = bob * 0.4;
  charLine(cx, grip, hubX, -s, w, s, PAL[C(GRAY, 13)]); // the shaft
  for (let c = 0; c * w < W + w; c++) {
    const x = c * w, t = (x - W / 2) / (W * 0.62), seg = (t + 1) / 2 * ribs, k = Math.floor(seg), m = Math.abs(fract(seg) - 0.5);
    const rim = H * (0.34 - t * t * 0.32) - (0.5 - m) * s * 1.4 + off; // scalloped: rises between the ribs
    const rib = m > 0.45, ribCh = Math.abs(t) < 0.08 ? '|' : t < 0 ? '\\' : '/';
    for (let y = 0; y < rim - s; y += s) {
      if (rib) { g.fillStyle = PAL[C(BLUE, 1)]; g.fillRect(x, y, w + 0.5, s + 0.5); g.fillStyle = PAL[C(GRAY, 11)]; g.fillText(ribCh, x, y); continue; }
      // each panel bellies down between its ribs: lighter in the middle and toward the rim (the light comes through)
      const b = clamp((0.35 + 0.45 * Math.cos(m * Math.PI * 1.9)) * (0.55 + 0.45 * y / Math.max(rim, 1)) + (k & 1 ? 0.08 : 0), 0, 1);
      g.fillStyle = PAL[C(BLUE, 1 + b * 2.5)]; g.fillRect(x, y, w + 0.5, s + 0.5); // the fabric itself: nothing shows through it
      g.fillStyle = PAL[C(k & 1 ? BLUE : CYAN, 4 + b * 7)];
      g.fillText(dFill(b), x, y);
    }
    g.fillStyle = PAL[C(BLUE, 12)]; g.fillText(rib ? 'V' : m < 0.2 ? '_' : '-', x, rim - s); // the rim
    if (rib && fract(T * 1.1 + c * 0.37) < 0.6) { g.fillStyle = PAL[C(CYAN, 12)]; g.fillText(fract(T * 1.1 + c * 0.37) < 0.08 ? 'o' : '|', x, rim + fract(T * 1.1 + c * 0.37) * H * 0.4); } // drips gathering at the tips and falling
  }
}
// a cigarette between your lips: filter, paper burning down as it's smoked (fx.smoke counts down), the ember glowing
// brighter on a drag, smoke curling off it
function drawCigarette() {
  const u = Math.max(14, cv.height / 36), s = Math.round(u * 1.6);
  g.font = s + 'px monospace';
  const w = g.measureText('M').width, len = 1 + Math.round(6 * fx.smoke / 45);
  const x0 = cv.width * 0.5 - w, y0 = cv.height - s * 0.9, dx = w * 0.95, dy = -s * 0.32;
  const chars = fx.pipe ? ['=', '=', '=', '=', 'U', '*'] : ['#', '#', ...Array(len).fill('='), '*']; // a pipe: the stem, and the bowl with its glow
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, s * 0.14); g.strokeStyle = 'rgba(0,0,0,0.8)';
  chars.forEach((ch, k) => {
    const x = x0 + k * dx, y = y0 + k * dy, ember = k === chars.length - 1;
    g.fillStyle = PAL[ember ? C(cigTip > 0.3 ? YEL : ORANGE, fract(T * 3) < 0.5 ? 12 + cigTip * 3 : 10 + cigTip * 5) : fx.pipe ? C(BRICK, 12) : k < 2 ? C(ORANGE, 12) : C(WHITE, 15)];
    const yy = fx.pipe && ember ? y + s * 0.55 : y; // (the pipe's glow sits in the bowl)
    g.strokeText(ch, x, yy); g.fillText(ch, x, yy);
  });
  // the smoke: small wisps at the world's own character size, rising fast and swaying, '~' fading to '.'; a drag
  // puffs out a lot more
  const tx = x0 + (chars.length - 1) * dx + w * 0.3, ty = y0 + (chars.length - 1) * dy - s * 0.3, dt = Math.min(0.05, T - (drawCigarette.t ?? T));
  drawCigarette.t = T;
  g.font = FS + 'px monospace';
  if (Math.random() < dt * (1.5 + cigTip * 25)) smokePuffs.push([tx, ty, 1]);
  smokePuffs = smokePuffs.filter(p => (p[2] -= dt * 0.35) > 0);
  for (const p of smokePuffs) {
    p[1] -= dt * 4 * FS; p[0] += Math.sin(T * 3 + p[1] / FS) * dt * 3 * cw;
    const x = Math.round(p[0] / cw) * cw, y = Math.round(p[1] / FS) * FS; // on the grid, each wisp in its own black cell (the one exception to no backgrounds: it looks right)
    g.fillStyle = '#000'; g.fillRect(x, y, cw, FS);
    g.fillStyle = PAL[C(GRAY, 4 + p[2] * 8)]; g.fillText(p[2] > 0.6 ? '~' : '.', x, y);
  }
}
// the vape: a message while you hold it in, then on letting go a fat mango cloud, every wisp in its own coloured
// cell, rolling out from your mouth, spreading and thinning
let cloudPuffs = [];
function drawVapeCloud() {
  const dt = Math.min(0.05, T - (drawVapeCloud.t ?? T)); drawVapeCloud.t = T;
  if (fx.vape > 0) msgText = 'Holding it in... ' + '#'.repeat(Math.ceil(fx.vape * 4)), msgT = 0.3;
  if (fx.cloud > 0) { // just let it out
    const n = Math.round(20 + fx.cloud * 70), big = fx.cloud;
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = (6 + Math.random() * 16) * (0.5 + big * 0.5);
      cloudPuffs.push([cv.width / 2 + (Math.random() - 0.5) * cw * 6, cv.height - FS * 2, Math.cos(ang) * sp * cw, Math.sin(ang) * sp * FS * 0.8, 1 + big * 0.5]);
    }
    say(fx.cloud > 2.5 ? 'You blow out an enormous cloud of mango.' : fx.cloud > 1.2 ? 'A fat cloud of mango vapour rolls out.' : 'A little puff of mango.', 2.5);
    hazeExhale(fx.cloud, 'vape'); // (and it hangs in the air)
    fx.cloud = 0; if (actx) sfxUse('drag');
  }
  if (!cloudPuffs.length) return;
  g.font = FS + 'px monospace';
  cloudPuffs = cloudPuffs.filter(p => (p[4] -= dt * 0.75) > 0); // (gone in a couple of seconds: then it's the cloud out in the world you see)
  for (const p of cloudPuffs) {
    p[0] += p[2] * dt; p[1] += p[3] * dt; p[2] *= 1 - dt * 0.8; p[3] = p[3] * (1 - dt * 0.8) - FS * dt * 0.6; // slowing, drifting up
    const x = Math.round(p[0] / cw) * cw, y = Math.round(p[1] / FS) * FS, f = Math.min(1, p[4]);
    g.fillStyle = PAL[C(f > 0.6 ? ORANGE : WARM, 4 + f * 5)]; g.fillRect(x, y, cw, FS);
    g.fillStyle = PAL[C(f > 0.5 ? YEL : WHITE, 6 + f * 8)]; g.fillText(f > 0.7 ? '@' : f > 0.4 ? '%' : '~', x, y);
  }
}
// the yo-yo out on its string (see yoyo in goods.js), at the world's own character size: hanging from your hand,
// swinging as you swing it, rolling along the pavement when it reaches it; spinning the whole time, smeared when quick
function yoyoPos(x, y, ang, len) {
  const L = cv.height * 0.36 * len, ground = cv.height * 0.95;
  let px_ = x + Math.sin(ang) * L, py_ = y + Math.cos(ang) * L;
  const rolling = py_ > ground;
  if (rolling) { px_ = x + Math.sin(ang) * L * 1.15; py_ = ground; } // on the ground: it runs on along it (walk the dog)
  return { x: px_, y: py_, rolling };
}
function drawYoyo(x, y) {
  const u = Math.max(14, cv.height / 36), s = Math.round(u * 0.72);
  g.font = s + 'px monospace';
  const hang = 5 * s / (cv.height * 0.36); // (enough string to hang it clear of your hand)
  const idle = !yoyo.out && yoyo.len < hang, len = Math.max(yoyo.len, hang), ang = idle ? Math.sin(T * 1.3) * 0.07 : yoyo.ang; // (just held: dangling on a short string, swaying a little)
  const w = g.measureText('M').width, p = yoyoPos(x, y, ang, len), str = PAL[C(WHITE, 11)];
  charLine(x, y, p.x, p.y, w, s, str);
  if (Math.abs(yoyo.angV) > 3) for (const k of [1, 2]) { const r = yoyoPos(x, y, ang - yoyo.angV * 0.02 * k, len); g.fillStyle = PAL[C(RED, 8 - k * 2)]; g.fillText('o', r.x - w / 2, r.y - s / 2); } // a smear behind it
  const spin = idle ? 0 : yoyo.spin * (p.rolling ? 1.6 : 1); // (still, in your hand)
  const [art, col] = sculpt(11, 7, (cx, cy) => { // the yo-yo face on: a hub, spokes going round
    const r = Math.hypot(cx, cy * 1.1) * 2.5 / 3.2;
    if (r > 2.5) return null;
    if (r < 0.6) return ['@', C(WHITE, 15)];
    const an = Math.atan2(cy, cx) + spin, spoke = Math.cos(an * 3) > 0.55;
    return r > 2.1 ? ['o', C(RED, 11)] : [spoke ? '#' : dFill(dSphere(cx, cy * 1.1, 2.5)), spoke ? C(RED, 6) : C(RED, 7 + dSphere(cx, cy * 1.1, 2.5) * 8)];
  });
  artText(art, p.x - 5.5 * w, p.y - 3.5 * s, s, col);
}
// a lit sparkler: a fizzing ball at the tip, sparks spitting out every which way (fx.spark counts down)
function drawSparks(x, y, size) {
  g.font = size + 'px monospace';
  const w = g.measureText('M').width;
  for (let k = 0; k < 16; k++) {
    const a_ = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 2.6;
    g.fillStyle = PAL[C(Math.random() < 0.5 ? YEL : WHITE, 9 + Math.random() * 6)];
    g.fillText(r < 1.4 ? '*' : Math.random() < 0.5 ? '+' : '.', x - w / 2 + Math.cos(a_) * r * w * 1.6, y + Math.sin(a_) * r * size * 0.9);
  }
  g.fillStyle = PAL[C(WHITE, 15)]; g.fillText('@', x - w / 2, y);
}

// ---- putting things down and picking them up: where you are decides where it lies
// the place key for dropped things: '' outdoors (the street or a roof, told apart by height), the room's own key
// indoors, null where you can't (a moving train, the el)
const placeKey = () => mode === 'walk' || mode === 'roof' ? '' : mode === 'room' && room.kind !== 'train'
  ? 'room:' + (room.cell ? room.cell.join(',') : room.kind + ':' + (room.st ?? room.word ?? '')) : null;
function dropHere() {
  const at = placeKey();
  if (!heldItem()) return;
  if (at === null) return say('Not up here.');
  const reach = mode === 'room' ? 0.7 : 0.09; // a step in front of you (rooms are in metres, the street in 10m cells)
  const x = mode === 'room' ? px + Math.cos(a) * reach : mod(px + Math.cos(a) * reach, N), y = mode === 'room' ? py + Math.sin(a) * reach : mod(py + Math.sin(a) * reach, N);
  say(`You put the ${dropHeldAt(x, y, at, mode === 'roof' ? roofH : 0)} down.`);
}
const droppedHere = () => { const at = placeKey(); return at === null ? null : droppedNear(px, py, at, mode === 'room' ? 1.1 : 0.2, mode === 'roof' ? roofH : 0); };
// lying on the ground: its own in-hand picture, shrunk to life size (s = world units per character: cells or metres)
function drawDropped(d, vx, vy, s) {
  const [lines, col] = heldArt(d), art = pad(lines.filter(l => l.length)), W = art[0].length;
  drawArt(vx, vy, d.at ? 0 : d.z || 0, W * s * 0.5, art.length * s, art, (c, row, L) => { const k = col(c, row); return C(k >> 4, (k & 15) * clamp(L / 11, 0.3, 1)); });
}

// ---- the hotbar and the effects you're under, bottom left (in rows, upwards, if they don't fit across; on a phone,
// left of the buttons)
const hotbarUp = () => !(mode === 'drive' || mode === 'taxi' || !inv.length && !fx.caffeine && !fx.booze && !fx.fresh);
function hotbar() {
  if (!hotbarUp()) return;
  const maxX = cv.width - 6 - (TOUCH ? TOUCH_PAD_W : 0);
  let x = 6, y = cv.height - FS * 2 - 10;
  inv.forEach((it, k) => {
    const s = `${k + 1} ${ITEMS[it.id].name}${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? ` x${it.uses}` : ''}`, w = g.measureText(s).width + 12;
    if (x > 6 && x + w > maxX) { x = 6; y -= FS + 12; }
    g.fillStyle = k === held ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.6)'; g.fillRect(x, y, w, FS + 8);
    g.fillStyle = k === held ? '#fff' : 'rgba(255,255,255,0.5)'; g.fillText(s, x + 6, y + 4);
    x += w + 4;
  });
  const tags = [tickets > 0 && `${tickets} tickets`, fx.caffeine > 0 && 'caffeinated', fx.booze > 0.5 ? 'drunk' : fx.booze > 0.15 && 'tipsy', fx.skating && 'skating', fx.fresh > 0 && 'fresh clothes', fx.boombox && `playing: ${SONG_NAMES[fx.song] || 'music'}${heldItem() && heldItem().id === 'boombox' ? keyless(' (B: next)') : ''}`].filter(Boolean);
  if (tags.length) { const s = tags.join('  '); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(6, y - FS - 10, g.measureText(s).width + 12, FS + 6); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(s, 12, y - FS - 7); }
}

// ---- shop menu and inventory: small panels over a frozen game, keyboard or mouse
let shopEl = null, invEl = null, shopCtx = null;
const panel = id => menuEl(id, 400, '<div class="panel"></div>');
function showPanel(el, html) {
  el.querySelector('.panel').innerHTML = html; el.style.display = 'flex'; paused = true;
  for (const k in K) K[k] = 0;
  if (document.pointerLockElement) document.exitPointerLock();
}
function hidePanel(el) { if (el && el.style.display !== 'none') { el.style.display = 'none'; paused = false; } }
const panelOpen = () => [shopEl, invEl, storeEl].some(el => el && el.style.display === 'flex');
// title, item ids, and the cart if it's a street vendor (for the fetch favour)
function openShop(title, stock, vendor = null) {
  shopEl = shopEl || panel('shop');
  shopCtx = { title, stock, vendor };
  const rows_ = stock.map((id, k) => { const it = ITEMS[id]; return `<button class="item" data-buy="${id}" ${money < it.price ? 'disabled' : ''}><span class="k">${k + 1}</span><span>${it.name}</span><span class="lead"></span><span class="v">${fmt$(it.price)}</span></button>`; }).join('');
  const rate = SELL_RATE[title], sells = rate ? inv.map((it, k) => { const p = sellPrice(it, rate);
    return `<button class="item" data-sell="${k}" ${p ? '' : 'disabled'}><span class="k">^${k + 1}</span><span>${ITEMS[it.id].name}</span><span class="lead"></span><span class="v">${p ? fmt$(p) : 'no'}</span></button>`; }).join('') || '<p class="sub" style="padding-left:18px">Nothing to sell.</p>' : '';
  const work = shiftHere();
  const workRow = work ? `<h2>work</h2><button class="item" data-work><span class="k">J</span><span>${{ serve: 'Wait tables for a shift', tapper: 'Tend bar for a shift' }[work] || 'Stock the shelves for a shift'}</span><span class="lead"></span><span class="v">paid</span></button>` : '';
  showPanel(shopEl, `<h1>${title[0] + title.slice(1).toLowerCase()}</h1><p class="sub">${fmt$(money)} on you &middot; carrying ${inv.length}/${INV_SIZE}</p>
    ${rate ? `<h2>buy</h2>${rows_}<h2>sell</h2>${sells}` : rows_}${workRow}<p class="hint">1-${stock.length} buy${rate ? ' &middot; shift+1-9 sell' : ''}${work ? ' &middot; J work' : ''} &middot; E / Esc close</p>`);
  shopEl.onclick = e => { const b = e.target.closest('[data-buy]'), v = e.target.closest('[data-sell]'); if (b) shopBuy(b.dataset.buy); else if (v) shopSell(+v.dataset.sell); else if (e.target.closest('[data-work]')) startShift(); };
}
function shopBuy(id) {
  const [ok, line] = buy(id);
  say(line, 3);
  if (ok && shopCtx.vendor && taskBuy(shopCtx.vendor)) say(`${line} That's the one they wanted.`, 4);
  openShop(shopCtx.title, shopCtx.stock, shopCtx.vendor); // refresh (money changed)
}
function shopSell(k) {
  say(sellSlot(k, SELL_RATE[shopCtx.title])[1], 3);
  openShop(shopCtx.title, shopCtx.stock, shopCtx.vendor);
}
const closeShop = () => hidePanel(shopEl);
// work going here? (a room's counter, not a street cart; one shift a visit)
const shiftHere = () => mode === 'room' && !shopCtx.vendor && !room.worked && SHIFT_FOR[room.kind] || null;
function startShift() {
  const id = shiftHere();
  if (!id) return;
  room.worked = true; closeShop(); startGame(id, 'shift', room.word);
}
function openInventory() {
  invEl = invEl || panel('inventory');
  const rows_ = inv.length ? inv.map((it, k) => `<button class="item" data-slot="${k}"${k === held ? ' style="color:#fff"' : ''}><span class="k">${k + 1}</span><span>${ITEMS[it.id].name}${k === held ? ' &middot; in hand' : ''}</span><span class="lead"></span><span class="v">${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? 'x' + it.uses : ''}</span></button>`).join('') : '<p class="sub" style="padding-left:18px">Nothing. Shops sell things.</p>';
  showPanel(invEl, `<h1>Carrying</h1><p class="sub">${fmt$(money)} on you &middot; ${inv.length}/${INV_SIZE}</p>${rows_}<p class="hint">1-${INV_SIZE} hold &middot; Q use &middot; X drop &middot; I / Esc close</p>`);
  invEl.onclick = e => { const b = e.target.closest('[data-slot]'); if (b) { holdSlot(+b.dataset.slot); openInventory(); } };
}
const closeInventory = () => hidePanel(invEl);
// your storage unit: click a carried thing to put it in, a stored thing to take it out
let storeEl = null;
let storeCtx = [stored, 'your unit', 'Storage unit', 'The same unit at every storage place in town'];
function openStorage(list = storeCtx[0], where = storeCtx[1], title = storeCtx[2], sub = storeCtx[3]) {
  storeCtx = [list, where, title, sub];
  storeEl = storeEl || panel('storage');
  const item = it => `${ITEMS[it.id].name}${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? ` x${it.uses}` : ''}`;
  const carried = inv.length ? inv.map((it, k) => `<button class="item" data-store="${k}"><span class="k">${k + 1}</span><span>${item(it)}</span><span class="lead"></span><span class="v">store</span></button>`).join('') : '<p class="sub" style="padding-left:18px">Nothing in your hands.</p>';
  const unit = list.length ? list.map((it, k) => `<button class="item" data-take="${k}"><span class="k">${k < 9 ? '^' + (k + 1) : ''}</span><span>${item(it)}</span><span class="lead"></span><span class="v">take</span></button>`).join('') : '<p class="sub" style="padding-left:18px">Empty.</p>';
  showPanel(storeEl, `<h1>${title}</h1><p class="sub">${sub}</p>
    <h2>carrying ${inv.length}/${INV_SIZE}</h2>${carried}
    <h2>in ${where.replace('your ', 'the ')} ${list.length}/${STORE_SIZE}</h2>${unit}
    <p class="hint">1-${INV_SIZE} store &middot; shift+1-9 take &middot; E / Esc close</p>`);
  storeEl.onclick = e => {
    const s = e.target.closest('[data-store]'), t = e.target.closest('[data-take]');
    if (s) say(storeSlot(+s.dataset.store, list, where)[1], 2); else if (t) say(retrieveSlot(+t.dataset.take, list, where)[1], 2); else return;
    openStorage();
  };
}
// keys while a panel is up; true if handled
function panelKey(e) {
  if (!panelOpen()) return false;
  if (storeEl && storeEl.style.display === 'flex') {
    const n = /^Digit([1-9])$/.exec(e.code);
    if (e.code === 'Escape' || e.code === 'KeyE') hidePanel(storeEl);
    else if (n) { say((e.shiftKey ? retrieveSlot(n[1] - 1, storeCtx[0], storeCtx[1]) : storeSlot(n[1] - 1, storeCtx[0], storeCtx[1]))[1], 2); openStorage(); }
    return true;
  }
  const shop = shopEl && shopEl.style.display === 'flex', n = /^Digit([1-9])$/.exec(e.code);
  if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI' && !shop) { shop ? closeShop() : closeInventory(); return true; }
  if (shop && e.code === 'KeyJ' && shiftHere()) { startShift(); return true; }
  if (shop && n && e.shiftKey && SELL_RATE[shopCtx.title]) { shopSell(n[1] - 1); return true; }
  if (shop && n && shopCtx.stock[n[1] - 1]) { shopBuy(shopCtx.stock[n[1] - 1]); return true; }
  if (!shop && n && inv[n[1] - 1]) { holdSlot(n[1] - 1); openInventory(); return true; }
  if (!shop && e.code === 'KeyQ') { closeInventory(); useHeldItem(); return true; }
  if (!shop && e.code === 'KeyX') { dropHere(); openInventory(); return true; }
  return true; // swallow everything else
}

// ---- using things: the sounds that go with them
const HEADLINES = () => [...MARKET.news.slice(0, 2).map(n => n.line), `${pick(stations).name} station closed for repairs`, 'Mayor vows to fix the el (again)', 'Bridge tolls to rise',
  'Local cat elected to community board', `Rents soar in ${pick(['Chinatown', 'the Brownstones', 'Midtown'])}`, 'Ambulance response times improve',
  'Record crowds at the waterfront', 'Fog to roll in this week, say forecasters', ...EVENTS.map(e => e[4])];
function useHeldItem() {
  if (heldItem() && heldItem().id === 'spraypaint') return sprayTag();
  if (body.seat && body.seat.grass && heldItem() && ITEMS[heldItem().id].kind === 'food' && chance(0.5)) { // a picnic
    const name = ITEMS[heldItem().id].name, [, sound] = useHeld({ indoors: false, x: px, y: py, a, rain, person: null, headlines: HEADLINES(), water: false });
    say(rain > 0.3 ? `A soggy picnic. The ${name} is good anyway.` : pick([`A picnic on the grass. The ${name} tastes better out here.`, `You eat your ${name} on the lawn. A sparrow watches every bite.`, day > 0.3 ? `Sun on your back, ${name} in hand. Not a bad afternoon.` : `A picnic by moonlight. The ${name} and the crickets.`]), 3);
    if (actx && sound) sfxUse(sound);
    return;
  }
  const [line, sound] = useHeld({ indoors: mode === 'room', x: px, y: py, a, rain, person: nearPerson(), headlines: HEADLINES(),
    water: mode === 'walk' && (seaDist(px, py) < 1.2 || blockKind(Math.floor(px / 8), Math.floor(py / 8)) === 'park' && inPond(mod(px, 8), mod(py, 8), Math.floor(px / 8) & (NB - 1), Math.floor(py / 8) & (NB - 1), 0.4)) });
  if (line) say(line, 3);
  if (actx && sound) sfxUse(sound);
}
function sfxUse(s) {
  const at = actx.currentTime;
  if (s === 'bite') playClip('eat', 0.5);
  if (s === 'sip') playClip('drink', 0.6);
  if (s === 'light') playClip('cig-light', 0.45);
  if (s === 'drag') playClip(Math.random() < 0.5 ? 'cig-pull-1' : 'cig-pull-2', 0.5);
  if (s === 'kick') { tone(at, 110, 0.12, 0.2); burst(at, 0.05, [filt('bandpass', 900, 1)], 0.15); }
  if (s === 'page') burst(at, 0.15, [filt('highpass', 2500)], 0.05);
  if (s === 'board') { tone(at, 180, 0.08, 0.12); burst(at, 0.1, [filt('bandpass', 1200, 1)], 0.1); }
  if (s === 'click') tone(at, 1800, 0.03, 0.08, 'square');
  if (s === 'chime') sfxDoor();
  if (s === 'whirr') { burst(at, 0.5, [filt('bandpass', 700, 3)], 0.05); burst(at + 0.55, 0.4, [filt('bandpass', 900, 3)], 0.04); }
  if (s === 'squeak') { const o = actx.createOscillator(), gn = actx.createGain(); o.frequency.setValueAtTime(1300, at); o.frequency.exponentialRampToValueAtTime(2100, at + 0.12);
    gn.gain.setValueAtTime(0, at); gn.gain.linearRampToValueAtTime(0.06, at + 0.02); gn.gain.exponentialRampToValueAtTime(0.0005, at + 0.2); shot(o, gn, sfxBus); o.start(at); o.stop(at + 0.25); }
  if (s === 'harmonica') playClip('harmonica', 0.6);
}
// the ball, out in the world
function drawBall() {
  if (!ball) return;
  const [vx, vy] = R(ball.x, ball.y);
  drawArt(vx, vy, ball.z, 0.035, 0.035, ['O'], (c, row, L) => C(WHITE, Math.max(L, 6)));
}

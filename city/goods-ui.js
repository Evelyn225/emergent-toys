// ===== goods on screen: the shop menu, the inventory, the hotbar, and what's in your hand (or mouth, or underfoot)
// ---- in your hand: ASCII art at the bottom right, bobbing as you walk. No backgrounds: every character has a thin
// dark outline so it reads over anything, and the fingers hide the bottom of whatever you're holding. Things change
// as you use them: glasses empty, food gets bitten, a coffee stops steaming, the pack runs down.
// DROPPED_ART[id] = (it, f) => [lines, colour(ch, row, col)]; small pictures for items on the ground
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
// car keys: a fob with its buttons, the ring, the key hanging off it
const KEYS_ART = [['  .---.', ' | (o) |', ' | [=] |', "  '-.-'", '   (O)', '    |', '    |=', '    |=', '    V'],
  (c, r) => c === 'o' ? C(RED, 14) : c === '=' && r < 3 ? C(GRAY, 12) : r < 4 ? C(GRAY, 5 + (c === '|' || c === '.' || c === "'" || c === '-' ? 6 : 0)) : C(YEL, 13)];
function droppedCan(word, col, ink, f) {
  const crushed = f < .5;
  const art = [' _______', '(_______)', '|       |', `| ${word.padEnd(5)} |`, '|  ~~~  |', '(_______)'];
  if (f < 1) art[2] = '|  /    |';
  if (crushed) { art.splice(2, 1); art[2] = art[2].replace(/\|/g, '/'); }
  return [art, (ch, r) => r === 0 || r === art.length - 1 ? C(GRAY, 12) : /[A-Z~]/.test(ch) ? C(ink, 15) : C(col, 13)];
}
const DROPPED_ART = {
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
  hotelmasterpiece: () => [[' .------.', ' | /\  /|', ' |(o )  |', ' | /\\~ |', ' |______|'], (c, r) => c === '.' || c === '-' || c === '|' || c === '_' ? C(YEL, 13) : r === 2 ? C(BRICK, 14) : C(GREEN, 12)],
  hotelharbour: () => [[' .------.', ' | /| o |', ' |/_|___|', ' |~~~~~~|', ' |______|'], (c, r) => '.-|_'.includes(c) ? C(YEL, 13) : c === 'o' ? C(ORANGE, 14) : C(CYAN, 12)],
  hotelstilllife: () => [[' .------.', ' | i  Y |', ' |[#] | |', ' | o () |', ' |______|'], (c, r) => '.-|_'.includes(c) ? C(YEL, 13) : c === 'o' || c === '(' || c === ')' ? C(GREEN, 12) : C(BRICK, 13)],
  fortunecookie: (it, f) => [['   .---.', "  /  .-'\\", ' (  (  ~~~', "  `--`"], (c, r) => c === '~' ? C(WHITE, 15) : C(YEL, 13)],
  tigerbalm: it => [['  ._____.', ' |  /\\  |', ' | (oo) |', " |TIGER |", " `-----'"], (c, r) => r === 0 ? C(GRAY, 12) : c === 'o' || c === '/' || c === '\\' || c === '(' || c === ')' ? C(ORANGE, 15) : /[A-Z]/.test(c) ? C(YEL, 14) : C(RED, 12)],
  lantern: () => [['    |', '  .-=-.', ' ( ||| )', ' ( ||| )', "  `-=-'", '    ~'], (c, r) => r === 0 ? C(GRAY, 10) : c === '=' || c === '~' ? C(YEL, 15) : c === '|' && r > 1 && r < 4 ? C(YEL, 14) : C(RED, 15)],
  firecrackers: it => [['   *', '   \\', ...Array.from({ length: Math.max(1, it.uses) * 2 }, (_, k) => k & 1 ? '  ==]' : ' [==  '), '   |'], (c, r) => c === '*' ? C(YEL, 15) : c === '\\' || c === '|' ? C(GRAY, 11) : C(RED, 14)],
  mysterybox: () => [['  _\\ /_', ' |  X  |', ' |  ?  |', ' |_____|'], (c, r) => c === '?' ? C(WHITE, 15) : c === 'X' || c === '\\' || c === '/' ? C(RED, 14) : C(BRICK, 13)],
  pocketwatch: () => { const k = Math.floor(T * (hurrying() ? 12 : 1)) & 3; // the hands, round and round
    return [['    o', '  .-^-.', ' / 12  \\', `|9  ${'|/-\\'[k]}  3|`, ' \\  6  /', "  `---'"], (c, r) => r === 0 ? C(GRAY, 12) : r === 3 && '|/-\\'.includes(c) ? C(GRAY, 3) : /[0-9]/.test(c) ? C(BRICK, 9) : r === 1 || c === '/' || c === '\\' || c === '`' || c === "'" || c === '|' ? C(YEL, 13) : C(WARM, 14)]; },
  cityglobe: () => [['  .-----.', ' / * # * \\', '| #|#|#|# |', ' \\ ##### /', "  '-----'", ' [GLYPHPT]'], (c, r) => r === 5 ? (c === '[' || c === ']' ? C(BRICK, 13) : C(YEL, 12)) : c === '*' ? C(WHITE, 15) : c === '#' ? C(YEL, 13) : C(CYAN, 12)],
  // drinks: a paper cup steams less as it goes; glasses show their level
  coffee: (it, f) => [[f > 0.5 ? '  ( ( (' : '', f > 0.25 ? '   ) ) )' : '', ' ._______.', ' [_______]', '  |     |', '  |CAFE |', '  |     |', '   \\___/'],
    (c, r) => r < 2 ? C(WHITE, 8) : 'CAFE'.includes(c) ? C(GREEN, 13) : r < 4 ? C(GRAY, 12) : C(WHITE, 14)],
  latte: (it, f) => [filled([' .________.', ' |        |__', ' |        |  )', ' |        |  )', ' |        |_/', " '--------'"], [[1, 2, 9], [2, 2, 9], [3, 2, 9], [4, 2, 9]], f, ':', '~'),
    (c, r) => c === ':' ? C(BRICK, 13) : c === '~' ? C(WHITE, 15) : C(WHITE, 12)],
  tea: (it, f) => [filled(['   ) )', ' ._______.', ' |       |\\', ' |       | )', '  \\_____/_/', ' ========='], [[2, 2, 8], [3, 2, 8]], f, ':', '~'),
    (c, r) => r === 0 ? C(WHITE, 7) : c === ':' || c === '~' ? C(ORANGE, 12) : C(WHITE, 13)],
  soda: (it, f) => droppedCan('COLA', RED, WHITE, f),
  energy: (it, f) => droppedCan('ZAP', GREEN, YEL, f),
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
  petcat: () => [['   .----.', '  / .--. \\', ' | (o.o)|', ' |  /\\  |', " '------'"], (c, r) => c === 'o' ? C(GREEN, 15) : c === '.' || c === '/' || c === '\\' ? C(GRAY, 13) : C(BRICK, 12)],
  petdog: () => [['   .----.', '  / .--. \\', ' | (o.o)|', ' |  /\\  |', " '------'"], (c, r) => c === 'o' ? C(BRICK, 15) : c === '.' || c === '/' || c === '\\' ? C(GRAY, 13) : C(BRICK, 12)],
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
  key_car_hatch: () => KEYS_ART, key_car_sedan: () => KEYS_ART, key_car_sports: () => KEYS_ART,
  umbrella: () => [['     .', '    /|\\', '   / | \\', '  |  |  |', '  |==|==|', '  |  |  |', '   \\ | /', '    \\|/', '     |', '     |'],
    (c, r) => c === '=' ? C(WHITE, 14) : c === '|' && r > 7 ? C(GRAY, 12) : c === '.' ? C(GRAY, 14) : C(BLUE, 13)],
};
const droppedArt = it => (DROPPED_ART[it.id] || DROPPED_ART.book)(it, usesLeft(it));
let smokePuffs = []; // [x, y, life, drift] in screen px
const putCell = (r, c, ch, col) => { if (r < 0 || r >= rows || c < 0 || c >= cols || ch === ' ') return; const i = r * cols + c; set(i, ch, col); FOGS[i] = FOGB[i] = 0; };
function putArt(art, r0, c0, col) { art.forEach((l, r) => [...l].forEach((ch, k) => putCell(r0 + r, c0 + k, ch, col(ch, r)))); }
function drawHeld(dt) {
  if (!(mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat')) return;
  if (fx.skating && mode === 'walk' && !skateCamOn()) drawBoard3D(); // the board under your feet (or, from behind you, it's in the world: skate.js)
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
const HAND_MASK_COLS = 18, handPixelCache = new Map();
function handGeometry(cx, size) {
  const font = g.font;
  g.font = size + 'px monospace';
  const w = g.measureText('M').width, x0 = cx - (HAND_GRIP + 0.5) * w;
  g.font = font;
  const transform = g.getTransform(), edgeX = (cv.width - transform.e) / Math.max(.2, transform.a);
  const reach = Math.max(HAND_MASK_COLS, Math.ceil((edgeX - x0) / w) + 1);
  return { w, x0, reach };
}
function handPixels(size, w) {
  const key = size + '|' + w;
  if (handPixelCache.has(key)) return handPixelCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(HAND_MASK_COLS * w); canvas.height = Math.ceil((HAND_ART.length + 1) * size);
  const ctx = canvas.getContext('2d');
  ctx.font = size + 'px monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
  HAND_ART.forEach((line, r) => {
    const text = line.endsWith('-') ? line.padEnd(HAND_MASK_COLS, '-') : line;
    for (let c = 0; c < text.length; c++) if (text[c] !== ' ') ctx.fillText(text[c], c * w, r * size);
  });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const upper = new Float32Array(canvas.width).fill(NaN), lower = new Float32Array(canvas.width).fill(NaN);
  let left = canvas.width, right = 0;
  for (let x = 0; x < canvas.width; x++) for (let y = 0; y < canvas.height; y++) {
    if (data[(y * canvas.width + x) * 4 + 3] < 64) continue;
    if (!Number.isFinite(upper[x])) upper[x] = y;
    lower[x] = y + 1; left = Math.min(left, x); right = Math.max(right, x);
  }
  // Join character spacing along the arm so item pixels cannot leak between adjacent dashes.
  for (let x = left; x <= right; x++) {
    if (Number.isFinite(upper[x])) continue;
    let next = x + 1;
    while (next <= right && !Number.isFinite(upper[next])) next++;
    const previous = x - 1;
    for (let c = x; c < next; c++) {
      const t = (c - previous) / (next - previous);
      upper[c] = upper[previous] + (upper[next] - upper[previous]) * t;
      lower[c] = lower[previous] + (lower[next] - lower[previous]) * t;
    }
    x = next - 1;
  }
  const pixels = { upper, lower, left, right };
  if (handPixelCache.size >= 6) handPixelCache.delete(handPixelCache.keys().next().value);
  handPixelCache.set(key, pixels);
  return pixels;
}
function drawBehindHand(cx, top, size, drawItem) {
  const { w, x0, reach } = handGeometry(cx, size), { upper, lower, left, right } = handPixels(size, w);
  const visible = new Path2D();
  visible.rect(-cv.width * 3, -cv.height * 3, cv.width * 6, cv.height * 6);
  visible.moveTo(x0 + left, top + upper[left]);
  for (let x = left + 1; x <= right; x++) if (upper[x] !== upper[x - 1]) {
    visible.lineTo(x0 + x, top + upper[x - 1]); visible.lineTo(x0 + x, top + upper[x]);
  }
  visible.lineTo(x0 + reach * w, top + upper[right]);
  visible.lineTo(x0 + reach * w, top + lower[right]);
  visible.lineTo(x0 + right + 1, top + lower[right]);
  for (let x = right - 1; x >= left; x--) if (lower[x] !== lower[x + 1]) {
    visible.lineTo(x0 + x + 1, top + lower[x + 1]); visible.lineTo(x0 + x + 1, top + lower[x]);
  }
  visible.lineTo(x0 + left, top + lower[left]); visible.closePath();
  g.save();
  try { g.clip(visible, 'evenodd'); drawItem(); } finally { g.restore(); }
  drawHand(cx, top, size);
}
function drawHand(cx, top, size) {
  const { x0, reach } = handGeometry(cx, size);
  g.font = size + 'px monospace';
  const art = HAND_ART.map(line => line.endsWith('-') ? line.padEnd(reach, '-') : line);
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
  const onFoot = mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat'||mode==='ferry'&&['food','drink'].includes(ITEMS[heldItem()?.id]?.kind);
  if (onFoot && fx.smoke > 0) drawCigarette();
  drawVapeCloud();
  const it = heldItem();
  const rodAfloat = it && ITEMS[it.id].rod && afloat() && !third; // (fishing from a boat: the rod, nothing else)
  if (!it || !(onFoot || rodAfloat) || fx.skating && (it.id === 'skateboard' || skateCamOn())) return;
  if (ITEMS[it.id].kind === 'gun') {
    drawRevolver(it); handDrawn = { id: it.id, t: T }; return;
  }
  if (heldIsRod(it)) {
    const G = rodGeom(); drawBehindHand(G.cx, G.hy, G.hsz, () => drawFishingRod(it));
  } else {
    const canopy = it.id === 'umbrella' && rain > .2 && mode !== 'room';
    const picture = it.id === 'yoyo' || canopy ? null : heldPicture(it), G = heldFrame(it, picture);
    if (canopy) drawBehindHand(G.cx, G.hy, G.hsz, () => drawCanopy(G.cx, G.hy + G.grip, Math.round(G.u * 1.5), 0));
    else {
      g.save(); g.translate(G.cx, G.hy); g.rotate(G.angle); g.scale(G.sx, G.sy);
      drawBehindHand(0, 0, G.hsz, () => { if (picture) drawHeldDense(it, 0, 0, G.hsz, picture, G.s); });
      g.restore();
    }
    if (it.id === 'yoyo') drawYoyo(G.cx - G.hsz * .2, G.hy + HAND_ART.length * G.hsz);
  }
  handDrawn = { id: it.id, t: T };
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
  const joint=fx.smokeKind==='joint';
  const w = g.measureText('M').width, len = 1 + Math.round(6 * fx.smoke / (joint?55:45));
  const x0 = cv.width * 0.5 - w, y0 = cv.height - s * 0.9, dx = w * 0.95, dy = -s * 0.32;
  const chars = fx.pipe ? ['=', '=', '=', '=', 'U', '*'] : [joint?'|':'#',joint?'=':'#', ...Array(len).fill('='), '*']; // a pipe: the stem, and the bowl with its glow
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, s * 0.14); g.strokeStyle = 'rgba(0,0,0,0.8)';
  chars.forEach((ch, k) => {
    const x = x0 + k * dx, y = y0 + k * dy, ember = k === chars.length - 1;
    let color=C(WHITE,15);
    if(ember)color=C(cigTip>.3?YEL:ORANGE,fract(T*3)<.5?12+cigTip*3:10+cigTip*5);
    else if(fx.pipe)color=C(BRICK,12);
    else if(joint)color=C(STONE,14);
    else if(k<2)color=C(ORANGE,12);
    g.fillStyle=PAL[color];
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
  if (rolling) { // walk the dog: keep the full sideways roll, easing into it as the string meets the pavement
    const contact = smooth(clamp((py_ - ground) / (cv.height * .025), 0, 1));
    px_ += Math.sin(ang) * L * .15 * contact; py_ = ground;
  }
  return { x: px_, y: py_, rolling };
}
function drawYoyoString(x, y, endX, endY, w, size, col) {
  const dx = (endX - x) / w, dy = (endY - y) / size, length = Math.hypot(dx, dy);
  if (!length) return;
  const slope = mod(Math.atan2(dy, dx), Math.PI) * 4 / Math.PI, index = Math.floor(slope), blend = smooth(fract(slope));
  const glyphs = ['-', '\\', '|', '/'];
  const layers = [[glyphs[index], 1 - blend], [glyphs[(index + 1) % 4], blend]];
  g.save(); g.lineJoin = 'round'; g.lineWidth = Math.max(2, size * .14); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.fillStyle = col;
  // Fixed spacing keeps existing characters from jumping when another character is needed at the end.
  for (let k = 0; k <= Math.ceil(length); k++) {
    const t = Math.min(k / length, 1), alpha = clamp(length - k + 1, 0, 1);
    const px_ = x + (endX - x) * t - w / 2, py_ = y + (endY - y) * t - size / 2;
    for (const [ch, weight] of layers) {
      if (weight < .01) continue;
      g.globalAlpha = alpha * weight; g.strokeText(ch, px_, py_); g.fillText(ch, px_, py_);
    }
  }
  g.restore();
}
function drawYoyo(x, y) {
  const u = Math.max(14, cv.height / 36), s = Math.round(u * 0.72);
  g.font = s + 'px monospace';
  const hang = 5 * s / (cv.height * 0.36); // (enough string to hang it clear of your hand)
  const len = Math.max(yoyo.len, hang), rest = Math.sin(T * 1.3) * .07;
  const extended = smooth(clamp(yoyo.len / hang, 0, 1)), ang = yoyo.ang + rest * (1 - extended);
  const w = g.measureText('M').width, p = yoyoPos(x, y, ang, len), str = PAL[C(WHITE, 11)];
  drawYoyoString(x, y, p.x, p.y, w, s, str);
  const trail = clamp((Math.abs(yoyo.angV) - 2) / 4, 0, 1);
  if (trail > 0) {
    g.save(); g.globalAlpha = trail;
    for (const k of [1, 2]) { const r = yoyoPos(x, y, ang - yoyo.angV * .02 * k, len); g.fillStyle = PAL[C(RED, 8 - k * 2)]; g.fillText('o', r.x - w / 2, r.y - s / 2); }
    g.restore();
  }
  const spin = yoyo.spin * .2; // slower visible spokes avoid strobing; contact and recall never reset their phase
  const [art, col] = sculpt(11, 7, (cx, cy) => { // the yo-yo face on: a hub, spokes going round
    const r = Math.hypot(cx, cy * 1.1) * 2.5 / 3.2;
    if (r > 2.5) return null;
    if (r < 0.6) return ['@', C(WHITE, 15)];
    const an = Math.atan2(cy, cx) + spin, spoke = .5 + .5 * Math.cos(an * 3), shade = Math.max(0, dSphere(cx, cy * 1.1, 2.5));
    return r > 2.1 ? ['o', C(RED, 11)] : [dFill(shade), C(RED, 7 + shade * 8 - spoke * 4)];
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
  if(mode==='room'&&homeRecord()&&isHomeDecor(heldItem())){const target=homeShelfAim()[0];if(target)return say(homeShelfStore(held,target)[1],3);}
  if (at === null) return say('Not up here.');
  const reach = mode === 'room' ? 0.7 : 0.09; // a step in front of you (rooms are in metres, the street in 10m cells)
  const x = mode === 'room' ? px + Math.cos(a) * reach : worldCoord(px + Math.cos(a) * reach), y = mode === 'room' ? py + Math.sin(a) * reach : worldCoord(py + Math.sin(a) * reach);
  let z = 0;
  if (mode === 'roof') z = roofH;
  else if (mode !== 'room') z = outdoorGroundHeight(x, y);
  say(`You put the ${dropHeldAt(x, y, at, z)} down.`);
}
const droppedHere = () => {
  const target=interactionFocus();if(target?.kind==='drop')return target.who;
  const at = placeKey();
  if (at === null) return null;
  let z = 0;
  if (mode === 'roof') z = roofH;
  else if (mode !== 'room') z = outdoorGroundHeight(px, py);
  const d=droppedNear(px,py,at,mode==='room'?1.1:.2,z);
  return d&&interactionClear(d.x,d.y,(d.displayZ??(d.at?0:d.z||0))+(d.at?.1:.01))?d:null;
};
// put down or on display: the held picture (the small one if it has none), cropped to what's drawn and painted solid at
// life size. ITEM_SIZE: its longer side in metres, by item, else by kind; fish go by their weight
const ITEM_SIZE = {
  apple: 0.08, luckycoin: 0.025, oldcoin: 0.03, wishcoins: 0.04, goldring: 0.025, pearl: 0.015, diamond: 0.05, redstring: 0.07, tigerbalm: 0.05,
  key_car_hatch: 0.08, key_car_sports: 0.08, pocketwatch: 0.06, compass: 0.07, divewatch: 0.05, pocketknife: 0.1, fortunecookie: 0.07,
  cigarettes: 0.09, vape: 0.1, yoyo: 0.06, duck: 0.1, cityglobe: 0.12, replicastar: 0.1, trolleywheel: 0.12, tincan: 0.1,
  book: 0.18, soggybook: 0.18, vhs: 0.19, postcard: 0.15, vinyl: 0.31, spraypaint: 0.2, mysterybox: 0.2, dinotoy: 0.2, goldfish: 0.22,
  lantern: 0.3, firecrackers: 0.25, orrery: 0.35, boombox: 0.45, movinglamp: 0.45, skateboard: 0.8, rod: 1.4, carbonrod: 1.4,
  oldboot: 0.3, seaweed: 0.35, plasticbag: 0.35, tyre: 0.6, trafficcone: 0.7, flipflop: 0.25, bottlemsg: 0.25,
  hotelmasterpiece: 0.6, hotelharbour: 0.6, hotelstilllife: 0.6,
};
const KIND_SIZE = { food: 0.13, drink: 0.14, ingredient: 0.13, junk: 0.3, toy: 0.15, keys: 0.08, smoke: 0.09, pet: 0.45 };
const itemSize = d => ITEM_SIZE[d.id] ?? (['fish', 'wish'].includes(ITEMS[d.id]?.kind) ? catchLength(d.kg) : KIND_SIZE[ITEMS[d.id]?.kind] ?? 0.15);
// long things put down lie flat: how much looking down at them shortens their height (a deck, a rod a finger thick,
// a fish on its side; crabs and squid stay on their legs)
const LYING = { skateboard: 0.45, rod: 0.2, carbonrod: 0.2 };
const lying = d => { const I = ITEMS[d.id]; return LYING[d.id] ?? (['fish', 'wish'].includes(I?.kind) && !I.crab && !I.squid ? 0.45 : 0); };
const droppedPictures = new Map(); // bounded short-lived pictures, including animated items
function droppedPicture(d) {
  const key = [d.id, d.uses, d.q, d.of, d.kg, Math.floor(T * 4)].join('|');
  let p = droppedPictures.get(key);
  if (p) return p;
  const dense = !!DENSE[d.id], [lines, col] = (DENSE[d.id] || droppedArt)(d, usesLeft(d));
  const rowsDrawn = lines.map((l, r) => r).filter(r => lines[r].trim()), r0 = rowsDrawn[0] ?? 0, r1 = rowsDrawn.at(-1) ?? 0;
  const firsts = lines.map(l => l.search(/\S/)).filter(k => k >= 0), c0 = firsts.length ? Math.min(...firsts) : 0, c1 = Math.max(...lines.map(l => l.trimEnd().length));
  const art = pad(lines.slice(r0, r1 + 1).map(l => l.slice(c0, c1))), aspect = dense ? D_ASPECT : 0.5;
  p = { art, col: (ch, r, k) => col(ch, r + r0, k + c0), w: art[0].length * aspect, h: art.length };
  const flat = lying(d);
  if (flat && p.h > p.w) { // held upright: turned a quarter onto its side
    const H = art.length, turned = Array.from({ length: art[0].length }, (_, r) => art.map((l, k) => l[r]).reverse().join(''));
    p = { art: turned, col: (ch, r, k) => col(ch, H - 1 - k + r0, r + c0), w: p.h, h: p.w };
  }
  if (flat) p.h *= flat;
  if (droppedPictures.size > 200) droppedPictures.clear();
  droppedPictures.set(key, p);
  return p;
}
// unit: world units in a metre (0.1 outdoors, where a cell is 10 m; 1 indoors)
function drawDropped(d, vx, vy, unit) {
  const p = droppedPicture(d), m = itemSize(d) * unit / Math.max(p.w, p.h);
  drawArt(vx, vy, d.displayZ ?? (d.at ? 0 : d.z || 0), (d.displaySize?.w??p.w*m), (d.displaySize?.h??p.h*m), p.art, (c, r, L, k) => { const v = p.col(c, r, k); return C(v >> 4, (v & 15) * clamp(L / 11, 0.3, 1)); }, true);
}

// ---- the hotbar and the effects you're under, bottom left (in rows, upwards, if they don't fit across; on a phone,
// left of the buttons)
const hotbarUp = () => !(mode === 'drive' || mode === 'taxi' || !inv.length && !fx.caffeine && !fx.booze && !fx.fresh && !fx.fed && !drugEffects.weed && !drugEffects.neon);
function hotbar() {
  if (!hotbarUp()) return cv.height;
  const maxX = cv.width - 6 - (TOUCH ? TOUCH_PAD_W : 0), width = maxX - 6;
  const rows_ = [[]];
  let rowWidth = 0;
  quickSlots.forEach((k, slot) => {
    const it = inv[k]; if (!it) return;
    const s = `${slot + 1} ${itemName(it)}${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? ` x${it.uses}` : ''}`;
    const lines = wrapText(s, width - 12), w = Math.max(...lines.map(l => g.measureText(l).width)) + 12;
    if (rowWidth && rowWidth + w > width) { rows_.push([]); rowWidth = 0; }
    rows_.at(-1).push({ k, lines, w }); rowWidth += w + 4;
  });
  let bottom = cv.height - FS - 2;
  for (const row of rows_) {
    if (!row.length) continue;
    const h = Math.max(...row.map(c => c.lines.length)) * (FS + 4) + 4, y = bottom - h;
    let x = 6;
    for (const { k, lines, w } of row) {
      g.fillStyle = k === held ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.6)'; g.fillRect(x, y, w, h);
      g.fillStyle = k === held ? '#fff' : 'rgba(255,255,255,0.5)';
      lines.forEach((s, n) => g.fillText(s, x + 6, y + 4 + n * (FS + 4)));
      x += w + 4;
    }
    bottom = y - 4;
  }
  const tags = [tickets > 0 && `${tickets} tickets`, fx.caffeine > 0 && 'caffeinated', fx.booze > 0.5 ? 'drunk' : fx.booze > 0.15 && 'tipsy', ...drugEffectTags(), fx.skating && (SK.score ? `skating: ${SK.score} pts` : 'skating'), fx.fresh > 0 && 'fresh clothes', fx.fed > 0 && 'well fed', fx.boombox && `playing: ${SONG_NAMES[fx.song] || 'music'}${heldItem() && heldItem().id === 'boombox' ? keyless(' (B: next)') : ''}`].filter(Boolean);
  if (tags.length) {
    const lines = wrapText(tags.join('  '), width - 12), h = lines.length * (FS + 4) + 4;
    bottom -= h;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(6, bottom, Math.max(...lines.map(s => g.measureText(s).width)) + 12, h);
    g.fillStyle = 'rgba(255,255,255,0.7)'; lines.forEach((s, n) => g.fillText(s, 12, bottom + 4 + n * (FS + 4)));
  }
  return bottom;
}

// ---- shop menu and inventory: small panels over a frozen game, keyboard or mouse
let shopEl = null, invEl = null, shopCtx = null, invStyle = false;
const panel = id => menuEl(id, 400, '<div class="panel"></div>');
function showPanel(el, html) {
  el.querySelector('.panel').innerHTML = html; el.style.display = 'flex'; paused = true;
  for (const k in K) K[k] = 0;
  releaseMouse();
}
function hidePanel(el) { if (el && el.style.display !== 'none') { el.style.display = 'none'; paused = false; } }
const panelOpen = () => [shopEl, invEl, storeEl, typeof furnishingEl !== 'undefined' && furnishingEl, typeof cookEl !== 'undefined' && cookEl, typeof workshopEl !== 'undefined' && workshopEl, typeof drugSaleEl !== 'undefined' && drugSaleEl, typeof supplierEl !== 'undefined' && supplierEl, typeof fishingCompetitionEl !== 'undefined' && fishingCompetitionEl].some(el => el && el.style.display === 'flex');
// title, item ids, and the cart if it's a street vendor (for the fetch favour)
function openShop(title, stock, vendor = null) {
  shopEl = shopEl || panel('shop');
  shopCtx = { title, stock, vendor };
  const rows_ = stock.map((id, k) => { const it = ITEMS[id]; return `${id === UNDER_COUNTER[0] ? '<h2>under the counter</h2>' : ''}<button class="item" data-buy="${id}" ${money < it.price ? 'disabled' : ''}><span class="k">${k < 9 ? k + 1 : ''}</span><span>${it.name}</span><span class="lead"></span><span class="v">${fmt$(it.price)}</span></button>`; }).join('');
  const rate = SELL_RATE[title], sells = rate ? inv.map((it, k) => { const p = sellPrice(it, rate), bin = binnable(it, rate);
    return `<button class="item" data-sell="${k}" ${p || bin ? '' : 'disabled'}><span class="k">${k < 9 ? '^' + (k + 1) : ''}</span><span>${itemName(it)}</span><span class="lead"></span><span class="v">${p ? fmt$(p) : bin ? 'bin it' : 'no'}</span></button>`; }).join('') || '<p class="sub" style="padding-left:18px">Nothing to sell.</p>' : '';
  const work = shiftHere();
  const workRow = work ? `<h2>work</h2><button class="item" data-work><span class="k">J</span><span>${{ serve: 'Wait tables for a shift', tapper: 'Tend bar for a shift' }[work] || 'Stock the shelves for a shift'}</span><span class="lead"></span><span class="v">paid</span></button>` : '';
  showPanel(shopEl, `<h1>${title[0] + title.slice(1).toLowerCase()}</h1><p class="sub">${fmt$(money)} on you &middot; carrying ${inv.length}/${INV_SIZE}</p>
    ${rate ? `<h2>buy</h2>${rows_}<h2>sell</h2>${sells}` : rows_}${workRow}<p class="hint">1-${Math.min(9, stock.length)} buy &middot; click any item${rate ? ' &middot; shift+1-9 sell' : ''}${work ? ' &middot; J work' : ''} &middot; E / Esc close</p>`);
  shopEl.onclick = e => { const b = e.target.closest('[data-buy]'), v = e.target.closest('[data-sell]'); if (b) shopBuy(b.dataset.buy); else if (v) shopSell(+v.dataset.sell); else if (e.target.closest('[data-work]')) startShift(); };
  if(title==='BAIT & TACKLE')addFishingCompetitionShop();
}
function shopBuy(id) {
  const [ok, line] = buy(id);
  say(line, 3);
  if (ok && /MACHINE/.test(shopCtx.title) && actx) sfxUse('vending');
  if (ok && shopCtx.vendor && taskBuy(shopCtx.vendor, id)) say(`${line} That's the one they wanted.`, 4);
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
  if (!invStyle) { const style = document.createElement('style'); style.textContent = `#inventory .carry-row { display:flex; align-items:center; gap:10px; } #inventory .carry-row > .item { flex:1; width:auto; min-width:0; } #inventory .quick-slot { display:flex; align-items:center; gap:4px; white-space:nowrap; color:rgba(255,255,255,0.3); } #inventory .quick-slot select { width:4.5em; padding:2px; border:1px solid rgba(255,255,255,0.18); color:rgba(255,255,255,0.75); background:#08080a; font:inherit; } #inventory .quick-slot option { color:#fff; background:#08080a; }`; document.head.appendChild(style); invStyle = true; }
  const rows_ = inv.length ? inv.map((it, k) => {
    const slot = quickSlots.indexOf(k), name = itemName(it);
    return `<div class="carry-row"><button class="item" data-slot="${k}"${k === held ? ' style="color:#fff"' : ''}><span class="k">${slot < 0 ? '' : slot + 1}</span><span>${name}${k === held ? ' &middot; in hand' : ''}</span><span class="lead"></span><span class="v">${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? 'x' + it.uses : ''}</span></button><label class="quick-slot">slot <select data-quick-item="${k}" aria-label="Quick slot for ${name}"><option value="-1"${slot < 0 ? ' selected' : ''}>none</option>${Array.from({ length: QUICK_SLOTS }, (_, s) => `<option value="${s}"${slot === s ? ' selected' : ''}>${s + 1}</option>`).join('')}</select></label></div>`;
  }).join('') : '<p class="sub" style="padding-left:18px">Nothing. Shops sell things.</p>';
  const ink = tattoos.length ? `<p class="sub">Your ink: ${tattoos.map(id => ITEMS[id].name).join(', ')}</p>` : '';
  showPanel(invEl, `<h1>Carrying</h1><p class="sub">${fmt$(money)} on you &middot; ${inv.length}/${INV_SIZE}</p>${ink}${rows_}<p class="hint">Click an item to hold it; assign quick slots here. 1-8 select &middot; Q use &middot; X drop &middot; I / Esc close</p>`);
  invEl.onclick = e => { const b = e.target.closest('[data-slot]'); if (b) { holdSlot(+b.dataset.slot); openInventory(); } };
  invEl.onchange = e => { const s = e.target.closest('[data-quick-item]'); if (s) { assignQuickSlot(+s.dataset.quickItem, +s.value); openInventory(); } };
}
const closeInventory = () => hidePanel(invEl);
// your storage unit: click a carried thing to put it in, a stored thing to take it out
let storeEl = null;
let storeCtx = [stored, 'your unit', 'Storage unit', 'The same unit at every storage place in town', null, STORE_SIZE];
function openStorage(list = storeCtx[0], where = storeCtx[1], title = storeCtx[2], sub = storeCtx[3], accepts = storeCtx[4], capacity = storeCtx[5], put = null) {
  if(arguments.length===0)put=storeCtx[6]||null;
  storeCtx = [list, where, title, sub, accepts, capacity, put];
  const store=k=>put?put(k):storeSlot(k,list,where,accepts,capacity);
  storeEl = storeEl || panel('storage');
  const item = it => `${itemName(it)}${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? ` x${it.uses}` : ''}`;
  const eligible = inv.map((it, k) => ({ it, k })).filter(({ it }) => !accepts || accepts(it));
  const carried = eligible.length ? eligible.map(({ it, k }) => { const slot = quickSlots.indexOf(k); return `<button class="item" data-store="${k}"><span class="k">${slot < 0 ? '' : slot + 1}</span><span>${item(it)}</span><span class="lead"></span><span class="v">store</span></button>`; }).join('') : `<p class="sub" style="padding-left:18px">${inv.length ? 'Nothing suitable to put here.' : 'Nothing in your hands.'}</p>`;
  const unit = list.length ? list.map((it, k) => `<button class="item" data-take="${k}"><span class="k">${k < 9 ? '^' + (k + 1) : ''}</span><span>${item(it)}</span><span class="lead"></span><span class="v">take</span></button>`).join('') : '<p class="sub" style="padding-left:18px">Empty.</p>';
  showPanel(storeEl, `<h1>${title}</h1><p class="sub">${sub}</p>
    <h2>carrying ${inv.length}/${INV_SIZE}</h2>${capacity >= STORE_SIZE && eligible.length ? '<button class="item" data-store-all>Store all carried items that fit</button>' : ''}${carried}
    <h2>in ${where.replace('your ', 'the ')} ${list.length}/${capacity}</h2>${capacity >= STORE_SIZE && list.length ? '<button class="item" data-take-all>Take all that fit in your bag</button>' : ''}${unit}
    <p class="hint">1-8 store quick slot &middot; shift+1-9 take &middot; E / Esc close</p>`);
  storeEl.onclick = e => {
    const s = e.target.closest('[data-store]'), t = e.target.closest('[data-take]');
    if (e.target.closest('[data-store-all]')) { for (const {k} of [...eligible].reverse()) if (list.length < capacity) store(k); }
    else if (e.target.closest('[data-take-all]')) { while(list.length && inv.length < INV_SIZE) retrieveSlot(0,list,where); }
    else if (s) say(store(+s.dataset.store)[1], 2); else if (t) say(retrieveSlot(+t.dataset.take, list, where)[1], 2); else return;
    saveGame();
    openStorage();
  };
}
// keys while a panel is up; true if handled
function panelKey(e) {
  if (!panelOpen()) return false;
  if(furnishingEl?.style.display==='flex'){if(['Escape','KeyE','KeyF','KeyI'].includes(e.code))hidePanel(furnishingEl);return true;}
  if (fishingCompetitionPanelKey(e)) return true;
  if (workshopPanelKey(e)) return true;
  if (cookPanelKey(e)) return true;
  if (storeEl && storeEl.style.display === 'flex') {
    const n = /^Digit([1-9])$/.exec(e.code);
    if (e.code === 'Escape' || e.code === 'KeyE') hidePanel(storeEl);
    else if (n && e.shiftKey) { say(retrieveSlot(n[1] - 1, storeCtx[0], storeCtx[1])[1], 2); openStorage(); }
    else if (n && +n[1] <= QUICK_SLOTS) { const k = quickSlots[n[1] - 1]; say((storeCtx[6]?storeCtx[6](k):storeSlot(k, storeCtx[0], storeCtx[1], storeCtx[4], storeCtx[5]))[1], 2); openStorage(); }
    return true;
  }
  const shop = shopEl && shopEl.style.display === 'flex', n = /^Digit([1-9])$/.exec(e.code);
  if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI' && !shop) { shop ? closeShop() : closeInventory(); return true; }
  if (shop && e.code === 'KeyJ' && shiftHere()) { startShift(); return true; }
  if (shop && n && e.shiftKey && SELL_RATE[shopCtx.title]) { shopSell(n[1] - 1); return true; }
  if (shop && n && shopCtx.stock[n[1] - 1]) { shopBuy(shopCtx.stock[n[1] - 1]); return true; }
  if (!shop && n) { holdQuickSlot(n[1] - 1); openInventory(); return true; }
  if (!shop && e.code === 'KeyQ') { closeInventory(); useHeldItem(); return true; }
  if (!shop && e.code === 'KeyX') { dropHere(); openInventory(); return true; }
  return true; // swallow everything else
}

// ---- using things: the sounds that go with them
const HEADLINES = () => newsLines().length ? newsLines() : [...MARKET.news.slice(0, 2).map(n => n.line), // (anything with you in it leads) `${pick(stations).name} station closed for repairs`, 'Mayor vows to fix the el (again)', 'Bridge tolls to rise',
  'Local cat elected to community board', `Rents soar in ${pick(['Chinatown', 'the Brownstones', 'Midtown'])}`, 'Ambulance response times improve',
  'Record crowds at the waterfront', 'Fog to roll in this week, say forecasters', ...EVENTS.map(e => e[4])];
function useHeldItem() {
  if(wanted.busted)return;
  if(furnishingPlacement){furnishingPlacement.a=mod(furnishingPlacement.a+Math.PI/2,TAU);return;}
  if(heldItem()?.id==='camera')return takeHomePhoto();
  if(HOME_FURNITURE[heldItem()?.id]&&(ITEMS[heldItem().id].furniture||homeRecord(room)))return beginFurnishingPlacement(heldItem());
  if (workshopPlacement) {workshopPlacement.a=mod(workshopPlacement.a+Math.PI/2,Math.PI*2);return;}
  if (heldGun()) return pullTrigger(); // (gun-ui.js)
  if (heldItem() && heldItem().id === 'spraypaint') return sprayTag();
  if (body.seat && body.seat.grass && heldItem() && ITEMS[heldItem().id].kind === 'food' && chance(0.5)) { // a picnic
    const name = ITEMS[heldItem().id].name, [, sound] = useHeld({ indoors: false, x: px, y: py, a, rain, person: null, headlines: HEADLINES(), water: false });
    say(rain > 0.3 ? `A soggy picnic. The ${name} is good anyway.` : pick([`A picnic on the grass. The ${name} tastes better out here.`, `You eat your ${name} on the lawn. A sparrow watches every bite.`, day > 0.3 ? `Sun on your back, ${name} in hand. Not a bad afternoon.` : `A picnic by moonlight. The ${name} and the crickets.`]), 3);
    if (actx && sound) sfxUse(sound);
    return;
  }
  const used=heldItem();
  const [line, sound] = useHeld({ indoors: mode === 'room', x: px, y: py, a, rain, person: nearPerson(), headlines: HEADLINES(),
    water: mode === 'walk' && (seaDist(px, py) < 1.2 || blockKind(Math.floor(px / 8), Math.floor(py / 8)) === 'park' && inPond(mod(px, 8), mod(py, 8), Math.floor(px / 8) & (NB - 1), Math.floor(py / 8) & (NB - 1), 0.4)) });
  if ((ITEMS[used?.id]?.kind==='drug' || used?.id==='joint') && sound) {updateDrugBuyer();saveGame();}
  if (line) say(line, Math.max(3, line.length / 20)); // (long enough to read)
  if (actx && sound) sfxUse(sound);
}
function sfxUse(s) {
  const at = actx.currentTime;
  if (s === 'bite') playClip('eat', 0.5);
  if (s === 'sip') playClip('drink', 0.6);
  if (s === 'cancrush') playClip('cancrush', 0.42);
  if (s === 'light') playClip('cig-light', 0.45);
  if (s === 'drag') playClip(Math.random() < 0.5 ? 'cig-pull-1' : 'cig-pull-2', 0.5);
  if (s === 'kick') { tone(at, 110, 0.12, 0.2); burst(at, 0.05, [filt('bandpass', 900, 1)], 0.15); }
  if (s === 'page') burst(at, 0.15, [filt('highpass', 2500)], 0.05);
  if (s === 'board') { tone(at, 180, 0.08, 0.12); burst(at, 0.1, [filt('bandpass', 1200, 1)], 0.1); }
  if (s === 'click') tone(at, 1800, 0.03, 0.08, 'square');
  if (s === 'chime') sfxDoor();
  if (s === 'whirr') { burst(at, 0.5, [filt('bandpass', 700, 3)], 0.05); burst(at + 0.55, 0.4, [filt('bandpass', 900, 3)], 0.04); }
  if (s === 'squeak') playClip('squeak', 0.16);
  if (s === 'meow') playClip('meow', 0.48);
  if (s === 'bark') playClip('bark', 0.14);
  if (s === 'tape') playClip('boombox-tape-insert', 0.38);
  if (s === 'ollie') playClip('ollie', 0.5);
  if (s === 'ollie-land') playClip('ollie-land', 0.35);
  if (s === 'vending') playClip('vending-machine', 0.42);
  if (s === 'harmonica') playClip('harmonica', 0.6);
}
// the ball, out in the world: a football, black pentagons and white hexagons (a truncated icosahedron: each point of
// the surface belongs to whichever face's plane a ray from the middle meets first), seams between, rolling as it goes.
// Far off, too small for any of that, just a white ball.
const BALL_R = 0.017, PHI = (1 + Math.sqrt(5)) / 2;
const ballDirs = vs => vs.map(v => { const n = Math.hypot(...v); return v.map(c => c / n); });
const BALL_PENT = ballDirs([[0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI], [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0], [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1]]);
const BALL_HEX = ballDirs([...[-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(c => [a, b, c]))),
  ...[-1, 1].flatMap(a => [-1, 1].flatMap(b => [[0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]]))]);
const BALL_FACE = [2.327, 2.267]; // how far each pentagon's and hexagon's plane is from the middle (unit edges)
function raySphere(ox, oy, oz, rx, ry, rz, b) { // b: a box round the sphere; its middle and half width
  const zc = (b.z0 + b.z1) / 2, x = ox - b.x, y = oy - b.y, z = oz - zc, A = rx * rx + ry * ry + rz * rz, B = x * rx + y * ry + z * rz, Cc = x * x + y * y + z * z - b.hl * b.hl;
  const h = B * B - A * Cc;
  if (h < 0) return -1;
  const t = (-B - Math.sqrt(h)) / A;
  if (t < 0.01) return -1;
  HIT.u = (x + rx * t) / b.hl; HIT.v = (y + ry * t) / b.hl; HIT.w = (z + rz * t) / b.hl; HIT.face = 0; // (the unit normal)
  return t;
}
function ballSpin(dt_x, dt_y) { // roll the ball's pattern by however far it's gone since last drawn
  const R = ball.rot ||= [1, 0, 0, 0, 1, 0, 0, 0, 1], d = Math.hypot(dt_x, dt_y);
  if (d < 1e-6 || d > 0.5) return R;
  const ax = -dt_y / d, ay = dt_x / d, a = d / BALL_R, c = Math.cos(a), s = Math.sin(a), k = 1 - c; // about (ax, ay, 0)
  const M = [c + ax * ax * k, ax * ay * k, ay * s, ax * ay * k, c + ay * ay * k, -ax * s, -ay * s, ax * s, c];
  const out = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push(M[i * 3] * R[j] + M[i * 3 + 1] * R[3 + j] + M[i * 3 + 2] * R[6 + j]);
  return ball.rot = out;
}
function drawBall() {
  if (!ball) return;
  const [vx, vy] = R(ball.x, ball.y), d = Math.hypot(vx, vy), zc = ball.z + BALL_R;
  const Rm = ballSpin(rel(ball.x - (ball.lx ?? ball.x)), rel(ball.y - (ball.ly ?? ball.y)));
  ball.lx = ball.x; ball.ly = ball.y;
  if (BALL_R * 2 * projX / d < 3) return dot(vx, vy, zc, BALL_R, (i, t, L) => { BG[i] = C(WHITE, 6 + L * 0.5); return set(i, 'o', C(GRAY, L)), true; });
  drawBox(boxAt(vx, vy, 1, 0, BALL_R, BALL_R, zc - BALL_R, zc + BALL_R), (i, t, L) => {
    const nx = HIT.u, ny = HIT.v, nz = HIT.w, light = 0.6 + 0.4 * Math.max(0, -nx * 0.4 + ny * 0.3 + nz * 0.75);
    const bx = Rm[0] * nx + Rm[3] * ny + Rm[6] * nz, by = Rm[1] * nx + Rm[4] * ny + Rm[7] * nz, bz = Rm[2] * nx + Rm[5] * ny + Rm[8] * nz; // (into the ball's own frame)
    let best = -1, next = -1, pent = false;
    for (const [dirs, k] of [[BALL_PENT, 0], [BALL_HEX, 1]]) for (const q of dirs) {
      const sc = (q[0] * bx + q[1] * by + q[2] * bz) / BALL_FACE[k];
      if (sc > best) { next = best; best = sc; pent = !k; } else if (sc > next) next = sc;
    }
    const seam = !pent && best - next < 0.006 * Math.max(1, 3 * t / (BALL_R * projX)); // (the stitching, between white panels)
    BG[i] = pent ? C(GRAY, 0.2 + light * 0.5) : seam ? C(GRAY, 5 * light) : C(WHITE, Math.max(7, 9 + L * 0.4) * light + 2);
    return set(i, ' ', 0), true;
  }, raySphere);
}

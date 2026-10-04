// ===== the stock exchange: downtown, next door to the casino, facing the plaza. Grey stone and big columns, EXCHANGE
// on the frieze, a running ticker of prices across the front. Inside, the trading floor: a big board of prices on the
// back wall, tickers running round the walls, traders milling about, and a broker at the desk who takes your orders
// (the trading screen: GAMES.market in stocks.js).
let tickerCache = '', tickerT = -9;
const liveTicker = () => { if (T - tickerT > 1) { tickerT = T; tickerCache = tickerLine() + '   *   '; } return tickerCache; }; // (rebuilt once a second)
function exchangeFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const L = fog * amb * (side ? 10 : 15), glow = Math.max(night, overcast * 0.5), sgn = Math.sign(u * wc) || 1;
  const c = EXCHANGE, y0 = c.by * 8 + 2, a0 = side ? c.bx * 8 + 2 : y0, along = wc - a0, len = side ? 6 : 4;
  const front = side && Math.abs(rel((my + (rel(py - my) < 0 ? 0 : 1)) - y0)) < 0.01;
  BG[i] = bgAt(GRAY, day * 3 * (0.45 + 0.55 * fog) * (side ? 0.7 : 1), d);
  if (front && z > 1.3 && z < 1.45) { // the price ticker, running across the front
    const tk = liveTicker(), q = (u + T * 0.9) / 0.06, p = mod(Math.floor(q), tk.length), ch = tk[p];
    BG[i] = C(GRAY, 0.6);
    const col = /[+]/.test(tk.slice(Math.max(0, p - 7), p + 1)) ? GREEN : /-/.test(tk.slice(Math.max(0, p - 7), p + 1)) ? RED : YEL;
    return set(i, (uStep >= 0.06 || oneCell((fract(q) - 0.5) * 0.06, uStep)) && oneCell(z - 1.375, d / projY) ? ch : ' ', C(col, 15));
  }
  if (front && z > 0.88 && z < 1.25) { // the pediment: a stone triangle, EXCHANGE on its frieze
    const peak = 1.25 - Math.abs(along - len / 2) / (len / 2) * 0.3;
    if (z > peak) return set(i, ' ', 0);
    if (z > peak - 0.03) return set(i, '/', C(WHITE, L));
    if (Math.abs(z - 0.95) < 0.04 && wallText(i, u, uStep, z, d, 'STOCK EXCHANGE', sgn * (a0 + len / 2), 0.95, 0.07, 0.06, C(GRAY, 3), C(WHITE, Math.max(L * 0.4, 3)))) return;
    return set(i, fract(z * 30) < 0.15 ? '-' : ' ', C(WHITE, L * 0.8));
  }
  if (z < 0.88) { // the colonnade: fat fluted columns, steps at the foot, bronze doors in the middle
    if (z < 0.08) return set(i, '=', C(WHITE, L));
    if (z > 0.8) return set(i, '=', C(WHITE, L * 1.1));
    const fc = fract(along * 1.2);
    if (Math.abs(fc - 0.5) < 0.16) return set(i, Math.abs(fc - 0.5) < 0.05 ? '|' : ':', C(WHITE, L * (1 - Math.abs(fc - 0.5) * 2)));
    if (front && Math.abs(along - len / 2) < 0.3 && z < 0.5) { BG[i] = C(BRICK, 1.5 + glow * 2); return set(i, Math.abs(along - len / 2) < 0.02 ? '|' : '#', C(ORANGE, L * 0.8)); }
    BG[i] = C(GRAY, 0.5 + glow * 1.5); return set(i, ' ', 0); // shadow behind the columns
  }
  // the upper floors: stone in courses, tall windows, lit late (somebody's always trading)
  const fu = fract(along * 2), fz = fract(z * 3);
  if (fu > 0.3 && fu < 0.7 && fz > 0.2 && fz < 0.85) return hash(Math.floor(along * 2), Math.floor(z * 3), 1501) > 0.5 - glow * 0.3 ? set(i, '#', C(YEL, Math.max(L, glow * 13))) : set(i, ':', C(day > 0.5 ? CYAN : GRAY, L * 0.4));
  return set(i, fract(z * 9) < 0.12 ? '_' : ' ', C(WHITE, L * 0.6));
}
// ---- inside: the trading floor
const EXCH_W = 20, EXCH_H = 14;
function exchangeWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su);
  if (z > 2.55 && z < 2.75) { // a ticker running all the way round the room
    const tk = liveTicker(), q = (u * (my === 0 || my === EXCH_H - 1 ? 1 : -1) + T * 1.4) / 0.25, p = mod(Math.floor(q), tk.length);
    BG[i] = C(GRAY, 0.5);
    return set(i, (uStep >= 0.25 || oneCell((fract(q) - 0.5) * 0.25, uStep)) && oneCell(z - 2.65, d / projY) ? tk[p] : ' ', C(YEL, 14)), true;
  }
  if (my === 0 && z > 1.1 && z < 2.45 && u > 2 && u < EXCH_W - 2) { // the big board: a row a company, price and change
    BG[i] = C(GRAY, 0.4);
    const k = Math.floor((2.45 - z) / (1.35 / STOCKS.length)), s = STOCKS[k], zr = 2.45 - (k + 0.5) * 1.35 / STOCKS.length;
    if (!s) return set(i, ' ', 0), true;
    const ch = pctChange(s), up = ch >= 0, row = `${s.sym}  ${s.price.toFixed(2).padStart(7)}  ${up ? '+' : ''}${ch.toFixed(1)}%  ${up ? '^' : 'v'}`;
    if (wallText(i, su, uStep, z, d, row, EXCH_W / 2 * Math.sign(su), zr, 0.32, 1.35 / STOCKS.length * 0.8, C(up ? GREEN : RED, 15), C(GRAY, 0.4))) return true;
    return set(i, ' ', 0), true;
  }
  if (z < 1) { BG[i] = C(BRICK, 1 + L * 0.1); return set(i, fract(u * 1.5) < 0.05 ? '|' : ' ', C(BRICK, L * 0.7)), true; } // wood panelling
  BG[i] = C(WHITE, 1.5 + L * 0.1); // marble, veined
  return set(i, noise(u * 2, z * 3, 1502) > 0.7 ? '~' : ' ', C(GRAY, L * 0.5)), true;
}
ROOM_DEFS.exchange = { grid: boxRoom(EXCH_W, EXCH_H), light: 0.9, height: 3.2, floor: 'marble', ceil: 'strip', wall: exchangeWall, keeper: [10, 4.4],
  props: r => {
    const p = [...counterBox(10, 5, 1.8, 1.05), standing(10, 4.4, BLUE)];
    for (const [x, y] of [[4, 8], [16, 8], [6, 11], [14, 11]]) { // trading desks: screens glowing green and red
      p.push(BX(x, y, 0.9, 0.4, 0, 0.75, solid(BRICK, { top: '=' })));
      p.push({ ...SP(x, y, 1.2, 0.35, ['[^^][vv]'], (c, row, L) => C(c === '^' ? GREEN : c === 'v' ? RED : GRAY, 14), 0.75), tick: s => { s.art = [fract(T * 0.7 + x) < 0.5 ? '[^v][v^]' : '[^^][vv]']; } });
    }
    for (let k = 0; k < 8; k++) { // traders, pacing about, phones to their ears
      const x0 = 3 + (k * 2.1) % 14, y0 = 7 + (k % 3) * 2, sp = 0.2 + (k % 3) * 0.1;
      p.push({ ...standing(x0, y0, [WHITE, BLUE, GRAY][k % 3]), tick: s => { s.x = x0 + Math.sin(T * sp + k) * 1.5; s.y = y0 + Math.cos(T * sp * 0.7 + k) * 0.6; } });
    }
    return p;
  } };
ROOM_FOR.EXCHANGE = 'exchange';
const atBroker = () => mode === 'room' && room.kind === 'exchange' && nearKeeper();
// news on the wire: tell you if it's about something you own, or if you're on the floor
let newsSeen = 0;
function stepExchange() {
  stepMarket();
  const n = MARKET.news[0];
  if (n && n.tick !== newsSeen) {
    newsSeen = n.tick;
    if (shares[n.sym] || mode === 'room' && room.kind === 'exchange') say(`NEWS: ${n.line}. ${n.sym} ${n.up ? 'jumps' : 'drops'} to ${fmt$(stockBy(n.sym).price)}.`, 5);
  }
}

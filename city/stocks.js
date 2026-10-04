// ===== the stock market: a handful of the city's companies, their prices moving through the trading day (9:30 to 4,
// Monday to Friday), a jump overnight, and now and then a piece of news that sends one up or down hard. Buy and sell
// at the exchange downtown (exchange.js has the building and the trading floor); your shares are kept in the save.
// Prices move in game time, so they keep going while you're off doing other things (and race if you fast-forward).
const STOCKS = [
  { sym: 'DUMP', name: 'Golden Dumpling Co', price: 24, vol: 0.011, good: ['opens 40 new stalls', 'wins best dumpling award'], bad: ['hit by flour shortage', 'health inspector visit'] },
  { sym: 'CABS', name: 'City Cabs', price: 41, vol: 0.009, good: ['record fares this month', 'new fleet of taxis'], bad: ['drivers go on strike', 'fares cut to beat rivals'] },
  { sym: 'ELRL', name: 'Elevated Rail', price: 18, vol: 0.008, good: ['gets city funding for repairs', 'ridership at all-time high'], bad: ['el shut for repairs again', 'mayor blames the el for traffic'] },
  { sym: 'PIER', name: 'Sunset Pier Fun', price: 12, vol: 0.018, good: ['new rollercoaster announced', 'heatwave packs the pier'], bad: ['ferris wheel stuck for hours', 'storms close the pier'] },
  { sym: 'JADE', name: 'Chinatown Jade', price: 55, vol: 0.01, good: ['tourists snap up lucky charms', 'rare jade found'], bad: ['fake jade scandal', 'tourist season slow'] },
  { sym: 'LUCK', name: 'Lucky Star Casino', price: 73, vol: 0.016, good: ['high roller loses big', 'licence renewed'], bad: ['someone hits the jackpot twice', 'gambling inquiry opened'] },
  { sym: 'BYTE', name: 'ByteWave Tech', price: 110, vol: 0.024, good: ['launches a new phone', 'buys a rival'], bad: ['data leak!', 'CEO quits suddenly'] },
];
for (const s of STOCKS) { // a past to chart from the start: a random walk that ends at today's price
  let v = 1; const walk = [];
  for (let k = 0; k < 48; k++) { walk.push(v); v *= 1 + (Math.random() + Math.random() + Math.random() - 1.5) * 1.4 * s.vol; }
  s.hist = walk.map(w => Math.round(s.price * w / walk[47] * 100) / 100); s.open = s.hist[30]; s.mom = 0;
}
const shares = {}; // sym -> { n, cost (what you paid for them all) }
const MARKET = { tick: 0, news: [], lastMin: null }; // tick count; recent headlines, newest first
const TRADE_FEE = 1; // the broker's cut, a trade
const marketOpen = (t = tod, d = dayNum) => mod(d, 7) < 5 && t >= 9.5 && t < 16;
const stockBy = sym => STOCKS.find(s => s.sym === sym);
const holdingsValue = () => STOCKS.reduce((v, s) => v + (shares[s.sym] ? shares[s.sym].n * s.price : 0), 0);
const pctChange = s => (s.price - s.open) / s.open * 100;
// one tick of the market (every 5 game minutes while it's open): a random walk with a little momentum, a slow pull
// back toward where it's been, and the odd big news story
function marketTick(rnd = Math.random, gap = false) {
  MARKET.tick++;
  for (const s of STOCKS) {
    const norm = (rnd() + rnd() + rnd() - 1.5) * 1.4; // roughly normal
    const avg = s.hist.reduce((a, b) => a + b, 0) / s.hist.length;
    let r = norm * s.vol * (gap ? 2.5 : 1) + s.mom * 0.3 + (avg - s.price) / avg * 0.01;
    if (!gap && rnd() < (s.tip ? 0.05 : 0.006)) { // news (a stock a fortune cookie tipped gets some soon, and it's good)
      const up = s.tip || rnd() < 0.5, line = `${s.name} ${pick_(up ? s.good : s.bad, rnd)}`;
      r += (up ? 1 : -1) * (0.07 + rnd() * 0.12);
      MARKET.news.unshift({ sym: s.sym, line, up, tick: MARKET.tick }); s.tip = false;
      MARKET.news.length = Math.min(MARKET.news.length, 6);
    }
    s.mom = s.mom * 0.6 + r * 0.4;
    s.price = Math.max(1, Math.round(s.price * (1 + r) * 100) / 100);
    s.hist.push(s.price); if (s.hist.length > 48) s.hist.shift();
  }
}
const pick_ = (arr, rnd) => arr[rnd() * arr.length | 0];
// every frame: tick for each 5 game minutes that's gone by while open; at the morning bell, the overnight jump and a
// fresh day's opening prices
function stepMarket() {
  const now = dayNum * 1440 + tod * 60;
  if (MARKET.lastMin === null || now < MARKET.lastMin || now - MARKET.lastMin > 1440 * 3) MARKET.lastMin = now; // (first run, or a load)
  while (now - MARKET.lastMin >= 5) {
    MARKET.lastMin += 5;
    const d = Math.floor(MARKET.lastMin / 1440), t = (MARKET.lastMin - d * 1440) / 60;
    if (mod(d, 7) < 5 && Math.abs(t - 9.5) < 0.04) { marketTick(Math.random, true); for (const s of STOCKS) s.open = s.price; } // the opening bell
    else if (marketOpen(t, d)) marketTick();
  }
}
// buying and selling: [ok, what happened]
function buyShares(sym, n) {
  const s = stockBy(sym), cost = Math.round((s.price * n + TRADE_FEE) * 100) / 100;
  if (!marketOpen()) return [false, "The market's closed. It opens at 9:30, Monday to Friday."];
  if (money < cost) return [false, `That's ${fmt$(cost)} with the fee. You have ${fmt$(money)}.`];
  pay(cost);
  const h = shares[sym] || (shares[sym] = { n: 0, cost: 0 });
  h.n += n; h.cost = Math.round((h.cost + s.price * n) * 100) / 100;
  return [true, `Bought ${n} ${sym} at ${fmt$(s.price)}.`];
}
function sellShares(sym, n) {
  const s = stockBy(sym), h = shares[sym];
  if (!marketOpen()) return [false, "The market's closed. It opens at 9:30, Monday to Friday."];
  if (!h || h.n < 1) return [false, `You don't own any ${sym}.`];
  n = Math.min(n, h.n);
  const avg = h.cost / h.n, got = Math.round((s.price * n - TRADE_FEE) * 100) / 100, gain = (s.price - avg) * n;
  earn(Math.max(0, got));
  h.cost = Math.round((h.cost - avg * n) * 100) / 100; h.n -= n;
  if (!h.n) delete shares[sym];
  return [true, `Sold ${n} ${sym} at ${fmt$(s.price)}: ${gain >= 0 ? 'up' : 'down'} ${fmt$(Math.abs(gain))}.`];
}
const tickerLine = () => STOCKS.map(s => `${s.sym} ${s.price.toFixed(2)} ${pctChange(s) >= 0 ? '+' : ''}${pctChange(s).toFixed(1)}%`).join('   ');

// the trading screen: UP/DOWN pick a company, RIGHT buy, LEFT sell, SPACE the lot size; its price chart below
const TRADE_LOTS = [1, 10, 100];
GAMES.market = () => {
  const W = 32, H = 19, g = { id: 'market', title: 'CITY STOCK EXCHANGE', W, H, score: 0, over: false };
  let cur = 0, lot = 0, msg = marketOpen() ? 'RIGHT buy, LEFT sell.' : "Market's closed: you can look, not trade.";
  g.inRound = () => false; g.cursor = () => cur; g.lot = () => TRADE_LOTS[lot]; // (for the tests)
  g.step = (dt, k) => {
    const ev = [];
    if (k.upP) cur = (cur + STOCKS.length - 1) % STOCKS.length; if (k.downP) cur = (cur + 1) % STOCKS.length;
    if (k.actP) lot = (lot + 1) % TRADE_LOTS.length;
    if (k.rightP || k.leftP) { const [ok, m] = (k.rightP ? buyShares : sellShares)(STOCKS[cur].sym, TRADE_LOTS[lot]); msg = m; ev.push(ok ? 'eat' : 'wrong'); }
    return ev;
  };
  g.draw = (put, text, chars) => {
    const at = chars || ((c, y, str, col) => text(c / 2, y, str, col)); // (c in characters)
    at(0, 0, 'SYM   COMPANY             PRICE   TODAY   YOU OWN', C(GRAY, 10));
    STOCKS.forEach((s, k) => {
      const on = k === cur, ch = pctChange(s), h = shares[s.sym];
      at(0, 1 + k, `${on ? '>' : ' '}${s.sym}  ${s.name.padEnd(18)}${s.price.toFixed(2).padStart(7)}`, C(on ? YEL : WHITE, on ? 15 : 11));
      at(34, 1 + k, `${ch >= 0 ? '^+' : 'v'}${ch.toFixed(1)}%`.padEnd(8), C(ch >= 0 ? GREEN : RED, 14));
      if (h) at(44, 1 + k, String(h.n).padStart(6), C(CYAN, 14));
    });
    // the chart: the last 48 ticks, scaled to fit, drawn as a line of / \ _ (green above the day's open, red below)
    const s = STOCKS[cur], hi = Math.max(...s.hist), lo = Math.min(...s.hist), span = Math.max(hi - lo, s.price * 0.01), top = 9, rowsH = 6;
    const rowOf = v => top + Math.round((hi - v) / span * (rowsH - 1));
    at(0, top, hi.toFixed(2), C(GRAY, 9)); at(0, top + rowsH - 1, lo.toFixed(2), C(GRAY, 9)); at(0, top + 2, s.sym, C(YEL, 13));
    const grid = Array.from({ length: rowsH }, () => Array(48).fill(null));
    s.hist.forEach((v, k) => {
      const r = rowOf(v), prev = k ? rowOf(s.hist[k - 1]) : r, col = v >= s.open ? GREEN : RED;
      grid[r - top][k] = [r < prev ? '/' : r > prev ? '\\' : '_', col];
      for (let rr = Math.min(r, prev) + 1; rr < Math.max(r, prev); rr++) grid[rr - top][k] = ['|', col];
    });
    grid.forEach((row, y) => { let k = 0; while (k < 48) { // runs of one colour, as one label each
      if (!row[k]) { k++; continue; }
      const col = row[k][1]; let str = '', k0 = k;
      while (k < 48 && (!row[k] || row[k][1] === col)) { str += row[k] ? row[k][0] : ' '; k++; }
      at(10 + k0, top + y, str.trimEnd(), C(col, 14));
    } });
    const h = shares[s.sym], val = holdingsValue();
    at(0, 16, msg.slice(0, 62), C(WHITE, 15));
    at(0, 17, `LOT ${TRADE_LOTS[lot]}   CASH ${fmt$(money)}   SHARES ${fmt$(val)}${h ? `   ${s.sym}: ${h.n} @ ${fmt$(h.cost / h.n)}` : ''}`.slice(0, 64), C(YEL, 13));
    at(0, 18, (MARKET.news.length ? `NEWS: ${MARKET.news[0].line}` : marketOpen() ? 'MARKET OPEN' : 'MARKET CLOSED   opens 9:30 Mon-Fri').slice(0, 64), C(MARKET.news.length ? (MARKET.news[0].up ? GREEN : RED) : marketOpen() ? GREEN : RED, 12));
  };
  g.status = () => `UP/DOWN pick   RIGHT buy   LEFT sell   SPACE lot (${TRADE_LOTS[lot]})   E leave`;
  g.reward = () => 0;
  return g;
};

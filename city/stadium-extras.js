// ===== the extras at the Yards ground (STADIUM_PLAN.md, phase 7): a bet on the match at the ticket window (odds from the
// two sides' strength, paid at full time), a season ticket (every match this season, any section), a club scarf and a
// programme from the seller by the turnstiles, and the food kiosk inside the gate.
const SEASON_TICKET_PRICE = 300, BET_STAKES = [10, 50], KIOSK_STOCK = ['hotdog', 'chips', 'candy', 'soda', 'beer', 'coffee'];
const KIOSK = { x: 137.5, y: 103.5 }; // (inside the gate, in the corner you come in by)
// the chances of each result for a fixture, from the same model the results elsewhere use (league.js quickScore)
function matchOdds(home, away) {
  const rate = id => MatchEngine.CLUBS.find(c => c.id === id)?.rating ?? .55, dh = rate(home) - rate(away);
  const lh = clamp(1.75 + dh * 4, .5, 3.6), la = clamp(1.4 - dh * 4, .4, 3.2), pois = (l, k) => { let p = Math.exp(-l); for (let j = 1; j <= k; j++) p *= l / j; return p; };
  let ph = 0, pd = 0, pa = 0;
  for (let i = 0; i <= 9; i++) for (let j = 0; j <= 9; j++) { const p = pois(lh, i) * pois(la, j); if (i > j) ph += p; else if (i === j) pd += p; else pa += p; }
  const margin = .92; // (the house's cut)
  return { home: +(margin / ph).toFixed(2), draw: +(margin / pd).toFixed(2), away: +(margin / pa).toFixed(2) };
}
const hasSeasonTicket = () => league.seasonTicket === league.season;
function placeBet(f, pick, stake) {
  league.bets ||= [];
  if (league.bets.some(b => b.n === f.n)) return [false, 'One bet a match. Yours is on.'];
  if (f.live) return [false, 'Betting closed at kick-off.'];
  if (!pay(stake)) return [false, 'Not enough on you.'];
  const odds = matchOdds(f.home, f.away)[pick];
  league.bets.push({ n: f.n, home: f.home, away: f.away, pick, stake, odds });
  return [true, `${fmt$(stake)} on ${pick === 'draw' ? 'the draw' : clubName(pick === 'home' ? f.home : f.away)} at ${odds.toFixed(2)}. Pays ${fmt$(stake * odds)}.`];
}
// a result in (league.js recordResult): any bet on it settled
function settleBets(n, home, away, score) {
  if (!league.bets?.length) return;
  for (const b of league.bets.filter(b => b.n === n && b.home === home && b.away === away)) {
    const won = b.pick === (score[0] > score[1] ? 'home' : score[0] < score[1] ? 'away' : 'draw');
    if (won) { earn(b.stake * b.odds); say(`Your bet came in: ${clubName(home)} ${score[0]}-${score[1]} ${clubName(away)}. ${fmt$(b.stake * b.odds)} collected.`, 6); }
    else say(`Your bet's lost: ${clubName(home)} ${score[0]}-${score[1]} ${clubName(away)}.`, 4);
  }
  league.bets = league.bets.filter(b => b.n !== n);
}
// the scarf: held up, and at the ground the end around you joins in if it's your side's match
function useScarf(it) {
  const m = stadiumMatch, there = mode === 'room' && room?.kind === 'stadium' && m, side = there ? m.teams.findIndex(t => t.club.id === it.of) : -1;
  if (side >= 0) { if (actx) sfxStadium(m.phase === 'play' ? 'chant' : 'cheer', m); return [`You hold your ${clubName(it.of)} scarf up over your head, and the end round you takes up the song.`, null]; }
  if (there) return ['You hold the scarf up. A few people look at it, and at you, and look away. Wrong club.', null];
  return [`You hold up your ${clubName(it.of || 'yards')} scarf. Nobody joins in. It's not match day here.`, null];
}
// the programme: both sides' line-ups, as named on the day
function readProgramme(it) {
  const n = it.uses; // (the programme keeps its fixture's slot in uses: saved with it)
  const m = stadiumMatch && stadiumMatch.slot === n ? stadiumMatch : Number.isInteger(n) ? stadiumFixtureTeams(n) : null;
  if (!m) return ['A programme from an old match. You flick through the adverts.', 'page'];
  const xi = t => t.players.filter(p => !p.off && !p.sub).map(p => p.name).join(', ');
  return [`${m.teams[0].name}: ${xi(m.teams[0])}.  ${m.teams[1].name}: ${xi(m.teams[1])}.`, 'page'];
}
// the teams for fixture n, as the engine would name them (the same seed the match is played with)
function stadiumFixtureTeams(n) {
  const g = groundFixture(n);
  return MatchEngine.create({ home: g.home, away: g.away, seed: g.seed, knockout: !!g.cup });
}
// the kiosk inside the gate: near enough to reach, and what it sells
const nearKiosk = () => mode === 'room' && room?.kind === 'stadium' && Math.hypot(px - KIOSK.x, py - KIOSK.y) < 1.6;
const kioskProp = () => ({ x: KIOSK.x, y: KIOSK.y, radius: 2, box: boxAt(KIOSK.x, KIOSK.y, 1, 0, 1.4, .5, 0, 1.1), draw: (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, 1.4, .5, 0, 1.1), (i, t, L) => { BG[i] = C(HIT.face === 5 ? GRAY : RED, (HIT.face === 5 ? 2.4 : 3) + L * .2); return set(i, ' ', 0), true; }); // the counter
  drawBox(boxAt(vx, vy + .5, 1, 0, 1.5, .05, 2.1, 2.6), (i, t, L) => { // its sign
    if (HIT.face !== 3 && HIT.face !== 4) { BG[i] = C(GRAY, 1.5); return set(i, ' ', 0), true; }
    const ch = faceText('PIES & PINTS', i, t, vx, vy + .5, 1.4, 2.2, .32); BG[i] = C(RED, 3); return set(i, ch && ch !== ' ' ? ch : ' ', C(YEL, 15)), true;
  });
  for (const e of [-1, 1]) drawBox(boxAt(vx + e * 1.35, vy + .45, 1, 0, .05, .05, 1.1, 2.1), solid(GRAY));
} });

// the ticket window's extras: the season ticket, a bet on today's match, the scarf seller and the programmes
function stadiumExtrasHtml(f) {
  const odds = matchOdds(f.home, f.away), bet = league.bets?.find(b => b.n === f.n);
  const btn = (x, label, price, off, note = '') => `<button class="item" data-x="${x}" ${off ? 'disabled' : ''}><span>${label}${note ? `<br><small>${note}</small>` : ''}</span><span class="lead"></span><span class="v">${price}</span></button>`;
  const betRows = bet ? `<p class="sub">Your bet: ${fmt$(bet.stake)} on ${bet.pick === 'draw' ? 'the draw' : clubName(bet.pick === 'home' ? f.home : f.away)} at ${bet.odds.toFixed(2)}.</p>`
    : f.live ? '<p class="sub">Betting closed at kick-off.</p>'
    : ['home', 'draw', 'away'].map(k => BET_STAKES.map(st => btn(`bet:${k}:${st}`, `${fmt$(st)} on ${k === 'draw' ? 'the draw' : clubName(k === 'home' ? f.home : f.away)}`, `at ${odds[k].toFixed(2)}`, money < st, st === BET_STAKES[0] ? `pays ${fmt$(st * odds[k])}` : '')).join('')).join('');
  return `${hasSeasonTicket() ? '<p class="sub">Season ticket holder: any section, every match this season.</p>' : btn('season', 'Season ticket', fmt$(SEASON_TICKET_PRICE), money < SEASON_TICKET_PRICE, 'Every match at the ground this season, any section')}
    <h2>a bet on it</h2>${betRows}
    <h2>the seller by the turnstiles</h2>
    ${[f.home, f.away].map(id => btn(`scarf:${id}`, `${clubName(id)} scarf`, fmt$(ITEMS.scarf.price), money < ITEMS.scarf.price)).join('')}
    ${btn('programme', `Programme: ${clubShort(f.home)} v ${clubShort(f.away)}`, fmt$(ITEMS.programme.price), money < ITEMS.programme.price, 'Both line-ups (Q to read)')}`;
}
function stadiumExtra(f, x) {
  if (x === 'season') { if (!pay(SEASON_TICKET_PRICE)) return [false, 'Not enough on you.']; league.seasonTicket = league.season; return [true, 'Season ticket. Every match at the Yards this season: walk straight in.']; }
  if (x.startsWith('bet:')) { const [, pick, st] = x.split(':'); return placeBet(f, pick, +st); }
  if (x.startsWith('scarf:')) { if (inv.length >= INV_SIZE) return [false, 'No room in your bag.']; if (!pay(ITEMS.scarf.price)) return [false, 'Not enough on you.']; carryItem({ id: 'scarf', uses: 0, of: x.slice(6) }); return [true, `A ${clubName(x.slice(6))} scarf. Q to hold it up.`]; }
  if (x === 'programme') { if (inv.length >= INV_SIZE) return [false, 'No room in your bag.']; if (!pay(ITEMS.programme.price)) return [false, 'Not enough on you.']; carryItem({ id: 'programme', uses: f.n, of: `${clubShort(f.home)} v ${clubShort(f.away)}` }); return [true, 'A programme. Q to read the line-ups.']; }
}

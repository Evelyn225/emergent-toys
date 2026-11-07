// ===== the city league and the fixtures at the Yards ground (STADIUM_PLAN.md, phase 4). Eight clubs (match-engine.js
// CLUBS) play a double round-robin, a round at every fixture slot: Wednesdays at 19:30 under the floodlights and
// Saturdays at 15:00. One match of each round is played at the ground (the gates open an hour and a half before
// kick-off); the other three are played elsewhere and come in as results. A match takes about two hours of city time
// from kick-off; inside the ground, the city clock keeps pace with the match. The table and the results are saved.
const LEAGUE_SLOTS = [{ day: 2, tod: 19.5, name: 'WED 19:30' }, { day: 5, tod: 15, name: 'SAT 15:00' }]; // (Mon = 0)
const MATCH_HOURS = 1.95, GATES_EARLY = 1.5;
let league = { played: -1, table: {}, results: [], season: 1 }, leagueTickT = 0; // played: the last slot whose results are in
// slot n: when it kicks off (an absolute hour count from day 0, so slots compare simply)
const slotHour = n => (Math.floor(n / LEAGUE_SLOTS.length) * 7 + LEAGUE_SLOTS[n % LEAGUE_SLOTS.length].day) * 24 + LEAGUE_SLOTS[n % LEAGUE_SLOTS.length].tod;
const nowHour = () => dayNum * 24 + tod;
// the last slot to have kicked off by hour h (-1 before the first)
function slotAt(h) { let n = Math.max(0, Math.floor(h / (7 * 24)) * LEAGUE_SLOTS.length - 1); while (slotHour(n + 1) <= h) n++; return slotHour(n) <= h ? n : -1; }
// the round-robin: round r's four pairings, by the circle method; the second half of the season swaps home and away
function roundPairs(r) {
  const ids = MatchEngine.CLUBS.map(c => c.id), n = ids.length, k = r % (n - 1), flip = Math.floor(r / (n - 1)) % 2 === 1;
  const ring = [ids[0], ...ids.slice(1).map((_, j) => ids[1 + (j + k) % (n - 1)])], pairs = [];
  for (let j = 0; j < n / 2; j++) { let h = ring[j], a = ring[n - 1 - j]; if ((j + k) % 2) [h, a] = [a, h]; if (flip) [h, a] = [a, h]; pairs.push([h, a]); }
  return pairs;
}
const roundOf = n => n % ((MatchEngine.CLUBS.length - 1) * 2);
// the slot's match at the ground: one of the round's four, turn about (so every club comes to the Yards in a season)
const groundPair = n => roundPairs(roundOf(n))[Math.floor(n / ((MatchEngine.CLUBS.length - 1) * 2) + n) % 4];
const clubName = id => MatchEngine.CLUBS.find(c => c.id === id)?.name || id;
const clubShort = id => MatchEngine.CLUBS.find(c => c.id === id)?.short || id;
const fixtureSeed = (n, k) => ((n + 1) * 7919 + k * 104729 + league.season * 31) >>> 0;
// the next fixture at the ground (now, if it's on): { n, when, short, home, away, kick (hours), live, open, seed, cup }
// A league match has its slot for n; a cup tie a negative n (cupId), and cup: the round's name
function stadiumNextFixture() {
  const h = nowHour(); let n = Math.max(0, slotAt(h));
  if (slotHour(n) + MATCH_HOURS <= h) n++; // (that one's over: the next)
  const c = nextCupAtGround(h), id = c && c.kick < slotHour(n) ? c.id : n, g = groundFixture(id), slot = LEAGUE_SLOTS[n % LEAGUE_SLOTS.length];
  const today = Math.floor(g.kick / 24) === dayNum, day = g.cup ? CUP_ROUNDS[cupRound(id)].day : slot.name.slice(0, 3), time = g.cup ? CUP_ROUNDS[cupRound(id)].time : slot.name.slice(4);
  return { n: id, home: g.home, away: g.away, kick: g.kick, seed: g.seed, cup: g.cup, when: today ? 'TODAY ' + time : `${day} ${time}`,
    short: `${clubShort(g.home)} v ${clubShort(g.away)}`, live: h >= g.kick && h < g.kick + MATCH_HOURS, open: h >= g.kick - GATES_EARLY && h < g.kick + MATCH_HOURS };
}
// a fixture at the ground by its id, league or cup: { home, away, kick, seed, cup (the round's name, or null) }
function groundFixture(n) {
  if (n >= 0) { const [home, away] = groundPair(n); return { home, away, kick: slotHour(n), seed: fixtureSeed(n, groundPairIndex(n)), cup: null }; }
  const S = cupSeason(n), r = cupRound(n), tie = cupTies(S, r)?.[cupGroundTie(S, r)] || ['yards', 'docks'];
  return { home: tie[0], away: tie[1], kick: cupKick(S, r), seed: cupSeed(S, r, cupGroundTie(S, r)), cup: CUP_ROUNDS[r].name };
}

// ===== the City Cup: the eight clubs drawn into a knockout every season, alongside the league. Quarter-finals on the
// Thursday night of the season's second week, semis two weeks on, the final on the Sunday afternoon of the sixth week,
// always at the Yards. One tie of each round is played at the ground; level at full time, it goes to penalties.
const CUP_ROUNDS = [{ name: 'Cup quarter-final', short: 'QF', week: 1, day: 'THU', time: '19:30', tod: 19.5 },
  { name: 'Cup semi-final', short: 'SF', week: 3, day: 'THU', time: '19:30', tod: 19.5 },
  { name: 'Cup final', short: 'F', week: 5, day: 'SUN', time: '15:00', tod: 15 }];
const CUP_DAYS = [3, 3, 6], SEASON_SLOTS = () => (MatchEngine.CLUBS.length - 1) * 2; // (days: Mon = 0)
// the season a slot or an hour belongs to (absolute: the league's own count starts where you came in)
const seasonOfHour = h => Math.floor(h / (7 * 24 * SEASON_SLOTS() / LEAGUE_SLOTS.length));
const cupKick = (S, r) => ((S * SEASON_SLOTS() / LEAGUE_SLOTS.length + CUP_ROUNDS[r].week) * 7 + CUP_DAYS[r]) * 24 + CUP_ROUNDS[r].tod;
const cupId = (S, r) => -(S * 3 + r + 1), cupSeason = id => Math.floor((-id - 1) / 3), cupRound = id => (-id - 1) % 3;
const cupSeed = (S, r, k) => ((S + 1) * 15485863 + r * 7919 + k * 104729) >>> 0;
const cupGroundTie = (S, r) => r === 2 ? 0 : Math.floor(hash(S, r, 4409) * (r ? 2 : 4));
// the draw for the quarter-finals (from the season), and who's in the later rounds once the one before is played
function cupDraw(S) {
  const r = MatchEngine.rng(cupSeed(S, 9, 0)), ids = MatchEngine.CLUBS.map(c => c.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return [0, 2, 4, 6].map(k => [ids[k], ids[k + 1]]);
}
function cupTies(S, r) {
  if (r === 0) return cupDraw(S);
  const prev = league.cup?.S === S ? league.cup.rounds[r - 1] : null;
  if (!prev || prev.length < (r === 1 ? 4 : 2)) return null; // (not decided yet)
  const w = prev.map(t => t.winner);
  return r === 1 ? [[w[0], w[1]], [w[2], w[3]]] : [[w[0], w[1]]];
}
// the next cup tie at the ground not yet over, if its sides are known
function nextCupAtGround(h) {
  for (let S = seasonOfHour(h); S <= seasonOfHour(h) + 1; S++) for (let r = 0; r < 3; r++) {
    if (cupKick(S, r) + MATCH_HOURS <= h) continue;
    if (r > 0 && league.cup?.S !== S) return null; // (a cup that started before you came: wait for the next one)
    return cupTies(S, r) ? { id: cupId(S, r), kick: cupKick(S, r) } : null;
  }
  return null;
}
// a tie settled: from the match you watched, or a scoreline from the two sides' strength and, level, a shootout
function cupPens(seed, home, away) {
  const r = MatchEngine.rng(seed ^ 0x5bd1e995), g = [0, 0], t = [0, 0];
  for (let k = 0; k < 40; k++) {
    const side = k % 2; t[side]++; if (r() < .74) g[side]++;
    if (t[0] <= 5 && t[1] <= 5 && (g[0] + 5 - t[0] < g[1] || g[1] + 5 - t[1] < g[0])) break;
    if (t[0] >= 5 && t[0] === t[1] && g[0] !== g[1]) break;
  }
  return g;
}
function playCupRound(S, r) {
  if (r === 0) league.cup = { S, rounds: [] };
  else if (league.cup?.S !== S) return;
  const ties = cupTies(S, r); if (!ties) return;
  const id = cupId(S, r), ground = cupGroundTie(S, r), out = [];
  ties.forEach(([home, away], k) => {
    const m = k === ground && stadiumMatch && stadiumMatch.slot === id ? stadiumMatch : null;
    let score, pens = null;
    if (m) { while (m.phase !== 'ft') MatchEngine.tick(m); const res = MatchEngine.result(m); score = res.score; pens = res.pens; if (m.attended && r < 2) footballNews('match', { home, away, score, pens, scorers: res.scorers, cup: CUP_ROUNDS[r].name }); }
    else { score = quickScore(home, away, cupSeed(S, r, k)); if (score[0] === score[1]) pens = cupPens(cupSeed(S, r, k), home, away); }
    const winner = (pens ? pens[0] > pens[1] : score[0] > score[1]) ? home : away;
    out.push({ home, away, score, pens, winner });
    league.results.push({ n: k === ground ? id : id * 10 - k, home, away, score, pens, cup: CUP_ROUNDS[r].short }); if (league.results.length > 40) league.results.shift();
    if (k === ground) settleBets(id, home, away, score); // (stadium-extras.js: a bet's on the ninety minutes)
  });
  league.cup.rounds[r] = out;
  if (r === 2) { league.cup.winner = league.cupHolder = out[0].winner; const f = out[0]; footballNews('cupfinal', { home: f.home, away: f.away, score: f.score, pens: f.pens, winner: f.winner }); }
}
const stadiumGatesOpen = () => stadiumNextFixture().open;
const stadiumMatchLive = () => stadiumNextFixture().live;
// the football in the papers (notoriety.js): the cup final, the league's champions, a match you were at, and now and
// then a thrashing somewhere. Filed from the ground (it reads as at the Yards)
function footballNews(kind, extra) {
  if (typeof newsEvent !== 'function') return;
  const B = typeof stadiumBounds === 'function' && STADIUM_SITE?.sh ? stadiumBounds() : null;
  newsEvent(kind, B ? (B.x0 + B.x1) / 2 : px, B ? (B.y0 + B.y1) / 2 : py, extra);
}
// a result into the table
function recordResult(n, home, away, score, scorers = []) {
  for (const id of [home, away]) league.table[id] ||= { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  const H = league.table[home], A = league.table[away], [h, a] = score;
  H.p++; A.p++; H.gf += h; H.ga += a; A.gf += a; A.ga += h;
  if (h > a) { H.w++; A.l++; H.pts += 3; } else if (h < a) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  league.results.push({ n, home, away, score, scorers: scorers.slice(0, 8) }); if (league.results.length > 40) league.results.shift();
  settleBets(n, home, away, score); // (stadium-extras.js)
}
// a match played elsewhere (or one at the ground nobody watched): a scoreline from the two sides' strength, goals
// as a Poisson count, the home side a little ahead. Cheap: a full simulation is kept for the match you watch
function quickScore(home, away, seed) {
  const r = MatchEngine.rng(seed), rate = id => MatchEngine.CLUBS.find(c => c.id === id)?.rating ?? .55;
  const poisson = l => { let k = 0, p = Math.exp(-l), s = p, u = r(); while (u > s && k < 9) { k++; p *= l / k; s += p; } return k; };
  const dh = rate(home) - rate(away);
  return [poisson(clamp(1.75 + dh * 4, .5, 3.6)), poisson(clamp(1.4 - dh * 4, .4, 3.2))];
}
// bring the league up to date: every slot whose matches are over gets its results (the ground's own match from the
// one you watched, if you did). A new league starts at the next fixture; a new season after the last round.
function updateLeague() {
  const h = nowHour();
  if (league.played < 0 && !Object.keys(league.table).length) { // (a new league: it starts from here, not from day one)
    const n = slotAt(h); league.played = n < 0 ? -1 : slotHour(n) + MATCH_HOURS <= h ? n : n - 1;
    if (league.played < 0 && slotHour(0) + MATCH_HOURS > h) league.played = -1;
  }
  for (let guard = 0; guard < 60 && slotHour(league.played + 1) + MATCH_HOURS <= h; guard++) {
    const n = league.played + 1, pairs = roundPairs(roundOf(n)), ground = groundPair(n);
    pairs.forEach(([home, away], k) => {
      const atGround = home === ground[0] && away === ground[1], m = atGround && stadiumMatch && stadiumMatch.slot === n ? stadiumMatch : null;
      if (m) { while (m.phase !== 'ft') MatchEngine.tick(m); const r = MatchEngine.result(m); recordResult(n, home, away, r.score, r.scorers.map(s => s.player)); if (m.attended) footballNews('match', { home, away, score: r.score, scorers: r.scorers }); } // (the one you saw)
      else { const score = quickScore(home, away, fixtureSeed(n, k)); recordResult(n, home, away, score); if (Math.abs(score[0] - score[1]) >= 4 && hash(n, k, 5011) < .5) footballNews('thrashing', { home, away, score }); }
    });
    league.played = n;
    if (roundOf(n + 1) === 0) { const top = leagueTable()[0]; if (top?.p) footballNews('champions', { club: top.id, pts: top.pts, season: league.season }); league.season++; league.table = {}; } // (a new season: the table starts again)
  }
  // the cup: every round over by now, in order (a new league starts with the next cup to begin, not one under way)
  const cOver = c => cupKick(Math.floor(c / 3), c % 3) + MATCH_HOURS <= h;
  if (league.cupPlayed == null) { let c = seasonOfHour(h) * 3 - 1; while (cOver(c + 1)) c++; league.cupPlayed = c; }
  for (let guard = 0; guard < 12 && cOver(league.cupPlayed + 1); guard++) { const c = ++league.cupPlayed; playCupRound(Math.floor(c / 3), c % 3); }
}
// the table, sorted: points, goal difference, goals scored
const leagueTable = () => MatchEngine.CLUBS.map(c => ({ id: c.id, name: c.name, short: c.short, ...(league.table[c.id] || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }) }))
  .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
// the match at the ground right now, caught up to the city clock (you walk in at the minute it's reached)
function stadiumLiveMatch() {
  const f = stadiumNextFixture();
  if (!stadiumMatch || stadiumMatch.slot !== f.n) {
    stadiumMatch = MatchEngine.create({ home: f.home, away: f.away, seed: f.seed, knockout: !!f.cup });
    stadiumMatch.slot = f.n; stadiumMatch.kick = f.kick; stadiumMatch.cup = f.cup; stadiumMatch.crowd = (f.cup ? .75 : .55) + hash(f.n, 3, 2321) * (f.cup ? .2 : .3); // (a decent gate: plenty of empty seats about)
  }
  const m = stadiumMatch, progress = clamp((nowHour() - f.kick) / MATCH_HOURS, 0, 1);
  if (progress > 0) { const target = progress * stadiumPlaySeconds(m); while (m.t < target && m.phase !== 'ft') MatchEngine.tick(m); }
  return m;
}
const groundPairIndex = n => { const g = groundPair(n); return roundPairs(roundOf(n)).findIndex(p => p[0] === g[0] && p[1] === g[1]); };
// how many seconds of play a whole match takes, half time included (for pacing the city clock to it)
const stadiumPlaySeconds = m => m.minutes * 60 + 4 + 8;
// the save: the league goes with you
const leagueSave = () => league;
function leagueLoad(d) { if (d && typeof d === 'object' && d.table) league = { played: d.played ?? -1, table: d.table, results: d.results || [], season: d.season || 1, bets: Array.isArray(d.bets) ? d.bets.slice(0, 8) : [], seasonTicket: d.seasonTicket ?? null,
  cup: d.cup && typeof d.cup === 'object' && Array.isArray(d.cup.rounds) ? d.cup : null, cupPlayed: Number.isInteger(d.cupPlayed) ? d.cupPlayed : null, cupHolder: typeof d.cupHolder === 'string' ? d.cupHolder : null }; }

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
// the next fixture at the ground (now, if it's on): { n, when, short, home, away, kick (hours), live, open }
function stadiumNextFixture() {
  const h = nowHour(); let n = Math.max(0, slotAt(h));
  if (slotHour(n) + MATCH_HOURS <= h) n++; // (that one's over: the next)
  const [home, away] = groundPair(n), kick = slotHour(n), slot = LEAGUE_SLOTS[n % LEAGUE_SLOTS.length];
  const today = Math.floor(kick / 24) === dayNum, when = (today ? 'TODAY ' + slot.name.slice(4) : slot.name);
  return { n, home, away, kick, when, short: `${clubShort(home)} v ${clubShort(away)}`, live: h >= kick && h < kick + MATCH_HOURS, open: h >= kick - GATES_EARLY && h < kick + MATCH_HOURS };
}
const stadiumGatesOpen = () => stadiumNextFixture().open;
const stadiumMatchLive = () => stadiumNextFixture().live;
// a result into the table
function recordResult(n, home, away, score, scorers = []) {
  for (const id of [home, away]) league.table[id] ||= { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  const H = league.table[home], A = league.table[away], [h, a] = score;
  H.p++; A.p++; H.gf += h; H.ga += a; A.gf += a; A.ga += h;
  if (h > a) { H.w++; A.l++; H.pts += 3; } else if (h < a) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  league.results.push({ n, home, away, score, scorers: scorers.slice(0, 8) }); if (league.results.length > 40) league.results.shift();
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
      if (m) { while (m.phase !== 'ft') MatchEngine.tick(m); const r = MatchEngine.result(m); recordResult(n, home, away, r.score, r.scorers.map(s => s.player)); } // (the one you saw)
      else recordResult(n, home, away, quickScore(home, away, fixtureSeed(n, k)));
    });
    league.played = n;
    if (roundOf(n + 1) === 0) { league.season++; league.table = {}; } // (a new season: the table starts again)
  }
}
// the table, sorted: points, goal difference, goals scored
const leagueTable = () => MatchEngine.CLUBS.map(c => ({ id: c.id, name: c.name, short: c.short, ...(league.table[c.id] || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }) }))
  .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
// the match at the ground right now, caught up to the city clock (you walk in at the minute it's reached)
function stadiumLiveMatch() {
  const f = stadiumNextFixture();
  if (!stadiumMatch || stadiumMatch.slot !== f.n) {
    stadiumMatch = MatchEngine.create({ home: f.home, away: f.away, seed: fixtureSeed(f.n, groundPairIndex(f.n)) });
    stadiumMatch.slot = f.n; stadiumMatch.kick = f.kick; stadiumMatch.crowd = .8 + hash(f.n, 3, 2321) * .17;
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
function leagueLoad(d) { if (d && typeof d === 'object' && d.table) league = { played: d.played ?? -1, table: d.table, results: d.results || [], season: d.season || 1 }; }

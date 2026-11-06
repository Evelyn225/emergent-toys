// ===== the football match engine (STADIUM_PLAN.md): a whole match of eleven against eleven, simulated from the ball,
// the players and the rules, deterministic for a seed, headless (no drawing here; the stadium draws from it). Physics
// runs at real speed in metres and seconds; the match clock runs faster (90 minutes over `minutes` of play), the way
// football games do it. Pitch: x along its length, y across, origin on the centre spot; the home side attacks +x in the
// first half. Everything here is inside MatchEngine so nothing leaks into the city's globals.
const MatchEngine = (() => {
  const PITCH = { hl: 52.5, hw: 34, goalHW: 3.66, goalH: 2.44, boxD: 16.5, boxHW: 20.16, sixD: 5.5, sixHW: 9.16, spot: 11, circle: 9.15 };
  const DT = 0.05, G = 9.8, BALL_R = 0.11;
  const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const clampN = (v, a, b) => v < a ? a : v > b ? b : v, hyp = Math.hypot;
  const SURNAMES = ['Okafor', 'Novak', 'Ruiz', 'Tanaka', 'Murphy', 'Haddad', 'Silva', 'Kowalski', 'Nguyen', 'Mensah', 'Rossi', 'Petrov', 'Byrne', 'Osei', 'Lindqvist',
    'Moreau', 'Cohen', 'Achebe', 'Park', 'Fischer', 'Duarte', 'Yilmaz', 'Brennan', 'Costa', 'Ivanov', 'Kamara', 'Sato', 'Walsh', 'Ferreira', 'Diallo', 'Hughes',
    'Bakker', 'Lopez', 'Kim', 'Adeyemi', 'Romano', 'Horvat', 'Quinn', 'Mbeki', 'Dubois', 'Jansen', 'Vargas', 'Chen', 'Okonkwo', 'Sorensen', 'Reyes', 'Gallo', 'Doyle'];
  // the clubs: one a neighbourhood, kit colours as palette names (the stadium maps them to colours)
  const CLUBS = [
    { id: 'yards', name: 'Yards Athletic', short: 'YAR', kit: ['RED', 'WHITE'], rating: .62, formation: '442' },
    { id: 'docks', name: 'Docks United', short: 'DOC', kit: ['BLUE', 'WHITE'], rating: .58, formation: '433' },
    { id: 'midtown', name: 'Midtown Rovers', short: 'MID', kit: ['GREEN', 'WHITE'], rating: .55, formation: '4231' },
    { id: 'chinatown', name: 'Chinatown Dragons', short: 'CHI', kit: ['YEL', 'RED'], rating: .57, formation: '433' },
    { id: 'brownstones', name: 'Brownstone Albion', short: 'BRO', kit: ['BRICK', 'WHITE'], rating: .53, formation: '442' },
    { id: 'downtown', name: 'Downtown City', short: 'DTC', kit: ['CYAN', 'BLUE'], rating: .66, formation: '4231' },
    { id: 'shotengai', name: 'Shotengai Stars', short: 'SHO', kit: ['MAG', 'WHITE'], rating: .5, formation: '433' },
    { id: 'belle', name: 'Belle Epoque', short: 'BEL', kit: ['WHITE', 'GRAY'], rating: .54, formation: '442' },
  ];
  // formation slots: [role, depth 0 (own goal) .. 1 (theirs), width -1 .. 1]; slot 0 is the keeper
  const FORMATIONS = {
    442: [['GK', 0, 0], ['DF', .1, -.78], ['DF', .06, -.27], ['DF', .06, .27], ['DF', .1, .78], ['MF', .48, -.8], ['MF', .42, -.25], ['MF', .42, .25], ['MF', .48, .8], ['FW', .9, -.22], ['FW', .9, .22]],
    433: [['GK', 0, 0], ['DF', .1, -.78], ['DF', .06, -.27], ['DF', .06, .27], ['DF', .1, .78], ['MF', .38, -.42], ['MF', .34, 0], ['MF', .38, .42], ['FW', .86, -.7], ['FW', .94, 0], ['FW', .86, .7]],
    4231: [['GK', 0, 0], ['DF', .1, -.78], ['DF', .06, -.27], ['DF', .06, .27], ['DF', .1, .78], ['MF', .3, -.25], ['MF', .3, .25], ['MF', .64, -.72], ['MF', .62, 0], ['MF', .64, .72], ['FW', .94, 0]],
  };
  const TUNE = { // (calibrated against §3.6 of STADIUM_PLAN.md: see test/city-match-engine.test.cjs)
    think: .22, shotXg: .09, shotBias: 1, crossBase: .3, homeBoost: .017, passRisk: 2.2, dribbleSpace: 5.5, tackleRange: 1.25, foulBase: .2,
    control: .84, passErr: .07, shotErr: .3, keeperReach: 1.5, keeperReact: .3, keeperBase: .62, block: .32, recvReach: 2,
  };
  const BOARD = { full: 90 * 60 };

  function makePlayer(club, k, role, r, seedName) {
    const base = club.rating, v = (lo = -.12, hi = .12) => clampN(base + lo + r() * (hi - lo), .2, .97);
    const p = {
      team: null, slot: k, role, number: k === 0 ? 1 : [0, 2, 5, 6, 3, 7, 8, 4, 11, 9, 10][k] || k + 1, name: seedName,
      pos: [0, 0], vel: [0, 0], face: [1, 0], stamina: 1, target: [0, 0], urgency: .5, nextThink: 0, job: 'shape', carded: 0, off: false,
      attrs: { pace: v(), accel: v(), control: v(), passing: v(), shooting: v(), tackling: v(), heading: v(), positioning: v(), vision: v(), gk: role === 'GK' ? v(.05, .25) : v(-.4, -.2) },
    };
    if (role === 'DF') { p.attrs.tackling = clampN(p.attrs.tackling + .12, .2, .97); p.attrs.heading = clampN(p.attrs.heading + .1, .2, .97); p.attrs.shooting -= .12; }
    if (role === 'FW') { p.attrs.shooting = clampN(p.attrs.shooting + .14, .2, .97); p.attrs.tackling -= .15; p.attrs.pace = clampN(p.attrs.pace + .06, .2, .97); }
    if (role === 'MF') { p.attrs.passing = clampN(p.attrs.passing + .1, .2, .97); p.attrs.vision = clampN(p.attrs.vision + .08, .2, .97); }
    return p;
  }
  function makeTeam(club, side, r) {
    if (side === 0) club = { ...club, rating: club.rating + TUNE.homeBoost }; // (the home crowd behind them)
    const used = new Set(), name = () => { let n; do n = SURNAMES[r() * SURNAMES.length | 0]; while (used.has(n) && used.size < SURNAMES.length); used.add(n); return n; };
    const slots = FORMATIONS[club.formation];
    const t = { club, side, name: club.name, short: club.short, kit: club.kit, formation: club.formation, score: 0, subsLeft: 3,
      players: slots.map(([role], k) => makePlayer(club, k, role, r, name())),
      bench: ['GK', 'DF', 'MF', 'MF', 'FW'].map((role, k) => makePlayer(club, 11 + k, role, r, name())) };
    t.bench.forEach((p, k) => { p.number = 12 + k; });
    for (const p of [...t.players, ...t.bench]) p.team = t;
    return t;
  }

  // ---- a new match: { home, away } clubs (or ids), seed, minutes of play for the 90 (default 12)
  function create(opts = {}) {
    const club = c => typeof c === 'string' ? CLUBS.find(k => k.id === c) : c;
    const seed = opts.seed ?? 1, r = rng(seed);
    const m = {
      seed, r, t: 0, minutes: opts.minutes ?? 12, period: 1, phase: 'kickoff', phaseT: 0, stoppage: [0, 0], added: [0, 0],
      ball: { p: [0, 0, BALL_R], v: [0, 0, 0], owner: null, lastTouch: null, lastKick: null, kickT: -9 },
      events: [], stats: [{ shots: 0, onTarget: 0, poss: 0, passes: 0, passesDone: 0, fouls: 0, corners: 0, offsides: 0, yellow: 0, red: 0, saves: 0 }, null],
      restart: null, pendingPass: null, advantage: null, celebrate: null, replay: [], diag: {},
    };
    m.stats[1] = { ...m.stats[0] };
    m.teams = [makeTeam(club(opts.home ?? 'yards'), 0, r), makeTeam(club(opts.away ?? 'docks'), 1, r)];
    m.ref = { pos: [-10, 15], vel: [0, 0], face: [1, 0] };
    kickoff(m, 0);
    log(m, 'kickoff', 0);
    return m;
  }
  const clockScale = m => BOARD.full / (m.minutes * 60); // match seconds per second of play
  const minute = m => m.t * clockScale(m) / 60; // the match clock, minutes
  const dirOf = (m, team) => (team.side === 0 ? 1 : -1) * (m.period === 2 ? -1 : 1); // which way a team attacks (+x / -x)
  const onPitch = team => team.players.filter(p => !p.off);
  const opp = (m, team) => m.teams[1 - team.side];
  const diag = (m, k) => { m.diag[k] = (m.diag[k] || 0) + 1; };
  const log = (m, kind, side, extra = {}) => m.events.push({ t: Math.min(m.period === 1 ? 45 : 90, minute(m)), min: minute(m), period: m.period, kind, side, ...extra });

  // ---- restarts: where everyone goes, who takes it, after how long
  function kickoff(m, side, place = true) { // (place: lined up already, at the start of a half; after a goal they walk back)
    m.phase = 'restart'; m.restart = { type: 'kickoff', side, at: [0, 0], wait: place ? 2.5 : 4 }; m.ball.owner = null;
    m.ball.p = [0, 0, BALL_R]; m.ball.v = [0, 0, 0];
    if (place) for (const team of m.teams) for (const p of onPitch(team)) { const s = slotPos(m, team, p, 0, false, true); p.pos = s.slice(); p.vel = [0, 0]; }
    const team = m.teams[side], taker = onPitch(team).filter(p => p.role === 'FW').sort((a, b) => Math.abs(a.pos[1]) - Math.abs(b.pos[1]))[0] || onPitch(team)[9];
    m.restart.taker = taker; if (place) taker.pos = [-dirOf(m, team) * .4, 0];
  }
  function setRestart(m, type, side, at, extra = {}) {
    m.phase = 'restart'; m.ball.owner = null; m.ball.v = [0, 0, 0];
    m.ball.p = [at[0], at[1], BALL_R];
    const team = m.teams[side], ds = onPitch(team).filter(p => type === 'goalkick' ? p.role === 'GK' : p.role !== 'GK');
    const taker = extra.taker || ds.sort((a, b) => hyp(a.pos[0] - at[0], a.pos[1] - at[1]) - hyp(b.pos[0] - at[0], b.pos[1] - at[1]))[0];
    m.restart = { type, side, at, taker, wait: { throwin: 1.6, corner: 3.2, goalkick: 2.4, freekick: 2.6, penalty: 3.5, kickoff: 2 }[type] || 2, ...extra };
    m.pendingPass = null;
  }

  // ---- team shape: where a player's slot puts them now (team's attacking frame, then back to pitch coords)
  function slotPos(m, team, p, ballX, inPoss, kickoffShape = false) {
    const dir = dirOf(m, team), [role, depth, width] = FORMATIONS[team.formation][p.slot];
    const bx = ballX * dir; // ball in the team's attacking frame
    let defLine, fwdLine, spread, shift = 0;
    if (kickoffShape) { defLine = -38; fwdLine = -2; spread = .8; }
    else if (inPoss) { defLine = clampN(bx - 26, -40, 16); fwdLine = clampN(bx + 14, -6, 46); spread = .92; }
    else { defLine = clampN(bx - 16, -45, 4); fwdLine = defLine + 30; spread = .62; shift = clampN(m.ball.p[1] * .35, -10, 10); }
    if (role === 'GK') {
      const gx = -PITCH.hl + clampN((bx + PITCH.hl) * .12, 1, inPoss ? 18 : 12);
      return [gx * dir, clampN(m.ball.p[1] * .14, -3, 3)];
    }
    let x = defLine + depth * (fwdLine - defLine), y = width * PITCH.hw * spread + shift;
    if (kickoffShape) x = Math.min(x, -1.5);
    return [clampN(x, -PITCH.hl + 3, PITCH.hl - 3) * dir, clampN(y, -PITCH.hw + 1.5, PITCH.hw - 1.5)];
  }

  // ---- ball physics
  function stepBall(m, dt) {
    const b = m.ball;
    if (b.owner) { // at the carrier's feet, a little ahead of them, bobbing with their stride
      const p = b.owner, sp = hyp(p.vel[0], p.vel[1]), lead = .45 + sp * .05;
      const want = [p.pos[0] + p.face[0] * lead, p.pos[1] + p.face[1] * lead], ex = want[0] - b.p[0], ey = want[1] - b.p[1], e = hyp(ex, ey), k = e > .25 ? Math.min(1, 9 * dt / e) : 1;
      b.p = [b.p[0] + ex * k, b.p[1] + ey * k, Math.max(BALL_R, b.p[2] - 6 * dt)]; b.v = [p.vel[0], p.vel[1], 0]; // (taken in: it glides to their feet, no snapping)
      return;
    }
    const v = b.v, sp = hyp(v[0], v[1], v[2]), drag = .0075 * sp;
    v[0] -= v[0] * drag * dt; v[1] -= v[1] * drag * dt; v[2] -= v[2] * drag * dt + G * dt;
    if (b.spin) { v[0] += -v[1] * b.spin * dt; v[1] += v[0] * b.spin * dt; b.spin *= 1 - dt * .6; }
    b.p[0] += v[0] * dt; b.p[1] += v[1] * dt; b.p[2] += v[2] * dt;
    if (b.p[2] <= BALL_R) { // on the grass: a bounce, or rolling
      b.p[2] = BALL_R;
      if (v[2] < -1.2) { v[2] = -v[2] * .52; v[0] *= .86; v[1] *= .86; }
      else {
        v[2] = 0; const h = hyp(v[0], v[1]);
        if (h > 0) { const k = Math.max(0, h - 1.6 * dt) / h; v[0] *= k; v[1] *= k; }
      }
    }
  }
  // where the ball will be in t seconds, roughly (rolling or flying; no bounces): for interceptions
  function ballAt(m, t) {
    const b = m.ball;
    if (b.owner) return [b.p[0], b.p[1], b.p[2]];
    const [vx, vy, vz] = b.v, h = hyp(vx, vy);
    if (b.p[2] > BALL_R + .05 || vz > .5) { // flying: ballistic
      let z = b.p[2] + vz * t - G * t * t / 2;
      return [b.p[0] + vx * t * (1 - .004 * h * t), b.p[1] + vy * t * (1 - .004 * h * t), Math.max(BALL_R, z)];
    }
    const stop = h / 1.9, tt = Math.min(t, stop), d = h * tt - .95 * tt * tt; // rolling: drag and friction, lumped
    return h > 0 ? [b.p[0] + vx / h * d, b.p[1] + vy / h * d, BALL_R] : [b.p[0], b.p[1], BALL_R];
  }
  // how long a player needs to get to a point
  const reachTime = (p, x, y) => {
    const d = hyp(x - p.pos[0], y - p.pos[1]), top = topSpeed(p), acc = 3 + p.attrs.accel * 2.2;
    const tAcc = top / acc, dAcc = top * tAcc / 2;
    return d < dAcc ? Math.sqrt(2 * d / acc) : tAcc + (d - dAcc) / top;
  };
  const topSpeed = p => (6.6 + p.attrs.pace * 2.4) * (.72 + .28 * p.stamina);
  // the earliest a player can meet the ball, and where (null if not within 3 s)
  function intercept(m, p) {
    for (let t = 0; t <= 3; t += .1) {
      const q = ballAt(m, t);
      if (q[2] > 2.2) continue;
      if (reachTime(p, q[0], q[1]) <= t + .05) return { t, at: q };
    }
    return null;
  }

  // ---- kicks: a pass along the ground or in the air, a shot, a clearance. Errors from skill and pressure
  function kick(m, p, tx, ty, opts = {}) {
    const b = m.ball, r = m.r, dx = tx - b.p[0], dy = ty - b.p[1], d = hyp(dx, dy) || 1;
    const pressure = nearestOpp(m, p).d < 2.5 ? 1 : 0;
    const skill = opts.shot ? p.attrs.shooting : p.attrs.passing;
    const err = (opts.shot ? TUNE.shotErr : TUNE.passErr) * (1.25 - skill) * (1 + pressure * .7) * (opts.loft ? 1.4 : 1) * (1 + d / 60);
    const ang = Math.atan2(dy, dx) + (r() - .5) * 2 * err, spErr = 1 + (r() - .5) * err * 2.2;
    let h, vz = 0;
    if (opts.shot) { h = (opts.power || 24) * spErr; vz = opts.vz ?? (r() * 4 + 1); }
    else if (opts.loft) { const tf = clampN(d / 19, .8, 2.4); h = d / tf * spErr; vz = G * tf / 2 * (opts.flat ? .6 : 1); }
    else { h = Math.min(28, Math.sqrt(2 * 1.75 * d + 49 + d * d * .012)) * spErr; } // (weighted to arrive at about 7 m/s: rolling friction, and drag on the longer ones)
    b.owner = null; b.v = [Math.cos(ang) * h, Math.sin(ang) * h, vz]; b.spin = opts.curl || 0;
    b.lastTouch = p; b.lastKick = { by: p, t: m.t, to: opts.to || null, shot: !!opts.shot, at: [b.p[0], b.p[1]] };
    p.nextThink = m.t + .5; // (watching it go)
    if (opts.to) { // the receiver comes to meet it, the way a player shows for the ball
      const t = opts.to, c = intercept(m, t);
      t.receive = { at: c ? [c.at[0], c.at[1]] : [tx, ty], until: m.t + (c ? c.t + .6 : 2.5) }; t.target = t.receive.at.slice(); t.urgency = 1; t.job = 'receive'; t.nextThink = m.t;
    }
    if (!opts.shot && !opts.clear) { m.stats[p.team.side].passes++; m.pendingPass = { from: p, to: opts.to, t: m.t,  offside: offsideSet(m, p), kind: (opts.loft ? 'loft' : 'ground') + (d > 25 ? 'L' : 'S') + (opts.lead ? '+lead' : '') }; }
    else m.pendingPass = null;
  }
  function nearestOpp(m, p) {
    let best = null, bd = Infinity;
    for (const o of onPitch(opp(m, p.team))) { const d = hyp(o.pos[0] - p.pos[0], o.pos[1] - p.pos[1]); if (d < bd) { bd = d; best = o; } }
    return { p: best, d: bd };
  }
  // teammates offside at the moment of a pass: in the opponents' half, ahead of the ball and the second-last defender
  function offsideSet(m, passer) {
    const dir = dirOf(m, passer.team), xs = onPitch(opp(m, passer.team)).map(o => o.pos[0] * dir).sort((a, b) => b - a);
    const line = Math.max(xs[1] ?? 0, m.ball.p[0] * dir, 0), set = new Set();
    for (const p of onPitch(passer.team)) if (p !== passer && p.pos[0] * dir > line + .3) set.add(p);
    return set;
  }

  // ---- the value of having the ball at (x, y) for a team attacking `dir`: low at home, high in front of goal
  function threat(x, y, dir) {
    const ax = x * dir, toGoal = hyp(PITCH.hl - ax, y), central = 1 - Math.min(1, Math.abs(y) / PITCH.hw);
    return clampN((ax + PITCH.hl) / (2 * PITCH.hl), 0, 1) * .55 + Math.exp(-toGoal / 14) * .9 + central * .08;
  }
  // a rough expected-goals: distance, the angle the goal mouth subtends, the bodies in the way
  function xg(m, p, x, y) {
    const dir = dirOf(m, p.team), gx = PITCH.hl * dir, d = hyp(gx - x, y);
    if (d > 32) return 0;
    const a1 = Math.atan2(PITCH.goalHW - y, Math.abs(gx - x)), a2 = Math.atan2(-PITCH.goalHW - y, Math.abs(gx - x)), angle = Math.abs(a1 - a2);
    let blocked = 0;
    for (const o of onPitch(opp(m, p.team))) {
      if (o.role === 'GK') continue;
      const ox = o.pos[0] - x, oy = o.pos[1] - y, along = (ox * (gx - x) + oy * (-y)) / (d * d);
      if (along > 0 && along < 1) { const off = Math.abs(ox * (-y) - oy * (gx - x)) / d; if (off < 1.1) blocked += 1 - off / 1.1; }
    }
    return clampN(angle * angle * 1.15 + angle * .18, 0, .85) * Math.exp(-blocked * .9) * (.6 + p.attrs.shooting * .7);
  }
  // how likely a pass along the ground from the ball to (x, y) is cut out: each opponent's time to the lane against the ball's
  function passRisk(m, p, x, y, loft) {
    const bx = m.ball.p[0], by = m.ball.p[1], d = hyp(x - bx, y - by) || 1, speed = loft ? 18 : 8 + d * .1; // (a pass's average pace over its length)
    let risk = 0;
    for (const o of onPitch(opp(m, p.team))) {
      const ox = o.pos[0] - bx, oy = o.pos[1] - by, along = clampN((ox * (x - bx) + oy * (y - by)) / (d * d), 0, 1);
      if (loft && along < .85) continue; // (over their heads, until it comes down)
      const cx = bx + (x - bx) * along, cy = by + (y - by) * along, tBall = along * d / speed + .1, tO = reachTime(o, cx, cy) + .2 - (o.role === 'GK' ? .1 : 0);
      const lane = hyp(o.pos[0] - cx, o.pos[1] - cy);
      if (tO < tBall) risk = Math.max(risk, clampN((tBall - tO) * 1.4 + .3 - lane * .015, 0, 1));
    }
    return risk;
  }

  // ---- decisions: the player on the ball
  function decideCarrier(m, p) {
    const team = p.team, dir = dirOf(m, team), r = m.r, x = p.pos[0], y = p.pos[1], here = threat(x, y, dir);
    const press = nearestOpp(m, p), opts = [];
    // a shot
    const q = xg(m, p, x, y);
    if (q > .02) opts.push({ kind: 'shot', v: q * 6 * TUNE.shotBias + (q > TUNE.shotXg ? .05 : -.5) + (press.d < 1.8 && q > .05 ? .15 : 0) }); // (with someone closing in: hit it now)
    // passes: to feet, and into space ahead of a runner
    for (const t of onPitch(team)) {
      if (t === p) continue;
      const d = hyp(t.pos[0] - x, t.pos[1] - y);
      if (d < 5 || d > 55) continue;
      for (const lead of t.role === 'GK' ? [0] : [0, 1]) {
        const tx = clampN(t.pos[0] + (lead ? dir * (6 + t.attrs.pace * 6) : 0), -PITCH.hl + 1, PITCH.hl - 1), ty = clampN(t.pos[1] + (lead ? t.vel[1] * .4 : 0), -PITCH.hw + 1, PITCH.hw - 1);
        if (lead && (tx * dir < x * dir + 4)) continue;
        const loft = d > 32 || (lead && d > 20);
        // the race: does the receiver get there before any defender? (to feet they're already there)
        const bd = hyp(tx - x, ty - y), tArrive = loft ? clampN(bd / 19, .8, 2.4) : bd / 13, tMate = lead ? reachTime(t, tx, ty) : 0;
        let tOpp = Infinity; for (const o of onPitch(opp(m, team))) tOpp = Math.min(tOpp, reachTime(o, tx, ty) + .25);
        const first = Math.max(tArrive, tMate);
        if (lead && first > tOpp - .15) continue; // (they'd lose it: not worth playing)
        const race = clampN((tOpp - first) / 1.2, -1, 1);
        const risk = Math.max(passRisk(m, p, tx, ty, loft), race < 0 ? -race : 0), gain = threat(tx, ty, dir) - here;
        const open = Math.min(1, nearestOpp(m, { pos: [tx, ty], team }).d / 8);
        const back = 0, gkPass = t.role === 'GK' ? -.25 : 0;
        opts.push({ kind: 'pass', t, tx, ty, loft, lead, risk, v: gain * 1.7 + open * .2 - risk * TUNE.passRisk * (1.05 - p.attrs.passing * .4) + back + gkPass - (loft ? .08 : 0) });
      }
    }
    // a carry forward into space
    const fx = x + dir * 6, space = nearestOpp(m, { pos: [fx, y], team }).d;
    if (space > TUNE.dribbleSpace * .6 || p.attrs.control > .75) {
      const fy = y * .92, gain = threat(fx, fy, dir) - here;
      opts.push({ kind: 'carry', tx: fx, ty: fy, v: gain * 1.35 + Math.min(space, 12) * .018 - (space < 3 ? .3 : 0) + (p.role === 'DF' ? -.05 : 0) });
    }
    // out wide in the final third: a cross into the box, to whoever's attacking it
    if (x * dir > 20 && Math.abs(y) > 11) {
      const gx = PITCH.hl * dir, inBoxMates = onPitch(team).filter(t => t !== p && Math.abs(t.pos[0] - gx) < 20 && Math.abs(t.pos[1]) < 15);
      if (inBoxMates.length) {
        const t = inBoxMates[r() * inBoxMates.length | 0], tx = gx - dir * clampN(Math.abs(t.pos[0] - gx), 5, 13), ty = t.pos[1] * .8;
        opts.push({ kind: 'cross', t, tx, ty, v: TUNE.crossBase + inBoxMates.length * .07 + (Math.abs(y) > 22 ? .08 : 0) - (press.d < 1.5 ? .1 : 0) });
      }
    }
    // under pressure deep in their own half: clear it
    const ax = x * dir;
    if (press.d < 2.2 && ax < -25) opts.push({ kind: 'clear', v: .05 + (r() * .1) });
    // hold it: shield, turn away from the presser
    opts.push({ kind: 'hold', v: -.12 - (press.d < 1.6 ? .2 : 0) });
    // choose: the best, with a little noise (less for the more imaginative)
    const noise = .16 * (1.15 - p.attrs.vision);
    let best = null, bv = -Infinity;
    for (const o of opts) { const v = o.v + (r() - .5) * noise; if (v > bv) { bv = v; best = o; } }
    act(m, p, best);
  }
  function act(m, p, o) {
    const dir = dirOf(m, p.team), r = m.r;
    if (o.kind === 'shot') {
      const gx = PITCH.hl * dir, side = r() < .5 ? -1 : 1, gy = side * PITCH.goalHW * (.45 + r() * .45), d = hyp(gx - p.pos[0], p.pos[1]);
      m.stats[p.team.side].shots++;
      const vz = d < 14 ? r() * 3 + .2 : r() * 5 + .6;
      const xgv = +xg(m, p, p.pos[0], p.pos[1]).toFixed(3);
      kick(m, p, gx, gy, { shot: true, power: 20 + p.attrs.shooting * 9 + r() * 3, vz, curl: (r() - .5) * .25 });
      log(m, 'shot', p.team.side, { player: p.name, xg: xgv });
      const blocker = onPitch(opp(m, p.team)).find(o => o.role !== 'GK' && hyp(o.pos[0] - p.pos[0], o.pos[1] - p.pos[1]) < 3.2 && ((o.pos[0] - p.pos[0]) * (gx - p.pos[0]) + (o.pos[1] - p.pos[1]) * (gy - p.pos[1])) > 0);
      if (blocker && r() < TUNE.block) { // blocked: it cannons off them, often behind for a corner
        const b = m.ball; diag(m, 'shot:blocked');
        b.v = [b.v[0] * (r() < .5 ? .35 : -.25) , (r() - .5) * 14, 1 + r() * 4]; b.lastTouch = blocker; b.lastKick = { by: blocker, t: m.t };
        log(m, 'block', blocker.team.side, { player: blocker.name });
      }
    } else if (o.kind === 'pass') kick(m, p, o.tx, o.ty, { loft: o.loft, to: o.t, lead: o.lead });
    else if (o.kind === 'cross') { diag(m, 'cross'); kick(m, p, o.tx, o.ty, { loft: true, to: o.t, curl: (r() - .5) * .3 }); }
    else if (o.kind === 'clear') { kick(m, p, p.pos[0] + dir * 40, p.pos[1] * .5 + (r() - .5) * 30, { loft: true, clear: true }); }
    else if (o.kind === 'carry') { p.target = [o.tx, o.ty]; p.urgency = .85; p.job = 'carry'; }
    else { const pr = nearestOpp(m, p).p; p.target = pr ? [p.pos[0] - (pr.pos[0] - p.pos[0]) * .6, p.pos[1] - (pr.pos[1] - p.pos[1]) * .6] : p.pos.slice(); p.urgency = .35; p.job = 'hold'; }
  }

  // ---- decisions: everyone else
  function decideOffBall(m, p, ctx) {
    const team = p.team, dir = dirOf(m, team), b = m.ball, inPoss = ctx.poss === team, carrier = b.owner;
    p.job = 'shape'; p.urgency = .45;
    let tgt = slotPos(m, team, p, b.p[0], inPoss);
    if (p.role === 'GK') {
      // between the ball and the middle of the goal, off the line as the ball comes nearer
      const gx = -PITCH.hl * dir, dx = b.p[0] - gx, dy = b.p[1], d = hyp(dx, dy) || 1, out = clampN(d * .12, .6, inPoss ? 16 : 5.5);
      tgt = inPoss ? tgt : [gx + dx / d * out, dy / d * out];
      p.target = tgt; p.urgency = .8; return;
    }
    if (p.receive && m.t < p.receive.until && !carrier) { p.target = p.receive.at; p.urgency = 1; p.job = 'receive'; return; }
    p.receive = null;
    if (ctx.chaser[team.side] === p) { const c = ctx.chase[team.side]; p.target = [c.at[0], c.at[1]]; p.urgency = 1; p.job = 'chase'; return; }
    if (inPoss && carrier && carrier !== p) {
      const ax = p.pos[0] * dir, off = ctx.offsideLine[team.side];
      if (p.role === 'FW' || (p.role === 'MF' && p.slot % 2 === 0)) { // hold the line, and now and then run in behind
        tgt[0] = Math.min(tgt[0] * dir, off - .8) * dir;
        if (p.run && m.t < p.run.until) { tgt = p.run.to; p.urgency = 1; p.job = 'run'; }
        else if (carrier.face[0] * dir > .3 && m.r() < .08 && ax > off - 8) { p.run = { to: [(off + 14) * dir, clampN(p.pos[1] * .7, -25, 25)], until: m.t + 2.4 }; }
      }
      // the two nearest offer short options, out of the defenders' shadow
      if (ctx.support[team.side].includes(p)) {
        const ang = Math.atan2(p.pos[1] - carrier.pos[1], p.pos[0] - carrier.pos[0]);
        tgt = [carrier.pos[0] + Math.cos(ang) * 12 + dir * 3, clampN(carrier.pos[1] + Math.sin(ang) * 12, -PITCH.hw + 2, PITCH.hw - 2)];
        p.job = 'support';
      }
    } else if (!inPoss && carrier) {
      if (ctx.press[team.side][0] === p) { // close them down
        p.target = [carrier.pos[0] - dir * .6, carrier.pos[1]]; p.urgency = 1; p.job = 'press'; return;
      }
      if (ctx.press[team.side][1] === p) { // cover: between the carrier and the goal behind
        const gx = -PITCH.hl * dir; tgt = [carrier.pos[0] + (gx - carrier.pos[0]) * .18, carrier.pos[1] * .8]; p.urgency = .8; p.job = 'cover';
      }
      // in our box: mark the nearest attacker, goal-side
      if (Math.abs(p.pos[0] - (-PITCH.hl * dir)) < 28 && p.role === 'DF') {
        const near = onPitch(opp(m, team)).filter(o => o !== carrier && Math.abs(o.pos[0] - (-PITCH.hl * dir)) < 24)
          .sort((a, c) => hyp(a.pos[0] - p.pos[0], a.pos[1] - p.pos[1]) - hyp(c.pos[0] - p.pos[0], c.pos[1] - p.pos[1]))[0];
        if (near && hyp(near.pos[0] - p.pos[0], near.pos[1] - p.pos[1]) < 9) { tgt = [near.pos[0] - dir * 1.4, near.pos[1] * .94]; p.job = 'mark'; p.urgency = .8; }
      }
    }
    p.target = tgt;
  }

  // what the whole pitch looks like this think: who's on the ball, who chases a loose one, who presses, the offside lines
  function context(m) {
    const b = m.ball, ctx = { poss: b.owner ? b.owner.team : (b.lastTouch ? b.lastTouch.team : null), chaser: [null, null], chase: [null, null], press: [[], []], support: [[], []], offsideLine: [0, 0] };
    // a pass on its way: the receiver goes to meet it; a defender only goes for it if they'd get there first, else
    // they close the receiver down for when it arrives
    const pp = !b.owner && m.pendingPass, recv = pp?.to && !pp.to.off ? pp.to : null, tRecv = recv ? (intercept(m, recv)?.t ?? Infinity) : Infinity;
    for (const team of m.teams) {
      const dir = dirOf(m, team), xs = onPitch(opp(m, team)).map(o => o.pos[0] * dir).sort((a, c) => c - a);
      ctx.offsideLine[team.side] = Math.max(xs[1] ?? 0, 0, b.p[0] * dir);
      if (!b.owner) { // the quickest to a loose ball goes for it
        let best = null, bt = Infinity, bat = null;
        for (const p of onPitch(team)) { if (p.role === 'GK' && Math.abs(b.p[0] + PITCH.hl * dir) > 20) continue; const c = intercept(m, p); if (c && c.t < bt) { bt = c.t; best = p; bat = c; } }
        if (recv && team === recv.team) { const c = intercept(m, recv); if (c) { best = recv; bat = c; bt = c.t; } }
        else if (recv && best && bt > tRecv - .15) { bat = { at: [recv.receive?.at?.[0] ?? recv.pos[0], recv.receive?.at?.[1] ?? recv.pos[1]] }; } // (onto the receiver instead)
        if (best) { ctx.chaser[team.side] = best; ctx.chase[team.side] = bat; }
        else { const near = onPitch(team).filter(p => p.role !== 'GK').sort((a, c) => hyp(a.pos[0] - b.p[0], a.pos[1] - b.p[1]) - hyp(c.pos[0] - b.p[0], c.pos[1] - b.p[1]))[0]; ctx.chaser[team.side] = near; ctx.chase[team.side] = { at: ballAt(m, 1) }; }
      } else if (b.owner.team !== team) {
        ctx.press[team.side] = onPitch(team).filter(p => p.role !== 'GK').sort((a, c) => reachTime(a, b.p[0], b.p[1]) - reachTime(c, b.p[0], b.p[1])).slice(0, 2);
      } else {
        ctx.support[team.side] = onPitch(team).filter(p => p !== b.owner && p.role !== 'GK').sort((a, c) => hyp(a.pos[0] - b.p[0], a.pos[1] - b.p[1]) - hyp(c.pos[0] - b.p[0], c.pos[1] - b.p[1])).slice(0, 2);
      }
    }
    return ctx;
  }

  // ---- moving: steer for the target at the urgency's pace, accelerating and turning like a person
  function movePlayer(m, p, dt) {
    p.target[0] = clampN(p.target[0], -PITCH.hl - 2.5, PITCH.hl + 2.5); p.target[1] = clampN(p.target[1], -PITCH.hw - 2.5, PITCH.hw + 2.5); // (never off chasing a ball that's already out)
    const dx = p.target[0] - p.pos[0], dy = p.target[1] - p.pos[1], d = hyp(dx, dy);
    const top = topSpeed(p) * (p.job === 'carry' || p.job === 'hold' ? .82 : 1), want = d < .3 ? 0 : Math.min(top * p.urgency, d * 1.6);
    const wx = d > 0 ? dx / d * want : 0, wy = d > 0 ? dy / d * want : 0, acc = (3 + p.attrs.accel * 2.2) * dt;
    const ex = wx - p.vel[0], ey = wy - p.vel[1], e = hyp(ex, ey);
    if (e > acc) { p.vel[0] += ex / e * acc; p.vel[1] += ey / e * acc; } else { p.vel[0] = wx; p.vel[1] = wy; }
    p.pos[0] += p.vel[0] * dt; p.pos[1] += p.vel[1] * dt;
    const sp = hyp(p.vel[0], p.vel[1]);
    if (sp > .4) { p.face = [p.vel[0] / sp, p.vel[1] / sp]; }
    else { const bx = m.ball.p[0] - p.pos[0], by = m.ball.p[1] - p.pos[1], bd = hyp(bx, by) || 1; p.face = [bx / bd, by / bd]; }
    const effort = sp / topSpeed(p);
    p.stamina = clampN(p.stamina - (effort > .7 ? (effort - .7) * .0026 : -.00045) * dt * clockScale(m) / 7.5, .25, 1); // (over the 90 minutes, whatever the length of play)
  }

  // ---- the ball loose: who gets it, a keeper's save, a block
  function looseBall(m) {
    const b = m.ball, r = m.r;
    if (b.p[2] > 2.6) return;
    const pp = m.pendingPass;
    let best = null, bd = Infinity;
    for (const team of m.teams) for (const p of onPitch(team)) {
      const d = hyp(p.pos[0] - b.p[0], p.pos[1] - b.p[1]);
      const passing = pp && pp.from.team !== p.team && hyp(b.v[0], b.v[1]) > 7, reach = p.role === 'GK' && inBox(m, p.team, b.p[0], b.p[1]) ? TUNE.keeperReach + p.attrs.gk * 1.4 : passing ? .5 : pp && pp.to === p ? 1 : .75;
      if (d < reach && d < bd) {
        if (b.lastKick && b.lastKick.by === p && m.t - b.lastKick.t < .3) continue;
        if (pp && pp.from.team !== p.team && m.t - pp.t < .18) continue; // (it's past a presser on top of the passer before they can react)
        bd = d; best = p;
      }
    }
    // the receiver it was meant for, there to take it: theirs, unless a marker right on them nicks it
    if (pp?.to && !pp.to.off && best !== pp.to && hyp(pp.to.pos[0] - b.p[0], pp.to.pos[1] - b.p[1]) < TUNE.recvReach && b.p[2] < 1.4 && r() > .3) best = pp.to;
    if (!best) return;
    const sp = hyp(b.v[0], b.v[1], b.v[2]), shot = b.lastKick?.shot && b.lastKick.by.team !== best.team;
    if (best.role === 'GK' && shot) return keeperSave(m, best, sp);
    if (b.p[2] > 1.4 && best.role !== 'GK') { diag(m, 'header'); return header(m, best); }
    const cut = pp && pp.from.team !== best.team && sp > 7, ctrl = best.role === 'GK' && inBox(m, best.team, b.p[0], b.p[1]) ? .92 : clampN(TUNE.control + best.attrs.control * .2 - Math.max(0, sp - 14) * .03 - (b.p[2] > .6 ? .12 : 0) - (cut ? .25 : 0), .15, .97);
    if (r() < ctrl) gain(m, best);
    else { diag(m, 'touch:fail'); b.v[0] = b.v[0] * -.25 + (r() - .5) * 4; b.v[1] = b.v[1] * -.25 + (r() - .5) * 4; b.v[2] = Math.abs(b.v[2]) * .3 + r() * 1.5; b.lastTouch = best; b.lastKick = { by: best, t: m.t }; } // (a deflection, a heavy touch)
  }
  function gain(m, p) {
    const b = m.ball, pp = m.pendingPass;
    if (pp && pp.from.team === p.team && pp.offside?.has(p)) { // offside
      m.stats[p.team.side].offsides++; log(m, 'offside', p.team.side, { player: p.name });
      m.pendingPass = null; setRestart(m, 'freekick', 1 - p.team.side, [p.pos[0], p.pos[1]]); return;
    }
    if (pp) { if (pp.from.team === p.team) m.stats[p.team.side].passesDone++; diag(m, pp.from.team === p.team ? (pp.to === p ? 'pass:to' : 'pass:mate') : 'pass:cut'); diag(m, (pp.from.team === p.team ? 'ok:' : 'cut:') + pp.kind); m.pendingPass = null; }
    b.owner = p; b.lastTouch = p; b.v = [0, 0, 0]; p.nextThink = m.t + .12 + m.r() * .1; p.run = null; for (const t of m.teams) for (const q of t.players) q.receive = null;
  }
  function header(m, p) {
    const b = m.ball, r = m.r, dir = dirOf(m, p.team), gx = PITCH.hl * dir, d = hyp(gx - b.p[0], b.p[1]);
    m.pendingPass = null;
    if (r() > .35 + p.attrs.heading * .55) { b.v = [b.v[0] * .3 + (r() - .5) * 6, b.v[1] * .3 + (r() - .5) * 6, 2 + r() * 2]; b.lastTouch = p; b.lastKick = { by: p, t: m.t }; return; } // (a glance off them)
    if (d < 13 && Math.abs(b.p[1]) < 10) { // a header at goal
      m.stats[p.team.side].shots++; log(m, 'shot', p.team.side, { player: p.name, header: true });
      const gy = (r() - .5) * PITCH.goalHW * 1.6, h = 10 + p.attrs.heading * 6, ddx = gx - b.p[0], ddy = gy - b.p[1], dd = hyp(ddx, ddy);
      b.v = [ddx / dd * h, ddy / dd * h, -1 + r() * 3]; b.lastTouch = p; b.lastKick = { by: p, t: m.t, shot: true }; return;
    }
    // a defensive header away, or a nod down to a teammate
    const away = p.pos[0] * dir < 0 ? 1 : -.2;
    b.v = [dir * (8 + r() * 6) * (away > 0 ? 1 : .4), (r() - .5) * 10, 3 + r() * 3]; b.lastTouch = p; b.lastKick = { by: p, t: m.t };
  }
  function keeperSave(m, k, sp) {
    const b = m.ball, r = m.r, side = k.team.side, chance = clampN(TUNE.keeperBase + k.attrs.gk * .35 - Math.max(0, sp - 20) * .02 - (b.p[2] > 1.8 ? .1 : 0), .2, .95);
    diag(m, 'keeper:shot'); if (r() < chance) {
      m.stats[side].saves++; log(m, 'save', side, { player: k.name });
      if (sp < 21 && r() < .55) { gain(m, k); m.stats[1 - side].onTarget++; return; } // held
      const dir = dirOf(m, k.team); // parried: out wide, or back out into play
      if (r() < .55) b.v = [-dir * (4 + r() * 4), (b.p[1] >= 0 ? 1 : -1) * (4 + r() * 4), 2 + r() * 3]; // tipped round the post, or over: a corner
      else b.v = [dir * (3 + r() * 5), (b.p[1] >= 0 ? 1 : -1) * (5 + r() * 7), 1.5 + r() * 3]; // pushed back out
      b.lastTouch = k; b.lastKick = { by: k, t: m.t };
      m.stats[1 - side].onTarget++;
    }
  }
  const inBox = (m, team, x, y) => { const gx = -PITCH.hl * dirOf(m, team); return Math.abs(x - gx) < PITCH.boxD && Math.abs(y) < PITCH.boxHW; };

  // ---- tackles: the presser, once they're close enough
  function tackle(m, d, c) {
    const r = m.r, dir = dirOf(m, d.team), behind = (d.pos[0] - c.pos[0]) * dir < 0 && c.face[0] * -dir < .2;
    const win = clampN(.32 + d.attrs.tackling * .45 - c.attrs.control * .3, .08, .8), foul = TUNE.foulBase + (behind ? .12 : 0) + (1 - d.attrs.tackling) * .08;
    d.nextTackle = m.t + 1.1 + r();
    if (r() < foul) return commitFoul(m, d, c);
    diag(m, 'tackle'); if (r() < win) { diag(m, 'tackle:won');
      const b = m.ball; b.owner = null; b.lastTouch = d; b.lastKick = { by: d, t: m.t };
      if (r() < .5) gain(m, d); else { b.v = [(r() - .5) * 8, (r() - .5) * 8, 0]; }
      c.nextThink = m.t + .5;
    }
  }
  function commitFoul(m, d, c) {
    const r = m.r, side = d.team.side, at = [c.pos[0], c.pos[1]];
    m.stats[side].fouls++; log(m, 'foul', side, { player: d.name, on: c.name });
    // advantage: if the fouled side keeps a good attack going, play on
    if (r() < .25 && c.team === m.ball.owner?.team && (c.pos[0] * dirOf(m, c.team)) > 10) { log(m, 'advantage', c.team.side); return; }
    const sev = r();
    if (sev > .993 || (sev > .95 && d.carded)) { d.carded = 2; d.off = true; d.leaving = [d.pos[0], Math.sign(d.pos[1] || 1) * (PITCH.hw + 5)]; m.stats[side].red++; log(m, 'red', side, { player: d.name }); }
    else if (sev > .84) { d.carded = 1; m.stats[side].yellow++; log(m, 'yellow', side, { player: d.name }); }
    m.stoppage[m.period - 1] += .25;
    if (inBox(m, d.team, at[0], at[1])) { const gx = -PITCH.hl * dirOf(m, d.team); setRestart(m, 'penalty', c.team.side, [gx + Math.sign(-gx) * PITCH.spot, 0]); log(m, 'penalty', c.team.side); }
    else setRestart(m, 'freekick', c.team.side, at);
  }

  // ---- out of play, goals, the woodwork
  function checkBall(m) {
    const b = m.ball, x = b.p[0], y = b.p[1], z = b.p[2];
    if (m.pendingPass && (Math.abs(y) > PITCH.hw + BALL_R || Math.abs(x) > PITCH.hl + BALL_R)) diag(m, 'pass:out');
    if (Math.abs(y) > PITCH.hw + BALL_R) { // over the touchline: a throw to whoever didn't touch it last
      const side = 1 - (b.lastTouch?.team.side ?? 0);
      return setRestart(m, 'throwin', side, [clampN(x, -PITCH.hl + 1, PITCH.hl - 1), Math.sign(y) * PITCH.hw]);
    }
    if (Math.abs(x) <= PITCH.hl + BALL_R) return;
    const end = Math.sign(x), inMouth = Math.abs(y) < PITCH.goalHW - BALL_R && z < PITCH.goalH - BALL_R;
    // the posts and the bar: a ball just inside or outside them rattles back
    const post = Math.abs(Math.abs(y) - PITCH.goalHW) < .16 && z < PITCH.goalH, bar = Math.abs(z - PITCH.goalH) < .16 && Math.abs(y) < PITCH.goalHW;
    if ((post || bar) && Math.abs(x) < PITCH.hl + .4) {
      b.p[0] = end * (PITCH.hl - .2); b.v[0] = -b.v[0] * .6; if (bar) b.v[2] = -Math.abs(b.v[2]) * .5;
      log(m, 'woodwork', b.lastTouch?.team.side ?? 0, { player: b.lastTouch?.name }); return;
    }
    // which team defends this end
    const defending = m.teams.find(t => -PITCH.hl * dirOf(m, t) === end * PITCH.hl);
    if (inMouth) return goal(m, 1 - defending.side);
    if (b.lastKick?.shot) { log(m, 'miss', 1 - defending.side, { player: b.lastKick.by.name }); }
    if (b.lastTouch?.team === defending) { // a corner
      m.stats[1 - defending.side].corners++; log(m, 'corner', 1 - defending.side);
      return setRestart(m, 'corner', 1 - defending.side, [end * PITCH.hl, Math.sign(y || 1) * PITCH.hw]);
    }
    return setRestart(m, 'goalkick', defending.side, [end * (PITCH.hl - PITCH.sixD), Math.sign(y || 1) * PITCH.sixHW * .7]);
  }
  function goal(m, side) {
    const scorer = m.ball.lastKick?.by?.team.side === side ? m.ball.lastKick.by : m.ball.lastTouch, og = scorer && scorer.team.side !== side;
    m.teams[side].score++;
    if (m.ball.lastKick?.shot || og) m.stats[side].onTarget++;
    log(m, 'goal', side, { player: scorer?.name, og, score: [m.teams[0].score, m.teams[1].score] });
    m.stoppage[m.period - 1] += .6;
    m.phase = 'goal'; m.phaseT = m.t + 6; m.celebrate = { side, scorer: og ? null : scorer }; m.ball.owner = null; m.ball.v = [0, 0, 0]; m.pendingPass = null;
  }

  // ---- taking a restart: everyone into position, then the taker plays it
  function restartPositions(m) {
    const R = m.restart, team = m.teams[R.side], other = opp(m, team), dir = dirOf(m, team);
    for (const t of m.teams) for (const p of onPitch(t)) {
      if (p === R.taker) { p.target = [R.at[0] - (R.type === 'penalty' ? dir * 2 : R.type === 'throwin' ? 0 : dir * .6), R.at[1] - (R.type === 'throwin' ? Math.sign(R.at[1]) * .6 : 0)]; p.urgency = .9; continue; }
      let tgt = slotPos(m, t, p, R.at[0], t === team, R.type === 'kickoff');
      if (R.type === 'corner' && p.role !== 'GK') { // into the box: the tall ones attack, the defence marks; two stay out
        const gx = -PITCH.hl * dirOf(m, other), inBoxX = gx + Math.sign(-gx) * (3 + (p.slot % 4) * 2.5);
        if (t === team ? p.role !== 'DF' || p.slot === 2 || p.slot === 3 : true) tgt = [inBoxX, ((p.slot * 37) % 9 - 4) * 1.9];
      }
      if (R.type === 'penalty' && p.role !== 'GK') { const gx = -PITCH.hl * dirOf(m, other); tgt = [gx + Math.sign(-gx) * (19 + (p.slot % 3)), ((p.slot * 7) % 11 - 5) * 3]; }
      if (R.type === 'freekick' && t === other && p.role !== 'GK') { // ten yards back
        const dx = tgt[0] - R.at[0], dy = tgt[1] - R.at[1], d = hyp(dx, dy);
        if (d < 9.15) { tgt = [R.at[0] + (dx / (d || 1)) * 9.2, R.at[1] + (dy / (d || 1)) * 9.2]; }
      }
      if (p.role === 'GK' && t === other && (R.type === 'penalty')) tgt = [-PITCH.hl * dirOf(m, t), 0];
      p.target = tgt; p.urgency = .7;
    }
    m.ball.p = [R.at[0], R.at[1], BALL_R]; m.ball.v = [0, 0, 0];
  }
  function takeRestart(m) {
    const R = m.restart, p = R.taker, team = m.teams[R.side], dir = dirOf(m, team), r = m.r;
    if (hyp(p.pos[0] - R.at[0], p.pos[1] - R.at[1]) > 2.6) { p.pos = [R.at[0] - dir * .5, R.at[1]]; } // (only after a long wait: a last resort)
    p.vel = [0, 0];
    m.phase = 'play'; m.restart = null; m.ball.owner = null; m.ball.p = [R.at[0], R.at[1], R.type === 'throwin' ? 1.9 : BALL_R];
    const mates = onPitch(team).filter(t => t !== p && t.role !== 'GK');
    const pick = f => mates.filter(f).sort((a, c) => hyp(a.pos[0] - R.at[0], a.pos[1] - R.at[1]) - hyp(c.pos[0] - R.at[0], c.pos[1] - R.at[1]))[0] || mates[0];
    if (R.type === 'penalty') {
      const k = onPitch(opp(m, team)).find(o => o.role === 'GK'), aim = r() < .5 ? -1 : 1, dive = r() < .45 ? aim : r() < .5 ? -aim : 0;
      m.stats[R.side].shots++; log(m, 'shot', R.side, { player: p.name, penalty: true });
      const scored = dive === aim ? r() < .32 - (k?.attrs.gk ?? .5) * .12 : r() < .93 + p.attrs.shooting * .05;
      const gx = PITCH.hl * dir;
      if (scored) { m.ball.lastKick = { by: p, t: m.t, shot: true }; m.ball.lastTouch = p; m.ball.p = [gx + dir * .3, aim * PITCH.goalHW * .6, .5]; m.stats[R.side].onTarget++; return goal(m, R.side); }
      if (dive === aim && k) { m.stats[1 - R.side].saves++; m.stats[R.side].onTarget++; log(m, 'save', 1 - R.side, { player: k.name, penalty: true }); gain(m, k); return; }
      log(m, 'miss', R.side, { player: p.name, penalty: true }); return setRestart(m, 'goalkick', 1 - R.side, [gx - dir * PITCH.sixD, 0]);
    }
    if (R.type === 'corner') { // a cross into the box: near post, the spot, the far post
      const gx = PITCH.hl * dir, spot = [[gx - dir * 6, R.at[1] * .12], [gx - dir * 11, 0], [gx - dir * 7, -R.at[1] * .14]][r() * 3 | 0];
      if (r() < .2) { const t = pick(() => true); return kick(m, p, t.pos[0], t.pos[1], { to: t }); } // (short)
      return kick(m, p, spot[0], spot[1], { loft: true, curl: (r() - .5) * .3 });
    }
    if (R.type === 'freekick') {
      const gx = PITCH.hl * dir, d = hyp(gx - R.at[0], R.at[1]);
      if (d < 28 && Math.abs(R.at[1]) < 18 && r() < .55) { // straight at goal, over the wall
        m.stats[R.side].shots++; log(m, 'shot', R.side, { player: p.name, freekick: true });
        const gy = (r() < .5 ? -1 : 1) * PITCH.goalHW * (.5 + r() * .4), wall = r() < .28;
        if (wall) { kick(m, p, gx, gy, { shot: true, power: 22, vz: 3 }); m.ball.v = [-m.ball.v[0] * .2, (r() - .5) * 10, 4]; m.ball.lastKick = { by: p, t: m.t }; return; } // (into the wall)
        return kick(m, p, gx, gy, { shot: true, power: 23 + p.attrs.shooting * 6, vz: 3 + r() * 1.5, curl: (r() - .5) * .5 });
      }
      if (d < 35) { const spot = [gx - dir * (8 + r() * 5), (r() - .5) * 10]; return kick(m, p, spot[0], spot[1], { loft: true }); }
    }
    if (R.type === 'goalkick') {
      if (r() < .45) { const t = pick(c => c.role === 'DF'); return kick(m, p, t.pos[0], t.pos[1], { to: t }); }
      const t = pick(c => c.role === 'FW' || c.role === 'MF'); return kick(m, p, t.pos[0], t.pos[1], { loft: true, to: t });
    }
    if (R.type === 'kickoff') { const t = pick(c => c.role === 'MF'); return kick(m, p, t.pos[0], t.pos[1], { to: t }); }
    // a throw-in, a free kick in their own half: to the nearest teammate who's free
    const t = pick(c => nearestOpp(m, c).d > 3);
    return kick(m, p, t.pos[0], t.pos[1], { to: t, loft: R.type === 'throwin' && hyp(t.pos[0] - R.at[0], t.pos[1] - R.at[1]) > 14 });
  }

  // ---- substitutions: from the hour, the most tired outfield players
  function subs(m) {
    if (m.r() > .004) return;
    for (const team of m.teams) {
      if (!team.subsLeft || minute(m) < 58 || m.ball.owner?.team === team) continue;
      const tired = onPitch(team).filter(p => p.role !== 'GK' && !p.sub).sort((a, c) => a.stamina - c.stamina)[0];
      const on = team.bench.find(b => !b.used && b.role === tired?.role) || team.bench.find(b => !b.used && b.role !== 'GK');
      if (!tired || !on || tired.stamina > .7) continue;
      on.used = true; team.subsLeft--;
      Object.assign(on, { slot: tired.slot, pos: [tired.pos[0], Math.sign(tired.pos[1] || 1) * (PITCH.hw - .5)], vel: [0, 0], sub: true, team });
      const k = team.players.indexOf(tired); tired.off = true; team.players[k] = on;
      log(m, 'sub', team.side, { on: on.name, off: tired.name }); m.stoppage[m.period - 1] += .3;
    }
  }

  // ---- one tick
  function tick(m) {
    const dt = DT;
    m.t += dt;
    const minNow = minute(m), half = m.period === 1 ? 45 : 90;
    if (m.phase === 'ht') { if (m.t >= m.phaseT) { m.period = 2; for (const t of m.teams) for (const p of onPitch(t)) p.stamina = Math.min(1, p.stamina + .15); kickoff(m, 1); log(m, 'kickoff', 1); } return; }
    if (m.phase === 'ft') return;
    if (minNow >= half + Math.round(m.added[m.period - 1] || 0) && m.phase !== 'goal') {
      if (m.period === 1) { m.phase = 'ht'; m.phaseT = m.t + 4; log(m, 'ht', 0, { score: [m.teams[0].score, m.teams[1].score] }); return; }
      m.phase = 'ft'; log(m, 'ft', 0, { score: [m.teams[0].score, m.teams[1].score] }); return;
    }
    if (minNow >= half - .1 && !m.added[m.period - 1]) m.added[m.period - 1] = clampN(Math.round(1 + m.stoppage[m.period - 1] + m.r() * 2), 1, 7), log(m, 'added', 0, { mins: m.added[m.period - 1] });
    if (m.phase === 'goal') {
      for (const t of m.teams) for (const p of onPitch(t)) {
        const c = m.celebrate;
        p.target = c.scorer === p ? [Math.sign(p.pos[0] || 1) * (PITCH.hl - 2), Math.sign(p.pos[1] || 1) * (PITCH.hw - 2)] : t.side === c.side && p.role !== 'GK' && c.scorer ? [c.scorer.pos[0] - Math.sign(c.scorer.pos[0]) * 1.5, c.scorer.pos[1]] : slotPos(m, t, p, 0, false, true);
        p.urgency = c.scorer === p ? 1 : .6; movePlayer(m, p, dt);
      }
      if (m.t >= m.phaseT) { kickoff(m, 1 - m.celebrate.side, false); m.celebrate = null; }
      return;
    }
    if (m.phase === 'restart') {
      restartPositions(m);
      for (const t of m.teams) for (const p of onPitch(t)) movePlayer(m, p, dt);
      m.restart.wait -= dt;
      const R = m.restart, tk = R.taker, there = hyp(tk.pos[0] - tk.target[0], tk.pos[1] - tk.target[1]) < .8;
      const lined = R.type !== 'kickoff' || m.teams.every(t => onPitch(t).every(p => p.pos[0] * dirOf(m, t) < .6)); // (kick-off: everyone back in their own half)
      if (R.wait <= 0 && (there && lined || R.wait < -8)) takeRestart(m); // (the taker walks over to it first; nobody's teleported)
      return;
    }
    // play (the overview: who chases, presses, supports, every third tick is plenty)
    if (!m.ctx || m.ctxN-- <= 0 || m.ctxOwner !== m.ball.owner) { m.ctx = context(m); m.ctxN = 2; m.ctxOwner = m.ball.owner; }
    const ctx = m.ctx;
    for (const t of m.teams) for (const p of onPitch(t)) {
      if (m.ball.owner === p) { if (m.t >= p.nextThink) { p.nextThink = m.t + TUNE.think * (.8 + m.r() * .5); decideCarrier(m, p); } }
      else if (m.t >= p.nextThink || ctx.chaser[t.side] === p || ctx.press[t.side][0] === p || p.receive) { p.nextThink = m.t + TUNE.think * (.9 + m.r() * .6); decideOffBall(m, p, ctx); }
    }
    for (const t of m.teams) for (const p of onPitch(t)) movePlayer(m, p, dt);
    // tackles: a presser within reach of the carrier, facing them
    const c = m.ball.owner;
    if (c) {
      for (const d of onPitch(opp(m, c.team))) {
        if (d.role === 'GK' && !inBox(m, d.team, c.pos[0], c.pos[1])) continue;
        if (hyp(d.pos[0] - c.pos[0], d.pos[1] - c.pos[1]) < TUNE.tackleRange && m.t > (d.nextTackle || 0)) { tackle(m, d, c); break; }
      }
      m.stats[c.team.side].poss += dt;
      // a keeper with it in their hands: out quickly
      if (c.role === 'GK' && m.t >= c.nextThink) { const dir = dirOf(m, c.team), mates = onPitch(c.team).filter(p => p !== c), t = mates.sort((a, b) => Math.abs(a.pos[1]) - Math.abs(b.pos[1]))[m.r() * 4 | 0] || mates[0]; kick(m, c, t.pos[0], t.pos[1], { to: t, loft: hyp(t.pos[0] - c.pos[0], t.pos[1] - c.pos[1]) > 30 }); }
    } else if (m.ball.lastTouch) m.stats[m.ball.lastTouch.team.side].poss += dt;
    stepBall(m, dt);
    if (!m.ball.owner) looseBall(m);
    if (m.phase === 'play') checkBall(m);
    subs(m);
    // anyone sent off walks to the touchline and down the tunnel
    for (const t of m.teams) for (const p of t.players) if (p.leaving) { p.target = p.leaving; p.urgency = .3; movePlayer(m, p, dt); if (hyp(p.pos[0] - p.leaving[0], p.pos[1] - p.leaving[1]) < .5) p.leaving = null; }
    // the referee: a diagonal, fifteen metres off the ball
    const rx = m.ball.p[0] * .9, ry = clampN(m.ball.p[1] * .5 - 12, -PITCH.hw + 4, PITCH.hw - 4), rd = hyp(rx - m.ref.pos[0], ry - m.ref.pos[1]);
    if (rd > .5) { const s = Math.min(rd, 6.5 * dt); m.ref.pos[0] += (rx - m.ref.pos[0]) / rd * s; m.ref.pos[1] += (ry - m.ref.pos[1]) / rd * s; m.ref.face = [(rx - m.ref.pos[0]) / rd, (ry - m.ref.pos[1]) / rd]; }
    // the last twelve seconds, for replays
    if ((m.t / DT | 0) % 2 === 0) { m.replay.push({ t: m.t, b: m.ball.p.slice(), p: m.teams.flatMap(t => t.players.map(p => [p.pos[0], p.pos[1]])) }); if (m.replay.length > 120) m.replay.shift(); }
  }
  // run the match on by `seconds` of play (fixed steps; any remainder carries over)
  function step(m, seconds) {
    m.acc = (m.acc || 0) + seconds;
    while (m.acc >= DT && m.phase !== 'ft') { tick(m); m.acc -= DT; }
    return m;
  }
  function simulate(m) { while (m.phase !== 'ft') tick(m); return m; }
  // a match's result for the league table
  const result = m => ({ home: m.teams[0].club.id, away: m.teams[1].club.id, score: [m.teams[0].score, m.teams[1].score],
    scorers: m.events.filter(e => e.kind === 'goal').map(e => ({ side: e.side, player: e.player, min: Math.ceil(e.min), og: e.og })) });

  return { PITCH, CLUBS, FORMATIONS, TUNE, DT, create, step, simulate, tick, minute, dirOf, result, threat, xg, rng, offsideSet };
})();

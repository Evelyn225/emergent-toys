// ---- minigames: the arcade cabinets (snake, breakout, street crosser) and the work shifts (waiting tables,
// stocking shelves), plus what a taxi fare pays. Pure: each game is a small state machine on its own W x H grid,
// stepped with the keys held and pressed this frame; minigame-ui.js draws it into the character grid and plays its
// sounds. The node tests play them too.
//
// make(rnd) -> game: { id, title, W, H, score, over, step(dt, keys) -> events[], draw(put), status() -> string,
//                     reward() -> tickets (arcade) or dollars (shifts) }
// keys: left / right / up / down / act held, and leftP / rightP / upP / downP / actP pressed this frame.
// put(x, y, ch, col, bg?) paints one game cell; text(x, y, s, col) writes a label at a cell, at normal size.
const GAMES = {};

// snake: eat the apples, don't hit the walls or yourself; it speeds up as it grows
GAMES.snake = (rnd = Math.random) => {
  const W = 28, H = 16, g = { id: 'snake', title: 'SNAKE', W, H, score: 0, over: false };
  let body = [[8, 8], [7, 8], [6, 8]], dir = [1, 0], next = [1, 0], food = null, acc = 0;
  const place = () => { do food = [rnd() * W | 0, rnd() * H | 0]; while (body.some(b => b[0] === food[0] && b[1] === food[1])); };
  place();
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    for (const [key, d] of [['leftP', [-1, 0]], ['rightP', [1, 0]], ['upP', [0, -1]], ['downP', [0, 1]]])
      if (k[key] && (d[0] !== -dir[0] || d[1] !== -dir[1])) next = d; // no turning back on yourself
    acc += dt;
    const period = Math.max(0.055, 0.14 - g.score * 0.004);
    while (acc >= period) {
      acc -= period; dir = next;
      const h = [body[0][0] + dir[0], body[0][1] + dir[1]], eats = h[0] === food[0] && h[1] === food[1];
      const hitSelf = body.some((b, i) => (eats || i < body.length - 1) && b[0] === h[0] && b[1] === h[1]);
      if (h[0] < 0 || h[1] < 0 || h[0] >= W || h[1] >= H || hitSelf) { g.over = true; ev.push('die'); break; }
      body.unshift(h);
      if (eats) { g.score++; ev.push('eat'); place(); } else body.pop();
    }
    return ev;
  };
  g.draw = put => {
    put(food[0], food[1], '@', C(RED, 15), C(RED, 4));
    body.forEach((b, i) => put(b[0], b[1], i ? 'o' : 'O', C(GREEN, i ? 12 : 15), C(GREEN, i ? 4 : 7)));
  };
  g.status = () => `APPLES ${g.score}`;
  g.reward = () => g.score * 2;
  g.body = () => body;
  return g;
};

// breakout: knock out the bricks with the ball, keep it off the floor with the paddle; three balls
GAMES.breakout = (rnd = Math.random) => {
  const W = 30, H = 20, PW = 5, g = { id: 'breakout', title: 'BREAKOUT', W, H, score: 0, over: false };
  let paddle = W / 2, ball = null, lives = 3, speed = 13, bricks;
  const fill = () => { bricks = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) bricks.push({ r, c, on: true }); };
  const stick = () => { ball = { x: paddle, y: H - 2, vx: 0, vy: 0, stuck: true }; };
  fill(); stick();
  const brickAt = (x, y) => bricks.find(b => b.on && y >= 2 + b.r && y < 3 + b.r && x >= b.c * 3 && x < b.c * 3 + 3);
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    paddle = clamp(paddle + ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 24 * dt, PW / 2, W - PW / 2);
    if (ball.stuck) {
      ball.x = paddle;
      if (k.actP || k.upP) { const a_ = -Math.PI / 2 + (rnd() - 0.5) * 0.8; ball.vx = Math.cos(a_) * speed; ball.vy = Math.sin(a_) * speed; ball.stuck = false; ev.push('launch'); }
      return ev;
    }
    const n = Math.ceil(dt * speed * 4); // small steps so it never skips through a brick
    for (let s = 0; s < n; s++) {
      const h = dt / n, px_ = ball.x, py_ = ball.y;
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      if (ball.x < 0 || ball.x >= W) { ball.vx = -ball.vx; ball.x = clamp(ball.x, 0, W - 1e-3); ev.push('wall'); }
      if (ball.y < 0) { ball.vy = Math.abs(ball.vy); ball.y = 0; ev.push('wall'); }
      const b = brickAt(ball.x, ball.y);
      if (b) { // knock it out; bounce off whichever side we came in through
        b.on = false; g.score++; ev.push('brick');
        if (Math.floor(py_) !== Math.floor(ball.y)) ball.vy = -ball.vy; else ball.vx = -ball.vx;
        ball.x = px_; ball.y = py_;
        if (!bricks.some(o => o.on)) { fill(); speed *= 1.12; stick(); ev.push('clear'); return ev; }
      }
      if (ball.vy > 0 && ball.y >= H - 1 && ball.y < H && Math.abs(ball.x - paddle) <= PW / 2 + 0.5) { // off the paddle: where it hits steers it
        const off = clamp((ball.x - paddle) / (PW / 2 + 0.5), -1, 1), a_ = -Math.PI / 2 + off * 1.05;
        ball.vx = Math.cos(a_) * speed; ball.vy = Math.sin(a_) * speed; ball.y = H - 1 - 1e-3; ev.push('paddle');
      }
      if (ball.y >= H + 0.5) { lives--; ev.push('miss'); if (!lives) { g.over = true; ev.push('die'); } else stick(); return ev; }
    }
    return ev;
  };
  g.draw = put => {
    const BCOL = [RED, ORANGE, YEL, GREEN, CYAN];
    for (const b of bricks) if (b.on) for (let k = 0; k < 2; k++) put(b.c * 3 + k, 2 + b.r, '#', C(BCOL[b.r], 15), C(BCOL[b.r], 4)); // and a gap
    for (let x = Math.round(paddle - PW / 2); x < Math.round(paddle + PW / 2); x++) put(x, H - 1, '=', C(WHITE, 15), C(GRAY, 5));
    put(Math.floor(ball.x), Math.floor(ball.y), 'o', C(WHITE, 15));
  };
  g.status = () => `BRICKS ${g.score}   BALLS ${'o'.repeat(lives)}${ball.stuck ? '   SPACE to launch' : ''}`;
  g.reward = () => Math.floor(g.score / 2);
  g.state = () => ({ ball, paddle, lives, bricks });
  return g;
};

// street crosser: get across two carriageways of traffic to the far sidewalk, one hop at a time; faster each crossing
GAMES.crosser = (rnd = Math.random) => {
  const W = 25, H = 13, g = { id: 'crosser', title: 'STREET CROSSER', W, H, score: 0, over: false };
  let you = [12, 12], lives = 3, splat = 0, lanes;
  const make = () => {
    lanes = [];
    for (let y = 1; y < H - 1; y++) { // row 6 is the median, 0 and 12 the sidewalks
      if (y === 6) continue;
      const dir = y < 6 ? -1 : 1, len = 2 + (rnd() * 3 | 0), gap = len + 3 + (rnd() * 5 | 0);
      lanes.push({ y, dir, len, gap, sp: (2 + rnd() * 3) * (1 + g.score * 0.12), off: rnd() * gap, col: [RED, BLUE, TAXI, WHITE, GREEN][rnd() * 5 | 0] });
    }
  };
  make();
  const carOn = (l, x) => mod(x - l.off * l.dir, l.gap) < l.len; // is column x under a car in lane l
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    for (const l of lanes) l.off = mod(l.off + l.sp * dt, l.gap);
    if (splat > 0) { splat -= dt; if (splat <= 0) you = [12, 12]; return ev; }
    const mv = k.leftP ? [-1, 0] : k.rightP ? [1, 0] : k.upP ? [0, -1] : k.downP ? [0, 1] : null;
    if (mv) { you = [clamp(you[0] + mv[0], 0, W - 1), clamp(you[1] + mv[1], 0, H - 1)]; ev.push('hop'); }
    const l = lanes.find(o => o.y === you[1]);
    if (l && carOn(l, you[0])) { lives--; splat = 0.8; ev.push('miss'); if (!lives) { g.over = true; ev.push('die'); } return ev; }
    if (you[1] === 0) { g.score++; ev.push('score'); you = [12, 12]; make(); }
    return ev;
  };
  g.draw = put => {
    for (let x = 0; x < W; x++) { put(x, 0, ',', C(GRAY, 6), C(GRAY, 2)); put(x, 6, ',', C(GRAY, 6), C(GRAY, 2)); put(x, H - 1, ',', C(GRAY, 6), C(GRAY, 2)); }
    for (const l of lanes) for (let x = 0; x < W; x++) {
      if (carOn(l, x)) { const head = l.dir > 0 ? !carOn(l, x + 1) : !carOn(l, x - 1); put(x, l.y, head ? 'o' : '#', C(l.col, 15), C(l.col, 4)); }
      else if (x % 4 === 0 && l.y !== 5 && l.y !== 11) put(x, l.y, '-', C(YEL, 5));
    }
    put(you[0], you[1], splat > 0 ? '*' : '@', splat > 0 ? C(RED, 15) : C(WHITE, 15));
  };
  g.status = () => `CROSSINGS ${g.score}   LIVES ${'@'.repeat(lives)}`;
  g.reward = () => g.score * 3;
  g.lanes = () => lanes; g.you = () => you;
  return g;
};

// waiting tables (a shift at a diner, cafe or noodle bar): customers come down the four counters toward you; slide
// each a plate before they reach the end. A plate with nobody to catch it breaks; a customer who gets to you walks
// out. 75 seconds, or five mistakes. Pays per customer served.
GAMES.serve = (rnd = Math.random) => {
  const W = 34, H = 12, LANES = [1, 4, 7, 10], g = { id: 'serve', title: 'LUNCH RUSH', W, H, score: 0, over: false, shift: true };
  let lane = 0, cust = [], plates = [], misses = 0, t = 0, spawn = 1;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.upP) lane = Math.max(0, lane - 1);
    if (k.downP) lane = Math.min(3, lane + 1);
    if (k.actP) { plates.push({ lane, x: 2 }); ev.push('slide'); }
    if ((spawn -= dt) <= 0) { cust.push({ lane: rnd() * 4 | 0, x: W - 1, sp: 1.1 + rnd() * 0.8 + t * 0.02 }); spawn = Math.max(0.7, 2.2 - t * 0.022) * (0.7 + rnd() * 0.6); }
    for (const c of cust) c.x -= c.sp * dt;
    for (const p of plates) {
      p.x += 14 * dt;
      const c = cust.filter(o => o.lane === p.lane && o.x <= p.x + 0.5).sort((a_, b) => a_.x - b.x)[0];
      if (c) { cust.splice(cust.indexOf(c), 1); p.done = true; g.score++; ev.push('serve'); }
      else if (p.x >= W - 1) { p.done = true; misses++; ev.push('break'); }
    }
    plates = plates.filter(p => !p.done);
    for (const c of cust) if (c.x <= 2) { c.gone = true; misses++; ev.push('angry'); }
    cust = cust.filter(c => !c.gone);
    if (misses >= 5 || t >= 75) { g.over = true; ev.push('end'); }
    return ev;
  };
  g.draw = put => {
    LANES.forEach((y, k) => {
      for (let x = 1; x < W; x++) put(x, y + 1, '=', C(BRICK, 9), C(BRICK, 2)); // the counter
      put(0, y, k === lane ? '@' : ' ', C(WHITE, 15)); put(0, y + 1, k === lane ? 'A' : '|', C(k === lane ? WHITE : GRAY, k === lane ? 13 : 5));
    });
    for (const c of cust) put(Math.round(c.x), LANES[c.lane], 'o', C(YEL, 15), C(MAG, 3));
    for (const p of plates) put(Math.round(p.x), LANES[p.lane], '_', C(WHITE, 15), C(GRAY, 4));
  };
  g.status = () => `SERVED ${g.score}   MISTAKES ${misses}/5   ${Math.max(0, 75 - t) | 0}s   UP/DOWN counter, SPACE slide a plate`;
  g.reward = () => Math.max(0, Math.round((4 + g.score * 1.2 - misses * 0.8) * 100) / 100);
  g.misses = () => misses; g.cust = () => cust; g.lane = () => lane; g.plates = () => plates;
  return g;
};

// stocking shelves (a shift at a store): each shelf holds one kind of thing; shoppers keep taking them. Put each box
// that comes off the truck in an empty slot on its own shelf. 60 seconds. Pays for every box shelved right, less
// for the ones put in the wrong place.
const STOCK_KINDS = [['CANS', 'c', RED], ['CEREAL', '#', YEL], ['BOTTLES', 'i', CYAN], ['SOAP', 'o', MAG]];
GAMES.stock = (rnd = Math.random) => {
  const W = 34, H = 13, SLOTS = 10, g = { id: 'stock', title: 'RESTOCK', W, H, score: 0, over: false, shift: true };
  const shelf = STOCK_KINDS.map(() => Array.from({ length: SLOTS }, () => rnd() < 0.6));
  let cur = [0, 0], box = rnd() * 4 | 0, wrong = 0, t = 0, take = 0.8;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.leftP) cur[1] = Math.max(0, cur[1] - 1);
    if (k.rightP) cur[1] = Math.min(SLOTS - 1, cur[1] + 1);
    if (k.upP) cur[0] = Math.max(0, cur[0] - 1);
    if (k.downP) cur[0] = Math.min(3, cur[0] + 1);
    if (k.actP) {
      if (shelf[cur[0]][cur[1]]) ev.push('bump'); // already full
      else if (cur[0] === box) { shelf[cur[0]][cur[1]] = true; g.score++; box = rnd() * 4 | 0; ev.push('place'); }
      else { wrong++; box = rnd() * 4 | 0; ev.push('wrong'); }
    }
    if ((take -= dt) <= 0) { // a shopper takes something
      const full = [];
      shelf.forEach((r, i) => r.forEach((f, j) => f && full.push([i, j])));
      if (full.length) { const [i, j] = full[rnd() * full.length | 0]; shelf[i][j] = false; }
      take = 0.6 + rnd() * 0.9;
    }
    if (t >= 60) { g.over = true; ev.push('end'); }
    return ev;
  };
  g.draw = (put, text) => {
    STOCK_KINDS.forEach(([name, ch, col], i) => {
      const y = 1 + i * 3;
      text(1, y, name, C(col, 13));
      for (let j = 0; j < SLOTS; j++) {
        const x = 10 + j * 2, here = cur[0] === i && cur[1] === j;
        put(x, y, shelf[i][j] ? ch : '.', shelf[i][j] ? C(col, 15) : C(GRAY, 6), here ? C(WHITE, 6) : shelf[i][j] ? C(col, 3) : NONE);
        put(x, y + 1, '=', C(GRAY, 8)); put(x + 1, y + 1, '=', C(GRAY, 8));
      }
    });
    const [name, ch, col] = STOCK_KINDS[box];
    put(10, H - 1, ch, C(col, 15), C(col, 4)); text(13, H - 1, `the box in your arms: ${name}`, C(col, 15));
  };
  g.status = () => `SHELVED ${g.score}   WRONG ${wrong}   ${Math.max(0, 60 - t) | 0}s   ARROWS move, SPACE shelve the box`;
  g.reward = () => Math.max(0, Math.round((3 + g.score * 0.7 - wrong * 0.6) * 100) / 100);
  g.shelf = () => shelf; g.box = () => box; g.cur = () => cur; g.wrong = () => wrong;
  return g;
};

// which shift each room offers
const SHIFT_FOR = { diner: 'serve', cafe: 'serve', noodle: 'serve', store: 'stock', books: 'stock' };
// the cabinets in an arcade, in order, cycle through these; a credit is a dollar
const ARCADE_GAMES = ['snake', 'breakout', 'crosser'], CREDIT = 1;

// ---- driving a taxi: what a trip pays. The meter (taxiFare) by distance, and a tip for getting there quickly and
// smoothly; any crash on the way and there's no tip. took = seconds, harsh = seconds of hard braking or swerving.
// route = how far it is by the streets (defaults to dist); the clock is judged on that, not the meter, so a detour
// pays more on the meter but costs you the tip
function taxiPay(dist, took, harsh, crashed, route = dist) {
  const fare = Math.round(taxiFare(dist) * 100) / 100, expected = 6 + route / 1.4;
  const speed = clamp(expected / Math.max(took, 1), 0, 1), smooth = clamp(1 - harsh / 6, 0, 1);
  const tip = crashed ? 0 : Math.round(fare * (0.05 + 0.25 * speed + 0.2 * smooth) * 100) / 100;
  const stars = crashed ? 1 : 1 + Math.round(4 * (speed + smooth) / 2);
  return { fare, tip, stars, speed, smooth };
}

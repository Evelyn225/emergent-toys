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
  let you = [12, 12], lives = 4, splat = 0, lanes;
  const make = () => {
    lanes = [];
    for (let y = 1; y < H - 1; y++) { // row 6 is the median, 0 and 12 the sidewalks
      if (y === 6) continue;
      const dir = y < 6 ? -1 : 1, len = 2 + (rnd() * 3 | 0), gap = len + 4 + (rnd() * 5 | 0); // (room to slip through)
      lanes.push({ y, dir, len, gap, sp: (1.6 + rnd() * 2.2) * (1 + g.score * 0.08), off: rnd() * gap, col: [RED, BLUE, TAXI, WHITE, GREEN][rnd() * 5 | 0] });
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

// pong: you on the left, the machine on the right (a little slow to react, so it can be beaten); first to 7. The
// ball speeds up every rally hit and leaves your paddle at an angle set by where it hit.
GAMES.pong = (rnd = Math.random) => {
  const W = 32, H = 18, PH = 4, WIN = 7, g = { id: 'pong', title: 'PONG', W, H, score: 0, over: false };
  let you = H / 2, cpu = H / 2, them = 0, ball, wait = 1;
  const serve = dir => { const a_ = (rnd() - 0.5) * 0.9; ball = { x: W / 2, y: H / 2, vx: Math.cos(a_) * 11 * dir, vy: Math.sin(a_) * 11 }; wait = 0.8; };
  serve(rnd() < 0.5 ? 1 : -1);
  const bounce = (py, dir) => { // off a paddle at py: faster, and angled by where on the paddle it hit
    const off = clamp((ball.y - py) / (PH / 2 + 0.5), -1, 1), sp = Math.min(26, Math.hypot(ball.vx, ball.vy) * 1.1), a_ = off * 1.0;
    ball.vx = Math.cos(a_) * sp * dir; ball.vy = Math.sin(a_) * sp;
  };
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    you = clamp(you + ((k.down ? 1 : 0) - (k.up ? 1 : 0)) * 16 * dt, PH / 2, H - PH / 2);
    // the machine: chases the ball when it's coming (a little slow, and misjudging it by a wobbling bit), drifts home when not
    const aim = ball.vx > 0 ? ball.y + Math.sin(ball.x * 0.7 + them) * 1.6 : H / 2;
    cpu = clamp(cpu + clamp(aim - cpu, -5.5 * dt, 5.5 * dt), PH / 2, H - PH / 2);
    if (wait > 0) { wait -= dt; return ev; }
    const n = Math.ceil(dt * 40);
    for (let s = 0; s < n; s++) {
      const h = dt / n;
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      if (ball.y < 0 || ball.y > H - 1e-3) { ball.vy = -ball.vy; ball.y = clamp(ball.y, 0, H - 1e-3); ev.push('wall'); }
      if (ball.vx < 0 && ball.x < 1.5 && ball.x > 0.5 && Math.abs(ball.y - you) <= PH / 2 + 0.5) { bounce(you, 1); ball.x = 1.5; ev.push('paddle'); }
      if (ball.vx > 0 && ball.x > W - 1.5 && ball.x < W - 0.5 && Math.abs(ball.y - cpu) <= PH / 2 + 0.5) { bounce(cpu, -1); ball.x = W - 1.5; ev.push('paddle'); }
      if (ball.x < 0 || ball.x > W) {
        if (ball.x > W) { g.score++; ev.push('score'); } else { them++; ev.push('miss'); }
        if (g.score >= WIN || them >= WIN) { g.over = true; ev.push(g.score >= WIN ? 'clear' : 'die'); }
        else serve(ball.x > W ? -1 : 1);
        return ev;
      }
    }
    return ev;
  };
  g.draw = put => {
    for (let y = 0; y < H; y += 2) put(W / 2, y, ':', C(GRAY, 7)); // the net
    for (let y = Math.round(you - PH / 2); y < Math.round(you + PH / 2); y++) put(0, y, '#', C(WHITE, 15), C(GRAY, 5));
    for (let y = Math.round(cpu - PH / 2); y < Math.round(cpu + PH / 2); y++) put(W - 1, y, '#', C(RED, 14), C(RED, 4));
    if (wait <= 0 || fract(wait * 4) < 0.5) put(Math.floor(ball.x), Math.floor(ball.y), 'o', C(WHITE, 15));
  };
  g.status = () => `YOU ${g.score} - ${them} CPU   first to ${WIN}   UP/DOWN move`;
  g.reward = () => g.score * 2 + (g.score >= WIN ? 10 : 0);
  g.state = () => ({ you, cpu, ball, them });
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
  g.reward = () => Math.max(0, Math.round((4 * Math.min(1, t / 75) + g.score * 1.2 - misses * 0.8) * 100) / 100); // the base pay is for the hours worked
  g.misses = () => misses; g.cust = () => cust; g.lane = () => lane; g.plates = () => plates;
  return g;
};

// tending bar (a shift at a bar): the classic. Four bars, a tap at the end of each, thirsty customers walking up
// them. Hold SPACE to pour, let go when the mug's full (too soon and you keep pouring next time, too long and it
// spills) and it slides down the bar. A customer who catches one is pushed back toward the door while they drink,
// and may slide the empty back: be at that bar to catch it. A mug nobody catches, an empty you miss, a spill, or a
// customer reaching your end: a mistake. Five and you're done; 75 seconds otherwise.
GAMES.tapper = (rnd = Math.random) => {
  const W = 34, H = 12, LANES = [1, 4, 7, 10], g = { id: 'tapper', title: 'LAST ORDERS', W, H, score: 0, over: false, shift: true };
  let lane = 0, cust = [], mugs = [], empties = [], misses = 0, t = 0, spawn = 1, fill = 0, pouring = false;
  const FULL = [0.85, 1.15];
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.upP && lane > 0) { lane--; fill = 0; pouring = false; } // (a different tap: start a fresh mug)
    if (k.downP && lane < 3) { lane++; fill = 0; pouring = false; }
    if (k.act) {
      pouring = true; fill += dt / 0.9;
      if (fill > 1.35) { fill = 0; pouring = false; misses++; ev.push('wrong'); } // all over the floor
    } else if (pouring) { // let go
      pouring = false;
      if (fill >= FULL[0] && fill <= FULL[1]) { mugs.push({ lane, x: 2 }); fill = 0; ev.push('slide'); }
      else if (fill > FULL[1]) { fill = 0; misses++; ev.push('wrong'); }
    }
    if ((spawn -= dt) <= 0) { cust.push({ lane: rnd() * 4 | 0, x: W - 1, sp: 0.9 + rnd() * 0.6 + t * 0.015, drink: 0 }); spawn = Math.max(0.9, 2.6 - t * 0.022) * (0.7 + rnd() * 0.6); }
    for (const c of cust) {
      if (c.drink > 0) { c.drink -= dt; if (c.drink <= 0 && rnd() < 0.55) empties.push({ lane: c.lane, x: c.x - 1 }); continue; }
      c.x -= c.sp * dt;
    }
    for (const m of mugs) {
      m.x += 12 * dt;
      const c = cust.filter(o => o.lane === m.lane && o.drink <= 0 && o.x <= m.x + 0.5).sort((a_, b) => a_.x - b.x)[0];
      if (c) { m.done = true; g.score++; ev.push('serve'); c.x += 7; c.drink = 1.6; if (c.x >= W - 1) c.gone = true; } // shoved back (out of the door, if far enough)
      else if (m.x >= W - 1) { m.done = true; misses++; ev.push('break'); }
    }
    for (const e of empties) {
      e.x -= 9 * dt;
      if (e.x <= 1.5) { e.done = true; if (e.lane === lane) { ev.push('place'); g.score += 0.5; } else { misses++; ev.push('break'); } }
    }
    mugs = mugs.filter(m => !m.done); empties = empties.filter(e => !e.done);
    for (const c of cust) if (c.x <= 2) { c.gone = true; misses++; ev.push('angry'); }
    cust = cust.filter(c => !c.gone);
    if (misses >= 5 || t >= 75) { g.over = true; ev.push('end'); }
    return ev;
  };
  g.draw = put => {
    LANES.forEach((y, k) => {
      for (let x = 2; x < W; x++) put(x, y + 1, '=', C(BRICK, 9), C(BRICK, 2)); // the bar
      put(1, y, '}', C(GRAY, 12)); put(1, y + 1, '|', C(GRAY, 9)); // the tap
      put(0, y, k === lane ? '@' : ' ', C(WHITE, 15)); put(0, y + 1, k === lane ? 'A' : ' ', C(WHITE, 13));
    });
    // the mug under the tap, filling: froth on top once it's full, red past full
    const y = LANES[lane], lvl = Math.min(3, Math.floor(fill * 3));
    if (fill > 0) put(2, y, fill > FULL[1] ? '%' : lvl >= 3 ? '@' : lvl >= 2 ? 'U' : lvl >= 1 ? 'u' : '_', fill > FULL[1] ? C(RED, 15) : fill >= FULL[0] ? C(WHITE, 15) : C(YEL, 13), C(YEL, 2 + lvl));
    for (const c of cust) put(Math.round(c.x), LANES[c.lane], c.drink > 0 ? 'Q' : 'o', C(YEL, 15), C(MAG, 3));
    for (const m of mugs) put(Math.round(m.x), LANES[m.lane], 'U', C(YEL, 15), C(ORANGE, 3));
    for (const e of empties) put(Math.round(e.x), LANES[e.lane], 'u', C(GRAY, 13), C(GRAY, 3));
  };
  g.status = () => `SERVED ${Math.floor(g.score)}   MISTAKES ${misses}/5   ${Math.max(0, 75 - t) | 0}s   UP/DOWN bar, HOLD SPACE pour, let go to slide`;
  g.reward = () => Math.max(0, Math.round((4 * Math.min(1, t / 75) + g.score * 1.3 - misses * 0.8) * 100) / 100);
  g.state = () => ({ lane, fill, cust, mugs, empties, misses });
  return g;
};

// stocking shelves (a shift at a store): each shelf holds one kind of thing, and what they are depends on the shop
// (STOCK_THEMES, by its sign); shoppers keep taking them. Put each box that comes off the truck in an empty slot on
// its own shelf. 60 seconds. Pays for every box shelved right, less for the ones put in the wrong place.
const STOCK_THEMES = {
  DEFAULT: [['CANS', 'c', RED], ['CEREAL', '#', YEL], ['BOTTLES', 'i', CYAN], ['SOAP', 'o', MAG]],
  VIDEO: [['NEW', '=', RED], ['COMEDY', '=', YEL], ['HORROR', '=', MAG], ['KIDS', '=', CYAN]],
  TOYS: [['YO-YOS', 'o', RED], ['DUCKS', '@', YEL], ['BALLS', 'O', WHITE], ['KITES', '&', CYAN]],
  THRIFT: [['COATS', '#', BRICK], ['SHOES', 'b', GRAY], ['LAMPS', 'T', YEL], ['RECORDS', 'o', MAG]],
  TOBACCO: [['CIGARS', '=', BRICK], ['PAPERS', '#', WHITE], ['LIGHTERS', 'i', RED], ['PIPES', 'J', WARM]],
  RECORDS: [['VINYL', 'o', MAG], ['CDS', '@', CYAN], ['TAPES', '=', YEL], ['POSTERS', '#', RED]],
  BOOKS: [['FICTION', '|', BLUE], ['COMICS', '%', RED], ['COOKBOOKS', '#', YEL], ['MAPS', '=', GREEN]],
  PHARMACY: [['PILLS', 'o', WHITE], ['BANDAGES', '+', RED], ['SHAMPOO', 'i', CYAN], ['VITAMINS', ':', ORANGE]],
  HARDWARE: [['NAILS', ':', GRAY], ['TOOLS', 'T', RED], ['PAINT', 'U', BLUE], ['ROPE', '@', BRICK]],
  LIQUOR: [['WINE', 'i', RED], ['BEER', '#', YEL], ['SPIRITS', 'I', ORANGE], ['MIXERS', 'o', CYAN]],
  PHONES: [['PHONES', '#', GRAY], ['CASES', '[', MAG], ['CHARGERS', '~', WHITE], ['CABLES', '=', CYAN]],
  SPORTS: [['BALLS', 'o', ORANGE], ['SHOES', 'U', WHITE], ['BATS', '/', BRICK], ['JERSEYS', '#', BLUE]],
  SKATE: [['DECKS', '=', RED], ['WHEELS', 'o', YEL], ['TEES', '#', CYAN], ['STICKERS', '*', MAG]],
  GROCERY: [['FRUIT', 'o', RED], ['VEG', '%', GREEN], ['BREAD', '#', WARM], ['MILK', 'i', WHITE]],
  HERBS: [['ROOTS', '%', WARM], ['TEAS', '#', GREEN], ['JARS', 'U', ORANGE], ['DRIED', ':', YEL]],
  JADE: [['BANGLES', 'o', GREEN], ['FIGURES', '&', CYAN], ['BEADS', ':', RED], ['CHARMS', '*', YEL]],
  PAWN: [['WATCHES', 'o', YEL], ['GUITARS', '%', BRICK], ['CAMERAS', '#', GRAY], ['JEWELLERY', '*', CYAN]],
};
STOCK_THEMES.MARKET = STOCK_THEMES.FRUIT = STOCK_THEMES.GROCERY;
const stockKinds = word => STOCK_THEMES[word] || STOCK_THEMES.DEFAULT;
GAMES.stock = (rnd = Math.random, word = '') => {
  const STOCK_KINDS = stockKinds(word);
  const W = 34, H = 13, SLOTS = 10, g = { id: 'stock', title: 'RESTOCK', W, H, score: 0, over: false, shift: true };
  const shelf = STOCK_KINDS.map(() => Array.from({ length: SLOTS }, () => rnd() < 0.6));
  // the next box off the truck: always for a shelf with a gap on it; none (-1) while every shelf is full
  const nextBox = () => { const open = [0, 1, 2, 3].filter(i => shelf[i].includes(false)); return open.length ? open[rnd() * open.length | 0] : -1; };
  let cur = [0, 0], box = nextBox(), wrong = 0, t = 0, take = 0.8;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.leftP) cur[1] = Math.max(0, cur[1] - 1);
    if (k.rightP) cur[1] = Math.min(SLOTS - 1, cur[1] + 1);
    if (k.upP) cur[0] = Math.max(0, cur[0] - 1);
    if (k.downP) cur[0] = Math.min(3, cur[0] + 1);
    if (box < 0 || !shelf[box].includes(false)) box = nextBox(); // nothing to shelve, or its shelf filled: a box that fits
    if (k.actP && box >= 0) {
      if (shelf[cur[0]][cur[1]]) ev.push('bump'); // already full
      else if (cur[0] === box) { shelf[cur[0]][cur[1]] = true; g.score++; box = nextBox(); ev.push('place'); }
      else { wrong++; box = nextBox(); ev.push('wrong'); }
    }
    if ((take -= dt) <= 0) { // a shopper takes something
      const full = [];
      shelf.forEach((r, i) => r.forEach((f, j) => f && full.push([i, j])));
      if (full.length) { const [i, j] = full[rnd() * full.length | 0]; shelf[i][j] = false; }
      take = 0.6 + rnd() * 0.9;
    }
    if (box < 0 || !shelf[box].includes(false)) box = nextBox(); // (again, now the shoppers have been)
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
    if (box < 0) { text(10, H - 1, 'shelves full: waiting for the next box off the truck...', C(GRAY, 10)); return; }
    const [name, ch, col] = STOCK_KINDS[box];
    put(10, H - 1, ch, C(col, 15), C(col, 4)); text(13, H - 1, `the box in your arms: ${name}`, C(col, 15));
  };
  g.status = () => `SHELVED ${g.score}   WRONG ${wrong}   ${Math.max(0, 60 - t) | 0}s   ARROWS move, SPACE shelve the box`;
  g.reward = () => Math.max(0, Math.round((3 * Math.min(1, t / 60) + g.score * 0.7 - wrong * 0.6) * 100) / 100); // the base pay is for the hours worked
  g.shelf = () => shelf; g.box = () => box; g.cur = () => cur; g.wrong = () => wrong;
  return g;
};

// ---- crimes. Each ends with g.success true or false; the caller (crime-ui.js) decides what that means.
// pickpocketing: a marker sweeps across a bar; stop it in the green three times running, the zone shrinking each time
GAMES.pickpocket = (rnd = Math.random) => {
  const W = 30, H = 7, g = { id: 'pickpocket', title: 'PICKPOCKET', W, H, score: 0, over: false, success: false, crime: true };
  let pos = 0, dir = 1, speed = 16, zone = [11, 17];
  const newZone = () => { const w = [6, 4, 3][g.score] || 3, a_ = 2 + rnd() * (W - 4 - w) | 0; zone = [a_, a_ + w]; };
  newZone();
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    pos += dir * speed * dt;
    if (pos < 0 || pos > W - 1) { dir = -dir; pos = clamp(pos, 0, W - 1); }
    if (k.actP) {
      if (pos >= zone[0] && pos <= zone[1] + 1) { g.score++; ev.push('eat'); speed *= 1.25; if (g.score >= 3) { g.over = g.success = true; ev.push('clear'); } else newZone(); }
      else { g.over = true; ev.push('die'); } // they felt that
    }
    return ev;
  };
  g.draw = (put, text) => {
    for (let x = 0; x < W; x++) put(x, 3, x >= zone[0] && x <= zone[1] ? '=' : '-', x >= zone[0] && x <= zone[1] ? C(GREEN, 14) : C(GRAY, 7), x >= zone[0] && x <= zone[1] ? C(GREEN, 3) : NONE);
    put(Math.round(pos), 2, 'v', C(YEL, 15)); put(Math.round(pos), 4, '^', C(YEL, 15));
    text(0, 0, `fingers in the pocket: ${'*'.repeat(g.score)}${'.'.repeat(3 - g.score)}`, C(WHITE, 13));
  };
  g.status = () => 'SPACE when the marker is in the green   miss once and they notice';
  g.reward = () => 0;
  return g;
};
// shoplifting: hold SPACE to slip something into your coat, but only while the clerk's looking away; they glance
// round now and then, with a moment's warning (they start to turn). Caught holding it and they call the cops.
GAMES.shoplift = (rnd = Math.random) => {
  const W = 30, H = 10, g = { id: 'shoplift', title: 'FIVE FINGER DISCOUNT', W, H, score: 0, over: false, success: false, crime: true };
  let state = 'away', left = 0.8 + rnd() * 0.8, grab = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    if ((left -= dt) <= 0) {
      if (state === 'away') { state = 'turning'; left = 0.6; ev.push('bump'); }
      else if (state === 'turning') { state = 'looking'; left = 1.2 + rnd() * 1.5; }
      else { state = 'away'; left = 1.5 + rnd() * 2.5; }
    }
    if (k.act) {
      if (state === 'looking') { g.over = true; ev.push('die'); return ev; } // seen
      grab += dt / 2.6; // longer than they ever look away: you'll have to let go at least once
      if (grab >= 1) { g.over = g.success = true; ev.push('clear'); }
    }
    return ev;
  };
  g.draw = (put, text) => {
    const face = state === 'looking' ? ['  ____  ', ' (O  O) ', '  \__/  ', '   ||   '] : state === 'turning' ? ['  ____  ', ' (  o o)', '   \_/  ', '   ||   '] : ['  ____  ', ' (     )', '  (___) ', '   ||   '];
    face.forEach((l, r) => text(11, 1 + r, l, state === 'looking' ? C(RED, 15) : state === 'turning' ? C(YEL, 15) : C(WHITE, 12)));
    text(2, 6, state === 'looking' ? 'THE CLERK IS WATCHING YOU' : state === 'turning' ? 'they\'re turning round...' : 'the clerk\'s looking away', state === 'looking' ? C(RED, 15) : C(GRAY, 11));
    for (let x = 0; x < W; x++) put(x, 8, x / W < grab ? '#' : '.', x / W < grab ? C(GREEN, 14) : C(GRAY, 6));
  };
  g.status = () => 'HOLD SPACE to pocket it while they look away   let go when they turn';
  g.reward = () => 0;
  return g;
};
// lockpicking: four pins, each sprung down. Hold UP to push the current one up and SPACE to set it while it's at
// the shear line; push it past the top and the pick slips. Three slips (or the clock) and the lock jams.
GAMES.lockpick = (rnd = Math.random) => {
  const W = 26, H = 14, PINS = 4, g = { id: 'lockpick', title: 'LOCKPICK', W, H, score: 0, over: false, success: false, crime: true };
  const shear = Array.from({ length: PINS }, () => 0.5 + rnd() * 0.3), h = Array(PINS).fill(0);
  let cur = 0, slips = 0, t = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    h[cur] = k.up ? h[cur] + dt * 0.9 : Math.max(0, h[cur] - dt * 0.6); // pushed up, or springing back
    if (h[cur] > 1) { slips++; h[cur] = 0; ev.push('wrong'); if (slips >= 3) { g.over = true; ev.push('die'); return ev; } }
    if (k.actP) {
      if (Math.abs(h[cur] - shear[cur]) < 0.07) { cur++; g.score++; ev.push('place'); if (cur >= PINS) { g.over = g.success = true; ev.push('clear'); } }
      else { slips++; h[cur] = 0; ev.push('wrong'); if (slips >= 3) { g.over = true; ev.push('die'); } }
    }
    if (t > 40 && !g.over) { g.over = true; ev.push('die'); }
    return ev;
  };
  g.draw = (put, text) => {
    for (let p = 0; p < PINS; p++) {
      const x = 4 + p * 5, top = 2, bot = 11, sy = Math.round(bot - shear[p] * (bot - top)), py = Math.round(bot - (p < cur ? shear[p] : h[p]) * (bot - top));
      for (let y = top; y <= bot; y++) put(x, y, y === sy ? '=' : '|', y === sy ? C(YEL, 13) : C(GRAY, 6));
      put(x, py, p < cur ? '#' : p === cur ? '@' : 'o', p < cur ? C(GREEN, 15) : p === cur ? C(WHITE, 15) : C(GRAY, 10), p === cur ? C(GRAY, 4) : NONE);
    }
    text(0, 13, `slips ${'x'.repeat(slips)}${'.'.repeat(3 - slips)}   ${Math.max(0, 40 - t) | 0}s`, C(slips ? RED : GRAY, 12));
  };
  g.status = () => 'HOLD UP to push the pin, SPACE to set it on the line';
  g.reward = () => 0;
  g.state = () => ({ h, shear, cur, slips });
  return g;
};

// breaking out of jail: sneak from your cell (bottom left) to the door (top right) while a guard walks his rounds
// with a flashlight. Crates block the beam. Step into the light, or bump into him, and he's got you. One cell per
// arrow press (held, it repeats). 45 seconds before the shift changes and they count heads.
GAMES.jailbreak = (rnd = Math.random) => {
  const W = 30, H = 13, g = { id: 'jailbreak', title: 'JAILBREAK', W, H, score: 0, over: false, success: false, crime: true };
  const cell = (x, y) => y * W + x, solid = new Set();
  for (let x = 0; x < W; x++) solid.add(cell(x, 0)).add(cell(x, 10));
  for (let y = 0; y <= 10; y++) solid.add(cell(0, y)).add(cell(W - 1, y));
  const CRATES = [[[7, 4], [8, 4], [7, 5]], [[13, 6], [14, 6], [14, 5]], [[19, 3], [19, 4]], [[22, 7], [23, 7], [23, 6]], [[10, 8], [11, 8]], [[17, 8]], [[25, 4], [25, 5]], [[4, 5], [4, 6]]];
  for (const grp of CRATES) for (const [x, y] of grp) solid.add(cell(x, y));
  const door = [W - 2, 1], you = [2, 9], ROUTE = [[3, 2], [26, 2], [26, 8], [3, 8]];
  let gx = 3, gy = 2, leg = 1, wait = 0, fx_ = 1, fy_ = 0, t = 0, rep = 0;
  const lit = new Set();
  const clear = (x0, y0, x1, y1) => { // nothing solid on the way from (x0, y0) to (x1, y1)
    for (let s = 1; s < 8; s++) { const x = Math.round(x0 + (x1 - x0) * s / 8), y = Math.round(y0 + (y1 - y0) * s / 8); if (solid.has(cell(x, y)) && !(x === x1 && y === y1)) return false; }
    return true;
  };
  const shine = () => { // the cone: eight cells ahead, widening as it goes
    lit.clear();
    const ox = Math.round(gx), oy = Math.round(gy);
    for (let d = 1; d <= 8; d++) for (let o = -((d + 1) >> 1); o <= (d + 1) >> 1; o++) {
      const x = ox + fx_ * d - fy_ * o, y = oy + fy_ * d + fx_ * o;
      if (x < 0 || y < 0 || x >= W || y > 10 || solid.has(cell(x, y)) || !clear(ox, oy, x, y)) continue;
      lit.add(cell(x, y));
    }
  };
  shine();
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    // you: a cell per press, repeating while held
    const dir = k.leftP || k.left ? [-1, 0] : k.rightP || k.right ? [1, 0] : k.upP || k.up ? [0, -1] : k.downP || k.down ? [0, 1] : null;
    if (k.leftP || k.rightP || k.upP || k.downP) rep = 0;
    if (dir && (rep -= dt) <= 0) {
      rep = 0.16;
      const nx = you[0] + dir[0], ny = you[1] + dir[1];
      if (!solid.has(cell(nx, ny))) { you[0] = nx; you[1] = ny; ev.push('hop'); } else ev.push('bump');
    }
    // the guard: along his round, pausing at each corner to look about
    if (wait > 0) { wait -= dt; if (wait < 0.5) { const n = ROUTE[leg]; fx_ = Math.sign(n[0] - gx); fy_ = Math.sign(n[1] - gy); } }
    else {
      const [tx, ty] = ROUTE[leg], d = Math.hypot(tx - gx, ty - gy), s = Math.min(d, 3.2 * dt);
      fx_ = Math.sign(tx - gx); fy_ = Math.sign(ty - gy);
      gx += fx_ * s; gy += fy_ * s;
      if (d - s < 1e-6) { leg = (leg + 1) % ROUTE.length; wait = 1.1; }
    }
    shine();
    if (you[0] === door[0] && you[1] === door[1]) { g.over = g.success = true; g.score = 1; ev.push('clear'); return ev; }
    if (lit.has(cell(you[0], you[1])) || Math.abs(gx - you[0]) + Math.abs(gy - you[1]) < 1.2 || t > 45) { g.over = true; ev.push('die'); }
    return ev;
  };
  g.draw = (put, text) => {
    for (let y = 0; y <= 10; y++) for (let x = 0; x < W; x++) {
      const i = cell(x, y);
      if (solid.has(i)) { const wall = x === 0 || y === 0 || x === W - 1 || y === 10; put(x, y, wall ? '#' : '=', wall ? C(GRAY, 8) : C(BRICK, 12), wall ? C(GRAY, 2) : C(BRICK, 3)); }
      else if (lit.has(i)) put(x, y, '.', C(YEL, 12), C(YEL, 3));
    }
    put(door[0], door[1], 'D', C(GREEN, 15), C(GREEN, 4));
    put(Math.round(gx), Math.round(gy), 'G', C(BLUE, 15), C(BLUE, 4));
    put(you[0], you[1], '@', C(WHITE, 15), lit.has(cell(you[0], you[1])) ? C(RED, 6) : NONE);
    text(0, 12, `${Math.max(0, 45 - t) | 0}s till the head count`, C(t > 35 ? RED : GRAY, 12));
  };
  g.status = () => 'ARROWS sneak to the door (D). Stay out of the light.';
  g.reward = () => 0;
  g.state = () => ({ you, gx, gy, lit, door, solid, t });
  return g;
};

// ---- the Sunset Pier's booths. Like the cabinets: a credit a go, tickets for how you did.
// ring toss: rows of bottles; the ring swings back and forth in front of you, GO throws it straight up the board.
// It lands on a bottle neck only if it's dead on (the far rows count double). Six rings.
GAMES.ringtoss = (rnd = Math.random) => {
  const W = 29, H = 12, ROWS = [2, 4, 6], g = { id: 'ringtoss', title: 'RING TOSS', W, H, score: 0, over: false };
  const necks = [];
  for (const y of ROWS) for (let x = 2 + (y >> 1 & 1) * 2; x < W - 1; x += 4) necks.push({ x, y, ringed: false });
  let rings = 6, aim = 1, dir = 1, speed = 11, fly = null, hits = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    if (fly) { // up the board, landing on its row
      fly.y -= dt * 22;
      if (fly.y <= fly.to) {
        const n = necks.find(q => q.x === fly.x && q.y === fly.to && !q.ringed);
        if (n) { n.ringed = true; hits++; g.score += n.y === ROWS[0] ? 2 : 1; ev.push('score'); } else ev.push('miss');
        fly = null;
        if (rings === 0) { g.over = true; ev.push('end'); }
      }
      return ev;
    }
    aim += dir * speed * dt;
    if (aim < 1 || aim > W - 2) { dir = -dir; aim = clamp(aim, 1, W - 2); }
    if (k.actP && rings > 0) { rings--; fly = { x: Math.round(aim), y: H - 2, to: ROWS[rnd() * 3 | 0] }; speed *= 1.08; ev.push('launch'); }
    return ev;
  };
  g.draw = (put, text) => {
    for (let x = 0; x < W; x++) put(x, H - 3, '-', C(BRICK, 6)); // the line you throw from
    for (const n of necks) { put(n.x, n.y, n.ringed ? 'O' : 'i', n.ringed ? C(YEL, 15) : C(GREEN, 12)); put(n.x, n.y + 1, 'U', C(GREEN, 8)); }
    if (fly) put(fly.x, Math.round(fly.y), 'o', C(YEL, 15));
    else if (rings) { put(Math.round(aim), H - 2, 'O', C(YEL, 15)); put(Math.round(aim), H - 1, '^', C(WHITE, 10)); }
    text(0, 0, `rings: ${'O'.repeat(rings)}${'.'.repeat(6 - rings)}`, C(WHITE, 13));
  };
  g.status = () => `RINGED ${hits}   POINTS ${g.score}   SPACE throw`;
  g.reward = () => g.score * 4;
  return g;
};
// high striker: the power meter swings up and down; GO brings the mallet down at whatever it's at, and the puck
// flies that high up the tower. Ring the bell (the very top) for the big prize. Three swings.
const STRIKER_MARKS = [[0.95, 'DING!'], [0.8, 'HERCULES'], [0.6, 'STRONGMAN'], [0.4, 'NOT BAD'], [0.2, 'TICKLE'], [0, 'WEAKLING']];
GAMES.strength = (rnd = Math.random) => {
  const W = 26, H = 14, TOP = 1, BOT = H - 2, g = { id: 'strength', title: 'HIGH STRIKER', W, H, score: 0, over: false };
  let swings = 3, power = 0, t = rnd() * 3, puck = null, best = 0, last = '';
  const meter = g.meter = () => 0.5 - 0.5 * Math.cos(t * (3.2 + (3 - swings) * 0.8)); // faster each swing
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (puck) {
      puck.h += (puck.up ? 1 : -1) * dt * 2.2;
      if (puck.up && puck.h >= puck.to) {
        puck.up = false; puck.h = puck.to; last = STRIKER_MARKS.find(m => puck.to >= m[0])[1];
        g.score += puck.to >= 0.95 ? 10 : puck.to >= 0.8 ? 5 : puck.to >= 0.6 ? 3 : puck.to >= 0.4 ? 1 : 0;
        ev.push(puck.to >= 0.95 ? 'clear' : 'bump');
      }
      if (!puck.up && puck.h <= 0) { puck = null; if (swings === 0) { g.over = true; ev.push('end'); } }
      return ev;
    }
    power = meter();
    if (k.actP && swings > 0) { swings--; puck = { h: 0, to: power, up: true }; best = Math.max(best, power); ev.push('brick'); }
    return ev;
  };
  g.draw = (put, text) => {
    const row = h => Math.round(BOT - h * (BOT - TOP));
    for (let y = TOP; y <= BOT; y++) put(13, y, '|', C(GRAY, 9)); // the tower
    put(13, TOP, '@', puck && !puck.up && puck.to >= 0.95 ? C(YEL, 15) : C(YEL, 9)); // the bell
    for (const [h, name] of STRIKER_MARKS.slice(1)) text(15, row(h), name, C([RED, ORANGE, YEL, GREEN, CYAN][STRIKER_MARKS.findIndex(m => m[1] === name) - 1], 11));
    put(13, row(puck ? puck.h : 0), '#', C(RED, 15));
    put(12, BOT + 1, '=', C(BRICK, 12)); put(13, BOT + 1, '=', C(BRICK, 12)); put(14, BOT + 1, '=', C(BRICK, 12));
    const m = puck ? 0 : power; // the meter, left
    for (let y = TOP; y <= BOT; y++) { const on = y >= row(m); put(4, y, on ? '#' : ':', on ? C(y < row(0.8) ? RED : y < row(0.5) ? YEL : GREEN, 14) : C(GRAY, 5)); }
    text(0, 0, `swings ${'*'.repeat(swings)}${'.'.repeat(3 - swings)}`, C(WHITE, 13));
    if (last) text(0, BOT + 1, last, C(YEL, 15));
  };
  g.status = () => `POINTS ${g.score}   BEST ${Math.round(best * 100)}%   SPACE swing`;
  g.reward = () => g.score * 2;
  return g;
};
const FAIR_GAMES = ['ringtoss', 'strength'];

// ---- the Shotengai's parlours
// pachinko: hold GO and balls fly up and rain down through a forest of pins; steer where they come in with the
// stick. Most fall away. The pockets pay balls back; the middle one spins the reels, and three of a kind is FEVER.
// A credit buys 40 balls; walk away (E) whenever you like and what's left is swapped for tickets, 8 balls a ticket.
GAMES.pachinko = (rnd = Math.random) => {
  const W = 23, H = 20, g = { id: 'pachinko', title: 'PACHINKO', W, H, score: 40, over: false };
  const pin = (x, y) => y >= 3 && y <= 15 && y % 2 === 1 && (x + (y >> 1)) % 2 === 0 && x > 0 && x < W - 1;
  const POCKETS = { 11: 'start', 4: 'small', 5: 'small', 17: 'small', 18: 'small' }; // which bottom columns catch a ball
  // tuned by simulation: aim for the red START pocket and a tray lasts a good while, coming out about even (a jackpot
  // or two and you're well up); spray balls about and it drains, but not as fast as it used to
  const PAY = { small: 3, start: 5 }, START = g.score;
  // what just happened, drawn so you can't miss it: a +N where a ball dropped into a pocket, an x where one drained,
  // and the reel's verdict (MISS, or 777 FEVER)
  let aim = 11, fire = 0, balls = [], tick = 0, reel = null, fever = 0, best = '', pops = [], verdict = null;
  g.pops = () => pops; g.verdict = () => verdict; // (for the tests)
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    if (k.left) aim = Math.max(1, aim - dt * 8); if (k.right) aim = Math.min(W - 2, aim + dt * 8);
    fire -= dt;
    if (k.act && fire <= 0 && g.score > 0) { g.score--; fire = 0.22; balls.push({ x: Math.round(aim), y: 1 }); ev.push('launch'); }
    tick += dt;
    while (tick > 0.06) { // every ball falls a row; a pin bumps it one way or the other
      tick -= 0.06;
      for (const b of balls) {
        if (pin(b.x, b.y + 1) && rnd() < 0.7) { b.x = clamp(b.x + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.3 ? 2 : 1), 1, W - 2); ev.push('bump'); } // (a ball can slip past a pin)
        b.y++;
      }
      for (const b of balls.filter(b => b.y >= H - 2)) {
        let p = POCKETS[b.x];
        if (!p && rnd() < luck() * 2.5) for (const o of [-1, 1]) if (POCKETS[b.x + o]) { p = POCKETS[b.x + o]; break; } // (lucky: it rolls in after all)
        if (p === 'small') { g.score += PAY.small; ev.push('eat'); }
        if (p === 'start') { g.score += PAY.start; ev.push('score'); if (!reel) reel = { t: 1.6, r: [0, 1, 2].map(() => 1 + (rnd() * 7 | 0)), hit: rnd() < 0.1 + luck() * 0.5 }; }
        pops.push(p ? { x: b.x, text: `+${PAY[p]}`, col: p === 'start' ? YEL : GREEN, t: 0.9 } : { x: b.x, text: 'x', col: GRAY, t: 0.5 });
        b.dead = true;
      }
      balls = balls.filter(b => !b.dead);
    }
    if (reel && (reel.t -= dt) <= 0) {
      if (reel.hit) { reel.r = [7, 7, 7]; g.score += 50; fever = 3; ev.push('clear'); best = 'FEVER! 777'; verdict = { text: '777 JACKPOT  +50 BALLS', col: MAG, t: 3 }; }
      else { if (reel.r[0] === reel.r[1] && reel.r[1] === reel.r[2]) reel.r[2] = reel.r[2] % 7 + 1; ev.push('miss'); verdict = { text: 'no match', col: GRAY, t: 1.2 }; } // (three alike that isn't a win would be a lie)
      reel.shown = reel.r; reel = null;
    }
    fever = Math.max(0, fever - dt);
    for (const q of pops) q.t -= dt; pops = pops.filter(q => q.t > 0);
    if (verdict && (verdict.t -= dt) <= 0) verdict = null;
    if (g.score <= 0 && !balls.length && !reel) { g.over = true; ev.push('end'); }
    if (reel) g.lastReel = reel.r.map((v, i) => reel.t > 0.4 + i * 0.4 ? 1 + (rnd() * 9 | 0) : v); // the reels spinning, stopping one by one
    return ev;
  };
  g.draw = (put, text) => {
    for (let y = 0; y < H; y++) { put(0, y, '|', C(GRAY, 9)); put(W - 1, y, '|', C(GRAY, 9)); }
    for (let y = 3; y <= 15; y++) for (let x = 1; x < W - 1; x++) if (pin(x, y)) put(x, y, '.', C(YEL, fever > 0 ? 15 : 10));
    for (let x = 1; x < W - 1; x++) { const p = POCKETS[x]; put(x, H - 1, p ? 'U' : '_', p === 'start' ? C(RED, 15) : p ? C(GREEN, 14) : C(GRAY, 6)); }
    put(Math.round(aim), 0, 'v', C(WHITE, 15));
    for (const b of balls) put(b.x, b.y, 'o', C(WHITE, 15));
    for (const q of pops) text(Math.max(1, q.x - (q.text.length > 1 ? 1 : 0)), H - 2 - (q.text === 'x' ? 0 : Math.round((0.9 - q.t) * 3)), q.text, C(q.col, q.text === 'x' ? 8 : 15));
    const r = g.lastReel || [7, 7, 7];
    text(8, 17, `[ ${r.join(' ')} ]`, reel ? C(YEL, 15) : fever > 0 ? C(NEON[(Math.floor(fever * 8)) & 3], 15) : C(WHITE, 11));
    if (reel) text(6, 16, 'reels spinning...', C(YEL, 12));
    else if (verdict) text(Math.max(1, (W - verdict.text.length) >> 1), 16, verdict.text, C(verdict.col === MAG ? NEON[Math.floor(T * 8) & 3] : verdict.col, 15));
    const up = g.score - START; // how you're doing against the tray you started with
    text(1, 1, `BALLS ${g.score}`, C(WHITE, 14)); text(13, 1, up === 0 ? 'EVEN' : `${up > 0 ? 'UP +' : 'DOWN '}${up}`, C(up > 0 ? GREEN : up < 0 ? RED : GRAY, 15));
    if (best && fever > 0) text(7, 2, best, C(MAG, 15));
  };
  g.status = () => `BALLS ${g.score} = ${g.reward()} TICKETS   HOLD SPACE fire   ARROWS aim (the red U spins the reels)   E cash out`;
  g.reward = () => Math.floor(g.score / 8);
  return g;
};
// the crane game: steer the claw over a prize, GO drops it. It grips, maybe, and carries it to the chute; one try a
// credit. What it drops in the chute is yours.
const CRANE_PRIZES = ['plushcat', 'plushbear', 'sharkplush', 'duck', 'plushcat', 'yoyo'];
GAMES.crane = (rnd = Math.random) => {
  const W = 22, H = 14, g = { id: 'crane', title: 'CRANE GAME', W, H, score: 0, over: false, prize: null };
  const pile = Array.from({ length: 6 }, (_, k) => ({ x: 5 + k * 3 + (rnd() * 2 | 0), id: CRANE_PRIZES[rnd() * CRANE_PRIZES.length | 0] }));
  let cx = 3, cy = 1, state = 'aim', held = null, t = 0;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (state === 'aim') {
      if (k.left) cx = Math.max(2, cx - dt * 6); if (k.right) cx = Math.min(W - 2, cx + dt * 6);
      if (k.actP || t > 20) { state = 'down'; ev.push('launch'); }
    } else if (state === 'down') {
      cy += dt * 6;
      if (cy >= H - 3) {
        cy = H - 3; state = 'up';
        const p = pile.find(q => Math.abs(q.x - cx) <= 1);
        if (p && rnd() < 0.5) { held = p; pile.splice(pile.indexOf(p), 1); ev.push('place'); } else ev.push('bump');
      }
    } else if (state === 'up') {
      cy -= dt * 5;
      if (held && cy < 4 && rnd() < dt * 0.25) { pile.push({ ...held, x: Math.round(cx) }); held = null; ev.push('miss'); } // it slips...
      if (cy <= 1) { cy = 1; state = 'home'; }
    } else if (state === 'home') {
      cx -= dt * 6;
      if (cx <= 1) {
        g.over = true;
        if (held) { g.prize = held.id; g.score = 1; ev.push('clear'); } else ev.push('end');
      }
    }
    return ev;
  };
  g.draw = (put, text) => {
    for (let x = 0; x < W; x++) put(x, 0, '=', C(GRAY, 10));
    put(0, H - 2, '\\', C(GRAY, 10)); put(1, H - 2, '_', C(GRAY, 10)); put(1, H - 1, 'v', C(YEL, 13)); // the chute
    const x = Math.round(cx), y = Math.round(cy);
    for (let r = 1; r < y; r++) put(x, r, '|', C(GRAY, 12));
    put(x - 1, y, held ? '[' : '/', C(WHITE, 15)); put(x + 1, y, held ? ']' : '\\', C(WHITE, 15));
    if (held) put(x, y + 1, '@', C(ITEM_COL[CRANE_PRIZES.indexOf(held.id) & 7], 15));
    for (const p of pile) put(p.x, H - 2, '@', C(ITEM_COL[CRANE_PRIZES.indexOf(p.id) & 7], 14));
    for (let x2 = 2; x2 < W; x2++) put(x2, H - 1, '#', C(MAG, 5));
  };
  g.status = () => state === 'aim' ? `ARROWS move the claw   SPACE drop (${Math.max(0, 20 - t) | 0}s)` : state === 'home' && held ? 'Got one... got one...' : '...';
  g.reward = () => 0;
  return g;
};

// ---- mahjong, the simple version: three suits (dots o, bamboo |, characters #) numbered 1-9, four of each, 108
// tiles. Four players, 13 tiles each; on your turn you draw one and discard one. 14 tiles that make four sets (three
// the same, or a run of three in one suit) and a pair is mahjong: you win the pot. You can also win off another
// player's discard if it's the tile you were waiting for. No other claiming, no honours, no scoring: just that.
const MJ_SUITS = ['o', '|', '#'], MJ_NAMES = ['YOU', 'WONG', 'MEI', 'LO'];
const mjName = t => `${t % 9 + 1}${MJ_SUITS[t / 9 | 0]}`;
function mjSets(c) { // can these counts be split entirely into sets of three?
  const i = c.findIndex(v => v > 0);
  if (i < 0) return true;
  if (c[i] >= 3) { c[i] -= 3; const ok = mjSets(c); c[i] += 3; if (ok) return true; }
  if (i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; const ok = mjSets(c); c[i]++; c[i + 1]++; c[i + 2]++; if (ok) return true; }
  return false;
}
function mjWins(tiles) { // 14 tiles: four sets and a pair?
  if (tiles.length !== 14) return false;
  const c = new Array(27).fill(0);
  for (const t of tiles) c[t]++;
  for (let p = 0; p < 27; p++) if (c[p] >= 2) { c[p] -= 2; const ok = mjSets(c); c[p] += 2; if (ok) return true; }
  return false;
}
// what a 13-tile hand is waiting for (any tile that would complete it, that isn't all used up in it)
const mjWaits = hand => Array.from({ length: 27 }, (_, t) => t).filter(t => hand.filter(x => x === t).length < 4 && mjWins([...hand, t]));
// which tile an opponent throws away: the one doing least for its hand (alone, far from its neighbours)
function mjDiscard(hand, rnd) {
  let best = 0, bv = Infinity;
  hand.forEach((t, k) => {
    const n = d => hand.some((x, j) => j !== k && x === t + d && (x / 9 | 0) === (t / 9 | 0));
    const v = (hand.filter(x => x === t).length - 1) * 3 + (n(-1) + n(1)) * 2 + (n(-2) + n(2)) + (t % 9 === 0 || t % 9 === 8 ? -0.3 : 0) + rnd() * 0.2;
    if (v < bv) { bv = v; best = k; }
  });
  return best;
}
GAMES.mahjong = (rnd = Math.random) => {
  const W = 32, H = 19, g = { id: 'mahjong', title: 'MAHJONG', W, H, score: 0, over: false, result: null };
  const wall = [];
  for (let t = 0; t < 27; t++) for (let k = 0; k < 4; k++) wall.push(t);
  for (let i = wall.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [wall[i], wall[j]] = [wall[j], wall[i]]; }
  const hands = [0, 1, 2, 3].map(() => wall.splice(0, 13).sort((a, b) => a - b)), rivers = [[], [], [], []];
  let turn = 0, state = 'you', wait = 0, cur = 0, drawn = null, last = null, msg = 'Your turn. Draw done: pick a tile to throw away.';
  const sortHand = h => h.sort((a, b) => a - b);
  const end = (winner, how) => { g.over = true; g.result = { winner, how }; g.score = winner === 0 ? 1 : 0; };
  const draw = p => {
    if (!wall.length) { end(-1, 'the wall ran out'); return null; }
    if (p === 0 && hands[0].length === 13 && rnd() < luck()) { // lucky: the tile you're waiting on turns up, if it's near the top of the wall
      const ws = mjWaits(hands[0]), k = wall.slice(0, 6).findIndex(t => ws.includes(t));
      if (k > 0) [wall[0], wall[k]] = [wall[k], wall[0]];
    }
    const t = wall.shift(); hands[p].push(t); return t;
  };
  drawn = draw(0); cur = hands[0].indexOf(drawn); sortHand(hands[0]); cur = hands[0].lastIndexOf(drawn);
  // a discard by p: does anyone want it to win? (you first, then the others in turn order)
  const afterDiscard = (p, t) => {
    last = { p, t };
    if (p !== 0 && mjWins([...hands[0], t])) { state = 'claim'; wait = 3.5; msg = `${MJ_NAMES[p]} throws ${mjName(t)}: that's your winning tile! UP to claim it`; return; }
    for (let q = 1; q <= 3; q++) if (q !== p && mjWins([...hands[q], t])) { hands[q].push(t); end(q, `on ${MJ_NAMES[p] === 'YOU' ? 'your' : MJ_NAMES[p] + "'s"} discard`); return; }
    next(p);
  };
  const next = p => {
    turn = (p + 1) % 4;
    if (turn === 0) { drawn = draw(0); if (g.over) return; sortHand(hands[0]); cur = hands[0].lastIndexOf(drawn); state = 'you'; msg = `You draw ${mjName(drawn)}.`; }
    else { state = 'ai'; wait = 0.7; }
  };
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    if (state === 'you') {
      if (k.leftP) cur = (cur + 13) % 14; if (k.rightP) cur = (cur + 1) % 14;
      if (k.upP && mjWins(hands[0])) { end(0, 'by drawing it yourself'); ev.push('clear'); return ev; }
      if (k.actP) { const t = hands[0].splice(cur, 1)[0]; rivers[0].push(t); cur = Math.min(cur, 12); msg = `You throw ${mjName(t)}.`; ev.push('place'); afterDiscard(0, t); }
    } else if (state === 'claim') {
      wait -= dt;
      if (k.upP) { hands[0].push(last.t); sortHand(hands[0]); end(0, `on ${MJ_NAMES[last.p]}'s discard`); ev.push('clear'); return ev; }
      if (wait <= 0 || k.actP) { msg = 'You let it go.'; next(last.p); }
    } else if (state === 'ai' && (wait -= dt) <= 0) { // an opponent's go: draw, maybe win, discard
      const p = turn, t = draw(p);
      if (g.over) return ev;
      if (mjWins(hands[p])) { end(p, 'by drawing it'); ev.push('die'); return ev; }
      const d = hands[p].splice(mjDiscard(hands[p], rnd), 1)[0];
      rivers[p].push(d); msg = `${MJ_NAMES[p]} throws ${mjName(d)}.`; ev.push('bump');
      afterDiscard(p, d);
      if (g.over) ev.push('die');
    }
    return ev;
  };
  const SUIT_COL = [RED, GREEN, BLUE];
  const tileText = (text, x, y, t, hi) => text(x, y, mjName(t), C(SUIT_COL[t / 9 | 0], hi ? 15 : 12));
  g.draw = (put, text) => {
    // the other three: how many tiles, and what they've thrown away (the last discard picked out)
    for (let p = 1; p <= 3; p++) {
      const y = (p - 1) * 2;
      text(0, y, `${turn === p && !g.over ? '>' : ' '}${MJ_NAMES[p]} [${hands[p].length}]`, C(turn === p ? YEL : WHITE, 13));
      const rv = rivers[p].slice(-11);
      rv.forEach((t, k) => tileText(text, 6 + k * 2, y, t, last && last.p === p && k === rv.length - 1));
    }
    text(0, 6, ` YOUR THROWS`, C(GRAY, 10));
    rivers[0].slice(-11).forEach((t, k) => tileText(text, 6 + k * 2, 6, t, false));
    text(0, 8, `WALL ${wall.length}`, C(GRAY, 11));
    text(0, 9, msg.slice(0, 62), C(WHITE, 14));
    // your hand: fourteen (or thirteen) tiles across the bottom, the one you're on raised
    const hand = hands[0];
    hand.forEach((t, k) => {
      const sel = state === 'you' && k === cur, y = sel ? 11 : 12;
      put(1 + k * 2, y, ' ', 0, C(WHITE, sel ? 15 : 11)); text(1 + k * 2, y, mjName(t), C(SUIT_COL[t / 9 | 0], 5)); // an ivory tile, its number and suit
    });
    if (state === 'you') text(1 + cur * 2, 13, '^^', C(YEL, 15));
    // the help: what you're waiting for, if you're one tile away
    const h13 = state === 'you' ? hand.filter((_, k) => k !== cur) : hand;
    const w = h13.length === 13 ? mjWaits(h13) : [];
    text(0, 15, w.length ? `${state === 'you' ? 'Throw that and you' : 'You'}'re one away! Winning tiles: ${w.map(mjName).join(' ')}` : 'Make 4 sets + a pair. A set: three alike, or a run of 3 in one suit.', C(w.length ? YEL : GRAY, w.length ? 15 : 10));
    if (state === 'you' && mjWins(hand)) text(0, 16, 'MAHJONG! You have a winning hand: press UP to declare it', C(MAG, 15));
    if (g.over && g.result) text(0, 17, g.result.winner === 0 ? `MAHJONG! You win ${g.result.how}.` : g.result.winner < 0 ? 'Nobody won: the wall ran out.' : `${MJ_NAMES[g.result.winner]} wins ${g.result.how}.`, C(g.result.winner === 0 ? YEL : WHITE, 15));
  };
  g.status = () => state === 'claim' ? `UP claim it   SPACE let it go (${Math.ceil(wait)}s)` : state === 'you' ? 'LEFT/RIGHT pick   SPACE throw it   UP declare mahjong' : 'Waiting for the others...';
  g.reward = () => g.result ? g.result.winner === 0 ? 20 : g.result.winner < 0 ? MJ_BUYIN : 0 : 0;
  g.hands = hands; g.wallLeft = () => wall.length; g.state = () => state; g.cursor = () => cur; // (for the tests)
  return g;
};
const MJ_BUYIN = 5;

// the gardeners' shift: eighteen beds, each plant drying out at its own pace, weeds creeping in (they drink the water
// twice as fast). Move round with the can: SPACE waters a plant, or pulls the weeds out first if there are any.
// A plant left dry too long wilts for good. Pay for the hours, and for every plant still standing at the end.
GAMES.garden = (rnd = Math.random) => {
  const W = 26, H = 13, g = { id: 'garden', title: 'THE GARDENERS', W, H, score: 0, over: false, shift: true };
  const beds = Array.from({ length: 18 }, (_, k) => ({ x: 2 + (k % 6) * 4, y: 2 + (k / 6 | 0) * 4, w: 0.6 + rnd() * 0.4, rate: 0.035 + rnd() * 0.04, weed: false, dead: false }));
  let cur = 0, t = 0, LEN = 60;
  g.step = (dt, k) => {
    const ev = [];
    if (g.over) return ev;
    t += dt;
    if (k.leftP && cur % 6) cur--; if (k.rightP && cur % 6 < 5) cur++; if (k.upP && cur >= 6) cur -= 6; if (k.downP && cur < 12) cur += 6;
    if (k.actP) {
      const b = beds[cur];
      if (b.dead) ev.push('wrong');
      else if (b.weed) { b.weed = false; ev.push('eat'); }
      else { b.w = 1; ev.push('place'); }
    }
    for (const b of beds) {
      if (b.dead) continue;
      b.w -= dt * b.rate * (b.weed ? 2 : 1);
      if (!b.weed && rnd() < dt * 0.025) b.weed = true;
      if (b.w <= 0) { b.dead = true; ev.push('miss'); }
      if (b.w > 0.5) g.score += dt; // time spent looking good
    }
    if (t >= LEN) { g.over = true; ev.push('end'); }
    return ev;
  };
  g.alive = () => beds.filter(b => !b.dead).length;
  g.beds = beds; g.cursor = () => cur; // (for the tests)
  g.draw = (put, text) => {
    for (let x = 0; x < W; x++) { put(x, 0, '"', C(GREEN, 6)); put(x, H - 1, '"', C(GREEN, 6)); }
    beds.forEach((b, k) => {
      for (let dx = -1; dx <= 1; dx++) put(b.x + dx, b.y + 1, '#', C(BRICK, 7), C(BRICK, 2)); // the bed
      const ch = b.dead ? 'x' : b.w > 0.5 ? '*' : b.w > 0.2 ? ',' : '.', col = b.dead ? C(BRICK, 8) : b.w > 0.5 ? C([MAG, YEL, RED, WHITE][k & 3], 15) : b.w > 0.2 ? C(YEL, 11) : C(ORANGE, 9);
      put(b.x, b.y - 1, ch, col); put(b.x, b.y, b.dead ? '_' : '|', b.dead ? C(BRICK, 8) : C(GREEN, b.w > 0.2 ? 13 : 7));
      if (b.weed) { put(b.x - 1, b.y, 'w', C(GREEN, 10)); put(b.x + 1, b.y, 'w', C(GREEN, 10)); }
      const lvl = Math.max(0, Math.round(b.w * 3)); // the water gauge under it
      text(b.x - 1, b.y + 2, b.dead ? ' - ' : '~'.repeat(lvl).padEnd(3, '.'), C(CYAN, b.dead ? 4 : 12));
      if (k === cur) { put(b.x - 2, b.y, '>', C(WHITE, 15)); put(b.x + 2, b.y, '<', C(WHITE, 15)); }
    });
  };
  g.status = () => `PLANTS ${g.alive()}/18   ${Math.max(0, LEN - t) | 0}s   ARROWS move   SPACE water or weed`;
  g.reward = () => Math.max(0, Math.round((3 * Math.min(1, t / LEN) + g.alive() * 0.6 + g.score * 0.012) * 100) / 100);
  return g;
};

// which shift each room offers
const SHIFT_FOR = { diner: 'serve', cafe: 'serve', noodle: 'serve', store: 'stock', books: 'stock', bar: 'tapper', karaoke: 'tapper' };
// the cabinets in an arcade, in order, cycle through these; a credit is a dollar
const ARCADE_GAMES = ['snake', 'breakout', 'crosser', 'pong'], CREDIT = 1;

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

// ---- the casino: blackjack, roulette and slots. Each keeps going hand after hand until you get up: the game asks for
// your stake with a 'stake' event (minigame-ui.js takes the money, or calls g.refused() if you can't cover it) and
// pays out with 'payout' (g.win, the whole amount handed back). Luck (luck() in goods.js) nudges them your way a bit.
const CASINO_BETS = [5, 10, 25, 50, 100];
const betStep = (bet, dir) => CASINO_BETS[clamp(CASINO_BETS.indexOf(bet) + dir, 0, CASINO_BETS.length - 1)];
// blackjack: get closer to 21 than the dealer without going over. Picture cards are 10, an ace 1 or 11. The dealer
// draws to 17. A win pays 2 to 1 (your stake and as much again), a blackjack (21 in two cards) 3 to 2, a tie gives
// your stake back. Double: twice the stake, one more card, then you stand.
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], CARD_SUITS = 'SHDC';
const cardVal = c => Math.min(10, c % 13 + 1);
function bjTotal(hand) { let t = 0, aces = 0; for (const c of hand) { const v = cardVal(c); t += v; if (v === 1) aces++; } if (aces && t + 10 <= 21) t += 10; return t; }
function cardText(text, x, y, c, down) { // a card, three cells by four rows: rank and suit, or the back
  const red = (c / 13 | 0) % 4 === 1 || (c / 13 | 0) % 4 === 2, r = CARD_RANKS[c % 13], s = CARD_SUITS[(c / 13 | 0) % 4];
  const rows = down ? ['.----.', '|////|', '|////|', "'----'"] : ['.----.', `|${r.padEnd(4)}|`, `| ${s}  |`, `'-${r.padStart(2, '-')}-'`];
  rows.forEach((l, k) => text(x, y + k, l, down ? C(BLUE, 12) : red && k > 0 && k < 3 ? C(RED, 14) : C(WHITE, 15)));
}
GAMES.blackjack = (rnd = Math.random) => {
  const W = 32, H = 19, g = { id: 'blackjack', title: 'BLACKJACK', W, H, score: 0, over: false, bet: 10, win: 0 };
  let shoe = [], state = 'bet', you = [], dealer = [], wait = 0, doubled = false, msg = 'Place your bet.', ev = [];
  const fill = () => { shoe = []; for (let d = 0; d < 6; d++) for (let c = 0; c < 52; c++) shoe.push(c); for (let i = shoe.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; } };
  fill();
  // a card off the shoe. Lucky: you don't bust if a card near the top would have saved you; the dealer does
  const deal = (hand, who) => {
    if (shoe.length < 20) fill();
    if (who === 'you' && bjTotal([...hand, shoe[0]]) > 21 && rnd() < luck() * 2) { const k = shoe.slice(1, 5).findIndex(c => bjTotal([...hand, c]) <= 21); if (k >= 0) [shoe[0], shoe[k + 1]] = [shoe[k + 1], shoe[0]]; }
    if (who === 'dealer' && rnd() < luck()) { const t = bjTotal([...hand, shoe[0]]); if (t >= 17 && t <= 21 && t >= bjTotal(you)) { const k = shoe.slice(1, 5).findIndex(c => bjTotal([...hand, c]) > 21); if (k >= 0) [shoe[0], shoe[k + 1]] = [shoe[k + 1], shoe[0]]; } }
    hand.push(shoe.shift()); ev.push('place');
  };
  const settle = () => {
    const stake = g.bet * (doubled ? 2 : 1), y = bjTotal(you), d = bjTotal(dealer), natural = you.length === 2 && y === 21, dNatural = dealer.length === 2 && d === 21;
    g.win = y > 21 ? 0 : natural && !dNatural ? g.bet * 2.5 : dNatural && !natural ? 0 : d > 21 || y > d ? stake * 2 : y === d ? stake : 0;
    msg = y > 21 ? `Bust with ${y}. The house takes ${fmt$(stake)}.` : g.win > stake ? `${natural ? 'BLACKJACK!' : d > 21 ? `Dealer busts with ${d}.` : `${y} beats ${d}.`} You win ${fmt$(g.win - stake)}.` : g.win === stake ? `Push at ${y}. Your stake back.` : `Dealer's ${d} beats your ${y}.`;
    state = 'done'; ev.push(g.win > stake ? 'score' : g.win ? 'place' : 'miss'); if (g.win) ev.push('payout');
  };
  g.refused = () => { state = 'bet'; you = []; dealer = []; msg = "You can't cover that bet."; };
  g.inRound = () => state === 'play' || state === 'dealer';
  g.state = () => state; g.hands = () => [you, dealer]; // (for the tests)
  g.step = (dt, k) => {
    ev = [];
    if (state === 'bet' || state === 'done') {
      if (k.upP) g.bet = betStep(g.bet, 1); if (k.downP) g.bet = betStep(g.bet, -1);
      if (k.actP && money < g.bet) msg = "You can't cover that bet.";
      else if (k.actP) {
        you = []; dealer = []; doubled = false; g.win = 0; ev.push('stake');
        deal(you, 'you'); deal(dealer, 'dealer'); deal(you, 'you'); deal(dealer, 'dealer');
        state = 'play'; msg = 'UP hit   SPACE stand   DOWN double';
        if (bjTotal(you) === 21 || bjTotal(dealer) === 21) { state = 'dealer'; wait = 0.6; }
      }
    } else if (state === 'play') {
      if (k.upP) { deal(you, 'you'); if (bjTotal(you) > 21) settle(); else if (bjTotal(you) === 21) { state = 'dealer'; wait = 0.5; } }
      else if (k.downP && you.length === 2 && money < g.bet) msg = "You can't cover doubling. UP hit, SPACE stand.";
      else if (k.downP && you.length === 2) { doubled = true; ev.push('double'); deal(you, 'you'); if (bjTotal(you) > 21) settle(); else { state = 'dealer'; wait = 0.5; } }
      else if (k.actP) { state = 'dealer'; wait = 0.4; }
    } else if (state === 'dealer' && (wait -= dt) <= 0) {
      if (bjTotal(dealer) < 17 && !(you.length === 2 && bjTotal(you) === 21)) { deal(dealer, 'dealer'); wait = 0.6; } else settle();
    }
    return ev;
  };
  g.draw = (put, text) => {
    const hide = state === 'play'; // the dealer's second card stays face down till you stand
    text(0, 0, `DEALER${hide ? '' : '  ' + bjTotal(dealer)}`, C(WHITE, 13));
    dealer.forEach((c, i) => cardText(text, 1 + i * 4, 1, c, hide && i === 1));
    text(0, 6, `YOU  ${you.length ? bjTotal(you) : ''}${doubled ? '   (doubled)' : ''}`, C(YEL, 14));
    you.forEach((c, i) => cardText(text, 1 + i * 4, 7, c, false));
    for (let x = 0; x < W; x++) put(x, 12, '=', C(GREEN, 6));
    text(0, 13, msg.slice(0, 62), C(WHITE, 15));
    text(0, 15, `BET ${fmt$(g.bet)}${state === 'bet' || state === 'done' ? '   UP/DOWN change it' : ''}`, C(YEL, 14));
    text(0, 16, `CASH ${fmt$(money)}`, C(GREEN, 13));
    if (luck() > 0) text(0, 17, 'Your jade feels warm.', C(GREEN, 9));
  };
  g.status = () => state === 'play' ? 'UP hit   SPACE stand   DOWN double   E leave' : `SPACE deal (${fmt$(g.bet)})   UP/DOWN bet   E leave`;
  g.reward = () => 0;
  return g;
};
// roulette: a European wheel, 0 to 36. Bet on a colour, odd or even, a half, a dozen, or a single number; the ball
// goes round, slows, drops. Even money for the halves, 2 to 1 for a dozen, 35 to 1 for a number. Lucky: a losing
// spin sometimes gets a second go
const RL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const RL_WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RL_BETS = [['RED', n => RL_RED.has(n), 2], ['BLACK', n => n > 0 && !RL_RED.has(n), 2], ['ODD', n => n % 2 === 1, 2], ['EVEN', n => n > 0 && n % 2 === 0, 2],
  ['1-18', n => n >= 1 && n <= 18, 2], ['19-36', n => n >= 19, 2], ['1ST 12', n => n >= 1 && n <= 12, 3], ['2ND 12', n => n >= 13 && n <= 24, 3], ['3RD 12', n => n >= 25, 3],
  ['7', n => n === 7, 36], ['17', n => n === 17, 36], ['ZERO', n => n === 0, 36]];
const rlCol = n => n === 0 ? GREEN : RL_RED.has(n) ? RED : GRAY;
GAMES.roulette = (rnd = Math.random) => {
  const W = 32, H = 19, g = { id: 'roulette', title: 'ROULETTE', W, H, score: 0, over: false, bet: 10, win: 0 };
  let state = 'bet', pick_ = 0, pos = 0, spinT = 0, spinLen = 0, start = 0, target = 0, result = null, msg = 'Pick a bet, then spin.', ev = [];
  g.refused = () => { state = 'bet'; msg = "You can't cover that bet."; };
  g.inRound = () => state === 'spin';
  g.state = () => state; g.result = () => result; g.choose = k => { pick_ = k; }; // (for the tests)
  g.step = (dt, k) => {
    ev = [];
    if (state === 'bet' || state === 'done') {
      if (k.leftP) pick_ = (pick_ + RL_BETS.length - 1) % RL_BETS.length; if (k.rightP) pick_ = (pick_ + 1) % RL_BETS.length;
      if (k.upP) g.bet = betStep(g.bet, 1); if (k.downP) g.bet = betStep(g.bet, -1);
      if (k.actP && money < g.bet) msg = "You can't cover that bet.";
      else if (k.actP) {
        ev.push('stake'); g.win = 0; result = null;
        let n = RL_WHEEL[rnd() * 37 | 0];
        if (!RL_BETS[pick_][1](n) && rnd() < luck()) n = RL_WHEEL[rnd() * 37 | 0]; // (lucky: another go)
        target = RL_WHEEL.indexOf(n); start = pos; spinLen = 3.2 + rnd() * 0.8; spinT = 0; state = 'spin'; msg = 'No more bets...';
        target = Math.round(start) + ((RL_WHEEL.indexOf(n) - Math.round(start) % 37) + 37) % 37 + 37 * 3; // three times round, then on to it
      }
    } else if (state === 'spin') {
      spinT += dt; const p = Math.min(1, spinT / spinLen), e = 1 - (1 - p) ** 3; // slowing down
      const np = start + (target - start) * e; if (Math.floor(np) !== Math.floor(pos)) ev.push('bump'); pos = np;
      if (p >= 1) {
        result = RL_WHEEL[Math.round(target) % 37]; const [name, wins, pays] = RL_BETS[pick_];
        g.win = wins(result) ? g.bet * pays : 0; state = 'done';
        msg = `${result} ${result === 0 ? 'GREEN' : RL_RED.has(result) ? 'RED' : 'BLACK'}. ${g.win ? `${name} wins! You get ${fmt$(g.win)}.` : `${name} loses.`}`;
        ev.push(g.win ? 'score' : 'miss'); if (g.win) ev.push('payout');
      }
    }
    return ev;
  };
  g.draw = (put, text) => {
    // the wheel, seen as a strip of its pockets going past, the ball over the middle one
    const c = Math.round(pos);
    text(15, 0, 'v', C(WHITE, 15));
    for (let k = -7; k <= 7; k++) {
      const n = RL_WHEEL[((c + k) % 37 + 37) % 37], x = 15 + k * 2;
      put(x, 1, ' ', 0, C(rlCol(n), k === 0 ? 10 : 5)); put(x, 2, ' ', 0, C(rlCol(n), k === 0 ? 10 : 5));
      text(x, 1, String(n).padStart(2), C(WHITE, k === 0 ? 15 : 10));
    }
    text(15, 3, '^', C(WHITE, 15));
    // the bets, the one you're on lit up
    RL_BETS.forEach(([name, , pays], k) => {
      const x = (k % 4) * 8, y = 5 + (k / 4 | 0) * 2, on = k === pick_;
      text(x, y, `${on ? '>' : ' '}${name}`.padEnd(9), C(on ? YEL : WHITE, on ? 15 : 10));
      text(x, y + 1, ` ${pays - 1}:1`, C(GRAY, 9));
    });
    text(0, 12, msg.slice(0, 62), C(WHITE, 15));
    text(0, 14, `BET ${fmt$(g.bet)} on ${RL_BETS[pick_][0]}`, C(YEL, 14));
    text(0, 15, `CASH ${fmt$(money)}`, C(GREEN, 13));
    if (luck() > 0) text(0, 17, 'Your jade feels warm.', C(GREEN, 9));
  };
  g.status = () => state === 'spin' ? 'Round it goes...' : `LEFT/RIGHT bet   UP/DOWN stake   SPACE spin (${fmt$(g.bet)})   E leave`;
  g.reward = () => 0;
  return g;
};
// slots: three reels. Three alike on the line pays (sevens the most), and any cherries pay something back.
// Lucky: a losing pull sometimes spins again
const SLOT_SYMS = [['7', 1, 120, RED], ['BAR', 2, 40, WHITE], ['$', 3, 20, GREEN], ['BELL', 4, 12, YEL], ['CHERRY', 6, 6, MAG], ['PLUM', 7, 4, BLUE]];
const SLOT_GLYPH = { '7': '7', BAR: '=', $: '$', BELL: 'A', CHERRY: 'o', PLUM: '@' };
const SLOT_WEIGHT = SLOT_SYMS.reduce((s, x) => s + x[1], 0);
function slotPull(rnd) { const r = []; for (let k = 0; k < 3; k++) { let w = rnd() * SLOT_WEIGHT, i = 0; while ((w -= SLOT_SYMS[i][1]) > 0) i++; r.push(i); } return r; }
function slotPays(r) { // times the stake
  if (r[0] === r[1] && r[1] === r[2]) return SLOT_SYMS[r[0]][2];
  const ch = r.filter(i => SLOT_SYMS[i][0] === 'CHERRY').length;
  return ch === 2 ? 2 : ch === 1 ? 0.5 : 0;
}
GAMES.slots = (rnd = Math.random) => {
  const W = 26, H = 16, g = { id: 'slots', title: 'SLOTS', W, H, score: 0, over: false, bet: 5, win: 0 };
  let state = 'bet', reels = [0, 1, 2], spinT = 0, msg = 'Pull the lever.', ev = [], shown = [0, 1, 2];
  g.refused = () => { state = 'bet'; msg = "You can't cover that."; };
  g.inRound = () => false; // (a pull's over in a second)
  g.state = () => state; g.reels = () => reels;
  g.step = (dt, k) => {
    ev = [];
    if (state !== 'spin') {
      if (k.upP) g.bet = betStep(g.bet, 1); if (k.downP) g.bet = betStep(g.bet, -1);
      if (k.actP && money < g.bet) msg = "You can't cover that.";
      else if (k.actP) {
        ev.push('stake', 'launch'); g.win = 0; reels = slotPull(rnd);
        if (!slotPays(reels) && rnd() < luck() * 1.5) reels = slotPull(rnd); // (lucky: it spins again)
        spinT = 0; state = 'spin'; msg = '';
      }
    } else {
      spinT += dt;
      for (let k2 = 0; k2 < 3; k2++) shown[k2] = spinT < 0.7 + k2 * 0.35 ? (spinT * 14 + k2 * 2 | 0) % SLOT_SYMS.length : reels[k2]; // stopping left to right
      if (spinT > 0.7 + 2 * 0.35) {
        g.win = Math.round(g.bet * slotPays(reels) * 100) / 100; state = 'done';
        msg = g.win ? `${slotPays(reels) >= 4 ? 'JACKPOT-ish! ' : ''}Pays ${fmt$(g.win)}.` : 'Nothing.'; ev.push(g.win > g.bet ? 'clear' : g.win ? 'eat' : 'miss'); if (g.win) ev.push('payout');
      }
    }
    return ev;
  };
  g.draw = (put, text) => {
    for (let x = 2; x < 23; x++) { put(x, 1, '=', C(YEL, 12)); put(x, 9, '=', C(YEL, 12)); }
    for (let k = 0; k < 3; k++) { // three reels, the one above and below showing too
      const x = 4 + k * 6;
      for (let d = -1; d <= 1; d++) {
        const s = SLOT_SYMS[((state === 'spin' ? shown[k] : reels[k]) + d + SLOT_SYMS.length) % SLOT_SYMS.length], y = 5 + d * 2;
        for (let dx = 0; dx < 4; dx++) put(x + dx, y, ' ', 0, C(WHITE, d ? 3 : 14));
        const label = s[0] === 'CHERRY' ? 'CHRY' : s[0].length < 3 ? ` ${s[0]}${s[0]}${s[0]}` : s[0]; // (the symbol, as big as the window lets it be)
        text(x, y, label.padStart(Math.ceil((8 + label.length) / 2)).padEnd(8), C(s[3], d ? 7 : 15));
      }
    }
    text(1, 5, '>', C(RED, 15)); text(46, 5, '<', C(RED, 15));
    text(0, 10, msg, C(WHITE, 15));
    text(0, 11, '777 x120  BAR x40  $$$ x20  BELL x12', C(GRAY, 9));
    text(0, 12, 'CHERRIES x6  PLUMS x4  2 cherries x2', C(GRAY, 9));
    text(0, 13, `BET ${fmt$(g.bet)}   CASH ${fmt$(money)}`, C(YEL, 14));
    if (luck() > 0) text(0, 14, 'Your jade feels warm.', C(GREEN, 9));
  };
  g.status = () => `SPACE pull (${fmt$(g.bet)})   UP/DOWN bet   E leave`;
  g.reward = () => 0;
  return g;
};
